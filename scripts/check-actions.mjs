#!/usr/bin/env node
// check-actions.mjs — enforce supported GitHub Action major versions.

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCliArgs } from './lib/args.mjs'

const { values, positionals } = parseCliArgs({
  name: 'check-actions',
  usage: 'node scripts/check-actions.mjs [root] [options]',
  summary: 'Fail when repo workflows/templates use stale GitHub Action major versions.',
  positionals: [{ name: 'root', required: false }],
  options: {
    root: { type: 'string', value: '<dir>', desc: 'Root directory (also accepted as a positional).' },
  },
})

const ROOT = resolve(values.root || positionals[0] || dirname(dirname(fileURLToPath(import.meta.url))))
const REQUIRED = new Map([
  ['actions/checkout', 'v7'],
  ['actions/setup-node', 'v6'],
  ['actions/upload-artifact', 'v7'],
  ['actions/github-script', 'v9'],
])
const SCAN_DIRS = ['.github/workflows', 'templates/ci']
const hits = []

const walk = (dir, onFile) => {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, onFile)
    else onFile(full)
  }
}

for (const dir of SCAN_DIRS) {
  walk(join(ROOT, dir), (file) => {
    if (!['.yml', '.yaml'].includes(extname(file))) return
    const text = readFileSync(file, 'utf8')
    for (const match of text.matchAll(/uses:\s*([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)@([^\s#]+)/g)) {
      const [, action, version] = match
      const required = REQUIRED.get(action)
      if (required && version !== required) {
        hits.push(`${relative(ROOT, file)}: ${action}@${version} should be ${action}@${required}`)
      }
    }
  })
}

if (hits.length) {
  console.error(`✗ ${hits.length} stale GitHub Action reference(s):\n`)
  hits.forEach((hit) => console.error(`  ${hit}`))
  process.exit(1)
}

console.log('✓ GitHub Action versions match repo policy.')
