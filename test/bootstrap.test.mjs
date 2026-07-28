import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { ANSWER_SCHEMA, buildPrompt, resolveAnswers, stackDocsForApps, validateAnswers } from '../scripts/bootstrap.mjs'
import { runNode } from './helpers.mjs'

const script = new URL('../scripts/bootstrap.mjs', import.meta.url).pathname

test('next-web maps to its own stack preset', () => {
  assert.deepEqual(stackDocsForApps(['next-web'], false), ['stacks/next-web.md'])

  const prompt = buildPrompt({
    name: 'web-app',
    scope: '@web-app',
    monorepo: true,
    apps: ['next-web'],
    pm: 'pnpm',
    db: 'none',
    queues: false,
    auth: 'keycloak',
    resilience: false,
    observability: false,
    featureFlags: true,
    apiContract: false,
    e2e: true,
    docker: true,
    ci: 'github-actions',
    sonar: true,
    security: true,
    targetDir: './web-app',
  })

  assert.match(prompt, /stacks\/next-web\.md/)
  assert.doesNotMatch(prompt, /Create app \*\*next-web\*\* from `@AC\/stacks\/react-admin\.md`/)
  assert.match(prompt, /specs\/000-project\/spec\.md/)
  assert.match(prompt, /templates\/specs\/spec-template\.md/)
  assert.match(prompt, /docs\/workflows\/project-memory\.md/)
  assert.match(prompt, /pjm init/)
})

test('bootstrap prompt covers common app matrices', () => {
  const base = {
    name: 'sample',
    scope: '@sample',
    monorepo: true,
    pm: 'pnpm',
    db: 'drizzle+postgres',
    queues: true,
    auth: 'keycloak',
    resilience: true,
    observability: true,
    featureFlags: true,
    apiContract: true,
    e2e: true,
    docker: true,
    ci: 'github-actions',
    sonar: true,
    security: true,
    targetDir: './sample',
  }

  const cases = [
    [['nestjs-api'], ['stacks/turbo-monorepo.md', 'stacks/nestjs-api.md']],
    [['nestjs-api', 'react-admin', 'expo-mobile'], ['stacks/nestjs-api.md', 'stacks/react-admin.md', 'stacks/expo-mobile.md']],
    [['next-web'], ['stacks/turbo-monorepo.md', 'stacks/next-web.md']],
  ]

  for (const [apps, docs] of cases) {
    const prompt = buildPrompt({ ...base, apps })
    docs.forEach((doc) => assert.match(prompt, new RegExp(doc.replaceAll('/', '\\/'))))
  }
})

test('resolveAnswers fills defaults and derives scope/targetDir from name', () => {
  const answers = resolveAnswers({ name: 'My App' })
  assert.equal(answers.name, 'my-app')
  assert.equal(answers.scope, '@my-app')
  assert.equal(answers.targetDir, './my-app')
  assert.equal(answers.pm, 'pnpm')
  assert.deepEqual(answers.apps, ANSWER_SCHEMA.apps.default)
  assert.deepEqual(validateAnswers(answers), [])
})

test('validateAnswers reports unknown choices and wrong types', () => {
  const errors = validateAnswers(resolveAnswers({ name: 'x', apps: ['bad-app'], pm: 'pip', docker: 'yes' }))
  assert.ok(errors.some((e) => e.includes('apps') && e.includes('bad-app')))
  assert.ok(errors.some((e) => e.includes('pm') && e.includes('pip')))
  assert.ok(errors.some((e) => e.includes('docker')))
})

test('bootstrap --answers runs non-interactively and honors --out', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ac-bootstrap-'))
  try {
    await writeFile(join(dir, 'answers.json'), JSON.stringify({ name: 'demo-app', apps: ['next-web'], monorepo: false }))
    const run = await runNode([script, '--answers', join(dir, 'answers.json'), '--out', join(dir, 'proj')])
    assert.equal(run.code, 0, run.stderr)
    const prompt = await readFile(join(dir, 'proj', 'BOOTSTRAP_PROMPT.md'), 'utf8')
    assert.match(prompt, /demo-app/)
    assert.match(prompt, /stacks\/next-web\.md/)
    const saved = JSON.parse(await readFile(join(dir, 'proj', 'agent-compass.answers.json'), 'utf8'))
    assert.equal(saved.monorepo, false)

    const bad = await runNode([script, '--answers', join(dir, 'missing.json')])
    assert.equal(bad.code, 1)
    assert.match(bad.stderr, /Cannot read answers file/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('bootstrap without a TTY and without --answers uses all defaults', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ac-bootstrap-tty-'))
  try {
    const run = await runNode([script, '--out', dir])
    assert.equal(run.code, 0, run.stderr)
    assert.match(run.stdout, /non-interactive stdin: using all defaults/)
    const saved = JSON.parse(await readFile(join(dir, 'agent-compass.answers.json'), 'utf8'))
    assert.equal(saved.name, 'my-app')
    assert.deepEqual(saved.apps, ['nestjs-api'])
    assert.match(await readFile(join(dir, 'BOOTSTRAP_PROMPT.md'), 'utf8'), /stacks\/nestjs-api\.md/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('bootstrap --schema prints the answers contract', async () => {
  const run = await runNode([script, '--schema'])
  assert.equal(run.code, 0, run.stderr)
  const schema = JSON.parse(run.stdout)
  assert.deepEqual(schema.answers.apps.choices, ['nestjs-api', 'angular-web', 'react-admin', 'expo-mobile', 'next-web'])
})
