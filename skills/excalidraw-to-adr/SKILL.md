---
name: excalidraw-to-adr
description: >
  Draft an Architecture Decision Record (MADR format) from an Excalidraw
  diagram. Use when the user wants to capture the decision behind a hand-drawn
  sketch as an ADR, or mentions excalidraw plus ADR / decision record.
risk_level: low
writes_files: true
requires_tools: []
license: MIT
metadata:
  version: "1"
---

# Excalidraw → ADR (MADR)

Read an Excalidraw sketch, infer the architectural decision it depicts, and write
a Markdown Architecture Decision Record in the
[MADR 4.0](https://adr.github.io/madr/) format.

Its siblings are [`adr-from-meeting`](../adr-from-meeting/SKILL.md), which starts
from a transcript, and [`excalidraw-to-likec4`](../excalidraw-to-likec4/SKILL.md),
which turns the same sketch into a model rather than a decision.

## Inputs

An Excalidraw file (`.excalidraw`) under `docs/drawings/`, or one the user names.
Read its `elements` — shape labels, arrow labels, and free text carry the intent.

## Output

`docs/decisions/NNN-<kebab-title>.md`, where `NNN` is the highest existing number
in `docs/decisions/` plus one, zero-padded. `000-template.md` is the shape to
follow when the project has one. Do not renumber or edit existing ADRs.

## Template (MADR 4.0 — fill every field)

```markdown
---
status: "proposed"
date: <YYYY-MM-DD>
decision-makers: []
consulted: []
informed: []
---

# {short title of the decision}

## Context and Problem Statement

{Describe the context and problem — 2-3 sentences, or a question. Reference the diagram.}

## Decision Drivers

* {driver 1, e.g. a force, a concern}
* {driver 2}

## Considered Options

* {option 1}
* {option 2}
* {option 3}

## Decision Outcome

Chosen option: "{option 1}", because {justification}.

### Consequences

* Good, because {positive consequence}
* Bad, because {negative consequence}

## Pros and Cons of the Options

### {option 1}

* Good, because {argument}
* Neutral, because {argument}
* Bad, because {argument}

### {option 2}

* Good, because {argument}
* Bad, because {argument}

## More Information

{Links, follow-ups, or the source diagram path.}
```

## Procedure

1. Read the drawing; identify the **decision**, the **options** the sketch shows
   (often parallel boxes or alternative paths), and the **drivers** (labels,
   annotations).
2. Determine `NNN` by listing `docs/decisions/`.
3. Write the ADR from the template above. Keep `status: "proposed"`; set `date` to
   today. Fill sections you cannot infer with an explicit `TODO:` rather than
   inventing facts.
4. Reference the source `.excalidraw` path under **More Information**.

Never fabricate decision-makers or outcomes the drawing does not support — leave
a `TODO:` for the human.
