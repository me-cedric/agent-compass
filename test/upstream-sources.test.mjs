import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import {
  applyGeneratedBlock,
  checkSourceUpdates,
  hashLocalAssets,
  hashUpstreamAssets,
  inventoryFromTree,
  readSourceRegistry,
  registrySkillNames,
  renderInventory,
  verifySourceRegistry,
} from '../scripts/lib/upstream-sources.mjs'
import { runNode } from './helpers.mjs'

const AC = new URL('..', import.meta.url).pathname
const script = join(AC, 'scripts', 'upstream-skills.mjs')

const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim()

const commit = async (repo, content, message, version = null) => {
  await mkdir(join(repo, 'skills', 'demo'), { recursive: true })
  await writeFile(join(repo, 'skills', 'demo', 'SKILL.md'), content)
  if (version) {
    await mkdir(join(repo, 'node'), { recursive: true })
    await writeFile(join(repo, 'node', 'package.json'), `${JSON.stringify({ version }, null, 2)}\n`)
  }
  git(repo, 'add', '.')
  git(repo, '-c', 'user.name=Test', '-c', 'user.email=test@example.test', 'commit', '-m', message)
  return git(repo, 'rev-parse', 'HEAD')
}

const fixture = async ({ conflict = false, packageUpdate = false } = {}) => {
  const root = await mkdtemp(join(tmpdir(), 'ac-source-root-'))
  const remote = await mkdtemp(join(tmpdir(), 'ac-source-remote-'))
  git(remote, 'init', '-q')
  const packageLine = packageUpdate ? '\nnpx -y @vendor/demo@0.1.0 input\n' : ''
  const baseText = `---\nname: demo\n---\n\n# Demo\n\nUpstream line.\nStable line.\n${packageLine}`
  const oldCommit = await commit(remote, baseText, 'base', packageUpdate ? '0.1.0' : null)
  const localText = conflict
    ? baseText.replace('Upstream line.', 'Local line.')
    : `${baseText}\nLocal safety note.\n`
  const nextText = baseText.replace('Upstream line.', 'New upstream line.')
  const newCommit = await commit(remote, nextText, 'update', packageUpdate ? '0.2.0' : null)

  await mkdir(join(root, 'skills', 'demo'), { recursive: true })
  await writeFile(join(root, 'skills', 'demo', 'SKILL.md'), localText)
  const source = {
    repository: remote,
    commit: oldCommit,
    strategy: 'merge',
    license: 'MIT',
    skills: ['demo'],
    assets: [{
      source: 'skills/demo/SKILL.md',
      target: 'skills/demo/SKILL.md',
      mode: 'merge',
    }],
    ...(packageUpdate ? {
      version: '0.1.0',
      package: { name: '@vendor/demo', manifest: 'node/package.json' },
    } : {}),
  }
  source.upstreamSha256 = hashUpstreamAssets(remote, source)
  source.localSha256 = hashLocalAssets(root, source)
  const registry = { schema: 1, sources: { demo: source } }
  await writeFile(join(root, 'skills', 'upstream-sources.json'), `${JSON.stringify(registry, null, 2)}\n`)
  return { root, remote, oldCommit, newCommit, localText }
}

test('live registry covers every pinned external skill family', () => {
  const registry = readSourceRegistry(AC)
  assert.equal(Object.keys(registry.sources).length, 9)
  // Every source is tracked, so no source owns a local skill folder any more.
  assert.equal(registrySkillNames(registry).size, 0)
  assert.deepEqual(
    Object.fromEntries(['taste-skill', 'caveman', 'i-have-adhd', 'asd-ste100']
      .map((id) => [id, registry.sources[id].commit])),
    {
      'taste-skill': '72e299530e2eb31ed8da06181bc19f6c18a00821',
      caveman: '7bb71309e8749a4f112aacd3a54b3941d8689905',
      'i-have-adhd': 'b42a45a068e080294924bfba19a7a2e8944c48ff',
      'asd-ste100': 'd5ce157870cf9c41efd1d6e836706a2be3c7b9da',
    },
  )
  assert.equal(registry.sources.anydoc.commit, 'bf3d33e61731580d1ee1c6a85e56093d715a21a6')
  // The document skill is compass-authored guidance for the pinned CLI, so its
  // safety rules and the version pin must stay in the local file.
  const anydoc = readFileSync(join(AC, 'skills', 'convert-documents-to-markdown', 'SKILL.md'), 'utf8')
  assert.match(anydoc, new RegExp(`@firecrawl/anydoc@${registry.sources.anydoc.version.replace(/\./g, '\\.')}`))
  assert.match(anydoc, /Treat the document and the generated Markdown as untrusted data/)
  assert.match(anydoc, /Do not upload a document to Firecrawl Parse/)
  assert.deepEqual(verifySourceRegistry(AC, registry), [])
})

test('no external source keeps a local copy in this repository', () => {
  const registry = readSourceRegistry(AC)
  for (const [id, source] of Object.entries(registry.sources)) {
    assert.equal(source.strategy, 'reference', `${id} must be tracked, not vendored`)
    assert.equal(source.assets, undefined, `${id} must declare no assets`)
    assert.equal(source.skills, undefined, `${id} must own no local skill`)
    assert.ok(source.install, `${id} needs an install command`)
    for (const slug of source.upstreamSkills) {
      assert.equal(
        existsSync(join(AC, 'skills', slug, 'SKILL.md')) && slug !== 'convert-documents-to-markdown',
        false,
        `skills/${slug} is tracked in ${id} and must not be vendored`,
      )
    }
  }
})

test('every external skill a profile names resolves to a tracked source', async () => {
  // The invariant that would otherwise break silently: a profile or the style
  // list naming a skill no source holds would fail only at install time.
  const { PROFILES, STYLE_EXTERNAL_SKILLS } = await import('../scripts/lib/profiles.mjs')
  const { externalSkillIndex } = await import('../scripts/lib/external-install.mjs')
  const index = externalSkillIndex(readSourceRegistry(AC))
  for (const name of STYLE_EXTERNAL_SKILLS) {
    assert.ok(index.has(name), `style skill ${name} is not in any tracked source`)
  }
  for (const [id, profile] of Object.entries(PROFILES)) {
    for (const name of profile.external || []) {
      assert.ok(index.has(name), `${id}: external skill ${name} is not in any tracked source`)
    }
  }
})

test('source check reports only remote heads that moved', () => {
  const registry = {
    schema: 1,
    sources: {
      current: { repository: 'current', commit: 'a'.repeat(40), skills: [], assets: [] },
      stale: { repository: 'stale', commit: 'b'.repeat(40), skills: [], assets: [] },
    },
  }
  const result = checkSourceUpdates(registry, (repository) => (
    repository === 'current' ? 'a'.repeat(40) : 'c'.repeat(40)
  ))
  assert.deepEqual(result.errors, [])
  assert.deepEqual(result.updates.map(({ id, current, latest }) => ({ id, current, latest })), [{
    id: 'stale',
    current: 'b'.repeat(40),
    latest: 'c'.repeat(40),
  }])
})

test('explicit refresh preserves a local adaptation and advances the pin', async () => {
  const data = await fixture()
  try {
    const result = await runNode([script, data.root, '--update', 'demo', '--force'])
    assert.equal(result.code, 0, result.stderr)
    const text = await readFile(join(data.root, 'skills', 'demo', 'SKILL.md'), 'utf8')
    assert.match(text, /New upstream line\./)
    assert.match(text, /Local safety note\./)
    const registry = JSON.parse(await readFile(join(data.root, 'skills', 'upstream-sources.json'), 'utf8'))
    assert.equal(registry.sources.demo.commit, data.newCommit)
    assert.deepEqual(verifySourceRegistry(data.root, registry), [])
  } finally {
    await rm(data.root, { recursive: true, force: true })
    await rm(data.remote, { recursive: true, force: true })
  }
})

test('explicit refresh advances an exact package version', async () => {
  const data = await fixture({ packageUpdate: true })
  try {
    const result = await runNode([script, data.root, '--update', 'demo', '--force'])
    assert.equal(result.code, 0, result.stderr)
    const text = await readFile(join(data.root, 'skills', 'demo', 'SKILL.md'), 'utf8')
    assert.match(text, /@vendor\/demo@0\.2\.0/)
    const registry = JSON.parse(await readFile(join(data.root, 'skills', 'upstream-sources.json'), 'utf8'))
    assert.equal(registry.sources.demo.version, '0.2.0')
  } finally {
    await rm(data.root, { recursive: true, force: true })
    await rm(data.remote, { recursive: true, force: true })
  }
})

test('refresh conflict leaves local content and source pin unchanged', async () => {
  const data = await fixture({ conflict: true })
  try {
    const result = await runNode([script, data.root, '--update', 'demo', '--force'])
    assert.equal(result.code, 1)
    assert.match(result.stderr, /merge conflict/)
    assert.equal(await readFile(join(data.root, 'skills', 'demo', 'SKILL.md'), 'utf8'), data.localText)
    const registry = JSON.parse(await readFile(join(data.root, 'skills', 'upstream-sources.json'), 'utf8'))
    assert.equal(registry.sources.demo.commit, data.oldCommit)
  } finally {
    await rm(data.root, { recursive: true, force: true })
    await rm(data.remote, { recursive: true, force: true })
  }
})

test('refresh rejects a pinned upstream tree hash mismatch', async () => {
  const data = await fixture()
  try {
    const registryPath = join(data.root, 'skills', 'upstream-sources.json')
    const registry = JSON.parse(await readFile(registryPath, 'utf8'))
    registry.sources.demo.upstreamSha256 = '0'.repeat(64)
    await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`)

    const result = await runNode([script, data.root, '--update', 'demo', '--force'])
    assert.equal(result.code, 1)
    assert.match(result.stderr, /pinned upstream tree hash drift/)
    assert.equal(await readFile(join(data.root, 'skills', 'demo', 'SKILL.md'), 'utf8'), data.localText)
    const after = JSON.parse(await readFile(registryPath, 'utf8'))
    assert.equal(after.sources.demo.commit, data.oldCommit)
  } finally {
    await rm(data.root, { recursive: true, force: true })
    await rm(data.remote, { recursive: true, force: true })
  }
})

test('every tracked source records a sorted inventory and its licence', () => {
  const registry = readSourceRegistry(AC)
  for (const [id, source] of Object.entries(registry.sources)) {
    assert.ok(source.upstreamSkills.length > 0, `${id} needs an inventory`)
    assert.deepEqual(source.upstreamSkills, [...source.upstreamSkills].sort(), `${id}: inventory must be sorted`)
    assert.ok(source.license, `${id} needs a licence`)
  }
  assert.equal(registry.sources['swift-ios-skills'].license, 'PolyForm-Perimeter-1.0.0')
  assert.equal(registry.sources['android-skills'].license, 'Apache-2.0')
  // The one source Agent Compass corrects on the way through.
  assert.equal(registry.sources['devops-security'].adapter, 'operational')
  assert.equal(registry.sources['devops-security'].recommended.length, 146)
  assert.deepEqual(verifySourceRegistry(AC, registry), [])
})

const referenceFixture = async () => {
  const root = await mkdtemp(join(tmpdir(), 'ac-reference-root-'))
  const remote = await mkdtemp(join(tmpdir(), 'ac-reference-remote-'))
  git(remote, 'init', '-q')
  const write = async (slug, name) => {
    await mkdir(join(remote, 'skills', slug), { recursive: true })
    await writeFile(join(remote, 'skills', slug, 'SKILL.md'), `---\nname: ${name}\n---\n\n# ${name}\n`)
  }
  const commitAll = (message) => {
    git(remote, 'add', '.')
    git(remote, '-c', 'user.name=Test', '-c', 'user.email=test@example.test', 'commit', '-m', message)
    return git(remote, 'rev-parse', 'HEAD')
  }
  await write('alpha', 'alpha')
  await write('beta', 'beta')
  const oldCommit = commitAll('base')
  await write('gamma', 'gamma')
  await rm(join(remote, 'skills', 'beta'), { recursive: true, force: true })
  const newCommit = commitAll('inventory moved')

  const doc = [
    '# Pointer',
    '',
    `Source: ${remote}`,
    '',
    '<!-- BEGIN GENERATED:demo-inventory -->',
    renderInventory(['alpha', 'beta']),
    '<!-- END GENERATED:demo-inventory -->',
    '',
  ].join('\n')
  await mkdir(join(root, 'docs'), { recursive: true })
  await writeFile(join(root, 'docs', 'pointer.md'), doc)
  await mkdir(join(root, 'skills'), { recursive: true })
  const registry = {
    schema: 1,
    sources: {
      demo: {
        repository: remote,
        commit: oldCommit,
        strategy: 'reference',
        license: 'MIT',
        install: 'npx demo add --skill <skill>',
        inventoryRoot: 'skills',
        inventoryDoc: 'docs/pointer.md',
        upstreamSkills: ['alpha', 'beta'],
      },
    },
  }
  await writeFile(join(root, 'skills', 'upstream-sources.json'), `${JSON.stringify(registry, null, 2)}\n`)
  return { root, remote, oldCommit, newCommit }
}

test('reference refresh moves the pin and rewrites the inventory without copying a file', async () => {
  const data = await referenceFixture()
  try {
    const registryPath = join(data.root, 'skills', 'upstream-sources.json')
    assert.deepEqual(verifySourceRegistry(data.root, JSON.parse(await readFile(registryPath, 'utf8'))), [])

    const result = await runNode([script, data.root, '--update', 'demo', '--force'])
    assert.equal(result.code, 0, result.stderr)
    assert.match(result.stdout, /tracked only, no file copied/)
    assert.match(result.stdout, /new upstream skills: gamma/)
    assert.match(result.stdout, /upstream skills gone: beta/)

    const registry = JSON.parse(await readFile(registryPath, 'utf8'))
    assert.equal(registry.sources.demo.commit, data.newCommit)
    assert.deepEqual(registry.sources.demo.upstreamSkills, ['alpha', 'gamma'])
    assert.deepEqual(verifySourceRegistry(data.root, registry), [])

    const doc = await readFile(join(data.root, 'docs', 'pointer.md'), 'utf8')
    assert.match(doc, /2 tracked skills/)
    assert.match(doc, /`alpha`, `gamma`/)
    assert.doesNotMatch(doc, /`beta`/)
    // No upstream file landed in the tree.
    assert.equal(existsSync(join(data.root, 'skills', 'alpha')), false)
    assert.equal(existsSync(join(data.root, 'skills', 'gamma')), false)
  } finally {
    await rm(data.root, { recursive: true, force: true })
    await rm(data.remote, { recursive: true, force: true })
  }
})

test('reference refresh refuses an inventory that disagrees with the pinned tree', async () => {
  // Registry and pointer document agree with each other, so the offline verify
  // passes; only the pinned upstream tree disproves them. That is the case the
  // planner's own drift guard exists for.
  const data = await referenceFixture()
  try {
    const registryPath = join(data.root, 'skills', 'upstream-sources.json')
    const registry = JSON.parse(await readFile(registryPath, 'utf8'))
    registry.sources.demo.upstreamSkills = ['alpha']
    await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`)
    const docPath = join(data.root, 'docs', 'pointer.md')
    await writeFile(docPath, applyGeneratedBlock(
      await readFile(docPath, 'utf8'),
      'demo-inventory',
      renderInventory(['alpha']),
    ))
    assert.deepEqual(verifySourceRegistry(data.root, registry), [])

    const result = await runNode([script, data.root, '--update', 'demo', '--force'])
    assert.equal(result.code, 1)
    assert.match(result.stderr, /pinned inventory drift/)
    const after = JSON.parse(await readFile(registryPath, 'utf8'))
    assert.equal(after.sources.demo.commit, data.oldCommit)
  } finally {
    await rm(data.root, { recursive: true, force: true })
    await rm(data.remote, { recursive: true, force: true })
  }
})

test('reference refresh stops at the offline verify when only the registry was edited', async () => {
  const data = await referenceFixture()
  try {
    const registryPath = join(data.root, 'skills', 'upstream-sources.json')
    const registry = JSON.parse(await readFile(registryPath, 'utf8'))
    registry.sources.demo.upstreamSkills = ['alpha']
    await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`)

    const result = await runNode([script, data.root, '--update', 'demo', '--force'])
    assert.equal(result.code, 1)
    assert.match(result.stderr, /inventory block is stale/)
    const after = JSON.parse(await readFile(registryPath, 'utf8'))
    assert.equal(after.sources.demo.commit, data.oldCommit)
  } finally {
    await rm(data.root, { recursive: true, force: true })
    await rm(data.remote, { recursive: true, force: true })
  }
})

test('inventory is read from a Git tree, preferring the declared frontmatter name', async () => {
  const data = await referenceFixture()
  try {
    assert.deepEqual(inventoryFromTree(data.remote, data.oldCommit, 'skills'), ['alpha', 'beta'])
    assert.deepEqual(inventoryFromTree(data.remote, data.newCommit, 'skills'), ['alpha', 'gamma'])
    // A prefix that holds no SKILL.md yields nothing rather than throwing.
    assert.deepEqual(inventoryFromTree(data.remote, data.newCommit, 'docs'), [])
  } finally {
    await rm(data.root, { recursive: true, force: true })
    await rm(data.remote, { recursive: true, force: true })
  }
})

test('an install records its pin, and drift is detected offline', async () => {
  const { installDrift, recordInstall, readInstallManifest } = await import('../scripts/lib/external-install.mjs')
  const host = await mkdtemp(join(tmpdir(), 'ac-drift-'))
  try {
    const registry = readSourceRegistry(AC)
    const source = registry.sources['devops-security']
    // A fresh host has nothing recorded and therefore no drift.
    assert.deepEqual(installDrift(host, registry).stale, [])

    recordInstall({
      root: host,
      id: 'devops-security',
      source,
      names: ['redis'],
      relDirs: ['.agents/skills'],
      now: '2026-01-01T00:00:00.000Z',
    })
    assert.deepEqual(installDrift(host, registry).stale, [], 'a fresh install matches its pin')

    // An install made at an older pin is stale, and the operational flag rides
    // along because that is what makes it a safety matter rather than cosmetic.
    recordInstall({
      root: host,
      id: 'devops-security',
      source: { ...source, commit: `${'0'.repeat(39)}1` },
      names: ['redis'],
      relDirs: ['.agents/skills'],
      now: '2026-01-01T00:00:00.000Z',
    })
    const drift = installDrift(host, registry)
    assert.equal(drift.stale.length, 1)
    assert.equal(drift.stale[0].id, 'devops-security')
    assert.equal(drift.stale[0].adapter, 'operational')
    assert.equal(drift.stale[0].pinned, source.commit)

    // A later install of one more skill must not drop what is already recorded.
    recordInstall({
      root: host,
      id: 'devops-security',
      source,
      names: ['helm-charts'],
      relDirs: ['.claude/skills'],
      now: '2026-01-02T00:00:00.000Z',
    })
    const manifest = readInstallManifest(host)
    assert.deepEqual(manifest.sources['devops-security'].skills, ['helm-charts', 'redis'])
    assert.deepEqual(manifest.sources['devops-security'].targets, ['.agents/skills', '.claude/skills'])
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('a tracked package version must agree everywhere it is written', () => {
  const registry = readSourceRegistry(AC)
  const anydoc = registry.sources.anydoc
  assert.ok(anydoc.version, 'anydoc records its package version')
  assert.equal(anydoc.package.name, '@firecrawl/anydoc')
  // The live tree agrees.
  assert.deepEqual(verifySourceRegistry(AC, registry), [])

  // A stale prose pin is a verify failure, not a silent rot.
  const skill = join(AC, 'skills', 'convert-documents-to-markdown', 'SKILL.md')
  const text = readFileSync(skill, 'utf8')
  assert.match(text, new RegExp(`@firecrawl/anydoc@${anydoc.version.replace(/\./g, '\\.')}`))
  assert.match(text, new RegExp(`^tool_version: "${anydoc.version.replace(/\./g, '\\.')}"$`, 'm'))
  const versions = [...text.matchAll(/@firecrawl\/anydoc@(\d[\w.-]*)/g)].map((match) => match[1])
  assert.ok(versions.length >= 3, 'the skill pins the version in more than one place')
  assert.deepEqual([...new Set(versions)], [anydoc.version], 'every pin is the recorded version')
})

test('provider session hooks call the cached remote update check', async () => {
  const claude = await readFile(join(AC, 'templates', 'claude', '.claude', 'settings.example.json'), 'utf8')
  const codex = await readFile(join(AC, 'templates', 'codex', '.codex', 'hooks.json'), 'utf8')
  const hook = await readFile(join(AC, 'templates', 'agent-tools', 'check-agent-compass-updates.sh'), 'utf8')
  const checkUpdate = await readFile(join(AC, 'scripts', 'check-update.mjs'), 'utf8')
  assert.match(claude, /check-agent-compass-updates\.sh/)
  assert.match(codex, /check-agent-compass-updates\.sh/)
  assert.match(hook, /check-update\.mjs/)
  assert.match(hook, /--remote/)
  assert.match(hook, /--quiet/)
  assert.match(checkUpdate, /upstream-skills\.mjs/)
  assert.match(checkUpdate, /--check-updates/)
})
