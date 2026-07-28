import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/cli.mjs', import.meta.url).pathname
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

test('cli prints version', async () => {
  const result = await runNode([script, '--version'], { cwd: root.pathname })
  assert.equal(result.code, 0, result.stderr)
  assert.equal(result.stdout.trim(), pkg.version)
})

test('cli help lists grouped commands', async () => {
  const result = await runNode([script, 'help'], { cwd: root.pathname })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /Usage: agent-compass/)
  assert.match(result.stdout, /install/)
  assert.match(result.stdout, /wizard/)
  assert.match(result.stdout, /apply-recommendations/)
  assert.match(result.stdout, /global-setup/)
  assert.match(result.stdout, /provider-verify/)
  assert.match(result.stdout, /mcp-probe/)
  assert.match(result.stdout, /sync/)
  assert.match(result.stdout, /check-update/)
})

test('cli rejects unknown commands', async () => {
  const result = await runNode([script, 'frobnicate'], { cwd: root.pathname })
  assert.equal(result.code, 1)
  assert.match(result.stderr, /Unknown command/)
})

test('cli dispatches a command and passes args through', async () => {
  const result = await runNode([script, 'context-pack', root.pathname], { cwd: root.pathname })
  assert.equal(result.code, 0, result.stderr)
  assert.equal(JSON.parse(result.stdout).schema, 1)
})

test('cli help <command> shows that command help', async () => {
  const result = await runNode([script, 'help', 'sync'], { cwd: root.pathname })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /Usage:.*sync/)
})

test('cli help shows aliases', async () => {
  const result = await runNode([script, 'help'], { cwd: root.pathname })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /\(alias: upgrade-host\)/)
  assert.match(result.stdout, /\(alias: new-project\)/)
})

test('cli translates a bare -h into --help for the child script', async () => {
  const result = await runNode([script, 'sync', '-h'], { cwd: root.pathname })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /Usage:/)
})

test('cli exports COMMANDS/ALIASES/GROUPS as data without side effects', async () => {
  const { COMMANDS, ALIASES, GROUPS } = await import('../scripts/cli.mjs')
  assert.ok(Object.keys(COMMANDS).length >= 40)
  for (const target of Object.values(ALIASES)) assert.ok(COMMANDS[target], `alias target ${target} missing`)
  for (const entry of Object.values(COMMANDS)) assert.ok(GROUPS.includes(entry.group), `unknown group ${entry.group}`)
})
