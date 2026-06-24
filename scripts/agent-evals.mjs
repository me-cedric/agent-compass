#!/usr/bin/env node
// agent-evals.mjs — validate portable eval fixtures for teaching/tool-offer behavior.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const help = `Usage: node scripts/agent-evals.mjs [--root <dir>] [--fixture <path>] [--list]

Validate agent teaching/tool-offer eval fixtures and referenced repo artifacts.

Options:
  --root <dir>      Repository root.
  --fixture <path>  Eval JSON path. Defaults to templates/evals/agent-teaching-evals.json.
  --list            Print scenario names.
  --help            Show this help.
`

if (process.argv.includes('--help')) {
  console.log(help)
  process.exit(0)
}

const arg = (name) => {
  const i = process.argv.indexOf(name)
  return i === -1 ? null : process.argv[i + 1]
}

const ROOT = resolve(arg('--root') || dirname(dirname(fileURLToPath(import.meta.url))))
const fixturePath = resolve(ROOT, arg('--fixture') || 'templates/evals/agent-teaching-evals.json')
const fail = (msg) => {
  console.error(msg)
  process.exit(1)
}

let fixture
try {
  fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
} catch (error) {
  fail(`failed to read eval fixture: ${error.message}`)
}

if (!Array.isArray(fixture.scenarios) || fixture.scenarios.length === 0) fail('fixture.scenarios must be a non-empty array')
if (!Array.isArray(fixture.references)) fail('fixture.references must be an array')

const missingRefs = fixture.references.filter((path) => !existsSync(join(ROOT, path)))
if (missingRefs.length) fail(`missing referenced artifacts:\n${missingRefs.map((p) => `- ${p}`).join('\n')}`)

const issues = []
for (const scenario of fixture.scenarios) {
  if (!scenario.id) issues.push('scenario missing id')
  if (!scenario.prompt) issues.push(`${scenario.id || '(unknown)'} missing prompt`)
  if (!Array.isArray(scenario.expect) || !scenario.expect.length) issues.push(`${scenario.id || '(unknown)'} missing expect[]`)
  if (!Array.isArray(scenario.reject) || !scenario.reject.length) issues.push(`${scenario.id || '(unknown)'} missing reject[]`)
}
if (issues.length) fail(`invalid eval fixture:\n${issues.map((i) => `- ${i}`).join('\n')}`)

if (process.argv.includes('--list')) {
  fixture.scenarios.forEach((scenario) => console.log(`${scenario.id}: ${scenario.prompt}`))
} else {
  console.log(`✓ agent eval fixture valid — ${fixture.scenarios.length} scenarios, ${fixture.references.length} references.`)
}
