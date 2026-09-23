<!-- The merge-request body contract lives in
     docs/workflows/pull-requests.md. Three rules govern this file:

     1. A section whose condition is false is DELETED. Never leave it empty and
        never mark it "N/A".
     2. An evidence line that was not produced is omitted, never guessed.
     3. The whole body uses one language — title, prose and section names
        alike. A mixed body is a review finding.

     The section names are stable keys. Translate them once, then keep them.
     Never add an attribution line. -->

_[Who reported the problem, or which wave drives this work, or "noticed while working on X". Where. The scope in one sentence. What this change deliberately does not touch, and where those items wait.]_

**Gate green: [N] suites, [N] tests.** Baseline before the branch: [N] suites, [N] tests. Repository typecheck [green], lint [green].

<!-- Use the line above when one package ran one gate type. Otherwise delete it
     and use the `## Verification` table below, which satisfies both
     requirements at once. Give the baseline only when that earlier result was
     actually captured. Never repeat the current count as the baseline. -->

<!-- Item identification: Form A or Form B, never neither. -->

## [TICKET-000] — [the symptom a user saw, not the diagnosis]

### Cause

_[The file or the configuration responsible. Say so explicitly when the real cause sits deeper than the reported diagnosis.]_

<!-- Per-ticket subsections (Form A), each only when its condition is true:
     ### No widened access — the fix touches a guard, a permission or a scope.
       List every fact you checked. Verified in the system, not assumed.
     ### [N] regression cases pin [what they prove] — a test pins this fix.
     ### Delivered scope: [label] — the ticket is not delivered in full.
     ### Deliberately absent, with the blocking decision for each — one row per
       missing piece. The reason names a decision id, a ticket id or a missing
       input. Never write "out of scope" alone. -->

<!-- Form B replaces the per-ticket headings once the item count passes six, or
     the moment any delivered item has no ticket to name:

## Delivered items

An item is attached to a ticket when an existing ticket covers the same
behaviour. An empty cell means no ticket describes the item: the search ran, it
was not skipped.

| Ticket | Item |
|---|---|
| | | -->

<!-- Other conditional sections, in this order. Delete the ones that do not apply:

     Gate blind spot (paragraph) — the CI gate has a coverage hole this diff's
       risk falls into. Name what the gate never checks, the manual check you ran
       instead, and how far it reached.
     Living trail (paragraph) — a batch document, an ordered queue or a dated
       ledger tracks this work. Link each artifact that exists.
     ## Verification — one row per package per gate, with the exact verdict and
       the exact counts. Replaces the "Gate green" line above as soon as more
       than one package or more than one gate type ran.
     ## Drift fixed in passing — the change makes an existing document, README
       or comment false. Name each one and the wrong line.
     ### The tests do pin [the cause] (mutation testing) — the fix was actually
       re-broken to check its test. Name the exact revert and the exact number of
       cases that failed. Never write this section otherwise.
     ### A trap met on the way, worth knowing
     ## Manual test plan — a checkbox list, one action and its expected result
       per line. Use it when the change is visible to a human and not fully
       covered by tests.
     **Impact radius, read before acceptance testing.** — the change makes
       reachable a surface that was entirely blocked before.
     ## Know before merging — a visible behaviour first, in one sentence, with
       its trigger, and say it belongs in the release notes. Then every migration
       by number, whether it is additive, and whether an existing row needs a
       backfill.
     ## Open arbitrations and what they mean for acceptance testing
     ## Decisions taken during the branch, and what they closed
     ## What is left, and who carries it
     ## External review of the branch — a self-review ran before opening. Name
       the axes, say each finding went to a reviewer assigned to refute it, and
       give the counts raised, refuted and fixed.
     ## After the review (the request id)
     ## Points to arbitrate -->
