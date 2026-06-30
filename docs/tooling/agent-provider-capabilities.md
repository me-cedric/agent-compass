# Agent Provider Capabilities

How to use each agent provider's native features without fragmenting the shared
contract. `AGENTS.md` stays tool-agnostic; this page tells an agent which local
lever to pull when one exists.

## Rule

Use the provider feature that removes the most manual work with the least new
state. If a feature is unavailable in the current surface, say so and continue
with the closest plain workflow.

## Capability Ladder

| Need | First choice | Use when | Avoid when |
| ---- | ------------ | -------- | ---------- |
| Persistent project rules | `AGENTS.md`, `CLAUDE.md`, `.github/copilot-instructions.md` | Rule should apply every session. | One-off task detail. |
| Repeated workflow | Skill, prompt file, or command | Same checklist/prompt appears more than twice. | It is still experimental. |
| External tool/data | MCP | Agent needs Figma, browser, docs, project memory, GitHub, DB, or product systems. | A normal repo command answers it. |
| Deterministic enforcement | Hook, husky, CI | Action must happen every time. | Judgment or product choice is required. |
| Parallel exploration | Subagents/custom agents | Independent workstreams can run in parallel. | Tasks share mutable files or need tight sequencing. |
| Long-running objective | Goal/background agent/cloud task | Clear done state, validation loop, and checkpoints exist. | Loose backlog or unclear stop condition. |
| User learning | Teaching skill/prompt | User asks "why/how", onboarding, or repeats a costly pattern. | User asked only for a direct fix. |

## Claude Code

Use:

- `CLAUDE.md` for Claude-specific pointers that sit behind `AGENTS.md`.
- `/` commands for session control, model/permission changes, compaction, and
  direct skill invocation.
- Skills for reusable procedures. Claude can invoke skills directly with
  `/skill-name` or auto-load them when relevant.
- Subagents, agent view, agent teams, or dynamic workflows for parallel work.
- Hooks for deterministic lifecycle actions such as formatting, blocking risky
  edits, notifications, or reinjecting context after compaction.
- MCP for external systems and shared context.
- Plugins when skills, hooks, subagents, and MCP servers need to travel together
  across repos.

Offer to use Claude-native tooling when:

- User repeats a prompt: "I can turn this into a Claude skill."
- Task has independent lanes: "I can spawn subagents for security, tests, and
  code quality, then merge findings."
- Rule must never be skipped: "This belongs in a hook or CI, not memory."
- Setup should travel: "This should be a plugin or repo skill, not only local
  `CLAUDE.md`."

## Codex

Use:

- `AGENTS.md` for durable repo guidance. More specific files closer to the
  working directory win.
- `/plan` or Plan mode before ambiguous or high-risk implementation.
- `/goal` for long-running work with a clear stopping condition and validation
  loop.
- Subagents when explicitly asked or when parallel review/exploration is worth
  the token cost.
- Skills for reusable workflows and domain expertise.
- MCP for external tools, docs, browser/Figma, GitHub, and project memory.
- Hooks for deterministic lifecycle checks and prompt/tool guardrails.
- `/review` for local diff, branch, or commit review when available.
- `~/.codex/config.toml` for personal defaults; `.codex/config.toml` for
  repo-local behavior when the team wants it versioned.

Offer to use Codex-native tooling when:

- Work is multi-hour but bounded: "I can put this in `/goal` with checkpoints."
- User asks broad implementation: "I can switch to Plan mode first."
- Review has independent concerns: "I can spawn one subagent per risk area."
- Missing external context blocks progress: "I can add/use an MCP server."

## GitHub Copilot

Use:

- `.github/copilot-instructions.md` for repository-wide Copilot guidance.
- `.github/instructions/*.instructions.md` for path-specific rules.
- `.github/prompts/*.prompt.md` for reusable task prompts in supported IDEs.
- `.github/agents/*.agent.md` for Copilot custom agents in supported surfaces.
- Repository MCP settings for Copilot cloud agent and code review. Allowlist
  specific read-only tools where possible; Copilot may use configured tools
  autonomously.
- Copilot code review custom instructions for repeated review standards.
- Copilot CLI custom instructions and MCP config for terminal workflows.

Offer to use Copilot-native tooling when:

- User asks for repeatable explanation/review/test prompts: "I can add a
  Copilot prompt file."
- Team needs a named role: "I can add a custom Copilot agent profile."
- Path rules differ by package: "I can add `.github/instructions` rules."
- Cloud agent needs safe external data: "I can document MCP allowlisted tools."

## VS Code Agents, Cursor, Windsurf, Gemini

These tools should still route through `AGENTS.md` first, then use their native
customization layer only where it adds discovery or automation:

- VS Code Agents: instructions, prompt files, skills, custom agents, MCP,
  hooks, plugins, and the customizations evaluation extension.
- Cursor: project/team/user rules, `AGENTS.md`, skills, hooks, subagents, plan
  mode, cloud agents, automations, and MCP.
- Windsurf/Devin Desktop: rules, workflows/playbooks, memories, and MCP. Keep
  rules short and move long procedures into docs/skills.
- Gemini CLI / Gemini Code Assist: `GEMINI.md`, slash commands, extensions,
  MCP, built-in tools, and agent-mode plan/tool approvals.

Use [`../../templates/agent-tools/README.md`](../../templates/agent-tools/README.md)
as the provider-template index.

## Tool Offer Pattern

Use this only when it saves real work:

```text
Tool offer: <provider feature> fits because <reason>. I can use it now or keep
this as a normal task.
```

Skip the offer when the feature is already requested, unavailable, or would add
state without reducing risk.

## Parallel Work Rules

- Split by independent risk, not by file count: security, tests, API contract,
  UI behavior, migration impact.
- Give each subagent a narrow question, allowed files, validation target, and
  expected output.
- Main agent owns final synthesis and edits. Do not blindly merge subagent
  output.
- Avoid parallel edits to the same files unless the provider has explicit merge
  support and the user approved it.

## Hook Rules

- Hooks enforce facts; instructions guide judgment.
- Keep hooks small, readable, and versioned when they affect a team.
- Hooks that run commands or touch external systems need trust review and clear
  failure output.
- Prefer existing repo scripts over custom shell in hooks.

## Memory Rules

- Store durable facts, repeated mistakes, decisions, and validation caveats.
- Never store secrets, personal data, raw credentials, or unreviewed guesses.
- If memory or instructions grow large, move procedures into skills/prompts and
  leave routing pointers in `AGENTS.md`.

## Ready-to-use servers

For high-value MCP servers the research workflows assume — context7 (live docs),
exa (web research), fetch (pages), playwright (live apps), sequential-thinking —
see [`mcp-servers.md`](mcp-servers.md) and `templates/mcp/recommended.example.json`.
Keyless ones can be enabled immediately; keep keys out of git.

## References

- Claude Code skills, subagents, hooks, plugins, and commands:
  https://code.claude.com/docs/en/skills
- Claude Code extension overview:
  https://code.claude.com/docs/en/features-overview
- Codex best practices, AGENTS.md, skills, MCP, hooks, subagents, and goals:
  https://developers.openai.com/codex/learn/best-practices
- Codex skills:
  https://developers.openai.com/codex/skills
- GitHub Copilot repository instructions, prompt files, custom agents, and MCP:
  https://docs.github.com/copilot
- GitHub Copilot custom instructions:
  https://docs.github.com/copilot/customizing-copilot/adding-custom-instructions-for-github-copilot
- GitHub Copilot custom agents:
  https://docs.github.com/en/copilot/how-tos/copilot-on-github/customize-copilot/customize-cloud-agent/create-custom-agents
- GitHub Copilot MCP:
  https://docs.github.com/en/copilot/concepts/context/mcp
- GitHub Spec Kit:
  https://github.com/github/spec-kit
