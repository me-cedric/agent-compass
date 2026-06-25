# Technical Meetings to Request — <name>

Each meeting exists to retire specific unknowns from `architecture-decision.md`
§9. Go in with questions, leave with decisions. Skip any meeting whose answers
you already have (Known).

## Template per meeting

- **Objective:** the decision(s) this unblocks.
- **Attendees / roles:** who must be there to decide (not just inform).
- **Inputs needed:** docs/access to bring or request beforehand.
- **Questions to answer:** the specific open questions.
- **Expected outputs:** decisions, owners, follow-ups.

## Common meetings

| Meeting | Objective | Key attendees | Retires |
| ------- | --------- | ------------- | ------- |
| Discovery / scope workshop | Confirm goals, scope, success metrics | Product owner, client SME | functional unknowns |
| NFR / SLA review | Pin scale, latency, availability, RPO/RTO | Ops/SRE lead, business owner | quality-attribute unknowns |
| Security & compliance | Threat model, data classes, regulations | Security/compliance officer | compliance unknowns, one-way doors |
| Identity & access | IdP/SSO, roles, provisioning | IAM owner | auth integration risk |
| Data & integration deep-dive | Systems of record, APIs, events, volumes | Integration/data owners | integration + data-model risk |
| Infrastructure & hosting | Cloud/on-prem, network, residency, budget | Infra/cloud owner, finance | hosting + cost + residency unknowns |
| Build vs buy / vendor | Mandated tools, lock-in tolerance | Architecture board, procurement | vendor constraints |

## Output

For each meeting held, record decisions back into the assumptions register and
open questions of `architecture-decision.md`, and update the backlog spikes.
