# Local UI, usage and promote

## ac ui

```bash
ac ui [--root <dir>] [--port <n>]
```

`ac ui` starts a web server on `127.0.0.1`. The default port is a random free port.
It prints a URL that holds the token. Open the URL. Press Ctrl+C to stop. It has no runtime dependency.

| Tab | Shows | Actions |
|---|---|---|
| Projects | The project root, the compass version in the project and in the checkout, drift, the sync diff, the doctor checks, other projects. See [Doctor](#doctor). | Apply sync. Switch project. |
| Assets | Each skill, rule, agent, pack, MCP server, upstream source, file, block, owned settings key, seed file and OpenSpec schema, with the tokens of each. The always-on context against the target. See [assets.md](assets.md#assets-tab) and [Assets tab](#assets-tab). | Switch an asset. Apply the recommended set. |
| Env | The findings of `ac env check`. The names in each git-ignored local env file, as `set` or `empty`. | Save a value. Export and import an age bundle. |
| Run | The processes of the local stack and their logs. | Up. Down. Follow a log. |
| Tests | The commands in `agent-compass.commands.json` and the history of `.agents/runs/`. | Run a command. Open a log, JUnit or HTML report. |
| Usage | Tokens, cost, cache hit rate and sub-agent share for 7, 30 or 90 days, for Claude Code and Codex. By provider, day, project and model. The 20 largest sessions. See [Usage tab](#usage-tab). | Choose the range and the provider. Refresh. Load the CodexBar quota when `codexbar` is on `PATH`. |
| Delivery | RAID files, tickets, audit rows and ADRs from the docs layout. See [delivery.md](delivery.md#docs-layout). The open issues of GitHub, GitLab or Jira. | Pull GitHub issues. Pull GitLab issues. Pull Jira issues. See [Tracker pull](#tracker-pull). |
| Promote | The project skills that compass does not own. | Preview. Promote. |

The Projects tab lists the other projects of the last 90 days of usage data that have `.agents/compass.json`.

### Security model

- The server listens on `127.0.0.1` only. It accepts only the `Host` values `127.0.0.1:<port>` and `localhost:<port>`.
- The token has 24 random bytes. It is new for each start. The page removes it from the address bar.
  Each API call needs it in the header `x-ac-token`. A GET also accepts `?token=` for the log stream and the report links.
- A POST needs `content-type: application/json`, the same origin and a body of 1 MB or less.
- The page sends a strict content security policy, `no-store` and no framing. It writes server data as text, never as HTML.
- A command is the compass CLI, `codexbar`, `gh`, `glab` or `jira` with fixed arguments. No shell runs. Each command has a timeout and its output has a cap.
- An env value never reaches the page. The page gets names and `set` or `empty`.
  A saved value goes only to a git-ignored local env file from the list, as one line.
- A report route serves only the files of run folders and the report folders that a run result lists. It never serves a dot-file.
- A project switch accepts only a project from the list.

### Doctor

The Projects tab runs `ac doctor --tokens --json` for the project and shows the result below the sync diff.
The route is `GET /api/doctor`. It runs the command with fixed arguments and returns only the checks and the token items.
The tab shows each check with its status (`ok`, `warn` or `fail`), its name and its detail.
It shows the items of the always-on context (name, characters and tokens) with the total and the length of the SessionStart output.
A folder that is not a host project gives one `fail` check and no token items.

### Assets tab

The tab groups the assets by kind: skills, rules, agents, packs, MCP servers, Claude plugins, upstream sources, files, blocks,
"Settings (owned keys)", "Seed files" and "OpenSpec schema".
The Tokens column shows the estimate of an asset (about one token for each four characters). It is empty when the asset has no estimate.
Three tiles show "Always-on now", "With the recommended set" and the "Target" of 2,000 tokens. A tile that is above the target has the warning colour.
The page also shows the note of the estimate. It shows no tile when the answer has no always-on estimate.
A skill of an upstream source that is off shows `not available` with its reason. Switch on the source first.

### Usage tab

The buttons choose the range (7, 30 or 90 days) and the provider (All, Claude or Codex). The route is `GET /api/usage?days=<n>&provider=<name>`.
A provider that is not in the list gives All. The server runs `ac usage --json --provider <name>` once for each range and provider, and keeps the answer for 5 minutes.
Refresh reads the files again.

- The tiles show tokens, cost, cache hit rate and sub-agent share. The tables show tokens, cost and messages by provider, day, project and model.
- The Sessions part shows the count, the median and the p90 of tokens for graph and no-graph sessions. A graph session called a `codebase-memory` MCP tool.
- Below it, a table shows the 20 largest sessions: provider, project, days, messages, tokens, cost, cache hit rate and the graph flag.
  The answer holds the number of all sessions in `sessionCount`.
- A Codex model has no price yet, so its cost is 0. The page names these models.

### Tracker pull

The Delivery tab has the buttons "Pull GitHub issues", "Pull GitLab issues" and "Pull Jira issues". A button runs one of these commands in the project root:

```bash
gh issue list --json number,title,state,labels,assignees,url --limit 100
glab issue list --output json --per-page 100
jira issue list --raw --paginate 0:100
```

The commands only read. Each has a timeout of 20 seconds, no prompt (`GIT_TERMINAL_PROMPT=0`), a cap on the output and no shell.
The cap is 256 KB for `gh` and `glab`, and 4 MB for `jira`. A Jira answer holds all the fields of 100 issues.
The tab shows the number, title, state, labels, assignee and a link for each open issue. It shows at most 100 issues.
The CLI must be on `PATH` and signed in (`gh auth login`, `glab auth login` or `jira init`). If not, the tab shows one short message.
The page holds no token. The CLI keeps its own token (for `jira`, in its keyring or in `JIRA_API_TOKEN`).

For Jira, the page maps the REST issues that `jira` prints (a list, or an object with an `issues` list):

| Column | Jira field |
|---|---|
| Number | `key` |
| Title | `fields.summary` |
| State | `fields.status.name` |
| Labels | `fields.labels` |
| Assignee | `fields.assignee.displayName` |
| Link | The part of `self` before `/rest/`, then `/browse/<key>`. The link is empty when `self` is not an http(s) URL. |

## ac usage

```bash
ac usage [--by session] [--provider claude|codex|all] [--project <root>] [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--json]
```

`ac usage` reads the Claude Code transcripts in `~/.claude/projects` and the Codex sessions in `~/.codex/sessions`.
It shows tokens, cost, cache hit rate and sub-agent share by provider, day, project and model.

- A Claude row counts once for each message id and request id.
- A day is a local day. A worktree counts for its repository root.
- A cost is the list price from the table in `engine/usage.mjs`. It is not a bill. A model without a price costs 0 and the output names it.
- The default range is the first day in the transcripts up to today.
- `--provider` counts only `claude` or only `codex`. The default is `all`. Each row and each session has a `provider`. The result has the totals by provider in `byProvider`.
- `--project <root>` counts only the rows of one repository root.
- `--by session` prints one row for each session (the `sessionId` of the transcript lines, with its sub-agents): project, first and last day, messages, tokens, cost, cache hit rate and provider.
  A session is a graph session when it calls a tool of a `codebase-memory` MCP server. The summary gives the count, the median and the p90 of tokens for graph and no-graph sessions apart.
- `--json` always has `bySession`, `sessionSummary` and `byProvider`, with or without `--by session`.

### Codex sessions

A Codex session is one file: `sessions/YYYY/MM/DD/rollout-*.jsonl` in the Codex folder. `CODEX_HOME` moves the folder from `~/.codex`.
`ac usage` reads each file once and makes one row from it.

| Value | Source in the file |
|---|---|
| Totals | The last `token_count` event that has `info.total_token_usage`. The totals only grow, so the last one is the total. |
| Fresh input | `input_tokens` minus `cached_input_tokens`. |
| Cache read | `cached_input_tokens`. |
| Output | `output_tokens`. It includes the reasoning tokens, because `total_tokens` is `input_tokens` plus `output_tokens`. |
| Day | The local day of `session_meta.payload.timestamp`. A session counts on the day it started. |
| Project | The repository root of `session_meta.payload.cwd`, by the same rule as for Claude. |
| Model | The last `turn_context.payload.model`. A file without one has the model `(unknown)`. |
| Messages | The number of times that `total_tokens` changed. |
| Sub-agent | A `session_meta.payload.source` with a `subagent` key. Its tokens count in the sub-agent share. |
| Graph | The file has an MCP call to a server whose name starts with `codebase-memory`. |

An old file holds only `total_tokens`. Its count is input. A file without `session_meta` or without a total gives no row.
A Codex model has no price yet. Its cost is 0 and the model is in the list of models without a price.

## ac promote

```bash
ac promote              # list the project skills that compass does not own
ac promote <skill>      # check a skill, then copy it into skills/ of this compass checkout
ac promote <skill> --dry
```

A project skill is a folder in `.claude/skills/` that neither the compass lock nor the Konvoy ledger owns.
Its name in compass drops the `<project>-` prefix. The project copy stays.
The check refuses a line that looks like a secret, the project name, an absolute path, a symlink and an existing target skill.
It warns when the frontmatter has no `risk_level` or `requires_tools`. Review and commit the new skill in the compass repository.
