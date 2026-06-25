# Architecture Decision

Help choose and justify the architecture for a **new project** from the client's
needs — research-first, technology-neutral, and with no unlabeled guesses. Backed
by the [`architecture-advisor`](../../skills/architecture-advisor/SKILL.md) skill
and the [`templates/architecture/`](../../templates/architecture/README.md)
scaffolds.

## Invoke it

Any of these — use whatever your provider supports:

- **In a project:** ask "help me choose the best architecture for …" and paste
  the brief (and any diagrams). The skill auto-triggers.
- **Claude:** the skill (`/architecture-advisor`) or the
  `architecture-advisor` subagent persona.
- **Copilot:** the `choose-architecture` prompt file or the `Architecture
  Advisor` custom agent.
- **System-wide:** sync the skill to your global agent config with `skillshare`,
  then trigger it from any project.
- **Scaffold the deliverable:** `agent-compass new arch <name>` →
  `docs/architecture/decisions/<name>.md`.

## How it works

1. **Intake** — capture functional scope, NFRs, constraints, and the client's
   current IS into `architecture-intake.md`. Read provided images/diagrams.
2. **Clarify** — ask focused questions for *blocking* unknowns only.
3. **Research** — web search, context7 (live docs), `gh search`, host MCP, and
   the repo's `stacks/`/`knowledge/` as inputs. Cite and date sources.
4. **Decide** — derive weighted ASRs, generate 2–3 options (≥1 outside the house
   stacks), score them in a matrix, recommend the best fit with trade-offs.
5. **Diagram & document** — mermaid (context, container, sequence, deployment,
   ERD) plus the decision doc with risks, an assumptions register, and open
   questions.
6. **Optional** — a technical backlog (`tech-backlog.md`) and the technical
   meetings to request (`technical-meetings.md`).

## Evidence discipline (no guesses)

Tag every material statement:

- **Known** — stated by the user or a cited source.
- **Assumed** — an *educated* guess; labeled, with a basis and a confirmation
  path. Allowed for non-blocking points; recorded in the assumptions register.
- **Unknown** — an open question. Blocking unknowns get a question, not a guess.

Never present Assumed/Unknown as Known. Research current-tech facts before
asserting them; your training has a cutoff.

## Technology neutrality

Requirements drive technology. The repo's stacks are one input, not the default.
If Flutter, Go, serverless, a modular monolith, or an event-driven design fits
the client better, propose it and justify it against the requirements.

## Output

Lead with the recommendation and a one-line justification, then options + matrix,
diagrams, risks/caveats, assumptions register, and open questions — ending with
the single most useful next action (often the meetings to request or the first
spike to run).
