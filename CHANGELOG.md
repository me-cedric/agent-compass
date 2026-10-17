# Changelog

## 1.0.0 — 2026-10-16

Compass 1.0 is a rewrite. Install it with `ac init`. Move a 0.4 to 0.9 install with `ac migrate`.

### Engine

- `ac sync` refuses a lock from a newer compass than the checkout (run `git submodule update`). Conflict markers in the lock or a managed file give one error. `ac check --diff` shows the diff of each kept file; a kept item says whether compass has a newer version. The commands find the project root from a subdirectory.
- `ac doctor` warns about a missing LSP binary, a project without a code graph index, an MCP server older than its minimum version, a submodule off its commit or behind a newer tag, a project without git; it names the Codex `/hooks` trust step and the user-level todo count.
- An upstream source with bidi or tag characters in a skill file stays out of the cache, with a warning. `npm run release` lists the assets changed since the last tag. The compass-check CI files are managed. CI runs the tests on Linux, macOS and Windows.
- Windows: `ac run` stops the child and its process tree with `taskkill`; `ac doctor --tokens` and `--measure` run a hook command in Git Bash; `AC_AGE` and `AC_PROCESS_COMPOSE` may name a Node script, which runs with the current node binary. Every text file has LF line ends in every checkout (`.gitattributes`).

- The `ac` command has `init`, `sync`, `check`, `doctor` and `migrate`. These five take `--root`, `--dry` and `--json`. Exit 0 is success. Exit 1 is an error or drift. Exit 2 is a usage error.
- `ac sync` writes files, JSON and TOML keys, and text blocks into the project. It records each one in `.agents/compass.lock.json`. Two syncs give no diff.
- A file that the project edited stays as it is. `ac doctor` lists it as `kept`.
- An array key (`hooks.*`, `permissions.deny`, `permissions.ask`) is merged per entry: compass owns its own entries, and the entries of the project stay in place. A project with its own hooks keeps them and gets the compass `.env` guard too.
- `ac check --frozen` fails when the project is different from the lock.
- Pinned upstream skill sources are in `upstream.json`. The sync fetches them with a timeout and keeps a cache.
- `.agents/konvoy.json` marks the items that Konvoy owns. Compass does not write them.
- `ac doctor --tokens` measures the always-on context against a budget of 2,000 tokens.
- `ac doctor` warns when the command of a selected MCP server is not on PATH.
- `ac doctor --global` reports the user-level Claude Code and Codex setup. It only reads files. It warns about a hook that is listed more than once. `--measure` runs each SessionStart hook once and counts its output.
- The licence is MIT.

### Harness

- The guard hook blocks a read of a secret file (SSH keys, .pem, .key, keystores, service files), an edit of a lock file, a tracker worklog or delete tool on Codex, and a destructive git or rm command. It fails closed from Claude Code 2.1.295 (`onFailure`).
- The permission rules ask before every tracker and forge write (Jira, Confluence, GitHub, GitLab, the GitHub plugin, gh, glab, jira, acli) and before a force push, a hard reset, git clean, a branch delete and a recursive rm. They deny repository deletes and the read of .env files.
- No AI attribution lines in commits and pull requests (`attribution` setting).
- The Copilot cloud agent gets the three hooks in `.github/hooks/compass.json`; the hook prints the JSON that Copilot reads.
- Role agents: the scout omits the project files; Codex scout and reviewer run read-only; Copilot agents load the project contract and their reasoning effort.

- One contract block in `AGENTS.md`: core rules, the style contract, the answer shape, the completion gate and the safety rules.
- Hooks for Claude Code and Codex: `guard` blocks the read of a `.env` file, `gate` asks for the end summary after a turn that edited files, and `start` prints the style reminder.
- The `compass` output style, the role agents `scout`, `worker` and `reviewer`, and the `deliver` workflow.
- `permissions.deny` and `permissions.ask` entries for tracker and forge writes.
- Providers: Claude Code, Codex and GitHub Copilot.

### Skills

- Own skills for specs, tickets, review, debug, API contracts, CI triage, UI conformance and long work. Each skill uses placeholders for the repository paths.
- The source `devops-security` (by hand) brings 18 ops and security skills for Kubernetes, Helm, ArgoCD, Grafana, GitLab and GitHub hosts. The MCP catalog has `angular-cli` (trial, read-only).
- Rules and guides fold the 0.9 knowledge that had no 1.0 home: bulk React Query writes settle in `onSettled`, picker labels, safe `href`, dev-server route warmup, Swift module declarations, Android shell refusals, an adapter for an untyped dependency, parallel locale artifacts, external pipelines, the OpenSpec root and `config.yaml` rules, a document for a decider, the code graph settings, a docs lint section, the tool contract, a tool table, delivered scope, the `GIT_INDEX_FILE` fix and image digests.
- Pinned upstream skills from 16 sources, among them `ponytail`, `caveman`, `i-have-adhd` and `asd-ste100`. The official Expo skills (`expo`, by hand), the Playwright CLI skill (`playwright-cli`, recommended for web stacks) and the official Angular skills (`angular`, by hand) are new. caveman moves to v4.0.1 under Apache-2.0; taste moves to v2.0.0 and keeps the old skill as `taste-skill-v1`.
- The engine copies a root `NOTICE` file beside each upstream skill (Apache-2.0 section 4(d)). A source whose repository has no licence file can carry the text in `licenceText`; the engine writes it as `LICENSE`.
- Stack rules for Android, Angular, Drizzle, Expo, GTK, macOS, NestJS, React, Swift and WinUI.
- The listing of model-invoked skills is 3,000 characters or fewer.

### Packs

- `env`, `local-run` and `e2e`: `ac env` checks the env catalog and shares values with age. `ac dev` starts the local stack with process-compose. `ac run` runs a named command from `agent-compass.commands.json`.
- `security`, `ci-github`, `ci-gitlab` and `renovate`: the `vuln-triage` skill, a SARIF merge script and opt-in CI seeds.
- `mcp/catalog.json` has 19 read-only MCP servers with pinned versions. The sync writes the chosen servers for Claude Code, Codex and VS Code. `codebase-memory` is on in every project; `projectmem` is a trial.
- The catalog also has the Claude LSP plugins for each stack (TypeScript, Swift, Kotlin, C#, Rust). The sync turns them on in `.claude/settings.json`.

### UI

- `ac ui` starts a local web UI on `127.0.0.1`. The tabs are Projects, Assets, Env, Run, Tests, Usage, Delivery and Promote.
- The Assets tab switches each skill (also each skill of an upstream source), rule, agent, pack, MCP server, Claude plugin, upstream source, managed file, block, owned setting key, seed file and the OpenSpec schema on or off. It shows the set that fits the stack, applies it with one button, and shows the always-on token cost of each asset, of the current set and of the recommended set.
- `ac assets` does the same from the command line: list, `on|off <kind>:<id>`, `recommended`.
- The Projects tab shows the `ac doctor` checks and token items. The Delivery tab pulls Jira issues through jira-cli too.
- The Delivery tab pulls GitHub or GitLab issues, read only.
- `ac usage` shows tokens, cost, cache hit rate and sub-agent share from the Claude Code and Codex transcripts, by day, project, model, provider, session, skill and branch. Each session counts graph calls, searches, edits, searches before the first edit, fresh tokens per message, hook errors, guard fires and stop blocks. The Usage tab shows the hook health and the group medians.
- `ac promote` copies a project skill into compass.

### Migration

- `ac migrate` moves a 0.4 to 0.9 install to 1.0. It deletes a 0.x file that has the same bytes as compass 0.x. It moves an edited file to `migrated/` and keeps the other files.
- `ac migrate --docs` moves spec-kit specs, a root `specs/` folder and question registers to the Konvoy docs layout. Each source moves under `migrated/`.
- `ac init --from-specs <dir>` creates the docs layout and copies the documents into the OpenSpec inbox.
- `ac check --docs` checks the docs layout.
- The migration code is in `migrate/` and loads only for `ac migrate`.

### User plugin

- The plugin `compass-user` carries the `asd-ste100` skill at the pinned sha (no plugin marketplace of its own). `ac doctor --global` recommends `outputStyle` and `attribution` too, counts a hook once per matcher, and measures a command once. The naming lint skips a skill folder that has its own LICENSE.
- The plugin `compass-user` works in every repository. Install it from this repository: `claude plugin marketplace add <path>`, then `claude plugin install compass-user@agent-compass`. Codex and Copilot CLI use the same marketplace.
- It has the hooks, the `compass` output style, the `compass-style` skill and the script `scripts/statusline.mjs`. The status line shows the model, the directory, the cache share and the context size.
- The plugin hook steps back for each event that the project hook runs: the project lock owns the hook key, or the project settings file lists a compass hook for the event. A project that keeps its own hooks still gets the `.env` guard.
- `npm run release -- <version>` sets the version in every file that carries it and adds a CHANGELOG heading. `npm run lint:release` checks that the versions agree.

### Removed

- Gemini support, `CODEX.md`, `GEMINI.md` and `MISSIONS.md`.
- The setup wizard chain, vendoring, the generated `.agent` reports, the self-evaluation loop, pull-knowledge, the OpenSpec guard, the spec-kit bridge and wrappers, and the 0.x migrations.
- 28 skills (spec-kit wrappers, CCG gates, niche converters, the operational pack) and 19 project-flavoured instincts.

Versions before 1.0.0: see the git tags v0.2.0 to v0.9.6.
