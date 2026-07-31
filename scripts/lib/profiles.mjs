// profiles.mjs — one source of truth for "what fits this project".
// Detection maps a host repo to stack ids; PROFILES maps stack ids to the
// compass assets worth installing there. Used by recommend.mjs (fit-based
// recommendations), setup-wizard.mjs (detection), and the compass-adopt
// mission. Everything listed must exist — test/profiles.test.mjs guards drift.

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// Assets every host benefits from, regardless of stack.
export const CORE_PROFILE = {
  label: 'Core (every project)',
  skills: [
    'gen-docs', 'verify-module', 'verify-quality', 'verify-change',
    'verify-security', 'spec-workflow', 'project-memory', 'pr-workflow',
    'pr-review-governance', 'debug-loop', 'agent-teacher',
    'architecture-advisor', 'adr-from-meeting', 'long-running-task',
    'progress-audit', 'completion-plan', 'work-splitting',
    'implementation-planning',
  ],
  templates: ['templates/specs', 'templates/intake', 'templates/commands'],
  docs: ['docs/guidelines/coding-style.md', 'docs/guidelines/testing-tdd.md', 'docs/guidelines/documentation.md'],
}

// Optional working-style skills — user preference, never auto-selected.
export const STYLE_SKILLS = ['caveman', 'caveman-commit', 'caveman-review', 'ponytail', 'ponytail-audit', 'ponytail-review', 'ponytail-debt', 'ponytail-help']

export const PROFILES = {
  'nestjs-api': {
    label: 'NestJS API',
    skills: ['nestjs-patterns', 'nestjs-monorepo-scaffold', 'external-service-patterns', 'resilience-observability-patterns', 'api-contract-sync'],
    templates: ['templates/docker', 'templates/eslint'],
    docs: ['docs/architecture/api-design.md', 'docs/tooling/api-contract-sync.md', 'docs/architecture/resilience.md', 'docs/architecture/observability.md'],
  },
  'angular-web': {
    label: 'Angular app',
    skills: ['angular-patterns', 'figma-mcp-frontend'],
    templates: ['templates/mcp'],
    docs: ['docs/tooling/mcp-servers.md'],
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
    skills: ['expo-react-native-patterns', 'figma-mcp-frontend'],
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
  'spec-kit': {
    label: 'Spec Kit',
    skills: [
      'speckit-constitution', 'speckit-specify', 'speckit-clarify',
      'speckit-plan', 'speckit-tasks', 'speckit-analyze',
      'speckit-checklist', 'speckit-implement', 'speckit-converge',
      'speckit-agent-context-update', 'speckit-taskstoissues',
    ],
    templates: ['templates/spec-kit'],
    docs: ['docs/workflows/spec-driven-development.md'],
  },
}

const SCAN_IGNORE = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.next', '.turbo', '.venv'])

// Dependency names + marker files across the whole workspace. Monorepos keep
// their real stacks in apps/*/package.json, not the root — root-only scanning
// detects "turbo" and nothing else.
const collectWorkspace = (root, depth = 3, acc = { deps: new Set(), markers: new Set() }) => {
  if (depth < 0 || !existsSync(root)) return acc
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) acc.deps.add(name)
  } catch {}
  for (const marker of ['turbo.json', 'drizzle.config.ts', '.specify', 'angular.json']) {
    if (existsSync(join(root, marker))) acc.markers.add(marker)
  }
  try {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (entry.isDirectory() && !SCAN_IGNORE.has(entry.name) && !entry.name.startsWith('.')) {
        collectWorkspace(join(root, entry.name), depth - 1, acc)
      }
    }
  } catch {}
  return acc
}

// Detect stack ids for a host repo. Matches exact dependency names (or scoped
// prefixes), never substrings — "@next/eslint-plugin-next" is not Next.js.
export const detectStacks = (root) => {
  const { deps, markers } = collectWorkspace(root)
  const anyDep = (pred) => [...deps].some(pred)
  return [
    anyDep((n) => n.startsWith('@nestjs/')) && 'nestjs-api',
    (anyDep((n) => n.startsWith('@angular/')) || markers.has('angular.json')) && 'angular-web',
    (deps.has('react') || deps.has('react-dom')) && !deps.has('react-native') && 'react-web',
    deps.has('next') && 'next-web',
    (deps.has('expo') || deps.has('react-native')) && 'expo-mobile',
    (anyDep((n) => n.includes('drizzle')) || markers.has('drizzle.config.ts')) && 'drizzle-postgres',
    (deps.has('bullmq') || deps.has('@nestjs/bullmq')) && 'bullmq',
    (deps.has('turbo') || markers.has('turbo.json')) && 'turbo-monorepo',
    markers.has('.specify') && 'spec-kit',
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
