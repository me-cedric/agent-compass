import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
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

test('wizard without --yes on a non-interactive terminal exits 1 with a hint', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-wizard-tty-'))
  try {
    const run = await runNode([script, host, '--dry'])
    assert.equal(run.code, 1)
    assert.match(run.stderr, /non-interactive terminal: pass --yes or run in a TTY/)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('wizard --yes writes answers.json defaulting to the four providers', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-wizard-answers-'))
  try {
    await writeFile(join(host, 'package.json'), JSON.stringify({ name: 'fake-api', dependencies: { '@nestjs/core': '10' } }))
    const run = await runNode([script, host, '--yes', '--no-run'])
    assert.equal(run.code, 0, run.stderr)
    const answers = JSON.parse(await readFile(join(host, 'agent-compass.answers.json'), 'utf8'))
    assert.deepEqual(Object.keys(answers), ['name', 'scope', 'packageManager', 'stacks', 'providers', 'useSpecKit', 'skillSync', 'skillScope'])
    assert.deepEqual(answers.providers, ['claude', 'codex', 'gemini', 'copilot'])
    assert.equal(answers.name, 'fake-api')
    assert.deepEqual(answers.stacks, ['nestjs-api'])
    assert.equal(answers.useSpecKit, true)
    assert.equal(answers.skillSync, 'copy')
    assert.equal(answers.skillScope, 'fit+style')
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('wizard rejects unknown flags and exposes --help', async () => {
  const bad = await runNode([script, '--bogus'])
  assert.equal(bad.code, 1)
  assert.match(bad.stderr, /--help/)

  const help = await runNode([script, '--help'])
  assert.equal(help.code, 0, help.stderr)
  assert.match(help.stdout, /^Usage:/)
})
