# API Contract Sync

An API change isn't done until its **specification layers** match the code. Keep
them in sync in the **same task** — agents that skip this ship drift.

## The layers

| Layer            | Where                                  | What changes                                          |
| ---------------- | -------------------------------------- | ----------------------------------------------------- |
| OpenAPI / Scalar | controller + DTO decorators            | `@ApiOperation`, `@ApiResponse`, `@ApiQuery`, `@ApiParam`, `@ApiProperty`, `@ApiTags`. Register new modules in the Swagger bootstrap. |
| Bruno            | `tools/bruno/**/*.bru`                 | Request URL, method, body, headers, docs. Add/remove `.bru` files with endpoints. |
| Gherkin          | `**/features/*.feature`                | Scenarios/steps/examples when **behavior** changes; new feature files for new capabilities. |
| Mockoon (opt.)   | `tools/mockoon/*.json`                 | Regenerate mocks from the OpenAPI export.             |

[Scalar](https://scalar.com) renders the OpenAPI as live docs;
[Bruno](https://www.usebruno.com) is the git-versioned API client;
[Gherkin](https://cucumber.io/docs/gherkin/) captures behavior as executable spec.

## The checklist (any endpoint/DTO/status/param/payload/transition change)

- [ ] Controller Swagger decorators updated
- [ ] DTO `@ApiProperty` metadata updated
- [ ] Bruno `.bru` request/response examples updated (added/removed with the endpoint)
- [ ] Gherkin scenarios updated when behavior changed
- [ ] New modules registered in the Swagger bootstrap
- [ ] `lint` + `typecheck` + relevant tests pass
- [ ] OpenAPI re-exported and mocks regenerated if used (`generate:mocks`)

## Why git-versioned clients/specs

Bruno and Gherkin live in the repo, so the contract is reviewed in the PR, diffs
with the code, and can't rot in a separate Postman workspace. Treat them as code.

Detailed rules: the `scalar-bruno-gherkin-sync` instinct in
[`knowledge/instincts-parcus/`](../../knowledge/instincts-parcus/).
