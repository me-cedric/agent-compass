#!/usr/bin/env node
// policy-pack.mjs — list/apply Agent Compass setup policy packs.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))
const args = process.argv.slice(2)
const help = `Usage: node scripts/policy-pack.mjs [root] [--list] [--apply <name>] [--json]`
if (args.includes('--help')) { console.log(help); process.exit(0) }
const flag = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1] }
const root = resolve(args.find((a) => !a.startsWith('--') && a !== flag('--apply')) || process.cwd())
const dir = join(AC, 'templates', 'policies')
const packs = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
const name = flag('--apply')
if (args.includes('--list') || !name) {
  const data = packs.map(({ name, description, gates }) => ({ name, description, gates }))
  if (args.includes('--json')) console.log(JSON.stringify(data, null, 2))
  else console.log(data.map((p) => `- ${p.name}: ${p.description}`).join('\n'))
  process.exit(0)
}
const pack = packs.find((p) => p.name === name)
if (!pack) { console.error(`Unknown policy pack: ${name}`); process.exit(1) }
mkdirSync(join(root, '.agent'), { recursive: true })
writeFileSync(join(root, '.agent', 'policy.json'), JSON.stringify(pack, null, 2) + '\n')
writeFileSync(join(root, '.agent', 'policy.md'), `# Agent Policy: ${pack.name}

${pack.description}

${pack.constraints?.length ? `## Constraints\n\n${pack.constraints.map((g) => `- ${g}`).join('\n')}\n\n` : ''}
## Required Gates

${pack.gates.map((g) => `- ${g}`).join('\n')}
`)
console.log(`applied ${pack.name}`)
