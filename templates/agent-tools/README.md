# Agent Tools Templates

Provider-specific setup that sits below the shared `AGENTS.md` contract.

| Folder | Purpose |
| ------ | ------- |
| `../codex/.codex/` | Codex repo config, permission profiles, and hook examples. |
| `../claude/.claude/` | Claude subagent, hook, and permission examples. |
| `../mcp/` | MCP allowlist/config examples + per-tool contract for Copilot, Codex, Cursor, Gemini. |
| `../evals/` | Teaching/tool-offer eval fixtures. |
| `../intake/` | Agent-ready work intake template (Goal/Context/Constraints/Done/Validation). |
| `../trace/` | Agent trace/outcome log schema (learn from failures, no secrets). |

Use these only after the basic Agent Compass install passes doctor. Keep local
secrets and personal config out of git.
