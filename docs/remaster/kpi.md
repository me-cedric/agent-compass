# KPI: tokens per task, with and without the code graph

Phase 11 of the plan sets `codebase-memory` as a default MCP server. This file defines the measurement and holds the "before" numbers.
The "after" half needs 14 days of real use. It is open.

## Method

- A task is one session: the `sessionId` of the transcript lines. A sub-agent has the `sessionId` of its parent, so its tokens count for the parent.
- Tokens of a session are input + output + cache write + cache read.
- A session is a graph session when one of its lines calls a tool whose name starts with `mcp__codebase-memory`. Other sessions are no-graph sessions.
- Compare the median of tokens for graph and no-graph sessions in the same project. Read the p90 too: token counts have a long tail.
  The median and the p90 use linear interpolation. Do not compare two projects.
- Use a project only when it has 5 sessions or more in the group. A smaller group is "not enough data".
- The window is 14 days.

Limits of the method:

- A session is not always one task. A long session can hold many tasks, and a task can use many sessions.
- Task size is not controlled. Before 2026-10-02 the graph sessions were much larger than the others (median 243,944,356 against 17,860,162 tokens since 2026-08-01), so a comparison of all sessions is wrong. Compare inside one project only.
- The folder `observer-sessions` holds the sessions of the personal `claude-mem` observer. It is not a project, so the tables leave it out.
- A cost is the list price, not a bill.

## Commands

```bash
# All sessions of the last 14 days: the rows (bySession) and the summary (sessionSummary).
ac usage --by session --since YYYY-MM-DD --json

# One project: the summary has the count, the median and the p90 of tokens for graph and no-graph sessions.
ac usage --by session --project <root> --since YYYY-MM-DD --until YYYY-MM-DD
```

To find the projects with 5 sessions or more, count the rows of each `project` in `bySession`.

## Before

Recorded on 2026-10-16 from the transcripts of one machine. Window: 2026-10-02 to 2026-10-16. The sessions of the remaster work in `agent-compass` are part of the numbers.
The command for each project was `ac usage --by session --project <root> --since 2026-10-02 --json`.

| Project | Sessions | Graph sessions | Median tokens | p90 tokens |
|---|---|---|---|---|
| parcus-plus | 5 | 0 | 65,656,737 | 461,261,359 |
| agent-compass | 7 | 0 | 40,767,813 | 151,358,645 |
| All projects except `observer-sessions` | 18 | 0 | 38,775,926 | 366,171,236 |

Two projects have 5 sessions or more. The other projects have 3 sessions or fewer.

No session in the window called a `codebase-memory` tool, so the "before" numbers are all no-graph numbers.
The graph was in use before the window: 8 of 231 sessions since 2026-08-01 called it. These sessions are too few, and too different in size, to serve as a baseline.

## After

Open. Window: 2026-10-17 to 2026-10-30 (14 days), with the graph installed in each project by `ac sync`. Fill this table on 2026-10-31 or later.
The command for each project is `ac usage --by session --project <root> --since 2026-10-17 --until 2026-10-30`.

| Project | Graph sessions | Median tokens (graph) | p90 tokens (graph) | No-graph sessions | Median tokens (no graph) | p90 tokens (no graph) |
|---|---|---|---|---|---|---|
| parcus-plus | | | | | | |
| agent-compass | | | | | | |

Read the result with the "before" table: a drop of the median for graph sessions, in a project with 5 graph sessions or more, supports the default.
