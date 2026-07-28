import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const script = new URL('../scripts/global-setup.mjs', import.meta.url).pathname

test('global-setup --dry previews without writing anything', async () => {
  const home = await mkdtemp(join(tmpdir(), 'ac-global-dry-'))
  try {
    const run = await runNode([script, home, '--dry'])
    assert.equal(run.code, 0, run.stderr)
    assert.match(run.stdout, /would create \.agent-compass\/README\.md/)
    assert.match(run.stdout, /"mode": "copy"/)
    assert.equal(existsSync(join(home, '.agent-compass')), false)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('global-setup rejects unknown flags and exposes --help', async () => {
  const bad = await runNode([script, '--bogus'])
  assert.equal(bad.code, 1)
  assert.match(bad.stderr, /--help/)

  const help = await runNode([script, '--help'])
  assert.equal(help.code, 0, help.stderr)
  assert.match(help.stdout, /^Usage:/)
  assert.match(help.stdout, /--jira-url/)
})
