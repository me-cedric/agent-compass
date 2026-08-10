# Feature Flags

Ship code behind a flag so a capability can be merged, deployed, and enabled
independently — and disabled fast if it misbehaves.

## Dormant-by-default pattern

A new or risky capability defaults to **off**. When off, its endpoints,
webhooks, processors, schedulers, and side effects are inert. Enabling is a
single env change.

```bash
# .env.example
# When disabled (default), all <feature> endpoints, webhooks, processors,
# and side effects are dormant. Set to 'true', '1', or 'yes' to enable.
FEATURE_<NAME>_ENABLED=false
```

```ts
// one parser, reused; NaN/garbage -> false
export const isEnabled = (v?: string) =>
  ['true', '1', 'yes'].includes((v ?? '').trim().toLowerCase())
```

## Rules

- **Default off.** A flag that defaults on isn't protecting anything.
- **Gate at the edges** — guards/route registration/processor registration —
  so the dormant path costs nothing and can't fire side effects.
- **Document the flag** in `.env.example` and the module README (what it gates,
  default, blast radius).
- **Plan removal.** A flag is temporary scaffolding; track when it retires so the
  branch doesn't ossify into permanent dead code.

## An empty selection must mean something explicit

A user-scoped flag is a **selection**, not a boolean: a stored list of the
capabilities this user, project or tenant switched on. An empty list is then
ambiguous, and the two readings are opposite. Decide, write the decision down,
and assert it in a test.

- **Empty means "everything", not "nothing".** Every install that predates the
  feature already holds an empty value on disk. Reading it as "all off" empties
  the navigation on upgrade, for every existing user, with no action from them.
  Default-off (above) applies to a new capability. It does not apply to an
  absent selection.
- **A switched-off route still resolves, and explains itself.** The route stays
  registered. It answers with a page that states two facts: the owner switched
  this capability off, and nothing was deleted. A link in a note or a review
  must not turn into a 404 because somebody tidied a menu.
- **The repair surface ignores the selection.** Diagnostics, health and settings
  screens stay reachable whatever the list holds. A hand-edited or corrupt file
  must not hide the screen that undoes the edit.

Each of these is a behavior, so test it: one case with an empty selection, one
case that opens a switched-off route, and one case with a selection that omits
the repair surface. An empty selection passes that last test for free.

For long-lived, user-segment, or percentage rollouts, use a real flag service
(LaunchDarkly, Unleash, Flagsmith) rather than env vars — but the default-off and
documentation rules still hold.
