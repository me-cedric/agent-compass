#!/usr/bin/env node
// policy-pack.mjs — list/apply Agent Compass setup policy packs.

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCliArgs, resolveRoot } from './lib/args.mjs'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))

const { values, positionals } = parseCliArgs({
  name: 'policy-pack',
  script: 'policy-pack.mjs',
  summary: 'List/apply Agent Compass setup policy packs.',
  positionals: [{ name: 'root', required: false }],
  options: {
    list: { type: 'boolean', desc: 'List available policy packs (default when no --apply).' },
    apply: { type: 'string', value: '<name>', desc: 'Apply the named policy pack to <root>/.agent/.' },
    json: { type: 'boolean', desc: 'Output the pack list as JSON.' },
  },
})

const root = resolveRoot(positionals)
const dir = join(AC, 'templates', 'policies')
const packs = readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')))
const name = values.apply || null
if (values.list || !name) {
  const data = packs.map(({ name, description, gates }) => ({ name, description, gates }))
  if (values.json) console.log(JSON.stringify(data, null, 2))
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
