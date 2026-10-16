# KPI: search work and fresh tokens, with and without the code graph

Phase 11 of the plan sets `codebase-memory` as a default MCP server. This file defines the measurement and holds the "before" numbers.
The "after" half needs 14 days of real use. It is open.

## Method

- A task is one session: the `sessionId` of the transcript lines. A sub-agent has the `sessionId` of its parent, so its tokens and calls count for the parent.
- The main KPI has two values for each session:
  - Searches before the first edit. A search is a `Grep`, `Glob` or `Read` call, or a `Bash` call that runs `rg`, `grep` or `find`.
    An edit is an `Edit`, `Write`, `MultiEdit`, `NotebookEdit` or `apply_patch` call. The count includes the searches of the sub-agents, in time order.
    A session without an edit has no value, and the median leaves it out.
  - Fresh tokens per message: input + cache write + output tokens, divided by the messages. Cache reads are not fresh.
- The secondary KPI is the total tokens of a session: input + output + cache write + cache read.
- A session is a graph session when one of its lines calls a tool whose name starts with `mcp__codebase-memory`, or when Claude Code gives a line
  the `attributionMcpServer` of a `codebase-memory` server. Other sessions are no-graph sessions.
- Compare the medians of graph and no-graph sessions in the same project. Read the p90 too: the counts have a long tail.
  The median and the p90 use linear interpolation, rounded to a whole number. Do not compare two projects.
- Use a project only when it has 5 sessions or more in the group. A smaller group is "not enough data".
- The window is 14 days.

Limits of the method:

- A session is not always one task. A long session can hold many tasks, and a task can use many sessions.
- Task size is not controlled. Before 2026-10-02 the graph sessions were much larger than the others (median 243,944,356 against 17,860,162 tokens since 2026-08-01), so a comparison of all sessions is wrong. Compare inside one project only.
- Fresh tokens per message do not grow with the length of a session as fast as the total tokens do, so they compare sessions of different sizes better. They still depend on the size of the files that a session reads.
- The folder `observer-sessions` holds the sessions of the personal `claude-mem` observer. It is not a project, so the tables leave it out.
- A Codex session has no tool counts. The numbers below have no Codex session.
- A cost is the list price, not a bill.

## Commands

```bash
# All sessions of the window: the rows (bySession) and the summary (sessionSummary).
ac usage --by session --since YYYY-MM-DD --until YYYY-MM-DD --json

# One project: the summary has, for graph and no-graph sessions, the count, the median and the p90 of tokens,
# the median of the searches before the first edit and the median of the fresh tokens per message.
ac usage --by session --project <root> --since YYYY-MM-DD --until YYYY-MM-DD
```

To find the projects with 5 sessions or more, count the rows of each `project` in `bySession`.
To get a p90 of the searches or of the fresh tokens, sort the values of `searchesBeforeEdit` or `freshPerMessage` in `bySession`.

## Before

Recorded on 2026-10-17 from the transcripts of one machine. Window: 2026-10-02 to 2026-10-16. The sessions of the remaster work in `agent-compass` are part of the numbers.
The command was `ac usage --by session --since 2026-10-02 --until 2026-10-16 --json`. The table groups its `bySession` rows by the basename of `project`.

| Project | Sessions | Graph sessions | Sessions with an edit | Searches before the first edit (median / p90) | Fresh tokens per message (median / p90) | Tokens (median / p90) |
|---|---|---|---|---|---|---|
| agent-compass | 7 | 1 | 7 | 22 / 63 | 6,835 / 8,404 | 40,767,813 / 263,752,717 |
| parcus-plus | 6 | 0 | 6 | 37 / 145 | 4,373 / 4,967 | 47,555,943 / 406,404,460 |
| All projects except `observer-sessions` | 23 | 1 | 20 | 25 / 94 | 6,223 / 21,493 | 33,255,879 / 437,517,682 |

Two projects have 5 sessions or more. The other projects have 3 sessions or fewer.

One session in the window called a `codebase-memory` tool: an `agent-compass` session on 2026-10-16, with 4 graph calls. One session is not a baseline,
so the "before" numbers are no-graph numbers in practice. The graph was in use before the window: 8 of 231 sessions since 2026-08-01 called it.
These sessions are too few, and too different in size, to serve as a baseline.

Hook events in the window, without `observer-sessions`: 5,165 hook errors, 0 guard fires and 22 stop blocks.
A guard fire needs a compass guard that blocks a call. The guard messages of this form are new, so 0 is the expected "before" value.

## After

Open. Window: 2026-10-17 to 2026-10-30 (14 days), with the graph installed in each project by `ac sync`. Fill this table on 2026-10-31 or later.
The command for each project is `ac usage --by session --project <root> --since 2026-10-17 --until 2026-10-30`.

| Project | Group | Sessions | Searches before the first edit (median) | Fresh tokens per message (median) | Tokens (median / p90) |
|---|---|---|---|---|---|
| parcus-plus | graph | | | | |
| parcus-plus | no graph | | | | |
| agent-compass | graph | | | | |
| agent-compass | no graph | | | | |

Read the result with the "before" table. In a project with 5 graph sessions or more, a drop of the median searches before the first edit
and of the median fresh tokens per message for graph sessions supports the default. A drop of the total tokens alone does not.
