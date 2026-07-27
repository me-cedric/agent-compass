# Agent Setup — global config → per project

How a personal/global agent configuration maps into a project so the whole team
gets the same behavior, regardless of which tool each person runs. This is the
bridge between "what I set up on my machine" and "what the repo enforces."

## The layering

```
Global (per machine)                Project (in the repo, shared)
~/.claude/CLAUDE.md          ─┐
~/.claude/rules/*.md          ├─ distilled →   AGENTS.md + docs/guidelines/*
~/.claude/skills/*            ─┘                skills/*  (+ skillshare sync)
~/.claude/agents/*                              (optional) .claude/agents/*
~/.claude/settings.json (hooks)                 .husky/* + CI (enforced for all)
```

Global config makes **you** fast. The repo makes the **team** consistent. Put
anything that should bind everyone in the repo; keep personal ergonomics global.

## What to put in the repo

| Concern                | Goes in the project as…                                    |
| ---------------------- | ---------------------------------------------------------- |
| The agent contract     | `AGENTS.md` (+ `CLAUDE.md`/`CODEX.md`/copilot pointers)    |
| Rules / conventions    | `docs/guidelines/*` (referenced by `AGENTS.md`)            |
| Reusable skills        | `skills/*` — synced into each tool via `skillshare`        |
| Per-path agent rules   | `.github/instructions/*.instructions.md` (templates here) |
| Reusable prompt tasks  | `.github/prompts/*.prompt.md` or provider equivalent       |
| Named agent roles      | `.github/agents/*.agent.md`, `.claude/agents/*`, or provider equivalent |
| Enforced gates         | husky hooks + CI running `lint`/`typecheck`/`test`         |

## Skills across tools

`skills/` holds tool-agnostic `SKILL.md` folders. To make them auto-trigger in
each AI CLI (Claude, Cursor, Windsurf, Copilot, …) from one source, use
[`skillshare`](../skills/README.md): point it at `skills/` and let it symlink/copy
into each tool's skills directory. That's how one definition reaches every agent.

## Recommended working-style skills

- **`caveman`** — concise, high-signal communication (token-efficient).
- **`ponytail`** — laziest-correct solutions (YAGNI, reuse-first, smallest diff).
- **quality gates** — `gen-docs`, `verify-module`, `verify-quality`,
  `verify-change`, `verify-security` at the right moments (see
  [workflows](workflows/new-module.md)).
- **`agent-teacher`** — level-aware explanations and selective prompt/tool
  coaching when the user asks how/why or repeats a costly pattern.
- **`architecture-advisor`** — choose & justify a new project's architecture from
  client needs: research-first, technology-neutral, no unlabeled guesses; emits
  an ADR, mermaid diagrams, risks, open questions, and optionally a backlog and
  meeting list (see [architecture-decision](workflows/architecture-decision.md)).

These encode the same judgment your global config applies, but travel with the repo.

## Hooks vs. memory (important)

Automatic behaviors ("always run X after Y") must be **hooks** (husky locally, CI
in the pipeline) — an agent's memory or preferences can't guarantee they run for
everyone. Encode enforcement as hooks/CI; use guidelines for judgment.

## Provider-native tools

Use provider-native commands only when they reduce risk or repeated work:

- Claude: skills, hooks, subagents/agent teams, plugins, MCP.
- Codex: `/plan`, `/goal`, `/review`, subagents, skills, hooks, MCP.
- Copilot: repository/path instructions, prompt files, custom agents, MCP.

See [agent-provider-capabilities](tooling/agent-provider-capabilities.md).

## Project Setup

```bash
git submodule add git@github.com:<owner>/agent-compass.git docs/agent-compass
node docs/agent-compass/scripts/adopt.mjs . --policy solo-dev
```

`adopt` chains detection, non-interactive setup, fit-based skill sync, the
policy pack, and readiness verification. Granular equivalent:

```bash
node docs/agent-compass/scripts/setup-wizard.mjs . --yes
node docs/agent-compass/scripts/apply-recommendations.mjs . --policy solo-dev
```

Useful policy packs:

- `safe-local-work`: local edits, validation, and reports only; no commit, push,
  PR, deploy, publish, production write, or secret output.
- `solo-dev`: personal project, low ceremony.
- `startup-fast`: product iteration, symlink skills.
- `strict-enterprise`: multi-team/high-control.
- `regulated-api`: API contract/security/traceability heavy.

## Global Setup

1. Install the [prerequisites](tooling/prerequisites.md).
2. Clone agent-compass.
3. Run one of:

```bash
node /path/to/agent-compass/scripts/global-setup.mjs "$HOME" --copy
node /path/to/agent-compass/scripts/global-setup.mjs "$HOME" --symlink
```

Optional Jira MCP setup for Codex and Claude:

```bash
node /path/to/agent-compass/scripts/global-setup.mjs "$HOME" --jira
```

The command prompts for the Jira URL and personal token. Token input is hidden
on an interactive terminal. Pass `--jira-url https://jira.example.com` to skip
only the URL prompt; the token is always prompted. Existing `mcp-atlassian`
entries are preserved.

Global setup creates only missing files:

- `~/.agent-compass/README.md`
- `~/.agent-compass/manifest.json`
- `~/.codex/AGENTS.md`
- `~/.claude/CLAUDE.md`
- skills under `~/.agents/skills`, `~/.codex/skills`, `~/.claude/skills`

With `--jira`, it merges a new `mcp-atlassian` entry into
`~/.codex/config.toml` and `~/.claude.json`, preserving other configuration and
setting both files to owner-only permissions. It never replaces an existing
Jira MCP entry. Project-local `AGENTS.md` remains authoritative.

## Verification

```bash
node docs/agent-compass/scripts/provider-verify.mjs . --write
node docs/agent-compass/scripts/mcp-probe.mjs . --write
node docs/agent-compass/scripts/spec-validation-map.mjs . --write
node docs/agent-compass/scripts/quality-gates.mjs . --write
node docs/agent-compass/scripts/dashboard.mjs . --write
```

Open `.agent/report.html` for the status dashboard.

Keep this repo as the single source; when your global config improves, fold the
generic part back in via [knowledge-capture](workflows/knowledge-capture.md).
