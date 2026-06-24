# Agent Value Expansion

What else to add beyond the current Agent Compass baseline to make agents need
less user input while staying precise.

## 1. Agent-Ready Work Intake

**What:** issue, PR, and prompt templates that force `Goal`, `Context`,
`Constraints`, `Done when`, and `Validation`.

**How:** shipped — `AGENTS.md` §1 intake gate, the portable
[`templates/intake/work-intake.md`](../../templates/intake/work-intake.md), the
`prompt-upgrade` prompt, and the `agent-ready-task.yml` issue form. For long
work, fill the stopping condition and checkpoint cadence sections.

**Why:** the highest-leverage automation is preventing vague starts. It reduces
clarification loops and makes `/goal`, cloud agents, and subagents safer.

## 2. Provider Discovery Checks

**What:** a routine smoke test that asks Claude, Codex, Copilot, and other tools
which guidance, tools, prompts, skills, MCP servers, hooks, and commands they
loaded.

**How:** run `node scripts/agent-conformance.mjs --write` and paste generated
prompts into each provider after guidance changes. Store responses in release
notes only if they reveal drift.

**Why:** guidance that exists but is not discovered is dead config.

## 3. Customization Evals

**What:** small eval fixtures for prompt files, skills, teaching behavior, tool
offers, and review stance.

**How:** keep JSON fixtures under `templates/evals/`, run
`node scripts/agent-evals.mjs`, and optionally run provider-native eval tools
where available, such as VS Code customization evaluations or skill evals.

**Why:** agent customizations rot like code. Evals catch "teaches every turn",
missing validation, vague tool offers, and contradictory instructions.

## 4. MCP Tool Contracts

**What:** one contract per MCP server: allowed tools, data sensitivity, approval
mode, read/write risk, expected failures, and validation command.

**How:** shipped — [`templates/mcp/tool-contract.md`](../../templates/mcp/tool-contract.md)
plus the provider allowlist templates. For Copilot cloud, allowlist read-only
tools; for Codex, set `enabled_tools` + `default_tools_approval_mode`.

**Why:** MCP is where agents move from text to actions. Tool contracts prevent
"connected everything" from becoming unsafe autonomy.

## 5. Deterministic Guardrail Hooks

**What:** hooks that block protected files, remind completion gates, and run
small checks at lifecycle boundaries.

**How:** copy `templates/claude/.claude/` or `templates/codex/.codex/` into a
host repo, then replace examples with real repo commands from
`agent-compass.commands.json`.

**Why:** instructions are advisory. Hooks and CI are the right place for
non-negotiable behavior.

## 6. Role Agents With Narrow Tools

**What:** custom agents/subagents for reviewer, security, docs teacher, planner,
test repair, and migration auditor.

**How:** keep each role narrow. Give read/search tools by default, add edit/shell
only when the role must change code. Use main agent for synthesis and final
edits.

**Why:** role agents reduce context pollution and make parallel checks useful
without letting every worker mutate the repo.

## 7. Context Routing Maps

**What:** short routing docs that tell agents which docs/files to read for each
type of task.

**How:** shipped — the Task Routing table in
[`templates/context/repo-map.md`](../../templates/context/repo-map.md) (installed
to `docs/architecture/repo-map.md`) and the routing pointer in the runbook. Fill
the paths for the host repo.

**Why:** agents waste budget when they search everything. Routing reduces
startup cost and wrong-file edits.

## 8. Agentic Drift Reports

**What:** scheduled or manual reports that compare actual repo setup against
Agent Compass expectations.

**How:** shipped — `node scripts/agent-drift.mjs` aggregates the validators into
one read-only dashboard, and `.github/workflows/agent-drift.yml` (host template:
`templates/ci/agent-drift.example.yml`) runs it on a weekly cron.

**Why:** agent setup changes across tools. Drift reports surface missing prompts,
stale hooks, broken MCP, and command-registry mismatch before a real task.

## 9. Model And Permission Profiles

**What:** documented model/permission defaults for fast tasks, risky work,
research, background goals, and subagents.

**How:** shipped — [`docs/tooling/agent-permissions.md`](../tooling/agent-permissions.md)
maps task types to profiles, with concrete `permissions` in the Claude settings
example and `[profiles.*]` in the Codex config. Default to least access, then
loosen for trusted repo workflows.

**Why:** wrong model or permission mode causes many quality failures that look
like prompting problems.

## 10. Agent Trace And Outcome Logs

**What:** lightweight logs of agent task type, tools used, validation, failures,
and human corrections.

**How:** shipped — the JSONL schema in
[`templates/trace/`](../../templates/trace/README.md) with
`node scripts/agent-trace.mjs` validating structure and rejecting secret/PII-like
rows. Promote recurring lessons via knowledge-capture. Never log secrets or raw
prompts.

**Why:** improvement needs evidence. Without traces, teams only remember the
last bad run.

## 11. Ticket-To-PR Pipeline

**What:** repeatable path from issue/ticket to spec, plan, branch, tests, PR, and
review.

**How:** add prompt files for "make this ticket agent-ready", "turn this issue
into a spec", "spawn review lanes", and "prepare PR handoff". Keep PR creation
behind explicit user approval.

**Why:** most developer time is not code writing; it is narrowing ambiguous work
into safe, reviewable change.

## 12. Learning Mode For Users

**What:** optional user coaching that explains project workflows and better
agent use at the right moments.

**How:** use `agent-teacher` and `agent-teaching.md`. Trigger only for
explanations, onboarding, or repeated costly patterns.

**Why:** users get better prompts over time without being lectured on every
interaction.

## Priority

1. Agent-ready intake.
2. Provider discovery checks.
3. MCP tool contracts.
4. Deterministic hooks.
5. Role agents.
6. Context routing maps.
7. Customization evals.
8. Drift reports.
9. Permission/model profiles.
10. Trace/outcome logs.

Do not add everything at once to a host repo. Install the baseline, run doctor,
then add the first missing item that removes repeated user steering.
