#!/usr/bin/env bash
# Consolidates the full SonarQube cycle — scan, bulk-close stale issues, generate
# the HTML report, patch it into parity with the modern severity labels — for
# one or all 3 projects.
#
# Usage: scripts/sonar-do.sh [api|backoffice|mobile|all]
#
# Replaces the previous nine-entry sonar:{scan,close-stale,report,scan-and-report}:*
# family. Single source of truth for the full Sonar flow.
#
# Pipeline per project (4 steps):
#   1. scan       — `pnpm test:cov` (or vitest --coverage) + sonar-scanner
#   2. fetch CSV  — current server state (pre-close)
#   3. close      — `bulk-close-stale-issues.mjs --apply` resolves stale keys
#                   via /api/issues/bulk_change and refreshes $csv on success
#   4. HTML+patch — `sonar-report` CLI to insert table, then
#                   `patch-sonar-summary.mjs` to upgrade severities/filter UI
# Bulk-close failures don't abort the script: --apply skipping still leaves the
# pre-close CSV on disk, so the HTML reflects the post-scan state and the user
# can re-run. Only the dry-run path is absent from this entry point by design.

set -euo pipefail

cd "$(dirname "$0")/.."

# Surface SONAR_TOKEN without leaking it into any sub-shell via xtrace.
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [ -z "${SONAR_TOKEN:-}" ]; then
  echo "[err] SONAR_TOKEN is empty. Set it in .env or export SONAR_TOKEN before running."
  exit 1
fi

# ─── Pre-flight doctor hook ────────────────────────────────────────────────
# Run scripts/sonar-doctor.sh before any scanner upload to surface config
# issues up-front — stale .env SONAR_TOKEN lacking transition rights, missing
# server-side sonar.scm.provider=git, CSV-vs-server drift — instead of
# letting them surface mid-pipeline as cryptic 403s or stale CSV counts.
# `pnpm sonar:setup` is the cure for the first two; re-running the affected
# project's `pnpm sonar:do:<project>` is the cure for CSV drift.
#
# Set SONAR_SKIP_DOCTOR=1 to bypass (NOT recommended — only for emergency
# rollback when doctor probes themselves are misbehaving against your server).
#
# Set SONAR_DOCTOR_DONE=1 (exported) to skip recursive doctor invocations
# inside an already-running 'do all' session. The `case all` branch at the
# bottom of this script recurses into "$0 api" / "$0 backoffice" /
# "$0 mobile" — one fresh subprocess invocation per project — and each
# child re-runs this same pre-flight block from scratch. The just-completed
# prior project's scanner-upload Compute Engine task is often still
# `IN_PROGRESS` server-side for several seconds-to-minutes after the
# upload finishes, so probe 4 ("Another SonarQube analysis is already in
# progress") would abort the otherwise-fine pipeline between e.g. the
# API scan finishing and the Backoffice/Doctor gate firing. The top-level
# `pnpm sonar:do all` invocation already ran the doctor once and is the
# only authoritative gate for that session; the recursive children's gate
# is redundant (probe counts were captured at the top level, and the only
# probe that could plausibly drift in <60s is probe 4, which we specifically
# skip here). Direct single-project invocations (`pnpm sonar:do:api`,
# `scripts/sonar-do.sh api`) do NOT set SONAR_DOCTOR_DONE, so they still
# get a full per-project doctor gate.
#
# Also pass "${1:-all}" to scripts/sonar-doctor.sh so single-project
# invocations only check that project's state (<project>-api only, not the
# full 3-project set), avoiding false-positive probe-4 hits when a
# sibling project happens to have a draining CE task unrelated to the
# target project being scanned.
if [ "${SONAR_DOCTOR_DONE:-0}" = "1" ]; then
  echo
  echo "==> [info] doctor already ran at top level (skipping recursive pre-flight gate)"
  echo
elif [ "${SONAR_SKIP_DOCTOR:-0}" = "1" ]; then
  echo
  echo "==> [info] SONAR_SKIP_DOCTOR=1 — skipping pre-flight doctor hook"
  echo
else
  export SONAR_DOCTOR_DONE=1
  echo
  echo "==> pre-flight: invoking scripts/sonar-doctor.sh (per-project when invoked as project, else all)"
  echo
  if ! bash scripts/sonar-doctor.sh "${1:-all}"; then
    # Sequential `echo` lines, NOT a heredoc — a previous heredoc with <project>
    # and Unicode characters leaked past the EOF terminator in some bash
    # parsers, producing a spurious `line 72: --: command not found` error.
    # Using single-quoted echo args + plain ASCII + [PROJECT] placeholders
    # avoids heredoc, I/O-redirection, command-substitution, and locale issues.
    echo
    echo '[err] Sonar pre-flight FAILED. The most common fixes:'
    echo
    echo '  - administerIssues: forbidden (token is GLOBAL_ANALYSIS_TOKEN...)'
    echo '      re-run "pnpm sonar:setup" to mint a fresh USER_TOKEN.'
    echo '  - sonar.scm.provider=... (expected git)'
    echo '      re-run "pnpm sonar:setup" to enable server-side SCM auto-close.'
    echo '  - CSV-ahead or CSV-behind drift'
    echo '      re-run the failing project "pnpm sonar:do:[PROJECT]" after'
    echo '      the underlying cause is fixed (stale RESOLVED leak in CSV / new'
    echo '      server-side OPENs not yet picked up).'
    echo
    echo 'To bypass this check (NOT recommended) for a single run:'
    echo '  SONAR_SKIP_DOCTOR=1 pnpm sonar:do [PROJECT]'
    echo
    exit 1
  fi
fi

fetch_csv() {
  local project="$1" csv="$2"
  # `&statuses=OPEN,REOPENED,CONFIRMED` is critical: without it the CSV
  # contains RESOLVED issues from prior runs, which then inflates the
  # `detected` set used by bulk-close-stale-issues.mjs — open issues
  # that legitimately still belong in the diff (e.g. S3776 ones the
  # scanner couldn't auto-close) end up matched and never get closed.
  # Keeping the CSV to actionable statuses makes the diff meaningful
  # and prevents closed issues from "reappearing" on later runs.
  curl -fsS -u "${SONAR_TOKEN}:" \
    "http://localhost:9002/api/issues/search?componentKeys=${project}&ps=500&statuses=OPEN,REOPENED,CONFIRMED" \
    -o "/tmp/sonar-${project}.json"
  mkdir -p "$(dirname "${csv}")"
  echo "type,severity,rule,message,component,line" > "${csv}"
  jq -r '
    .issues[]
    | [.type, .severity, .rule, .message, .component, (.line // "N/A")]
    | @csv
  ' "/tmp/sonar-${project}.json" >> "${csv}"
}

# run_project PROJECT APP_DIR LABEL HTML CSV TEST_CMD ...
# After the 5 fixed positional args (PROJECT / APP_DIR / LABEL / HTML / CSV)
# the remaining args ARE the test command for the app directory. Forwarded
# via "$@" so each case branch keeps its own command without a string
# round-trip through eval. Note: the previous `--` separator was removed
# because it was being interpreted as a literal command inside "$@".
run_project() {
  local project="$1" app_dir="$2" label="$3" html="$4" csv="$5" scan_exit=0
  shift 5

  echo
  echo "==> ${label}: 1/4 scan"
  # Capture the scan exit so a test or scanner failure doesn't abort the
  # function before bulk-close (Step 3) and HTML generation (Step 4) can
  # still run. Note: Step 2 (fetch_csv below) overwrites the on-disk CSV
  # unconditionally with curl+jq output — so the bulk-close after a scan
  # failure operates on whatever fetch_csv retrieves from the live server,
  # not on any "pre-existing" CSV. The warn message reflects this.
  (
    cd "${app_dir}"
    "$@"
    pnpm exec sonar-scanner -Dsonar.token="${SONAR_TOKEN}"
  ) || scan_exit=$?
  if [ "$scan_exit" -ne 0 ]; then
    echo "[warn] ${label} scan step exited ${scan_exit} (test:cov or sonar-scanner failed); bulk-close will operate on the CSV that fetch_csv retrieves from the server"
  fi

  echo
  echo "==> ${label}: 2/4 fetch CSV (pre-close)"
  fetch_csv "${project}" "${csv}"

  echo
  echo "==> ${label}: 3/4 close stale (--apply)"
  # bulk-close refreshes ${csv} on success — we deliberately skip a second
  # fetch here. Non-fatal: a refused PATCH/POST leaves the CSV with the
  # pre-close state, and we still generate the HTML downstream.
  if ! node scripts/bulk-close-stale-issues.mjs \
    --project="${project}" \
    --csv="${csv}" \
    --apply; then
    echo "[warn] bulk-close exited non-zero for ${label} (token permission? Web API 403?) — continuing with pre-close CSV"
  fi

  echo
  echo "==> ${label}: 4/4 generate + patch HTML"
  local branch
  branch="$(git rev-parse --abbrev-ref HEAD)"
  pnpm exec sonar-report \
    --sonarurl=http://localhost:9002 \
    --sonarcomponent="${project}" \
    --sonartoken="${SONAR_TOKEN}" \
    --no-security-hotspot \
    --allbugs \
    --application="${label}" \
    --branch="${branch}" \
    --output="${html}"
  SONAR_APPLICATION="${label}" \
  SONAR_BRANCH="${branch}" \
    node scripts/patch-sonar-summary.mjs "${csv}" "${html}" "${project}"

  if [ "$(uname)" = "Darwin" ] && command -v open >/dev/null; then
    open "${html}"
  elif command -v xdg-open >/dev/null; then
    xdg-open "${html}"
  fi
  echo "  ${label}: ${html} + ${csv}"
}

case "${1:-all}" in
  api)
    run_project "<project>-api" "apps/api" "<project> API" \
      "sonar-report-api.html" "sonar-issues-api.csv" \
        pnpm test:cov
    ;;
  backoffice)
    run_project "<project>-backoffice" "apps/backoffice" "<project> Backoffice" \
      "sonar-report-backoffice.html" "sonar-issues-backoffice.csv" \
        pnpm test -- --coverage
    ;;
  mobile)
    run_project "<project>-mobile" "apps/mobile-app" "<project> Mobile" \
      "sonar-report-mobile.html" "sonar-issues-mobile.csv" \
        pnpm test:cov
    ;;
  all)
    "$0" api
    "$0" backoffice
    "$0" mobile
    echo
    echo "==> done: 3 sonar reports + 3 CSVs regenerated"
    ;;
  *)
    echo "Usage: $0 [api|backoffice|mobile|all]"
    exit 1
    ;;
esac
