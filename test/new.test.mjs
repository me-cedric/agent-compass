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
    const skillMd = await readFile(join(host, 'skills', 'my-thing', 'SKILL.md'), 'utf8')
    assert.match(skillMd, /name: my-thing/)
    // Required frontmatter contract (lint:naming enforces these on every skill).
    assert.match(skillMd, /^description: \S/m)
    assert.match(skillMd, /^risk_level: (low|medium|high)$/m)
    assert.match(skillMd, /^writes_files: (true|false)$/m)
    assert.match(skillMd, /^requires_tools: \[/m)
    assert.match(skill.stdout, /skills\/README\.md/)

    const adr = await runNode([script, 'adr', 'my-choice', host], { cwd: root.pathname })
    assert.equal(adr.code, 0, adr.stderr)
    await readFile(join(host, 'docs', 'decisions', 'my-choice.md'), 'utf8')

    const arch = await runNode([script, 'arch', 'payments-platform', host], { cwd: root.pathname })
    assert.equal(arch.code, 0, arch.stderr)
    assert.match(await readFile(join(host, 'docs', 'architecture', 'decisions', 'payments-platform.md'), 'utf8'), /Architecture Decision/)

    const instinct = await runNode([script, 'instinct', 'retry-pattern', host], { cwd: root.pathname })
    assert.equal(instinct.code, 0, instinct.stderr)
    const instinctMd = await readFile(join(host, 'knowledge', 'instincts', 'retry-pattern.md'), 'utf8')
    assert.match(instinctMd, /^id: retry-pattern$/m)
    assert.match(instinctMd, /^trigger: /m)

    const stack = await runNode([script, 'stack', 'fastify-api', host], { cwd: root.pathname })
    assert.equal(stack.code, 0, stack.stderr)
    assert.match(await readFile(join(host, 'stacks', 'fastify-api.md'), 'utf8'), /# Preset: Fastify Api/)
    assert.match(stack.stdout, /stacks\/README\.md/)

    const workflow = await runNode([script, 'workflow', 'incident-response', host], { cwd: root.pathname })
    assert.equal(workflow.code, 0, workflow.stderr)
    assert.match(await readFile(join(host, 'docs', 'workflows', 'incident-response.md'), 'utf8'), /# Incident Response/)
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
