# Environment Management

## The discipline

- **One `.env.example`, always current.** Every variable the app reads appears
  there, with a comment explaining it and a safe placeholder. Update it in the
  **same change** that adds/removes a variable.
- **Sync all env surfaces together.** If the project has startup validation and
  a committed local-development env template (`.env.development`,
  `.env.local.example`, or equivalent), update those with `.env.example` in the
  same task.
- **Never commit `.env`.** It's gitignored; only `.env.example` is tracked.
- **Validate at startup.** Parse and validate required env on boot (schema-based);
  fail fast with a clear message naming the missing/invalid var. Don't let a
  missing secret surface as a vague runtime error later.
- **NaN-safe parsing** for numeric/boolean env, with sane fallbacks — see the
  resilience/feature-flag patterns.

## Template

[`templates/monorepo/env.example.tpl`](../../templates/monorepo/env.example.tpl)
shows the style: grouped by concern, each var commented, secrets as placeholders.

```bash
# <Concern> — what this group configures
# How to obtain / generate the value
FEATURE_X_ENABLED=false      # default off; see architecture/feature-flags.md
SERVICE_TOKEN=your_token_here
```

## Connecting to environments

Document in the project README how to run **locally**, and how to point at **dev**
or **preprod** (which vars change, what's safe). A developer should be able to go
from clone to running — fully local, or partially connected — by following the
README and filling `.env` from `.env.example`.

## For agents

Touched env? Update validation, `.env.example`, local-dev defaults, validation
tests for required vars, and the README setup section in the same task.
Surfacing a needed-but-undocumented var is part of "done". See the
[`env-var-sync`](../../knowledge/instincts/env-var-sync.md) instinct.
