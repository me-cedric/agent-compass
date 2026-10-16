#!/usr/bin/env bash
# sonar-doctor.sh — read-only preflight health check for the SonarQube flow.
#
# Four probes drive whether `pnpm sonar:do` will reduce the open-issue count:
#   1. Server-side `sonar.scm.provider` is set to git → so the scanner can
#      auto-close issues whose code was removed/edited on the next run.
#   2. The current SONAR_TOKEN carries `Administer Issues` on at least one
#      project → so the bulk-close safety net in `pnpm sonar:do` actually
#      resolves stale keys. A `GLOBAL_ANALYSIS_TOKEN` returns 403 here even
#      though scans succeed.
#   3. The on-disk `sonar-issues-*.csv` rows roughly match the server's
#      OPEN+REOPENED+CONFIRMED count for the matching project; drift means
#      either the CSV is stale (run `pnpm sonar:do`) or the scanner missed
#      fresh detections.
#   4. The Compute Engine has no in-progress task for the project → so the
#      scanner upload will not be rejected with "Another SonarQube analysis
#      is already in progress". Catches the orphaned-lock failure mode that
#      previously locked out the next pnpm sonar:do run.
#
# All probes are read-only. Nothing is written to the database. Safe to run
# repeatedly without affecting the scanner output downstream.
#
# Usage: scripts/sonar-doctor.sh [api|backoffice|mobile|all]
#        (default: all)

set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

SONAR_HOST="${SONAR_HOST:-http://localhost:9002}"

if [ -z "${SONAR_TOKEN:-}" ]; then
  echo "[err] SONAR_TOKEN is empty. Set it in .env or export SONAR_TOKEN before running."
  exit 1
fi

PROJECT="${1:-all}"
case "$PROJECT" in
  api)
    PROJECTS=("<project>-api:<project> API:sonar-issues-api.csv")
    ;;
  backoffice)
    PROJECTS=("<project>-backoffice:<project> Backoffice:sonar-issues-backoffice.csv")
    ;;
  mobile)
    PROJECTS=("<project>-mobile:<project> Mobile:sonar-issues-mobile.csv")
    ;;
  all)
    PROJECTS=(
      "<project>-api:<project> API:sonar-issues-api.csv"
      "<project>-backoffice:<project> Backoffice:sonar-issues-backoffice.csv"
      "<project>-mobile:<project> Mobile:sonar-issues-mobile.csv"
    )
    ;;
  *)
    echo "Usage: $0 [api|backoffice|mobile|all]"
    exit 1
    ;;
esac

echo "==> sonar-doctor ($PROJECT)"
echo

# ─── 1/4 server-side sonar.scm.provider ────────────────────────────────────
# SonarQube 26.6.0 forbids this setting as a global value (HTTP 400
# 'Setting 'sonar.scm.provider' cannot be global'). We loop the
# PROJECTS array (<project>-{api,backoffice,mobile}) and check per-project
# values via `?component=<KEY>`, the verified working format from the
# session where this fix was designed. Aggregate PASS only when all 3
# projects have sonar.scm.provider=git; list missing projects in the
# FAIL line so the user knows exactly which pnpm sonar:setup needs to
# re-run. Same shell-only `grep` pattern as probe 3 (no jq dep).
printf "── 1/4 server-side sonar.scm.provider ──\n"
SCM_OK=1
FAILED_SCM_PROJECTS=""
for entry in "${PROJECTS[@]}"; do
  IFS=':' read -r KEY LABEL CSV <<<"$entry"
  SCM_VAL=$(curl -fsS -u "${SONAR_TOKEN}:" \
    "${SONAR_HOST}/api/settings/values?component=${KEY}&keys=sonar.scm.provider" | \
    grep -o '"value":"[^"]*"' | head -1 | cut -d'"' -f4 || true)
  if [ "$SCM_VAL" = "git" ]; then
    printf "  ✅ sonar.scm.provider=git on %s (per-project)\n" "$KEY"
  else
    SCM_OK=0
    if [ -z "$FAILED_SCM_PROJECTS" ]; then
      FAILED_SCM_PROJECTS="$KEY"
    else
      FAILED_SCM_PROJECTS="$FAILED_SCM_PROJECTS, $KEY"
    fi
    printf "  ❌ sonar.scm.provider=%s on %s (expected 'git' for per-project SCM auto-close — re-run pnpm sonar:setup)\n" "${SCM_VAL:-<unset>}" "$KEY"
  fi
done
if [ "$SCM_OK" -eq 1 ]; then
  printf "  ✅ sonar.scm.provider=git on all 3 projects (scanner auto-closes fixed issues on next scan)\n"
else
  printf "  ❌ sonar.scm.provider missing on: %s — re-run pnpm sonar:setup to set per-project SCM provider=git\n" "$FAILED_SCM_PROJECTS"
  FAILS_GLOBAL=1
fi

# ─── 2/4 SONAR_TOKEN has issueadmin rights ──────────────────────────────────
# SonarQube 26.6.0 deprecated /api/permissions/check entirely (returns
# HTTP 404 "Unknown url : /api/permissions/check") and renamed the
# `administerIssues` permission to `issueadmin`. The canonical replacement
# endpoint shape is /api/permissions/users?permission=issueadmin&projectKey=
# — it returns 200 with a `users[]` list of holders for the named permission
# when the token + project are both valid. 200 means the token authenticates
# and the named permission is recognized (so project + token + permission
# name are all valid); 403 means the token is rejected (typically a
# GLOBAL_ANALYSIS_TOKEN-style credential that lacks the necessary scope);
# 401 means invalid token. Picking <project>-api for the probe project because
# it always exists in our setup; any of the 3 would work as a user-scope
# signal since admin perms inherit identity-wide.
#
# (Note: we deliberately avoid /api/issues/bulk_change as the probe — it
# returns 200 even when the key doesn't exist, conflating "key not found"
# with "transition succeeded". The new endpoint shape has no such
# ambiguity because 26.6.0 400s on the unknown permission name, surfacing
# the rename directly via the response body.)
printf "\n── 2/4 SONAR_TOKEN issueadmin rights ──\n"
PERM_STATUS=$(curl -s -o /dev/null -w '%{http_code}' \
  -u "${SONAR_TOKEN}:" \
  "${SONAR_HOST}/api/permissions/users?permission=issueadmin&projectKey=<project>-api")
case "$PERM_STATUS" in
  200)
    printf "  ✅ issueadmin: granted (bulk_change transitions will succeed)\n"
    ;;
  403)
    printf "  ❌ issueadmin: forbidden (token is GLOBAL_ANALYSIS_TOKEN — re-run pnpm sonar:setup to mint a USER_TOKEN)\n"
    FAILS_GLOBAL=1
    ;;
  401)
    printf "  ❌ issueadmin: unauthorized (token invalid/expired — check .env SONAR_TOKEN)\n"
    FAILS_GLOBAL=1
    ;;
  *)
    printf "  ⚠️  issueadmin: HTTP %s (server unreachable? auth misconfigured?)\n" "$PERM_STATUS"
    FAILS_GLOBAL=1
    ;;
esac

# ─── 3/4 per-project CSV row count vs server OPEN count ───────────────────
# Tolerate ≤5% drift (e.g., one new detection landed between CSV write and
# probe read). Files missing from disk → warn (run pnpm sonar:do). Files
# exist with no matching server → warn (rare: scanner auto-closed all).
printf "\n── 3/4 CSV row count vs server OPEN+REOPENED+CONFIRMED count ──\n"
declare -a FAILS_LOCAL=()
for entry in "${PROJECTS[@]}"; do
  IFS=':' read -r KEY LABEL CSV <<<"$entry"
  if [ "${SONAR_DOCTOR_FRESH_SETUP:-0}" = "1" ]; then
    printf "  ℹ️  %s: CSV drift check skipped — setup will refresh it\n" "$LABEL"
    continue
  fi
  if [ ! -f "$CSV" ]; then
    printf "  ⚠️  %s: CSV missing (%s) — run pnpm sonar:do to generate it\n" "$LABEL" "$CSV"
    FAILS_LOCAL+=("$LABEL")
    continue
  fi
  CSV_COUNT=$(($(wc -l <"$CSV") - 1))
  if [ "$CSV_COUNT" -lt 0 ]; then
    CSV_COUNT=0
  fi
  # ps=1 keeps the response tiny; `total` is computed server-side regardless.
  SERVER_OPEN=$(curl -fsS -u "${SONAR_TOKEN}:" \
    "${SONAR_HOST}/api/issues/search?componentKeys=${KEY}&statuses=OPEN,REOPENED,CONFIRMED&ps=1" | \
    grep -o '"total":[0-9]*' | head -1 | cut -d: -f2 || true)
  if [ -z "$SERVER_OPEN" ]; then
    printf "  ⚠️  %s: server OPEN count unavailable (network/auth?)\n" "$LABEL"
    FAILS_LOCAL+=("$LABEL")
    continue
  fi

  if [ "$CSV_COUNT" -eq 0 ] && [ "$SERVER_OPEN" -eq 0 ]; then
    printf "  ✅ %s: CSV=0  server=0 (clean)\n" "$LABEL"
    continue
  fi
  if [ "$CSV_COUNT" -eq "$SERVER_OPEN" ]; then
    printf "  ✅ %s: CSV=%d  server OPEN=%d (aligned)\n" "$LABEL" "$CSV_COUNT" "$SERVER_OPEN"
    continue
  fi
  # Drift. Differentiate the direction so the hint names the cause, not just
  # the symptom. CSV-ahead = stale RESOLVED entries leaking in (the bug we
  # just fixed by adding &statuses=OPEN,REOPENED,CONFIRMED to fetch_csv).
  # CSV-behind = new un-detected code, server-only OPENs not in CSV yet.
  DELTA=$((CSV_COUNT - SERVER_OPEN))
  ABS_DELTA=${DELTA#-}
  # `<project>-api` -> `api` (matches sonar:do:api in package.json). The colon-
  # separated form is what pnpm recognises — `pnpm sonar:do <project>-api`
  # would fail with "missing script". Strip `<project>-` to get the short name.
  SHORT=${KEY#<project>-}
  if [ "$DELTA" -gt 0 ]; then
    printf "  ❌ %s: CSV=%d  server OPEN=%d (+%d stale RESOLVED entries leaking into CSV — re-run pnpm sonar:do:%s to regenerate)\n" \
      "$LABEL" "$CSV_COUNT" "$SERVER_OPEN" "$ABS_DELTA" "$SHORT"
  else
    printf "  ❌ %s: CSV=%d  server OPEN=%d (+%d server-OPEN issues not in CSV — re-run pnpm sonar:do:%s to refresh)\n" \
      "$LABEL" "$CSV_COUNT" "$SERVER_OPEN" "$ABS_DELTA" "$SHORT"
  fi
  FAILS_LOCAL+=("$LABEL")
done

# ─── 4/4 Compute Engine in-progress tasks ───────────────────────────────────
# /api/ce/activity?status=IN_PROGRESS&componentKeys=${KEY} returns the
# currently-running Compute Engine tasks for a project (scanner uploads,
# webhook deliveries, branch analysis, etc.). If any are pending, the
# next `pnpm sonar:do` will be rejected with `IllegalStateException:
# Another SonarQube analysis is already in progress` — the exact failure
# observed when a previous scanner upload was orphaned mid-flight (cancel
# did not land, or sonar-scanner crashed between submitting the report
# worker and SonarQube acknowledging completion). We grep
# `"status":"IN_PROGRESS"` occurrences in the JSON response (no jq
# dependency, matching the same shell-only pattern probes 1/2/3 use);
# the URL's status=IN_PROGRESS filter ensures we only see live tasks,
# and the componentKeys filter scopes them to our project. Hint names
# the well-known cause and the recovery path (~30s wait or explicit
# cancel POST). Failures are local (per-project) so a stale backoffice
# lock does not block an unrelated API run.
printf "\n── 4/4 Compute Engine in-progress tasks ──\n"
for entry in "${PROJECTS[@]}"; do
  IFS=':' read -r KEY LABEL CSV <<<"$entry"
  INPROG=$(curl -fsS -u "${SONAR_TOKEN}:" \
    "${SONAR_HOST}/api/ce/activity?status=IN_PROGRESS&componentKeys=${KEY}" 2>/dev/null | \
    grep -c '"status":"IN_PROGRESS"' || true)
  if [ -z "$INPROG" ]; then
    printf "  ⚠️  %s: CE activity check unavailable (network/auth?)\n" "$LABEL"
    FAILS_LOCAL+=("$LABEL")
    continue
  fi
  if [ "$INPROG" -eq 0 ]; then
    printf "  ✅ %s: no in-progress CE task\n" "$LABEL"
    continue
  fi
  printf "  ❌ %s: %d in-progress Compute Engine task(s) (server holds an analysis lock — scanner will reject with 'Another SonarQube analysis is already in progress'; wait ~30s for completion or POST '%s/api/ce/task/{id}?error=manual+abort' with a USER_TOKEN to cancel)\n" "$LABEL" "$INPROG" "$SONAR_HOST"
  FAILS_LOCAL+=("$LABEL")
done

# ─── summary ────────────────────────────────────────────────────────────────
printf "\n── summary ──\n"
if [ "${FAILS_GLOBAL:-0}" -eq 0 ] && [ "${#FAILS_LOCAL[@]}" -eq 0 ]; then
  printf "  ✅ all green — pnpm sonar:do will close stale issues as expected\n"
  exit 0
fi
TOTAL_FAILS=${FAILS_GLOBAL:-0}
[ "${#FAILS_LOCAL[@]}" -gt 0 ] && TOTAL_FAILS=$((TOTAL_FAILS + ${#FAILS_LOCAL[@]}))
printf "  ❌ %d check(s) failed\n" "$TOTAL_FAILS"
exit 1
