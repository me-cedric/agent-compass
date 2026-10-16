# Research notes for compass 1.0

Date: 2026-10-16. Sources were read on that date. "UNCONFIRMED" means no primary source was found.

## 1. Provider configuration surface

| Provider | Instructions | Skills | Subagents | Hooks | MCP | Output control | Plugins |
|---|---|---|---|---|---|---|---|
| Claude Code | `CLAUDE.md` (+ `@` imports, under 200 lines); reads `AGENTS.md` only when no CLAUDE.md exists; `.claude/rules/*.md` with `paths:` | `.claude/skills` (not `.agents/skills`); listing entry cap 1,536 chars | `.claude/agents/*.md` with `model`, `effort`, `tools`, `skills` | 33 events; `additionalContext` cap 10,000 chars, then a 2,000-char preview | `.mcp.json`, `${VAR:-default}`, tools deferred by default | `.claude/output-styles/*.md` + `outputStyle`; built-in Concise style; advisory | `.claude-plugin/marketplace.json`; project `extraKnownMarketplaces` + `enabledPlugins` after folder trust; external sources need a manual install |
| Codex | `AGENTS.md` root to cwd, 32 KiB cap | `.agents/skills`, `~/.agents/skills`; listing budget 2% of context | `.codex/agents/*.toml` with `model`, `model_reasoning_effort`, `model_verbosity` | `hooks.json`, about 2,500 tokens per handler | `[mcp_servers.<n>]` with `enabled_tools`, `disabled_tools` | `model_verbosity="low"`, `model_reasoning_summary`, `hide_agent_reasoning`, `personality` | plugin manifests; marketplace in `.agents/plugins/` or `.claude-plugin/marketplace.json` |
| Copilot | `AGENTS.md`, `.github/copilot-instructions.md`, `.github/instructions/*.instructions.md` (`applyTo`), `.claude/rules` | `.github/skills`, `.claude/skills`, `.agents/skills` | `.github/agents/*.agent.md`, `.claude/agents` | `.github/hooks/*.json`; VS Code reads `.claude/settings.json` hooks with `chat.useClaudeHooks` | VS Code `mcp.json`; cloud agent MCP lives in repo settings on github.com | instructions only; advisory | CLI reads `.claude-plugin/marketplace.json`; VS Code reads `extraKnownMarketplaces` |

Sources: code.claude.com/docs/en/{memory,settings,hooks,output-styles,skills,sub-agents,plugins,mcp,prompt-caching,costs};
learn.chatgpt.com/docs/{agent-configuration/agents-md,config-file/config-basic,build-skills,hooks,agent-configuration/subagents};
developers.openai.com/codex/plugins/build; docs.github.com/en/copilot (custom instructions, CLI plugin reference, cloud agent MCP);
code.visualstudio.com/docs/copilot/customization/{custom-instructions,custom-agents,agent-skills,hooks,agent-plugins}.

Consequences for compass:
- Copilot reads `.claude/skills`, `.claude/agents` and `.claude/rules`. Codex reads `.agents/skills`. Claude reads `.claude/*`.
  So two skill dirs cover the three providers. Verify the `.claude/agents` model mapping for Copilot in phase 3.
- CLAUDE.md must import `@AGENTS.md`, because Claude does not read AGENTS.md when CLAUDE.md exists.
- Narration control is enforced only by Codex parameters. Claude output styles and Copilot instructions are advisory.

## 2. Distribution tools

| Tool | Version | Verdict |
|---|---|---|
| Microsoft APM | v0.33.0, MIT | Best semantics (hash lock, stale cleanup, keeps edits, `--frozen`, audit). Pre-1.0. Copy the semantics, not the tool. |
| rulesync | v35.0.0, MIT | 11 majors in 15 days. Skip. |
| ruler | v0.3.44, MIT | Beta, no lock. Skip. |
| `npx skills` | v1.7.2, MIT | Skills only. Skip. |
| Agent Skills spec | agentskills.io | Use as the skill format. |

Shared versus local: the installer owns only files it placed, by hash. Local assets carry a project prefix.
Promotion has no vendor workflow; use a PR to the central repo.

## 3. Prompt cache

- Claude: a model switch, an effort change, MCP changes without tool search, and compaction cause a full miss.
  Skill `model:` frontmatter acts as a model switch. Plugin skills, agents and hooks append without a miss.
- Claude TTL: 1 hour on a subscription main conversation, 5 minutes for API keys and subagents (`promptCacheTtl`).
- Codex: keep tool order, model, effort and verbosity stable; put dynamic text last.
- Volatile text (dates, git state) in CLAUDE.md or SessionStart output likely breaks cross-session hits (inference).

## 4. Token economy

| Lever | Setting |
|---|---|
| Cache price | Reads 0.05x input on Opus 5.5 and Sonnet 5.5 |
| Price ladder per MTok in/out | Haiku 5.5 $0.10/$0.50 (to 100K), Sonnet 5.5 $2/$10, Opus 5.5 $4/$20, Fable 5.1 $10/$50; GPT-6 Luna $0.10/$0.50, 6.1 Sol $2/$10, Astra $10/$50 |
| Subagent model | `model:` in agent files; `CLAUDE_CODE_SUBAGENT_MODEL`; built-in Explore uses the main model |
| Effort | `effortLevel`, `CLAUDE_CODE_EFFORT_LEVEL`, `effort:` in agents; default medium on 5.5 models |
| Skills | `disable-model-invocation: true` keeps user-only skills out of the listing |
| Hooks | SessionStart output over 10,000 chars is cut to a preview; keep injections small |
| Codex | `model_verbosity`, `tool_output_token_limit`, `agents.default_subagent_model`, `review_model` |
| Copilot | 1 credit = $0.01; Auto model gives 10% off |

Baseline from Anthropic: about $13 per developer per active day.

## 5. Usage and cost KPIs

| Source | Location | Notes |
|---|---|---|
| Claude Code | `~/.claude/projects/<cwd>/*.jsonl`, `message.usage` | Dedupe on `(message.id, requestId)`; worktrees map to the repo root through `git rev-parse --git-common-dir` |
| Codex | `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl` | Use the last `total_token_usage` per session; cached tokens sit inside input |
| ccusage | `ccusage daily --json --instances` | Cross-check only |
| CodexBar | `codexbar usage --format json` | Account quota, not per project |
| Copilot | org billing API `premium_request/usage` | No repo key |

Prices: pin a subset of LiteLLM `model_prices_and_context_window.json`. Show subscription cost as a list-price estimate.

## 6. Ops, debug and verification tools (MCP and CLI)

| Tool | Read-only control | Verdict |
|---|---|---|
| grafana/mcp-grafana v2.0 | `--disable-write` | ADOPT |
| argoproj-labs/mcp-for-argocd 0.9 | `MCP_READ_ONLY=true` | ADOPT; NE Forge token needs a human |
| containers/kubernetes-mcp-server | `read_only=true`, deny `Secret` | ADOPT |
| Scaleway `scw mcp server serve` | `--read-only` | TRIAL |
| sooperset/mcp-atlassian 0.23 | `READ_ONLY_MODE`, `ENABLED_TOOLS` | ADOPT (only Jira DC option) |
| Atlassian Rovo remote MCP | none | TRIAL, Cloud only |
| GitLab MCP | header tool filters (19.5) | TRIAL; use `glab` CLI |
| GitHub MCP v2.0 | `--read-only` | ADOPT |
| osv-scanner 2.7 | scan only; SARIF; offline DB | ADOPT |
| SonarQube MCP | `SONARQUBE_READ_ONLY=true` | ADOPT |
| Checkmarx One MCP | none; deny `triggerScan`, `createProject` | TRIAL; `cx` CLI SARIF in CI |
| Renovate | git-submodules manager | ADOPT |
| Bruno CLI | `bru run --reporter-junit` | ADOPT |
| Mockoon CLI 9.9 | n/a | ADOPT |
| DBHub 1.5 | `readonly=true`, `max_rows` | ADOPT with a read-only DB role |
| Playwright MCP, test agents | read-only hints | ADOPT; review healer edits |
| Chrome DevTools MCP | `--no-usage-statistics`, `--no-performance-crux` | ADOPT |
| Figma remote MCP | deny write tools | ADOPT read tools |
| Storybook MCP (10.6) | preview API | ADOPT for component inventory |
| Maestro MCP, agent-device, XcodeBuildMCP, Android CLI | n/a | ADOPT |
| process-compose 1.122 | MCP control tools opt-in | ADOPT as local runner |
| age 1.3 with SSH recipients | `age -R` with `https://<forge>/<user>.keys` | ADOPT for secret bundles |
| Zod 4 `z.toJSONSchema` + `.meta()` | n/a | ADOPT for env catalog |
| Node `--env-file`, `--env-file-if-exists` | n/a | ADOPT for in-memory loading |

UI conformance order: tokens (`get_variable_defs` versus computed style), structure (`get_metadata`
versus aria snapshot), screenshot with tolerance, then freeze with `toHaveScreenshot` in the CI image.
Atomic design: `eslint-plugin-boundaries` as a hard gate; Storybook MCP `docs-list` before a new component.

## 7. Methods

- mattpocock/skills (MIT, v1.3.1, 27 skills): grill-me, grilling, grill-with-docs, to-questionnaire,
  wayfinder, handoff, tdd, code-review, implement-spec fit a spec-driven flow.
- OpenSpec 1.14 (MIT): custom `schema.yaml`, `status --change X --json`, `instructions apply --json`,
  `archive` merges deltas. Add `openspec schema validate` and `validate --all --strict --json` to CI.
- Screens: one registry with `SCR-id`, aliases, route, Figma `fileKey` + `node-id`. Requirements tag `Screen: SCR-id`.
- Graph: codebase-memory-mcp (MIT, local SQLite) + LSP plugins. Skip GitNexus (noncommercial licence).
  Decisions stay in repo files. projectmem is a trial. claude-mem is personal.
- Loop rules: one task per loop; state on disk; define the check first (`/goal` with a turn cap);
  reviewer is not the writer; report only correctness and requirement gaps; max 2 fix rounds;
  cheap workers with a strong lead; prefer Monitor to polling.

## 8. Phase 3 answers

Date: 2026-10-16. Sources: code.claude.com/docs/en/{workflows,hooks,output-styles,sub-agents,permissions};
learn.chatgpt.com/docs/{hooks,agent-configuration/subagents,config-file/config-reference,models};
docs.github.com/en/copilot/reference/{custom-agents-configuration,cli-plugin-reference,hooks-configuration,ai-models/supported-models};
code.visualstudio.com/docs/copilot/customization/{custom-agents,custom-instructions,hooks}.

| Topic | Answer |
|---|---|
| Claude workflow | `.claude/workflows/<name>.js`. `meta` is the first statement, a pure literal with `name` and `description`. `agent()` takes `label`, `phase`, `schema`, `model`, `effort`, `agentType`, `isolation`. |
| Claude hooks | Exit 2 with stderr denies a PreToolUse call and continues a Stop. `Read` gives an absolute `file_path`. `stop_hook_active` stops a loop. SessionStart plain stdout goes into the context. |
| Claude permissions | Deny and ask rules take a glob in the tool-name position, for example `mcp__mcp-atlassian__*_delete_*`. |
| Claude output style | `keep-coding-instructions: true`. Subagents ignore the output style. |
| Codex hooks | `.codex/hooks.json` has the Claude shape. It loads only in a trusted project, after the user approves it in `/hooks`. PreToolUse sees `Bash`, `apply_patch` and MCP tools. Codex has no file-read tool. Stop gets `last_assistant_message` and `stop_hook_active`. |
| Codex agents and config | `.codex/agents/*.toml` needs `name`, `description`, `developer_instructions`; `model` is optional. `model_reasoning_summary` takes `auto`, `concise`, `detailed` or `none`. Models: `gpt-6-luna` (cheap), `gpt-6.1-sol` (mid). |
| Copilot agents | VS Code and Copilot CLI read `.claude/agents`, but they do not use its `model` key. So compass writes `.github/agents/<n>.agent.md` for each role agent that has `copilot-model`. `model` is one display name ("Claude Haiku 5.5"); an array makes the CLI drop the agent. Claude tool names are valid aliases. |
| Copilot rules | VS Code reads `.claude/rules` and uses `paths`. Copilot CLI and the cloud agent: UNCONFIRMED. |
| Copilot hooks | The cloud agent reads only `.github/hooks/*.json`. The CLI reads `.claude/settings.json`. VS Code reads it only with `chat.useClaudeHooks` (default off). |
| Open risks | Same-name agents in `.github/agents` and `.claude/agents` can show twice in the VS Code picker (UNCONFIRMED). An unknown Copilot model name falls back to the picker model (UNCONFIRMED). Codex SessionStart stdout as context: UNCONFIRMED. |

Token estimate: `ac doctor --tokens` uses characters divided by 4. A cl100k count of the 3,477-character AGENTS block gives 844 tokens; the estimate gives 870.
Phase 3 measure on a fresh host: AGENTS block 870, CLAUDE block 86, agent listing 77, output style 81, SessionStart 69, total 1,183 tokens.
So the phase 4 skill listing can use about 800 tokens (3,200 characters). The legacy root `skills/` give a 4,089-character listing, so the real tree fails the budget until phase 4.
