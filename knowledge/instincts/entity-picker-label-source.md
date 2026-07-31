---
id: entity-picker-label-source
trigger: 'when building a select/autocomplete/picker of domain entities (mentors, users, companies) and choosing what to show as each option label'
confidence: 0.8
domain: frontend
source: local-repo-analysis
---

# Label entity pickers by a stable human name, not a nullable attribute

## Action

An option label in a picker must let a human tell two entities apart. Use a
name-bearing field, and make the fallback human-readable — never a raw id.

- Check the type you actually map from. If the list endpoint returns a
  *profile*/*role* row (`MentorProfile`, `CompanyMember`) it often has **no
  name** — the name lives on the linked `user`. `jobTitle || id` then renders
  duplicate titles or an opaque `clxmentor123` to the user.
- Fetch (or join) the name-bearing source, or ask the backend to include
  `firstName`/`lastName` on the list response.
- Keep the label **consistent** with how the same entity is shown elsewhere
  (e.g. the "assigned" list uses `firstName lastName` — the picker must too).
- If you must fall back, fall back to something a person recognises, not the
  primary key.

## Why

A mentor picker labeled options `mentor.jobTitle || mentor.id`; `MentorProfile`
carries no name and `jobTitle` is nullable, so the dropdown showed duplicate job
titles and, when null, a raw database id — while the assigned-mentors line right
next to it showed full names. The picker becomes unusable exactly when the user
needs it most (several mentors, same title). Pick the label source from the data
shape, not from whatever field happens to be on the object.
