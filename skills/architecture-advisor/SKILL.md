---
name: architecture-advisor
description: Recommend and justify the architecture of a new project from the needs of the client. Technology-neutral, research first, no unlabeled guess. Use for questions on which stack, framework or architecture to choose.
risk_level: medium
writes_files: true
requires_tools: []
disable-model-invocation: true
---

# architecture-advisor

Requirements drive the technology. The technology never drives the requirements. Do not default to the stacks that compass has rules for.
If Flutter, Go, serverless, a modular monolith or an event-driven design fits better, propose it and say why.

## Principles

1. Label each material statement:
   - Known: the user stated it, or a cited source shows it.
   - Assumed: an educated guess. Give its basis. Confirm it if it changes the decision.
   - Unknown: an open question.
   Never present an Assumed or Unknown statement as Known.
2. Ask before you guess about anything that changes the decision. Ask one question at a time. Do not ask what the material or a sensible default answers.
3. Research current sources before you state a version, a limit, a price or a best practice. Cite the source and its date.
4. Prefer a choice that is easy to reverse. Flag each choice that is hard to reverse: the data model, the core language, the primary datastore, a vendor lock-in.

## Pipeline

Loop back when new facts arrive.

1. Intake. Write down these items:
   - The functional scope.
   - The quality needs: scale, latency, availability, security, compliance, data residency.
   - The constraints: budget, team skills, timeline.
   - The current systems of the client and the data shape.

   Read each image or diagram that the user gives. Mark each entry Known, Assumed or Unknown.
2. Clarify. Ask only about blocking unknowns. For the others, record a labeled guess in the assumptions register.
3. Research. Use web search for current facts. Use the context7 MCP for library docs. Use `gh search repos` and `gh search code` for reference code. Use the MCP servers and docs of the project. Say which source you could not reach.
4. Architecturally significant requirements. Pick the quality attributes that shape the design. Give each a weight.
5. Options. Write 2 or 3 different options, each with a concrete stack. At least one option must be outside the stacks that compass has rules for, unless the requirements rule it out. Say why.
6. Score. Rate each option against the weighted requirements in a matrix. Show the matrix.
7. Recommend. Give the rationale, traced to requirements. Give the main trade-offs, the runner-up and when it would win, and the risks.
8. Diagrams. Write Mermaid diagrams in `{{DIAGRAMS_DIR}}`: C4 context and container, one key sequence, the deployment view, and an ERD when data matters. Add an as-is diagram when the client has a current system.
9. Deliver. Write the decision as an ADR in `{{ADR_DIR}}`. Use the skill `adr`. Put in it the options, the matrix, the risks, the assumptions register and the open questions. Give the open questions to `grill`.
10. On request, write a technical backlog. Use epics, stories and time-boxed spikes, with the riskiest unknowns first. Also list the technical meetings to request. For each meeting give the goal, the attendees, the inputs, the questions and the expected outputs. Write both in `{{PLANNING_DIR}}`.
11. Validate. Each recommendation traces to a requirement. Each assumption has a way to confirm it. Each current-tech claim has a citation. At least one option from outside the compass stacks got a real review. The open questions are listed.

## Output

Start with the recommendation and one line of justification. Then give the options and the matrix, the diagrams, the risks, the assumptions register and the open questions.
End with the one most useful next action. Examples are the first meeting to request or the first spike to run.

## Anti-patterns

- Recommending the stack that you know best, not the stack that the client needs.
- Stating versions, limits or prices from memory.
- Burying assumptions in prose, not in a register.
- Presenting one option as the only option.
- Resolving a blocking unknown with a silent guess.
