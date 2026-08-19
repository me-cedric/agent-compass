# Two traps of this file format. Read them before you edit a pattern.
#
# 1. `#` opens a comment only at the start of a line. Text after a pattern on
#    the same line becomes part of that pattern. The pattern then matches
#    nothing, and git reports no error. Put every comment on its own line, like
#    this one.
# 2. A pattern without a leading slash matches at any depth. `coverage/` below
#    also hides `packages/api/coverage/`, with no warning. Write `/coverage/`
#    when the pattern must match the repository root only. For the same reason,
#    `coverage/` needs no `**/coverage/` twin.

node_modules/
.venv/
.turbo/
.idea/
.vscode/settings.json
coverage/
.eslintcache
*.log

# OS metadata. Git ignores these files. A packaging step that copies the working
# tree still copies them into the artifact, so the packaging step must strip the
# same set — see the "Strip OS metadata before packaging" note in
# templates/README.md. `._*` are AppleDouble sidecars: macOS writes one next to
# every file on a filesystem that cannot hold extended attributes, such as SMB
# and exFAT. They are the most numerous of the set.
.DS_Store
._*
.Spotlight-V100
.Trashes
Thumbs.db
desktop.ini

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
**/.agent/.upstream-source-check.json
# Evidence bundles and change reports: regenerable, and heavy with screenshots.
# Publish them as a CI artifact; do not commit them.
.agent/evidence/
.agent/changes/

# Scanner/build outputs.
.scannerwork/
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
