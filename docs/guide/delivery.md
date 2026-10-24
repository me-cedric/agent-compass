# Delivery

Delivery documents follow the Konvoy docs layout. Compass and Konvoy share it. The [ownership contract](../contract/ownership.md) says who writes what.
One skill drives each step. This guide names the skill and keeps the rules that the skills do not hold.

## Docs layout

The paths below are the defaults. Skills write them as placeholders such as `{{DELIVERY_DIR}}`. The Konvoy ledger or `paths` in `.agents/compass.json` can change them.

| Path | Content |
|---|---|
| `docs/openspec/` | OpenSpec root: `constitution.md`, `changes/<id>/`, `specs/`, `inbox/`, `schemas/konvoy-delivery/`. |
| `docs/delivery/questions/` | One RAID file for each open question, risk, assumption, issue or dependency: `Q-NNN.md`. |
| `docs/delivery/tickets.json` | The tickets. Konvoy writes it. Agents read it and never edit it. |
| `docs/decisions/` | ADRs: `NNNN-kebab-title.md`. |
| `docs/designs/screens.json` | The screens registry. |
| `docs/planning/`, `docs/costing/`, `docs/api/`, `docs/data-models/` | Planning, costing, OpenAPI and data models. |

`ac check` also checks this layout: RAID files, ADR names and frontmatter, the screens registry, `Screen:` tags and `openspec validate`.
It also checks the active OpenSpec changes. A change with no open task and some `[~]` partials, and a change with every task ticked and not archived, are warnings. A MODIFIED requirement that is in no main spec is an error, and a main-spec scenario that a MODIFIED delta omits is a warning: the archive replaces the whole block and drops it.
`ac check --docs` runs only these checks and does not need `.agents/compass.json`. An error exits 1. A warning does not.
The rules are in the [ownership contract](../contract/ownership.md#docs-layout-checks).

## Start from documents

A project that starts from a brief, a tender or meeting notes runs:

1. `ac init --from-specs <dir>`. It creates the layout and copies the documents into `docs/openspec/inbox/<dir name>/`.
2. Convert each document that is not Markdown. The `spec-flow` skill has the steps.
3. Run `grill` on the inbox. It writes one RAID file for each open question.
4. Write `constitution.md`: the governing rules. Ask for them. Do not invent them.
5. Write one change for each feature. Keep the inbox files. They are the source of each requirement.

A project with spec-kit, a root `specs/` folder or single-file question registers runs `ac migrate --docs --dry`, then `ac migrate --docs`.
Do each `manual` item with the user. `spec-flow` then appends the delta sections.

## Spec flow

OpenSpec with the `konvoy-delivery` schema is the one spec dialect. The `spec-flow` skill drives it.

1. Choose the size. A tiny edit needs an inline brief: goal, non-goal, acceptance, validation. A bug needs a short spec or a link to the existing one.
   A feature needs a change with a proposal and, for each capability, `spec.md`, `plan.md`, `checklist.md` and `tasks.md`.
2. Search the existing specs first. Update or link a spec. Never create a second truth.
3. Write the proposal (what and why, no stack). Clarify until no high-impact `[NEEDS CLARIFICATION]` remains.
4. Write the plan and the tasks. Tasks come in order, tests first. Mark a task `[P]` when it can run in parallel.
5. Implement only when the spec, plan and tasks are stable. Then compare code, tests, docs and specs. Update the artifact that is stale.
6. Validate, then archive.

```bash
openspec status --change <id> --json      # which artifact is ready or blocked
openspec validate --all --strict --json   # is each present file well formed
openspec archive <id>                     # only when the user asks
```

- `validate` checks the files that exist. `status` checks that the files that should exist do. A change with only a proposal validates clean. Read `status` first.
- The OpenSpec CLI reads the nearest folder named `openspec` above its working directory. A second root captures the lookup. Keep one root.
- A Konvoy spec keeps its spec-kit headings. Each `spec.md` also gets a `## ADDED Requirements` delta section, one `### Requirement:` for each requirement id.
  The `spec-flow` skill has the rules.
- A spec that changes after tickets exist needs a drift note. See `spec-flow`, section "Drift triage".

## Questions and decisions

- Open questions live in RAID files. The `grill` skill interviews the user, one question at a time, and writes the files.
  It never overwrites or deletes a file. A closed question gets `status: folded`.
- Record an answer in this order: write it into the ADR, cascade it into the affected rules, then close the question. Closing first loses the decision.
- Write an ADR for a decision that is structural and costly to undo: architecture, a shared contract, data ownership, build or buy, a cross-cutting convention.
  A local choice stays in the code. The `adr` skill writes MADR 4 files from a transcript, notes or chat.
- A new ADR supersedes an old one. Never rewrite an accepted ADR. Change only its status.
- For the architecture of a new project, use `architecture-advisor`. It works from requirements, researches current facts and labels each statement
  as known, assumed or unknown. It scores at least one option from outside your usual stacks. It leads with the recommendation.

## Screens

`docs/designs/screens.json` links a screen to its route, Figma node and stories. Tag each requirement of a screen with `Screen: SCR-014` or an alias.
`ac check` fails on a tag that is not in the registry. `ui-conformance` reads the registry. The JSON shape is in the [ownership contract](../contract/ownership.md#screens-registry).

## Tickets and reports

| Skill | Use |
|---|---|
| `task-flow` | Move a ticket through its lifecycle in Jira, GitLab or GitHub. Draft ticket text from specs. A tracker write needs the user's yes. |
| `remaining-work` | Audit the code against the specs. Write the backlog of what is left. |
| `impact-analysis` | The developer note: what a change breaks and which documents are stale. |
| `delivery-digest` | The Product Owner digest of the same change, in plain language. |

## New project

1. Choose the architecture with `architecture-advisor`. Record it as an ADR.
2. Start from documents (above). Stop after the plan and get approval before you write code.
3. Pin the toolchain ([quality.md](quality.md#version-pinning)). Scaffold the apps. Write tests first.
4. Add the packs that the project needs: CI, security, env, local run, e2e. See [assets.md](assets.md#packs).
5. Write the root README so that a newcomer can set up and run the project, locally and against another environment.

The project is done when `check` is green, the app runs and the README works for a newcomer.

## New module

1. Spec the behavior. A small task needs an inline brief.
2. Write the test first, then the code. Wrap external clients in the resilience policies of [architecture.md](architecture.md#resilience).
3. Write the module README. Update the spec, the env files and, for an API change, every contract layer (`api-contract-sync`).
4. Validate with the narrowest commands that cover the change. If you changed a shared package, validate each consumer.
5. Report with the completion gate ([agents.md](agents.md#completion-gate)).

## Pull request and review flow

1. Check the state: `git status --short`, the branch, `git fetch origin`. Check `gh auth status` or `glab auth status`.
2. List the labels (`gh label list`, `glab label list`). Use only labels that exist. Ask for a reviewer when none is given.
3. Write the body by the [rules](engineering-rules.md#pull-requests). Use the base branch that the repository declares.
4. Create the request.
   ```bash
   gh pr create --base <base> --assignee @me --reviewer <login> --label <label> --title "<title>" --body-file <file>
   glab mr create --target-branch <base> --title "<title>" --description-file <file> --label "<l1>,<l2>" --assignee "<me>" --yes
   ```
5. Set labels and the assignee on creation and on every update. On a GitLab update, write `--assignee "+<me>"`.
   A bare value replaces the whole assignee list. `--label` on update only adds. Removing a label needs `--unlabel` and an instruction.
6. Derive labels from the facts: one type label from the commit type, and each area label that matches a changed path.
   Never add a judgement label (severity, bug, confirmed, design, discussion, suggestion, support) by yourself.
7. Update the title and the description on every push that changes what the branch delivers. They are documentation.
8. Report the URL, base, reviewers, labels, validation and risks.
9. When the request delivers less than the ticket asks, add `### Delivered scope: <label>` with the delivered slice and each respected rule by its id, and the `### Deliberately absent` table with the blocking decision of each missing piece.

Review a change with the `review` skill. It checks two axes, spec and standards, in a fresh context with the `reviewer` agent, and does at most 2 fix rounds.

- A local review reads `gh pr view <n> --json title,body,baseRefName,headRefName,author,labels,reviewRequests,url` and `gh pr diff <n>`. It posts nothing.
- A GitHub review posts with `gh pr review <n> --comment`, `--approve` or `--request-changes`, with `--body-file <file>`. Approve only when the evidence is enough and no blocking issue remains.
  Authorship, a green pipeline and an earlier review give no right to approve.
- To implement posted review fixes, read each thread. Check each request against the current code. Fix the valid ones. Explain each skip.
  Push only when the user asks.
