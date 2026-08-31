---
id: worktree-base-before-work
trigger: 'when you start work in a git worktree, a fresh branch, or a checkout somebody else prepared — especially as one of several parallel agents'
confidence: 0.9
domain: workflow
source: host-project-promotion
---

# Ask what your checkout branched from, before the first edit

## Action

Two commands, before anything else:

```bash
git log --oneline main..HEAD    # what this branch has that main does not
git log --oneline HEAD..main    # what main has that this branch does not
```

Then act on the answer:

| The branch has | Do |
| -------------- | -- |
| No commits of its own, and is behind | `git merge --ff-only main` before you start |
| Commits of its own, and is behind | Say so in your report and let the parent decide. Do not rebase on your own. |
| Nothing behind | Start |

Three rules that go with it, for parallel work:

1. **Commit each coherent piece as you finish it.** A pure type with its tests is
   a commit; wiring it into the UI is another. A session that dies with nothing
   committed loses everything, and that is not hypothetical.
2. **Stay inside the files your task names.** Parallel branches rebase cleanly
   onto each other only while their file sets are disjoint.
3. **Do not remove a worktree because it looks finished.** A clean tree and a
   committed branch are not proof the work has ended. Wait for the orchestrator's
   own completion signal.

## Why

A worktree is not always cut from the tip. When several are prepared in one wave,
some are cut from whatever the parent's `HEAD` was at the time, and that can be
many commits behind — in one real case, fourteen and fifteen, with one of the
agents briefed to build on a function that did not exist at its base.

The failure is expensive and quiet. The agent reads the code at its base, finds
the helper missing, concludes it must write one, and produces a duplicate of
something that already exists on `main` — or worse, an incompatible reimplementation
that merges without conflict. Two commands at the start turn a whole wasted
session into one line of context.

Related: [[mr-scope-and-green-pipeline]] (what a branch quietly drags in),
[[self-review-before-done]] (read your own diff as a reviewer would).
