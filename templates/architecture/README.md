# Architecture Decision Templates

Fill-in scaffolds for the [`architecture-advisor`](../../skills/architecture-advisor/SKILL.md)
skill and the [architecture-decision workflow](../../docs/workflows/architecture-decision.md).
Requirements drive the choice — these are technology-neutral.

| File | Purpose |
| ---- | ------- |
| [`architecture-intake.md`](architecture-intake.md) | Capture needs, NFRs, constraints, and the client's current IS. |
| [`architecture-decision.md`](architecture-decision.md) | The deliverable: options, weighted matrix, recommendation, diagrams, risks, assumptions, open questions. |
| [`decision-matrix.md`](decision-matrix.md) | Weighted scoring of candidate architectures. |
| [`diagrams.md`](diagrams.md) | Mermaid starters: context, container, sequence, deployment, ERD. |
| [`tech-backlog.md`](tech-backlog.md) | Epics → stories → spikes derived from the decision. |
| [`technical-meetings.md`](technical-meetings.md) | Workshops to request, each with objective, attendees, and questions. |

Scaffold one into a project:

```bash
agent-compass new arch <name>     # → docs/architecture/decisions/<name>.md
```

Every entry is tagged **Known** (sourced), **Assumed** (educated guess + how to
confirm), or **Unknown** (open question). No unlabeled guesses.
