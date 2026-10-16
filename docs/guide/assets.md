# Assets

An asset is a thing that `ac sync` installs. Each asset is on or off.
Change the choice in `.agents/compass.json`, or use the Assets tab of `ac ui` (see [Assets tab](#assets-tab)). Then run `ac sync`.

| Kind | Source | On when |
|---|---|---|
| Skill | `skills/`, `packs/<name>/skills/` | Always. A skill with `metadata.stacks` needs a detected stack. |
| Stack rule | `rules/stack-*.md` | The project has a stack that the rule lists. |
| Role agent | `core/agents/*.md` | Always. |
| Pack | `packs/<name>/` | The project matches its signal, or `packs` lists it. |
| MCP server | `mcp/catalog.json` | A detected stack lists it, or `mcp` lists it. |
| Claude plugin | `mcp/catalog.json` (`plugins`) | A detected stack lists it, or `plugins` lists it. |
| Upstream source | `upstream.json` | `upstream` lists it. |

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
| `ci-github` | Opt in. Recommended with `.github/workflows/`. | Five seed workflows `compass-*.yml`. |
| `ci-gitlab` | Opt in. Recommended with `.gitlab-ci.yml`. | Five seed files in `.gitlab/compass/`. |
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

`upstream.json` pins third-party skill sources. Each source has a repository, a 40-character `sha`, a licence, a list of skills and optional `stacks`.
Compass keeps no copy. `ac sync` fetches the commit of each source in `upstream` into `~/.cache/agent-compass/upstream/` (`AC_CACHE` changes it).
It copies the skills as they are, with the licence file beside each one. A failed fetch is a warning, and the installed copy stays.

| Source id | Skills | Stacks |
|---|---|---|
| `ponytail`, `caveman`, `i-have-adhd`, `asd-ste100` | The style contract. See [agents.md](agents.md#style-contract). | All |
| `mattpocock` | `grill-me`, `grilling`, `grill-with-docs`, `to-questionnaire`, `wayfinder`, `handoff`, `tdd` | All |
| `taste` | Frontend design direction | `react-web`, `next-web`, `angular-web` |
| `android`, `swift-ios`, `dimillian`, `agent-device` | Native and device skills. See [native.md](native.md). | Native and Expo stacks |
| `apple-macos`, `winui`, `gtk` | Desktop review and development | `macos-desktop`, `winui-desktop`, `gtk-desktop` |

A third-party skill is text that you did not write. It cannot relax a compass rule.
The `swift-ios` source has a PolyForm Perimeter licence. Read each `licence` in `upstream.json` before you install a source.

## Exclude

`exclude` in `.agents/compass.json` switches an asset off. An entry has one of these forms:

| Entry | Switches off |
|---|---|
| `<name>` | A skill, or a stack rule such as `stack-react`. |
| `<path>` | One file or rule, for example `.claude/rules/stack-react.md`. `AGENTS.md` removes the compass block in that file. |
| `<dir>/` | Each file below that folder. |
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
- An upstream source with no `stacks`, or with a detected stack.
- A skill, rule or agent with no `stacks`, or with a detected stack. An asset that does not fit shows as "not available". You cannot switch it on.

## Assets tab

`ac ui` shows each asset with a switch, in groups such as Skills, MCP servers and Claude plugins. The filters are all, recommended, on and off. A search box narrows the list.
A badge says why an asset is recommended or not available. A switch writes `.agents/compass.json` only, then the tab shows the sync diff.
The button "Apply the recommended set" turns on every recommended asset and keeps your other excludes.
A detected pack, and the MCP servers and plugins of a detected stack, stay automatic. The button "Apply sync" runs `ac sync`.
