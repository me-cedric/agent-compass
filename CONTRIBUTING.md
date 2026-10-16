# Contributing to agent-compass

Humans and agents edit this repository often. Projects import it as a submodule on a release tag, so a change must not break them.
Read [AGENTS.md](AGENTS.md) first. It holds the work rules, the style contract and the checks.

## Where things go

| You want to add | Put it in | Then |
|---|---|---|
| A skill | `skills/<name>/SKILL.md` | Add it to [skills/README.md](skills/README.md), which holds the skill rules. |
| A skill for one pack | `packs/<pack>/skills/<name>/SKILL.md` | Detect or opt in the pack. |
| A stack rule | `rules/stack-<name>.md` with `description`, `paths` and `stacks` | Add a new stack id to `STACK_IDS` in `engine/detect.mjs`. |
| A role agent | `core/agents/<name>.md` | Pin the model for each provider in its frontmatter. |
| A pack | `packs/<name>/` with `skills/`, `seed/`, `files/` or `extras/` | Add its detection to `detectPacks` in `engine/detect.mjs`, or leave it opt-in. |
| An MCP server | `mcp/catalog.json` | Write secrets as `${VAR}`. Pin a version. Give a read-only guard. |
| An upstream skill source | `upstream.json` | Pin a 40-character `sha`. The source must have a licence file at its root. |
| A guide | `docs/guide/<topic>.md` | Add a row to [docs/README.md](docs/README.md). |
| A decision | `docs/decisions/NNNN-slug.md` | Start from `adr-template.md`. |
| A skill that a project wrote | `ac promote <skill>` in that project | Review the copy and commit it here. |

To refresh an upstream pin, change `sha` (and `ref`) and the `skills` list of the source in `upstream.json`. Then run `npm run check`.
The `compass` skill has the steps to add a skill, a rule or a pack (section "extend").

## Rules that keep projects safe

1. Keep one source for each fact. Link to it. Do not copy it. `AGENTS.md` is the contract for work on this repository.
   `core/blocks/AGENTS.md` is the contract that sync installs in a project.
2. Prefer an addition. An addition must not change the meaning of an existing asset. A change that a project can notice goes in `CHANGELOG.md`.
   Projects update on purpose, with `ac sync --to <tag>`.
3. Write each skill so that it works in any project. Use path placeholders such as `{{DELIVERY_DIR}}`, never one project's paths.
4. Stay lean. Add the smallest useful thing. Add no runtime dependency.
5. Never write a secret. Use `${VAR}`.
6. Use generic names. No real project, client, company or person name may appear. Use `acme`, `globex` or `<project>`.
   Real technology names are fine. `npm run lint:naming` enforces this. Add each new forbidden name to `DENY` in `scripts/check-naming.mjs`.
7. Write docs and skills in Simplified Technical English. Every relative link must resolve. `npm run lint:docs` checks the links.
8. A change to a script needs a change to its test.

## Check your change

- `npm test` runs the unit and fixture tests.
- `npm run check` runs the tests and the lints: GitHub Action versions, naming, docs links, release versions and the length budgets (`scripts/check-budget.mjs`: 150 lines for AGENTS.md and README.md, 120 lines for the compass block). The repository has no file or code-line budget.
- Run `node --check scripts/<file>.mjs` on a script that you edit.
- Do not commit, push or tag unless the owner asks.
