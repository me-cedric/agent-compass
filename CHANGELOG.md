# Changelog

## 1.0.0 — 2026-10-16

Compass 1.0 is a rewrite. Install it with `ac init`. Move a 0.4 to 0.9 install with `ac migrate`.

### Engine

- The `ac` command has `init`, `sync`, `check`, `doctor` and `migrate`. Each command has `--dry` and `--json`. Exit 0 is success. Exit 1 is an error or drift. Exit 2 is a usage error.
- `ac sync` writes files, JSON and TOML keys, and text blocks into the project. It records each one in `.agents/compass.lock.json`. Two syncs give no diff.
- A file that the project edited stays as it is. `ac doctor` lists it as `kept`.
- `ac check --frozen` fails when the project is different from the lock.
- Pinned upstream skill sources are in `upstream.json`. The sync fetches them with a timeout and keeps a cache.
- `.agents/konvoy.json` marks the items that Konvoy owns. Compass does not write them.
- `ac doctor --tokens` measures the always-on context against a budget of 2,000 tokens.
- `ac doctor --global` reports the user-level Claude Code and Codex setup. It only reads files. `--measure` runs each SessionStart hook once and counts its output.
- The licence is MIT.

### Harness

- One contract block in `AGENTS.md`: core rules, the style contract, the answer shape, the completion gate and the safety rules.
- Hooks for Claude Code and Codex: `guard` blocks the read of a `.env` file, `gate` asks for the end summary after a turn that edited files, and `start` prints the style reminder.
- The `compass` output style, the role agents `scout`, `worker` and `reviewer`, and the `deliver` workflow.
- `permissions.deny` and `permissions.ask` entries for tracker and forge writes.
- Providers: Claude Code, Codex and GitHub Copilot.

### Skills

- Own skills for specs, tickets, review, debug, API contracts, CI triage, UI conformance and long work. Each skill uses placeholders for the repository paths.
- Pinned upstream skills from 13 sources, among them `ponytail`, `caveman`, `i-have-adhd` and `asd-ste100`.
- Stack rules for Android, Angular, Drizzle, Expo, GTK, macOS, NestJS, React, Swift and WinUI.
- The listing of model-invoked skills is 3,000 characters or fewer.

### Packs

- `env`, `local-run` and `e2e`: `ac env` checks the env catalog and shares values with age. `ac dev` starts the local stack with process-compose. `ac run` runs a named command from `agent-compass.commands.json`.
- `security`, `ci-github`, `ci-gitlab` and `renovate`: the `vuln-triage` skill, a SARIF merge script and opt-in CI seeds.
- `mcp/catalog.json` has 18 read-only MCP servers with pinned versions. The sync writes the chosen servers for Claude Code, Codex and VS Code.

### UI

- `ac ui` starts a local web UI on `127.0.0.1`. The tabs are Projects, Assets, Env, Run, Tests, Usage, Delivery and Promote.
- The Assets tab switches each skill, rule, agent, pack, MCP server and upstream source on or off.
- `ac usage` shows tokens, cost, cache hit rate and sub-agent share from the Claude Code transcripts.
- `ac promote` copies a project skill into compass.

### Migration

- `ac migrate` moves a 0.4 to 0.9 install to 1.0. It deletes a 0.x file that has the same bytes as compass 0.x. It moves an edited file to `migrated/` and keeps the other files.
- `ac migrate --docs` moves spec-kit specs, a root `specs/` folder and question registers to the Konvoy docs layout. Each source moves under `migrated/`.
- `ac init --from-specs <dir>` creates the docs layout and copies the documents into the OpenSpec inbox.
- `ac check --docs` checks the docs layout.

### User plugin

- The plugin `compass-user` works in every repository. Install it from this repository: `claude plugin marketplace add <path>`, then `claude plugin install compass-user@agent-compass`. Codex and Copilot CLI use the same marketplace.
- It has the hooks, the `compass` output style, the `compass-style` skill and the script `scripts/statusline.mjs`. The status line shows the model, the directory, the cache share and the context size.
- The plugin hook does nothing in a project that has `.agents/compass.lock.json`, because the project hook runs there.
- `npm run release -- <version>` sets the version in every file that carries it and adds a CHANGELOG heading. `npm run lint:release` checks that the versions agree.

### Removed

- Gemini support, `CODEX.md`, `GEMINI.md` and `MISSIONS.md`.
- The setup wizard chain, vendoring, the generated `.agent` reports, the self-evaluation loop, pull-knowledge, the OpenSpec guard, the spec-kit bridge and wrappers, and the 0.x migrations.
- 28 skills (spec-kit wrappers, CCG gates, niche converters, the operational pack) and 19 project-flavoured instincts.

Versions before 1.0.0: see the git tags v0.2.0 to v0.9.6.
