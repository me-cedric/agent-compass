import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

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

    await writeFile(join(host, 'package.json'), JSON.stringify({}))
    assert.deepEqual(detectStacks(host), [])
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('selectAssets merges core with matched profiles, deduped', () => {
  const selection = selectAssets(['nestjs-api', 'drizzle-postgres'])
  assert.ok(selection.skills.includes('gen-docs'), 'core skills always included')
  assert.ok(selection.skills.includes('nestjs-patterns'))
  assert.ok(selection.skills.includes('drizzle-postgres-patterns'))
  assert.ok(!selection.skills.includes('expo-react-native-patterns'), 'unmatched stacks excluded')
  assert.equal(new Set(selection.skills).size, selection.skills.length, 'no duplicates')

  const generic = selectAssets([])
  assert.deepEqual(generic.skills, CORE_PROFILE.skills, 'generic project gets core only')
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
