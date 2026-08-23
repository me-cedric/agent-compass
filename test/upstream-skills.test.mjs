import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { LOCAL_OVERRIDES, adaptSkill } from '../scripts/lib/upstream-skills.mjs'
import { referenceSources, stageExternalSkills } from '../scripts/lib/external-install.mjs'
import { readSourceRegistry } from '../scripts/lib/upstream-sources.mjs'
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

// The safety property that mattered when the corpus was vendored: every override
// must reach the shipped text. The corpus is no longer stored here, so the
// property is now asserted on what an install actually writes.
const installedOverrideSkills = (() => {
  const registry = readSourceRegistry(AC)
  const source = referenceSources(registry)['devops-security']
  const names = Object.keys(LOCAL_OVERRIDES)
  const { staged } = stageExternalSkills({ id: 'devops-security', source, names })
  return new Map(staged.map(({ name, payload }) => [name, payload.get('SKILL.md').toString('utf8')]))
})()

test('every local override reaches the installed text', () => {
  // Iterates LOCAL_OVERRIDES, so a new override is covered without touching this
  // test. `adaptSkill` throws when an override target is gone, so a reworded
  // upstream line fails the install rather than silently dropping the fix.
  const names = Object.keys(LOCAL_OVERRIDES)
  assert.ok(names.length >= 11, `expected the known overrides, found ${names.length}`)
  for (const name of names) {
    const text = installedOverrideSkills.get(name)
    assert.ok(text, `${name}: nothing installed`)
    for (const [, to] of LOCAL_OVERRIDES[name]) {
      assert.ok(text.includes(to), `${name}: override result missing from the installed file`)
    }
  }
})

test('the safety gate reaches every installed operational skill', () => {
  for (const [name, text] of installedOverrideSkills) {
    assert.match(text, /^## Agent Compass safety gate$/m, `${name}: safety gate missing`)
    assert.match(text, /^risk_level: (low|medium|high)$/m, `${name}: risk level missing`)
    assert.match(text, /^source_commit: [a-f0-9]{40}$/m, `${name}: pin missing`)
    assert.match(text, /^## Provenance$/m, `${name}: provenance missing`)
  }
})

test('an argv secret is either removed or documented as exposed', () => {
  // docs/guidelines/security.md forbids a secret in argv, because the process
  // list is readable. Some tools offer no alternative, and the guideline's escape
  // hatch is to name the exposure and require rotation. This test encodes that
  // rule: installed text may keep an argv secret only while it documents it.
  const ARGV_PATTERNS = [
    /--password[= ]("?)(?!"?\$\{?[A-Z_]*\}?"?$)[^\s\\]+/,
    /-p"\$[A-Z_]+"/,
    /redis-cli[^\n]*\s-a\s+\S/,
    /--(admin|root)-password[= ]\S/,
    /security add-generic-password[^\n]*-w\s+"[^"]+"/,
  ]
  const DOCUMENTED = /process list is readable|visible in the process list|do not pass the admin password/
  for (const [name, text] of installedOverrideSkills) {
    const offenders = text.split('\n').filter((line) => {
      if (line.trimStart().startsWith('#') || line.trimStart().startsWith('>')) return false
      return ARGV_PATTERNS.some((pattern) => pattern.test(line))
    })
    if (!offenders.length) continue
    assert.match(
      text,
      DOCUMENTED,
      `${name}: keeps an argv secret (${offenders[0].trim().slice(0, 60)}) without documenting the exposure`,
    )
  }
})

test('skill lifecycle commands are available through the command registry', async () => {
  for (const [name, expected] of [
    ['agentTools.skillsSearch', 'skills --list'],
    ['agentTools.skillQuality', 'check-skill-quality'],
    ['agentTools.skillDocsCheck', 'skill-docs --check'],
    ['agentTools.upstreamSkillsVerify', 'upstream-skills --verify'],
    ['agentTools.upstreamSkillsCheck', 'upstream-skills --check-updates'],
  ]) {
    const result = await runNode([registryRunner, name, AC, '--dry'], { cwd: AC })
    assert.equal(result.code, 0, result.stderr)
    assert.match(result.stdout, new RegExp(expected))
  }
})
