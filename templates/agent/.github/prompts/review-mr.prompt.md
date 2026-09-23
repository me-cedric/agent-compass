---
agent: agent
description: Full merge or pull request review — spec match, contract layers, design, tests, cross-request compatibility, then findings and a correction plan.
---

Follow `docs/agent-compass/skills/pr-review-governance/SKILL.md` from start to
finish. Do not skip an axis the routing table makes mandatory for the changed
paths.

Review target (request id, branch, or "current diff"):
${input:target:Which merge request, pull request, or branch?}

Ticket or spec reference, if known:
${input:reference:Tracker key, product specification, or spec feature — leave empty to resolve it yourself}

Rules for this run:

- Take the diff from the forge's own head revision, not from the local base
  branch.
- Freeze the acceptance criteria from the tracker and the specification corpus
  before reading the code, and read them at the base revision — a request that
  edits the specs ships its own criteria.
- Label every verdict with its evidence tier: executed, code read, or claimed.
  Never call a code read "verified", and never soften a real blocker because you
  could not run it.
- Backend diff: check the HTTP collection, the Gherkin features, the OpenAPI
  surface, the shared types, and every new query parameter against the
  coercion traps. See `docs/agent-compass/skills/api-contract-sync/SKILL.md`.
- Frontend diff: check the design corpus, the stories, and render the screen when
  the stack can run.
- Check unit tests and end-to-end specs against the change, including a spec made
  stale by a renamed route, selector, or label.
- Check compatibility with the other open requests and with the base branch.
- Answer in the repository's declared review language, junior-friendly, and end
  with the correction plan.
- Post nothing to the forge or the tracker before the user confirms.
