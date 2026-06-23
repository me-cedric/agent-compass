import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, stat, readFile, writeFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/install.mjs', import.meta.url)

const walkFiles = async (dir) => {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...await walkFiles(full))
    else out.push(full)
  }
  return out
}

test('install creates substituted pointer and executable husky hooks', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-install-'))
  try {
    await writeFile(join(host, 'package.json'), JSON.stringify({ scripts: { prepare: 'husky' } }))
    await writeFile(join(host, 'agent-compass.answers.json'), JSON.stringify({ name: 'sample-app', scope: '@sample' }))

    const install = await runNode([script.pathname, host], { cwd: root.pathname })
    assert.equal(install.code, 0, install.stderr)

    const pointer = await readFile(join(host, 'AGENTS.md'), 'utf8')
    assert.match(pointer, /sample-app/)
    assert.match(await readFile(join(host, 'specs', 'README.md'), 'utf8'), /specification-driven/)
    assert.match(await readFile(join(host, 'specs', 'constitution.md'), 'utf8'), /Project Constitution/)
    assert.match(await readFile(join(host, '.projectmem', 'README.md'), 'utf8'), /projectmem/)
    assert.match(await readFile(join(host, '.projectmem', 'projectmem-policy.md'), 'utf8'), /Project Memory Policy/)

    for (const pointerPath of ['CLAUDE.md', 'CODEX.md', 'GEMINI.md', '.github/copilot-instructions.md', '.cursor/rules/agent-compass.mdc', '.windsurf/rules/agent-compass.md']) {
      assert.match(await readFile(join(host, pointerPath), 'utf8'), /AGENTS\.md/)
    }

    for (const hook of ['pre-commit', 'pre-push', 'commit-msg']) {
      const mode = (await stat(join(host, '.husky', hook))).mode
      assert.ok(mode & 0o111, `${hook} should be executable`)
    }

    const doctor = await runNode([script.pathname, '--doctor', host], { cwd: root.pathname })
    assert.equal(doctor.code, 0, doctor.stderr)
    assert.match(doctor.stdout, /doctor passed/)

    for (const file of await walkFiles(host)) {
      const text = await readFile(file, 'utf8')
      assert.doesNotMatch(text, /<project>|@scope/, `${file} should have rendered placeholders`)
    }
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('install stays non-destructive', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-install-'))
  try {
    await writeFile(join(host, 'AGENTS.md'), 'custom guide\n')

    const result = await runNode([script.pathname, host], { cwd: root.pathname })
    assert.equal(result.code, 0, result.stderr)
    assert.equal(await readFile(join(host, 'AGENTS.md'), 'utf8'), 'custom guide\n')
    assert.match(result.stdout, /AGENTS\.md \(exists/)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('install does not overwrite existing specs', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-install-'))
  try {
    await writeFile(join(host, 'package.json'), JSON.stringify({ scripts: { prepare: 'husky' } }))
    await mkdir(join(host, 'specs'), { recursive: true })
    await writeFile(join(host, 'specs', 'README.md'), 'custom specs readme\n')
    await writeFile(join(host, 'specs', 'constitution.md'), 'custom constitution\n')

    const result = await runNode([script.pathname, host], { cwd: root.pathname })
    assert.equal(result.code, 0, result.stderr)
    assert.equal(await readFile(join(host, 'specs', 'README.md'), 'utf8'), 'custom specs readme\n')
    assert.equal(await readFile(join(host, 'specs', 'constitution.md'), 'utf8'), 'custom constitution\n')
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('install does not overwrite existing project memory policy files', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-install-'))
  try {
    await writeFile(join(host, 'package.json'), JSON.stringify({ scripts: { prepare: 'husky' } }))
    await mkdir(join(host, '.projectmem'), { recursive: true })
    await writeFile(join(host, '.projectmem', 'README.md'), 'custom memory readme\n')
    await writeFile(join(host, '.projectmem', 'projectmem-policy.md'), 'custom memory policy\n')

    const result = await runNode([script.pathname, host], { cwd: root.pathname })
    assert.equal(result.code, 0, result.stderr)
    assert.equal(await readFile(join(host, '.projectmem', 'README.md'), 'utf8'), 'custom memory readme\n')
    assert.equal(await readFile(join(host, '.projectmem', 'projectmem-policy.md'), 'utf8'), 'custom memory policy\n')
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})
