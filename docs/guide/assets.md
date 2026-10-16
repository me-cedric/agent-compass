# Assets

An asset is a thing that `ac sync` installs. Each asset is on or off.
Change the choice in `.agents/compass.json`, with `ac assets` (see [ac assets](#ac-assets)), or use the Assets tab of `ac ui` (see [Assets tab](#assets-tab)). Then run `ac sync`.

| Kind | Source | On when |
|---|---|---|
| Skill | `skills/`, `packs/<name>/skills/` | Always. A skill with `metadata.stacks` needs a detected stack. |
| Stack rule | `rules/stack-*.md` | The project has a stack that the rule lists. |
| Role agent | `core/agents/*.md` | Always. |
| Pack | `packs/<name>/` | The project matches its signal, or `packs` lists it. |
| MCP server | `mcp/catalog.json` | A detected stack lists it, or `mcp` lists it. |
| Claude plugin | `mcp/catalog.json` (`plugins`) | A detected stack lists it, or `plugins` lists it. |
| Upstream source | `upstream.json` | `upstream` lists it. |
| Upstream skill | A skill of an upstream source | Its source is on. |
| Managed file, block | `files/`, `blocks/` of a layer | Always. A pack file needs its pack. |
| Key | `keys.json` of `core/` and of a pack | Always. One asset for each owned key. |
| Seed file | `seed/` of `core/` and of a pack | Its pack is on. |
| OpenSpec schema | `core/openspec/konvoy-delivery/` | The OpenSpec folder exists and Konvoy does not own the schema. |

## Asset kinds and marks

The kinds, in the order of the lists: `skill`, `rule`, `agent`, `pack`, `mcp`, `plugin`, `upstream`, `file`, `block`, `key`, `seed`, `schema`.
Each asset has an id. The mark is the entry that `exclude` takes to switch the asset off.

| Kind | Id | Mark in `exclude` |
|---|---|---|
| `skill` | The skill name. | The name. |
| `rule` | `.claude/rules/<file>` | The path, or `stack-<name>`. |
| `agent`, `pack`, `mcp`, `plugin` | The name or the plugin id. | `agent:<id>`, `pack:<id>`, `mcp:<id>`, `plugin:<id>` |
| `upstream` | The source id. | None: remove the id from `upstream`. |
| `file`, `block`, `seed` | The path in the project. | The path. |
| `key` | `<file>#<key>`, for example `.claude/settings.json#hooks.PreToolUse`. | The id. |
| `schema` | The schema folder with a trailing slash, for example `docs/openspec/schemas/konvoy-delivery/`. | The id. |

## Stacks

Detection reads dependencies and marker files in the whole workspace, three folder levels deep. `ac doctor` prints the result.
The stack ids are `nestjs-api`, `angular-web`, `react-web`, `next-web`, `expo-mobile`, `android-compose`, `swift-ios`,
`drizzle-postgres`, `bullmq`, `turbo-monorepo`, `gtk-desktop`, `winui-desktop`, `macos-desktop`, `spec-kit` and `openspec`.

## Skills

The skill list is in [skills/README.md](../../skills/README.md). Compass copies each skill folder to `.agents/skills/` and `.claude/skills/`.
Compass replaces path placeholders such as `{{DELIVERY_DIR}}` with the project paths. An unknown placeholder is an install error.

## Stack rules

A rule is a Markdown file with `paths` and `stacks` in its frontmatter. Claude and Copilot read it from `.claude/rules/`.
Codex has no path-scoped rules, so compass also installs it as the Codex skill `stack-<name>`.

| Rule | Stacks |
|---|---|
| `stack-nestjs` | `nestjs-api` |
| `stack-drizzle` | `drizzle-postgres` |
| `stack-react` | `react-web`, `next-web` |
| `stack-angular` | `angular-web` |
| `stack-expo` | `expo-mobile` |
| `stack-swift` | `swift-ios`, `macos-desktop` |
| `stack-android` | `android-compose` |
| `stack-macos`, `stack-gtk`, `stack-winui` | `macos-desktop`, `gtk-desktop`, `winui-desktop` |

## Role agents

There are three roles. `scout` does read-only lookups. `worker` makes one bounded change. `reviewer` reviews a diff in a fresh context.
A role file has one source: `core/agents/<role>.md`. Its frontmatter pins the model for each provider:
`model` (Claude), `codex-model` and `codex-effort` (Codex), `copilot-model` (Copilot).
Sync writes `.claude/agents/<role>.md`, `.codex/agents/<role>.toml` and, with `copilot-model`, `.github/agents/<role>.agent.md`.
See [agents.md](agents.md#delegation) for when to use each role.

## Packs

A pack is a folder with `skills/`, `agents/`, `rules/`, `files/`, `seed/`, `blocks/` or `keys.json`, like the compass root.
A `seed/` file is written once. A folder `extras/` holds reference files that sync does not install.

| Pack | On when | Installs |
|---|---|---|
| `env` | `.env*.example`, `.env*.sample` or `env.catalog.json` exists | Skill `env`. |
| `local-run` | `process-compose*.yaml` or a compose file exists | Skill `local-run`. |
| `e2e` | A Playwright config, a `.maestro` folder or `@playwright/test` exists | Skill `e2e`. |
| `security` | `.osv-scanner.toml` or `sonar-project*.properties` exists | Skill `vuln-triage`, seed `.osv-scanner.toml`. |
| `ci-github` | Opt in. Not in the recommended set: set the install and test commands in each seed first. | Five seed workflows `compass-*.yml`. |
| `ci-gitlab` | Opt in. Not in the recommended set: set the install and test commands in each seed first. | Five seed files in `.gitlab/compass/`. |
| `renovate` | Opt in. Recommended with the compass submodule and no Renovate config. | Seed `renovate.json`. |

Use the packs in [dev-loop.md](dev-loop.md) and [quality.md](quality.md).

## MCP servers

`mcp/catalog.json` lists the servers. Each entry has a `status` (`adopt` or `trial`), a read-only guard and the secrets it needs.
A server installs when a detected stack lists it in `stacks`, or when `mcp` in `.agents/compass.json` lists it.
The stack `*` means every project. A `suggest` signal (for example `github` or `helm`) or `*` only recommends it. A `trial` server prints a warning.
`ac doctor` warns once for each command of a selected server that is not on `PATH` (`codebase-memory-mcp`, `uvx`, `npx`). It does not use the network.

| Server | Use | Read-only guard |
|---|---|---|
| `grafana` | Dashboards, logs, metrics | `--disable-write` |
| `argocd` | State of Argo CD applications | `MCP_READ_ONLY=true` |
| `kubernetes` | Cluster resources | `--read-only`, and `.agents/mcp/kubernetes.toml` denies Secret |
| `scaleway` (trial) | Scaleway resources | `--read-only` |
| `mcp-atlassian` | Jira issues | `READ_ONLY_MODE=true`, and the deny rules of compass |
| `github` | Repositories, issues, pull requests | Header `X-MCP-Readonly: true` |
| `sonarqube` | Issues, quality gates, metrics | `SONARQUBE_READ_ONLY=true` |
| `dbhub` | Schema and read-only SQL | `readonly = true` in `.agents/mcp/dbhub.toml`. Use a read-only database role too. |
| `figma` (Claude only) | Designs and variables | Deny rules block the tools that write to Figma |
| `playwright`, `chrome-devtools` | A local browser. Stacks `react-web`, `angular-web`, `next-web`. | Not applicable. Chrome DevTools has its statistics off. |
| `storybook` | Components of a running Storybook | Not applicable |
| `maestro`, `agent-device`, `xcodebuildmcp` | Mobile and Apple builds, on a device or simulator | Not applicable |
| `process-compose` (Claude, Copilot) | State and logs of the local stack | Not applicable. Listens on port 3000. |
| `codebase-memory` | Code graph of symbols, callers and architecture. On in every project (stack `*`). | Not applicable. The server indexes into a local database. |
| `context7` | Library docs. Recommended, never installed by itself. | Not applicable |
| `projectmem` (trial) | Durable project memory in `.projectmem/events.jsonl`. No stack selects it. Add it to `mcp`. | Not applicable. Never log a secret. |

A secret is the text `${VAR}` and nothing else. Compass never writes a value.
Claude expands `${VAR}` itself and Copilot reads `${env:VAR}`. Codex cannot expand it, so the Codex entry names the variable.
Sync writes each server to `.mcp.json` (`mcpServers`), `.codex/config.toml` (`mcp_servers`) and `.vscode/mcp.json` (`servers`).
A server can also add a file in `.agents/mcp/` and deny rules in `.claude/settings.json`.

## Claude plugins

The `plugins` object in `mcp/catalog.json` lists one language server (LSP) plugin for each language.
`ac sync` writes `enabledPlugins.<id>` as `true` in `.claude/settings.json` for each plugin that fits a detected stack. Claude Code then asks the user to install it.
A key that the project already has stays as it is: compass keeps it and `ac doctor` warns.

| Plugin | Stacks |
|---|---|
| `typescript-lsp@claude-plugins-official` | `nestjs-api`, `react-web`, `next-web`, `angular-web`, `expo-mobile`, `turbo-monorepo` |
| `swift-lsp@claude-plugins-official` | `swift-ios`, `macos-desktop` |
| `kotlin-lsp@claude-plugins-official` | `android-compose` |
| `csharp-lsp@claude-plugins-official` | `winui-desktop` |
| `rust-analyzer-lsp@claude-plugins-official` | `gtk-desktop` |

Add a plugin that no stack selects with `plugins` in `.agents/compass.json`. Remove one with `plugin:<id>` in `exclude`.
Only Claude Code reads the `enabledPlugins` setting.

## Upstream sources

`upstream.json` pins third-party skill sources. Each source has a repository, a 40-character `sha`, a licence, a list of skills, optional `stacks` and an optional `recommend`.
`recommend: "user"` marks a style source that the `compass-user` plugin covers (ponytail, caveman, i-have-adhd, asd-ste100). `recommend: "manual"` marks a large set (taste, swift-ios). Neither one is in the recommended set; you can still switch it on.
Three repositories have two entries: a small core in the recommended set (`mattpocock`, `dimillian`, `agent-device`) and the rest by hand (`mattpocock-more`, `dimillian-more`, `agent-device-tools`). Each model-invoked skill adds its description to the always-on listing, so the recommended set keeps a mobile or multi-stack host below 2,000 tokens.
Compass keeps no copy. `ac sync` fetches the commit of each source in `upstream` into `~/.cache/agent-compass/upstream/` (`AC_CACHE` changes it).
It copies the skills as they are, with the licence file beside each one. A failed fetch is a warning, and the installed copy stays.
Each skill of a source is a `skill` asset with the source `upstream:<id>`. It is available only when its source is on. Switch one skill off with its name in `exclude`.

| Source id | Skills | Stacks |
|---|---|---|
| `ponytail`, `caveman`, `i-have-adhd`, `asd-ste100` | The style contract. See [agents.md](agents.md#style-contract). | All |
| `mattpocock` | `grill-me`, `grilling` (the `grill` skill uses them) | All |
| `mattpocock-more` | `grill-with-docs`, `to-questionnaire`, `wayfinder`, `handoff`, `tdd` (by hand) | All |
| `taste` | Frontend design direction | `react-web`, `next-web`, `angular-web` |
| `android`, `swift-ios`, `dimillian`, `agent-device` | Native and device skills. See [native.md](native.md). | Native and Expo stacks |
| `dimillian-more`, `agent-device-tools` | The other SwiftUI skills; `android-emulator`, `dogfood`, `ios-simulator` (by hand) | Native and Expo stacks |
| `apple-macos`, `winui`, `gtk` | Desktop review and development | `macos-desktop`, `winui-desktop`, `gtk-desktop` |

A third-party skill is text that you did not write. It cannot relax a compass rule.
The `swift-ios` source has a PolyForm Perimeter licence. Read each `licence` in `upstream.json` before you install a source.

## Keys, seeds and the schema

A key is one owned key that a `keys.json` sets. The title says what the key does:

| Title | Key | What it does |
|---|---|---|
| output style | `.claude/settings.json#outputStyle` | Selects the compass output style. |
| guard, gate, start | `.claude/settings.json#hooks.PreToolUse`, `#hooks.Stop`, `#hooks.SessionStart` | The three hooks of `.agents/hooks/compass.mjs`. |
| tracker deny, tracker ask | `.claude/settings.json#permissions.deny`, `#permissions.ask` | Block or ask for a tracker write. The deny patterns of the MCP servers join `permissions.deny`, so one switch removes them all. |
| Codex verbosity, Codex reasoning summary | `.codex/config.toml#model_verbosity`, `#model_reasoning_summary` | Keep the Codex answers short. |
| Codex guard, Codex gate, Codex start | `.codex/hooks.json#hooks.PreToolUse`, `#hooks.Stop`, `#hooks.SessionStart` | The same three hooks for Codex. |

A seed file is written once, then the project owns it. A seed of a pack that is off turns the pack on when you switch the seed on.
The schema asset is the folder `<openspec>/schemas/konvoy-delivery/`. It is not available when the OpenSpec folder is missing or when Konvoy owns the schema.

## Token cost

The listing of an asset shows `tokens`, about 4 characters for each token:

- A skill or an agent: its listing line (`- name: description`). A skill with `disable-model-invocation: true` costs 0.
- A block: its text. An output style file: its body.
- An upstream skill: its listing line, when the source is in the cache. Without the cache the asset has no `tokens`.

The sum of the figures of the skills is the "skill listing" line of `ac doctor --tokens`. Both use `estimatePlan` in `engine/tokens.mjs`.
`always.current` is the text that the current config puts in the always-on context. `always.recommended` is the same for the recommended set. The budget is 2,000 tokens.
The estimate counts text only. It does not count the output of the SessionStart hook, and it does not count the skills of an upstream source that is not in the cache yet (`ac sync` fetches it).

## ac assets

```bash
ac assets                          # list the assets by kind, with state, tokens and reason
ac assets --json                   # the same as JSON (the list that the UI shows)
ac assets off skill:review         # switch one asset off in .agents/compass.json
ac assets on key:.claude/settings.json#hooks.Stop
ac assets recommended              # switch on every recommended asset
```

An asset is `<kind>:<id>` (see [Asset kinds and marks](#asset-kinds-and-marks)). `on`, `off` and `recommended` write `.agents/compass.json` only, then print the sync diff as `ac sync --dry` does.
Run `ac sync` to apply it. `on` fails for an asset that is not available and prints the reason. The text list hides the skills of an upstream source that is off.
Exit 0 is success, 1 is an error, 2 is a usage error. The options are `--root <dir>` and `--json`.

## Exclude

`exclude` in `.agents/compass.json` switches an asset off. An entry has one of these forms:

| Entry | Switches off |
|---|---|
| `<name>` | A skill (also one skill of an upstream source), or a stack rule such as `stack-react`. |
| `<path>` | One file, seed file or rule, for example `.claude/rules/stack-react.md`. `AGENTS.md` removes the compass block in that file. |
| `<dir>/` | Each file below that folder, for example the OpenSpec schema `docs/openspec/schemas/konvoy-delivery/`. |
| `<file>#<key>` | One owned key, for example `.claude/settings.json#permissions.deny`. |
| `agent:<name>` | A role agent, with its Claude, Codex and Copilot files. |
| `pack:<name>` | A pack, even a detected one. |
| `mcp:<name>` | An MCP server. |
| `plugin:<id>` | A Claude plugin, for example `plugin:typescript-lsp@claude-plugins-official`. |

Compass removes a file that it placed earlier and nobody edited. It keeps an edited file.

## Recommended set

An asset is recommended when it fits the project:

- A pack that detection finds, or a CI pack whose signal exists, or `renovate` with the submodule and no Renovate config.
- An MCP server or a Claude plugin that a detected stack lists. An MCP server that a signal lists, or that is a baseline server.
- An upstream source with no `stacks`, or with a detected stack, and without `recommend`.
- A skill, rule or agent with no `stacks`, or with a detected stack. An asset that does not fit shows as "not available". You cannot switch it on.
- A key is always recommended. A seed follows its pack. The schema is recommended when the OpenSpec folder exists. An upstream skill follows its source.

## Assets tab

`ac ui` shows each asset with a switch, in groups such as Skills, MCP servers and Claude plugins. The filters are all, recommended, on and off. A search box narrows the list.
A badge says why an asset is recommended or not available. A switch writes `.agents/compass.json` only, then the tab shows the sync diff.
Each asset shows its `tokens`, and the tab shows the always-on estimate against the 2,000-token budget (see [Token cost](#token-cost)).
The switch of the hook script `.agents/hooks/compass.mjs` also switches the hook keys that call it in `.claude/settings.json` and `.codex/hooks.json`, so no hook calls a missing file.
The button "Apply the recommended set" turns on every recommended asset and keeps your other excludes.
A detected pack, and the MCP servers and plugins of a detected stack, stay automatic. The button "Apply sync" runs `ac sync`.
