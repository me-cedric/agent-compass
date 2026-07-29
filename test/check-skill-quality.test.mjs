import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { riskSignals, sha256 } from '../scripts/lib/upstream-skills.mjs'
import { runNode } from './helpers.mjs'

const AC = new URL('..', import.meta.url).pathname
const script = join(AC, 'scripts', 'check-skill-quality.mjs')
const cli = join(AC, 'scripts', 'cli.mjs')

test('skill quality gate validates the live imported collection', async () => {
  const result = await runNode([cli, 'check-skill-quality'], { cwd: AC })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /quality passed for 146 imported skills/)
})

test('skill quality gate rejects unsafe metadata, relative links, and payloads', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ac-skill-quality-'))
  try {
    const dir = join(root, 'skills', 'demo')
    await mkdir(dir, { recursive: true })
    const content = `---
name: demo
description: Demo.
risk_level: low
writes_files: false
requires_tools: []
source: https://github.com/example/repo
source_commit: abc123
---

# Demo

[Unsafe relative reference](../other/SKILL.md)
`
    await writeFile(join(dir, 'SKILL.md'), content)
    await writeFile(join(dir, 'run.sh'), '#!/bin/sh\n')
    await writeFile(join(root, 'skills', 'upstream-lock.json'), JSON.stringify({
      schema: 1,
      upstream: { repository: 'https://github.com/example/repo', commit: 'abc123' },
      transformation: {},
      skills: {
        demo: {
          riskLevel: 'high',
          localSha256: sha256(content),
          riskSignals: riskSignals(content),
        },
      },
    }))

    const result = await runNode([script, '--root', root], { cwd: AC })
    assert.equal(result.code, 1)
    assert.match(result.stderr, /safety gate missing/)
    assert.match(result.stderr, /risk_level must equal locked value high/)
    assert.match(result.stderr, /writes_files must be true/)
    assert.match(result.stderr, /relative Markdown link/)
    assert.match(result.stderr, /extra payloads present/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
