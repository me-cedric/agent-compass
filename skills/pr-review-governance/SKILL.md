---
name: pr-review-governance
description: >
  Deep PR/MR review governance: compare code against the product/spec corpus
  (including Spec Kit when the repository uses it), API contract layers,
  design conformance for frontend changes (fonts, colours, backgrounds and
  copy compared as measured values, not eyeballed, on desktop and mobile),
  Storybook, unit/e2e test coherence, security, repo rules, docs sync, and
  compatibility with other open PRs/MRs — then return or post a
  junior-friendly summary, inline comments with compared captures attached
  where a screen diverges, and a correction plan. Use when asked to review a
  pull request, merge request, branch, or posted review comments. The routing
  table decides which axes fire from the changed paths, so there is no need
  to say up front whether the change is frontend.
risk_level: medium
writes_files: false
requires_tools: [git]
---

# PR/MR Review Governance

Use this skill whenever the user asks to review a PR, MR, merge request, pull
request, branch, or posted review comments.

The review is done when every axis the routing table triggers has a verdict
backed by evidence, or an explicit `not verified` with a reason — and when the
report ends with a concrete correction plan.

## Path Placeholders

Examples below use placeholders for a repository's own trees — substitute the
real ones and drop any axis whose tree does not exist here:
`<api>/**` (a backend service), `<web-app>/**` (a frontend app),
`<ui-package>/**` (a shared UI/component package), `<shared-types>/**` (a
shared contract-types package), `<identity-theme>/**` (an identity-provider
theme override, e.g. a Keycloak custom theme), `<schema-migrations>/**` (a
database schema/migrations tree, e.g. Drizzle or Prisma).

## Output Contract

- Write the summary and inline comments in the repository's declared review
  language. When none is declared, use the user's language. Junior-friendly:
  assume the reader joined the project last week. Keep technical terms in
  the working language of the code when clearer.
- Global summary first, then inline comments, then the `Correction plan`.
- Findings ordered by severity: `P0` (blocking), `P1`, `P2`, `P3` (nit).
- Each finding: what is wrong, why it matters **in this repo**, expected fix, in
  2-4 short sentences, with a `file:line`. **Exception:** process findings
  (empty PR/MR description, missing label, wrong commit type, missing ticket)
  have no line — group them in a `Process` block at the end of the findings
  list.
- Never post duplicate discussions. On a retry, inspect existing discussions
  first.
- If no actionable findings exist, say so. Reviewing anyone's PR/MR is fine;
  approving or merging it is restricted to what the user explicitly
  authorizes in this conversation — never assume approval rights from
  authorship, a green pipeline, or a prior review.
- No AI-attribution footer ("Generated with …" or similar) anywhere in the
  report or a comment.

## Evidence Tiers

| Tier | Evidence | May be called |
|------|----------|---------------|
| T1 | Something you executed: a command, a test, a rendered page, a dependency run in isolation | "verified" |
| T2 | Source code read, a design export compared by hand, arithmetic over tokens | "code matches" — never "verified" |
| T3 | PR/MR description, ticket comment, author's word, green CI badge | "stated" |

Three rules that decide real cases:

- **Composed evidence takes the tier of its load-bearing step.** Reading a
  schema is T2; running the actual boundary parser with the production options
  to prove how it coerces is T1, and a finding that rests on that execution is
  T1.
- **Tier is not severity.** A T2 finding can be P0. Say both: "P0 [T2] — to
  confirm by rendering it or running it". Never soften a real blocker because
  you could not run it, and never present an unrun hypothesis as a fact.
- **You cannot run everything.** An axis you could not execute is reported
  `not verified` with the reason. That is compliance, not a skipped axis. What
  is forbidden is silently downgrading and calling it verified.

## Step 1 — Intake The Real PR/MR Head

Read the repository's own agent rules (`AGENTS.md` or equivalent), its
imported Agent Compass rules, `agent-compass.commands.json`/`package.json`,
relevant module docs, project memory when the host configures one, and any
project-specific agent instincts directory it declares (e.g.
`.claude/instincts/**`) before touching the diff.

On GitLab:

```bash
glab mr view <iid> -F json 2>/dev/null | jq '{state, author: .author.username, source_branch, target_branch, description, labels}'
glab api "projects/:id/merge_requests/<iid>" | jq '.diff_refs'   # base_sha / start_sha / head_sha
glab api "projects/:id/merge_requests/<iid>/changes" | jq -r '.changes[].new_path'
```

On GitHub:

```bash
gh pr view <number> --json state,author,baseRefName,headRefName,body,labels
gh api repos/:owner/:repo/pulls/<number> | jq '{base: .base.sha, head: .head.sha}'
gh pr diff <number> --name-only
```

- Use `glab` when the forge is GitLab, `gh` when it is GitHub. Prefer the CLI
  over a bespoke forge MCP wrapper for these calls.
- Review the head SHA the platform reports, not local `develop`/`main`:
  `git diff <base_sha> <head_sha>`.
- Target branch must match the repository's declared branch strategy (see
  [docs/workflows/pull-requests.md](../../docs/workflows/pull-requests.md) —
  most repos default feature branches onto a development branch and reserve
  the release branch for maintainers). A PR/MR onto the release branch against
  that policy is itself a P1 finding.
- Read existing discussions first, and check whether commits were pushed after
  the PR/MR was opened — late commits are often unannounced scope.
- Empty `description` or empty `labels` are **findings**, not noise: the
  description is where a breaking contract change gets announced, and a missing
  link to the design corpus there can make the frontend axis unverifiable.
- Shell gotcha: some environments rewrite commands through a hook that mangles
  unquoted arguments. Use single-argument quoted forms —
  `git show 'sha:path/to/file'`, not `git show $sha:path`.

## Step 2 — Freeze The Acceptance Criteria Before Reading The Diff

Write a numbered AC list to the scratchpad **before** opening the code, or you
will review what was built instead of what was asked.

**Read the reference at `base_sha`, never at the head.** A PR/MR that edits
`specs/**` (when the repository uses Spec Kit — see
[docs/workflows/spec-driven-development.md](../../docs/workflows/spec-driven-development.md))
ships its own acceptance criteria; validating the code against them is
circular. Use `git show '<base_sha>:specs/<domain>/<feature>/spec.md'`, and
treat the spec diff itself as something to review, not as the reference.

Sources, in order:

1. **Issue tracker** (e.g. Jira via an MCP integration, Linear, GitHub Issues):
   the tracker key pattern (e.g. `<TICKET-123>`) from the PR/MR title,
   description, commit subjects, or branch name → fetch the ticket and its
   comment thread.
2. **The product-spec corpus** the repository declares (SFD, PRD, or
   equivalent — e.g. `docs/sfd/features/FEAT-<DOMAIN>-<NN>-*.md`, plus its
   screens/flows sub-trees for UI work). The functional contract.
3. **Spec Kit**, when the repository uses it: `specs/<domain>/<feature>/{spec,plan,tasks,checklist}.md`
   and `docs/spec-kit/implementation-status.md`.

No ticket key anywhere: search the tracker, then grade what you find.

| What you found | Do |
|---|---|
| Fuzzy text match | Not a reference. Ask the user. |
| Ticket **In Progress, assigned to the PR/MR author, summary matching the diff** | Review against the product spec + Spec Kit, name it as a **candidate** in the header, flag "to confirm with the author", and continue. |
| Nothing | Ask the user before reviewing against invented criteria. |

Each AC carries `OK` / `KO` / `not verified`, its tier, and its evidence.

## Step 3 — Route The Axes, Then Read Only Those

Apply this table first; skip the axis sections it does not name.

| Changed paths | Mandatory axes |
|---|---|
| `<api>/**` | Product/spec · API contract · Boundary parsing · Blast radius · Security · Repo rules · Unit tests · API e2e |
| `<web-app>/**`, `<ui-package>/**` | Product/spec · Design conformance · Design values · Responsive · Storybook · Unit tests · Web e2e |
| `<identity-theme>/**` | Design conformance · Design values · its own Storybook target · realm/theme binding |
| `<shared-types>/**` | API contract · Required-field impact · both consumers |
| `specs/**`, `docs/**` | Spec-kit cascade (when used) · documentation language · the repo's docs-lint command |
| `<schema-migrations>/**` | Reversibility · seed · ERD check · timezone on new instants |

Two axes are **always** on, whatever changed: Step 4 (cross-branch) and Step 2
(AC).

An axis is also triggered by what the PR/MR **failed** to change — a change
that newly exposes an existing column as a product-visible instant owns its
timezone problem even with no migration in the diff.

## Axis — Product And Spec Pertinence

- Compare what shipped to the frozen AC list, **both directions**: AC claimed
  done but absent, and behavior present that no AC asks for.
- Unrequested scope is at least P2; it is **P1 when its blast radius exceeds the
  PR/MR's declared scope** (see Blast Radius).
- Flag `implementation-status.md` or `tasks.md` marked complete while code is not.
- A PR/MR changing behavior without touching its feature's `tasks.md` is a
  finding, when the repository uses Spec Kit.

## Axis — API Contract (backend)

| Layer | Where it lives (adapt to the repo) | Status |
|---|---|---|
| DTO / schema | e.g. a Zod-backed DTO layer in a NestJS stack, or the repo's own schema layer | check it exists and is updated |
| Shared contracts | the repo's shared-types package (e.g. `<shared-types>/src/**`) | check it exists and is updated |
| OpenAPI / Scalar or Swagger | controller/route decorators, or the OpenAPI source file | check it exists and is updated |
| **HTTP collection** (Bruno or equivalent, e.g. `tools/bruno/**/*.bru` + environments + fixtures) | present when the repo declares one — **check it** |
| Gherkin / BDD features | e.g. `<api>/features/**/*.feature` | present when the repo declares one — check it |
| Mock server (e.g. Mockoon) | e.g. `tools/mockoon/*.json` | when absent from the repo, report "not present" once; do not re-verify each review |

See also [skills/api-contract-sync/SKILL.md](../api-contract-sync/SKILL.md)
and, if the repository carries it, the `scalar-bruno-gherkin-sync` instinct in
`knowledge/instincts/`.

Code changed with an existing layer untouched → **P1**, naming the exact
`.bru`/`.feature` file (or the repo's equivalent). Also check that an HTTP
collection param proving the new behavior is not left **disabled** (Bruno:
`~param`) — a disabled param hides the bug from anyone smoke-testing the
collection.

### Boundary parsing — P0 class, mocked tests cannot catch it

Example trap in a Fastify + Zod stack: the app's bootstrap file (e.g.
`<api>/src/main.ts`) sets the query parser to coerce numeric-looking strings
(`parseNumbers: true`), and the validation pipe performs **no coercion**. So a
numeric-looking query value arrives as a `number` and fails `z.string()`:

`?department=67` → `67` → 400. `?department=02` → `2`, leading zero lost.
`?search=2026` → 400.

Any new query param typed as a plain string that can receive digits is a
**P0**: use a coercing string type (e.g. `z.coerce.string()`, precedent
elsewhere in the shared-types package). Unit tests call services and
controllers directly, bypassing the pipe — so demand a test that traverses the
pipe, or an e2e.

To prove it as T1 without booting anything, run the parser in isolation from
`node_modules` with the exact options from the app's bootstrap file.

### Response-shape and required-field changes

Cross-PR/MR compatibility keyed on file paths **misses these** — the breakage
is in a file the change does not touch:

- **Envelope changed** (`T[]` → `{ data, meta }`): grep the route string and the
  exported type name across the app trees *and* the diffs of other open
  PRs/MRs.
- **Required field added to a shared schema**: every existing mock of that type
  stops typechecking. When the web typecheck gate cannot run, grep the type
  name across the app trees and say that the grep is the substitute.

### Blast radius vs declared scope

A global provider — an app-wide interceptor, guard, pipe or filter (e.g.
`APP_INTERCEPTOR`/`APP_GUARD`/`APP_PIPE`/`APP_FILTER` in a NestJS app's root
module, `<api>/src/app.module.ts`) — affects every authenticated request on
every surface. Introduced inside a feature-scoped PR/MR (`fix(<scope>): …`),
that is **P1**: ask for it to be split out, or at minimum documented, ticketed,
and reviewed by the other domains. Same for anything writing on every
request, or changing a global parser, filter or serializer.

## Axis — Frontend, Design, Responsive, Storybook

- Read the design-system doc the repository declares (e.g.
  `docs/design/DESIGN-SYSTEM.md`). Design tokens (breakpoints, margins) live in
  the tokens file the repo defines (e.g.
  `<web-app>/src/shared/components/tokens/tokens.css`) — the values that
  decide responsive findings are there, not in the design doc.
- **Design conformance is not optional on this axis, and confirm there is
  exactly one design MCP server in play.** If the repository configures more
  than one Figma/design bridge, name the one you used; if only one, there is
  no ambiguity:

  | Order | Source | Needs | Use it for |
  |---|---|---|---|
  | 1 | **official Figma MCP** — `figma` in `.mcp.json`, `http://127.0.0.1:3845/mcp` (`get_metadata`, `get_screenshot`, `get_variable_defs`, `get_design_context`) | the endpoint reachable; it takes a `fileKey`, and it can answer without the desktop app in the foreground on some setups — do not assume either way, just call it | every review |
  | 2 | a prior conformance report the repo maintains (route → node table with desktop/mobile ids and frame sizes), if any — e.g. `docs/design/<conformance-report>.md` | — | measured values recorded by a previous T1 pass; a substitute for the frame only for what it actually records |
  | 3 | a prior design/spec arbitration log the repo maintains, if any (Spec Kit repos: `docs/spec-kit/<realignment-log>.md`) | — | prior arbitrations only, never as a substitute for the frame |

  `fileKey`: the repository declares it (in `.mcp.json`, a design doc, or the
  PR/MR description) — the local server reads the open file, so opening the
  right one is on you.

  **Decide availability from a failing MCP call, never from a port probe.** A
  plain `curl` or `nc` on `:3845` answering `000` / refused is **not** evidence
  the server is down — it has kept working with the MCP tools while a port
  probe failed on some setups. The only verdict that counts is an actual tool
  call: name it and quote what it returned.

  **This axis is genuinely blockable, and that is the point of naming one
  source.** When the call really fails, you write `not verified` with that
  call named — a compliant outcome, not a skipped axis. What is forbidden is
  inferring the mock from the code, from a type scale, or from a doc that does
  not record the value you need, and then writing "matches". Cheap things to
  try first: open the design tool on the right file, and re-run the call.

  Resolve node ids, never guess them, in this order:
  1. A prior conformance report the repo maintains — a route → node table that
     already carries the **desktop and mobile** ids per screen, plus frame
     sizes, if one exists.
  2. `specs/**/tasks.md` and the design node ids quoted in code comments (the
     conformance passes leave them behind: `1000:19075`, `1038:11534`, …).
  3. The PR/MR description, Spec Kit `plan.md`, the design corpus the
     repository declares.

  Remote-server mechanics that cost a run each time they are rediscovered:
  - `get_metadata` on a **page** id fails outright (SSE parse error) and on a big
    frame it is persisted to a file instead of returned — grep that file, do not
    re-request.
  - A frame's real content is often one `<symbol>` child (e.g. `Frame 2445`);
    metadata on the frame shows only the wrapper. Drill into the symbol id.
  - `get_screenshot` returns a short-lived URL: `curl -L -o` it into the
    scratchpad. No base64 unless the shell is unavailable. Ask for the node, not
    the whole page — `maxDimension` caps the *longer* edge, so a very tall frame
    at a fixed width comes back narrow and unreadable.
  - `get_variable_defs` returns only what is **bound**: colours and text styles.
    A font applied directly — e.g. a bold accent word in a different family —
    does not appear, so the node looks like the surrounding font. Confirm
    family and weight on a `get_screenshot` of the text node itself, upscaled.
  - No text style bound? The text node's box height gives the size — divide it
    by the repo's line-height ratio, e.g. in a 1.4× scale: 45 → 32/1.4,
    34 → 24/1.4.
- Resolve **both frames**: desktop and mobile are two different nodes, usually on
  different pages, and the mobile one frequently does not exist. That is a normal
  outcome and it has to be *said* — comparing a mobile render against the desktop
  mock, or against nothing while still writing "matches", invents a verdict.
  The frame's own `absoluteBoundingBox` width sets the capture width (e.g. 1440
  desktop, 390/440 mobile — verify per screen against the repo's own frame
  sizes: a mismatched capture width differs everywhere, and every real gap
  hides in that noise).
- Compare **structure, copy and rendered values**, not eyeballed pixels. Never
  invent a px tolerance.

### Design values: read them, do not judge them by eye

A screenshot pair settles structure and dimensions. It settles nothing about
**fonts, colours, backgrounds and copy** — each of those survives visual
inspection, and they are where most design bugs actually ship. Read both sides
as values: `get_design_context` / `get_variable_defs` on the node,
`getComputedStyle` on the rendered element.

| Value | Read | The trap that makes it invisible |
|---|---|---|
| Fonts | `font-family` · `font-weight` · `font-size` · `line-height` | **A design tool's text-style name is not its content.** A style named after one weight/size can actually hold a different family or weight — so applying the class the name suggests ships the wrong family, and it looks deliberate. |
| Colours | computed `color`, matched back to the token | A CSS Module class with a hardcoded colour **beats a utility class of equal specificity by source order**. The class is in the markup, the code reads correct, the pixel is wrong. Only the computed value shows it. |
| Backgrounds | `background-color` **and** `background-image`, walking ancestors and `::before` | Gradients live in `background-image`, and a gradient headline computes `color: transparent` — read `color` alone and you will report it as having no colour. Page backgrounds often come from an ancestor's `::before`, not the element you suspect. |
| Copy | rendered text vs `scan_text_nodes` | Compare characters, not the gist. A mock that splits a heading on a manual break is making a layout decision; an organic wrap at the same place is a different thing. |

Ready-made probes to paste into `browser_evaluate`:
[`scripts/probe-design-values.js`](scripts/probe-design-values.js). Run the
**typography census** first — it groups all visible text by (family, weight, size,
line-height, colour), so a heading whose two halves disagree, or one stray
hardcoded colour, surfaces without you having suspected that element first. That is
the only way to find the gaps you were not looking for; a targeted read only
confirms the ones you already doubted. The file also carries a targeted read and a
background-layer walk, since a page background usually comes from an ancestor's
`::before` rather than the element you suspect.

A note saying "title matches" recorded nothing. Quote the measured value
against the expected one: `rgb(17,24,39) measured, expected #064e3b`.

**Read the mobile frame before invoking the mobile type scale.** A design
system doc may document a heading size for mobile (e.g. H3 as 32/24) and the
stylesheet may drop that class to the smaller size under the mobile
breakpoint — but a mockup is free to keep a given title at the larger size on
a mobile frame while the titles around it sit at the smaller one. Measuring
the app against the *rule* instead of against the *frame* produces a confident
finding pointing the wrong way, and it flips the verdict on whichever page
happens to follow the rule.

### Attach the compared captures when a screen diverges

A colour or font finding written as prose is the easiest kind to wave away, and it
hands the author the job of locating the pixel. When a screen comes out as anything
but matching, post the design export and the app capture together — same width — and
say per image what diverges.

GitLab takes one upload per project and returns a markdown snippet for the note
body:

```bash
glab api projects/:id/uploads --form file=@app-confirmation-1440.png
```

Two known limits. An oversized POST body gets a `401` from the WAF instead of a
size error, so downscale before uploading, and paste through the web UI if it still
refuses — retrying only extends the block. `gh` has no image-upload endpoint, so a
GitHub PR needs the images dropped into the comment by hand.

Post both breakpoints when both were compared: a gap that exists only in mobile is
the one most likely to ship unnoticed. And scope the images to the screens that
diverged — a wall of matching screenshots is noise, and it teaches the author to
skip the ones that matter.
- **Render it** when allowed: use the repo's declared dev-server launch configs
  (e.g. `api`, `web`, `web-storybook`, `theme-storybook`) — never a bare
  start-the-dev-server command with no config behind it. Reuse a running
  stack (`docker ps`, `lsof -iTCP:<port>`). Seeded users come from the
  identity provider's realm/config file the repo declares (e.g. a Keycloak
  realm export). Gated routes (feature-specific guards in the app's route
  config) usually block a seeded account: drive the funnel, or mark the AC
  `not verified`.

### Responsive: check device widths, not declared breakpoints

Grepping the `@media` blocks the diff touches is not enough — the bug is often
that **only one breakpoint exists**. Some repos declare a single mobile
breakpoint token (e.g. `--breakpoint-mobile: 1240px`), so a phone and a tablet
get the same layout.

Enumerate the widths the product must support (e.g. 375 / 440 / 768 / 1240 /
1440), and for each, when you cannot render, compute the effective column
width:

```
viewport − 2×(small-page-margin) − 2×(container padding) − (gaps)
       ÷ number of columns
```

Under ~140 px a native `<input type="date">` truncates or overflows. This
arithmetic is deterministic T2 and finds real bugs — label it "by
calculation, not by rendering".

Also check that `nth-child` span rules cannot shift: if any field is rendered
conditionally, the grid silently reflows wrong.

### Storybook and the duplicated-DOM pattern

- Story expected for new or changed shared/presentational components: **P1**
  for the shared UI package (e.g. `<ui-package>/**`) and identity-theme login
  pages (e.g. `<identity-theme>/src/login/pages/**`), P2 elsewhere.
- **Page stories are a P1 surface when the repo's own definition of done makes
  the story part of the screen** (see
  [docs/guidelines/definition-of-done.md](../../docs/guidelines/definition-of-done.md)
  — check what the repository actually declares). Where that applies, every
  routed screen carries a colocated `<Screen>.stories.tsx` (+ `.fixtures.ts`).
  So raise a **P1** when a diff adds a screen without a story, moves or
  renames a screen without moving its story, adds a state or a design frame
  without a named story, or changes a screen's API calls without updating the
  story's declared routes. Two traps worth checking rather than trusting the
  green tick: an undeclared route inside a data-fetch `queryFn` is absorbed
  and leaves that slice of the screen silently empty, and a fixture cast
  through an unsafe type assertion compiles while describing a payload the
  API cannot produce. The repo's own test-conventions doc (e.g.
  `<web-app>/src/test/README.md`) is the contract when it declares one.
- Storybook is a valid T1 surface for a component whose route is unreachable.
- The `desktopOnly` / `mobileOnly` double-render pattern has three consequences
  worth a line each: CSS Modules are inert under some test runners (e.g.
  Vitest/jsdom) so **both variants are visible to Testing Library**;
  Playwright strict mode breaks on duplicate accessible names; and
  index-based `getAllByRole(...)[n]` selectors shift.

## Axis — Tests

Coverage of the *change*, not global coverage.

- **API unit tests** — colocated `*.spec.ts` or equivalent. New branch, guard,
  validation rule or error path untested → P1. Watch for dead assertions
  (`expect(x).resolves.not.toThrow` without parentheses never runs).
- **Web unit tests** — check the test runner's config doesn't let an empty
  suite pass silently (e.g. Vitest `--passWithNoTests`): a green run proves
  nothing on its own. Check a test file exists for the changed logic.
- **API e2e** — e.g. `<api>/test/**`.
- **Web e2e** — e.g. specs in `<web-app>/e2e/**`, with a separate tree holding
  infra/fixtures/config. Grep both, report on the specs.
- A renamed route, `data-testid`, label or reordered funnel step silently
  invalidates existing specs: grep the changed selectors and copy.
- A behavior removed from the product but still asserted by a passing test is a
  finding — the test now proves the wrong thing.

## Axis — Security

- authN/authZ, role and territory/tenant scoping, IDOR/BOLA, input validation,
  SQL/path/template injection, SSRF, secrets, PII exposure, audit logging,
  unsafe background-job behavior. See
  [docs/guidelines/security.md](../../docs/guidelines/security.md), and if the
  repository carries it, the `api-security-edge-cases` instinct in
  `knowledge/instincts/`.
- Apply the repo's security-verification skill/gate (e.g.
  [skills/verify-security/SKILL.md](../verify-security/SKILL.md)) when the
  diff touches trust boundaries, identity, external services, uploads, AI,
  background jobs, or data access.
- Identity provider (e.g. Keycloak): check the attribute or role is actually
  declared in the realm (e.g. `<api>/config/*-realm.json`), not only
  referenced in the decorator. An attribute missing from the realm's user
  profile is written and read as nothing — the endpoint answers 200 and the
  feature is a runtime no-op that mocked tests cannot see.
- Widening an export's columns is a data-protection change even when the code is
  trivial: check it against the feature's export rules.

## Axis — Repo Coding Rules

- Framework module boundaries (e.g. NestJS module boundaries), import aliases
  (e.g. `@/`), the repo's mandated logger (e.g. a custom `OtelLogger` wrapping
  OpenTelemetry — never a raw framework default logger; see the
  `otel-logger-pattern` instinct in `knowledge/instincts/` if the repo carries
  it), repositories via the repo's transaction pattern (e.g.
  `TransactionHost<DbTransactionAdapter>`), shared contracts in the repo's own
  scoped package (e.g. `@scope/shared-types`), colocated tests.
- Any project-specific agent instincts directory (e.g. `.claude/instincts/**`)
  is authoritative and wins over generic stack skills.
- Apply `ponytail-review` when available: smallest correct diff, delete before
  adding.
- Every API module keeps a current `README.md`; larger CRUD modules a
  `DESIGN.md` (see
  [docs/guidelines/documentation.md](../../docs/guidelines/documentation.md)).
- Conventional Commits, enforced by a commit linter (e.g. commitlint; see the
  `commit-convention` instinct in `knowledge/instincts/` if the repo carries
  it). A `fix(...)` PR/MR shipping a feature is a finding.
- **Documentation and code comments follow the repository's declared language
  policy** — check it before flagging drift. If the repo declares one
  language for code/comments with named exceptions (typically: the
  product-spec corpus, `specs/**` when Spec Kit is used, quotations, legal
  labels, and user-facing copy in the product's own language — and the review
  comments themselves, which follow the review language, not necessarily the
  code-comment language), apply exactly those exceptions. If the repo has no
  declared language policy, only flag language drift when it affects clarity,
  product requirements, or public-facing consistency. Treat a stale module
  `README.md`/`DESIGN.md`, architecture doc, feature spec, or public contract
  as a finding when it drifts from changed behavior (see
  [docs/guidelines/documentation.md](../../docs/guidelines/documentation.md)).

## Step 4 — Cross-Branch / Open-PR/MR Compatibility

Always on. Highest-value axis of this skill, and the one nothing in the
PR/MR hints at. See the `mr-scope-and-green-pipeline` instinct in
`knowledge/instincts/` if the repo carries it.

On GitLab:

```bash
glab mr list -F json | jq -r '.[] | "\(.iid)\t\(.author.username)\t\(.source_branch)\t\(.title)"'
git fetch origin <target-branch> "merge-requests/<iid>/head"   # the sha lands in the object DB
git merge-tree $(git merge-base origin/<target-branch> <head_sha>) origin/<target-branch> <head_sha> \
  | grep -E '^(<<<<<<<|changed in both)'
```

On GitHub, the same shape:

```bash
gh pr list --json number,author,headRefName,title
git fetch origin <target-branch> "pull/<number>/head"
git merge-tree $(git merge-base origin/<target-branch> <head_sha>) origin/<target-branch> <head_sha> \
  | grep -E '^(<<<<<<<|changed in both)'
```

Narrow before fanning out — do not fetch 20 diffs blindly:

1. Shortlist by branch name and title (same domain, same screen, same module).
2. `glab api ".../merge_requests/<other_iid>/changes"` (or
   `gh api repos/:owner/:repo/pulls/<other_number>/files`) on the shortlist
   only.
3. **Plus** a contract pass, independent of paths: grep the changed route
   strings and exported type names across the other open PRs'/MRs' diffs. The
   worst collisions have zero path overlap.

`grep -c '^<<<<<<<'` returning 0 does not mean "no interaction" — `changed in
both` files still merge into something nobody reviewed. Report:

- textual conflicts with the target branch or another open PR/MR;
- semantic conflicts: same migration sequence, shared type, route, i18n key,
  spec requirement id, or CSS rules one change deletes and another overrides;
- duplicated work — two PRs/MRs shipping the same screen or endpoint (product
  arbitration, not a code fix);
- a required merge order, stated explicitly.

## Step 5 — Validation, And What To Do When You Cannot Run It

Run the repository's own validation gates — declared in
`agent-compass.commands.json` or `package.json` (see
[docs/workflows/validation-defaults.md](../../docs/workflows/validation-defaults.md)).
Typical shape in a pnpm monorepo:

```bash
<the repo's API gate>          # test + lint + typecheck, API tree
<the repo's web gate>          # test + lint + typecheck, web tree
pnpm --filter @scope/api test:e2e
<the repo's web e2e command>
<the repo's module-docs check>  # only when module code or docs changed
<the repo's docs-lint command>  # only when docs/** or specs/** changed
```

Use only commands the repository actually declares in its command registry or
`package.json` (or the equivalent for another package manager or language).
Playwright may reuse a dev server left by another worktree on its usual port
and produce misleading 404s.

**Read-only mode is the normal case, not an exception.** The head is usually not
in the working tree, the checkout is shared, and a fresh `git worktree add` has
no installed dependencies — so this step can cost a full dependency install
(e.g. `pnpm install`, or the equivalent for the repo's package manager) before
a single command runs. Say so in the report header and use the named
substitutes:

| Instead of | Do this | Tier |
|---|---|---|
| the web typecheck gate | grep the changed type name across the app trees for broken consumers | T2 |
| booting the API to prove parsing | run the dependency in isolation from `node_modules` with the real options | T1 |
| a trial merge | `git merge-tree`, and grep `changed in both` too | T1 |
| the on-disk fallback doc | read the diff of the open PR/MR that updates it | T2 |
| rendering a screen | token arithmetic on effective widths | T2 |

Green commands are not a substitute for spec, security or UX review.

## Step 6 — Spec-Kit Realignment

Only when the review proves the spec is behind, and only when the repository
uses Spec Kit. Rules: see
[docs/workflows/spec-driven-development.md](../../docs/workflows/spec-driven-development.md)
and, for the ticket-side half of a drifted spec,
[skills/spec-drift-triage/SKILL.md](../spec-drift-triage/SKILL.md).

1. Edit `specs/<domain>/<feature>/spec.md` in English, technology-neutral.
   A presentation-only change (breakpoint, spacing) does **not** belong in
   `spec.md` — one line in `tasks.md` is the whole realignment.
2. Cascade `checklist.md` → `plan.md` → `tasks.md`. An AC that changes in
   `spec.md` and never reaches `tasks.md` re-diverges at the next PR/MR.
3. Requirement ids (the repo's own scheme, e.g. `RG-*`, `RULE-*`, `VAL-*`,
   `ERR-*`) are **append-only**: amend under the existing id, or add a dated
   suffix (e.g. `RULE-<DOMAIN>-013a`). Never renumber, never delete.

Arbitration before editing — the design mock is primary, not always right:

| Class | Situation | Action |
|---|---|---|
| A — Design wins | Screen carries it, spec and code do not | Realign the spec |
| B — Mock defect | Stale copy or UI-kit placeholder | Spec/code stand; design ticket |
| C — Non-UI requirement | Legal/GDPR/server obligation a mock cannot draw | Escalate, annotate `Needs clarification` |
| D — Design self-inconsistent | Two variants disagree, or the mock shows one state while the code ships another | Product call, not the reviewer's |

Prior arbitration/backlog docs the repository maintains, if any, already rule
on many gaps — quote them, do not re-litigate.

**Propose the spec diff in the report and wait for a yes.** A review is
read-mostly; do not write spec edits into a shared checkout.

## Step 7 — Report

Write these labels, and the section headings below, in the repository's
declared review language; this template shows the shape in English.

```
## Verdict — <PR/MR> #<id> · <TICKET-123 or "no ticket referenced, candidate X"> · <source> → <target>
Scope: <n> files · <axes triggered>
Evidence: <n> AC at T1 · <n> at T2 · <n> not verified — <reason>
Blockers: <n> P0 · <n> P1
```

When the frontend axis fired, name the values actually compared and the
viewports actually rendered — e.g. `Values compared: fonts · colours ·
backgrounds · copy · structure (desktop 1440 + mobile 440)`. Listing the full
set regardless leaves the reader unable to tell a value that passed from one
nobody opened, and the mobile viewport is the one most often silently
skipped.

Then: **1.** AC table (AC / verdict / tier / evidence) · **2.** Findings
`P0..P3` + the `Process` block · **3.** Contracts & docs · **4.** Tests ·
**5.** Compatibility · **6.** Validation · **7.** `Correction plan`.

**Collapse, do not pad.** A section with nothing in it is one line (e.g.
`Contracts: not applicable — change is 100% frontend`), never a table of
"not applicable" rows. Step 3 decides what is instructed; this template must
not resurrect an axis the routing table excluded.

Findings outside the changed lines get one of three tags — pick by
consequence, not by taste (shown here in English; write them in the review
language):

- `[pre-existing]` — was already broken, this PR/MR neither worsens nor
  exposes it. Report as P3 or drop.
- `[revealed by this change]` — the line is unchanged but this PR/MR is the
  first to make it harmful (first consumer, first exposure, first product
  behavior derived from it). Rank it on its real severity.
- dropped — unrelated to the changed behavior and cheap to find later.

Say what is good, too, and name it precisely. A reviewer who only lists faults
gets read as noise.

## Step 8 — Correction Plan (mandatory)

- Ordered, numbered, grouped into "fix before merge" / "follow-up (ticket)" —
  write the group labels in the review language.
- Each item: the file(s), the change in one sentence, a ready-to-apply snippet
  when under ~15 lines, and a coarse effort (`S` / `M` / `L`).
- Name the follow-up artifacts: which HTTP-collection file, which story,
  which e2e spec, which `tasks.md` line, which tracker ticket to open.
- Offer to apply it. Apply nothing, push nothing, before the user says yes.

## Step 9 — Post Only After Confirmation

**Skip this whole step for a local review.** No `glab`/`gh` configured, or the
user asked for a report in the answer → return the report, done.

Otherwise: show the recap, wait for an explicit yes, then post.

### GitLab (`glab api`)

Two silent traps — both post something that looks fine but is wrong.

1. **Summary note** — body via command substitution, never `@file`:

   ```bash
   glab api "projects/:id/merge_requests/<iid>/notes" -f "body=$(cat review.md)"
   ```

   `-f "body=@review.md"` posts the literal string. `--input file` alone → 415.

2. **Line-anchored comment** — JSON body **and** an explicit content-type.
   Nested `-f "position[...]"` fields are dropped silently and the comment
   degrades to a general thread.

   ```bash
   glab api "projects/:id/merge_requests/<iid>/discussions" --method POST \
     -H "Content-Type: application/json" --input discussion.json
   ```

   ```json
   {
     "body": "…",
     "position": {
       "position_type": "text",
       "base_sha": "…", "start_sha": "…", "head_sha": "…",
       "new_path": "path/to/file.ts", "old_path": "path/to/file.ts",
       "new_line": 515
     }
   }
   ```

3. **Verify** — re-read each discussion; a null `notes[0].position` means it
   degraded. Delete the stray note and repost with the JSON body.

A 401 on POST is usually the WAF rejecting an oversized body, or an expired
PAT (check `personal_access_tokens/self`). Retrying prolongs the block: split,
or paste in the web UI.

### GitHub (`gh`)

See [docs/workflows/pr-review.md](../../docs/workflows/pr-review.md) for the
review-submission flow: pending review → inline comments → submit as
`--comment`, `--approve`, or `--request-changes`.

The tracker's comment format may not be Markdown (e.g. Jira uses wiki markup)
— check before posting there.

## Cleanup

Close what you started: browser sessions, `preview_stop` on servers you
launched, worktrees you created. Leave a pre-existing stack untouched and say
what is still running.

## Red Flags — Stop

| Thought | Reality |
|---|---|
| "The spec says so" | Read it at `base_sha`. This PR/MR may have written that spec. |
| "The route is gated, I'll read the source instead" | That is T2. Say `not verified`, or reach the state. |
| "The screenshots look the same, so fonts and colours match" | Neither is visible at a glance. Read the computed values. |
| "The design tool's style is named H3, so the `.h3` class is right" | Style names lie about their content. Read family, weight, size. |
| "Design tool is unreachable, I'll read the code instead" | The code cannot state the mock. And a refused port probe is not proof — only a failing MCP call is. Try the call, open the design tool on the file, try again; if it still fails, write `not verified` and quote the call. |
| "The design system says H3 is 24 on mobile, so 32 is a bug" | The frame is the arbiter, not the scale doc. A mobile mock can hold a title at the larger size while its neighbours use the smaller one — check the node's box height before calling it a regression. |
| "No mobile frame, so mobile matches / doesn't match" | Neither. Say the frame does not exist, and treat the behaviour below the breakpoint as a product call — quoting the nearest screen that *does* have one. |
| "The gradient title sets no colour" | It is `background-image`; `color` is transparent by design. |
| "The utility class is in the markup, so it applies" | A module class can beat it on source order. Read the computed value. |
| "No mobile frame, so only desktop needs comparing" | Capture mobile anyway and record the reference as absent. Mobile gaps ship unnoticed. |
| "I described the colour gap in the comment" | Attach the two captures. Prose makes the author hunt for the pixel. |
| "I'll attach every screen's screenshots" | A wall of matching screenshots trains the author to skip the ones that matter. |
| "CI is green" | T3. Run it, or label it `stated`. |
| "I couldn't run it, so I'll soften it to P2" | Tier is not severity. P0 [T2] is a valid finding. |
| "No ticket key, this ticket looks close" | Fuzzy match = ask. In-progress + assigned to the author = candidate, flagged. |
| "Backend only, the HTTP collection can wait" | The collection file and the feature file are part of the change. P1. |
| "New query param, the schema types it as a string" | A coercing query parser plus no coercion in the pipe silently turns it into a number. P0. |
| "Small component, no story needed" | Shared/presentational = story — unless the area has none at all. |
| "No `@media` added, so responsive is fine" | The bug is often that only one breakpoint exists. Compute widths. |
| "E2E aren't in the diff, so they're fine" | A renamed selector breaks them silently. Grep. |
| "No path overlap with the other PRs/MRs" | Envelope and shared-type breakage has zero path overlap. Grep the route and the type. |
| "It's just an interceptor" | A global provider in a scoped PR/MR is P1 blast radius. |
| "The attribute is in the DTO" | Check it exists in the realm, or the endpoint 200s and writes nothing. |
| "The target branch has the code, close enough" | Review the platform's actual head SHA. |
| "~3px off, acceptable" | Invented tolerance. Compare tokens. |
| "Spec realigned, done" | Cascade `checklist.md` → `plan.md` → `tasks.md`. |
| "No screen draws this requirement, drop it" | Class C. Escalate and annotate — never delete. |
| "The line is unchanged, so `[pre-existing]`" | If this PR/MR is what makes it harmful: `[revealed by this change]`. |
| "I'll just post the comments, they're helpful" | Nothing is posted before the user says yes. |
| "The review is written, that's the deliverable" | Missing the `Correction plan`. Not done. |
