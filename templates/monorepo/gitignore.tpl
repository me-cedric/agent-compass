node_modules/
.venv/
.DS_Store
.turbo/
.idea/
.vscode/settings.json
coverage/
**/coverage/
**/.eslintcache
*.log

# Environment variables may contain secrets.
.env
.env.local
.env.*.local
!.env.example

# Local MCP/client config.
.vscode/mcp.json
.mcp.json

# Agent-local work dirs.
.claude/worktrees/
.auto-claude/
tasks/lessons.md
tasks/todo.md
.agent/RUNBOOK.md
.agent/doctor-report.md
.agent/failure-mining.md
.agent/mcp-readiness.md
.agent/migration-plan.md
.agent/provider-verification.md
.agent/quality-gates.md
.agent/recommendations.md
.agent/report.html
.agent/spec-validation-map.md
.agent/.update-check.json

# Scanner/build outputs.
.scannerwork/
**/.scannerwork/
sonar-report/
sonar-report*.html
sonar-issues*.csv
test-report.xml
test-report-e2e.xml
checkmarx-*.zip

# projectmem — commit events.jsonl (shared source of truth, union-merged via
# .gitattributes); ignore the regenerated projections (rebuilt by pjm regenerate).
.projectmem/summary.md
.projectmem/PROJECT_MAP.md
.projectmem/AI_INSTRUCTIONS.md
.projectmem/issues/
.projectmem/watch.*
.projectmem/data/
.projectmem/*.db
.projectmem/*.db-*
.projectmem/*.sqlite
.projectmem/*.sqlite-*
.projectmem/*.sqlite3
.projectmem/*.sqlite3-*
