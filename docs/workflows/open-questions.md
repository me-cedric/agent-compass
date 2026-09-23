# Open Questions

One register holds every decision a project waits on. Use this when the user asks
to list the open questions, the blockers, or the decisions to be taken.

## 1. One register, and only one

There is exactly **one** register of open questions, at the path the project
declares — `docs/OPEN-QUESTIONS.md` unless the project says otherwise. Never
create a second one. When the user asks for the questions, update that file.

Produce a separate document only when the user asks for one to send to a named
decider, and make it **a view of the register, never a fork of it**.

### Two mechanisms feed it, and neither competes with it

State this inside the register itself, once, near the top. Without that
paragraph, "the single register" reads as a false claim to anyone who has seen
the other two, and that costs the register its authority.

| Feeder | What it holds | When a line rises into the register |
| --- | --- | --- |
| The per-finding question files of [`../../skills/harvest-questions/SKILL.md`](../../skills/harvest-questions/SKILL.md) | Every open question, risk, assumption, issue and dependency the specifications leave undecided | When it blocks code |
| The clarification markers of a spec corpus, resolved by [`spec-driven-development`](spec-driven-development.md) | Wording a spec left ambiguous | When it blocks code |

## 2. A question leaves the register only after its choice is registered

Write the answer into the decision record first — see
[`decision-records.md`](decision-records.md) — then cascade it into the affected
specification rule rows, and **only then** strike the question. Striking it first
loses the decision.

Record an amendment inside a rule row as `**Amended on <date>** (decision
<source>)`, then the amendment. **Name the real source.** Attributing a decision
to someone who did not make it is worse than leaving it unattributed.

## 3. The structure is a template, not a guideline

A register that invents its own layout each time stops being comparable across
two dates, which is the one thing a register is for.

1. `# Open questions` — an H1, alone on its line.
2. **One bold sentence carrying both totals**, nothing else in it:
   `**<N> actions are blocked. They wait on <M> decisions.**` When the action
   counts no longer exist, say so in that same position and say why. Never drop
   the sentence, and never leave a number you cannot defend.
3. The self-containment paragraph: the document reads alone, each decision is one
   question with its options and what it unblocks, no outside knowledge needed.
4. The definition of a blocked action: not an unstarted action, but one whose
   code cannot be written until the decision, because a different choice gives
   different code.
5. `State at <date>.`
6. `---`
7. `## Who must decide`, then a table with the header
   `| Decider | Decisions | Actions unblocked |` and the alignment row
   `|---|--:|--:|`. Numeric columns are right-aligned; that alignment row is part
   of the format. The last row is `| **Total** | **<M>** | **<N>** |`, and the
   total equals the sum of the rows above it.
8. `---`
9. `## The decisions, from the most unblocking to the least`, then a table with
   the header `| # | Decision | Decider | Actions |` and the alignment row
   `|--:|---|---|--:|`, **sorted strictly descending by `Actions`**. The `#` is a
   rank, not a stable id: it moves when counts move.
10. `---`
11. One section per decision, in that same order, each separated by `---`:

```text
## 1. <the question, byte-identical to its row in the index table>

**Decider:** <role> · **Concerns:** <personas, comma-separated> · **Unblocks:** <N> actions

**Options**

1. <a complete configuration a decider could approve as-is> *(recommended)*
2. <a second complete configuration>
3. <a third complete configuration>

**What is blocked today**

- <one user-visible consequence>
- <one user-visible consequence>
```

Details of that block that are not optional, because they are what makes two
registers diffable:

- The metadata line is **one line**, with ` · ` (space, U+00B7, space) between
  its three fields.
- **Three options.** Each is a whole configuration, never a single missing
  parameter. **Exactly one** carries the recommendation marker, at the very end
  of its line, italic and parenthesised. **Always recommend.** Option 2 is
  usually the cheaper trade and option 3 the do-nothing, so the decider sees the
  shape of the space and not a single proposal.
- The blocked bullets use `- `, one per blocked action, and **their count equals
  the `N` of the metadata line and of the index row**.

**The three counts must agree** for every decision: the index row's `Actions`
cell, the metadata line's `Unblocks`, and the number of bullets. A register whose
arithmetic disagrees stops being trusted, and nobody tells you; they just stop
reading it.

## 4. Writing constraints

- The register is written in the language its deciders read, throughout.
- **Never put a code identifier, a rule id, a field name, an HTTP status, or a
  file path inside a question, an option, or a blocked bullet.** Business
  language only. The decider does not read the codebase. Those identifiers belong
  in the decision record and in the specification rule row, which is where the
  developer reads.
- A blocked bullet names a **user-visible consequence** — what a named persona
  cannot do, or what nobody is told — never a technical gap. "The candidate sees
  neither the reason nor the end date of the suspension", not "the reason column
  is absent".
- One bullet is one sentence, and it ends with a full stop.
- A question may bundle sub-questions, but stays **one interrogative sentence
  ending in a question mark**. It is long on purpose: a decider must see the
  whole of what they are answering.
- Never abbreviate a persona to its code inside a question, an option or a
  bullet.

## 5. Residues, and counts you do not have

A partial answer leaves a narrower question, which is **not** a decision and must
not be dressed as one: it has no three options, because the answer already
removed most of the space. Put those after the decisions, under
`# Residues: what a partial answer left open`, in a table with the header
`| Question to decide | Decider | What it blocks | Origin |`.

A residue carries **no action count**: a partial answer leaves named work, not a
sized lot. Never invent a number to fill a column.

**Name the origin of every residue**, so nobody re-asks a question already asked,
and so a reader can tell a question that has waited three weeks from one raised
this morning.

## 6. Provisional copy is a question

User-facing copy written because no arbitrated text existed is an open question,
even when the code ships. Mark it in the code **and** add it to the register, in
a table after the residues, headed `## Copy written in the meantime, to validate`
with the columns `| Copy | Where | Decider |`. A marker in the code is invisible
to the person who must arbitrate it.

## 7. Before you save

Run the four checks. Three are arithmetic, so run them as a script and never by
eye:

1. The `Who must decide` total equals the sum of its rows, and the opening
   sentence agrees with it.
2. Every decision's three counts agree.
3. The index table is sorted strictly descending by `Actions`, and the ranks run
   1..N in order.
4. Every question, option and bullet is free of code identifiers and file paths.

Copy [`../../templates/questions/check-questions.mjs`](../../templates/questions/check-questions.mjs)
into the project, translate its `LABELS` block into the register's language, set
its ticket and rule prefixes, and wire it into the project's gate. It is
dependency-free and it fails on each check separately.

## 8. Retiring a superseded register

A superseded register goes through **three states, in this order**. Skipping a
state loses something, and the something is different each time.

1. **Pointer.** Replace the content with a short file naming where each part
   went. Do this the moment the register stops being live, because tickets and
   request descriptions cite these paths, and a 404 tells the reader nothing.
2. **Deleted, once the pointer has no readers.** A pointer is not permanent
   furniture. Delete it when **no file in the repository still links the path**,
   and only then — check with a real search, not from memory. Repoint every
   inbound link first; a deletion that leaves dangling links has moved the mess
   rather than cleared it. The git history is the recovery path, so name the
   retiring commit in the message.
3. **Never deleted: the verbatim archive.** A file holding answers as they were
   written stays, with a banner saying it is not the register. It is the only
   place a question and its answer read together after the question leaves the
   register, and it is what protects an answer from being quietly reworded later.

**When an answer arrives**, write it into the *archived copy*, immediately under
the question's heading and before the metadata line, prefixed with the answerer's
initials and a colon, and leave it verbatim, including its typos. The live
register does not carry answers at all: the question leaves it.

**What may be deleted outright**, with no pointer state, once its content lives
in a spec, a rule row, the decision record, the plan or this register: a
per-requirement ledger, a feature-by-feature dump, an endpoint inventory, a batch
or progress record, a duration estimate. These are working material. Keeping them
costs more than it saves, because a reader cannot tell a spent count from a live
one, and a stale count is worse than an absent one.

**The test, applied file by file:** does this file hold a fact, an origin or a
decision trail that exists nowhere else? Name the fact. "It has historical value"
is not an answer. If the answer is no, the file is weight.

**One caveat you cannot check from inside the repository.** A ticket outside it
may link a path you delete. State that when you delete, so the person who owns
the tickets can decide whether to fix the links.
