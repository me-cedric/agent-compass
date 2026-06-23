import assert from 'node:assert/strict'
import test from 'node:test'

import { buildPrompt, stackDocsForApps } from '../scripts/bootstrap.mjs'

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
