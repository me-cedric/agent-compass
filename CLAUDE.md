# Claude — agent-compass

## Priority

- Read **[AGENTS.md](AGENTS.md)** first; it is the canonical contract.
- This file adds only Claude-specific behavior.
- In a host project, the host's own `CLAUDE.md` / `AGENTS.md` win on conflict.

## Claude-specific notes

- **Concise mode.** Use the `caveman` skill (`skills/caveman/`) for terse,
  high-signal interactions; pair with `ponytail` (`skills/ponytail/`) to keep
  solutions minimal. Preserve reasoning, risks, and verification.
- **Skills.** The folders under `skills/` are usable directly. To wire them into
  your global Claude config, sync with `skillshare` (see `skills/README.md`).
  Quality-gate skills: `gen-docs`, `verify-module`, `verify-quality`,
  `verify-change`, `verify-security`. Use `agent-teacher` for explanation and
  prompt/tool coaching requests, and `architecture-advisor` for new-project
  architecture / technology-selection decisions (research-first, tech-neutral,
  no unlabeled guesses).
- **Provider leverage.** Use Claude skills for repeated playbooks, hooks for
  must-run checks, subagents/agent teams for parallel work, and MCP for external
  tools. See `docs/tooling/agent-provider-capabilities.md`.
- **Plan mode.** For non-trivial work, plan before editing (matches the workflow
  in `AGENTS.md §1`). Present the plan, then implement on approval.
- **Repo understanding.** Prefer the project's code-intelligence MCP (if any)
  over broad grep before structural edits. Fall back to targeted reads.
- **MCP & tools.** `rtk` for noisy shell output; context7 for live library docs;
  use the host project's MCP servers when relevant.

## Safety

Do not commit, push, deploy, publish, or open PRs unless explicitly asked —
see `AGENTS.md §10`.
