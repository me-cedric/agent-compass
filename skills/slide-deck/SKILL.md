---
name: slide-deck
description: Write a slide deck as one self-contained HTML file with animation, step reveals, reduced motion and a print style sheet for PDF. Use when the user asks for a deck, slides or a presentation.
risk_level: low
writes_files: true
requires_tools: []
disable-model-invocation: true
---

# slide-deck

Write a deck as one `.html` file in `{{SLIDES_DIR}}/`. All CSS and JavaScript are inline. The deck fetches nothing when a person views it.
A host can show the deck in a sandboxed frame with no origin, and print it to PDF with JavaScript off. The rules below keep the deck working in both.

Based on frontend-slides by Zara Zhang (MIT): https://github.com/zarazhangrui/frontend-slides. The diagram patterns take ideas from visual-explainer by Nico Bailon (MIT): https://github.com/nicobailon/visual-explainer.

## Steps

1. Ask for the content (the points, the numbers, the audience) and the feeling, unless the user gave them. Ask one question at a time.
2. Pick one preset from [references/presets.md](references/presets.md). Say which one and why in one line.
3. Copy [references/template.html](references/template.html) to `{{SLIDES_DIR}}/<kebab-name>.html`. Keep its header comment.
4. Set `<title>` and `<html lang>`. Change only the `:root` values for the preset.
5. Write the slides. Remove the sample slides that you do not use.
6. Run the checks below. Fix each failure before you report.

To convert a Markdown deck, keep each slide and its text. Each `---` separator starts a new `<section class="slide">`. Do not delete the Markdown file: the user decides.

## Slides

- One idea per slide. Six bullet lines or fewer. The body text is 28 px or more on the 1920 x 1080 stage.
- Each slide is `<section class="slide" aria-label="<n>">`. The first slide also has the class `active`.
- Use semantic HTML: `h1` on the title slide, `h2` on the other slides, `ul` for lists.
- Give each SVG `role="img"` and an `aria-label` that says what it shows.
- Contrast: 4.5:1 or more for text on its background.
- Pictures go inline as `data:` URLs or as inline SVG. Keep a picture under 300 KB.

## Motion

- Write each element in its final state. Animate only from a start state: `@keyframes x { from { ... } }` with `animation-fill-mode: backwards`.
- Start an animation only under `.slide.active`, so it plays when the slide shows.
- A step reveal is an element with `data-step`. The script hides the later steps. Without the script, every step shows.
- Diagrams: inline SVG. Lines draw in with `stroke-dasharray` and `stroke-dashoffset`; boxes fade in after them.
- Charts: inline SVG bars or lines. Bars grow with `transform: scaleY(0)` as the start state and `transform-origin: bottom`.
- Do not use `<canvas>` for content: the PDF shows no script output.
- Keep the `prefers-reduced-motion: reduce` block of the template. It removes every animation and transition.
- Motion matches the feeling of the preset. A slide has three moving groups or fewer.

## Sandbox and print

- No `fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource` or `navigator.sendBeacon`.
- No `localStorage`, `sessionStorage`, `indexedDB` or cookies. A frame with no origin throws on them.
- No `<link rel="stylesheet">`, no `@import`, no web font URL, no remote `src` or `href`. Use system font stacks.
- No `alert`, `confirm`, `prompt`, `window.open` or forms.
- Keep the `message` listener and the Escape message of the template: the host frame sends the arrow keys and leaves its present mode with Escape.
- Keep the `@media print` block and `@page { size: 1920px 1080px; margin: 0 }`. Each slide prints on its own page, with every step and animation in its final state.

## Checks

Run each check on the deck. Each one must pass.

```sh
f={{SLIDES_DIR}}/<name>.html
# 1. No network: prints nothing.
grep -nE '(src|href)=["'"'"']?(https?:)?//|url\(["'"'"']?(https?:)?//|@import|<link[^>]+stylesheet' "$f"
# 2. No storage, no request, no dialog: prints nothing.
grep -nE '\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie|alert|confirm|prompt|window\.open)\b' "$f"
# 3. Each of these prints a count of 1 or more.
grep -c '<title>' "$f"; grep -c 'prefers-reduced-motion: reduce' "$f"; grep -c '@media print' "$f"
grep -c '@page' "$f"; grep -c 'class="slide active"' "$f"; grep -c 'deckKey' "$f"
```

Then open the file in a browser with the network off:

- The arrow keys, Space, Home and End move through the slides and the steps.
- With reduced motion on in the system, nothing moves.
- The print preview shows one slide per page and every step.

## Report

Give the path of the deck, the preset, the number of slides, and the result of each check.
