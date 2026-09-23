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

## Pass the model and the effort explicitly, on every call

An omitted parameter inherits silently, and the tier you assumed is not the tier
that ran. **A wrong answer from a cheap agent is not cheap:** it arrives with the
same confidence as a right one, and the review cost falls on the orchestrator.

| Surface | What to pass |
| --- | --- |
| A workflow script's agent call | The model **and** the reasoning effort, on **every** call. Both are per-call. Neither is inherited from the script. |
| A subagent tool call | The model. Effort usually follows the session, so raise the session effort when the task needs it and say so. |
| An agent definition file | The model in the frontmatter, so a caller who forgets still gets it. |

A project may set a floor — "every subagent runs the mid tier at high effort
unless the user asks otherwise in that request". Where it does, "unless asked
otherwise" means **the user asked in that request**. A cheaper tier for one stage
is a decision the user makes, not an optimisation the orchestrator takes quietly.
When you believe a stage warrants a different tier, say so in one line and
proceed with the floor unless told otherwise.

## The spawning agent reviews the work before using it

**A subagent's report is a claim, not a result.** The agent that spawned it owns
the outcome and reviews it before committing, quoting, or building on it. Reading
the report is not reviewing it.

What review means, in order of what actually catches things:

1. **Re-run the gates yourself.** Never take "gates green" on trust. With
   concurrent agents, only a run after all of them tells the truth.
2. **Check the load-bearing claim.** Not every line — the one the work rests on.
   Verify it against the code or the file, not against the report.
3. **Treat a `blocked` entry as a finding to verify, not an excuse to accept.** A
   claimed blocker is often wrong, and the workaround it justified skips side
   effects that delivered rules depend on. **A stated blocker is the most
   valuable thing in a report and the least reliable.**
4. **When two agents disagree about the same thing, verify — never pick.** The
   report that compared against the source is right; the one that argued from a
   document's claim is wrong. Picking the more confident report is a coin toss.
5. **Read every file a subagent wrote that you are about to commit.**

A subagent's refusal to do something is usually right and usually informative: a
refusal often catches a wrong claim in the instructions it was given. **Read the
refusals first.**

### What the orchestrator may not delegate

Deciding what a finding means, whether a spec conflict is resolved, and what gets
committed. Agents gather, verify and apply; the orchestrator decides. A decision
taken inside a subagent is a decision nobody reviewed.

## Token layer

Reduce tokens before changing tiers — it is free quality:

- [headroom](headroom.md) compresses session context (wrap/proxy/MCP).
- [`rtk`](rtk.md) compacts noisy command output.
- Load the [context pack](../../scripts/context-pack.mjs) and
  [repo-map routing](../../templates/context/repo-map.md) instead of broad search.

## Safety

A cheaper or autonomous tier never relaxes `AGENTS.md` §10 — no commit, push,
deploy, publish, or PR without explicit approval, regardless of model or profile.
