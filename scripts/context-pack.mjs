#!/usr/bin/env node
// context-pack.mjs — generate .agent/context.json, a machine-readable index of
// the repo so an agent loads ONE file instead of searching. Deterministic
// output (no timestamps) so --check can fail CI on drift.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

import { detectStacks, selectAssets } from './lib/profiles.mjs'

const help = `Usage: node scripts/context-pack.mjs [root] [--write] [--check]

Generate a machine-readable repo index at .agent/context.json.

Options:
  --write   Write .agent/context.json.
  --check   Exit 1 if .agent/context.json is missing or stale (read-only).
  --help    Show this help.
`

const args = process.argv.slice(2)
if (args.includes('--help')) { console.log(help); process.exit(0) }

const ROOT = resolve(args.find((a) => !a.startsWith('--')) || process.cwd())
const IGNORE = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'coverage', '.turbo', '.venv', 'incoming', '.agent'])
const OUT = join(ROOT, '.agent', 'context.json')

const readJson = (path) => { try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null } }

const findPackages = (dir, depth, out = []) => {
  if (depth < 0 || !existsSync(dir)) return out
  const pkg = readJson(join(dir, 'package.json'))
  if (pkg) {
    out.push({
      name: pkg.name || relative(ROOT, dir) || '.',
      path: relative(ROOT, dir) || '.',
      scripts: Object.keys(pkg.scripts || {}).sort(),
    })
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && !IGNORE.has(entry.name)) findPackages(join(dir, entry.name), depth - 1, out)
  }
  return out
}

const present = (rel) => existsSync(join(ROOT, rel))
const firstPresent = (...rels) => rels.find(present) || null

const stackIds = detectStacks(ROOT)

const build = () => ({
  schema: 1,
  agentContract: firstPresent('AGENTS.md', 'docs/agent-compass/AGENTS.md'),
  agentFiles: ['AGENTS.md', 'CLAUDE.md', 'CODEX.md', 'GEMINI.md', '.github/copilot-instructions.md'].filter(present),
  commands: readJson(join(ROOT, 'agent-compass.commands.json')),
  stacks: stackIds,
  // Fit-based compass assets for this host (core + detected stacks) — see
  // scripts/lib/profiles.mjs. Paths are relative to the compass checkout.
  fitAssets: selectAssets(stackIds),
  packages: findPackages(ROOT, 3).sort((a, b) => a.path.localeCompare(b.path)),
  docs: {
    repoMap: firstPresent('docs/architecture/repo-map.md'),
    runbook: firstPresent('.agent/RUNBOOK.md'),
    toolContract: firstPresent('.mcp/tool-contract.md'),
    permissions: firstPresent('docs/tooling/agent-permissions.md', 'docs/agent-compass/docs/tooling/agent-permissions.md'),
  },
})

const pack = build()
const serialized = JSON.stringify(pack, null, 2) + '\n'

if (args.includes('--check')) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''
  if (current !== serialized) {
    console.error('✗ .agent/context.json is missing or stale — run: node scripts/context-pack.mjs . --write')
    process.exit(1)
  }
  console.log('✓ context pack up to date.')
} else if (args.includes('--write')) {
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(OUT, serialized)
  console.log(OUT)
} else {
  process.stdout.write(serialized)
}
