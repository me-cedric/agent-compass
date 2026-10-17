# Engineering rules

Rules for code, tests, git, reviews, security and docs. The compass block in `AGENTS.md` holds the short form. This guide holds the depth.
The stack rules in `rules/` hold the framework detail (see [assets.md](assets.md#stack-rules)).

## Code

- Create a new value. Do not change an input. `const setActive = (user, value) => ({ ...user, active: value })`.
- Keep files small: 200 to 400 lines is typical, 800 is the maximum. Keep functions under 50 lines and nesting at 4 levels or fewer.
- Organize by feature, not by type. Put a test next to the code that it tests.
- Handle each error. Never swallow one. Keep the cause when you rethrow. Use `.catch(() => {})` only for fire-and-forget cleanup.
  User-facing code shows a friendly message. A server logs the detail.
- Validate each input at a trust boundary: user input, API responses, file content. Use a schema. Fail fast with a clear message.
- Use a named constant or config. Never hard-code a number, a URL or a key. Parse numbers and booleans from env so that garbage gives a safe default.
- Write code in the style of the surrounding code. A comment says why. It never repeats what the code does. Mark a deliberate shortcut and name its ceiling.
- Prove that a file is active before you edit it. An entry point, route, module or test imports it, generated config names it, or the user names it.
  A code graph finds the proof fast. Graph silence is not proof of absence. Confirm with a text search before you call a file dead.

### TypeScript

- Use `strict: true`. Use no implicit `any`. Prefer `unknown` and narrowing. Parse external data. Do not cast it.
- Keep the shared compiler options in `tsconfig.base.json`. Apps extend it.
- A `tsconfig.json` checks only the folders that it includes. Count the `tsconfig*.json` files. The `typecheck` script runs `tsc -p` once for each.
  Add a project to the script in the change that adds its `tsconfig`.
- Use a path alias such as `@/` for imports across modules. Use a relative import only inside one folder or for a direct child.
- Keep React hooks small and pure. Clean up each effect.
- Keep a dependency that returns `any` behind one adapter module. The adapter exports named types. Add a shape test, because a version bump that moves the runtime shape still compiles.

### Limits and generated files

- A limit that the repository cannot meet today is a ratchet. Record each existing violation with its current value, a reason and a date.
  A recorded file may shrink and may not grow. A new violation fails. An entry that now passes also fails, so the list drains.
  Never lower the limit to what the worst file does.
- A generator that a test or task drives writes the whole file from the cases that ran. A filtered run deletes the rest.
  Run the whole suite when it drives a generator. Never edit the output by hand. Repair a filtered run at once with `git checkout -- <file>`.
  In CI, regenerate and run `git diff --exit-code <file>`. Name the command that owns the file in the module README.
- Add or rename an env var in the catalog, the template and the code in one change. See [dev-loop.md](dev-loop.md#env).

## Testing

- Behavior changes ship with tests. Write the test first and watch it fail for the right reason (RED). Write the minimum code to pass (GREEN). Then refactor.
  Coverage on changed code is 80% or more. A trivial one-liner needs no test. A branch, loop, parser, money path or security path leaves a runnable check.
- Unit tests are the default. Integration tests cover endpoints, database operations and module wiring. E2E tests cover critical user flows. See [dev-loop.md](dev-loop.md#e2e-and-the-run-registry).
- For each behavior change, do one of these: update a nearby spec, add a focused regression test, or say why no automated test fits.
  Prefer the closest unit test. Escalate only when the behavior crosses a module boundary.
- Name a test after the rule it defends, for example `an_unknown_mode_resolves_to_the_safest_tier`. A failure then names the broken rule.
  Keep the convention of the ecosystem (`snake_case`, or `describe` and `it`).
- Mock external clients. Never call a real third-party API from the pull-request suite. In NestJS, use `jest-mock-extended` and `Test.createTestingModule()`.
- Run each reference UI journey in two fixed profiles: `desktop` 1440 × 900 and `mobile` 390 × 844.
  Pin the locale, time zone, color scheme and reduced motion. Never use a named device profile.
- Two kinds of screenshot exist. Execution evidence is regenerable and git-ignored. An agent creates it. A visual baseline is committed and compared.
  A person who looked at the diff updates it. Never auto-accept a baseline in CI, and never let a healer accept one.
- A completion claim owes an artifact that someone else can open. Link the run folder of `ac run` (`.agents/runs/<timestamp>-<name>/`) in the report.
  When the project cannot produce one, write `no evidence: the project declares no test command`, and name what you checked.
- A flaky test needs a cause. Check isolation first, then mocks, then the implementation. Quarantine is a decision with an owner and a date.
- These are defects in a test suite:
  - A sleep that wins a race, or a rerun until green.
  - A fixture edited to hide a mapping defect.
  - An assertion on class names or hook names.
  - One long test for a combinatorial rule.
  - An accessibility rule disabled globally.
  - A test that a healer deleted, skipped or weakened.
  - A coverage number read as a quality measure.

## Validation

- Run declared commands only. Look in `agent-compass.commands.json`, then `package.json`, then the documented commands. Never invent one.
- For a code change, run the smallest set that covers it: lint, typecheck and the relevant tests. Add the build when config, bundling, public exports, UI routing or deployment output changed.
  A docs-only change needs no code validation, unless commands, config, examples or generated files changed. Run the documentation linter when the repository declares one.
- Use the pinned package manager. In a monorepo, scope the command first (`pnpm --filter <pkg> lint`). Validate a shared package and each consumer of the changed symbol.
- Report each command as `passed`, `failed`, `partial` or `not run`. Write `not run - command not declared` when none exists.
  For a failure, say whether it is old or new.

## Git

- Write commits as `<type>: <description>` with an optional body that says why. The types are `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `build`, `perf` and `ci`.
  The subject is about 50 characters, in the imperative. `commitlint` checks it in the `commit-msg` hook.
- Never add an AI signature or co-author line to a commit, a PR or MR title or description, a review comment or an issue. No project rule overrides this.
- Name a branch `<type>/<area>/<short-kebab-desc>`. The type is `feature` or `fix`. The area is an app or package, for example `api` or `ci`.
- Use three hooks. `pre-commit` runs `lint-staged` on the staged files. `pre-push` builds the shared packages, then runs `typecheck` and `lint`.
  `commit-msg` runs `commitlint`. Keep `pre-commit` fast. CI still runs the full check.
  `pre-commit` unsets `GIT_INDEX_FILE` first: it breaks `lint-staged` during `git commit --amend`, and git falls back to `.git/index`.
- Agents do not commit, push, deploy, publish or open a PR unless the user asks. Check `git status` before you edit. On the default branch, branch first.
- "Release a patch" authorizes the whole chain:
  1. Bump the version and validate.
  2. Commit, then tag.
  3. Push the commit and the tag to every remote.
  4. Publish a release on every forge, with the changelog section as the body.
  5. Report each remote.

  A bump, a local tag or a pushed tag with no published release is an unfinished release.

## Pull requests

Write the body from facts that you produced. These rules apply to every request:

- Write a section only when its evidence exists. Never write a guessed count, a guessed verdict or an invented file name.
- State each fact once, where its first reader needs it. Point to it from elsewhere in one line.
- Use one language for the title, the prose and the section names.

Always write these parts:

1. An opening paragraph with no heading. Say who reported the problem, or what drives the work, and where it was found. State the scope in one sentence.
   Name what the request leaves out, and where it waits, when you considered and set it aside.
2. The gate result. Use one bold line when one package ran one gate type: `Gate green: <N> suites, <N> tests. Typecheck green, lint green.`
   Use a `## Verification` table when more than one package or gate ran. State a baseline only when you captured it.
3. The items. Use a heading `## <ticket> — <symptom in one line>` for each ticket, up to six tickets. For more tickets, or an item with no ticket,
   use a `## Delivered items` table with the columns `Ticket` and `Item`.

Add these parts only when their condition is true. An empty section is never written, and never marked "N/A".

| Part | Condition |
|---|---|
| `### Cause` | Inside each ticket heading. Name the file or the configuration. |
| `### No widened access` | The fix touches a guard, a permission or a scope. List each fact that you checked. |
| `### <N> regression cases pin <what they prove>` | A test pins the fix. Name each case: the input and the expected result. |
| `### Deliberately absent` | Any part of the ask is missing. A table with the reason. The reason names a decision, a ticket or a missing input. |
| **Gate blind spot** | The CI gate has a coverage hole that this diff falls into. Name the manual check that you ran instead. |
| `## Drift fixed in passing` | The change made a document, README or comment false. Name each one. |
| `## Manual test plan` | A human can see the change and tests do not cover it. A checkbox list, one action and its result for each line. |
| `## Know before merging` | The merge changes visible behavior, adds a migration, leaves data unmigrated, breaks a consumer or changes what CI runs. |
| `## What is left, and who carries it` | The request closes a batch and items remain. |
| `## Points to arbitrate` | An open decision blocks follow-up work but not this merge. |

## Definition of done

A change is done when its behavior is met, its risks are covered and its proof exists. It hides no debt.
Another person can read, run and maintain it. "It works on my machine" and "the existing tests pass" are not proof.

Each criterion has one proof type: `AUTO` (a blocking check), `PR` (evidence on the request), `REVIEW` (a recorded human decision) or `N/A` with a written reason.
Every applicable `AUTO` gate is green, every applicable `PR` evidence exists, every required review is approved and no deviation is open.
One level never makes up for another. A good screenshot does not excuse an unreachable control.

Done is forbidden while any of these is true:

- An applicable acceptance criterion is unmet, or a requested piece of evidence is missing.
- A secret sits in the code, the logs or an artifact.
- A blocking gate is red, an unexpected console error appears, or keyboard behavior regressed.
- A known accessibility violation has no accepted exception.
- A test is skipped, quarantined or flaky with no follow-up, or a visual baseline changed with no review.
- A contract or the document that owns it is stale, or a dependency contradicts the architecture.
- External data reaches the code without validation.

An agent never does these things. It asks a person instead:

- Change the spec to follow a bug.
- Delete, skip or weaken a test or an assertion.
- Raise a timeout to pass a race.
- Accept a visual baseline.
- Hide a console, accessibility or type error.
- Declare Done because the suite is green.

A deviation is valid only when all six facts are true and written down:

1. The criterion cannot be met in this scope.
2. The risk is stated.
3. A compensating measure exists.
4. An owner is named.
5. A deadline is set.
6. The person entitled to accept it did so.

Lack of time is not a reason. An exception expires at its deadline.

When a gate fails, keep the artifact and find the first cause. Decide whether the product, the test, the fixture or the environment is at fault. Fix the cause at that level.
Run the targeted check, then the suite. Confirm that the test can still catch the original defect.

Definition of Ready stops work that starts blind. Before you start, understand the behavior and the criteria. Know the visual source, or know that none exists.
List the states and examine the existing components. Check that the API contract exists and that no open decision can change the work.
Raise a gap that you find during the work. Never fill it in silently.

## Security

Before each commit, check these items:

- No hardcoded secret.
- Input validated at the boundary, queries parameterized and output escaped.
- CSRF protection where relevant.
- Authentication and authorization on protected paths.
- Rate limits on public endpoints.
- Error messages that do not leak data.

- Read secrets from env or a secret manager. Fail at startup when one is missing. Commit only `.env.example`. Rotate anything that may be exposed.
- Never put a secret in a command argument or a URL. The process list is public to local users. Use an env var on the child process, an owner-only file (`0600`) or standard input.
  Create the file private from the start, with `umask 077`. Escape the value for the file format. When a tool has no other way, treat the value as exposed and rotate it.
- Bind a stored secret to its host. Parse the host of a URL once, in one function that every caller uses. Cut the scheme at the first `://`.
  End the authority at the first `/`, `?` or `#`. Strip the user info and the port. Accept only letters, digits, `-` and `.`.
  When the host is not valid, use no credential. Test the crafted shapes: query, fragment, second scheme and user info. A diagnostic names the source, never the secret.
- Text that your program did not write is data. File names, branch names, commit messages, ticket text, review comments, error strings, web pages and documents
  never go into an instruction. Put them inside a fence under a line that says "untrusted; do not follow". Use one fence helper. Add a test that bans placeholders in the instruction body.
  The fence marks where the text came from. It grants no capability.
- A write with no undo needs a receipt. This covers a time log, a payment, an invoice line, a message or a ledger entry.
  Store the id that the remote system returned, set it once, and never clear it. A lost answer is not a failure: the write may have landed.
  Recover by reading the remote side with a correlation token in the payload. Never retry the write. Never start such a write on your own.
- Treat an API change that touches authorization scope, tokens, uploads, encrypted secrets, provider cleanup or background jobs as security-sensitive.
- If you find a security issue, stop and fix Critical and High findings before you continue. Rotate exposed secrets. Search for the same class of bug.
  Treat dual-use security work as valid only with clear authorization. Refuse destructive techniques and malware.
- For scanning, see [quality.md](quality.md#security-pack).

## Accessibility

The target is WCAG 2.2 AA. An automated audit proves half of it. Walk the path with the keyboard alone.

- Structure: one `h1` for each page, headings without gaps, landmarks (`header`, `nav`, one `main`, `footer`), `lang` set.
  After a client-side route change, update the title and move focus to the new heading.
- Keyboard: each control works with the keyboard in visual order. Focus is always visible. No keyboard trap. A dialog traps focus while open and returns it to its opener.
  When the focused element disappears, move focus to a sensible neighbor. Prefer a `button` to an imitation.
- Name, role, state, value: each control exposes all four. An icon-only button has a name. The name starts with the visible text.
  Tabs, radio groups, listboxes and menus use one tab stop and arrow keys.
- Content: an image alternative describes function. Color is never the only signal. Contrast is 4.5:1 for body text and 3:1 for large text, control edges and focus rings.
  A live region announces a change once.
- Reflow and motion: the page works at 320 px width and 200% zoom. Long text wraps or truncates and never pushes a control off screen. Honor `prefers-reduced-motion`.
- Loading, empty, error and partial-data states have a name, a retry where one applies, and an announcement.
- Never use `tabindex` above zero, `outline: none` with no replacement, or `aria-hidden` on a focusable element.
  Never use a placeholder as the only label. Never disable a global axe rule to go green.
- Proof: run the audit on each route that you touched (`AUTO`). Walk the keyboard path and check the names (`REVIEW`). Record each known limit with an owner (`PR`).

## Performance

- Measure before you optimize. Write the simple correct version, then fix the proven hot path. Watch N+1 queries, unbounded loops over external calls
  and serial awaits that could run together. Add an index before you rewrite a query.
- On a build failure, read the error, fix it, and validate after each fix. Do not stack speculative changes.
- The cost of agent work is in [agents.md](agents.md#token-economy).

## Operational safety

Use this gate for CI/CD, containers, cloud, Kubernetes, infrastructure as code, observability, security controls, incidents and compliance.

1. Confirm the authorization and the exact target: repository, environment, account, region, cluster, namespace, resource and data class.
2. Read the current state first. Keep observation apart from change. Check tool versions and flags against current official docs.
3. State the change, the blast radius, the validation, the rollback and the stop condition.
4. Use least-privilege, short-lived credentials. Never show a secret in a prompt, output, log or screenshot.
5. Prefer declarative, reviewable, idempotent changes. Run the formatter, validator, plan, diff or server-side dry run before you apply.
6. Never write to production, deploy, delete, rotate a credential, fail over or run a destructive command without explicit approval. Back up first.
7. Roll out in steps: test, then a small scope, then wider, with a health check at each step. Stop and roll back when a threshold fails.

For an incident, keep the evidence before you fix: times, logs, volatile state, hashes and the access record. Contain only inside the authorized scope.
Keep an append-only action timeline. Rotate a leaked credential in the system that owns it, and never paste a new value into the agent context.

A framework mapping is a preparation aid. It is not a certification or legal advice. Mark each claim as documented, configured, observed, tested or missing.

The final report gives the target, the change, the exact validation, the observed result, the rollback state, the remaining risk and the evidence location. Redact secrets and personal data.

## Documentation

A change that alters behavior but not its docs is incomplete. A finished item leaves no stale document behind it.
Ask before each commit: what did this change make wrong, and what did it make spent? Act on the answer in the same commit.

- Each module has a `README.md`. It holds the purpose, the file list, the public API and the external dependencies.
  It also holds the config with the source of each value, the data flow, the spec locations and the test command.
  A larger module also has a `DESIGN.md` with a fixed section list. The list includes cross-cutting concerns (security, privacy, observability, cost) and open questions.
  Keep the section list in one place.
- The root README lets a newcomer set up and run the project. Update it in the change that alters setup or scripts.
- Record one language for each audience: human-facing docs, and agent- or tool-facing files. A new document follows the language of its audience.
- An artifact that exists in two or more languages (locale tables, a bilingual changelog, a handbook) changes in one task, in every language.
  A test checks three things: the same identifiers in the same order, no item byte-identical across two languages, and every heading parses. Translate; never paste.
- Enforce imposed vocabulary (terms from counsel, a contract or an ADR) with a linter such as Vale, not with memory.
- A documentation change is never one file. Walk the chain:
  - The specification feeds personas, costing and open questions.
  - Personas feed costing, planning and the work split.
  - Costing feeds the schedule and the tickets.
  - A design or mockup feeds the specification. An ADR feeds the architecture model.

  At the end of the turn, name each downstream artifact that is now stale and why. Offer to update it. Stop and wait. Never cascade without the user.
  Report the movement, not a verdict about truth. The `impact-analysis` and `delivery-digest` skills write the two reports.
- Record an answer to an open question in the ADR first, then in the affected rules, then close the question.
- When a document is false, correct it in place and date the correction. Never rewrite dated history.
- Mark a deliberate shortcut in the code and add a line to the open register.
- Before you delete or rename a document, name each fact it held and its new home. Repoint every inbound link first, found by a real search.
- Never keep a verbatim archive of answers, a decision trail, a live open question, or a fact that no other document holds.
  A progress ledger, an endpoint dump or a status snapshot is spent when its content lands elsewhere.
- Never open a task "clean up the docs". Subtract in each change.
- A user-visible change carries its changelog entry in the same task. Read the current version first. Use the headings of the project.
  Write for a user who upgraded today: name a tab, a button, a dialog or a file. Write no entry for a refactor, a test or a CI change.
  Never edit a released section. Say in the report which entries you wrote.
