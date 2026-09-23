---
name: progress-audit
description: >
  Audit how much of a project is actually built by diffing its specs, functional
  docs, and requirement registers against the real code into an honest, verified
  progress matrix (per feature/subfeature and global). Use when asked how far
  along a project is, what's left, percent complete, a progress or
  status/completion report, or to "compare the specs to the code". Use it also to
  refresh an audit that already ran — "what changed since last time", "update the
  audit", "re-run the audit" — because it re-audits only what moved and carries
  the rest forward with its origin date. Run it before you estimate remaining
  work, because its per-requirement rows are the source of every percentage.
risk_level: low
writes_files: false
requires_tools: []
---

# Progress Audit

Measure what is *delivered*, not what is *reported*. The output is a per-feature
progress matrix plus a global verdict, honest enough to plan against.

## When to use

- "How far along are we / what's left / are we on track?"
- A progress, status, or completion report across a whole project or domain.
- Comparing specs / functional docs / requirements to the code actually on a branch.
- Before scoping remaining work (feeds `completion-plan`).

## Method

1. **Map the requirement sources.** Enumerate the specs, functional docs,
   requirement registers, and any priority/sequencing tiers. This is the
   denominator — what *should* exist.
2. **Map the code.** Enumerate the real modules, routes/endpoints, jobs, tables,
   and UI screens on the target branch. Split backend vs frontend explicitly.
3. **Diff per feature/subfeature.** For each capability the spec requires, find
   and read the actual code. Rate done / partial / skeleton / gap / gated, with
   an honest percent, concrete file-path evidence, and what's missing.
4. **Roll up** to per-domain and global figures, and to a layered verdict (e.g.
   backend vs frontend vs governance) — a single average hides imbalance.

## Verify, don't trust

- A capability is **done** only when it is wired and tested — not because a
  status doc, a task checkbox, a type, or a schema-only table exists. See the
  `verified-progress-signal` instinct.
- Distinguish **gap** (simply unbuilt) from **gated** (blocked on a
  decision/credential) — they need different follow-up.
- Separate **backend** from **frontend**: an API with no screen is not a
  delivered feature.

## Run at scale

For anything beyond a few features, fan out **one sub-agent per feature/domain**
returning a **structured schema** (id, status, percent, evidence, gaps), then run
an **adversarial verification pass** that tries to *refute* every "done"/high
claim by opening the cited files. Reconcile assessor vs verifier before rolling
up. Deterministic orchestration (a workflow) keeps it repeatable.

## Output

- A per-feature/subfeature matrix: status, percent, evidence, gaps, gated items.
- Per-domain rollup + global figure + a layered honest verdict.
- Optionally reconcile against any existing status doc and explain divergences.
- Feed the result into `completion-plan` to scope the remaining work.

**One machine-readable row per requirement is the deliverable** — a CSV or a JSON
line with the requirement id, its status, its `file:line` evidence, what is
missing, and the date the verdict was established. The readable report is a view
of those rows. Every percentage, every remaining-work estimate and every backlog
item comes from that artifact, so `completion-plan` reads the rows, never the
prose.

Keep a small state file beside the rows: the commit and the date of this run. The
next refresh needs it. Without it, the next run audits the whole corpus again.

## Refresh an audit that already ran

A full audit is expensive. Re-running it whole for every progress question wastes
most of that cost, because most requirements did not move. **Re-audit only what
the diff made doubtful, and carry every other row forward unchanged, with its
original date.**

### Scope at the requirement, never at the document

| Trigger | What returns to scope |
| --- | --- |
| The requirement's text changed | that requirement |
| A requirement was added | that requirement |
| A file cited in that requirement's evidence changed | that requirement |
| New code appeared that no requirement cites | a discovery pass (below) |

**Warn on the pivot files.** A file that many requirements cite — an application
module, a router, a shared schema — puts hundreds of settled requirements back in
scope when it changes, for a reason as small as registering a module. Scope at the
requirement and name the pivot file in the plan, so an inflated scope is
explainable rather than mysterious.

### The discovery pass is not optional

A requirement rated **gap** carries no evidence, so no file links it to anything.
New code that finally implements it changes no cited file, so the trigger table
above never fires and the requirement stays `gap` for ever. The report drifts
into false pessimism, silently.

So group the added files that nothing cites into clusters by directory, and for
each cluster run one agent with the `gap` requirements of the features already
associated with that directory. Ask it one question: *does this code implement any
of these requirements?* Whatever it names joins the scope of the run.

### Price the run, then wait for a yes

A refresh can cost two agents or ninety, from the same request. Compute the scope
first, state it in one line with what it buys, and **wait for an explicit go
before the fan-out**:

> 26 features touched, 221 requirements back in scope — about 52 agents, 20
> minutes. Shall I run it?

Three cases where you do not launch:

- **Nothing in scope.** Say so and stop. Never spend agents to confirm that
  nothing moved.
- **A wide scope.** Offer to narrow it first — one domain, or the most-touched
  features. A partial refresh that the user chose beats a full run they did not,
  and the carried-forward rows keep their origin date cleanly.
- **The user only wants the current figure.** The last run's rows are on disk.
  Answer from them, date the figure, and offer the refresh instead of imposing
  it.

### Rebuild the denominator deterministically

Re-extract the requirements with a script, not an agent, and compare the total
against the last known count. **An unexpected delta means the extractor broke,
not that the number moved.** Read the extraction traps below before you "fix" the
extractor.

Give each agent the current map of the code — routes, tables, queues, screens —
so it does not re-derive it. Refresh that map before the fan-out when the diff
touched any of those. A stale map makes agents hallucinate with confidence.

Each brief carries the requirement's **previous verdict**, and says in writing
that the verdict is a starting point to confirm or refute, never an answer to
copy.

### Guardrails that stay mechanical

- **A verifier may only lower a status**, never raise one.
- **A positive claim with no `file:line` evidence falls back to `gap`.**
- **Open every cited `file:line` after the run.** A broken reference on a `done`
  row means the claim was never verified. Reopen it.
- **Never aggregate with holes.** An agent that returned no row for a requirement
  leaves it `not_audited`; count it as audited and the score lies. Re-run the
  missing agents first.
- **Snapshot the state before you publish anything dated.** A publisher that
  reads its date and commit from the state file publishes the *previous* run's
  date over the *current* run's numbers, and nothing in the page says so. Verify
  the date in the published artifact afterwards.
- A broken fan-out is not lost work. Resume it, and harvest from the run journal
  rather than from a return value.

### Report the movement, not only the state

The user already knows roughly where the project stands. What they cannot get
anywhere else is the delta: *"14 requirements re-audited, 6 advances, 1
regression, 36% → 38%."*

Always separate fresh rows from carried-forward rows. A score whose rows are
three months old does not mean what a freshly established one means. State both
counts.

Restate the limits every run, because they do not go away: this is static
analysis — neither the application nor the tests run — and only positive claims
are attacked, so the audit is armoured against false positives and **not** against
false negatives.

## Requirement-extraction traps

These make a naive denominator wrong. Each one has produced a false count in a
real corpus. Check them when you write the extractor, and re-read them before you
change it — several of these behaviours look like bugs and are deliberate.

| Trap | What to do |
| --- | --- |
| **A duplicate id inside one file is a redefinition, not a repetition.** A later section restates the requirement from a newer source. | One id is one requirement. Keep the first position and treat the later text as authoritative. Counting both inflates the denominator. |
| **More than one id prefix family.** A corpus grown over time carries two or three. | Match every family. A pattern written for one loses the rest of the corpus. |
| **Requirements live after the main tables**, in appendix or addendum sections, sometimes with their own id family. | Never reason by section. Take every table row whose first cell is a valid id. A field-catalogue table then excludes itself, because its first cell is a column name. |
| **The id prefix does not match the file it lives in**, and a frontmatter id can be wrong too. | Never attach a requirement to a document by its prefix. Only the file of origin is authoritative. |
| **Lower-case suffixes** on requirements inserted without renumbering (`-004b`, `-004c`). | Accept them. An upper-case-only pattern drops them silently. |
| **"Out of scope" in prose usually qualifies a sub-requirement**, not the document. | Exclude only on a structured marker — a frontmatter tag or the title. Excluding on prose removes whole features wrongly. |

**Sources that must not serve as the denominator:** a mapping file nobody
maintains, task checkboxes (most files have none, so the ratio underestimates
massively), an inventory whose own header disagrees with its own tables, and a
directory holding only a template that cites a requirement id that does not
exist.

**A status document that disagrees is usually not wrong.** It defines
"implemented" its own way — often purely backend — while this audit measures
conformance to requirements that describe screens and user gestures. Restate the
vocabulary gap in the report rather than picking a winner.
