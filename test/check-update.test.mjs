import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'
import { sha } from '../scripts/manifest.mjs'

const root = new URL('..', import.meta.url)
const install = new URL('../scripts/install.mjs', import.meta.url).pathname
const script = new URL('../scripts/check-update.mjs', import.meta.url).pathname
const LOCK = '.agent/agent-compass.lock'
const MANAGED = '.mcp/tool-contract.md'

const installed = async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-upd-'))
  const r = await runNode([install, host], { cwd: root.pathname })
  assert.equal(r.code, 0, r.stderr)
  return host
}

test('check-update is silent-friendly and caches when up to date', async () => {
  const host = await installed()
  try {
    const clean = await runNode([script, host, '--force'], { cwd: root.pathname })
    assert.equal(clean.code, 0, clean.stderr)
    assert.match(clean.stdout, /up to date/)
    assert.ok(existsSync(join(host, '.agent', '.update-check.json')))

    const quiet = await runNode([script, host, '--force', '--quiet'], { cwd: root.pathname })
    assert.equal(quiet.code, 0, quiet.stderr)
    assert.equal(quiet.stdout.trim(), '')
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('check-update reports and (with --strict) fails when behind', async () => {
  const host = await installed()
  try {
    await writeFile(join(host, MANAGED), 'OLD\n')
    const lock = JSON.parse(await readFile(join(host, LOCK), 'utf8'))
    lock.managed[MANAGED] = sha('OLD\n')
    await writeFile(join(host, LOCK), JSON.stringify(lock, null, 2))

    const behind = await runNode([script, host, '--force'], { cwd: root.pathname })
    assert.equal(behind.code, 0, behind.stderr)
    assert.match(behind.stdout, /update available/)
    assert.match(behind.stdout, /behind/)

    const strict = await runNode([script, host, '--force', '--strict'], { cwd: root.pathname })
    assert.equal(strict.code, 1)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})
