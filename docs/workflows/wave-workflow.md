# Wave Workflow

Use this when a batch of answers, audit findings or backlog items has to land
across the specs, the product documentation and the code. One wave at a time.

It exists because the expensive failures in a batch are never coding failures.
They are a wave started before the previous one was reviewed, two agents writing
one file, and a question struck before its decision was written down.

For a single long implementation with phases, use
[`long-running-task.md`](long-running-task.md) instead. Use this playbook when
the batch carries many independent items and each one touches documentation as
well as code.

## The loop

1. **Plan the waves before building any of them**, ordered by dependency and not
   by size. An item that unblocks others goes first, even when it is small.
   Record the plan in the batch's own plan document, never in a new competing
   file.
2. **Name each wave's clusters with disjoint file sets.** One writer per file,
   always. Two agents in one file is how a request loses a day. See
   [`../../skills/work-splitting/SKILL.md`](../../skills/work-splitting/SKILL.md).
3. **Cap the concurrent subagents**, and pass the model and the reasoning effort
   explicitly on every call — see [`../tooling/model-routing.md`](../tooling/model-routing.md).
   Five at once is a workable ceiling; more than that and the review queue, not
   the work, becomes the bottleneck.
4. **The orchestrator writes the decision record itself.** Deciding what a
   finding means, whether a spec conflict is resolved, and what gets committed is
   never delegated. Agents gather, verify and apply.
5. **Review the finished wave as an external reviewer would review a merge
   request**, against this repository's rules — not as the author. See the checks
   below and [`pr-review.md`](pr-review.md).
6. **Fix every finding inside the same wave.** A finding carried to the next wave
   is a finding nobody will fix.
7. **Update the documentation the wave just made wrong or spent**, in the same
   commit: the specs, the rule rows, the status ledger, and the plan's own
   now-stale chapter. Mark a superseded chapter with a dated pointer; never
   rewrite it. See [`../guidelines/documentation.md`](../guidelines/documentation.md).
8. **Strike the question last.** The decision record first, the rule rows second,
   the question last. See [`open-questions.md`](open-questions.md).
9. **Commit, then push, only after the review and its fixes.** Pushing a wave
   that has not been reviewed makes the review optional, and it then does not
   happen.
10. **Open the request only when every wave is done** and every unblocked
    actionable item is through. State what stays blocked and on what, decider by
    decider. See [`pull-requests.md`](pull-requests.md).

## Before building anything in a wave

- **List the open requests first.** A finding that says "not done" is true of the
  base branch and can be false of an open branch. Reimplementing what an open
  branch already carries costs the work twice, plus the revert.
- **Check who owns a serialised resource.** One migration owner per batch. When
  an open request adds a migration, a second migration from your branch collides
  on the migration journal, so that half of your wave waits. The same holds for
  any generated file with a single index.
- **Verify the premise of every item**, then build. A wrong premise produces
  confident wrong code. State which side of a divergence is stale, and prove it
  from the code.

## The review, and the two checks that catch the most

Run these two mechanically before reading a single line of prose. Both are cheap
and both catch real corruption:

1. **Bag of words per changed line.** For every changed line, the multiset of
   words before must be contained in the multiset after. This proves an
   append-only edit did not silently drop text, and unlike a prefix or substring
   check it survives text legitimately moving inside the line. Every word that
   disappears must be a replacement you intended, and you name it.
2. **Rectangularity of every touched markdown table**, counting cells while
   ignoring escaped pipes. A row that gained a newline, or a cell, breaks the
   table silently.

Then review by hand for what a script cannot see:

- **Did an amendment land in the right cell?** Two tables that look alike rarely
  end in the same column. Prose appended to a column whose values are an enum
  corrupts that column. Name the prose cell of each table shape before you write
  into it.
- **Does every rule id exist?** An agent that cannot find a row must report it,
  never pick the nearest rule.
- **Is any amendment a duplicate** of one written the same day? A register that
  says the same thing twice starts contradicting itself. Replace the duplicate
  with a cross-reference.
- **Read every file an agent wrote that you are about to commit.**
- **Read the agents' declared blockers first.** They are the most valuable lines
  in a report and the least reliable: verify each one rather than accepting it or
  dismissing it.

## Cleaning up is part of the wave, not a later pass

After the wave, the open register and the batch folder hold **only what is
left**. A question whose choice is now in the specs leaves the register. A
residue a wave closed leaves the residues. A count that is now spent is removed,
because a stale count is worth less than no count.
