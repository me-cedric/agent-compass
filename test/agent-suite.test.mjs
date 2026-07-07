import assert from 'node:assert/strict'
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const script = (name) => new URL(`../scripts/${name}.mjs`, import.meta.url).pathname

test('setup-wizard writes answers and plan without running setup', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-wizard-'))
  try {
    await writeFile(join(host, 'package.json'), JSON.stringify({ name: 'demo', scripts: { test: 'node --test' }, dependencies: { react: 'x' } }))
    const result = await runNode([script('setup-wizard'), host, '--yes', '--no-run'], { cwd: root.pathname })
    assert.equal(result.code, 0, result.stderr)
    assert.match(await readFile(join(host, 'agent-compass.answers.json'), 'utf8'), /react-web/)
    assert.match(await readFile(join(host, '.agent', 'setup-plan.md'), 'utf8'), /Agent Compass Setup Plan/)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('provider verification, recommend, quality gates, dashboard write reports', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-suite-'))
  try {
    await writeFile(join(host, 'package.json'), JSON.stringify({ name: 'demo', scripts: { test: 'node --test' }, dependencies: { '@nestjs/core': 'x' } }))
    const setup = await runNode([script('setup-host'), host], { cwd: root.pathname })
    assert.equal(setup.code, 0, setup.stderr)

    for (const [name, out] of [
      ['provider-verify', '.agent/provider-verification.md'],
      ['recommend', '.agent/recommendations.md'],
      ['quality-gates', '.agent/quality-gates.md'],
      ['dashboard', '.agent/report.html'],
    ]) {
      const result = await runNode([script(name), host, '--write'], { cwd: root.pathname })
      assert.equal(result.code, 0, result.stderr)
      assert.ok(existsSync(join(host, out)), `${out} should exist`)
    }
    assert.match(await readFile(join(host, '.agent', 'report.html'), 'utf8'), /Agent Compass Dashboard/)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('spec-kit bridge writes bridge files non-destructively', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-speckit-'))
  try {
    const result = await runNode([script('spec-kit-bridge'), host], { cwd: root.pathname })
    assert.equal(result.code, 0, result.stderr)
    assert.match(await readFile(join(host, '.specify', 'README.md'), 'utf8'), /Spec Kit Bridge/)
    assert.match(await readFile(join(host, 'docs', 'spec-kit', 'README.md'), 'utf8'), /Spec Kit Usage/)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('skills-sync supports copy and symlink modes', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-skills-'))
  try {
    const copy = await runNode([script('skills-sync'), host, '--copy', '--target', 'agents'], { cwd: root.pathname })
    assert.equal(copy.code, 0, copy.stderr)
    assert.ok(existsSync(join(host, '.agents', 'skills', 'caveman', 'SKILL.md')))

    const link = await runNode([script('skills-sync'), host, '--symlink', '--target', 'claude'], { cwd: root.pathname })
    assert.equal(link.code, 0, link.stderr)
    assert.ok((await lstat(join(host, '.claude', 'skills', 'caveman'))).isSymbolicLink())
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('skills-sync dry-run preserves existing skill copies', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-skills-dry-'))
  try {
    const skillDir = join(host, '.agents', 'skills', 'caveman')
    const skillFile = join(skillDir, 'SKILL.md')
    await mkdir(skillDir, { recursive: true })
    await writeFile(skillFile, 'sentinel')

    const dry = await runNode([script('skills-sync'), host, '--dry', '--target', 'agents', '--only', 'caveman'], { cwd: root.pathname })
    assert.equal(dry.code, 0, dry.stderr)
    assert.match(dry.stdout, /would copy caveman -> \.agents\/skills/)
    assert.equal(await readFile(skillFile, 'utf8'), 'sentinel')
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('task-log appends and renders markdown', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-task-log-'))
  try {
    const add = await runNode([script('task-log'), host, '--add', '--goal', 'ship feature', '--files', 'a.ts,b.ts', '--commands', 'npm test', '--validation', 'passed'], { cwd: root.pathname })
    assert.equal(add.code, 0, add.stderr)
    const md = await runNode([script('task-log'), host, '--list', '--markdown'], { cwd: root.pathname })
    assert.equal(md.code, 0, md.stderr)
    assert.match(md.stdout, /ship feature/)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('global setup creates user-level pointers and skills without project files', async () => {
  const home = await mkdtemp(join(tmpdir(), 'ac-global-'))
  try {
    const result = await runNode([script('global-setup'), home, '--copy'], { cwd: root.pathname })
    assert.equal(result.code, 0, result.stderr)
    assert.ok(existsSync(join(home, '.agent-compass', 'manifest.json')))
    assert.ok(existsSync(join(home, '.codex', 'AGENTS.md')))
    assert.ok(existsSync(join(home, '.agents', 'skills', 'caveman', 'SKILL.md')))
    const verify = await runNode([script('provider-verify'), home, '--global', '--strict'], { cwd: root.pathname })
    assert.equal(verify.code, 0, verify.stderr)
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})

test('policy pack, migration plan, mcp probe, spec map, design importer write artifacts', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-deep-'))
  try {
    await writeFile(join(host, 'package.json'), JSON.stringify({ name: 'demo', scripts: { test: 'node --test' } }))
    const setup = await runNode([script('setup-host'), host], { cwd: root.pathname })
    assert.equal(setup.code, 0, setup.stderr)

    const policy = await runNode([script('policy-pack'), host, '--apply', 'solo-dev'], { cwd: root.pathname })
    assert.equal(policy.code, 0, policy.stderr)
    assert.ok(existsSync(join(host, '.agent', 'policy.json')))

    const migration = await runNode([script('migration-plan'), host, '--write'], { cwd: root.pathname })
    assert.equal(migration.code, 0, migration.stderr)
    assert.ok(existsSync(join(host, '.agent', 'migration-plan.md')))

    const mcp = await runNode([script('mcp-probe'), host, '--write'], { cwd: root.pathname })
    assert.equal(mcp.code, 0, mcp.stderr)
    assert.ok(existsSync(join(host, '.agent', 'mcp-readiness.md')))

    const specMap = await runNode([script('spec-validation-map'), host, '--write'], { cwd: root.pathname })
    assert.equal(specMap.code, 0, specMap.stderr)
    assert.ok(existsSync(join(host, '.agent', 'spec-validation-map.md')))

    await writeFile(join(host, 'figma.json'), JSON.stringify({ colors: { primary: '#123456' }, components: ['Button'] }))
    const design = await runNode([script('design-importer'), host, '--source', join(host, 'figma.json'), '--write'], { cwd: root.pathname })
    assert.equal(design.code, 0, design.stderr)
    assert.match(await readFile(join(host, 'docs', 'design', 'DESIGN-SYSTEM.md'), 'utf8'), /primary/)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('failure mining and apply recommendations produce reports', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-apply-'))
  try {
    await writeFile(join(host, 'package.json'), JSON.stringify({ name: 'demo', scripts: { test: 'node --test' } }))
    const add = await runNode([script('task-log'), host, '--add', '--goal', 'bad task', '--validation', 'failed tests'], { cwd: root.pathname })
    assert.equal(add.code, 0, add.stderr)
    const mine = await runNode([script('failure-mine'), host, '--write'], { cwd: root.pathname })
    assert.equal(mine.code, 0, mine.stderr)
    assert.match(await readFile(join(host, '.agent', 'failure-mining.md'), 'utf8'), /tests/)

    const apply = await runNode([script('apply-recommendations'), host, '--skills', 'none', '--policy', 'solo-dev'], { cwd: root.pathname })
    assert.equal(apply.code, 0, apply.stderr)
    assert.ok(existsSync(join(host, '.agent', 'report.html')))
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})
