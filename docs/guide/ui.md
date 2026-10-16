# Local UI, usage and promote

## ac ui

```bash
ac ui [--root <dir>] [--port <n>]
```

`ac ui` starts a web server on `127.0.0.1`. The default port is a random free port.
It prints a URL that holds the token. Open the URL. Press Ctrl+C to stop. It has no runtime dependency.

| Tab | Shows | Actions |
|---|---|---|
| Projects | The project root, the compass version in the project and in the checkout, drift, the sync diff, other projects. | Apply sync. Switch project. |
| Assets | Each skill, rule, agent, pack, MCP server and upstream source. See [assets.md](assets.md#assets-tab). | Switch an asset. Apply the recommended set. |
| Env | The findings of `ac env check`. The names in each git-ignored local env file, as `set` or `empty`. | Save a value. Export and import an age bundle. |
| Run | The processes of the local stack and their logs. | Up. Down. Follow a log. |
| Tests | The commands in `agent-compass.commands.json` and the history of `.agents/runs/`. | Run a command. Open a log, JUnit or HTML report. |
| Usage | Tokens, cost, cache hit rate and sub-agent share for 7, 30 or 90 days, by day, project and model. | Refresh. Load the CodexBar quota when `codexbar` is on `PATH`. |
| Delivery | RAID files, tickets, audit rows and ADRs from the docs layout. See [delivery.md](delivery.md#docs-layout). | None. The tab is read-only. |
| Promote | The project skills that compass does not own. | Preview. Promote. |

The Projects tab lists the other projects of the last 90 days of usage data that have `.agents/compass.json`.

### Security model

- The server listens on `127.0.0.1` only. It accepts only the `Host` values `127.0.0.1:<port>` and `localhost:<port>`.
- The token has 24 random bytes. It is new for each start. The page removes it from the address bar.
  Each API call needs it in the header `x-ac-token`. A GET also accepts `?token=` for the log stream and the report links.
- A POST needs `content-type: application/json`, the same origin and a body of 1 MB or less.
- The page sends a strict content security policy, `no-store` and no framing. It writes server data as text, never as HTML.
- A command is the compass CLI or `codexbar` with fixed arguments. No shell runs. Each command has a timeout and its output has a cap.
- An env value never reaches the page. The page gets names and `set` or `empty`.
  A saved value goes only to a git-ignored local env file from the list, as one line.
- A report route serves only the files of run folders and the report folders that a run result lists. It never serves a dot-file.
- A project switch accepts only a project from the list.

## ac usage

```bash
ac usage [--since YYYY-MM-DD] [--until YYYY-MM-DD] [--json]
```

`ac usage` reads the Claude Code transcripts in `~/.claude/projects`. It shows tokens, cost, cache hit rate and sub-agent share by day, project and model.

- A row counts once for each message id and request id.
- A day is a local day. A worktree counts for its repository root.
- A cost is the list price from the table in `engine/usage.mjs`. It is not a bill. A model without a price costs 0 and the output names it.
- The default range is the first day in the transcripts up to today.

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
