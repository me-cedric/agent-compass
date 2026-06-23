# Knowledge Capture

How agent-compass improves itself: pull proven patterns out of real projects and
promote the generic ones into the shared baseline.

## 1. Pull from a project

```bash
node scripts/pull-knowledge.mjs ../some-project
```

It scans the target for reusable signal — `.claude/instincts/*`, `AGENTS.md`,
config files (turbo/pnpm/tsconfig/eslint/husky/sonar/docker), and module READMEs —
and stages copies under `knowledge/incoming/<project>/`, with an `INDEX.md`
listing what it found and how each compares to what's already here. **It never
auto-merges.**

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
