---
name: excalidraw-to-likec4
description: >
  Convert an Excalidraw diagram (.excalidraw JSON) into a LikeC4 model file
  (.c4). Use when the user wants to turn a hand-drawn Excalidraw architecture
  sketch into a LikeC4 C4 model, or mentions excalidraw, c4, or likec4.
risk_level: low
writes_files: true
requires_tools: [python3]
license: MIT
metadata:
  version: "1"
---

# Excalidraw → LikeC4

Turn a freehand Excalidraw diagram into a LikeC4 model.

Its sibling is [`excalidraw-to-adr`](../excalidraw-to-adr/SKILL.md), which reads
the same sketch for the decision behind it. Feed the output of this skill to
[`likec4-to-openspec`](../likec4-to-openspec/SKILL.md) to derive requirements.

## Inputs

Excalidraw files (`.excalidraw`, JSON) — by default under `docs/drawings/`. If the
user names a file, use that; otherwise list the folder and ask which drawing (or
convert each).

## Output

`docs/diagrams/<name>.c4` — one LikeC4 file per drawing (`<name>` = the drawing's
base name). Never modify the source `.excalidraw`.

## Deterministic conversion

Run the bundled script — it does the mapping and emits valid LikeC4:

```bash
python3 skills/excalidraw-to-likec4/scripts/excalidraw_to_likec4.py \
  <input.excalidraw> docs/diagrams/<name>.c4
```

Mapping performed by the script:
- **Shapes** (`rectangle`, `ellipse`, `diamond`) → LikeC4 elements of kind `node`.
  The element title is the shape's bound text (or nearby label).
- **Arrows / lines** with a start- and end-binding → LikeC4 relationships
  `a -> b 'label'` (label from the arrow's text, if any).
- A `views { view index { include * } }` landscape view is always emitted.

## Refine (optional)

The script emits a single element kind `node`. If the drawing clearly
distinguishes systems/containers/components, edit the generated `.c4` to add
richer kinds in the `specification { }` block and change the element kinds
accordingly — but keep the element ids and relationships the script produced.

## Validation

After writing, confirm the file contains all three blocks:

```bash
grep -q 'specification' F && grep -q 'model' F && grep -q 'views' F && echo OK   # F = the output path
```

Every relationship's `a` and `b` must be ids declared in the `model { }` block.
