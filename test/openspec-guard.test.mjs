import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/openspec-guard.mjs', import.meta.url)

const change = async (dir, name, files) => {
  const changeDir = join(dir, 'openspec', 'changes', name)
  await mkdir(changeDir, { recursive: true })
  for (const [file, body] of Object.entries(files)) {
    const target = join(changeDir, file)
    await mkdir(join(target, '..'), { recursive: true })
    await writeFile(target, body)
  }
  return changeDir
}

const workflows = async (dir) => {
  await mkdir(join(dir, '.claude', 'commands', 'opsx'), { recursive: true })
  for (const name of ['explore', 'new', 'propose', 'ff', 'continue', 'update', 'apply', 'verify', 'sync', 'archive', 'bulk-archive', 'onboard']) {
    await writeFile(join(dir, '.claude', 'commands', 'opsx', `${name}.md`), '# workflow\n')
  }
}

test('openspec-guard self-test passes', async () => {
  const result = await runNode([script.pathname, '--self-test'], { cwd: root.pathname })
  assert.equal(result.code, 0, result.stderr)
  assert.match(result.stdout, /self-test: \d+ passed/)
})

test('openspec-guard stays silent on a project with no OpenSpec root', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'osg-none-'))
  try {
    const result = await runNode([script.pathname, dir], { cwd: root.pathname })
    assert.equal(result.code, 0, result.stderr)
    assert.match(result.stdout, /no OpenSpec root found/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('openspec-guard fails a change that has a proposal and nothing else', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'osg-chain-'))
  try {
    await workflows(dir)
    await change(dir, 'half-planned', { 'proposal.md': '# Why\n' })
    const result = await runNode([script.pathname, dir], { cwd: root.pathname })
    assert.equal(result.code, 1)
    assert.match(result.stdout, /\[chain\].*half-planned.*missing/s)
    assert.match(result.stdout, /\[deltas\]/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('openspec-guard passes a complete change and reports JSON', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'osg-ok-'))
  try {
    await workflows(dir)
    await change(dir, 'whole', {
      'proposal.md': '# Why\n',
      'design.md': '# How\n',
      'tasks.md': '- [ ] do the thing\n',
      'specs/thing/spec.md': '# Spec\n',
    })
    const result = await runNode([script.pathname, dir, '--json'], { cwd: root.pathname })
    assert.equal(result.code, 0, result.stderr)
    const report = JSON.parse(result.stdout)
    assert.equal(report.counts.errors, 0)
    assert.equal(report.changes[0].name, 'whole')
    assert.deepEqual(report.changes[0].missing, [])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('openspec-guard accepts skip_specs with a written reason and rejects a bare one', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'osg-skip-'))
  try {
    await workflows(dir)
    await change(dir, 'bare-skip', {
      'proposal.md': '# Why\n', 'design.md': '# How\n', 'tasks.md': '- [ ] x\n',
      '.openspec.yaml': 'skip_specs: true\n',
    })
    let result = await runNode([script.pathname, dir], { cwd: root.pathname })
    assert.equal(result.code, 0, result.stderr)
    assert.match(result.stdout, /skip_specs with no written reason/)

    await writeFile(join(dir, 'openspec', 'changes', 'bare-skip', '.openspec.yaml'),
      '# This change implements requirements already written in the main specs.\nskip_specs: true\n')
    result = await runNode([script.pathname, dir, '--strict'], { cwd: root.pathname })
    assert.equal(result.code, 0, result.stderr)
    assert.doesNotMatch(result.stdout, /no written reason/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('openspec-guard fails when the CLI ships workflows no agent can reach', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'osg-wf-'))
  try {
    await mkdir(join(dir, '.claude', 'commands', 'opsx'), { recursive: true })
    for (const name of ['propose', 'apply']) {
      await writeFile(join(dir, '.claude', 'commands', 'opsx', `${name}.md`), '# workflow\n')
    }
    await change(dir, 'whole', {
      'proposal.md': '# Why\n', 'design.md': '# How\n', 'tasks.md': '- [ ] x\n', 'specs/thing/spec.md': '# Spec\n',
    })
    const result = await runNode([script.pathname, dir], { cwd: root.pathname })
    assert.equal(result.code, 1)
    assert.match(result.stdout, /\[workflows\].*verify/s)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('openspec-guard reads the declared root instead of guessing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'osg-decl-'))
  try {
    await workflows(dir)
    // Two roots on disk. The declaration names one, so resolution is unambiguous.
    await mkdir(join(dir, 'openspec', 'changes', 'archive'), { recursive: true })
    await mkdir(join(dir, 'docs', 'openspec', 'changes', 'real'), { recursive: true })
    await writeFile(join(dir, 'docs', 'openspec', 'changes', 'real', 'proposal.md'), '# Why\n')
    await writeFile(join(dir, 'agent-compass.commands.json'), JSON.stringify({ paths: { openspec: 'docs/openspec' } }))

    const result = await runNode([script.pathname, dir, '--json'], { cwd: root.pathname })
    const report = JSON.parse(result.stdout)
    assert.equal(report.openspec, 'docs/openspec')
    assert.equal(report.changes[0].name, 'real')
    // The declaration resolves which root is real; it does not make the second one disappear.
    assert.ok(report.findings.some((f) => f.code === 'root'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('openspec-guard treats a stale grandfather entry as a failure', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'osg-base-'))
  try {
    await workflows(dir)
    await change(dir, 'whole', {
      'proposal.md': '# Why\n', 'design.md': '# How\n', 'tasks.md': '- [ ] x\n', 'specs/thing/spec.md': '# Spec\n',
    })
    await writeFile(join(dir, '.openspec-guard.json'), JSON.stringify({ grandfathered: { whole: 'predates the gate' } }))
    const result = await runNode([script.pathname, dir], { cwd: root.pathname })
    assert.equal(result.code, 1)
    assert.match(result.stdout, /\[baseline\].*ratchet/s)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

// The chain gate used to hard-code the default spec-driven quartet, so a host on
// its own schema — one that writes no design.md and puts tasks.md beside each
// capability spec — got two errors it could never clear.
const PER_CAPABILITY = [
  'name: per-capability',
  'version: 1',
  'artifacts:',
  '  - id: proposal',
  '    generates: "proposal.md"',
  '  - id: spec',
  '    generates: "specs/**/spec.md"',
  '  - id: plan',
  '    generates: "specs/**/plan.md"',
  '  - id: checklist',
  '    generates: "specs/**/checklist.md"',
  '  - id: tasks',
  '    generates: "specs/**/tasks.md"',
].join('\n') + '\n'

const declareSchema = async (dir, name, body) => {
  const schemaDir = join(dir, 'openspec', 'schemas', name)
  await mkdir(schemaDir, { recursive: true })
  await writeFile(join(schemaDir, 'schema.yaml'), body)
}

const quartet = {
  'proposal.md': '# Why\n',
  'specs/thing/spec.md': '# Spec\n',
  'specs/thing/plan.md': '# How\n',
  'specs/thing/checklist.md': '- [x] reviewed\n',
  'specs/thing/tasks.md': '- [ ] do the thing\n',
}

test('openspec-guard reads the chain from the schema the root declares', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'osg-schema-'))
  try {
    await workflows(dir)
    await change(dir, 'quartet', quartet)

    // Without a declaration the default chain applies, and it is wrong here.
    let report = JSON.parse((await runNode([script.pathname, dir, '--json'], { cwd: root.pathname })).stdout)
    assert.deepEqual(report.changes[0].missing, ['design', 'tasks'])

    await declareSchema(dir, 'per-capability', PER_CAPABILITY)
    const result = await runNode([script.pathname, dir, '--json'], { cwd: root.pathname })
    assert.equal(result.code, 0, result.stderr)
    report = JSON.parse(result.stdout)
    assert.deepEqual(report.changes[0].missing, [])
    assert.match(report.changes[0].schema, /^per-capability/)
    assert.ok(!report.findings.some((f) => f.code === 'chain'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('openspec-guard reports two declared schemas rather than picking one', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'osg-two-schemas-'))
  try {
    await workflows(dir)
    await change(dir, 'quartet', quartet)
    await declareSchema(dir, 'other', 'name: other\nartifacts:\n  - id: proposal\n    generates: "proposal.md"\n')
    await declareSchema(dir, 'per-capability', PER_CAPABILITY)

    const result = await runNode([script.pathname, dir], { cwd: root.pathname })
    assert.match(result.stdout, /schemas\/ declares 2 schemas: other, per-capability/)
    // Fallen back to the default chain, which is what makes the warning matter.
    assert.match(result.stdout, /\[chain\]/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('openspec-guard still honours skip_specs under a declared schema', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'osg-schema-skip-'))
  try {
    await workflows(dir)
    await change(dir, 'no-delta', {
      'proposal.md': '# Why\n',
      '.openspec.yaml': '# Implements requirements already written in the main specs.\nskip_specs: true\n',
    })
    await declareSchema(dir, 'per-capability', PER_CAPABILITY)

    const result = await runNode([script.pathname, dir, '--json'], { cwd: root.pathname })
    const report = JSON.parse(result.stdout)
    assert.deepEqual(report.changes[0].missing, [])
    assert.ok(!report.findings.some((f) => f.code === 'deltas'))
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
