#!/usr/bin/env node
// redact.mjs — scan files (or the staged diff) for secret/PII-looking content.
// Wire into a pre-commit hook so credentials never get committed or logged.

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { findIssues } from './lib/redact.mjs'

const help = `Usage: node scripts/redact.mjs [root] [--staged] [--files a,b]

Scan files for secret/PII-looking content. Exit 1 if any is found.

Options:
  --staged     Scan files staged for commit (git diff --cached).
  --files a,b  Explicit comma-separated file list.
  --help       Show this help.
`

const args = process.argv.slice(2)
if (args.includes('--help')) { console.log(help); process.exit(0) }

const flag = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1] }
const ROOT = resolve(args.find((a) => !a.startsWith('--') && a !== flag('--files')) || process.cwd())

let files = []
const filesFlag = flag('--files')
if (filesFlag) {
  files = filesFlag.split(',').map((f) => f.trim()).filter(Boolean)
} else if (args.includes('--staged')) {
  try {
    files = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACM'], { cwd: ROOT, encoding: 'utf8' })
      .split('\n').map((f) => f.trim()).filter(Boolean)
  } catch (error) {
    console.error(`git diff failed: ${error.message}`)
    process.exit(1)
  }
} else {
  console.error('Pass --staged or --files a,b.')
  process.exit(1)
}

const hits = []
for (const file of files) {
  let text
  try { text = readFileSync(join(ROOT, file), 'utf8') } catch { continue }
  for (const issue of findIssues(text)) hits.push(`${file}:${issue.line}: possible ${issue.kind}`)
}

if (hits.length) {
  console.error(`✗ ${hits.length} possible secret/PII leak(s):\n${hits.map((h) => `  ${h}`).join('\n')}\n\nRemove them, use a secret store, or scrub before committing.`)
  process.exit(1)
}
console.log(`✓ no secrets/PII detected in ${files.length} file(s).`)
