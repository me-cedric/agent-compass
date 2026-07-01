---
name: compass-bootstrap
description: >
  Bootstrap a brand-new project from architecture guidelines or a product idea:
  translate guidelines into a bootstrap answers file, generate the build prompt,
  execute it spec-first, and wire agent-compass into the result. Use when the
  user asks to "create", "bootstrap", "start", or "scaffold" a new project.
risk_level: medium
writes_files: true
requires_tools: []
---

# Compass Bootstrap — new project from architecture guidelines

Mission: turn the user's architecture guidelines (a document, an ADR, or a few
sentences) into a scaffolded, spec-first, agent-ready project — without asking
the user to sit through an interactive questionnaire.

Paths assume you run from the agent-compass checkout.

## Steps

1. **Intake the guidelines.** Accept anything: an architecture doc, an ADR, a
   Figma link, or one paragraph. Extract: project name, apps/surfaces, data
   layer, auth, queues, CI, deployment constraints, team conventions.

   - Guidelines missing or major unknowns (no idea what the data layer or
     deployment target is)? Run the
     [`architecture-advisor`](../architecture-advisor/SKILL.md) skill first —
     research-first, no unlabeled guesses — and use its ADR as the guidelines.
   - Minor gaps? Use the schema defaults and record each assumption.

2. **Translate guidelines → answers file.** Print the contract, then map:

   ```bash
   node scripts/bootstrap.mjs --schema
   ```

   Write `answers.json` with every key you can derive. Rules:

   - A guideline that matches a `choices` value exactly → use it.
   - A guideline outside the choices (e.g. Fastify instead of NestJS, MySQL
     instead of Postgres) → pick the **closest** choice, and keep a
     `deviations` list of your own; you will apply those deviations when
     executing the plan (the generated prompt is a baseline, not a cage).
   - No signal for a key → schema default, recorded as an assumption.

3. **Generate the bootstrap prompt** into the target directory:

   ```bash
   node scripts/bootstrap.mjs --answers answers.json --out /path/to/new-project
   ```

4. **Execute `BOOTSTRAP_PROMPT.md` yourself.** It is written for you:

   - Create `specs/000-project/` (spec → clarify → plan → tasks) first.
   - Apply the recorded deviations and assumptions in `plan.md`, labeled.
   - **Stop after the plan and show it to the user** — the prompt requires
     approval before scaffolding.
   - On approval, scaffold from `templates/` and the `stacks/` presets, TDD,
     per-module READMEs, pinned versions — as the prompt specifies.

5. **Wire agent-compass into the new project** so it stays agentic:

   ```bash
   git -C /path/to/new-project init          # if not already a repo
   node scripts/setup-wizard.mjs /path/to/new-project --yes
   ```

   Then follow steps 5–7 of
   [`compass-adopt`](../compass-adopt/SKILL.md) (fit-based asset selection,
   real command registry, verification).

6. **Validate and report.** Run the install/lint/typecheck/test commands the
   scaffold defines, then report against the Completion Gate, including the
   assumptions and deviations lists.

## Failure handling

- Target directory exists and is non-empty → stop and ask; never scaffold over
  existing files.
- Answers file rejected → the validator prints the offending keys and choices;
  fix and re-run (`--schema` shows the contract).
- The chosen stack preset doesn't cover a guideline (unusual framework) →
  scaffold the covered parts from templates, implement the rest following the
  architecture plan, and say so in the report.
