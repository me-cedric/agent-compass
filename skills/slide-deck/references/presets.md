# Style presets

Adapted from `STYLE_PRESETS.md` of frontend-slides by Zara Zhang (MIT, see `LICENSE-frontend-slides`):
https://github.com/zarazhangrui/frontend-slides

Changes: each preset uses system font stacks, because a deck loads no web font. Only the `:root` values of `template.html` change.
Use abstract shapes only (gradients, lines, circles in CSS or SVG). Do not use illustrations or remote images.

## 1. Bold Signal (dark, confident)

```css
:root {
  --bg: #1a1a1a; --surface: #2d2d2d; --text: #ffffff; --muted: #a3a3a3; --accent: #ff5722;
  --font-display: "Arial Black", "Helvetica Neue", ui-sans-serif, sans-serif;
  --font-body: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
```

Large section numbers (01, 02) in the accent. One coloured card as the focal point. Strict grid.

## 2. Electric Studio (light and dark split, professional)

```css
:root {
  --bg: #ffffff; --surface: #0a0a0a; --text: #0a0a0a; --muted: #525252; --accent: #4361ee;
  --font-display: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  --font-body: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
```

A panel split with an accent bar on its edge. A quote as the hero element. Generous space.

## 3. Dark Botanical (elegant, premium)

```css
:root {
  --bg: #0f0f0f; --surface: #1c1b1a; --text: #e8e4df; --muted: #9a9590; --accent: #d4a574;
  --font-display: "Iowan Old Style", "Palatino Linotype", Georgia, serif;
  --font-body: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
```

Blurred soft circles in a corner (radial gradients). Thin vertical accent lines. Italic headings.

## 4. Notebook (light, editorial)

```css
:root {
  --bg: #f8f6f1; --surface: #ffffff; --text: #1a1a1a; --muted: #5c5c5c; --accent: #2f7d6d;
  --font-display: "Didot", "Bodoni 72", Georgia, serif;
  --font-body: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
```

A paper card on a darker frame. Small coloured tabs on the right edge for the sections.

## 5. Terminal (technical, calm)

```css
:root {
  --bg: #0b1020; --surface: #141b2d; --text: #e2e8f0; --muted: #8b9bb4; --accent: #22d3ee;
  --font-display: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --font-body: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
}
```

A faint grid background (two linear gradients, 50 px). Monospace labels. Diagrams with thin lines.

## Feeling to motion

| Feeling | Motion |
|---|---|
| Professional | Short fades (200 to 300 ms), no bounce. |
| Dramatic | Slow fades (1 to 1.5 s), a scale from 0.9 to 1. |
| Technical | Lines that draw in, a grid that fades in. |
| Calm | Slow, small fades only. |
| Editorial | Staggered text reveals, step by step. |
