import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const AC = new URL('..', import.meta.url).pathname
const script = join(AC, 'scripts', 'provider-verify.mjs')

test('project checks cover the 4 providers and drop cursor/windsurf', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-pv-'))
  try {
    await writeFile(join(host, 'GEMINI.md'), 'Read AGENTS.md first.')
    await mkdir(join(host, '.gemini'), { recursive: true })
    await writeFile(join(host, '.gemini', 'settings.example.json'), '{}')
    const res = await runNode([script, host, '--json'])
    assert.equal(res.code, 0, res.stderr)
    const { checks } = JSON.parse(res.stdout)
    const labels = checks.map((c) => c.label)
    assert.ok(!labels.some((l) => /cursor|windsurf/i.test(l)), 'cursor/windsurf checks must be gone')
    for (const provider of ['Claude', 'Codex', 'Copilot', 'Gemini']) {
      assert.ok(checks.some((c) => c.provider === provider), `missing checks for ${provider}`)
    }
    const byLabel = Object.fromEntries(checks.map((c) => [c.label, c]))
    assert.equal(byLabel['GEMINI.md points to AGENTS'].ok, true)
    assert.equal(byLabel['GEMINI.md points to AGENTS'].provider, 'Gemini')
    assert.equal(byLabel['Gemini settings example exists'].ok, true)
    assert.equal(byLabel['AGENTS.md'].ok, false, 'empty host must fail the AGENTS.md check')
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('markdown report renders and --strict exits 1 on failing checks', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-pv-strict-'))
  try {
    const plain = await runNode([script, host])
    assert.equal(plain.code, 0, plain.stderr)
    assert.match(plain.stdout, /# Provider Verification/)
    assert.match(plain.stdout, /GEMINI\.md points to AGENTS/)
    assert.doesNotMatch(plain.stdout, /Cursor|Windsurf/)

    const strict = await runNode([script, host, '--strict'])
    assert.equal(strict.code, 1, 'strict mode must fail on an empty host')
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('help exits 0 with usage; unknown flags exit 1', async () => {
  const help = await runNode([script, '--help'])
  assert.equal(help.code, 0)
  assert.match(help.stdout, /^Usage:/)
  assert.match(help.stdout, /--global/)
  assert.match(help.stdout, /--strict/)

  const bad = await runNode([script, '--no-such-flag'])
  assert.equal(bad.code, 1)
  assert.match(bad.stderr, /--help/)
})
