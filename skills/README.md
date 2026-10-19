# Skills

Each skill is a folder `skills/<name>/SKILL.md`. `ac sync` copies the skills into a project and fills the path placeholders.

| Group | Skills |
|---|---|
| Compass | `compass` (init, update, migrate, extend, promote) |
| Specs | `spec-flow`, `grill`, `adr`, `architecture-advisor` |
| Tickets and delivery | `task-flow`, `remaining-work`, `delivery-digest`, `impact-analysis` |
| Quality | `review`, `ui-conformance`, `api-contract-sync`, `ci-triage`, `debug` |
| Long work and memory | `harness-loop`, `harness-improve`, `project-memory` |
| Routers to pinned sources | `working-style-skills`, `native-mobile-skills`, `design-taste-skills` |

- The user starts nine skills with `disable-model-invocation: true`: `compass`, `grill`, `adr`, `remaining-work`, `delivery-digest`, `impact-analysis`, `harness-loop`, `harness-improve`, `architecture-advisor`.
- A skill with `metadata.stacks` installs only when the project has one of those stacks.
- A model-invoked description has 220 characters or fewer. All model-invoked descriptions together have 3,000 characters or fewer.
- A SKILL.md body has 120 lines or fewer. Put long reference text in `references/`.
- Write repository paths as path placeholders, such as `{{DELIVERY_DIR}}`.
- Stack knowledge lives in `rules/stack-*.md`, not in skills. Pack skills live in `packs/<pack>/skills/`.
