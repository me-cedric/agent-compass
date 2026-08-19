# Impact Analysis: Reusable Project Knowledge

Date: 2026-08-19
Status: Validated

## Change Summary

A quarantined review of another local project found three reusable workflows.
Agent Compass now supports safe codebase-to-specification drafting and broader
diagram ingestion. The older Excalidraw-only skills were removed because the new
diagram skills fully cover them.

No source-project name, product workflow, application schema, domain term, or
source path was promoted. All source instincts were already present and
identical, so no instinct changed.

## Impact By Area

### Behavior

- `codebase-to-specs` creates drafts from observed implementation evidence.
- Every generated draft stays marked as inferred until human review.
- Architecture decisions can start from Excalidraw, draw.io, Mermaid, or BPMN.
- LikeC4 conversion accepts Excalidraw, plain or compressed draw.io, and draw.io
  SVG files that carry an embedded model.
- Mermaid architecture diagrams remain a guided text conversion. BPMN is not
  misrepresented as a C4 architecture model.

### Recommendations And Adoption

- The core profile recommends all three generalized skills.
- `compass-adopt` offers `codebase-to-specs` only when reviewed project
  documentation is missing.
- The old Excalidraw-only skill identifiers are no longer recommended.

### Security And Privacy

- Source files were staged in the ignored knowledge quarantine.
- A false positive in a vendored vulnerability identifier required explicit
  quarantine mode. The identifier was reviewed before staging continued.
- The promoted converter limits input and expanded model size to reduce
  decompression risk.
- The final source-identity and sensitive-data scan must pass before delivery.
- Temporary staged files are deleted after review.

### Documentation

| Artifact | State | Reason |
| --- | --- | --- |
| Skill catalog | Updated | Replaces old skill identifiers and documents the new workflow. |
| Core recommendation profile | Updated | Makes the generalized skills reachable and installable. |
| Adoption playbook | Updated | Offers inferred drafts only when reviewed documents are absent. |
| Changelog | Updated | Records the new workflow and superseded skills. |
| API, data, and UI documents | Not affected | No product API, data model, or visual surface changed. |

## Validation

| Command | Result |
| --- | --- |
| `node --test test/diagram-to-likec4.test.mjs test/profiles.test.mjs` | Passed: 9 tests. |
| `npm run check` | Passed: 228 tests and all configured gates. |
| `npm run check-companions` | Passed. |
| `node scripts/cli.mjs upstream-skills --verify` | Passed: 146 locked skills and seven source pins. |
| `node scripts/cli.mjs catalog --grep codebase-to-specs --md` | Passed: new skill is discoverable. |
| `node scripts/cli.mjs catalog --grep diagram-to-likec4 --md` | Passed: replacement skill is discoverable. |
| `node scripts/redact.mjs --files <promoted-files>` | Passed: no secret or personal-data patterns. |
| Source-identity scan of promoted files | Passed: no source name, path, or product-specific token. |
| `npm run lint:release` | Passed. |
| `git diff --check` | Passed. |

Evidence bundle: `.agent/evidence/index.html` — complete, 228 tests, zero
failures, zero skipped tests. No typecheck or build command exists in the
command registry.

## Remaining Risks

- Reverse-engineered documents can describe accidental behavior. The inference
  warning and human review are mandatory.
- A diagram can omit context or alternatives. Unknown ADR fields remain `TODO:`.
- Mermaid conversion is semantic and guided, not a deterministic parser.
