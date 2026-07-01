// profiles.mjs — one source of truth for "what fits this project".
// Detection maps a host repo to stack ids; PROFILES maps stack ids to the
// compass assets worth installing there. Used by recommend.mjs (fit-based
// recommendations), setup-wizard.mjs (detection), and the compass-adopt
// mission. Everything listed must exist — test/profiles.test.mjs guards drift.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Assets every host benefits from, regardless of stack.
export const CORE_PROFILE = {
  label: 'Core (every project)',
  skills: [
    'gen-docs', 'verify-module', 'verify-quality', 'verify-change',
    'verify-security', 'spec-workflow', 'project-memory', 'pr-workflow',
    'debug-loop', 'agent-teacher', 'architecture-advisor',
  ],
  templates: ['templates/specs', 'templates/intake', 'templates/commands'],
  docs: ['docs/guidelines/coding-style.md', 'docs/guidelines/testing-tdd.md', 'docs/guidelines/documentation.md'],
}

// Optional working-style skills — user preference, never auto-selected.
export const STYLE_SKILLS = ['caveman', 'caveman-commit', 'caveman-review', 'ponytail', 'ponytail-audit', 'ponytail-review', 'ponytail-debt', 'ponytail-help']

export const PROFILES = {
  'nestjs-api': {
    label: 'NestJS API',
    skills: ['nestjs-patterns', 'nestjs-monorepo-scaffold', 'external-service-patterns', 'resilience-observability-patterns'],
    templates: ['templates/docker', 'templates/eslint'],
    docs: ['docs/architecture/api-design.md', 'docs/tooling/api-contract-sync.md', 'docs/architecture/resilience.md', 'docs/architecture/observability.md'],
  },
  'react-web': {
    label: 'React app',
    skills: ['react-admin-dashboard-patterns', 'figma-mcp-frontend'],
    templates: ['templates/design-system', 'templates/eslint'],
    docs: [],
  },
  'next-web': {
    label: 'Next.js app',
    skills: ['figma-mcp-frontend'],
    templates: ['templates/design-system', 'templates/docker'],
    docs: [],
  },
  'expo-mobile': {
    label: 'Expo mobile',
    skills: ['expo-react-native-patterns'],
    templates: ['templates/eslint'],
    docs: [],
  },
  'drizzle-postgres': {
    label: 'Drizzle/Postgres',
    skills: ['drizzle-postgres-patterns'],
    templates: [],
    docs: [],
  },
  bullmq: {
    label: 'BullMQ',
    skills: ['bullmq-patterns'],
    templates: [],
    docs: [],
  },
  'turbo-monorepo': {
    label: 'Turborepo',
    skills: [],
    templates: ['templates/monorepo'],
    docs: ['docs/architecture/monorepo.md', 'docs/tooling/pnpm.md', 'docs/tooling/turbo.md', 'docs/architecture/shared-types.md'],
  },
}

// Detect stack ids for a host repo from its package.json and marker files.
export const detectStacks = (root) => {
  let pkg = {}
  try { pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) } catch {}
  const deps = JSON.stringify({ ...pkg.dependencies, ...pkg.devDependencies }).toLowerCase()
  return [
    deps.includes('nestjs') && 'nestjs-api',
    deps.includes('react') && !deps.includes('react-native') && 'react-web',
    deps.includes('next') && 'next-web',
    (deps.includes('expo') || deps.includes('react-native')) && 'expo-mobile',
    (deps.includes('drizzle') || existsSync(join(root, 'drizzle.config.ts'))) && 'drizzle-postgres',
    deps.includes('bullmq') && 'bullmq',
    (deps.includes('turbo') || existsSync(join(root, 'turbo.json'))) && 'turbo-monorepo',
  ].filter(Boolean)
}

const dedupe = (arr) => [...new Set(arr)]

// Merge core + matched profiles into one fit-based asset selection.
export const selectAssets = (stackIds) => {
  const matched = stackIds.map((id) => PROFILES[id]).filter(Boolean)
  return {
    stacks: stackIds.filter((id) => PROFILES[id]),
    skills: dedupe([...CORE_PROFILE.skills, ...matched.flatMap((p) => p.skills)]),
    templates: dedupe([...CORE_PROFILE.templates, ...matched.flatMap((p) => p.templates)]),
    docs: dedupe([...CORE_PROFILE.docs, ...matched.flatMap((p) => p.docs)]),
  }
}

export const stackLabels = (stackIds) => stackIds.map((id) => PROFILES[id]?.label || id)
