<!-- The body contract is in the pr-flow skill (references/body.md). Three rules:
     1. Delete a section whose condition is false. Never leave it empty. Never write "N/A".
     2. Omit an evidence line that was not produced. Never guess a count.
     3. One language for the title, the prose and the section names. No attribution line. -->

_[Who reported the problem, or which work drives this change. Where. The scope in one sentence. What this change deliberately does not touch, when an item was set aside.]_

**Gate green: [N] suites, [N] tests.** Typecheck green, lint green.

<!-- Use a `## Verification` table instead when more than one package or gate type ran. -->

## [TICKET-000] — [the symptom a user saw]

### Cause

_[The file or the configuration responsible.]_

<!-- Conditional sections, in this order. Delete the ones that do not apply:
     ### No widened access · ### [N] regression cases pin [what] · ### Delivered scope: [label]
     ### Deliberately absent · ## Contract sync · ## Drift fixed in passing · ## Manual test plan
     ## Know before merging · ## Points to arbitrate
     More than 6 items, or an item without a ticket: replace the ticket sections with a
     `## Delivered items` table (Ticket, Item). -->
