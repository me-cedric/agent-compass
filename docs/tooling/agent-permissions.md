# Model & Permission Profiles

Wrong model or permission mode causes quality and safety failures that look like
prompting problems. Pick a profile by task type. Default to least access, then
loosen only for trusted, well-validated repo workflows.

## Profiles

| Profile | Use for | Model tier | Edits | Shell | Network | Approval |
| ------- | ------- | ---------- | ----- | ----- | ------- | -------- |
| read-only | research, explanation, audits, review | cheap–mid | none | read-only | as needed | n/a |
| fast-edit | small, reversible, low-risk changes | mid | yes | validation cmds only | off | ask on destructive |
| careful | migrations, security, infra, shared types | top | yes, reviewed | prompt per write | off | prompt |
| background/goal | long bounded autonomous loops | top | yes | validation loop | off | no commit/push/deploy |
| subagent | parallel review/exploration lanes | mid | only if the role must | narrow | off | inherits parent |

Rules: never auto-approve destructive shell (delete, push, deploy) or
secret-reading; keep network off unless the task needs it; a background/goal run
still obeys the safety rule — no commit, push, deploy, publish, or PR without
explicit approval (`AGENTS.md` §10).

## Claude Code

Set defaults in `.claude/settings.json` (`permissions.defaultMode`, `allow`,
`ask`, `deny`) and pick the model with `/model`. Give subagents narrow `tools` in
their frontmatter. See `templates/claude/.claude/settings.example.json` for a
conservative starting point (deny secrets, ask on push/delete, allow validation).

## Codex

Use `[profiles.NAME]` in `config.toml` with `model`, `approval_policy`, and
`sandbox_mode`; select with `codex --profile NAME`. See
`templates/codex/.codex/config.toml` for `fast` and `careful` profiles.

## Copilot

Cloud agent and code review run configured tools autonomously — keep them on a
read-only allowlist and reserve write tools for local, approval-gated surfaces.
See [`mcp.md`](mcp.md) and the MCP tool contract.
