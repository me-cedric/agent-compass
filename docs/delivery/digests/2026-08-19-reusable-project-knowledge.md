# Delivery Digest: Reusable Project Knowledge

Date: 2026-08-19
Status: Validated

## What Changed

Agent Compass can now draft missing project specifications from an existing
codebase. Each draft clearly says that it was inferred from code and needs human
review.

Diagram workflows now accept more common formats. The new skills replace the
older Excalidraw-only versions and add draw.io, embedded draw.io SVG, Mermaid,
and process-decision support.

## User Value

- Existing projects can gain a reviewable documentation starting point.
- Unknown intent stays visible as questions instead of invented requirements.
- More diagram formats can feed decisions and structured architecture models.
- New hosts receive these workflows through the normal core recommendation.

## Safety

- No source-project identity or product-specific workflow was copied.
- Temporary source files were quarantined during review and are removed before
  delivery.
- Generated specifications cannot become trusted documents until a person
  reviews them.
- Compressed diagram input has an expansion size limit.

## Limits

Code shows current behavior, not intended behavior. Diagrams can also omit
important context. Human review remains required for both outputs.

## Validation

All 228 automated tests passed. The repository conformance, evaluation, naming,
index, documentation, skill-quality, companion, release, and source-pin checks
also passed. The evidence bundle is complete at `.agent/evidence/index.html`.
