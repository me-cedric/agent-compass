---
name: api-contract-sync
description: Keep API code, OpenAPI, Bruno, Gherkin, mocks and client types in step. Use when an endpoint, DTO, payload, status code, query parameter or auth rule changes.
risk_level: medium
writes_files: true
requires_tools: [bru]
metadata:
  stacks: [nestjs-api, react-web, next-web, angular-web, expo-mobile]
---

# api-contract-sync

An endpoint is not done until the code, the docs, the client examples and the behavior specs agree.
Update all layers in the same task. Never defer a layer to a follow-up PR.

## Trigger

Run this skill when you change any of these:

- A route path, method, auth rule, ownership rule, status code, header or query parameter.
- A payload, DTO, schema, error shape, pagination, sorting or filtering.
- Controller or service behavior that an API shows.
- Generated shared types or API client contracts.

## Layers

Check only the layers that exist in the repository. The OpenAPI file is in `{{OPENAPI_DIR}}` when the project keeps one there.

1. Controller docs and DTO metadata (OpenAPI, Swagger or Scalar decorators):
   - Each endpoint documents its purpose, all response codes, its query and path parameters and its auth scheme.
   - Each DTO field has a description and an example, and says if it is required.
   - A new module is registered in the OpenAPI bootstrap, with its tags.
2. Bruno requests (`*.bru`):
   - The URL, method, query parameters, body and headers match the controller and the DTO.
   - The `docs` block and the pre-request and post-response scripts are current.
   - A new endpoint gets a new request file. A deleted endpoint loses its file. Keep the `seq` order in `folder.bru`.
3. Gherkin (`*.feature`): add or change a `Scenario` for each new or changed behavior. Update `Examples` tables.
4. Mocks and client types:
   - Mockoon: start a mock from the OpenAPI file with `npx @mockoon/cli start --data <openapi-file>`. Check that the mock answers the new shape.
   - Shared client types: update each consumer that imports the changed symbol.

## Steps

1. Read the repository `AGENTS.md`, the module README and the nearby specs and features.
2. Find every layer for the changed route or DTO.
3. Change the code and the layers together.
4. Write `not present` for a layer that does not exist. Never write `skipped`.
5. Run the smallest declared checks: lint, typecheck, the API tests, the contract tests.
6. Run the Bruno collection against the running API: `bru run <collection-dir> --env <env>`. Report each failing request.
7. After a decorator change, check that the app still starts and the OpenAPI document builds.

## Review gate

Before the handoff, answer four questions:

- Which endpoints and DTOs changed?
- Which layers did you update?
- Which layers are not present?
- Which commands ran, and did they pass?

If code changed and an existing layer did not, report the task as partial.
