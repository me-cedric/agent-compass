import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'
import { findIssues } from '../scripts/lib/redact.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/redact.mjs', import.meta.url).pathname

test('findIssues flags secrets and emails, ignores clean text', () => {
  assert.equal(findIssues('password: swordfish').length, 1)
  assert.equal(findIssues('reach me at a@b.co').length, 1)
  assert.equal(findIssues('apps/web-app/src/shared/components/accordion/Accordion.stories.tsx').length, 0)
  assert.equal(findIssues('just a normal note').length, 0)
})

test('findIssues ignores reserved documentation emails', () => {
  assert.equal(findIssues('seed user: candidate.incomplete@example.test').length, 0)
  assert.equal(findIssues('contact: user@example.com').length, 0)
  assert.equal(findIssues('fixture: admin@auth.example.org').length, 0)
  assert.equal(findIssues('real: jean.dupont@acme-corp.fr').length, 1)
})

test('redact CLI fails on a leak and passes clean files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ac-redact-'))
  try {
    await writeFile(join(dir, 'bad.txt'), 'token: ghp_ABCDEFGHIJKLMNOPQRSTUVWXYZ012345\n')
    await writeFile(join(dir, 'ok.txt'), 'nothing to see here\n')

    const bad = await runNode([script, dir, '--files', 'bad.txt'], { cwd: root.pathname })
    assert.equal(bad.code, 1)
    assert.match(bad.stderr, /secret/)

    const ok = await runNode([script, dir, '--files', 'ok.txt'], { cwd: root.pathname })
    assert.equal(ok.code, 0, ok.stderr)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
