# Install and update

`ac` stands for `node docs/agent-compass/bin/ac.mjs`. Run it from the project root.
It needs Node 20.12 or later and git. It never prompts.

Exit 0 is success. Exit 1 is an error or drift. Exit 2 is a usage error.
`init`, `sync`, `check`, `doctor` and `migrate` take `--root <dir>`, `--dry` (show the changes and write nothing) and `--json`. The other commands list their options in `--help`.
Without `--root`, `sync`, `check` and `doctor` find the project root above the current folder: the nearest folder with `.agents/compass.json` or `.git`.

## Install

1. Add compass as a submodule. Check out a release tag.
   ```bash
   git submodule add <compass-url> docs/agent-compass
   git -C docs/agent-compass checkout <tag>
   ```
2. Run `ac init`. It creates `.agents/compass.json`, then syncs.
3. Run `ac doctor`. Fix each `fail` line.
4. Run `ac check --frozen`. It must pass.
5. Commit the submodule, `.gitmodules`, `.agents/` and the generated files.

A project that has input documents runs `ac init --from-specs <dir>`. See [Start from documents](delivery.md#start-from-documents).

## What sync does

`ac sync` fetches the sources in `upstream`, plans the files, keys and blocks, and compares each item with the project and the lock.

| State of the item | Action |
|---|---|
| Missing | Create it. |
| Same as the plan | No change. |
| Same as the lock (nobody edited it) | Update it. |
| Edited in the project | Keep it. Report `kept`. |
| Not in the plan, not edited | Remove it. |
| Not in the plan, edited | Release it. The file stays. |
| Seed file | Write it once. The project owns it then. |

Two syncs in a row give no diff. The lock has no timestamp.
A `kept` item has a note: `compass has a newer version` when the plan differs from the lock, else `no compass change`.
`ac check --diff` shows a unified diff of each kept file, block and single-value key against the compass version.
To take an update for a `kept` item, revert the file. To stop updates for it, add its path to `exclude` (see [assets.md](assets.md#exclude)).

Sync stops with an error in these cases. It writes nothing.

- The lock is from a newer compass than the checkout, for example after a pull with a stale submodule. Run `git submodule update --init`. To go back to an older compass on purpose, run `ac sync --to <tag>`.
- The lock or a managed file has git conflict markers (`<<<<<<<`). Take one side, or delete the lock. Then run `ac sync`.
- A fetched upstream source has bidi controls or tag characters in a skill file: a warning names each file, that source stays out of the cache, and the other sources install. Zero-width characters and a byte order mark at the start of a file are allowed.

### Your own hooks and permissions

`.claude/settings.json` and `.codex/hooks.json` can hold your hook groups. `.claude/settings.json` can hold your `permissions.deny` and `permissions.ask` strings.
Compass adds its own entries after yours in `hooks.PreToolUse`, `hooks.Stop`, `hooks.SessionStart`, `permissions.deny` and `permissions.ask`.
It does not change, remove or reorder an entry of yours. It writes that array again with the indent of the file (2 spaces when the file has no indent), so the layout of your entries can change.

- Compass removes an entry of its own when the plan drops it and you did not edit it.
- A compass hook group that you edited stays. Sync reports `kept` and adds no second group. Revert your edit to take the compass group again.
- When you delete a compass entry, `ac check --frozen` fails. `ac sync` adds the entry again.
- To keep the compass entries of one key out, add `<file>#<key>` to `exclude`. Your entries stay. `ac doctor` warns about an exclude of an array key that the merge makes unnecessary: the planned value and your value are both arrays, and Konvoy does not own the file or the key.
- A host value that is not an array stays `kept`.

See [rule 12 of the ownership contract](../contract/ownership.md#array-keys).

### Copilot hooks

Compass writes `.github/hooks/compass.json` from its hook keys in `.claude/settings.json`. The Copilot cloud agent and the Copilot CLI read this file.
The file uses the events `PreToolUse`, `Stop` and `SessionStart`. With these PascalCase names, Copilot sends the Claude payload and uses the Claude tool names and matcher.
Each entry runs in the repository root (`"cwd": "."`).

- The `guard` blocks a tool call in Copilot as in Claude: exit code 2 is a deny.
- The Copilot entries run the hook with `--copilot`. In that mode the hook prints the JSON that Copilot reads: `additionalContext` for the start text, `permissionDecision: "deny"` for a blocked tool call, and `decision: "block"` with the reason for the gate, so all three events work in the cloud agent too.
- An exclude of `.claude/settings.json#hooks.<event>` also removes that event from the Copilot file. To keep the whole file out, add `.github/hooks/compass.json` to `exclude`.

The Copilot CLI also reads the hooks of `.claude/settings.json`. Copilot runs the hook entries of all sources, so a local Copilot CLI session runs each compass hook two times.
The result is the same, because the two runs block or pass the same call. A block message can show two times.
Copilot has no setting that removes a duplicate hook. `disableAllHooks` stops all hooks of a file or of all sources, so it does not help here.
If no one uses the Copilot cloud agent, add `.github/hooks/compass.json` to `exclude`.

## What compass writes

| Path | Provider | Content |
|---|---|---|
| `AGENTS.md`, `CLAUDE.md` | all | The text between `<!-- compass:begin -->` and `<!-- compass:end -->`. |
| `.agents/skills/<name>/`, `.claude/skills/<name>/` | all | The same skill bytes in both folders. |
| `.claude/rules/stack-*.md`, `.agents/skills/stack-*/` | Claude, Copilot / Codex | Stack rules. Codex gets them as skills. |
| `.claude/agents/*.md`, `.codex/agents/*.toml`, `.github/agents/*.agent.md` | Claude / Codex / Copilot | Role agents with model pins. |
| `.claude/output-styles/compass.md`, `.claude/workflows/deliver.js` | Claude | Output style and the `deliver` workflow. |
| `.agents/hooks/compass.mjs` | Claude, Codex, Copilot | The `guard`, `gate` and `start` hooks. |
| `.github/hooks/compass.json` | Copilot | The hook entries for Copilot. See [Copilot hooks](#copilot-hooks). |
| Keys in `.claude/settings.json`, `.codex/config.toml`, `.codex/hooks.json` | Claude / Codex | Output style, hooks, permissions, `model_verbosity`. |
| Keys in `.mcp.json`, `.codex/config.toml`, `.vscode/mcp.json` | Claude / Codex / Copilot | MCP servers. |
| `.agents/compass.lock.json` | all | The state that `ac check` compares. |

Seed files are the exception: pack files such as CI workflows, `renovate.json` and `.osv-scanner.toml`.
The first sync writes them. After that the project owns them.

Compass writes only the paths, keys and blocks in this table. The project and Konvoy own the rest.
See the [ownership contract](../contract/ownership.md).

## Configuration

`.agents/compass.json` holds the project choices. `ac init` creates it.

| Key | Content |
|---|---|
| `version` | The format version. It is `1`. |
| `packs` | Pack names to install, in addition to the detected packs. |
| `exclude` | Names and paths that sync does not install. |
| `upstream` | Ids of the pinned upstream skill sources to install. |
| `mcp` | Names of the MCP servers to install. |
| `paths` | Docs path keys. Compass ignores them when `.agents/konvoy.json` exists. |

Choose `packs`, `exclude`, `upstream` and `mcp` in [assets.md](assets.md). The path keys are in the [ownership contract](../contract/ownership.md#path-keys).

## Update

```bash
ac sync --dry          # read the changes
ac sync                # apply them
ac sync --to <tag>     # check out a release tag in the submodule, then sync with its engine
```

`--to` needs a clean submodule and a tag that has `bin/ac.mjs`. Commit the submodule change.
After an update, run `ac check --frozen` and `ac doctor --tokens`.
The lock keeps its tag only while the compass version stays the same.

`ac doctor` also warns when:

- The compass submodule is not at the commit that the project records, or a local tag is newer than the checkout.
- The project is not a git repository. The Codex hooks use `git rev-parse`.
- The language server of an enabled LSP plugin is not on PATH.
- The project has no code graph index (`codebase-memory-mcp cli index_status`). A failure of that command is a warning only.
- The command of an MCP server is older than its `minVersion` in the catalog.

It prints one line when `.codex/hooks.json` exists: Codex runs the project hooks only after you trust them with `/hooks`.
A sync that creates or changes a compass key in `.codex/hooks.json` also gives the warning "Codex: approve the changed hooks in /hooks before they run". It prints one line with the count of open items of `ac doctor --global`.

## Check in CI

`ac check --frozen` exits 1 when the project is different from the lock. It writes nothing.
The `ci-github` and `ci-gitlab` packs add a `compass-check` job that runs it. To fix a failure, run `ac sync` and commit the result.
Compass manages `.github/workflows/compass-check.yml` and `.gitlab/compass/check.yml`. Sync writes the path of the compass checkout into `COMPASS_DIR`.
A project that has the older seed copy of one of these files keeps it as `kept`, so `ac check --frozen` fails. Delete the file and run `ac sync` to get the managed file.
To keep your copy, add its path to `exclude`. The other CI files of the packs stay seed files.

The `renovate` pack seeds a `renovate.json` with the `git-submodules` manager. Set `branch = <release tag>` for the compass submodule in `.gitmodules`.
Renovate then proposes the next tag. Run `ac sync` in the update branch.

## Budgets

`ac doctor --tokens` measures the context that compass adds to every session. It fails above these limits:

- 2,000 tokens for the compass blocks, the skill and agent listings, the output style and the hook output.
- 1,000 characters for the output of the `SessionStart` hook.

The token count is an estimate of 4 characters for each token.

## User level

The plugin `compass-user` applies the style contract in every repository, not only in a compass project. It has the compass hooks, the answer-shape output style,
the `compass-style` skill and a cache-aware status line. Install it once for each provider. The path is the compass checkout.

```bash
claude plugin marketplace add <path> && claude plugin install compass-user@agent-compass
codex plugin marketplace add <path> && codex plugin add compass-user@agent-compass
copilot plugin marketplace add <path> && copilot plugin install compass-user@agent-compass
```

`ac doctor --global` reads your user-level Claude Code and Codex setup and writes nothing. It lists the enabled plugins, the MCP servers and the hooks of four events: `SessionStart`, `UserPromptSubmit`, `SubagentStart` and `PreCompact`. These events put text into the context.
It names each item of the recommended set that is missing, with the command that fixes it. `--measure` runs each `SessionStart` hook once and counts its output.
It warns above 15 plugins, 10 MCP servers, 1,000 characters for one hook and 2,000 characters for all hooks.

## Migrate a 0.x project

`ac migrate` moves a compass 0.4 to 0.9 install to 1.0. Run `ac migrate --dry` first.

- It deletes each 0.x file that has the same bytes as compass 0.x placed.
- It moves an edited file that 1.0 also writes to `migrated/`. It keeps and lists the other files.
- It converts `agent-compass.answers.json` to `.agents/compass.json`, then syncs.

`ac migrate --docs` moves spec-kit specs, a root `specs/` folder and single-file question registers to the Konvoy docs layout.
Each source moves under `migrated/`. The command deletes nothing. See [delivery.md](delivery.md#docs-layout).
