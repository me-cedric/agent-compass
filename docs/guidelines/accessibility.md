# Accessibility

The target is WCAG 2.2 AA. These are the rules that break most often in
practice, not a restatement of the standard.

An automated pass proves the machine-checkable half. It never proves the other
half: the keyboard path, the focus order and what a screen reader actually says.

## Structure

- One `h1` per page. Heading levels descend without gaps.
- Landmarks wrap the content: `header`, `nav`, `main`, `footer`. One `main`.
- The document `lang` is set, and changed for a passage in another language.
- On a client-side route change, update the document title and move focus to the
  new heading or the main region. A single-page app does neither by default.

## Keyboard

- Every interactive control is reachable and operable by keyboard, in an order
  that matches the visual order.
- Focus is always visible, never clipped by `overflow` and never removed. If a
  design removes the default ring, it replaces it with a stronger one.
- No keyboard trap. A dialog traps focus **while open** and returns it to the
  element that opened it.
- When the focused element disappears — a deleted row, a closed panel — move
  focus deliberately to a sensible neighbour. Focus dropped to `body` loses the
  user's place.
- A control that is not a `button` needs the role, the tab stop and the Enter and
  Space handlers a `button` gives free. Prefer the element over the imitation.

## Name, role, state, value

- Every control exposes all four. An icon-only button carries an accessible name.
- The name a user hears starts with the text they see, so a voice command works.
- Custom widgets follow an existing pattern rather than a new one. Composite
  widgets (tabs, radio groups, listboxes, menus) use one tab stop plus arrow
  keys, not one tab stop per option.

## Content

- Image alternatives describe function, not appearance. An image whose adjacent
  text already describes it is decorative: `alt=""`.
- Colour is never the only carrier of information. Pair it with text, shape or
  an icon.
- Contrast: 4.5:1 for body text, 3:1 for large text and for the visual boundary
  of a control or a focus ring.
- Announce an important change once, through a live region sized to the message.
  A region that re-renders wholesale announces everything twice.

## Reflow and motion

- Usable at 320 px wide with no horizontal scrolling of the page, and at 200%
  zoom.
- Long titles and long descriptions wrap or truncate accessibly. They never
  overflow their container or push a control off screen.
- Honour `prefers-reduced-motion`: remove or shorten non-essential transitions,
  parallax and autoplay.

## States

Loading, empty, error and partial-data states are part of the interface. Each
needs a name, a reachable retry where one applies, and an announcement when it
replaces content the user was reading.

## Proving it

- `AUTO` — run the automated audit (axe or equivalent) on every route the change
  touches. A rule disabled globally without analysis is a blocking condition,
  not a fix.
- `REVIEW` — walk the whole path with the keyboard alone. Check focus visibility
  and order. Check the accessible names of what you changed.
- `PR` — record any known limitation with an owner and a follow-up. See
  [definition-of-done.md](definition-of-done.md).

A green audit plus no manual pass is an unproven claim.

## Forbidden

- `tabindex` above zero
- `outline: none` with no replacement
- `aria-hidden` on a focusable element
- `role` used to relabel an element instead of using the right element
- a placeholder used as the only label
- a global axe rule disabled to make a run go green
