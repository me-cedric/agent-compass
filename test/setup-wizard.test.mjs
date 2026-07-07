import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const script = new URL('../scripts/setup-wizard.mjs', import.meta.url).pathname

test('wizard --yes --dry plans fit-based skill sync with detected stacks', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-wizard-'))
  try {
    await writeFile(join(host, 'package.json'), JSON.stringify({ name: 'fake-api', dependencies: { '@nestjs/core': '10' } }))
    const run = await runNode([script, host, '--yes', '--dry'])
    assert.equal(run.code, 0, run.stderr)
    assert.match(run.stdout, /"skillScope": "fit\+style"/)
    assert.match(run.stdout, /nestjs-api/)
    assert.match(run.stdout, /fit-based skills plus working-style skills/)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})
