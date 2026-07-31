---
id: frontend-shared-layer-escapes
trigger: 'when reviewing or writing a React view that uses an inline style prop, or renders a user/admin-supplied URL as an href'
confidence: 0.8
domain: frontend
source: local-repo-analysis
---

# Don't hand-roll around the shared design/safety layer

Two recurring review catches, both "escapes" from the shared frontend layer.

## Action — inline layout styles

Inline `style={{ ... }}` for layout (`width`, `%`, `alignSelf`, margins, colors)
bypasses the CSS-Module + design-token system (host `AGENTS.md §13`). Move the
rule into the component's `.module.css`, and use tokens for values
(`var(--space-3)`, `var(--color-error-700)`) instead of literals like
`marginBottom: '12px'` or `width: '55%'`. This keeps re-flagging in review even
after the obvious cases are fixed — new pages reintroduce it.

## Action — external URLs as href

An admin/user-supplied URL rendered straight into `href` is an XSS vector: a
`javascript:` or `data:` value executes on click. `rel="noopener noreferrer"`
does **not** protect against this. Before rendering the link, allow only
`http`/`https` (parse and check the protocol); otherwise render the text plain.
Treat any stored URL as untrusted at the point of linking.

## Why

Both look harmless and pass typecheck/lint: the inline style renders fine, the
link "works". They fail the *system*, not the compiler — one erodes the token
system so theming/spacing drift, the other opens a click-to-execute hole on data
another actor controls. Reach for the shared primitive (CSS Module + token, safe
-link guard), not the one-off. See [[api-security-edge-cases]] for the
trust-boundary mindset on the backend side.
