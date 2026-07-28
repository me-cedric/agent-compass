import assert from 'node:assert/strict'
import test from 'node:test'

import { renderHelp, resolveRoot, tryParse } from '../scripts/lib/args.mjs'

const spec = {
  name: 'demo',
  summary: 'Demo command.',
  positionals: [{ name: 'host-dir', required: false }],
  options: {
    dry: { type: 'boolean', desc: 'Preview only.' },
    policy: { type: 'string', value: '<name>', desc: 'Policy pack.' },
    only: { type: 'string', multiple: true, value: '<name>', desc: 'Repeatable filter.' },
  },
}

test('tryParse accepts flags, positionals, and --flag=value', () => {
  const result = tryParse({ ...spec, argv: ['.', '--dry', '--policy=strict'] })
  assert.equal(result.ok, true)
  assert.equal(result.values.dry, true)
  assert.equal(result.values.policy, 'strict')
  assert.deepEqual(result.positionals, ['.'])
})

test('tryParse rejects unknown flags instead of ignoring them', () => {
  const result = tryParse({ ...spec, argv: ['--dyr'] })
  assert.equal(result.ok, false)
  assert.match(result.error, /--dyr/)
})

test('tryParse rejects a value flag that swallowed the next flag', () => {
  const result = tryParse({ ...spec, argv: ['--policy', '--dry'] })
  assert.equal(result.ok, false)
  assert.match(result.error, /--policy.*ambiguous|forget to specify/s)
})

test('tryParse rejects extra positionals', () => {
  const result = tryParse({ ...spec, argv: ['.', 'unexpected'] })
  assert.equal(result.ok, false)
  assert.match(result.error, /Unexpected argument: unexpected/)
})

test('tryParse never treats -h as a positional', () => {
  const result = tryParse({ ...spec, argv: ['-h'] })
  assert.equal(result.ok, true)
  assert.equal(result.help, true)
  assert.deepEqual(result.positionals, [])
})

test('tryParse collects repeatable string flags', () => {
  const result = tryParse({ ...spec, argv: ['--only', 'a', '--only', 'b'] })
  assert.equal(result.ok, true)
  assert.deepEqual(result.values.only, ['a', 'b'])
})

test('renderHelp starts with Usage and lists every option', () => {
  const help = renderHelp({ ...spec, script: 'demo.mjs' })
  assert.match(help, /^Usage: agent-compass demo \[host-dir\] \[options\]/)
  assert.match(help, /node scripts\/demo\.mjs/)
  assert.match(help, /--dry/)
  assert.match(help, /--policy <name>/)
  assert.match(help, /--help, -h/)
})

test('resolveRoot prefers the flag, then the positional, then cwd', () => {
  assert.equal(resolveRoot(['/tmp/a'], '/tmp/b'), '/tmp/b')
  assert.equal(resolveRoot(['/tmp/a'], undefined), '/tmp/a')
  assert.equal(resolveRoot([], undefined), process.cwd())
})
