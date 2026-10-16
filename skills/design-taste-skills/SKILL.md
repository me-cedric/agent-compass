---
name: design-taste-skills
description: Route frontend design direction work to the pinned taste skills. Use for a landing page, redesign, brand system or mockup-to-code task, not for a bug fix.
risk_level: low
writes_files: false
requires_tools: [ac]
metadata:
  stacks: [react-web, next-web, angular-web, expo-mobile]
---

# design-taste-skills

Design skills are pinned upstream under the source id `taste`. Compass keeps no copy.
They do not mix. A dense product UI and a landing page need opposite advice. Pick one group and stay in it.

## Install

Add the source id to `upstream` in `.agents/compass.json`. Then run `ac sync`. The source id is `taste`.

## Pick the group

| Surface | Skills |
|---|---|
| Landing page, marketing site, portfolio | `design-taste-frontend`, and at most one of `industrial-brutalist-ui` or `stitch-design-taste` |
| Dense product UI, admin, dashboard | `high-end-visual-design` and `minimalist-ui` |
| An existing surface to rework | `redesign-existing-projects` |
| Brand system, logo, identity | `brandkit` |
| A mockup, screenshot or Figma frame to convert | `image-to-code` |

Do not use a landing-page skill and a product-UI skill in one project, unless the project has both surfaces. Say which surface you work on.

## Give it a direction

Fix these items before you generate anything:

1. The surface and its main job.
2. A named style direction, such as editorial, Swiss or brutalist. "Clean and modern" is not a direction.
3. The source of the palette and the type: the design system, a Figma token export, or a choice that you can defend.
4. What must not change: tokens, component API, brand constraints.

If the project has a design system, the system wins. Use the skill to apply it well. When Figma is the source, run `ui-conformance` first.

## Prove it

A design change is visible, so it needs visual proof at each viewport. Run `ui-conformance`.
A skill that says the result "looks expensive" is not proof.
A direction that fails contrast or keyboard navigation is not finished.
