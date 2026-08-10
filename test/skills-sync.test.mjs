import assert from 'node:assert/strict'
import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const AC = new URL('..', import.meta.url).pathname
const script = join(AC, 'scripts', 'skills-sync.mjs')
const cli = join(AC, 'scripts', 'cli.mjs')
const registryRunner = join(AC, 'scripts', 'run-command.mjs')

test('unified CLI lists capability packs and dispatches pack sync', async () => {
  const listed = await runNode([cli, 'skills-sync', '--list-packs'])
  assert.equal(listed.code, 0, listed.stderr)
  assert.match(listed.stdout, /devops-platform\s+22/)
  assert.match(listed.stdout, /security\s+35/)
  assert.match(listed.stdout, /infrastructure\s+70/)
  assert.match(listed.stdout, /compliance\s+19/)
  assert.match(listed.stdout, /aws\s+12/)
  assert.match(listed.stdout, /security-scanning\s+7/)

  const registered = await runNode([registryRunner, 'agentTools.skillsListPacks', AC])
  assert.equal(registered.code, 0, registered.stderr)
  assert.match(registered.stdout, /devops-platform\s+22/)

  const host = await mkdtemp(join(tmpdir(), 'ac-skills-cli-'))
  try {
    const synced = await runNode([cli, 'skills-sync', host, '--pack', 'devops-platform', '--target', 'agents'])
    assert.equal(synced.code, 0, synced.stderr)
    assert.match(synced.stdout, /synced 22 skills/)
    const entries = await readdir(join(host, '.agents', 'skills'))
    // The imported skills are MIT and carry no LICENSE of their own, so their
    // notice travels next to them. It is a sibling of the skill folders.
    assert.ok(entries.includes('THIRD_PARTY_NOTICES.md'), 'imported skills must ship their MIT notice')
    assert.equal(entries.filter((entry) => entry !== 'THIRD_PARTY_NOTICES.md').length, 22)
    assert.ok((await readdir(join(host, '.agents', 'skills', 'github-actions'))).includes('SKILL.md'))
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('skills-sync accepts one or more opt-in capability packs', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-skills-sync-'))
  try {
    const one = await runNode([script, host, '--pack', 'devops-platform', '--target', 'agents', '--dry'])
    assert.equal(one.code, 0, one.stderr)
    assert.equal(one.stdout.trim().split('\n').length, 22)
    assert.match(one.stdout, /would copy github-actions -> \.agents\/skills/)
    assert.match(one.stdout, /would copy kubernetes-ops -> \.agents\/skills/)

    const multiple = await runNode([script, host, '--pack', 'security,compliance', '--target', 'agents', '--dry'])
    assert.equal(multiple.code, 0, multiple.stderr)
    assert.equal(multiple.stdout.trim().split('\n').length, 54)
    assert.match(multiple.stdout, /would copy ai-agent-security -> \.agents\/skills/)
    assert.match(multiple.stdout, /would copy soc2-compliance -> \.agents\/skills/)

    const focused = await runNode([script, host, '--pack', 'aws', '--target', 'agents', '--dry'])
    assert.equal(focused.code, 0, focused.stderr)
    assert.equal(focused.stdout.trim().split('\n').length, 12)
    assert.match(focused.stdout, /terraform-aws/)
    assert.match(focused.stdout, /aws-cloudtrail/)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('default sync excludes capability packs and --all includes them', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-skills-default-'))
  try {
    const normal = await runNode([script, host, '--target', 'agents', '--dry'])
    assert.equal(normal.code, 0, normal.stderr)
    assert.match(normal.stdout, /would copy caveman -> \.agents\/skills/)
    assert.doesNotMatch(normal.stdout, /would copy github-actions ->/)

    const all = await runNode([script, host, '--target', 'agents', '--all', '--dry'])
    assert.equal(all.code, 0, all.stderr)
    assert.match(all.stdout, /would copy github-actions -> \.agents\/skills/)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('the MIT notice ships only when an imported skill ships', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-skills-notice-'))
  try {
    // An imported skill has no LICENSE of its own, so the notice must follow it.
    const imported = await runNode([script, host, '--only', 'container-scanning', '--target', 'agents'])
    assert.equal(imported.code, 0, imported.stderr)
    assert.ok((await readdir(join(host, '.agents', 'skills'))).includes('THIRD_PARTY_NOTICES.md'))

    // A skill vendored with its own LICENSE needs no corpus-wide notice.
    const own = await mkdtemp(join(tmpdir(), 'ac-skills-notice-'))
    try {
      const result = await runNode([script, own, '--only', 'ponytail', '--target', 'agents'])
      assert.equal(result.code, 0, result.stderr)
      const entries = await readdir(join(own, '.agents', 'skills'))
      assert.deepEqual(entries, ['ponytail'])
      assert.ok((await readdir(join(own, '.agents', 'skills', 'ponytail'))).includes('LICENSE'))
    } finally {
      await rm(own, { recursive: true, force: true })
    }
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('skills-sync rejects unknown or conflicting capability-pack selection', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-skills-sync-invalid-'))
  try {
    const unknown = await runNode([script, host, '--pack', 'unknown', '--dry'])
    assert.equal(unknown.code, 1)
    assert.match(unknown.stderr, /Unknown capability pack/)

    const conflict = await runNode([script, host, '--pack', 'security', '--only', 'verify-security', '--dry'])
    assert.equal(conflict.code, 1)
    assert.match(conflict.stderr, /Use either --only or --pack/)

    const allConflict = await runNode([script, host, '--all', '--pack', 'security', '--dry'])
    assert.equal(allConflict.code, 1)
    assert.match(allConflict.stderr, /Use only one of --all, --only, or --pack/)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})
