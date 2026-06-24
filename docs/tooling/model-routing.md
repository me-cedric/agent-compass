# Model Routing & Cost

"As little input as possible" includes spend. Permission profiles control *access*
([agent-permissions](agent-permissions.md)); this page controls *which model* and
*who does the work*. Wrong tier is a common quality and cost failure.

## Tier by task type

| Task type | Model tier | Delegate? |
| --------- | ---------- | --------- |
| Read/explain/triage, mechanical edits | cheap–mid | no |
| Feature work, multi-file changes | mid–top | implement on mid, plan on top |
| Architecture, security, ambiguous/high-risk | top | no |
| Broad bounded migration / fan-out | top orchestrates, mid implements | yes |
| Independent review/explore lanes | mid subagents | yes |

## Delegation triggers

Keep the top model for orchestration, root-cause scoping, and final verification;
push the bulk down to cheaper executors when:

- A substantial coding task can be handed off whole (one clear spec).
- Work splits into disjoint-file clusters that parallel agents won't collide on.
- A review needs several independent perspectives (security, tests, API, perf).

The top model verifies at the end (one validation pass) rather than reading every
file itself.

## Token layer

Reduce tokens before changing tiers — it is free quality:

- [headroom](headroom.md) compresses session context (wrap/proxy/MCP).
- [`rtk`](rtk.md) compacts noisy command output.
- Load the [context pack](../../scripts/context-pack.mjs) and
  [repo-map routing](../../templates/context/repo-map.md) instead of broad search.

## Safety

A cheaper or autonomous tier never relaxes `AGENTS.md` §10 — no commit, push,
deploy, publish, or PR without explicit approval, regardless of model or profile.
