# Contributing to agent-compass

This repo is meant to be edited often — by humans and by agents — without
breaking the projects that import it. Modularity is the safety mechanism: each
piece lives in exactly one place and is referenced, not duplicated.

## Where things go

| You want to add…                         | Put it in…                          | Then…                                                   |
| ---------------------------------------- | ----------------------------------- | ------------------------------------------------------- |
| An enforced rule / convention            | `docs/guidelines/<topic>.md`        | Link it from `AGENTS.md` and `docs/guidelines/README.md`. |
| A generic engineering principle          | `docs/architecture/<topic>.md`      | Link from `docs/architecture/README.md`.                |
| A tool setup guide                       | `docs/tooling/<tool>.md`            | Link from `docs/tooling/README.md`.                     |
| A reusable agent skill                   | `skills/<skill>/SKILL.md`           | Add a row to `skills/README.md`.                        |
| A copy-paste config                      | `templates/<group>/…`               | Note it in the relevant `docs/tooling/` guide.          |
| A stack preset                           | `stacks/<stack>.md`                 | Register it in `stacks/README.md` **and** `scripts/bootstrap.mjs`. |
| A captured pattern from a real project   | `knowledge/…`                       | Use `scripts/pull-knowledge.mjs`; promote after review. |
| An operational playbook                  | `docs/workflows/<flow>.md`          | Link from `README.md` / `docs/workflows/README.md`.     |

## Rules that keep consumers safe

1. **One source of truth.** Don't copy a rule into two files — link to the
   canonical one. `AGENTS.md` is the contract; everything under `docs/` is depth.
2. **Additive by default.** Adding a guideline/skill/template/stack must not
   change the meaning of an existing one. If you must change behavior, bump
   `CHANGELOG.md` and call it out — consumers pin via submodule SHA and update
   deliberately.
3. **Keep `AGENTS.md` tool-agnostic.** Tool-specific notes belong in `CLAUDE.md`,
   `CODEX.md`, or `.github/copilot-instructions.md`.
4. **Templates are real and runnable.** A file in `templates/` should drop into a
   project and work (after the documented placeholder substitutions). Mark
   placeholders clearly: `<project>`, `@scope`, `<PM>`.
5. **Skills are portable.** A `SKILL.md` must not hardcode one project's paths in
   its triggers. Project-specific examples are fine inside the body, labeled.
6. **Stay lazy.** Smallest useful addition. No speculative structure. If a doc
   would just restate `AGENTS.md`, link instead.
7. **No secrets, ever.** Templates ship `.example` env files only.
8. **Generic naming (enforced).** No real project, client, company, or provider
   names anywhere in the repo. Use placeholders (`<project>`, `@scope`, `<app>`,
   `<provider>`) and neutral example names (`acme`, `globex`, `paygate`,
   `resource`). Real technology names (Keycloak, Postgres, Docker, Turbo, …) are
   fine. `scripts/check-naming.mjs` enforces this in CI — run `pnpm lint:naming`
   locally, and add any new forbidden token to its `DENY` list when you mine a
   new project.

## Editing as an agent

- Read `AGENTS.md` and this file before changing anything here.
- Make the smallest coherent change; update the index/link that points to what
  you touched (tables above).
- If you add a stack, you **must** also extend `scripts/bootstrap.mjs` so the new
  preset is offered and reflected in the generated prompt.
- Validate scripts with `node --check scripts/<file>.mjs`.
- Update `CHANGELOG.md` for anything a consumer would notice.

## Promoting pulled knowledge

`scripts/pull-knowledge.mjs <path>` stages another project's instincts, configs,
and module READMEs under `knowledge/incoming/<project>/`. Review them, then move
the generic, reusable bits into `knowledge/`, `docs/`, `skills/`, or `templates/`
— rewriting away project-specific names. Delete the rest. Never auto-merge.
