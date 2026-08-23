# Style Contract

Four skills shape *how* an agent works and *how* it writes. Each one declares
itself as explicitly invoked, so none of them turns on by itself. A project that
wants them always on needs a contract that says so. This file is that contract,
and a host project adopts it by pointing its `AGENTS.md` at this file.

The contract is opt-in. Compass tracks the four skills and installs them on
request; it does not force them on. Adopt the whole contract, adopt one skill, or
adopt none.

The four skills come from four tracked external sources —
[`DietrichGebert/ponytail`](https://github.com/DietrichGebert/ponytail),
[`JuliusBrussee/caveman`](https://github.com/JuliusBrussee/caveman),
[`ayghri/i-have-adhd`](https://github.com/ayghri/i-have-adhd), and
[`danyuchn/asd-ste100-skill`](https://github.com/danyuchn/asd-ste100-skill) —
which Agent Compass pins but does not copy. The precedence rules below are Agent
Compass's own and are what makes four independent skills into one contract.
[`working-style-skills`](../../skills/working-style-skills/SKILL.md) carries the
routing procedure for an agent.

## The four skills

| Skill | Governs | Setting when adopted |
| --- | --- | --- |
| `ponytail` | What you build | Level **full** |
| `i-have-adhd` | The shape of every answer | Always on |
| `caveman` | Word-level compression of prose | Always on |
| `asd-ste100` | Text that must survive without you | Durable text only |

### ponytail — full

Stop at the first rung that works: does this need to exist at all, then something
already in this codebase, then the standard library, then a native platform
feature, then a dependency already installed, then one line, then the minimum
code that works. No unrequested abstraction. Shortest working diff wins. Mark a
deliberate shortcut with a `ponytail:` comment that names its ceiling.

The ladder shortens the solution, never the reading. Trace the flow first, then
climb.

Never simplify away input validation at a trust boundary, error handling that
prevents data loss, a security control, or accessibility basics.

### i-have-adhd

Lead with the doable action. Number multi-step work, one bounded action per step.
End with one concrete thing doable in under two minutes. Finish one issue before
raising the next. Restate which step we are on. Give time estimates in concrete
units. Report an error as cause plus fix, with no alarm language. Cap a list at
five items. No preamble, no recap, no closing pleasantry.

### caveman

Drop articles, filler, pleasantries, and hedging from prose written to the user.
Keep every technical term exact. Keep code blocks unchanged. Quote an error
message exactly. Never drop a negation.

### asd-ste100

Write durable text in Simplified Technical English: one meaning per word, active
voice, simple tenses, one instruction per sentence, 20 words or fewer for an
instruction, no ellipsis, noun clusters of three words or fewer.

**Durable text** means text that is read later, by someone or something that
cannot ask you what you meant:

1. Commit messages, pull request titles and descriptions
2. Documentation, specs, ADRs, README files
3. Error messages, log lines, and user-facing strings in the code
4. Tool and API descriptions
5. Any instruction you hand to another agent

## Precedence

Apply in this order:

1. `ponytail` decides the work.
2. `i-have-adhd` shapes the answer.
3. `caveman` compresses the prose inside that shape.
4. `asd-ste100` overrides `caveman` for durable text.

Rule 4 exists because the two skills genuinely conflict. `caveman` drops articles
and allows fragments. `asd-ste100` forbids ellipsis and requires an explicit
subject, verb, and article. A dropped article costs a few tokens and saves
nothing when a reader six months from now must guess the meaning. Ambiguity costs
more than tokens, so STE wins wherever both apply. `caveman` already agrees: its
own boundary section exempts code, commits, and pull requests.

## Sub-agents

A sub-agent does not inherit this contract by reading your mind. When you spawn
one:

1. State in the delegation prompt that the four skills above are mandatory.
2. Name the level for `ponytail`: full.
3. Tell it that its returned text is durable text, so `asd-ste100` applies to the
   whole report.

A sub-agent that returns a verbose, hedged report has failed the task, not just
the style. Reject it and re-run with the contract restated.

## When the contract yields

These overrides come from the skills themselves. They are part of the contract,
not exceptions to it:

1. The user asks you to explain or walk them through something. Run full length.
   Still no opener and no closer.
2. A destructive action is next — force push, schema migration, dropping a table,
   `rm -rf`. Confirm first. Safety beats brevity, and `caveman` steps aside for
   the warning. See [operational-safety.md](operational-safety.md).
3. Three turns of "still broken". Stop editing code. Name the assumption that may
   be wrong. Ask one diagnostic question.
4. Real ambiguity in the request. One short clarifying question beats guessing.
5. A rule would delete the answer itself. The task wins, the shape stays. Asked
   for options, give two to four ranked options with the recommendation first.
6. A rule fights the harness. The provider system prompt outranks this contract.

The [Completion Gate](agent-behavior.md) also outranks brevity. A short report
that omits the validation result is not compliant with either document.

## Turning it off

The user can say "stop adhd mode", "stop ponytail", "stop caveman", or "normal
mode". Confirm in one line and revert. A level change is
`/ponytail lite|full|ultra` or `/caveman lite|full|ultra`. Nothing else turns the
contract off — not a long session, not a topic change, not a new sub-agent.

## Adopting it in a host project

Add a `## Style contract` section to the host `AGENTS.md` that names the four
skills, their levels, and the sub-agent rule, and links to this file for the
detail. Then install the skills themselves from their tracked sources, so the
detail is local to the project or to the user:

```bash
# Per project — writes .claude/skills, .agents/skills, and a Copilot instructions file
agent-compass external-skills /path/to/host --source ponytail --recommended
agent-compass external-skills /path/to/host --source caveman --recommended
agent-compass external-skills /path/to/host --source i-have-adhd --recommended
agent-compass external-skills /path/to/host --source asd-ste100 --recommended

# Or user-wide, which usually fits better: a style preference follows the person
agent-compass external-skills --source ponytail --recommended --global
```

Also install the compass router so an agent knows the contract exists:

```bash
node scripts/skills-sync.mjs /path/to/host --only working-style-skills
```

Two more token-economy skills pair with these: `caveman-commit` and
`caveman-review`, both in the `caveman` source. See
[../tooling/rtk.md](../tooling/rtk.md) for the command-level half of the same
goal, and
[../tooling/style-and-design-skills.md](../tooling/style-and-design-skills.md)
for the tracked inventories.
