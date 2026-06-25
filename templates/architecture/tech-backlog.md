# Technical Backlog — <name>

Derived from the accepted decision. Sequence by risk: the riskiest unconfirmed
assumptions become **time-boxed spikes first**, before committing to build.

## Spikes (resolve unknowns first)

| # | Spike | Question it answers | Time-box | Exit criteria |
| - | ----- | ------------------- | -------- | ------------- |
| 1 | (e.g. validate IdP/SSO integration) | open question / assumption it retires | 1–3 days | a clear yes/no + evidence |

## Epics → stories

| Epic | Story | Acceptance | Depends on |
| ---- | ----- | ---------- | ---------- |
| Foundation | repo, CI, environments, IaC skeleton | builds + deploys to one env | |
| AuthN/AuthZ | wire IdP, roles, sessions | a user can sign in and is authorized | foundation |
| Core domain | (the central capability) | (measurable) | |
| Integrations | (per external system) | round-trip verified against a real/sandbox endpoint | spikes |
| Observability | logs, metrics, traces, alerts | a failure is visible and alertable | foundation |
| Hardening | security review, load test, DR | meets the NFR targets | core |

## Cross-cutting / definition of done

- Tests at the right level; meets the NFR targets from the decision.
- Security: secrets managed, inputs validated, least privilege.
- Docs: module READMEs and an updated architecture decision.

Keep this list traceable: every item should map to a requirement or a risk in
`architecture-decision.md`.
