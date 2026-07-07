---
name: api-contract-sync
description: >
  Keep API code and contract layers synced when endpoints, DTOs, payloads,
  status codes, query params, auth rules, or business transitions change. Use
  for API work in projects with OpenAPI/Scalar or Swagger, Bruno, Gherkin,
  shared client types, or generated mocks.
risk_level: medium
writes_files: true
requires_tools: []
---

# API Contract Sync

Use this for every API behavior change. An endpoint is not done until code,
docs, client examples, and behavior specs agree.

## Trigger

Run when changing:

- route path, method, auth, ownership, status code, headers, query params,
  payload, DTO/schema, error shape, pagination, sorting, filtering
- controller/service business behavior visible through an API
- generated shared types or API client contracts

## Contract Layers

Check only layers that exist in the host repo:

- Controller docs: `@ZodResponse`, Swagger/OpenAPI decorators, Scalar setup.
- DTO/schema: Zod/class DTO metadata and exported shared types.
- Bruno: `tools/bruno/**/*.bru` request examples and payloads.
- Gherkin: `**/*.feature` behavior scenarios.
- Mockoon or generated mocks when the repo uses them.
- Frontend/shared API client types when consumers import the changed symbol.

## Workflow

1. Read host `AGENTS.md`, module `README.md`, command registry, and nearby
   specs/features before editing.
2. Find every contract layer for the changed route or DTO.
3. Update code and contract files in the same task.
4. If a layer is missing, report `not present`, not `skipped`.
5. Validate with the smallest declared commands: lint, typecheck, relevant API
   tests, contract/spec tests, and build only when required by the change.

## Review Gate

Before handoff, answer:

- Which endpoints/DTOs changed?
- Which contract layers were updated?
- Which layers were not present?
- Which commands ran, and did they pass?

If code changed but an existing contract layer was not updated, report the task
as partial.
