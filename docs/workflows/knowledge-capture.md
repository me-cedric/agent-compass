# Knowledge Capture

How agent-compass improves itself: pull proven patterns out of real projects and
promote the generic ones into the shared baseline.

## 1. Pull from a project

```bash
node scripts/pull-knowledge.mjs ../some-project
```

It stages copies under `knowledge/incoming/<project>/`, with an `INDEX.md`
listing what it found and how each compares to what is already here. **It never
auto-merges.**

It looks for these categories, each with a cap so one large project cannot flood
staging:

| Category | Where it looks |
| --- | --- |
| `agent-config` | `AGENTS.md`, `AGENT.md`, `CLAUDE.md`, `CODEX.md`, `GEMINI.md`, `.github/copilot-instructions.md` |
| `style-contract` | any `STYLE-CONTRACT.md` |
| `skill` + `skill-payload` | any `skills/<name>/SKILL.md`, plus that folder's `LICENSE`, `DESIGN.md`, `references/`, `scripts/`, `examples/`, `assets/` |
| `agent-role` | `.claude/agents/`, `.claude/commands/`, `.github/agents/`, `.github/prompts/`, `.github/instructions/` |
| `instinct` | `.claude/instincts/*.md` |
| `doc` | `docs/*.md` (depth 1, under 64 KB) |
| `module-doc` | any `README.md`, `DESIGN.md`, `RESOURCES.md` below the root |
| `ci` | `.gitlab-ci.yml`, `.gitlab/ci/*.yml`, `.github/workflows/*` |
| `devcontainer` | `.devcontainer/**/devcontainer.json` and sibling shell scripts |
| `config` | turbo, pnpm, tsconfig, eslint, commitlint, prettier, osv-scanner, sonar, rust-toolchain, gitattributes, Dockerfile |
| `hook` | `.husky/*` |

Two exclusions keep the output honest:

- **Build output and worktrees** never stage. A git worktree duplicates the whole
  repository at a stale commit, and a build tree can hold tens of thousands of
  copied files.
- **A vendored corpus never stages.** A `skills/` tree whose parent carries a
  generated `manifest.json` naming an upstream repository belongs to that
  upstream. Without this rule, a project that vendors agent-compass re-imports
  the base into itself. A generated tree the project owns has no such manifest,
  so it stays in scope. See
  [`vendored-corpus-manifest`](../../knowledge/instincts/vendored-corpus-manifest.md).

A skill is one asset, not one file, so the folder travels together. Staging
`SKILL.md` alone drops the licence and the runnable payload.

The pull step refuses likely secrets, personal data, and known project/domain
tokens before staging. Redact at the source, then rerun. Use `--allow-sensitive`
only for manual quarantine, never for direct promotion.

## 2. Review

Open `knowledge/incoming/<project>/INDEX.md`. For each item decide: promote,
adapt, or drop. Ask: *is this generic, or project-specific?* Only generic,
reusable things belong in the baseline.

## 3. Promote

Move the keepers into their home and **rewrite away project-specific names**
(your old scope → `@scope`, real module/provider names → generic placeholders):

| Item                          | Promote to                          |
| ----------------------------- | ----------------------------------- |
| A reusable pattern/instinct   | `knowledge/` or a new `skills/<skill>/SKILL.md` |
| A rule/convention             | `docs/guidelines/` (or extend one)  |
| A generic principle           | `docs/architecture/`                |
| A tool setup                  | `docs/tooling/` + `templates/`      |
| A config worth templating     | `templates/`                        |

Update the relevant index/table (see [CONTRIBUTING](../../CONTRIBUTING.md)) and
`CHANGELOG.md`. Delete the rest of `incoming/` (it's gitignored anyway).

## 4. Capturing in the moment

When an agent gets a correction worth keeping, write the **general rule** (not the
one-off fix) — to the project's `tasks/lessons.md` or straight here via a small
PR. The goal is that the next project doesn't repeat the mistake.
