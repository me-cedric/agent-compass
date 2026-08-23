import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const AC = new URL('..', import.meta.url).pathname
const script = join(AC, 'scripts', 'skills-sync.mjs')
const cli = join(AC, 'scripts', 'cli.mjs')
const registryRunner = join(AC, 'scripts', 'run-command.mjs')

test('unified CLI lists capability packs and points at the installer', async () => {
  const listed = await runNode([cli, 'skills-sync', '--list-packs'])
  assert.equal(listed.code, 0, listed.stderr)
  assert.match(listed.stdout, /devops-platform/)
  assert.match(listed.stdout, /not in this repository/)
  assert.match(listed.stdout, /external-skills/)
})

test('one --only list installs local skills and fetches tracked ones', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-sync-mixed-'))
  try {
    // The point of the routing: a caller does not have to know which kind a name is.
    const mixed = await runNode([script, host, '--only', 'gen-docs,minimalist-ui,kubernetes-ops', '--target', 'agents', '--dry'])
    assert.equal(mixed.code, 0, mixed.stderr)
    assert.match(mixed.stdout, /would copy gen-docs -> \.agents\/skills/)
    assert.match(mixed.stdout, /would fetch minimalist-ui from taste-skill/)
    assert.match(mixed.stdout, /would fetch kubernetes-ops from devops-security/)

    const skipped = await runNode([script, host, '--only', 'gen-docs,minimalist-ui', '--target', 'agents', '--no-external', '--dry'])
    assert.equal(skipped.code, 0, skipped.stderr)
    assert.match(skipped.stdout, /skipped 1 tracked external skill/)
    assert.doesNotMatch(skipped.stdout, /would fetch minimalist-ui/)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('default sync ships only the skills this repository holds', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-sync-default-'))
  try {
    const normal = await runNode([script, host, '--target', 'agents', '--dry'])
    assert.equal(normal.code, 0, normal.stderr)
    assert.match(normal.stdout, /would copy working-style-skills -> \.agents\/skills/)
    assert.match(normal.stdout, /would copy operational-skills -> \.agents\/skills/)
    // A tracked operational skill is never a local folder, with or without --all.
    assert.doesNotMatch(normal.stdout, /would copy github-actions ->/)
    const all = await runNode([script, host, '--all', '--target', 'agents', '--dry'])
    assert.equal(all.code, 0, all.stderr)
    assert.doesNotMatch(all.stdout, /would copy github-actions ->/)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('a fetched skill ships its source notice; a compass skill ships alone', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-sync-notice-'))
  try {
    // A tracked skill carries a third-party licence and no local copy exists, so
    // the notice is written beside it at install time.
    const fetched = await runNode([script, host, '--only', 'minimalist-ui', '--target', 'agents'])
    assert.equal(fetched.code, 0, fetched.stderr)
    const entries = (await readdir(join(host, '.agents', 'skills'))).sort()
    assert.deepEqual(entries, ['THIRD_PARTY_NOTICES.taste-skill.md', 'minimalist-ui'])
    const notice = await readFile(join(host, '.agents', 'skills', 'THIRD_PARTY_NOTICES.taste-skill.md'), 'utf8')
    assert.match(notice, /Leonxlnx\/taste-skill/)
    assert.match(notice, /never relaxes a gate in AGENTS\.md/)

    const own = await mkdtemp(join(tmpdir(), 'ac-sync-own-'))
    try {
      const result = await runNode([script, own, '--only', 'working-style-skills', '--target', 'agents'])
      assert.equal(result.code, 0, result.stderr)
      assert.deepEqual((await readdir(join(own, '.agents', 'skills'))).sort(), ['working-style-skills'])
    } finally {
      await rm(own, { recursive: true, force: true })
    }
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('skills-sync rejects an unknown skill and an impossible selection', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-sync-reject-'))
  try {
    const unknown = await runNode([script, host, '--only', 'no-such-skill', '--dry'])
    assert.equal(unknown.code, 1)
    assert.match(unknown.stderr, /Unknown skill\(s\): no-such-skill/)

    const conflict = await runNode([script, host, '--all', '--only', 'verify-security', '--dry'])
    assert.equal(conflict.code, 1)
    assert.match(conflict.stderr, /Use either --all or --only/)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})
