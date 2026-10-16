---
name: impact-analysis
description: Analyse what changed since a base git reference and write the developer action plan with technical impacts, blast radius and the project documents that are now stale. Use for the impact of a branch or diff before merge.
risk_level: low
writes_files: true
requires_tools: [git]
disable-model-invocation: true
---

# impact-analysis

Answer one question: given what changed, what else must change?
This is the developer half of the delivery flow. `delivery-digest` is the Product Owner half. Never mix the two in one file.

## Read the change

```bash
git diff --stat <base>...HEAD
git status --short
git diff <base>
```

Ask the user for `<base>` when it is missing. A guessed base makes every number wrong.
Never claim an impact that you did not confirm in the file. A grep hit is a lead, not a finding.

## Seven axes

Walk all seven. Write `None.` for an empty axis. A silent axis reads as "not checked".

1. Behavior: what a user or caller can now do, or can no longer do. A breaking change gets its own line.
2. Contracts: routes, methods, status codes, payloads, DTOs, shared types, events, queue messages. Each consumer of a changed contract is an impact. See `api-contract-sync`.
3. Data: schema, migrations, backfills, indexes, retention. Say if the migration is reversible.
4. Configuration: env vars, flags, secrets, infrastructure values. An added variable lands on every surface: the validation schema, `.env.example` and the deployment config.
5. Security and privacy: authn and authz, ownership checks on by-id paths, input validation, injection surface, sensitive logging, new dependencies.
6. Operations: build, CI, deployment order, rollback path, and a signal for each new failure mode.
7. Delivery documents: the table below.

## Documents to check

For each document write `up to date`, `stale` with the change to make, or `not affected`.

| Document | Location | Stale when |
|---|---|---|
| Specs | `{{OPENSPEC_DIR}}` | Behavior changed or a requirement is now built |
| Decisions | `{{ADR_DIR}}` | A choice was made or reversed and no ADR records it |
| API contracts | `{{OPENAPI_DIR}}` and the request collection | A route, payload, status code or auth rule moved |
| Data models | `{{DATA_MODELS_DIR}}` | A table, column, relation or enum changed |
| Diagrams | `{{DIAGRAMS_DIR}}` | A component or dependency appeared or vanished |
| Network flows | `{{FLOWS_FILE}}` | A new port, protocol, source or destination is needed |
| Designs | `{{DESIGNS_DIR}}` | Tokens, components or UI rules changed |
| Assignments | `{{DELIVERY_DIR}}/assignments.json` | Scope moved between profiles or a gate cleared |
| Module docs | `**/README.md`, `**/DESIGN.md` | A module's public API, files or configuration changed |

## Output

Write `{{DELIVERY_DIR}}/impacts/<YYYY-MM-DD>-<slug>.md`.

```markdown
---
title: <one line>
date: <YYYY-MM-DD>
base: <base reference>
audience: dev
---

# <title>

## Change set
<n> files, +<added> / -<removed>, <n> commits. One line for each group of files.

## Impacts
### Behavior
### Contracts
### Data
### Configuration
### Security and privacy
### Operations

## Documents to update
| Document | State | Action |

## Action plan
- [ ] <item with a file or a command, and an owner profile when assignments name one>

## Risks

## Validation
<each command with its result: passed, failed, partial or not run, with the reason>
```

## Rules

- Order the action plan by dependency, not by severity.
- An item that nobody can act on is a risk, not a task.
- If the diff is truncated, say so and name what you did not read.
- Do not fix anything. This skill writes the plan. A separate task does the work.
- Do not commit.
