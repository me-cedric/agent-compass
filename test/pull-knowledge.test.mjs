import assert from 'node:assert/strict'
import { mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/pull-knowledge.mjs', import.meta.url)

test('pull-knowledge stages agent files, configs, and module docs', async () => {
  const target = join(tmpdir(), `ac-source-${Date.now()}`)
  const staged = join(root.pathname, 'knowledge', 'incoming', basename(target))
  try {
    await mkdir(join(target, 'apps', 'api', 'src', 'modules', 'accounts'), { recursive: true })
    await writeFile(join(target, 'AGENTS.md'), '# Agent guide\n')
    await writeFile(join(target, 'turbo.json'), '{}\n')
    await writeFile(join(target, 'apps', 'api', 'src', 'modules', 'accounts', 'README.md'), '# Accounts\n')

    const result = await runNode([script.pathname, target], { cwd: root.pathname })
    assert.equal(result.code, 0, result.stderr)

    const index = await readFile(join(staged, 'INDEX.md'), 'utf8')
    assert.match(index, /agent-config/)
    assert.match(index, /config/)
    assert.match(index, /module-doc/)
  } finally {
    await rm(target, { recursive: true, force: true })
    await rm(staged, { recursive: true, force: true })
  }
})

test('pull-knowledge stages a skill folder with its payload, once, and skips a vendored corpus', async () => {
  const target = join(tmpdir(), `ac-source-${Date.now()}`)
  const staged = join(root.pathname, 'knowledge', 'incoming', basename(target))
  try {
    // A first-party skill, in a tree that is not at the repository root.
    const skill = join(target, 'src-tauri', 'skills', 'my-skill')
    await mkdir(join(skill, 'scripts'), { recursive: true })
    await writeFile(join(skill, 'SKILL.md'), '---\nname: my-skill\n---\n\n# My skill\n')
    await writeFile(join(skill, 'LICENSE'), 'MIT License\n')
    await writeFile(join(skill, 'scripts', 'run.py'), 'print("hi")\n')

    // The canonical harness path is a symlink into that tree, so the same skill
    // must not stage twice.
    await mkdir(join(target, '.claude', 'skills'), { recursive: true })
    await symlink(join(target, 'src-tauri', 'skills', 'my-skill'), join(target, '.claude', 'skills', 'my-skill'), 'dir')

    // A vendored corpus belongs to its upstream, not to this project.
    const vendored = join(target, 'resources', 'compass')
    await mkdir(join(vendored, 'skills', 'their-skill'), { recursive: true })
    await writeFile(join(vendored, 'manifest.json'), JSON.stringify({ source_repo: 'https://example.test/x.git', source_commit: 'abc' }))
    await writeFile(join(vendored, 'skills', 'their-skill', 'SKILL.md'), '---\nname: their-skill\n---\n\n# Theirs\n')

    const result = await runNode([script.pathname, target], { cwd: root.pathname })
    assert.equal(result.code, 0, result.stderr)

    const index = await readFile(join(staged, 'INDEX.md'), 'utf8')
    assert.match(index, /## skill/)
    assert.match(index, /src-tauri\/skills\/my-skill\/SKILL\.md/)
    assert.match(index, /src-tauri\/skills\/my-skill\/LICENSE/)
    assert.match(index, /src-tauri\/skills\/my-skill\/scripts\/run\.py/)
    // Staged once, not twice, despite the symlink.
    assert.equal(index.match(/my-skill\/SKILL\.md/g).length, 1)
    assert.doesNotMatch(index, /their-skill/)
  } finally {
    await rm(target, { recursive: true, force: true })
    await rm(staged, { recursive: true, force: true })
  }
})

test('pull-knowledge ignores git worktrees and build output', async () => {
  const target = join(tmpdir(), `ac-source-${Date.now()}`)
  const staged = join(root.pathname, 'knowledge', 'incoming', basename(target))
  try {
    await mkdir(target, { recursive: true })
    await writeFile(join(target, 'AGENTS.md'), '# Agent guide\n')
    await writeFile(join(target, 'tsconfig.json'), '{"real":true}\n')
    // A worktree duplicates the whole repository at a stale commit.
    await mkdir(join(target, '.claude', 'worktrees', 'wt-1'), { recursive: true })
    await writeFile(join(target, '.claude', 'worktrees', 'wt-1', 'tsconfig.json'), '{"stale":true}\n')
    // Build output holds copies, never the project's own signal.
    await mkdir(join(target, 'target', 'debug'), { recursive: true })
    await writeFile(join(target, 'target', 'debug', 'tsconfig.json'), '{"built":true}\n')

    const result = await runNode([script.pathname, target], { cwd: root.pathname })
    assert.equal(result.code, 0, result.stderr)

    const index = await readFile(join(staged, 'INDEX.md'), 'utf8')
    assert.match(index, /`tsconfig\.json`/)
    assert.doesNotMatch(index, /worktrees/)
    assert.doesNotMatch(index, /target\/debug/)
  } finally {
    await rm(target, { recursive: true, force: true })
    await rm(staged, { recursive: true, force: true })
  }
})

test('pull-knowledge accepts a commit hash and a pinned version as non-personal data', async () => {
  const target = join(tmpdir(), `ac-source-${Date.now()}`)
  const staged = join(root.pathname, 'knowledge', 'incoming', basename(target))
  try {
    await mkdir(target, { recursive: true })
    // A provenance block pins a commit; its digit runs are not a phone number.
    await writeFile(join(target, 'AGENTS.md'), 'Vendored at commit `2d19ad205eb1d85fc9c3968bdeba4c2116518685`.\n')
    // A pinned tool version is not a phone number either.
    await writeFile(join(target, 'sonar-project.properties'), 'sonar.scanner.version=6.2.1.4610\n')

    const result = await runNode([script.pathname, target], { cwd: root.pathname })
    assert.equal(result.code, 0, result.stderr)
    assert.doesNotMatch(result.stderr, /personal data/)
    await readFile(join(staged, 'INDEX.md'), 'utf8')
  } finally {
    await rm(target, { recursive: true, force: true })
    await rm(staged, { recursive: true, force: true })
  }
})

test('pull-knowledge clears the previous staging so a removed file cannot linger', async () => {
  const target = join(tmpdir(), `ac-source-${Date.now()}`)
  const staged = join(root.pathname, 'knowledge', 'incoming', basename(target))
  try {
    await mkdir(target, { recursive: true })
    await writeFile(join(target, 'AGENTS.md'), '# Agent guide\n')
    await writeFile(join(target, 'turbo.json'), '{}\n')
    let result = await runNode([script.pathname, target], { cwd: root.pathname })
    assert.equal(result.code, 0, result.stderr)
    await readFile(join(staged, 'turbo.json'), 'utf8')

    await rm(join(target, 'turbo.json'))
    result = await runNode([script.pathname, target], { cwd: root.pathname })
    assert.equal(result.code, 0, result.stderr)
    await assert.rejects(readFile(join(staged, 'turbo.json'), 'utf8'))
  } finally {
    await rm(target, { recursive: true, force: true })
    await rm(staged, { recursive: true, force: true })
  }
})

test('pull-knowledge refuses sensitive files before staging', async () => {
  const target = join(tmpdir(), `ac-source-${Date.now()}`)
  const staged = join(root.pathname, 'knowledge', 'incoming', basename(target))
  try {
    await mkdir(target, { recursive: true })
    await writeFile(join(target, 'AGENTS.md'), `secret_key="1234567890abcdef1234567890abcdef"\nproject=${['par', 'cus'].join('')}\n`)

    const result = await runNode([script.pathname, target], { cwd: root.pathname })
    assert.equal(result.code, 1)
    assert.match(result.stderr, /Refusing to stage/)
    await assert.rejects(readFile(join(staged, 'INDEX.md'), 'utf8'))
  } finally {
    await rm(target, { recursive: true, force: true })
    await rm(staged, { recursive: true, force: true })
  }
})

test('pull-knowledge refuses possible personal data before staging', async () => {
  const target = join(tmpdir(), `ac-source-${Date.now()}`)
  const staged = join(root.pathname, 'knowledge', 'incoming', basename(target))
  try {
    await mkdir(target, { recursive: true })
    await writeFile(join(target, 'AGENTS.md'), 'Contact: jean.dupont@acme-corp.fr\n')

    const result = await runNode([script.pathname, target], { cwd: root.pathname })
    assert.equal(result.code, 1)
    assert.match(result.stderr, /possible personal data/)
    await assert.rejects(readFile(join(staged, 'INDEX.md'), 'utf8'))
  } finally {
    await rm(target, { recursive: true, force: true })
    await rm(staged, { recursive: true, force: true })
  }
})

test('pull-knowledge accepts documentation emails and bare ISO dates', async () => {
  const target = join(tmpdir(), `ac-source-${Date.now()}`)
  const staged = join(root.pathname, 'knowledge', 'incoming', basename(target))
  try {
    await mkdir(target, { recursive: true })
    await writeFile(join(target, 'AGENTS.md'), 'Seed user: candidate.incomplete@example.test\n')
    await writeFile(join(target, '.osv-scanner.toml'), 'ignoreUntil = 2026-12-31\n')

    const result = await runNode([script.pathname, target], { cwd: root.pathname })
    assert.equal(result.code, 0, result.stderr)
    await readFile(join(staged, 'INDEX.md'), 'utf8')
  } finally {
    await rm(target, { recursive: true, force: true })
    await rm(staged, { recursive: true, force: true })
  }
})
