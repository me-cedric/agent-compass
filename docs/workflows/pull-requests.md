# Pull and Merge Requests

Use this when the user asks: "create a PR", "open an MR", or "PR with Alice as
reviewer".

Default base branch: `develop`. Use another base only when the user or repo
configuration says so.

## 1. Preflight

```bash
git status --short
git branch --show-current
git fetch origin
```

Then, on GitHub:

```bash
gh auth status
gh label list
gh api repos/:owner/:repo/contributors --paginate
```

Or, on GitLab:

```bash
glab auth status
glab label list
glab mr list
```

If reviewer is missing, ask for at least one reviewer and show likely choices
from repo contributors. If labels are missing, inspect the forge's label list and
pick only labels that exist. **Never invent a label:** a label that does not
exist makes the command fail.

Helper:

```bash
node docs/agent-compass/scripts/pr.mjs --reviewer <login> --label <existing-label>
```

## 2. Write the body

Start from
[`../../templates/agent/.github/PULL_REQUEST_TEMPLATE.md`](../../templates/agent/.github/PULL_REQUEST_TEMPLATE.md)
on GitHub, or
[`../../templates/gitlab/merge_request_templates/default.md`](../../templates/gitlab/merge_request_templates/default.md)
on GitLab.

### Three rules that govern the whole body

**No fabrication.** Write a section only when its evidence was produced. Omit the
section when the check did not run. Never write a guessed count, a guessed
verdict, or an invented file name. A faked evidence line is worse than a missing
section.

**No duplication.** State each fact once, in the section its first reader needs.
Point to it from elsewhere in one line.

**One language throughout** — title, prose and section names alike. Use the
language the repository declares for its requests and reviews. A mixed body is a
review finding, exactly like language drift in a module README. It happens by
accretion: a body written in one language, then appended to in another. Check
what is already there before you add to it.

Never add an attribution line: no `Co-Authored-By`, no "Generated with", no AI
signature, in a commit, a title, a description or a review comment.

### Always present

**An opening paragraph, with no heading.** Name who reported the problem, or
which wave drives the work, or say it was noticed during unrelated work and name
the file. Say where it was found. State the scope in one sentence. State what the
request deliberately does not touch, and where those items wait — but only when
an excluded item was actually considered and set aside.

**The gate result**, in one of two forms, never none:

- **One bold line**, when a single package ran a single gate type:
  `Gate green: [N] suites, [N] tests. Baseline before the branch: [N] suites, [N] tests. Typecheck [green], lint [green].`
- **A `## Verification` table**, when more than one package or more than one gate
  type ran: one row per package per gate, with the exact verdict and the exact
  counts. This form satisfies both requirements at once.

State the baseline only when that earlier result was actually captured, from CI
history, a prior merge, or a logged run. Omit it otherwise. Never repeat the
current count as the baseline.

**Item identification**, in one of two forms, never none:

- **Form A**, `## <ticket or finding id> — <symptom in one line>`: one heading per
  ticket, naming the symptom a user saw, not the diagnosis. Never merge two
  tickets under one heading.
- **Form B**, `## Delivered items`: a table with columns `Ticket` and `Item`, one
  row per item. State once above it that an empty ticket cell means the search
  found no ticket, not that the search was skipped.

Switch from Form A to Form B once the ticket count passes six, or the moment any
delivered item has no ticket to name.

### Per-ticket subsections, Form A only

Each appears only when its condition holds.

| Subsection | Condition |
| --- | --- |
| `### Cause` | Always, inside a Form A heading. Name the file or the configuration responsible. Say so explicitly when the real cause sits deeper than the reported diagnosis. |
| `### No widened access` | The fix touches a guard, a permission or a scope. List each fact you checked: a role composition, a fail-closed default, a scope query. Never assert it without the list. Verified in the system, not assumed. |
| `### <N> regression cases pin <what they prove>` | A test pins this fix. The heading names what the cases prove. Name each case in one line: the input, and the expected result. |
| `### Delivered scope: <label>` | The ticket's full ask is not delivered. Name the delivered slice. List each respected rule by its id. |
| `### Deliberately absent, with the blocking decision for each` | Any part of the ask is deliberately missing. A table, `\| Absent \| Reason \|`, one row per piece. The reason names a decision id, a ticket id or a missing input. Never write "out of scope" alone. |

### Other conditional sections, in this order

| Section | Condition |
| --- | --- |
| **Gate blind spot** (paragraph) | The CI gate has a coverage hole this diff's risk falls into. Name what the gate never checks, the manual check you ran instead, and how far it reached. A gate that never boots the application is the common case. |
| **Living trail** (paragraph) | A batch document, an ordered queue or a dated ledger tracks the work. Link each artifact that exists. |
| `## Drift fixed in passing` | The change makes an existing document, README or comment false. Name each one, name the wrong line, and say why leaving it wrong would have mattered. |
| `### The tests do pin <the cause> (mutation testing)` | A fix was actually re-broken to check its test. Name the exact revert per fix and the exact number of cases that failed. Never write this section otherwise. |
| `### A trap met on the way, worth knowing` | A real trap blocked you. Name the trap, the file or service, and the way around it. |
| `## Manual test plan` | The change is visible to a human and not fully covered by tests. A checkbox list, one action and its expected result per line. |
| **Impact radius, read before acceptance testing** (bold paragraph) | The change makes reachable a surface that was entirely blocked before. Say what was unreachable and is now reachable, and that acceptance testing must cover more than the named tickets. |
| `## Know before merging` | The merge changes a visible behaviour not covered above, adds a migration, leaves data unmigrated, breaks a consumer, changes what CI can run, or leaves a declared residual limitation. A behaviour a human can observe comes first: one sentence, its trigger, and that it belongs in the release notes. Name every new migration by number, and say whether it is additive and whether an existing row needs a backfill. |
| `## Open arbitrations and what they mean for acceptance testing` | Work arrived mid-branch and stays blocked by an unsettled decision. Link where the blocked items and their owner are tracked. Name each blocked item and what settles it. |
| `## Decisions taken during the branch, and what they closed` | A product or scope decision made mid-branch closed or changed tracked items. State each in one bold sentence, then name every item it closes, narrows or voids. |
| `## What is left, and who carries it` | The request closes a batch and items remain. For a small remainder, group by verdict under its own heading. For a large remainder, state the exact count per bucket and link where each bucket's owner is tracked. Name any item refused rather than guessed: its id, the exact missing input, and who must supply it. |
| `## External review of the branch` | A self-review ran before opening. Name the axes reviewed, say each finding went to a reviewer assigned to refute it, and give the counts raised, refuted and fixed. Give each blocking and each major finding its own bold-led paragraph; bundle the minor ones into one paragraph introduced by their count. |
| `## After the review (<iid>)` | A reviewer's comment on this open request produced a fix. Name the fixing commit, what stayed open, and where the discussion continues. |
| `## Points to arbitrate` | An open decision blocks follow-up work but not this merge. A numbered list naming each decision or ticket id and what it blocks. See [open-questions](open-questions.md). |

A section whose condition is false stays absent. It never appears empty, and
never marked "N/A".

### Scale

| Size | Required |
| --- | --- |
| One ticket, short fix | Opening, the gate result, one Form A heading, plus any subsection whose condition is true |
| 2 to 6 tickets, each with an id | Opening, the gate result, one Form A heading per ticket, `Verification` when more than one gate ran, `Manual test plan` when the change is visible |
| More than 6 items, or any item without a ticket | Opening, the gate result, `Living trail` when tracking exists, Form B, `What is left`, plus any other conditional section whose condition is true |

### The evidence to carry

- validation commands and results
- lint, typecheck, and relevant test status
- docs, spec, module README and env docs sync
- API contract sync for OpenAPI/Scalar, HTTP collection, and Gherkin when
  endpoints or behavior changed — see [`../../skills/api-contract-sync/SKILL.md`](../../skills/api-contract-sync/SKILL.md)
- shared-types consumer validation when shared packages changed
- risks
- labels selected and why

## 3. Create

On GitHub, attribute the request to the requester by assigning self:

```bash
gh pr create --base develop --assignee @me --reviewer <reviewer> \
  --label <label> --title "<title>" --body-file /tmp/pr.md
```

On GitLab:

```bash
me=$(glab api user | jq -r .username)

glab mr create --target-branch develop \
  --title "<type>(<scope>): <description>" \
  --description-file /tmp/mr.md \
  --label "<label1>,<label2>" --assignee "$me" --yes
```

Use multiple `--reviewer` / `--label` flags when the forge needs them.

## 4. Labels and assignee, on creation and on every update

Set labels and the assignee on every request, on creation and on every update.
Add a missing label. Never remove an existing label without an instruction to do
so.

```bash
glab mr update <iid> --label "<label1>,<label2>" --assignee "+$me"
```

**On update, always prefix the assignee with `+`.** A bare `--assignee "$me"`
replaces the whole assignee list and silently drops anyone already assigned.
`--label` on update only adds; removing one needs `--unlabel`, and an
instruction.

Derive the labels mechanically, then stop:

- **One type label**, from the branch's conventional-commit type, or from the
  title prefix when the commits are mixed. Map `feat` to the feature label, `fix`
  to the fix label, `refactor` and `perf` to the enhancement label, `docs` to
  every documentation label the project carries. `test`, `build` and `chore`
  carry none.
- **Then every matching area label**, as the full union of the changed paths. Do
  not stop at the first match, and do not pick only one. Record the
  path-to-label map in the project's own agent contract, because only the project
  knows it.
- **Never apply a judgement label automatically** — severity, `bug`,
  `confirmed`, `design`, `discussion`, `suggestion`, `support`. Each needs
  judgement a diff cannot supply.

## 5. The title and the body are documentation

They go stale exactly like a spec. **Every push that changes what the branch
delivers updates the title and the description in the same change.** Check the
title even when you only touched the body: a title that names the first waves of
a batch survives many commits, because the description gets refreshed and the
title is the one field nobody re-reads. See
[documentation](../guidelines/documentation.md).

## 6. After create

Report the request URL, base, reviewers, labels, validation, and remaining
risks.
