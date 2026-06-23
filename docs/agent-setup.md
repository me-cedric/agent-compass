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

These encode the same judgment your global config applies, but travel with the repo.

## Hooks vs. memory (important)

Automatic behaviors ("always run X after Y") must be **hooks** (husky locally, CI
in the pipeline) — an agent's memory or preferences can't guarantee they run for
everyone. Encode enforcement as hooks/CI; use guidelines for judgment.

## Replicating your global setup on a new machine

1. Install the [prerequisites](tooling/prerequisites.md).
2. Clone agent-compass; run `node scripts/bootstrap.mjs` for new projects, or
   `node scripts/install.mjs` inside an existing one.
3. `skillshare` the `skills/` folder into your AI CLIs.
4. Point each tool's rules file at the project `AGENTS.md`.

Keep this repo as the single source; when your global config improves, fold the
generic part back in via [knowledge-capture](workflows/knowledge-capture.md).
