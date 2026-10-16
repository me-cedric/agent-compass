# Line budget — proposal

Status: closed (2026-10-16). A and B are applied. C is checked and not applied: the copies are not the same (see "Result"). The owner keeps the features of D, E and F and sets the budget to 4,000 lines for engine, UI and CLI. The count, 3,839, is in the budget.

## Budget and count

The plan set "engine + UI ≤ 3,500 lines" at first. The progress log counts `engine/*.mjs`, `ui/*.mjs` and `bin/ac.mjs`.
On 2026-10-16 the owner set the budget to 4,000 lines for these three parts. The tables below show the count before options A and B.
The static page (`ui/public/*`, 323 lines) is not in the count.

Command: `wc -l engine/*.mjs ui/*.mjs bin/ac.mjs`.

| Part | Files | Lines |
|---|---|---|
| engine/ | 25 | 3,676 |
| ui/ (server and API) | 2 | 480 |
| bin/ac.mjs | 1 | 258 |
| Total | 28 | 4,414 |

The total is 914 lines above the budget. Without `bin/ac.mjs`, it is 4,156 (656 above).

## Per file (2026-10-16)

| Lines | File | Lines | File |
|---|---|---|---|
| 363 | ui/api.mjs | 166 | engine/assets.mjs |
| 347 | engine/migrate.mjs | 165 | engine/docs.mjs |
| 272 | engine/legacy.mjs | 150 | engine/config.mjs |
| 258 | bin/ac.mjs | 147 | engine/detect.mjs |
| 254 | engine/env.mjs | 144 | engine/global.mjs |
| 239 | engine/sync.mjs | 140 | engine/run.mjs |
| 229 | engine/dev.mjs | 137 | engine/mcp.mjs |
| 225 | engine/plan.mjs | 117 | ui/server.mjs |
| 210 | engine/merge.mjs | 104 | engine/promote.mjs |
| 195 | engine/usage.mjs | 77 | engine/util.mjs |
| 194 | engine/env-check.mjs | 73 | engine/tokens.mjs |
| | | 64 | engine/upstream.mjs |
| | | 55 | engine/doctor.mjs |
| | | 47 | engine/run-plan.mjs |
| | | 42 | engine/git.mjs |

The three largest files:

1. `ui/api.mjs` (363): the routes of 8 tabs. The largest routes are promote, the log stream, run reports, delivery and the env edit.
2. `engine/migrate.mjs` (347): `ac init --from-specs` staging, and the `ac migrate --docs` moves, RAID files and ADR conversion.
3. `engine/legacy.mjs` (272): `ac migrate` from compass 0.4–0.9.

## Options without a change of behavior

| Id | Change | Lines out of the count | Risk |
|---|---|---|---|
| A | Move the one-time migration code to a new top-level `migrate/` dir: all of `engine/legacy.mjs`, and the `--docs` part of `engine/migrate.mjs` (keep `stageSpecs` in the engine, because `ac init --from-specs` uses it). `bin/ac.mjs` loads it with a dynamic import for `ac migrate` only. The code can go in 2.0, after the hosts migrate. | about 560 | Low. Same code, same tests. |
| B | One small CLI helper in `engine/util.mjs` for the modules with their own command (`env`, `dev`, `run`, `usage`, `promote`, `ui/server`): option parsing, `--help`, the usage error with exit 2, and JSON output. | about 40 | Low. The tests cover each command line. |
| C | Move repeated small helpers into `engine/util.mjs`: `strings` (3 copies), `fail` (5 copies), `within`, `real` and `cap` (2 copies each); use `readJson` in `engine/global.mjs` in place of `load`. | about 25 | Low. |

After A, B and C: about 3,790 lines with `bin/ac.mjs`, about 3,530 without it. This is still above the budget.

## Options that change behavior (owner decision)

| Id | Change | Lines out | What the user loses |
|---|---|---|---|
| D | Remove the env export and import forms from the Env tab. `ac env export` and `ac env import` stay in the CLI. | about 35 in `ui/api.mjs` and 20 in the page | Two buttons in the UI. |
| E | Remove the "Load quota" button (the CodexBar call) from the Usage tab. | about 12 | The quota view in the UI. |
| F | Move `ac usage --by session` (the KPI part, 27 lines) to a script after the KPI "after" report on 2026-10-31. | about 27 | Nothing after the measurement. |

## Other candidates to inspect (no estimate yet)

- `engine/env.mjs` and `engine/env-check.mjs` (448 lines together): check for logic that both files repeat.
- `engine/dev.mjs` (229 lines): the draft writer for a missing `process-compose.yaml` can be smaller.

## Recommendation

1. Approve A, B and C. They change no behavior and remove about 625 lines from the count.
2. Then choose one:
   - D and E: about 67 more lines, and the count with `bin/ac.mjs` is about 3,720.
   - A new budget of 4,000 lines for engine, UI and CLI. The scope grew after the plan: the Assets switches, usage and cost, the 0.x migration, `ac doctor --global` and the tracker pull.
3. Do F after 2026-10-31.

## Result (2026-10-16)

| Option | Commit | Lines out of the count |
|---|---|---|
| A — migration code to `migrate/` (legacy, docs, raid, adr, common) | 5cf2f5e | 552 |
| B — `parseCommand`, `usageError`, `failCommand` in `engine/util.mjs` | a588eac | 37 |
| C — shared small helpers | none | 0 |

C is not applied. The helpers with the same name do different things, so one shared copy changes behavior:
`strings` (3 rules: non-empty strings, non-blank strings, a non-empty array), `cap` (4 KB with a marker, or n characters),
`within` (real paths, or plain prefixes), `load` (records read errors; `readJson` gives null), and the `fail` that stay after B.

Count now: engine 3,088 + ui 475 + bin 262 = 3,825 (325 above the budget). migrate/ has 587 lines, outside the count.
The three largest files: `ui/api.mjs` (363), `bin/ac.mjs` (262), `engine/env.mjs` (244).
