# agent-compass

A central, importable repository of **agentic standards, guidelines, skills and
bootstrap tooling** for AI coding agents — Claude Code, Codex, GitHub Copilot,
Cursor, and friends. Add it to any project as a git submodule (or clone it
standalone) to give every agent the same conventions, the same quality gates,
and a one-command path to bootstrap a new project that comes out consistent
every time.

It answers three needs:

1. **Teach** agents how to work — one contract, enforced the same way across tools.
2. **Bootstrap** new projects from proven stack presets, by answering a few questions.
3. **Grow** — pull knowledge out of real projects back into this repo so the
   baseline keeps improving.

---

## What's inside

```
agent-compass/
├── AGENTS.md              ← the tool-agnostic agent contract (read this first)
├── CLAUDE.md CODEX.md     ← thin per-tool pointers to AGENTS.md
├── .github/copilot-instructions.md
├── docs/
│   ├── guidelines/        ← enforced rules: coding-style, typescript, testing-tdd,
│   │                        security, git-workflow, development-workflow,
│   │                        documentation, agent-behavior, performance
│   ├── architecture/      ← generic principles: monorepo, resilience, observability,
│   │                        feature-flags, api-design, shared-types
│   ├── tooling/           ← rtk, pnpm, turbo, sonarqube, docker, husky,
│   │                        env-management, api-contract-sync, security-scanning,
│   │                        version-pinning
│   └── workflows/         ← playbooks: new-project, new-module, review-and-ship,
│                            knowledge-capture
├── skills/                ← portable agent skills (caveman, ponytail, gen-docs,
│                            verify-*, NestJS/Drizzle/BullMQ/React/Expo patterns)
├── stacks/                ← opinionated presets the bootstrap offers
├── templates/             ← real, copy-paste config (turbo, pnpm, tsconfig, prettier,
│                            commitlint, husky, eslint, docker, sonar, OSV, CI, env)
├── knowledge/             ← extracted instincts + example module READMEs; the
│                            growing knowledge base (and staging for pulled knowledge)
└── scripts/               ← bootstrap.mjs · pull-knowledge.mjs · install.mjs
```

Start with **[AGENTS.md](AGENTS.md)**. Everything else is depth behind it.

---

## Quick start

### A. Add it to an existing project (submodule)

```bash
# from your project root
git submodule add git@github.com:<owner>/agent-compass.git docs/agent-compass
node docs/agent-compass/scripts/install.mjs        # wires guidelines + hooks into the host
```

`install.mjs` copies/links a root `AGENTS.md` pointer, the husky hooks, and the
config templates you select, then prints the next steps. Re-run it after you
`git submodule update --remote` to pick up new standards.

### B. Bootstrap a brand-new project

```bash
git clone git@github.com:<owner>/agent-compass.git
cd agent-compass
node scripts/bootstrap.mjs
```

The script asks a handful of questions (project name, stack(s), package manager,
database/ORM, auth, queues, testing, CI, …) and writes:

- **`BOOTSTRAP_PROMPT.md`** — a precise, copy-paste prompt that tells an agent
  exactly what to build, in what order, enforcing TDD, per-module docs, lint /
  typecheck / test gates, and the chosen stack presets.
- **`agent-compass.answers.json`** — your answers, so re-runs and `install.mjs`
  stay consistent.

Paste `BOOTSTRAP_PROMPT.md` into Claude Code / Codex / Copilot, and you get a
project that matches the guidelines — and matches what a teammate would get from
the same answers.

### C. Just browse it

It's all Markdown. Read `docs/`, copy from `templates/`, lift a `skills/` file.

---

## How each agent picks it up

| Tool    | Entry file                                   | Notes                                                        |
| ------- | -------------------------------------------- | ----------------------------------------------------------- |
| Claude  | `CLAUDE.md` → `AGENTS.md`                     | Skills in `skills/` are usable directly or via skillshare.  |
| Codex   | `CODEX.md` → `AGENTS.md`                      | Context-layering + repo-understanding notes.                |
| Copilot | `.github/copilot-instructions.md` → `AGENTS.md` | Per-path rules under `templates/agent/.github/instructions/`. |
| Others  | point the tool's rules file at `AGENTS.md`   | One contract, many front doors.                             |

---

## Prompt examples

Copy, adapt, paste. These assume agent-compass is at `docs/agent-compass/` (or
that you're chatting from inside the repo).

**Bootstrap a new service**

> Read `docs/agent-compass/AGENTS.md` and `docs/agent-compass/stacks/nestjs-api.md`.
> Scaffold a NestJS + Drizzle + BullMQ API in a pnpm/turbo monorepo following the
> templates in `docs/agent-compass/templates/`. Use TDD. Create a module `billing`
> with a README per the documentation guideline. Stop after the plan for my review.

**Add a feature, enforced**

> Following `docs/agent-compass/AGENTS.md`, add a `POST /invoices` endpoint.
> Write the test first. Keep OpenAPI/Scalar, Bruno, and Gherkin in sync per
> `docs/agent-compass/docs/tooling/api-contract-sync.md`. Report against the
> Completion Gate.

**Harden an existing module**

> Use the `verify-module`, `verify-quality`, and `verify-security` skills in
> `docs/agent-compass/skills/` on `src/modules/payments/`. Only fix Critical/High
> findings. Update the module README.

**Apply resilience patterns**

> Per `docs/agent-compass/docs/architecture/resilience.md` and the
> `resilience-observability-patterns` skill, wrap the external CTS client in a
> circuit breaker + retry created once in `onModuleInit`. Add a focused test.

**Capture knowledge back**

> Run `node docs/agent-compass/scripts/pull-knowledge.mjs ../other-project`.
> Review what landed in `knowledge/incoming/`, and promote the generic instincts
> into `knowledge/` and `docs/` with a short PR.

More live in [`docs/workflows/`](docs/workflows/).

---

## What it enforces (the short list)

- **The workflow:** gather → clarify → plan → implement → review → validate. No code before a plan.
- **TDD:** test first; ≥ 80% coverage on changed code. → [testing-tdd](docs/guidelines/testing-tdd.md)
- **Quality gate:** lint + typecheck + relevant tests must pass; honest [Completion Gate](AGENTS.md#4-completion-gate) reporting.
- **Per-module docs:** every module has an up-to-date `README.md`. → [documentation](docs/guidelines/documentation.md)
- **API contract sync:** OpenAPI/Scalar + Bruno + Gherkin move together. → [api-contract-sync](docs/tooling/api-contract-sync.md)
- **Conventional commits + branch naming**, husky `pre-commit`/`pre-push`/`commit-msg` hooks.
- **Pinned versions:** `.nvmrc`, `.npmrc`, `packageManager`. → [version-pinning](docs/tooling/version-pinning.md)
- **Security:** OSV scan, Checkmarx packaging, no hardcoded secrets, env discipline. → [security](docs/guidelines/security.md)
- **Safety:** agents never commit/push/deploy/PR unless explicitly asked.

---

## Extending & maintaining it

It's modular on purpose — add a guideline, a skill, a template, or a stack
without touching the rest. Read **[CONTRIBUTING.md](CONTRIBUTING.md)** before you
or an agent edits it; it explains where each kind of thing goes and the rules
that keep changes from breaking consumers. Use
[`docs/workflows/knowledge-capture.md`](docs/workflows/knowledge-capture.md) to
feed lessons from real projects back in.

## Provenance

v0.1 was distilled from a production pnpm/turbo monorepo (NestJS API, React
admin, Expo mobile) and a mature global agent configuration. Stack-specific
skills under `skills/` were extracted from that project and may need light
de-scoping for your context — `pull-knowledge.mjs` helps keep them current.
