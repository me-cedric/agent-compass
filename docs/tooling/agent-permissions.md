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

## Agent permission tiers

A headless agent cannot answer an approval prompt. Each agent CLI therefore needs
a non-interactive mode. Expose exactly three tiers, and make the safest one the
default.

| Tier | What it grants | What it gives up |
| --- | --- | --- |
| **Plan** | reads the working copy and proposes a change | no write, no shell |
| **Auto** | writes files and runs ordinary commands, guardrails active | approval per write |
| **Bypass** | every check removed | file scope, command limits, and the refusals that block a force-push, a production deploy, or a secret read |

A Bypass tier removes CLI guardrails. It does not remove the contract: no commit,
push, deploy, publish, or PR without explicit approval (`AGENTS.md` §10,
[guidelines/operational-safety.md](../guidelines/operational-safety.md)).

Rules:

- Default to Plan. Persist the last chosen tier for the next session.
- Confirm Bypass once, in a dialog that names what it removes. Do not repeat the
  dialog on every switch; a repeated alert teaches the user to click without
  reading.
- Display the active tier for as long as it stays active.
- Resolve an unknown tier value to Plan. A permission must never come from a
  typo.
- Test the scale. Assert that no blanket-bypass flag appears in the two lower
  tiers, and that an unrecognized value resolves to Plan.

### Flags

The three tiers are the runtime surface. The five profiles above are the task-type
selection. A read-only profile runs at the Plan tier; fast-edit and careful run at
Auto; no profile requires Bypass.

One implementation maps the three tiers onto these flags:

| Tier | Claude Code | Codex | GitHub Copilot |
| --- | --- | --- | --- |
| Plan | `--permission-mode plan` | `--sandbox read-only` | `--allow-all-tools --deny-tool write --deny-tool shell` |
| Auto | `--permission-mode acceptEdits` | `--full-auto` | `--allow-all-tools` |
| Bypass | `--dangerously-skip-permissions` | `--dangerously-bypass-approvals-and-sandbox` | `--allow-all` |

This mapping is version-sensitive. Verify every flag against the CLI version the
project runs before you rely on it.

A blocked tool is not an error. The CLI refuses the tool, returns the refusal to
the model, and the run ends normally. Read the refusal, show which tool was
refused, and offer the exact setting that would allow it.

For profiles, model tiers, and the config files that set a default, see
[tooling/agent-permissions.md](../tooling/agent-permissions.md).

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
