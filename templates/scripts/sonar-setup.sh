#!/bin/bash

# SonarQube Complete Setup and Scan Script
# Idempotent across re-runs: detects a stale .env SONAR_TOKEN (e.g. an old
# GLOBAL_ANALYSIS_TOKEN that lacks transition rights), revokes our previous
# <project>-scanner-* tokens, mints a fresh USER_TOKEN, and writes it directly
# to .env so subsequent `pnpm sonar:do` calls succeed without manual
# copy-paste. .env is backed up to .env.bak before sed mutation; on sed
# failure, restored from backup and exit 1.

set -e  # Exit on error

SONAR_PORT=9002
SONAR_HOST="http://localhost:${SONAR_PORT}"
SONAR_USER="admin"
SONAR_PASS="admin"
TOKEN_NAME="<project>-scanner-$(date +%s)"

echo "🚀 Starting SonarQube Complete Setup..."

# Step 1: Check if SonarQube container already exists
if docker ps -a --format '{{.Names}}' | grep -q '^sonarqube$'; then
    echo "📦 SonarQube container exists, checking status..."
    if docker ps --format '{{.Names}}' | grep -q '^sonarqube$'; then
        echo "✅ SonarQube is already running"
    else
        echo "🔄 Starting existing SonarQube container..."
        docker start sonarqube
    fi
else
    echo "📦 Creating and starting SonarQube container on port ${SONAR_PORT}..."
    docker run -d --name sonarqube \
        -e SONAR_ES_BOOTSTRAP_CHECKS_DISABLE=true \
        -p ${SONAR_PORT}:9000 \
        sonarqube:latest
fi

# Step 2: Wait for SonarQube to be ready
echo "⏳ Waiting for SonarQube to be ready..."
MAX_ATTEMPTS=60
ATTEMPT=0
until curl -sf "${SONAR_HOST}/api/system/status" | grep -q '"status":"UP"'; do
    ATTEMPT=$((ATTEMPT + 1))
    if [ $ATTEMPT -ge $MAX_ATTEMPTS ]; then
        echo "❌ SonarQube failed to start after ${MAX_ATTEMPTS} attempts"
        exit 1
    fi
    echo "   Waiting... (${ATTEMPT}/${MAX_ATTEMPTS})"
    sleep 2
done
echo "✅ SonarQube is ready!"

# Step 3 was previously a global POST for sonar.scm.provider. SonarQube
# 26.6.0 forbids this as a global setting (HTTP 400 + body '{"errors":
# [{"msg":"Setting 'sonar.scm.provider' cannot be global"}]}'). Because
# ?component=<project>-<name> requires the project to already exist (Step 4
# creates them), the per-project POST loop has been moved to a new "Step
# 4b" immediately after Step 4. Idempotent: POST is a no-op when the
# value already matches the existing per-project setting.

# Step 4: Create projects (idempotent)
echo "📁 Creating SonarQube projects..."
for project in "<project>-api" "<project>-backoffice" "<project>-mobile"; do
    if curl -sf -u ${SONAR_USER}:${SONAR_PASS} \
        "${SONAR_HOST}/api/projects/search?projects=${project}" | grep -q "\"key\":\"${project}\""; then
        echo "   ✓ Project ${project} already exists"
    else
        curl -sf -u ${SONAR_USER}:${SONAR_PASS} -X POST \
            "${SONAR_HOST}/api/projects/create?name=${project}&project=${project}" > /dev/null
        echo "   ✓ Created project ${project}"
    fi
done

# Step 4b: Configure per-project SCM provider=git on each project so the
# scanner knows how to compare current source against previously-reported
# issues server-side. Without this, issues whose code has been removed/edited
# don't auto-close on the next `sonar-scanner` run. Hot-reloaded by
# /api/settings/set — no restart required. Idempotent: setting the same
# value twice is a no-op (HTTP 204 No Content). Note: SonarQube 26.6.0
# rejects this as a global setting ("Setting 'sonar.scm.provider' cannot
# be global"), so it MUST be set per-project via ?component=<project>-<name>.
# Verifies: the verified working format is ?component=<KEY>&key=sonar.scm.
# provider&value=git; ?componentKey=<KEY> was confirmed to fail in this
# Sonar version (treated as global). Run after Step 4 because
# /api/settings/set rejects [PROJECT]=<project>-<name> on a not-yet-created
# project (HTTP 404).
echo "⚙️  Configuring per-project SCM provider=git on each project..."
SCM_OK_COUNT=0
SCM_FAIL_COUNT=0
for project in "<project>-api" "<project>-backoffice" "<project>-mobile"; do
    if curl -sf -u "${SONAR_USER}:${SONAR_PASS}" -X POST \
        "${SONAR_HOST}/api/settings/set?component=${project}&key=sonar.scm.provider&value=git" > /dev/null; then
        SCM_OK_COUNT=$((SCM_OK_COUNT + 1))
        echo "   ✓ Set sonar.scm.provider=git for ${project}"
    else
        SCM_FAIL_COUNT=$((SCM_FAIL_COUNT + 1))
        echo "   ❌ Failed to set sonar.scm.provider=git for ${project}"
    fi
done
if [ "$SCM_FAIL_COUNT" -gt 0 ]; then
    echo "❌ ${SCM_FAIL_COUNT}/3 projects failed SCM provider configuration"
    exit 1
fi

# Step 5: Migrate and mint token.
# Probe the existing .env SONAR_TOKEN (if any) by HTTP status code:
#   200 → valid USER_TOKEN with issueadmin access, reuse (rotate later)
#   401 → token rejected, refresh
#   403 → token authenticates but lacks issueadmin (typical stale
#         GLOBAL_ANALYSIS_TOKEN), migrate
# In every migration path we end up with a USER_TOKEN in .env and the
# replaced TYPE printed explicitly for the migration report. We also revoke
# previously-minted <project>-scanner-* tokens so re-runs don't accumulate.
echo "🔑 Checking and setting up authentication token..."

CURRENT_TOKEN=""
if [ -f .env ]; then
    CURRENT_TOKEN=$(grep '^SONAR_TOKEN=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")
fi

NEEDS_NEW_TOKEN=true
# `TOKEN_TYPE` is initialised so the success line "Migrated (${TOKEN_TYPE} →
# USER_TOKEN)" always reads cleanly, even on cold-start when .env had no
# SONAR_TOKEN= line (in which case the `if [ -n "$CURRENT_TOKEN" ]` block
# is skipped entirely).
TOKEN_TYPE="new"
if [ -n "$CURRENT_TOKEN" ]; then
    PERM_HTTP=$(curl -s -u "${CURRENT_TOKEN}:" -o /dev/null -w '%{http_code}' \
        "${SONAR_HOST}/api/permissions/users?permission=issueadmin&projectKey=<project>-api")
    case "$PERM_HTTP" in
        200)
            TOKEN_TYPE="USER_TOKEN"
            echo "   ✓ Existing USER_TOKEN is valid — reusing"
            export SONAR_TOKEN="${CURRENT_TOKEN}"
            NEEDS_NEW_TOKEN=false
            ;;
        403)
            TOKEN_TYPE="GLOBAL_ANALYSIS_TOKEN"
            echo "   🔄 Existing token lacks issueadmin (403) — migrating to USER_TOKEN"
            ;;
        401)
            TOKEN_TYPE="invalid"
            echo "   🔄 Existing token rejected (401) — refreshing"
            ;;
        *)
            TOKEN_TYPE="unknown"
            echo "   ⚠️  Existing token probe returned HTTP ${PERM_HTTP} — migrating to be safe"
            ;;
    esac
fi

if [ "$NEEDS_NEW_TOKEN" = true ]; then
    echo "   🧹 Revoking previous <project>-scanner-* tokens..."
    # Best-effort; failures are non-fatal (token may already be gone).
    for OLD_TOKEN_NAME in $(curl -sf -u "${SONAR_USER}:${SONAR_PASS}" \
        "${SONAR_HOST}/api/user_tokens/search" 2>/dev/null | \
        grep -oE '"name":"<project>-scanner-[0-9]+"' | cut -d'"' -f4 | \
        grep -v "^${TOKEN_NAME}$" | head -10 || true); do
        curl -sf -u "${SONAR_USER}:${SONAR_PASS}" -X POST \
            "${SONAR_HOST}/api/user_tokens/revoke?name=${OLD_TOKEN_NAME}" >/dev/null 2>&1 || true
        echo "      ↳ revoked ${OLD_TOKEN_NAME}"
    done

    echo "   🎫 Minting fresh USER_TOKEN..."
    TOKEN=$(curl -sf -u ${SONAR_USER}:${SONAR_PASS} -X POST \
        "${SONAR_HOST}/api/user_tokens/generate?name=${TOKEN_NAME}&type=USER_TOKEN" | \
        grep -o '"token":"[^"]*"' | cut -d'"' -f4)

    if [ -z "$TOKEN" ]; then
        echo "❌ Failed to generate token"
        exit 1
    fi

    # Defensive guard: SonarQube tokens are alphanumeric+slashes+dashes and
    # never contain `&` per docs, but if a future token does, sed would
    # interpret `&` in the replacement string as "matched text". Detect up
    # front and bail with a clear message instead of corrupting .env.
    if echo "$TOKEN" | grep -q '[&|]'; then
        echo "❌ Newly minted token contains '&' or '|' — sed replacement unsafe." \
            "Manually edit .env to set SONAR_TOKEN=\"${TOKEN}\""
        exit 1
    fi

    echo "   💾 Writing new token to .env..."
    if [ ! -f .env ]; then
        touch .env
    fi
    cp .env .env.bak
    if grep -q '^SONAR_TOKEN=' .env.bak; then
        # Escape `&` for sed replacement (sed interprets `&` as the matched
        # text in the replacement side; SonarQube tokens don't contain `&`
        # per docs but escape proactively). `|` is the sed delimiter, so
        # tokens containing `|` would break the substitution entirely; the
        # defensive `[&|]` guard above bails before we get here.
        ESCAPED_TOKEN=$(printf '%s' "$TOKEN" | sed 's/&/\\&/g')
        if sed "s|^SONAR_TOKEN=.*|SONAR_TOKEN=\"${ESCAPED_TOKEN}\"|" .env.bak > .env.tmp \
            && mv .env.tmp .env; then
            rm -f .env.bak
            echo "      ↳ updated SONAR_TOKEN in .env"
        else
            echo "⚠️  Failed to update .env — restoring from .env.bak"
            mv .env.bak .env
            exit 1
        fi
    else
        echo "SONAR_TOKEN=\"${TOKEN}\"" >> .env
        rm -f .env.bak
        echo "      ↳ appended SONAR_TOKEN to .env"
    fi
    export SONAR_TOKEN="$TOKEN"
    echo "✅ Migrated (${TOKEN_TYPE} → USER_TOKEN) and saved to .env"
fi

# Step 6 (gate): pre-flight doctor hook before the test+cov + scanner phases.
# Echoes the same pattern that scripts/sonar-do.sh runs at its top: if any
# doctor probe reports [err] (stale USER_TOKEN without issueadmin,
# missing sonar.scm.provider, Compute Engine in-progress lock, CSV drift)
# we fail fast BEFORE running test:cov for any of the 3 apps — instead of
# wasting 10-15 min of test:cov and then having the scanner upload
# rejected by an unrelated pre-flight problem. SONAR_SKIP_DOCTOR=1 bypasses
# the gate for emergency runs where the user has already triaged the
# underlying cause out-of-band. The doctor runs AFTER Step 5 (token
# migration completion) so probe 2 has a valid USER_TOKEN to test against;
# a single invocation at this boundary is sufficient. Setup mode skips probe 3:
# its upcoming scan is what makes any existing CSV/server drift actionable.
# Regular sonar:doctor and sonar:do calls remain strict.
if [ "${SONAR_SKIP_DOCTOR:-0}" != "1" ]; then
  if ! SONAR_DOCTOR_FRESH_SETUP=1 bash scripts/sonar-doctor.sh; then
    echo ''
    echo '[err] Sonar pre-flight FAILED on setup. The most common fixes:'
    echo ''
    echo '  - issueadmin: forbidden (token is GLOBAL_ANALYSIS_TOKEN or non-admin)'
    echo '    -> re-run pnpm sonar:setup to mint a fresh USER_TOKEN'
    echo '  - sonar.scm.provider unset (expected "git")'
    echo '    -> re-run pnpm sonar:setup to enable server-side SCM auto-close'
    echo '  - Compute Engine has an in-progress task'
    echo '    -> wait ~30s for completion or POST /api/ce/task/<id> to cancel'
    echo 'To bypass this check (NOT recommended) set SONAR_SKIP_DOCTOR=1'
    exit 1
  fi
fi

# Step 6: Run the same full cycle as `pnpm sonar:do` without a second doctor.
SONAR_DOCTOR_DONE=1 bash scripts/sonar-do.sh all

echo ""
echo "✅ SonarQube setup and full scan/report cycle complete!"
echo ""
echo "📊 View results at: ${SONAR_HOST}"
echo "   Username: ${SONAR_USER}"
echo "   Password: ${SONAR_PASS}"
echo ""
echo "📋 Re-run the full cycle per app:"
echo "   pnpm sonar:do:api"
echo "   pnpm sonar:do:backoffice"
echo "   pnpm sonar:do:mobile"
echo ""
echo "🔍 Diagnostic if anything looks off:"
echo "   pnpm sonar:doctor"
echo ""
