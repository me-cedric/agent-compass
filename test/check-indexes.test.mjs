import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'
import { FILE_MANIFEST } from '../scripts/manifest.mjs'
import { COMMANDS } from '../scripts/cli.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/check-indexes.mjs', import.meta.url)

// The manifest and CLI command list are imported from the real scripts, so a
// passing fixture must mention every real template group / loose file / command.
const manifestMentions = [...new Set(FILE_MANIFEST
  .filter(({ src }) => src.startsWith('templates/'))
  .map(({ src }) => {
    const rel = src.slice('templates/'.length)
    return rel.includes('/') ? `\`${rel.split('/')[0]}/\`` : rel
  }))]
const commandMentions = Object.keys(COMMANDS).map((name) => `\`${name}\``)

const writeFixture = async (dir) => {
  await mkdir(join(dir, 'stacks'), { recursive: true })
  await mkdir(join(dir, 'docs', 'workflows'), { recursive: true })
  await mkdir(join(dir, 'docs', 'tooling'), { recursive: true })
  await mkdir(join(dir, 'docs', 'guidelines'), { recursive: true })
  await mkdir(join(dir, 'docs', 'architecture'), { recursive: true })
  await mkdir(join(dir, 'knowledge', 'instincts'), { recursive: true })
  await mkdir(join(dir, 'skills', 'sample'), { recursive: true })
  await mkdir(join(dir, 'templates', 'sample'), { recursive: true })
  await mkdir(join(dir, 'scripts'), { recursive: true })
  await writeFile(join(dir, 'stacks', 'web.md'), '# Web\n')
  await writeFile(join(dir, 'stacks', 'README.md'), '# Stacks\n\n[web](web.md)\n')
  await writeFile(join(dir, 'docs', 'workflows', 'flow.md'), '# Flow\n')
  await writeFile(join(dir, 'docs', 'workflows', 'README.md'), '# Workflows\n\n[flow](flow.md)\n')
  await writeFile(join(dir, 'docs', 'tooling', 'cli.md'), `# CLI\n\n${commandMentions.join(' ')}\n`)
  await writeFile(join(dir, 'docs', 'tooling', 'README.md'), '# Tooling\n\n[cli](cli.md)\n')
  await writeFile(join(dir, 'docs', 'guidelines', 'guide.md'), '# Guide\n')
  await writeFile(join(dir, 'docs', 'guidelines', 'README.md'), '# Guidelines\n\n[guide](guide.md)\n')
  await writeFile(join(dir, 'docs', 'architecture', 'arch.md'), '# Arch\n')
  await writeFile(join(dir, 'docs', 'architecture', 'README.md'), '# Architecture\n\n[arch](arch.md)\n')
  await writeFile(join(dir, 'knowledge', 'instincts', 'sample-pattern.md'), '# Sample\n')
  await writeFile(join(dir, 'knowledge', 'README.md'), '# Knowledge\n\n- [sample pattern](instincts/sample-pattern.md)\n')
  await writeFile(join(dir, 'skills', 'sample', 'SKILL.md'), '---\nname: sample\ndescription: sample\n---\n')
  await writeFile(join(dir, 'skills', 'README.md'), '# Skills\n\n| Skill | What it does |\n| ----- | ------------ |\n| `sample` | test |\n')
  await writeFile(join(dir, 'templates', 'sample', 'file.txt'), 'x\n')
  await writeFile(join(dir, 'templates', 'README.md'), `# Templates\n\n\`sample/\` ${manifestMentions.join(' ')}\n`)
  await writeFile(join(dir, 'scripts', 'bootstrap.mjs'), "export const STACK_DOC_BY_APP = {\n  'web': 'stacks/web.md',\n}\n")
}

test('check-indexes validates live catalogs', async () => {
  const result = await runNode([script.pathname], { cwd: root.pathname })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /index check passed/)
})

test('check-indexes passes on a consistent fixture (positional root)', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ac-indexes-'))
  try {
    await writeFixture(dir)
    const result = await runNode([script.pathname, dir], { cwd: root.pathname })
    assert.equal(result.code, 0, result.stderr)
    assert.match(result.stdout, /index check passed/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('check-indexes rejects stale catalogs across all checked indexes', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ac-indexes-'))
  try {
    await writeFixture(dir)
    await writeFile(join(dir, 'docs', 'workflows', 'README.md'), '# Workflows\n')
    await writeFile(join(dir, 'docs', 'tooling', 'README.md'), '# Tooling\n')
    await writeFile(join(dir, 'docs', 'guidelines', 'README.md'), '# Guidelines\n')
    await writeFile(join(dir, 'docs', 'architecture', 'README.md'), '# Architecture\n')
    await writeFile(join(dir, 'docs', 'tooling', 'cli.md'), '# CLI\n')
    await writeFile(join(dir, 'knowledge', 'README.md'), '# Knowledge\n')
    await writeFile(join(dir, 'skills', 'README.md'), '# Skills\n\n| Skill | What it does |\n| ----- | ------------ |\n| `ghost-skill` | gone |\n')
    await writeFile(join(dir, 'templates', 'README.md'), '# Templates\n')

    const result = await runNode([script.pathname, '--root', dir], { cwd: root.pathname })
    assert.equal(result.code, 1)
    assert.match(result.stderr, /docs\/workflows\/README\.md: missing flow\.md/)
    assert.match(result.stderr, /docs\/tooling\/README\.md: missing cli\.md/)
    assert.match(result.stderr, /docs\/guidelines\/README\.md: missing guide\.md/)
    assert.match(result.stderr, /docs\/architecture\/README\.md: missing arch\.md/)
    assert.match(result.stderr, /knowledge\/README\.md: missing instinct sample-pattern\.md/)
    assert.match(result.stderr, /skills\/README\.md: missing sample/)
    assert.match(result.stderr, /skills\/README\.md: stale entry ghost-skill/)
    assert.match(result.stderr, /templates\/README\.md: missing sample\//)
    assert.match(result.stderr, /templates\/README\.md: missing manifest entry/)
    assert.match(result.stderr, /docs\/tooling\/cli\.md: missing command/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('check-indexes flags a single undocumented CLI command', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ac-indexes-'))
  try {
    await writeFixture(dir)
    const [dropped, ...kept] = Object.keys(COMMANDS)
    await writeFile(join(dir, 'docs', 'tooling', 'cli.md'), `# CLI\n\n${kept.map((name) => `\`${name}\``).join(' ')}\n`)

    const result = await runNode([script.pathname, '--root', dir], { cwd: root.pathname })
    assert.equal(result.code, 1)
    assert.match(result.stderr, new RegExp(`docs/tooling/cli\\.md: missing command \`${dropped}\``))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
