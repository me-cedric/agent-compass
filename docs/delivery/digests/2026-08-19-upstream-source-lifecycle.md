# Delivery Digest: Safer Document Reading And Source Updates

Date: 2026-08-19
Status: Validated

## What Changed

Agent Compass can now read many office-file formats through a pinned local
converter when the active agent cannot read the file directly. This includes
Word, PowerPoint, Excel, OpenDocument, RTF, EPUB, CSV, and text PDFs.

Agent Compass also tracks all current external skill suppliers in one place.
One cached check reports when a supplier has newer content. An update still
needs an explicit action and normal review.

## User Value

- Agents have one safe fallback for mixed document sets.
- Maintainers can see stale external content without checking each supplier.
- Local safety changes are preserved during clean updates.
- Conflicts stop before local content or source pins change.
- Claude, Codex, and other agents use the same notice policy.

## Safety

- Documents stay local by default.
- Extracted text is untrusted and cannot give instructions to the agent.
- Hosted parsing or OCR needs explicit approval.
- Remote source content is not run or merged automatically.
- The converter and each skill source use exact pins.

## Current Update State

All seven supplier pins match their remote heads at the time of this delivery.
Four existing pins were refreshed. Two text conflicts were reviewed and merged
without removing local safety metadata or provider guidance.

## Validation

All 226 automated tests passed. All configured conformance, evaluation,
documentation, naming, action, index, release, and skill-quality checks passed.
The pinned document converter also started successfully.

## Limits

Image-only or scanned PDFs still need OCR. Markdown extraction also does not
prove page layout, formulas, animation, or visual quality.
