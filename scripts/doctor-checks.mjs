import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'

export const HUSKY_HOOKS = ['pre-commit', 'pre-push', 'commit-msg']

export const PROJECTMEM_GITIGNORE = [
  '.venv/',
  '.projectmem/events.jsonl',
  '.projectmem/issues/',
  '.projectmem/watch.*',
  '.projectmem/data/',
  '.projectmem/*.db',
  '.projectmem/*.db-*',
  '.projectmem/*.sqlite',
  '.projectmem/*.sqlite-*',
  '.projectmem/*.sqlite3',
  '.projectmem/*.sqlite3-*',
]

export const PROJECTMEM_PRETTIERIGNORE = ['.projectmem/summary.md']

const TEXT_EXT = new Set(['', '.json', '.md', '.mdc', '.toml', '.yaml', '.yml'])
const LOCAL_PATH_RE = /(^|["'(\s=])((?:\/(?!absolute\/path\/to(?:\/|$)|path\/to(?:\/|$))[A-Za-z0-9._-]+){2,}[^"')\s,;\]]*|[A-Za-z]:\\Users\\[^"')\s,;\]]+)/m

const read = (root, path) => {
  try { return readFileSync(join(root, path), 'utf8') } catch { return '' }
}

export const isExecutable = (file) => {
  try { return Boolean(statSync(file).mode & 0o111) } catch { return false }
}

const hasLine = (text, line) => text.split(/\r?\n/).some((candidate) => candidate.trim() === line)

const missingLines = (root, path, lines) => {
  const text = read(root, path)
  return lines.filter((line) => !hasLine(text, line))
}

const appendMissingLines = (root, path, heading, lines, dry = false) => {
  const missing = missingLines(root, path, lines)
  if (!missing.length || dry) return missing
  const dest = join(root, path)
  mkdirSync(dirname(dest), { recursive: true })
  const existing = read(root, path)
  const prefix = existing && !existing.endsWith('\n') ? '\n' : ''
  const block = `${prefix}${existing ? '\n' : ''}${heading}\n${missing.join('\n')}\n`
  writeFileSync(dest, existing + block)
  return missing
}

const walk = (dir, maxDepth, files = []) => {
  if (!existsSync(dir) || maxDepth < 0) return files
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, maxDepth - 1, files)
    else if (TEXT_EXT.has(extname(entry.name))) files.push(full)
  }
  return files
}

const sharedConfigFiles = (root) => {
  const direct = [
    'AGENTS.md',
    'CLAUDE.md',
    'CODEX.md',
    'GEMINI.md',
    'agent-compass.commands.json',
    '.github/copilot-instructions.md',
    '.github/PULL_REQUEST_TEMPLATE.md',
    '.projectmem/README.md',
    '.projectmem/projectmem-policy.md',
    '.projectmem/summary.md',
    '.claude/settings.example.json',
  ].map((path) => join(root, path))
  const dirs = ['.mcp', '.github/instructions', '.github/prompts', '.github/agents', '.cursor/rules', '.windsurf/rules', '.codex', '.claude/agents', '.claude/hooks']
    .flatMap((path) => walk(join(root, path), 3))
  return [...direct, ...dirs].filter((file) => existsSync(file))
}

const localPathLeaks = (root) => sharedConfigFiles(root)
  .filter((file) => LOCAL_PATH_RE.test(readFileSync(file, 'utf8')))
  .map((file) => file.slice(root.length + 1))

export const ensureProjectmemIgnores = (root, dry = false) => ({
  gitignore: appendMissingLines(root, '.gitignore', '# projectmem local runtime', PROJECTMEM_GITIGNORE, dry),
  prettierignore: appendMissingLines(root, '.prettierignore', '# projectmem generated summary', PROJECTMEM_PRETTIERIGNORE, dry),
})

export const fixHuskyHookModes = (root, dry = false) => {
  const fixed = []
  for (const hook of HUSKY_HOOKS) {
    const path = join(root, '.husky', hook)
    if (!existsSync(path) || isExecutable(path)) continue
    if (!dry) chmodSync(path, 0o755)
    fixed.push(`.husky/${hook}`)
  }
  return fixed
}

export const doctorChecks = (root, { deep = false } = {}) => {
  let pkg = {}
  try { pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) } catch {}
  const pointers = ['CLAUDE.md', 'CODEX.md', 'GEMINI.md', '.github/copilot-instructions.md', '.cursor/rules/agent-compass.mdc', '.windsurf/rules/agent-compass.md']
  const gitmodulesPath = join(root, '.gitmodules')
  const mcpExample = read(root, '.mcp/projectmem.example.json')
  const leaks = localPathLeaks(root)
  const required = [
    ['shared agent config has no local absolute path leaks', leaks.length === 0, leaks],
    ['projectmem MCP example avoids local absolute paths', !mcpExample || (!mcpExample.includes('/absolute/path/to/repo') && !LOCAL_PATH_RE.test(mcpExample))],
    ['.gitignore ignores projectmem runtime files', missingLines(root, '.gitignore', PROJECTMEM_GITIGNORE).length === 0],
    ['.prettierignore ignores generated projectmem summary', missingLines(root, '.prettierignore', PROJECTMEM_PRETTIERIGNORE).length === 0],
    ...HUSKY_HOOKS.map((h) => [`existing .husky/${h} executable`, !existsSync(join(root, '.husky', h)) || isExecutable(join(root, '.husky', h))]),
  ]
  const advisory = [
    ['AGENTS.md exists', existsSync(join(root, 'AGENTS.md'))],
    ['AGENTS.md points at agent-compass', existsSync(join(root, 'AGENTS.md')) && /agent-compass|AGENTS\.md/.test(read(root, 'AGENTS.md'))],
    ['agent-compass.commands.json exists', existsSync(join(root, 'agent-compass.commands.json'))],
    ['projectmem docs exist', existsSync(join(root, '.projectmem', 'README.md')) && existsSync(join(root, '.projectmem', 'projectmem-policy.md'))],
    ['projectmem MCP example exists', existsSync(join(root, '.mcp', 'projectmem.example.json'))],
    ['package.json has "prepare": "husky"', pkg.scripts?.prepare === 'husky'],
    ['.gitmodules mentions agent-compass when present', !existsSync(gitmodulesPath) || /agent-compass/.test(readFileSync(gitmodulesPath, 'utf8'))],
    ...pointers.map((p) => [`${p} exists`, existsSync(join(root, p))]),
    ...pointers.map((p) => [`${p} points at AGENTS.md`, existsSync(join(root, p)) && /AGENTS\.md/.test(read(root, p))]),
    ...HUSKY_HOOKS.map((h) => [`.husky/${h} exists`, existsSync(join(root, '.husky', h))]),
    ['specs/README.md exists', existsSync(join(root, 'specs', 'README.md'))],
    ['specs/constitution.md exists', existsSync(join(root, 'specs', 'constitution.md'))],
  ]
  const deepChecks = deep ? [
    ['docs/architecture/repo-map.md exists', existsSync(join(root, 'docs', 'architecture', 'repo-map.md'))],
    ['docs/decisions/000-template.md exists', existsSync(join(root, 'docs', 'decisions', '000-template.md'))],
    ['.github/PULL_REQUEST_TEMPLATE.md exists', existsSync(join(root, '.github', 'PULL_REQUEST_TEMPLATE.md'))],
    ['.github/instructions/agent-compass.instructions.md exists', existsSync(join(root, '.github', 'instructions', 'agent-compass.instructions.md'))],
    ['.github/instructions/pr-workflow.instructions.md exists', existsSync(join(root, '.github', 'instructions', 'pr-workflow.instructions.md'))],
    ['.github/prompts/explain-project.prompt.md exists', existsSync(join(root, '.github', 'prompts', 'explain-project.prompt.md'))],
    ['.github/prompts/prompt-upgrade.prompt.md exists', existsSync(join(root, '.github', 'prompts', 'prompt-upgrade.prompt.md'))],
    ['.github/agents/agent-compass-teacher.agent.md exists', existsSync(join(root, '.github', 'agents', 'agent-compass-teacher.agent.md'))],
    ['.codex/config.toml exists', existsSync(join(root, '.codex', 'config.toml'))],
    ['.codex/hooks.json exists', existsSync(join(root, '.codex', 'hooks.json'))],
    ['.claude/agents/reviewer.md exists', existsSync(join(root, '.claude', 'agents', 'reviewer.md'))],
    ['.claude/agents/security.md exists', existsSync(join(root, '.claude', 'agents', 'security.md'))],
    ['.claude/agents/docs-teacher.md exists', existsSync(join(root, '.claude', 'agents', 'docs-teacher.md'))],
    ['.claude/agents/architecture-advisor.md exists', existsSync(join(root, '.claude', 'agents', 'architecture-advisor.md'))],
    ['.github/agents/architecture-advisor.agent.md exists', existsSync(join(root, '.github', 'agents', 'architecture-advisor.agent.md'))],
    ['.github/prompts/choose-architecture.prompt.md exists', existsSync(join(root, '.github', 'prompts', 'choose-architecture.prompt.md'))],
    ['.claude/settings.example.json exists', existsSync(join(root, '.claude', 'settings.example.json'))],
    ['.agent/provider-discovery-smoke.md exists', existsSync(join(root, '.agent', 'provider-discovery-smoke.md'))],
    ['.agent/provider-verification.md exists', existsSync(join(root, '.agent', 'provider-verification.md'))],
    ['.agent/recommendations.md exists', existsSync(join(root, '.agent', 'recommendations.md'))],
    ['.agent/quality-gates.md exists', existsSync(join(root, '.agent', 'quality-gates.md'))],
    ['.agent/migration-plan.md exists', existsSync(join(root, '.agent', 'migration-plan.md'))],
    ['.agent/mcp-readiness.md exists', existsSync(join(root, '.agent', 'mcp-readiness.md'))],
    ['.agent/spec-validation-map.md exists', existsSync(join(root, '.agent', 'spec-validation-map.md'))],
    ['.agent/failure-mining.md exists', existsSync(join(root, '.agent', 'failure-mining.md'))],
    ['.agent/report.html exists', existsSync(join(root, '.agent', 'report.html'))],
    ['.mcp/README.md exists', existsSync(join(root, '.mcp', 'README.md'))],
    ['.mcp/figma.example.json exists', existsSync(join(root, '.mcp', 'figma.example.json'))],
    ['.mcp/copilot-cloud.example.json exists', existsSync(join(root, '.mcp', 'copilot-cloud.example.json'))],
    ['.mcp/codex.example.toml exists', existsSync(join(root, '.mcp', 'codex.example.toml'))],
    ['.mcp/cursor.example.json exists', existsSync(join(root, '.mcp', 'cursor.example.json'))],
    ['.mcp/gemini.example.json exists', existsSync(join(root, '.mcp', 'gemini.example.json'))],
    ['.mcp/headroom.example.json exists', existsSync(join(root, '.mcp', 'headroom.example.json'))],
    ['.mcp/recommended.example.json exists', existsSync(join(root, '.mcp', 'recommended.example.json'))],
    ['.mcp/tool-contract.md exists', existsSync(join(root, '.mcp', 'tool-contract.md'))],
    ['.agent/agent-compass.lock exists (run sync to update)', existsSync(join(root, '.agent', 'agent-compass.lock'))],
  ] : []
  return { required, advisory, deepChecks }
}
