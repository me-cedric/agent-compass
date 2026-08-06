# Vale

A configurable linter for prose. It reads Markdown (and other markup), applies
rules you write yourself, and reports violations as `file:line`. It is not a
reviewer and not a code linter: it checks words and document shape, never
meaning, and it has no opinion about whether a statement is true. Treat it the
way you treat ESLint — a floor, not a verdict.

## What it is actually worth in a specification repo

The default reason to reach for Vale — enforcing an English style guide — is the
weakest one. In a repo that carries specifications, the payoff is elsewhere:

- **Imposed vocabulary.** Legal, contractual, or product wording the project is
  not free to change. On one project, outside counsel required a lexical
  requalification: five verbs and noun phrases had to be replaced everywhere the
  product and its documentation addressed the public. Nothing in a code linter
  or a test suite notices a writer reaching for the retired word six months
  later. A `substitution` rule notices, on every file, at no marginal cost.
- **Required structure of normative documents.** A feature spec that omits its
  error messages is not a style problem, it is a spec that will be implemented
  wrong.
- **Identifier formats.** Front-matter ids, cross-reference keys, ticket
  patterns — cheap to state as a regex, tedious to police by eye.

If none of the three applies, skip Vale. See [When not to adopt it](#when-not-to-adopt-it).

## Measure the corpus before you enforce a structure

This is the lesson worth carrying, and it comes from a rule that had to be
rewritten. A structural rule that fails on 100% of the corpus is not a guardrail.
It is a permanently red light, and a team learns to step around a permanently red
light within a week.

The observed case: a single "required sections" rule listing ten sections
produced **49 errors across 49 documents** — every document in scope, including
the directory index, which is not a spec at all. Six of the ten required sections
existed in seven documents or fewer. Meanwhile `## Validation Rules`, present in
45 of 48 documents, was **not** in the required list. The rule described a
template the corpus had never used, and it missed the one section the corpus
actually agreed on.

Two rules follow.

**Measure first, then write the rule.** Count what the documents really contain,
then set the bar at what they already do, then raise it deliberately, one section
at a time, fixing the corpus as you go.

```bash
grep -h '^## ' docs/specs/*.md | sort | uniq -c | sort -rn
```

**One rule per section.** A Vale rule carries one message. Ten section patterns
in one rule means one generic "required section missing" for all ten, and the
author has to diff the document against the template by hand to find out which.
Split them, and name the section in the message.

## Install

```bash
pnpm add -Dw @vvago/vale        # or: npm i -D @vvago/vale / yarn add -D @vvago/vale
```

A repo dependency rather than a global install: the version is pinned in the
lockfile, so every workstation and CI apply the same rules, and a rule set that
passes locally passes in CI for the same reason.

The honest reservation: the npm package does not contain the linter. Its install
script downloads a prebuilt binary for the platform. That means network access at
install time and a supply-chain surface to accept knowingly rather than by
accident. pnpm blocks install scripts by default — the package must be allowed
explicitly (`allowBuilds` in pnpm 11, `onlyBuiltDependencies` before it). If that
trade is unacceptable, install the binary through the OS package manager and drop
the dependency; the config and styles are identical either way.

Declare one script so the check is reproducible without remembering flags:

```jsonc
// package.json
"scripts": {
  "docs:vale": "vale --config=.vale.ini docs"
}
```

## Configuration

**One config per repo.** Two `.vale.ini` files whose globs overlap are two
sources of truth, and the one that runs depends on which command someone typed.

```ini
StylesPath = .vale/styles
MinAlertLevel = warning

# Vocabulary everywhere; structural rules only where a template is actually followed.
[*.md]
BasedOnStyles = House
House.RequiredSectionIntent = NO

[docs/specs/*.md]
House.RequiredSectionIntent = YES
```

Naming a style in `BasedOnStyles` that does not exist on `StylesPath` is a hard
stop (exit 2), not a warning, so enable and disable individual rules rather than
listing a second style you have not created yet.

| Key               | Role                                                                 |
| ----------------- | -------------------------------------------------------------------- |
| `StylesPath`      | Directory holding the style folders, relative to the config file.     |
| `MinAlertLevel`   | Floor for reporting: `suggestion`, `warning`, or `error`.             |
| `[glob]` sections | Scope: structural rules apply to specs, not to every README.          |
| `BasedOnStyles`   | The styles active in that scope. A style absent here **never runs**.  |

That last line is where vendored style packages go to die: downloading Google or
Microsoft into `StylesPath` does nothing until a `BasedOnStyles` names them.
Confirm what is actually loaded with `vale ls-config`.

## The four rule families that pay

| `extends`     | Enforces                          | Typical use                                     |
| ------------- | --------------------------------- | ----------------------------------------------- |
| `substitution`| Imposed vocabulary                | Retired term → agreed term, with the swap shown |
| `existence`   | Forbidden text                    | `TBD`, placeholder wording, malformed ids       |
| `occurrence`  | A count limit within a scope      | A single `H1` per document                      |
| `existence` over `scope: raw` with a negative lookahead | A required section | One rule per section, section named in the message |

`occurrence` counts its token inside **each** instance of its scope, which makes
the obvious "one H1" rule — `scope: heading.h1`, `max: 1`, no token — silently
inert: it asks whether one heading contains more than one heading. It reports
nothing on a document with three H1 headings and reads as a rule that passes.
Count over `scope: raw` with an explicit token instead; the template does.

## When not to adopt it

- **A non-English corpus where style is all you expect.** The shipped Google and
  Microsoft styles are English writing guides. Pointed at prose in another
  language they produce volume, not signal.
- **No constrained vocabulary and no normative document shape.** There is nothing
  to hold; a review does the rest better.
- **Generated documentation.** Fix the generator, not its output.

## Wiring it in

Make it runnable in one command first — `pnpm docs:vale` — and stop there for a
while. Most of the value is that anyone can run the check on demand and that an
agent can run it before handing work back.

A `pre-commit` hook comes second, scoped to staged Markdown so it stays fast; see
[husky.md](husky.md). CI comes last, once the rule set is green, and gated on
`--minAlertLevel=error` so warnings inform without blocking. A check that is red
the day it lands teaches the team to ignore it, which is worse than not having
it. Docs-only changes must run it — see
[workflows/validation-defaults.md](../workflows/validation-defaults.md).

## Template

[`templates/docs-lint/`](../../templates/docs-lint/) ships a commented
[`.vale.ini`](../../templates/docs-lint/.vale.ini) and a starting `House` style:
a substitution rule, a forbidden-terms rule, a single-`H1` rule, and one required
section rule in the correct shape. Copy both `.vale.ini` and `.vale/` to the repo
root, then replace the example vocabulary with the project's own.
