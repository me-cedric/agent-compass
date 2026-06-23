# New Project

Goal: from nothing to a running, standards-compliant project — and the same
answers produce the same project for any teammate.

## 1. Generate the bootstrap prompt

```bash
node scripts/bootstrap.mjs
```

Answer the questions (name, stack(s), package manager, DB/ORM, auth, queues,
testing, CI, API tooling, …). It writes:

- **`BOOTSTRAP_PROMPT.md`** — the precise build prompt.
- **`agent-compass.answers.json`** — your answers, replayable.

## 2. Create project specs first

Before scaffolding code, create `specs/000-project/` from
[`templates/specs/`](../../templates/specs/). Keep `spec.md` focused on what and
why, then put stack choices and validation in `plan.md`. See
[spec-driven-development](spec-driven-development.md).

## 3. Hand the prompt to an agent

Paste `BOOTSTRAP_PROMPT.md` into Claude Code / Codex / Copilot. The prompt tells
the agent to:

1. Create `specs/000-project/spec.md`, clarify it, then create `plan.md`,
   `tasks.md`, and `checklist.md`.
2. Scaffold the monorepo from [`templates/monorepo/`](../../templates/monorepo/)
   (turbo, pnpm, tsconfig, prettier, commitlint, husky, OSV).
3. Pin versions ([version-pinning](../tooling/version-pinning.md)).
4. Create the chosen apps from their [stack presets](../../stacks/).
5. Apply the architecture principles selected ([resilience](../architecture/resilience.md),
   [observability](../architecture/observability.md),
   [feature-flags](../architecture/feature-flags.md), …).
6. Set up testing (TDD, coverage, e2e), Docker, CI, and security scanning.
7. Write the root README (setup/run instructions) and a README per module.

## 4. Plan-gate

The prompt instructs the agent to **stop after the plan** for your review before
writing code. Approve or adjust, then let it implement with TDD.

## 5. Verify the result

```bash
pnpm install
pnpm check          # test + lint + typecheck across the workspace
pnpm dev:infra      # local dependencies, if applicable
pnpm dev            # run it
```

A green `check`, a runnable app, and a README that a newcomer can follow = done.

## 6. Wire agent-compass in for the long run

Add this repo as a submodule so the project keeps the standards as they evolve:

```bash
git submodule add <agent-compass-url> docs/agent-compass
node docs/agent-compass/scripts/install.mjs
```
