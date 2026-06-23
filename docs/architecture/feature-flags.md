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

For long-lived, user-segment, or percentage rollouts, use a real flag service
(LaunchDarkly, Unleash, Flagsmith) rather than env vars — but the default-off and
documentation rules still hold.
