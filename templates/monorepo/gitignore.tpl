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

# Scanner/build outputs.
.scannerwork/
**/.scannerwork/
sonar-report/
sonar-report*.html
sonar-issues*.csv
test-report.xml
test-report-e2e.xml
checkmarx-*.zip

# projectmem local runtime
.projectmem/events.jsonl
.projectmem/issues/
.projectmem/watch.*
.projectmem/data/
.projectmem/*.db
.projectmem/*.db-*
.projectmem/*.sqlite
.projectmem/*.sqlite-*
.projectmem/*.sqlite3
.projectmem/*.sqlite3-*
