import assert from 'node:assert/strict'
import { existsSync, readdirSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { CAPABILITY_PACKS, selectCapabilityPacks } from '../scripts/lib/capability-packs.mjs'
import { CORE_PROFILE, PROFILES, STYLE_SKILLS, detectStacks, selectAssets } from '../scripts/lib/profiles.mjs'
import { runNode } from './helpers.mjs'

const AC = new URL('..', import.meta.url).pathname

test('every asset referenced by a profile exists in the repo', () => {
  const all = [CORE_PROFILE, ...Object.values(PROFILES)]
  for (const profile of all) {
    for (const skill of profile.skills) {
      assert.ok(existsSync(join(AC, 'skills', skill, 'SKILL.md')), `${profile.label}: missing skill ${skill}`)
    }
    for (const rel of [...profile.templates, ...profile.docs]) {
      assert.ok(existsSync(join(AC, rel)), `${profile.label}: missing ${rel}`)
    }
  }
  for (const skill of STYLE_SKILLS) {
    assert.ok(existsSync(join(AC, 'skills', skill, 'SKILL.md')), `style skill missing: ${skill}`)
  }
})

test('every skills/ directory is reachable from a profile or capability pack (no orphan skills)', () => {
  // compass-* skills are mission playbooks that run inside compass itself, and
  // STYLE_SKILLS are user-preference picks — everything else must be installable
  // via CORE_PROFILE, a stack profile, or an opt-in capability pack.
  const reachable = new Set([
    ...CORE_PROFILE.skills,
    ...Object.values(PROFILES).flatMap((p) => p.skills),
    ...Object.values(CAPABILITY_PACKS).flatMap((p) => p.skills),
    ...STYLE_SKILLS,
  ])
  const dirs = readdirSync(join(AC, 'skills'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('compass-'))
    .map((entry) => entry.name)
  assert.ok(dirs.length > 0, 'skills/ scan found nothing — wrong path?')
  for (const name of dirs) {
    assert.ok(reachable.has(name), `orphan skill: skills/${name} is not in a profile, capability pack, or STYLE_SKILLS`)
  }
})

test('detectStacks maps dependencies to stack ids', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-profiles-'))
  try {
    await writeFile(join(host, 'package.json'), JSON.stringify({
      dependencies: { '@nestjs/core': '10', 'drizzle-orm': '0.30', bullmq: '5' },
      devDependencies: { turbo: '2' },
    }))
    assert.deepEqual(detectStacks(host), ['nestjs-api', 'drizzle-postgres', 'bullmq', 'turbo-monorepo'])

    await writeFile(join(host, 'package.json'), JSON.stringify({ dependencies: { expo: '51', 'react-native': '0.74', react: '18' } }))
    const mobile = detectStacks(host)
    assert.ok(mobile.includes('expo-mobile'))
    assert.ok(!mobile.includes('react-web'), 'react-native must not classify as react-web')

    await writeFile(join(host, 'package.json'), JSON.stringify({ dependencies: { '@angular/core': '20' } }))
    assert.deepEqual(detectStacks(host), ['angular-web'])

    await writeFile(join(host, 'package.json'), JSON.stringify({}))
    assert.deepEqual(detectStacks(host), [])

    await mkdir(join(host, '.specify'), { recursive: true })
    assert.deepEqual(detectStacks(host), ['spec-kit'])
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('detectStacks aggregates workspace packages, not just the monorepo root', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-profiles-mono-'))
  try {
    // Realistic turbo monorepo: root has only tooling deps; stacks live in apps/*.
    await writeFile(join(host, 'package.json'), JSON.stringify({ devDependencies: { turbo: '2' } }))
    await writeFile(join(host, 'turbo.json'), '{}')
    await mkdir(join(host, 'apps', 'api'), { recursive: true })
    await writeFile(join(host, 'apps', 'api', 'package.json'), JSON.stringify({
      dependencies: { '@nestjs/core': '10', '@nestjs/bullmq': '10', 'drizzle-orm': '0.30' },
    }))
    await mkdir(join(host, 'apps', 'web-app'), { recursive: true })
    await writeFile(join(host, 'apps', 'web-app', 'package.json'), JSON.stringify({
      dependencies: { react: '19', '@tanstack/react-router': '1' },
      // Must NOT classify as next-web: scoped plugin is not the next package.
      devDependencies: { '@next/eslint-plugin-next': '15' },
    }))
    const stacks = detectStacks(host)
    assert.deepEqual(stacks, ['nestjs-api', 'react-web', 'drizzle-postgres', 'bullmq', 'turbo-monorepo'])
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('selectAssets merges core with matched profiles, deduped', () => {
  const selection = selectAssets(['nestjs-api', 'drizzle-postgres'])
  assert.ok(selection.skills.includes('gen-docs'), 'core skills always included')
  assert.ok(selection.skills.includes('long-running-task'), 'long-running workflow is core')
  assert.ok(selection.skills.includes('nestjs-patterns'))
  assert.ok(selection.skills.includes('api-contract-sync'), 'API projects get contract sync')
  assert.ok(selection.skills.includes('drizzle-postgres-patterns'))
  assert.ok(!selection.skills.includes('expo-react-native-patterns'), 'unmatched stacks excluded')
  assert.equal(new Set(selection.skills).size, selection.skills.length, 'no duplicates')

  const specKit = selectAssets(['spec-kit'])
  assert.ok(specKit.skills.includes('speckit-specify'), 'Spec Kit projects get command skills')
  assert.ok(specKit.templates.includes('templates/spec-kit'), 'Spec Kit projects get provider pack')

  const generic = selectAssets([])
  assert.deepEqual(generic.skills, CORE_PROFILE.skills, 'generic project gets core only')
})

test('capability packs expose the requested upstream skill inventory', () => {
  assert.deepEqual(
    Object.fromEntries(Object.entries(CAPABILITY_PACKS).map(([id, pack]) => [id, pack.skills.length])),
    {
      'devops-platform': 22,
      security: 35,
      infrastructure: 70,
      compliance: 19,
    },
  )

  const selected = selectCapabilityPacks(['devops-platform', 'security'])
  assert.equal(selected.length, 57)
  for (const skill of ['github-actions', 'kubernetes-ops', 'opentelemetry', 'ai-agent-security', 'vulnerability-scanning']) {
    assert.ok(selected.includes(skill), `missing ${skill}`)
  }
  assert.equal(new Set(selected).size, selected.length, 'packs must not overlap')
  assert.throws(() => selectCapabilityPacks(['unknown']), /Unknown capability pack/)

  for (const pack of Object.values(CAPABILITY_PACKS)) {
    for (const skill of pack.skills) {
      assert.ok(existsSync(join(AC, 'skills', skill, 'SKILL.md')), `${pack.label}: missing skill ${skill}`)
    }
  }
})

test('recommend --json exposes fit-based assets and skills-sync --only accepts them', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-profiles-host-'))
  try {
    await writeFile(join(host, 'package.json'), JSON.stringify({ dependencies: { '@nestjs/core': '10' } }))
    const rec = await runNode([join(AC, 'scripts', 'recommend.mjs'), host, '--json'])
    assert.equal(rec.code, 0, rec.stderr)
    const { assets, stackIds } = JSON.parse(rec.stdout)
    assert.ok(stackIds.includes('nestjs-api'))
    assert.ok(assets.skills.includes('nestjs-patterns'))

    const sync = await runNode([join(AC, 'scripts', 'skills-sync.mjs'), host, '--only', assets.skills.join(','), '--dry'])
    assert.equal(sync.code, 0, sync.stderr)
    assert.match(sync.stdout, /nestjs-patterns/)
    assert.doesNotMatch(sync.stdout, /expo-react-native-patterns/)

    const bad = await runNode([join(AC, 'scripts', 'skills-sync.mjs'), host, '--only', 'not-a-skill', '--dry'])
    assert.equal(bad.code, 1)
    assert.match(bad.stderr, /Unknown skill/)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})
