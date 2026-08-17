import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'
import {
  bundleStatus, changeStatus, compareSnapshots, evidenceConfig, extractSection,
  isSlug, isTestFile, parseJunit, sumJunit,
} from '../scripts/lib/evidence.mjs'

const root = new URL('..', import.meta.url)
const script = new URL('../scripts/evidence.mjs', import.meta.url).pathname

const junit = (counts) => `<?xml version="1.0"?>\n<testsuites tests="${counts.tests}" failures="${counts.failures ?? 0}" errors="${counts.errors ?? 0}" skipped="${counts.skipped ?? 0}">\n</testsuites>\n`

test('parseJunit reads the counts off the opening tag, suite or suites', () => {
  assert.deepEqual(parseJunit(junit({ tests: 12, failures: 2, skipped: 1 })), { tests: 12, failures: 2, errors: 0, skipped: 1 })
  assert.deepEqual(parseJunit('<testsuite tests="3" failures="0" errors="1" skipped="0"></testsuite>'), { tests: 3, failures: 0, errors: 1, skipped: 0 })
  assert.deepEqual(parseJunit('not xml at all'), { tests: 0, failures: 0, errors: 0, skipped: 0 })
})

test('sumJunit adds every runner together', () => {
  const totals = sumJunit([parseJunit(junit({ tests: 5, failures: 1 })), parseJunit(junit({ tests: 7, errors: 2 }))])
  assert.deepEqual(totals, { tests: 12, failures: 1, errors: 2, skipped: 0 })
})

test('evidenceConfig falls back to check, then test, and normalises lists', () => {
  assert.equal(evidenceConfig({ check: 'npm run check', test: 'npm test' }).command, 'npm run check')
  assert.equal(evidenceConfig({ test: 'npm test' }).command, 'npm test')
  assert.equal(evidenceConfig({}).command, null)
  const config = evidenceConfig({ evidence: { command: 'pnpm proof', junit: 'a.xml', expectScreenshots: 4 } })
  assert.equal(config.command, 'pnpm proof')
  assert.deepEqual(config.junit, ['a.xml'])
  assert.equal(config.expectScreenshots, 4)
  assert.equal(evidenceConfig({}).expectScreenshots, 0)
})

test('bundleStatus refuses to call an unproven run complete', () => {
  const pass = { totals: { failures: 0, errors: 0 }, junitCount: 1, screenshotCount: 2, expectScreenshots: 2 }
  assert.equal(bundleStatus(pass).complete, true)
  // No report at all is not the same as zero failures.
  assert.equal(bundleStatus({ ...pass, junitCount: 0 }).complete, false)
  assert.equal(bundleStatus({ ...pass, totals: { failures: 1, errors: 0 } }).complete, false)
  assert.equal(bundleStatus({ ...pass, screenshotCount: 1 }).complete, false)
  // One short of the promise fails; extra captures are fine.
  assert.equal(bundleStatus({ ...pass, screenshotCount: 9 }).complete, true)
})

test('changeStatus needs a complete proof and a real diff', () => {
  assert.equal(changeStatus({ evidenceComplete: true, changedCount: 1 }).compliant, true)
  assert.equal(changeStatus({ evidenceComplete: true, changedCount: 0 }).compliant, false)
  assert.equal(changeStatus({ evidenceComplete: false, changedCount: 3 }).compliant, false)
})

test('compareSnapshots classifies added, modified and deleted', () => {
  const before = { 'a.ts': { sha256: '1' }, 'b.ts': { sha256: '2' }, 'app.tsbuildinfo': { sha256: '3' } }
  const after = { 'a.ts': { sha256: '1' }, 'b.ts': { sha256: '9' }, 'c.ts': { sha256: '4' } }
  assert.deepEqual(compareSnapshots(before, after), { added: ['c.ts'], modified: ['b.ts'], deleted: [] })
})

test('isTestFile recognises the usual test locations', () => {
  assert.equal(isTestFile('src/lib/a.test.ts'), true)
  assert.equal(isTestFile('src/lib/a.spec.tsx'), true)
  assert.equal(isTestFile('tests/e2e/flow.ts'), true)
  assert.equal(isTestFile('src/lib/a.ts'), false)
  assert.equal(isTestFile('src/contests/a.ts'), false)
})

test('extractSection reads the machine-parsed spec headings', () => {
  const spec = '# Spec\n\n## Acceptance criteria\n\n- AC-01 — first\n- AC-02 — second\n\n## Out of scope\n\n- nothing\n'
  assert.deepEqual(extractSection(spec, 'Acceptance criteria'), ['AC-01 — first', 'AC-02 — second'])
  assert.deepEqual(extractSection(spec, 'Expected proof scenarios'), [])
})

test('isSlug accepts kebab-case only', () => {
  assert.equal(isSlug('featured-movie'), true)
  assert.equal(isSlug('Featured Movie'), false)
  assert.equal(isSlug('../escape'), false)
})

test('the CLI builds a bundle and reports an incomplete proof', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ac-evidence-'))
  try {
    await mkdir(join(dir, 'reports'), { recursive: true })
    await writeFile(join(dir, 'reports', 'junit.xml'), junit({ tests: 4, failures: 1 }))

    const run = await runNode([script, dir, '--strict'], { cwd: root.pathname })
    assert.equal(run.code, 1, run.stderr)
    assert.match(run.stdout, /PROOF INCOMPLETE/)

    const summary = await readFile(join(dir, '.agent', 'evidence', 'summary.md'), 'utf8')
    assert.match(summary, /PROOF INCOMPLETE/)
    assert.match(summary, /\| 4 \| 1 \| 0 \| 0 \| 1 \|/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('the CLI records a before-proof and reports the change afterwards', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ac-evidence-'))
  try {
    await mkdir(join(dir, 'reports'), { recursive: true })
    await mkdir(join(dir, 'specs', 'changes'), { recursive: true })
    await mkdir(join(dir, 'src'), { recursive: true })
    await writeFile(join(dir, 'reports', 'junit.xml'), junit({ tests: 4 }))
    await writeFile(join(dir, 'src', 'app.ts'), 'export const a = 1\n')
    await writeFile(join(dir, 'specs', 'changes', 'add-banner.md'),
      '# Add banner\n\n## Acceptance criteria\n\n- AB-01 — a banner shows\n\n## Expected proof scenarios\n\n- banner on desktop\n')

    const start = await runNode([script, dir, '--change', 'add-banner', '--phase', 'start'], { cwd: root.pathname })
    assert.equal(start.code, 0, start.stderr)

    // Nothing changed yet: the gate must refuse.
    const empty = await runNode([script, dir, '--change', 'add-banner', '--phase', 'finish'], { cwd: root.pathname })
    assert.equal(empty.code, 1, 'an empty diff cannot be conform')

    await writeFile(join(dir, 'src', 'app.ts'), 'export const a = 2\n')
    await writeFile(join(dir, 'src', 'app.test.ts'), 'test\n')

    const finish = await runNode([script, dir, '--change', 'add-banner', '--phase', 'finish'], { cwd: root.pathname })
    assert.equal(finish.code, 0, finish.stderr)
    assert.match(finish.stdout, /CHANGE CONFORM/)

    const report = await readFile(join(dir, '.agent', 'changes', 'add-banner', 'change-summary.md'), 'utf8')
    assert.match(report, /CHANGE CONFORM/)
    assert.match(report, /src\/app\.test\.ts/)
    assert.match(report, /AB-01 — a banner shows/)
    assert.match(report, /banner on desktop/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('the CLI refuses a bad slug, a missing spec and a finish with no start', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ac-evidence-'))
  try {
    const badSlug = await runNode([script, dir, '--change', 'Not A Slug', '--phase', 'start'], { cwd: root.pathname })
    assert.equal(badSlug.code, 1)
    assert.match(badSlug.stderr, /kebab-case/)

    const noSpec = await runNode([script, dir, '--change', 'ghost', '--phase', 'start'], { cwd: root.pathname })
    assert.equal(noSpec.code, 1)
    assert.match(noSpec.stderr, /specs\/changes\/ghost\.md/)

    const noStart = await runNode([script, dir, '--change', 'ghost', '--phase', 'finish'], { cwd: root.pathname })
    assert.equal(noStart.code, 1)
    assert.match(noStart.stderr, /No recorded start/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
