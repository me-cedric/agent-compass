import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const script = new URL('../scripts/vendor.mjs', import.meta.url).pathname

test('vendor copies a ref into the host with provenance', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-vendor-'))
  try {
    const run = await runNode([script, host, '--ref', 'v0.4.0'])
    assert.equal(run.code, 0, run.stderr)
    assert.ok(existsSync(join(host, 'docs', 'agent-compass', 'AGENTS.md')))
    assert.ok(existsSync(join(host, 'docs', 'agent-compass', 'MISSIONS.md')))
    const vendor = JSON.parse(await readFile(join(host, 'docs', 'agent-compass', '.vendor.json'), 'utf8'))
    assert.equal(vendor.version, '0.4.0')
    assert.equal(vendor.ref, 'v0.4.0')
    assert.match(vendor.commit, /^[0-9a-f]{40}$/)

    // Re-vendoring replaces the copy in place.
    const again = await runNode([script, host, '--ref', 'v0.4.0'])
    assert.equal(again.code, 0, again.stderr)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('vendor refuses to replace a directory that is not an agent-compass copy', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-vendor-safe-'))
  try {
    await mkdir(join(host, 'docs', 'agent-compass'), { recursive: true })
    await writeFile(join(host, 'docs', 'agent-compass', 'package.json'), JSON.stringify({ name: 'something-else' }))
    const run = await runNode([script, host])
    assert.equal(run.code, 1)
    assert.match(run.stderr, /Refusing to replace/)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})
