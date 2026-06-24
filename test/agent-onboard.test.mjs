import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const install = new URL('../scripts/install.mjs', import.meta.url).pathname
const script = new URL('../scripts/agent-onboard.mjs', import.meta.url).pathname

test('agent-onboard reports ready for a freshly installed host', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-onboard-'))
  try {
    const i = await runNode([install, host], { cwd: root.pathname })
    assert.equal(i.code, 0, i.stderr)

    const onboard = await runNode([script, host, '--strict'], { cwd: root.pathname })
    assert.equal(onboard.code, 0, onboard.stderr)
    assert.match(onboard.stdout, /Agent Onboarding/)
    assert.match(onboard.stdout, /ready/)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})
