---
name: visual-regression-playwright
description: >
  Prove that a built screen matches its reference — a Figma export, a generated
  HTML preview, or a mockup image — with deterministic Playwright screenshots.
  Use when the user asks for visual regression, screenshot tests, pixel diffs,
  "does the build match the design", or when you change any user interface and
  must ship visual proof instead of a claim.
risk_level: low
writes_files: true
requires_tools: [playwright]
license: MIT
metadata:
  version: "1"
---

# Visual regression with Playwright

Answer one question: **does the built screen match its reference?**

This skill is the visual half of the QA flow. `qa-review-pass` calls it by name.
A coding agent that changes a user interface runs this skill and attaches the
result. An assertion that "the layout is correct" is not proof. A diff is.

## Paths

This skill uses the default compass layout below. When the host project puts an
artifact somewhere else, use the host path and say so in the report.

| Artifact | Default path | Git |
| --- | --- | --- |
| References (baselines) | `{{DESIGNS_DIR}}/baselines/` | committed |
| Captured screenshots | `test-results/visual/` | ignored |
| Diff images | `test-results/visual/diff/` | ignored |
| Report | `{{DELIVERY_DIR}}/visual/{{DATE}}-<kebab-slug>.md` | committed |

**A reference is committed. A capture is not.** If the run writes captures back
into the reference directory, each run makes a new baseline. The check then
always passes and proves nothing. Add `test-results/` to `.gitignore` first.

## Get a reference

Use the first source that is available.

| Source | How | Use when |
| --- | --- | --- |
| Figma frame export | export the frame as PNG at 1x, one file per viewport | a design file exists |
| Generated HTML preview | render the preview with Playwright at the same viewport | the design lives as code |
| Mockup image | crop to the screen bounds, record the intended width | only a picture exists |

Record the source and the viewport width in the file name, for example
`dashboard-1440-light.png`.

When the reference and the build differ in size, **change the viewport, never
the screenshot**. A scaled or cropped capture hides layout faults. If the
reference has no known width, treat it as a lead and not as a baseline.

## Viewport matrix

Capture each screen at four widths, in CSS pixels.

| Width | Why |
| --- | --- |
| 375 | small phone, the tightest column |
| 768 | tablet, the first layout break |
| 1024 | small laptop, the sidebar decision |
| 1440 | desktop, the reference design width |

Capture both colour schemes when the project ships two. That makes eight images
per screen. Test the screens that carry the product, not every route.

## Determinism

A non-deterministic check fails at random. The team then stops reading it. Fix
all six causes before you trust one diff.

1. **Freeze motion.** Set `animations: 'disabled'` in the screenshot options. Add
   a stylesheet that sets `transition: none` and `animation: none` for `*`.
2. **Wait for fonts.** Await `document.fonts.ready` in the page before capture.
   A late font swap moves every text line.
3. **Wait for a signal.** Await `networkidle`, or better, await a data test id
   that the screen sets when it is ready. Never await a fixed timeout.
4. **Stub changing data.** Replace dates, random ids, avatars and live counters
   with fixed values, or pass them in `mask` so Playwright paints them over.
5. **Pin the scale.** Set `deviceScaleFactor: 1`. A retina machine and a CI
   runner produce different pixel counts otherwise.
6. **Pin the browser.** Run one browser project, and pin the Playwright version
   in `package.json`. A browser upgrade changes text rendering.

## Compare

Use Playwright's own `toHaveScreenshot`. Do not add an image-diff dependency.

Start at `maxDiffPixelRatio: 0.01` — one percent of the pixels. Lower it to
`0.002` for a screen that is already stable.

**A tolerance chosen to make a failing test pass is a deleted test.** Raise the
tolerance only with a measured reason, and write that reason in the report.

## Read the diff honestly

Three findings look similar in a diff image. Separate them.

| Finding | What the diff shows | What to do |
| --- | --- | --- |
| Layout shift | a block of pixels moves; the diff has hard edges and a shadow copy | a real fault; fix the build |
| Colour change | the shape is identical; the diff fills the whole region evenly | check the token, then fix the build or the token |
| Anti-aliasing | a one-pixel outline on glyphs and curves only | raise the ratio a little, or pin the browser |

A difference against a **mockup** is often the mockup being out of date. That is
a finding about the mockup. Report it, name the frame, and ask the designer. Do
not change the build to match a stale picture.

## No reference at all

1. Capture the current state at all four viewports.
2. Open every image and look at it.
3. Commit them as the baseline.
4. Write in the report: `First run. Baseline established. This run proves nothing.`

## Spec

`e2e/visual/dashboard.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

const VIEWPORTS = [375, 768, 1024, 1440];

for (const width of VIEWPORTS) {
  test(`dashboard at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/dashboard');

    // Explicit ready signal, not a timeout.
    await page.getByTestId('dashboard-ready').waitFor();
    await page.evaluate(() => document.fonts.ready);

    await expect(page).toHaveScreenshot(`dashboard-${width}-light.png`, {
      fullPage: true,
      animations: 'disabled',
      maxDiffPixelRatio: 0.01,
      mask: [page.getByTestId('last-updated'), page.locator('img.avatar')],
    });
  });
}
```

## Config fragment

`playwright.config.ts`

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e/visual',
  outputDir: 'test-results/visual',
  snapshotPathTemplate: '{{DESIGNS_DIR}}/baselines/{arg}{ext}',
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled' },
  },
  use: {
    deviceScaleFactor: 1,
    colorScheme: 'light',
    timezoneId: 'UTC',
    locale: 'en-GB',
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
```

Replace `{{DESIGNS_DIR}}` with the host path. Add a second project with
`colorScheme: 'dark'` when the project ships two schemes.

## Output

File: `{{DELIVERY_DIR}}/visual/{{DATE}}-<kebab-slug>.md`

```markdown
---
title: <one line, which screen and which reference>
date: {{DATE}}
reference: <figma frame | html preview | mockup image> — <path or frame name>
audience: dev
---

# <title>

## Run

Screens: <n>. Viewports: 375, 768, 1024, 1440. Schemes: <light | light + dark>.
Tolerance: maxDiffPixelRatio <value>.

## Results

| Screen | Viewport | Scheme | Result | Diff ratio |
| --- | --- | --- | --- | --- |

Result: `match` | `layout shift` | `colour change` | `anti-aliasing` | `baseline created`.

## Findings

One entry per failure. Name the element, the reference, and the cause.
State whether the build is wrong or the reference is stale.

## Actions

- [ ] …

## Validation

The command that produced this report, and its result:
`passed` | `failed` | `partial` | `not run` + reason.
```

## Rules

- Never overwrite a baseline to make a run green.
- Never compare a capture at one viewport against a reference at another.
- Never commit a capture as a reference before a person looks at it.
- Report the tolerance you used. A hidden tolerance is a hidden failure.
- Do not fix the build from this skill. It produces the proof; a separate task
  executes the fix.
- Do not commit and do not push. The user commits.
