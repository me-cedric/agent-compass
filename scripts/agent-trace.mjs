#!/usr/bin/env node
// agent-trace.mjs — validate an agent trace/outcome log (JSONL). Every row needs
// task/type/validation/outcome and must contain no secret-, credential-, or
// PII-looking content. Helps teams learn from failures without storing secrets.

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SECRET_RE, EMAIL_RE } from './lib/redact.mjs'

const help = `Usage: node scripts/agent-trace.mjs [--root <dir>] [--file <path>]

Validate an agent trace log (JSONL): required fields + no secrets/PII.

Options:
  --root <dir>   Repository root.
  --file <path>  JSONL log (default: templates/trace/agent-trace.example.jsonl).
  --help         Show this help.
`

if (process.argv.includes('--help')) {
  console.log(help)
  process.exit(0)
}

const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i === -1 ? null : process.argv[i + 1]
}

const AC = dirname(dirname(fileURLToPath(import.meta.url)))
const ROOT = resolve(arg('--root') || AC)
const file = resolve(ROOT, arg('--file') || 'templates/trace/agent-trace.example.jsonl')

const REQUIRED = ['task', 'type', 'validation', 'outcome']
const VALIDATION = new Set(['passed', 'failed', 'partial', 'not run'])
// Secret/PII screen is shared with scripts/redact.mjs (see scripts/lib/redact.mjs).

let raw
try {
  raw = readFileSync(file, 'utf8')
} catch (error) {
  console.error(`failed to read trace log: ${error.message}`)
  process.exit(1)
}

const issues = []
let rows = 0
raw.split('\n').forEach((line, index) => {
  const text = line.trim()
  if (!text) return
  rows += 1
  const where = `line ${index + 1}`
  if (SECRET_RE.test(text)) issues.push(`${where}: looks like a secret/credential — do not log it`)
  if (EMAIL_RE.test(text)) issues.push(`${where}: looks like personal data (email)`)
  let row
  try {
    row = JSON.parse(text)
  } catch {
    issues.push(`${where}: not valid JSON`)
    return
  }
  for (const field of REQUIRED) {
    if (!row[field]) issues.push(`${where}: missing "${field}"`)
  }
  if (row.validation && !VALIDATION.has(row.validation)) {
    issues.push(`${where}: validation "${row.validation}" not one of ${[...VALIDATION].join(', ')}`)
  }
})

if (!rows) issues.push('no trace rows found')

if (issues.length) {
  console.error(`✗ ${issues.length} trace issue(s):\n${issues.map((i) => `  ${i}`).join('\n')}`)
  process.exit(1)
}

console.log(`✓ agent trace valid — ${rows} rows, no secrets/PII detected.`)
