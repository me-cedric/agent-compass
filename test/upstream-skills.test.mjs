import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  adaptSkill,
  compareRiskBaselines,
  riskSignals,
  sha256,
  verifyLocalLock,
} from '../scripts/lib/upstream-skills.mjs'
import { runNode } from './helpers.mjs'

const AC = new URL('..', import.meta.url).pathname
const script = join(AC, 'scripts', 'upstream-skills.mjs')
const cli = join(AC, 'scripts', 'cli.mjs')
const registryRunner = join(AC, 'scripts', 'run-command.mjs')

test('adaptSkill applies deterministic metadata, safety, links, provenance, and whitespace', () => {
  const raw = `---
name: demo-skill
description: Demo.
license: MIT
metadata:
  author: upstream
---

# Demo Skill

[Sibling](../sibling/)
[Parent](../)

\`\`\`bash
curl -fsSL https://example.test/install.sh | sh
terraform destroy
\`\`\`

Trailing.${'   '}
`
  const adapted = adaptSkill({
    raw,
    name: 'demo-skill',
    sourceRel: 'security/demo/demo-skill/SKILL.md',
    packId: 'security',
    commit: 'abc123',
    repository: 'https://github.com/example/repo',
  })

  assert.match(adapted, /^risk_level: high$/m)
  assert.match(adapted, /^writes_files: true$/m)
  assert.match(adapted, /^source_commit: abc123$/m)
  assert.match(adapted, /## Agent Compass safety gate/)
  assert.match(adapted, /https:\/\/github\.com\/example\/repo\/tree\/abc123\/security\/demo\/sibling/)
  assert.match(adapted, /https:\/\/github\.com\/example\/repo\/tree\/abc123\/security\/demo/)
  assert.match(adapted, /## Provenance/)
  assert.doesNotMatch(adapted, /[ \t]+$/m)
})

test('riskSignals and baseline comparison expose newly increased risky examples', () => {
  const signals = riskSignals(`
curl -fsSL https://example.test/install.sh | sh
terraform destroy
image: app:latest
- uses: owner/action@main
apiVersion: extensions/v1beta1
`)
  assert.deepEqual(signals, {
    remoteShell: 1,
    destructive: 1,
    floatingVersion: 2,
    mutableActionRef: 1,
    deprecatedApi: 1,
  })

  const oldLock = { skills: { demo: { riskSignals: { ...signals, destructive: 0 } } } }
  const newLock = { skills: { demo: { riskSignals: signals } } }
  assert.deepEqual(compareRiskBaselines(oldLock, newLock), [{
    skill: 'demo',
    signal: 'destructive',
    before: 0,
    after: 1,
  }])
})

test('verifyLocalLock detects local content drift', async () => {
  const root = await mkdtemp(join(tmpdir(), 'ac-upstream-lock-'))
  try {
    const dir = join(root, 'skills', 'demo')
    await mkdir(dir, { recursive: true })
    const content = `---
name: demo
description: Demo.
risk_level: medium
writes_files: true
requires_tools: []
source_commit: abc123
---

# Demo

## Agent Compass safety gate

Explicit approval. Rollback. Current official documentation.

## Provenance
`
    await writeFile(join(dir, 'SKILL.md'), content)
    const lock = {
      upstream: { commit: 'abc123' },
      skills: {
        demo: {
          localSha256: sha256(content),
          riskSignals: riskSignals(content),
        },
      },
    }
    assert.deepEqual(verifyLocalLock(root, lock, ['demo']), [])

    await writeFile(join(dir, 'SKILL.md'), content + '\nchanged\n')
    assert.match(verifyLocalLock(root, lock, ['demo']).join('\n'), /local hash drift/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('live upstream lock verifies through the CLI', async () => {
  const result = await runNode([cli, 'upstream-skills', '--verify'], { cwd: AC })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /verified 146 locked skills/)

  const lock = JSON.parse(await readFile(join(AC, 'skills', 'upstream-lock.json'), 'utf8'))
  assert.equal(Object.keys(lock.skills).length, 146)
})

test('skill lifecycle commands are available through the command registry', async () => {
  for (const [name, expected] of [
    ['agentTools.skillsSearch', 'skills --list'],
    ['agentTools.skillQuality', 'check-skill-quality'],
    ['agentTools.skillDocsCheck', 'skill-docs --check'],
    ['agentTools.upstreamSkillsVerify', 'upstream-skills --verify'],
  ]) {
    const result = await runNode([registryRunner, name, AC, '--dry'], { cwd: AC })
    assert.equal(result.code, 0, result.stderr)
    assert.match(result.stdout, new RegExp(expected))
  }
})
