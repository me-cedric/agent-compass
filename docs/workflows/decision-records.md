# Decision Records (ADR)

Record the structuring decisions — the ones that are costly to reverse and whose
*reasoning* must outlive the people who made them — as Architecture Decision
Records under `docs/decisions/NNN-title.md`.

An ADR answers, for a future reader who was not in the room: what forced the
decision, what else was considered, why this option won and **not** the
alternatives, and what it now costs or constrains.

## When to write one

Write an ADR for a decision that is **structuring and hard to reverse**:
architecture, a shared or public contract, a data-ownership or module boundary, a
build-vs-buy, a cross-cutting convention, a framework or runtime choice.

Do **not** write one for reversible, local choices — those belong in the code and
the module's `DESIGN.md`. When unsure, ask: would re-deciding this later be
expensive or contentious? If yes, record it.

Two entry points:

- **New project, upfront architecture:** the
  [architecture-decision](architecture-decision.md) workflow and the
  [`architecture-advisor`](../../skills/architecture-advisor/SKILL.md) skill —
  research-first, produces the first ADR(s).
- **Ongoing decisions as the project runs:** capture them as they happen. If the
  decision was made in a meeting, hand the transcript to the
  [`adr-from-meeting`](../../skills/adr-from-meeting/SKILL.md) skill.

## The shape

Fill [`docs/decisions/000-template.md`](../../docs/decisions/000-template.md):
context and problem → decision drivers → considered options (each with pros and
cons) → decision (chosen, and why the others were rejected) → consequences →
links.

Numbering is sequential (`001`, `002`, …); one decision per file; kebab-case
title. Status moves `proposed → accepted`, and a reversal is a **new** ADR that
marks the old one `superseded by NNN` — history is append-only, never rewritten.

## How it interconnects

ADRs are independent from a per-module `README.md` / `DESIGN.md`, but they wire
together:

- **Module `DESIGN.md` / `README.md` → ADR:** cite the ADR as the *why* behind a
  structural choice instead of re-explaining it inline.
- **ADR → everything:** link the spec or issue, the PR, and the affected module
  docs from the ADR's Links.
- **Knowledge and memory:** a decision that generalizes becomes a
  [`knowledge`](../../knowledge/README.md) instinct; a durable running note can
  also land as a `projectmem` decision. The ADR stays the canonical record.

Keep them close to the code (`docs/decisions/` in the repo), in version control,
reviewed in the same PR as the change they justify.
