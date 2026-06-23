#!/bin/bash

# SonarQube Complete Setup and Scan Script
# This script automates the entire SonarQube workflow

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

# Step 3: Create projects
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

# Step 4: Generate or retrieve token
echo "🔑 Setting up authentication token..."
TOKEN=$(curl -sf -u ${SONAR_USER}:${SONAR_PASS} -X POST \
    "${SONAR_HOST}/api/user_tokens/generate?name=${TOKEN_NAME}&type=GLOBAL_ANALYSIS_TOKEN" | \
    grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ Failed to generate token"
    exit 1
fi

export SONAR_TOKEN="$TOKEN"
echo "✅ Token generated and exported"

# Step 5: Run tests with coverage
echo "🧪 Running tests with coverage for all modules..."
pnpm --filter @scope/api test:cov
echo "   ✓ API tests completed"

pnpm --filter @scope/backoffice test -- --coverage
echo "   ✓ Backoffice tests completed"

pnpm --filter @scope/mobile-app test:cov
echo "   ✓ Mobile App tests completed"

# Step 6: Run SonarQube scanner for each module
echo "🔍 Running SonarQube scanner for each module..."
cd apps/api || { echo '❌ Failed to cd into apps/api'; exit 1; }
pnpm exec sonar-scanner -Dsonar.host.url=${SONAR_HOST} -Dsonar.token=${SONAR_TOKEN}
echo "   ✓ API scan completed"

cd ../backoffice || { echo '❌ Failed to cd into ../backoffice'; exit 1; }
pnpm exec sonar-scanner -Dsonar.host.url=${SONAR_HOST} -Dsonar.token=${SONAR_TOKEN}
echo "   ✓ Backoffice scan completed"

cd ../mobile-app || { echo '❌ Failed to cd into ../mobile-app'; exit 1; }
pnpm exec sonar-scanner -Dsonar.host.url=${SONAR_HOST} -Dsonar.token=${SONAR_TOKEN}
echo "   ✓ Mobile App scan completed"

cd ../..

echo ""
echo "✅ SonarQube setup and scan complete!"
echo ""
echo "📊 View results at: ${SONAR_HOST}"
echo "   Username: ${SONAR_USER}"
echo "   Password: ${SONAR_PASS}"
echo ""
echo "🔑 Token for future manual scans:"
echo "   export SONAR_TOKEN=\"${TOKEN}\""
echo ""
echo "💡 To persist the token, choose one:"
echo "   1. Project .env: echo 'SONAR_TOKEN=${TOKEN}' >> .env"
echo "   2. Shell profile: echo 'export SONAR_TOKEN=\"${TOKEN}\"' >> ~/.zshrc"
echo ""
echo "📋 Generate comprehensive reports with:"
echo "   pnpm sonar:report"
echo ""
echo "   This will create:"
echo "   - sonar-report-full.html (HTML report with vulnerabilities)"
echo "   - sonar-issues-all.csv (CSV with all issues for analysis)"
echo ""
