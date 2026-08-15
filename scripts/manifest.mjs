// manifest.mjs — single source of truth for files agent-compass places into a
// host, shared by install.mjs (create-if-missing) and sync.mjs (reconcile).
//
// mode:
//   'seed'    — created once, then OWNED BY THE HOST. Never auto-updated.
//   'managed' — agent-compass owns the canonical content. sync fast-forwards it
//               when the host has not diverged; on divergence it writes a
//               `<file>.acnew` beside it instead of clobbering.
//
// Pointers (CLAUDE.md, AGENTS.md, GEMINI.md, …) are NOT here: they reference
// the submodule, so they update for free when the submodule updates.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'

export const FILE_MANIFEST = [
  // --- seed: host customizes these; never auto-update ---
  ['templates/monorepo/.editorconfig', '.editorconfig', 'seed'],
  ['templates/monorepo/.prettierrc', '.prettierrc', 'seed'],
  ['templates/monorepo/.prettierignore', '.prettierignore', 'seed'],
  ['templates/monorepo/commitlint.config.js', 'commitlint.config.js', 'seed'],
  ['templates/monorepo/.nvmrc', '.nvmrc', 'seed'],
  ['templates/monorepo/.npmrc', '.npmrc', 'seed'],
  ['templates/monorepo/tsconfig.base.json', 'tsconfig.base.json', 'seed'],
  ['templates/security/.osv-scanner.toml', '.osv-scanner.toml', 'seed'],
  ['templates/monorepo/env.example.tpl', '.env.example', 'seed'],
  ['templates/commands/agent-compass.commands.json', 'agent-compass.commands.json', 'seed'],
  ['templates/context/repo-map.md', 'docs/architecture/repo-map.md', 'seed'],
  ['docs/decisions/000-template.md', 'docs/decisions/000-template.md', 'seed'],
  ['templates/agent/.github/PULL_REQUEST_TEMPLATE.md', '.github/PULL_REQUEST_TEMPLATE.md', 'seed'],
  ['templates/specs/specs-readme.md', 'specs/README.md', 'seed'],
  ['templates/specs/constitution-template.md', 'specs/constitution.md', 'seed'],
  ['templates/memory/projectmem-readme.md', '.projectmem/README.md', 'seed'],
  ['templates/memory/projectmem-policy.md', '.projectmem/projectmem-policy.md', 'seed'],

  // --- managed: agent-compass canonical; sync keeps these current ---
  ['templates/handoff.md', 'docs/handoff-template.md', 'managed'],
  ['templates/intake/work-intake.md', 'docs/work-intake-template.md', 'managed'],
  ['templates/trace/README.md', '.agent/trace/README.md', 'managed'],
  ['templates/agent/.github/ISSUE_TEMPLATE/agent-ready-task.yml', '.github/ISSUE_TEMPLATE/agent-ready-task.yml', 'managed'],
  ['templates/agent/.github/instructions/agent-compass.instructions.md', '.github/instructions/agent-compass.instructions.md', 'managed'],
  ['templates/agent/.github/instructions/pr-workflow.instructions.md', '.github/instructions/pr-workflow.instructions.md', 'managed'],
  ['templates/agent/.github/prompts/explain-project.prompt.md', '.github/prompts/explain-project.prompt.md', 'managed'],
  ['templates/agent/.github/prompts/prompt-upgrade.prompt.md', '.github/prompts/prompt-upgrade.prompt.md', 'managed'],
  ['templates/agent/.github/prompts/choose-architecture.prompt.md', '.github/prompts/choose-architecture.prompt.md', 'managed'],
  ['templates/agent/.github/agents/agent-compass-teacher.agent.md', '.github/agents/agent-compass-teacher.agent.md', 'managed'],
  ['templates/agent/.github/agents/architecture-advisor.agent.md', '.github/agents/architecture-advisor.agent.md', 'managed'],
  ['templates/codex/.codex/config.toml', '.codex/config.toml', 'managed'],
  ['templates/codex/.codex/hooks.json', '.codex/hooks.json', 'managed'],
  ['templates/claude/.claude/agents/reviewer.md', '.claude/agents/reviewer.md', 'managed'],
  ['templates/claude/.claude/agents/security.md', '.claude/agents/security.md', 'managed'],
  ['templates/claude/.claude/agents/docs-teacher.md', '.claude/agents/docs-teacher.md', 'managed'],
  ['templates/claude/.claude/agents/architecture-advisor.md', '.claude/agents/architecture-advisor.md', 'managed'],
  ['templates/claude/.claude/hooks/protect-agent-files.sh', '.claude/hooks/protect-agent-files.sh', 'managed'],
  ['templates/claude/.claude/hooks/remind-completion-gate.sh', '.claude/hooks/remind-completion-gate.sh', 'managed'],
  ['templates/claude/.claude/settings.example.json', '.claude/settings.example.json', 'managed'],
  ['templates/conformance/provider-discovery-smoke.md', '.agent/provider-discovery-smoke.md', 'managed'],
  ['templates/mcp/README.md', '.mcp/README.md', 'managed'],
  ['templates/mcp/tool-contract.md', '.mcp/tool-contract.md', 'managed'],
  ['templates/mcp/figma.example.json', '.mcp/figma.example.json', 'managed'],
  ['templates/mcp/figma-mcp-go.example.json', '.mcp/figma-mcp-go.example.json', 'managed'],
  ['templates/mcp/figma-mcp-go.md', '.mcp/figma-mcp-go.md', 'managed'],
  ['templates/mcp/projectmem.example.json', '.mcp/projectmem.example.json', 'managed'],
  ['templates/mcp/codebase-memory.example.json', '.mcp/codebase-memory.example.json', 'managed'],
  ['templates/mcp/copilot-cloud.example.json', '.mcp/copilot-cloud.example.json', 'managed'],
  ['templates/mcp/codex.example.toml', '.mcp/codex.example.toml', 'managed'],
  ['templates/mcp/angular-cli.example.json', '.mcp/angular-cli.example.json', 'managed'],
  ['templates/mcp/gemini.example.json', '.mcp/gemini.example.json', 'managed'],
  ['templates/gemini/.gemini/settings.example.json', '.gemini/settings.example.json', 'managed'],
  ['templates/mcp/headroom.example.json', '.mcp/headroom.example.json', 'managed'],
  ['templates/mcp/recommended.example.json', '.mcp/recommended.example.json', 'managed'],
].map(([src, dest, mode]) => ({ src, dest, mode }))

export const LOCK_REL = '.agent/agent-compass.lock'
export const TEXT_RE = /\.(md|json|ya?ml|mjs|cjs|js|ts|toml|properties|txt|sh|tpl)$|^\.|husky\/|hooks\//

export const isHook = (srcRel) => srcRel.includes('husky/') || srcRel.includes('.claude/hooks/')
export const sha = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16)
export const acVersion = (AC) => {
  try { return JSON.parse(readFileSync(join(AC, 'package.json'), 'utf8')).version || '0.0.0' } catch { return '0.0.0' }
}

// Load the @scope/<project> substitution used at install time so sync renders
// managed files identically (otherwise every synced file would look diverged).
export const loadSubst = (host) => {
  let scope = '@scope'
  let name = basename(host)
  try {
    const a = JSON.parse(readFileSync(join(host, 'agent-compass.answers.json'), 'utf8'))
    scope = a.scope || scope
    name = a.name || name
  } catch {}
  return { scope, name, subst: (text) => text.replace(/@scope\b/g, scope).replace(/<project>/g, name) }
}

// Exact bytes that would be written to the host for a manifest source.
export const renderSource = (AC, srcRel, subst) => {
  const raw = readFileSync(join(AC, srcRel), 'utf8')
  return TEXT_RE.test(srcRel) ? subst(raw) : raw
}
