import assert from 'node:assert/strict'
import { join } from 'node:path'
import test from 'node:test'

import { CAPABILITY_PACKS } from '../scripts/lib/capability-packs.mjs'
import { runNode } from './helpers.mjs'

const AC = new URL('..', import.meta.url).pathname
const script = join(AC, 'scripts', 'skills-info.mjs')
const cli = join(AC, 'scripts', 'cli.mjs')

test('skills info searches descriptions and reports pack membership', async () => {
  const result = await runNode([script, '--grep', 'kubernetes', '--json'], { cwd: AC })
  assert.equal(result.code, 0, result.stderr)
  const payload = JSON.parse(result.stdout)
  assert.ok(payload.count > 1)
  const kubernetes = payload.skills.find((skill) => skill.name === 'kubernetes-ops')
  assert.ok(kubernetes)
  assert.ok(kubernetes.packs.includes('devops-platform'))
  assert.ok(kubernetes.packs.includes('kubernetes'))
})

test('skills info reports one focused pack and how to install it', async () => {
  const result = await runNode([script, '--pack', 'aws', '--json'], { cwd: AC })
  assert.equal(result.code, 0, result.stderr)
  const payload = JSON.parse(result.stdout)
  assert.equal(payload.count, CAPABILITY_PACKS.aws.skills.length)
  assert.deepEqual(payload.skills, CAPABILITY_PACKS.aws.skills)
  // The pack is a selection to install from the tracked source, not local content.
  assert.equal(payload.source, 'devops-security')
  assert.match(payload.install, /external-skills .* --source devops-security --skill /)
})

test('skills info answers for a tracked skill that is not stored here', async () => {
  const result = await runNode([script, 'github-actions', '--json'], { cwd: AC })
  assert.equal(result.code, 0, result.stderr)
  const payload = JSON.parse(result.stdout)
  assert.equal(payload.name, 'github-actions')
  assert.equal(payload.tracked, 'devops-security')
  assert.equal(payload.recommended, true)
  assert.equal(payload.license, 'MIT')
  assert.match(payload.source, /BagelHole/)
  assert.match(payload.source_commit, /^[a-f0-9]{40}$/)
  assert.match(payload.install, /--source devops-security --skill github-actions/)
  assert.ok(payload.packs.includes('devops-platform'))
})

test('a local skill wins a name collision with a tracked one', async () => {
  const result = await runNode([script, 'convert-documents-to-markdown', '--json'], { cwd: AC })
  assert.equal(result.code, 0, result.stderr)
  const payload = JSON.parse(result.stdout)
  assert.equal(payload.path, 'skills/convert-documents-to-markdown/SKILL.md')
  assert.equal(payload.tracked, undefined, 'the local skill is what an agent actually loads')
})

test('unified CLI dispatches skills search and rejects unknown packs', async () => {
  const dispatched = await runNode([cli, 'skills', '--grep', 'github actions', '--md'], { cwd: AC })
  assert.equal(dispatched.code, 0, dispatched.stderr)
  assert.match(dispatched.stdout, /github-actions/)

  const unknown = await runNode([script, '--pack', 'not-a-pack'], { cwd: AC })
  assert.equal(unknown.code, 1)
  assert.match(unknown.stderr, /Unknown capability pack/)
})
