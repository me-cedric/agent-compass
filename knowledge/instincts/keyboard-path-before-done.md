---
id: compass-keyboard-path-before-done
trigger: 'when you add or change an interactive control, a dialog, a form, or a route'
confidence: 0.8
domain: frontend
source: adapted from an AI-accelerated frontend POC
---

# Walk the whole path with the keyboard before calling it done

## Action

Put the mouse down. Tab through what you changed, end to end:

1. Reach every control you added, in the order they appear on screen.
2. Watch the focus ring the whole way. It must stay visible and unclipped.
3. Operate each control with Enter or Space.
4. Close the dialog and confirm focus returned to what opened it.
5. Delete or hide the focused element and confirm focus went somewhere sensible,
   not to `body`.

Record the result in the handoff, one line. See
[accessibility.md](../../docs/guidelines/accessibility.md) for the full rules.

## Why the automated audit does not cover this

axe reads the rendered tree. It finds a missing accessible name, a bad contrast
ratio and a wrong role. It cannot tell you that Tab skips your new button, that
the focus ring sits under a sticky header, that a dialog lets focus escape
behind it, or that deleting a row dropped the user back to the top of the page.

Those are the failures that make an interface unusable, and they are exactly the
ones a green audit hides.

## The usual causes

- a `div` with an `onClick` and no role, tab stop or key handler
- `outline: none` with nothing put back
- a custom composite widget giving every option its own tab stop instead of one
  tab stop plus arrow keys
- `overflow: hidden` on an ancestor clipping the focus ring
- a route change that leaves focus on the link that was clicked

Prefer the real element over the imitation. A `button` arrives with all of this
already correct.

See [[ui-change-needs-visual-proof]] for the visual half of the same review.
