---
name: pr-review-governance
description: >
  Deep PR/MR review governance: compare code to product/spec docs, security,
  repo rules, tests, docs sync, and UI evidence before writing a summary and
  inline comments. Use when asked to review a pull request, merge request,
  branch, or posted review comments.
risk_level: medium
writes_files: false
requires_tools: []
---

# PR Review Governance

Use this skill whenever the user asks to review a PR, MR, merge request, pull
request, branch, or submitted review comments.

## Output Contract

- Publish or return the global summary first, then inline comments.
- Use the host repo's requested review language. If none is set, use the user's
  language.
- Lead with validated findings, ordered by severity: `P0`, `P1`, `P2`, `P3`.
- Inline comments must be actionable and teach the base issue: what is wrong,
  why it matters in this repo, and the expected fix in 2-4 short sentences.
- Do not post duplicate discussions. If a retry may have partially posted,
  inspect existing PR/MR discussions before posting again.

## Review Intake

1. Read the host `AGENTS.md`, this repository's imported Agent Compass rules,
   command registry, `package.json`, relevant module docs, and local instincts.
2. Read project memory or equivalent durable context when the host configures it.
3. Fetch PR/MR metadata: target branch, source branch, commits, diff refs,
   changed files, and existing discussions.
4. Compare with the merge base or platform diff refs, not only the local working
   tree. For platform inline comments, use the platform's exact diff position
   model.
5. Map changed files to relevant product docs, specs, design docs, architecture
   docs, module README/DESIGN, and tests before judging the code.

## Mandatory Review Axes

### Product And Spec Pertinence

- Compare behavior to the host's feature docs, specs, plans, tasks, checklists,
  and implementation status documents.
- Flag code that implements behavior outside the spec, misses required behavior,
  or marks tasks/status complete while code is incomplete.
- API changes must keep contract layers in sync: DTO/schema, OpenAPI/Scalar or
  Swagger docs, request collections, Gherkin/features, and shared client types
  when those layers exist.

### Repo Coding Rules

- Check host coding rules, module boundaries, import aliases, logging,
  persistence patterns, shared contracts, tests, and targeted validation.
- Apply `ponytail-review` when available to flag avoidable complexity,
  speculative abstractions, unnecessary dependencies, and hand-rolled
  stdlib/native features.
- Check module documentation stays current when code or public behavior changes.
- Use only validation commands declared in the host command registry,
  `package.json`, or equivalent repo docs.

### Security

- Check authN/authZ, scope and ownership enforcement, IDOR/BOLA, input
  validation, injection, SSRF, path traversal, secrets, PII exposure, audit
  logging, and unsafe background or async behavior.
- Run or apply the host security review skill/gate when the diff touches trust
  boundaries, identity, external services, uploads, AI, background jobs, or data
  access.

### Docs And Language Policy

- Check docs and comments follow the host repo's language policy.
- If the host has no language policy, only flag language drift when it affects
  clarity, product requirements, or public-facing consistency.
- Treat stale module README/DESIGN, architecture docs, feature specs, and public
  contracts as review findings when they drift from changed behavior.

### Frontend And Visual Review

- If UI screens, routes, shared components, styles, or design tokens changed,
  read the host design system docs before judging the diff.
- Use Figma MCP/Figma Go or equivalent design context when available and not
  rate limited.
- Use Playwright/browser verification when the app can run. Capture desktop and
  mobile screenshots when useful, and cite them in the summary or inline note.
- Check visual regressions, responsive layout, accessibility states, token use,
  and divergence from shared UI primitives.

## Validation

- Run the smallest validation set that covers affected packages: lint,
  typecheck, tests, docs checks, contract checks, or build.
- If validation cannot run, say why and list the remaining risk.
- Do not treat green commands as a substitute for spec, security, or UX review.

## Posting Checklist

- PR/MR-level summary: scope, verdict, findings list, validation run, visual or
  design evidence if relevant, and residual risks.
- Inline comments on actionable changed lines only.
- If the exact line is not available, comment on the closest changed line and
  name the referenced code precisely.
- Verify posted comments and remove accidental duplicates before finishing.
