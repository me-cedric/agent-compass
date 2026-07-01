import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const script = new URL('../scripts/adopt.mjs', import.meta.url).pathname
const exec = promisify(execFile)

test('adopt --dry plans without writing', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-adopt-'))
  try {
    await writeFile(join(host, 'package.json'), JSON.stringify({ name: 'fake-api', dependencies: { '@nestjs/core': '10' } }))
    const run = await runNode([script, host, '--dry'])
    assert.equal(run.code, 0, run.stderr)
    assert.match(run.stdout, /fit-based skills/)
    assert.ok(!existsSync(join(host, 'AGENTS.md')), 'dry run must not write')
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('adopt sets up a host end-to-end and reports next steps', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-adopt-e2e-'))
  try {
    await exec('git', ['init', '-q'], { cwd: host })
    await writeFile(join(host, 'package.json'), JSON.stringify({ name: 'fake-api', dependencies: { '@nestjs/core': '10' }, scripts: { test: 'echo ok' } }))
    const run = await runNode([script, host])
    assert.equal(run.code, 0, run.stderr)
    assert.match(run.stdout, /Adoption complete/)
    assert.match(run.stdout, /agent-compass.commands.json/)
    assert.ok(existsSync(join(host, 'AGENTS.md')))
    assert.ok(existsSync(join(host, '.agent', 'recommendations.md')))
    // Fit-based sync: NestJS host gets backend patterns, not mobile ones.
    assert.ok(existsSync(join(host, '.claude', 'skills', 'nestjs-patterns')))
    assert.ok(!existsSync(join(host, '.claude', 'skills', 'expo-react-native-patterns')))
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('adopt fails clearly on a missing host', async () => {
  const run = await runNode([script, '/nonexistent/path/xyz'])
  assert.equal(run.code, 1)
  assert.match(run.stderr, /Host directory not found/)
})
