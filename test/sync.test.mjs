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
const sync = new URL('../scripts/sync.mjs', import.meta.url).pathname
const LOCK = '.agent/agent-compass.lock'
const MANAGED = '.mcp/tool-contract.md'
const SEED = 'agent-compass.commands.json'

const setup = async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-sync-'))
  const r = await runNode([install, host], { cwd: root.pathname })
  assert.equal(r.code, 0, r.stderr)
  return host
}
const readLock = async (host) => JSON.parse(await readFile(join(host, LOCK), 'utf8'))
const writeLock = async (host, lock) => writeFile(join(host, LOCK), JSON.stringify(lock, null, 2))

test('sync fast-forwards a managed file the host has not edited', async () => {
  const host = await setup()
  try {
    await writeFile(join(host, MANAGED), 'OLD UPSTREAM\n')
    const lock = await readLock(host)
    lock.managed[MANAGED] = sha('OLD UPSTREAM\n') // pretend host == last-synced version
    await writeLock(host, lock)

    const r = await runNode([sync, host], { cwd: root.pathname })
    assert.equal(r.code, 0, r.stderr)
    const after = await readFile(join(host, MANAGED), 'utf8')
    assert.match(after, /MCP Tool Contract/)
    assert.doesNotMatch(after, /OLD UPSTREAM/)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('sync never clobbers a host-edited managed file; writes .acnew', async () => {
  const host = await setup()
  try {
    await writeFile(join(host, MANAGED), 'HOST EDIT\n') // diverged from locked sha
    const r = await runNode([sync, host], { cwd: root.pathname })
    assert.equal(r.code, 0, r.stderr)
    assert.equal(await readFile(join(host, MANAGED), 'utf8'), 'HOST EDIT\n')
    assert.ok(existsSync(join(host, `${MANAGED}.acnew`)))
    assert.match(await readFile(join(host, `${MANAGED}.acnew`), 'utf8'), /MCP Tool Contract/)
    assert.match(r.stdout, /Conflicts/)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('sync leaves seed files owned by the host', async () => {
  const host = await setup()
  try {
    await writeFile(join(host, SEED), 'HOST OWNED\n')
    const r = await runNode([sync, host], { cwd: root.pathname })
    assert.equal(r.code, 0, r.stderr)
    assert.equal(await readFile(join(host, SEED), 'utf8'), 'HOST OWNED\n')
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('sync applies version migrations and --check detects drift', async () => {
  const host = await setup()
  try {
    const lock = await readLock(host)
    lock.version = '0.0.0'
    await writeLock(host, lock)

    const migrate = await runNode([sync, host, '--target', '9.9.9'], { cwd: root.pathname })
    assert.equal(migrate.code, 0, migrate.stderr)
    assert.match(migrate.stdout, /0\.4\.0/)
    assert.match(migrate.stdout, /0\.7\.10/)
    assert.match(await readFile(join(host, '.gitignore'), 'utf8'), /\*\.acnew/)
    assert.match(await readFile(join(host, '.gitignore'), 'utf8'), /\.agent\/\.upstream-source-check\.json/)

    // Clean now → --check passes.
    const clean = await runNode([sync, host, '--check', '--target', '9.9.9'], { cwd: root.pathname })
    assert.equal(clean.code, 0, clean.stdout)

    // Create a fast-forward-pending state → --check fails.
    await writeFile(join(host, MANAGED), 'OLD\n')
    const drift = await readLock(host)
    drift.managed[MANAGED] = sha('OLD\n')
    await writeLock(host, drift)
    const check = await runNode([sync, host, '--check', '--target', '9.9.9'], { cwd: root.pathname })
    assert.equal(check.code, 1)
    assert.match(check.stderr, /out of date/)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})
