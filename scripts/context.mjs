#!/usr/bin/env node
// context.mjs — print a compact agent startup snapshot for the current repo.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCliArgs, resolveRoot } from './lib/args.mjs'

const { positionals } = parseCliArgs({
  name: 'context',
  script: 'context.mjs',
  summary: 'Print a compact repo snapshot for coding agents.',
  positionals: [{ name: 'root', required: false }],
})

const ROOT = resolveRoot(positionals)
const readJson = (path) => {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}
const listDirs = (path) => existsSync(path)
  ? readdirSync(path, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
  : []
const listMd = (path) => existsSync(path)
  ? readdirSync(path).filter((file) => file.endsWith('.md') && file !== 'README.md').sort()
  : []

const pkg = readJson(join(ROOT, 'package.json')) || {}
const commands = readJson(join(ROOT, 'agent-compass.commands.json'))
const scripts = Object.keys(pkg.scripts || {}).sort()
const packageManager = pkg.packageManager || (existsSync(join(ROOT, 'pnpm-lock.yaml')) ? 'pnpm' : existsSync(join(ROOT, 'package-lock.json')) ? 'npm' : 'unknown')

console.log(`# Agent Context Snapshot

Root: ${ROOT}
Package manager: ${packageManager}
Command registry: ${commands ? 'agent-compass.commands.json' : 'missing'}
Agent guide: ${existsSync(join(ROOT, 'AGENTS.md')) ? 'AGENTS.md' : 'missing'}
Specs: ${existsSync(join(ROOT, 'specs')) ? 'specs/' : 'missing'}
Project memory: ${existsSync(join(ROOT, '.projectmem')) ? '.projectmem/' : 'missing'}
MCP config docs: ${existsSync(join(ROOT, '.mcp', 'README.md')) ? '.mcp/README.md' : 'missing'}

Scripts:
${scripts.length ? scripts.map((script) => `- ${script}: ${pkg.scripts[script]}`).join('\n') : '- none'}

Workflows:
${listMd(join(ROOT, 'docs', 'workflows')).map((file) => `- docs/workflows/${file}`).join('\n') || '- missing'}

Tooling:
${listMd(join(ROOT, 'docs', 'tooling')).map((file) => `- docs/tooling/${file}`).join('\n') || '- missing'}

Skills:
${listDirs(join(ROOT, 'skills')).map((dir) => `- skills/${dir}/`).join('\n') || '- missing'}

Agent next step:
- Read AGENTS.md.
- Use agent-compass.commands.json for commands when present.
- Read relevant specs and project memory before planning.
`)
