import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/new.mjs', import.meta.url).pathname

test('new scaffolds a valid skill and an ADR', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-new-'))
  try {
    const skill = await runNode([script, 'skill', 'my-thing', host], { cwd: root.pathname })
    assert.equal(skill.code, 0, skill.stderr)
    assert.match(await readFile(join(host, 'skills', 'my-thing', 'SKILL.md'), 'utf8'), /name: my-thing/)

    const adr = await runNode([script, 'adr', 'my-choice', host], { cwd: root.pathname })
    assert.equal(adr.code, 0, adr.stderr)
    await readFile(join(host, 'docs', 'decisions', 'my-choice.md'), 'utf8')
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('new refuses overwrite and bad names', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-new-'))
  try {
    await runNode([script, 'skill', 'dup', host], { cwd: root.pathname })
    const again = await runNode([script, 'skill', 'dup', host], { cwd: root.pathname })
    assert.equal(again.code, 1)
    assert.match(again.stderr, /Refusing to overwrite/)

    const bad = await runNode([script, 'skill', 'Bad_Name', host], { cwd: root.pathname })
    assert.equal(bad.code, 1)
    assert.match(bad.stderr, /kebab-case/)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})
