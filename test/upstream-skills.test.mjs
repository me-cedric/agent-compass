import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  adaptSkill,
  LOCAL_OVERRIDES,
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

test('adaptSkill applies the local .env.example override and stops when its target is gone', () => {
  const head = `---
name: ai-coding-agent-guardrails
description: Demo.
license: MIT
---

# Guardrails

`
  const args = {
    name: 'ai-coding-agent-guardrails',
    sourceRel: 'security/ai/ai-coding-agent-guardrails/SKILL.md',
    packId: 'security',
    commit: 'abc123',
  }
  const adapted = adaptSkill({
    ...args,
    raw: `${head}- NEVER read or output contents of .env, .env.*, secrets.yaml, or any file matching *.pem, *.key\n`,
  })
  // The override must survive a refresh, so it lives in adaptSkill and not in
  // the file under skills/.
  assert.match(adapted, /\.env\.\* \(except \.env\.example \/ \.env\.\*\.example, which hold no secrets\), secrets\.yaml/)

  // A reworded upstream line must stop the refresh, never drop the override.
  assert.throws(
    () => adaptSkill({ ...args, raw: `${head}- upstream reworded the restriction\n` }),
    /local override target missing/,
  )

  // A skill with no override keeps upstream prose byte for byte.
  const untouched = adaptSkill({
    ...args,
    name: 'container-hardening',
    raw: `${head}- NEVER read or output contents of .env, .env.*, secrets.yaml\n`,
  })
  assert.match(untouched, /contents of \.env, \.env\.\*, secrets\.yaml/)
})

test('every local override is applied on disk and the lock agrees', () => {
  // The guard that matters: an override must be present in the shipped file and
  // must survive a refresh. This iterates LOCAL_OVERRIDES, so a new override is
  // covered without touching this test.
  const lock = JSON.parse(readFileSync(join(AC, 'skills', 'upstream-lock.json'), 'utf8'))
  const names = Object.keys(LOCAL_OVERRIDES)
  assert.ok(names.length >= 11, `expected the known overrides, found ${names.length}`)
  for (const name of names) {
    const text = readFileSync(join(AC, 'skills', name, 'SKILL.md'), 'utf8')
    assert.equal(sha256(text), lock.skills[name].localSha256, `${name}: lock hash must match the file`)
    for (const [, to] of LOCAL_OVERRIDES[name]) {
      // A silently dropped override fails here. `to` covers both styles: a
      // replaced command and a warning appended after one.
      assert.ok(text.includes(to), `${name}: override result missing from the shipped file`)
    }
  }
})

test('an argv secret is either removed or documented as exposed', () => {
  // docs/guidelines/security.md forbids a secret in argv, because the process
  // list is readable. Some tools offer no alternative, and the guideline's escape
  // hatch is to name the exposure and require rotation. This test encodes that
  // rule: a file may keep an argv secret only while it also documents it.
  const ARGV_SECRET = [
    /--password[= ]("?)(?!"?\$\{?[A-Z_]*\}?"?$)[^\s\\]+/,
    /-p"\$[A-Z_]+"/,
    /redis-cli[^\n]*\s-a\s+\S/,
    /--(admin|root)-password[= ]\S/,
    /security add-generic-password[^\n]*-w\s+"[^"]+"/,
  ]
  const DOCUMENTED = /process list is readable|visible in the process list|do not pass the admin password/
  for (const name of Object.keys(LOCAL_OVERRIDES)) {
    const text = readFileSync(join(AC, 'skills', name, 'SKILL.md'), 'utf8')
    const offenders = text.split('\n').filter((line) => {
      if (line.trimStart().startsWith('#') || line.trimStart().startsWith('>')) return false
      return ARGV_SECRET.some((pattern) => pattern.test(line))
    })
    if (!offenders.length) continue
    assert.match(
      text,
      DOCUMENTED,
      `${name}: keeps an argv secret (${offenders[0].trim().slice(0, 60)}) without documenting the exposure`,
    )
  }
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
