# Agent Improvement Loop

How a project using Agent Compass gets more automated and precise over time.

## Goal

Turn repeated human corrections into repo-owned guidance, reusable prompts,
skills, hooks, checks, and MCP tools. The user should need less input because the
project encodes more of its own operating manual.

## Loop

1. **Notice friction.** Repeated prompt, repeated review comment, missed command,
   missing context, flaky manual check, or recurring agent mistake.
2. **Classify it.**
   - Fact/rule: put it in nearest `AGENTS.md` or path instruction.
   - Procedure: make a skill or prompt file.
   - External data/tool: add MCP or document existing MCP.
   - Must-run check: add script, hook, husky, or CI.
   - Long task: define goal/checkpoint template.
   - Explanation need: add teaching prompt/skill.
3. **Codify smallest useful artifact.** Prefer editing an existing file. Add new
   files only when a separate artifact is how the provider discovers it.
4. **Validate discovery.** Run doctor, index/docs checks, or provider-specific
   smoke test.
5. **Use once on real work.** Keep only what changed outcome or reduced user
   steering.
6. **Promote generic lessons.** Feed reusable knowledge back through
   [knowledge-capture](knowledge-capture.md).

## What To Add Next In Host Projects

| Addition | Why | How |
| -------- | --- | --- |
| `.agent/RUNBOOK.md` | Gives every agent a compact startup route. | `node docs/agent-compass/scripts/runbook.mjs . --write`. |
| `.agent/doctor-report.md` | Shows missing wiring and optional upgrades. | `node docs/agent-compass/scripts/doctor-report.mjs . --write`. |
| Path instructions | Reduce wrong assumptions in monorepos. | Copy/adapt `.github/instructions/*.instructions.md`. |
| Prompt files | Standardize repeated explanation, review, testing, and migration prompts. | Add `.github/prompts/*.prompt.md` or provider equivalent. |
| Custom agents/subagents | Encode roles like planner, reviewer, teacher, security auditor. | Add `.github/agents/*.agent.md`, `.claude/agents/*`, or Codex custom agents when supported. |
| Skills | Package reusable procedures with optional scripts/resources. | Add `skills/<name>/SKILL.md`; sync with provider tooling. |
| MCP allowlists | Let agents use real tools with less manual copy/paste. | Document server, allowlisted tools, auth, and safety in `.mcp/README.md`. |
| Hooks/CI gates | Enforce non-negotiable checks. | Prefer existing scripts; fail with concise output. |
| Project memory | Preserve hard-earned facts without polluting instructions. | Use projectmem brief/precheck/show/log workflow. |
| Agent smoke test | Check whether an agent follows repo rules. | Use `templates/conformance/agent-smoke-test.md`. |
| Provider discovery prompts | Verify agents really load guidance and know provider tools. | Run `node docs/agent-compass/scripts/agent-conformance.mjs --root . --write`. |
| Teaching/tool evals | Catch annoying over-coaching or missing tool offers. | Run `node docs/agent-compass/scripts/agent-evals.mjs --root docs/agent-compass`. |
| Codex repo config | Make goals, hooks, MCP, and sandbox policy repeatable. | Copy/adapt `templates/codex/.codex/`. |
| Claude agents/hooks | Package reviewer/security/teacher roles and deterministic guardrails. | Copy/adapt `templates/claude/.claude/`. |

## Automation Priority

1. Commands and validation registry.
2. Repo map and runbook.
3. Path instructions for high-change folders.
4. Prompt files for repeated tasks.
5. Skills for repeated multi-step procedures.
6. MCP for external data/tools.
7. Hooks/CI for deterministic enforcement.
8. Custom agents/subagents for parallel or role-specific work.
9. Memory and knowledge capture for long-term improvement.
10. Provider smoke/eval checks before release.

## Stop Rules

- Do not codify one-off preferences.
- Do not add an MCP server when a repo script already answers the question.
- Do not make a custom agent for one task; use a prompt first.
- Do not add hooks that require secrets or mutate external systems without an
  explicit trust model.

## Review Questions

Ask these before adding any new agent artifact:

- Does this save repeated user input?
- Does a provider discover this artifact automatically?
- Is it safer as guidance, a prompt, a skill, a hook, or CI?
- Can it be validated by a script or smoke test?
- Will a future agent know when not to use it?
