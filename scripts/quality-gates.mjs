#!/usr/bin/env node
// quality-gates.mjs — generic repo health gates agents can run before handoff.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const help = `Usage: node scripts/quality-gates.mjs [root] [--write] [--json] [--strict]`
if (args.includes('--help')) { console.log(help); process.exit(0) }
const root = resolve(args.find((a) => !a.startsWith('--')) || process.cwd())
const has = (p) => existsSync(join(root, p))
const walk = (dir, depth, out = []) => {
  if (!existsSync(dir) || depth < 0) return out
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist', 'build', '.turbo', '.agent'].includes(e.name)) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) walk(full, depth - 1, out)
    else out.push(full)
  }
  return out
}
const rel = (p) => p.slice(root.length + 1)
const files = walk(root, 4)
const source = files.filter((f) => /\.(mjs|js|ts|tsx)$/.test(f) && !/\.(test|spec)\./.test(f))
const tests = new Set(files.filter((f) => /\.(test|spec)\.(mjs|js|ts|tsx)$/.test(f)).map((f) => rel(f)))
const issues = []
if (!has('agent-compass.commands.json')) issues.push(['commands', 'missing command registry'])
if (!has('AGENTS.md')) issues.push(['guidance', 'missing AGENTS.md'])
if (!has('.agent/context.json')) issues.push(['context', 'missing .agent/context.json'])
if (has('package.json')) {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
  if (!pkg.scripts?.test) issues.push(['validation', 'package.json has no test script'])
}
for (const f of source.slice(0, 200)) {
  const r = rel(f)
  const candidate = r.replace(/\.(mjs|js|ts|tsx)$/, '.test.$1')
  const candidate2 = r.replace(/\.(mjs|js|ts|tsx)$/, '.spec.$1')
  if (r.startsWith('scripts/') && !tests.has(candidate) && !tests.has(candidate2)) issues.push(['tests', `${r} has no nearby test`])
}
const report = `# Agent Quality Gates

| Gate | Result | Detail |
| ---- | ------ | ------ |
${issues.length ? issues.map(([gate, detail]) => `| ${gate} | issue | ${detail} |`).join('\n') : '| all | ok | no issues found |'}
`
if (args.includes('--json')) console.log(JSON.stringify({ schema: 1, root, issues: issues.map(([gate, detail]) => ({ gate, detail })) }, null, 2))
else if (args.includes('--write')) {
  mkdirSync(join(root, '.agent'), { recursive: true })
  writeFileSync(join(root, '.agent', 'quality-gates.md'), report)
  console.log(join(root, '.agent', 'quality-gates.md'))
} else console.log(report)
if (args.includes('--strict') && issues.length) process.exit(1)
