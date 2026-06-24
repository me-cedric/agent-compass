import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/run-command.mjs', import.meta.url).pathname

const withRegistry = async (fn) => {
  const host = await mkdtemp(join(tmpdir(), 'ac-cmd-'))
  await writeFile(join(host, 'agent-compass.commands.json'), JSON.stringify({
    schema: 1,
    hello: 'echo hi',
    deploy: 'echo would-deploy',
    group: { sub: 'echo deep' },
    notes: ['ignore me'],
  }))
  try { return await fn(host) } finally { await rm(host, { recursive: true, force: true }) }
}

test('run-command runs a known command and resolves dotted names', async () => {
  await withRegistry(async (host) => {
    const hello = await runNode([script, 'hello', host], { cwd: root.pathname })
    assert.equal(hello.code, 0, hello.stderr)
    assert.match(hello.stdout, /hi/)
    const deep = await runNode([script, 'group.sub', host], { cwd: root.pathname })
    assert.match(deep.stdout, /deep/)
  })
})

test('run-command refuses unknown and gates destructive commands', async () => {
  await withRegistry(async (host) => {
    const unknown = await runNode([script, 'nope', host], { cwd: root.pathname })
    assert.equal(unknown.code, 1)
    assert.match(unknown.stderr, /not a configured command/)

    const blocked = await runNode([script, 'deploy', host], { cwd: root.pathname })
    assert.equal(blocked.code, 1)
    assert.match(blocked.stderr, /destructive/)

    const confirmed = await runNode([script, 'deploy', host, '--confirm'], { cwd: root.pathname })
    assert.equal(confirmed.code, 0, confirmed.stderr)
  })
})

test('run-command --list shows runnable names', async () => {
  await withRegistry(async (host) => {
    const list = await runNode([script, '--list', host], { cwd: root.pathname })
    assert.equal(list.code, 0, list.stderr)
    assert.match(list.stdout, /hello/)
    assert.match(list.stdout, /group\.sub/)
    assert.doesNotMatch(list.stdout, /notes/)
  })
})
