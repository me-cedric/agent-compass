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
    'architecture-advisor', 'adr-from-meeting', 'codebase-to-specs',
    'long-running-task',
    'progress-audit', 'completion-plan', 'work-splitting',
    'implementation-planning', 'convert-documents-to-markdown',
    // Delivery reporting and the RAID/ticket chain around the specs.
    'impact-analysis', 'delivery-digest', 'harvest-questions',
    'split-tasks-by-profile', 'spec-to-tickets', 'spec-drift-triage',
    // The review pass that closes the loop: does the build match the specs?
    'qa-review-pass',
    // Sketch and model conversions that feed decisions and specs.
    'diagram-to-adr', 'diagram-to-likec4', 'likec4-to-openspec',
  ],
  templates: ['templates/specs', 'templates/intake', 'templates/commands'],
  docs: ['docs/guidelines/coding-style.md', 'docs/guidelines/testing-tdd.md', 'docs/guidelines/documentation.md'],
}

// Optional working-style skill — user preference, never auto-selected. The skills
// it routes to (`ponytail`, `caveman`, `i-have-adhd`, `asd-ste100`) are tracked
// external sources, installed on request; see docs/guidelines/style-contract.md
// and docs/tooling/style-and-design-skills.md.
export const STYLE_SKILLS = ['working-style-skills']

// The style skills themselves, which live in four tracked sources. `skills-sync`
// routes these names to the install path, so a `fit+style` adoption gets the real
// skills and not just the router.
export const STYLE_EXTERNAL_SKILLS = [
  'asd-ste100', 'caveman', 'caveman-commit', 'caveman-review', 'i-have-adhd',
  'ponytail', 'ponytail-audit', 'ponytail-debt', 'ponytail-help', 'ponytail-review',
]

export const PROFILES = {
  'nestjs-api': {
    label: 'NestJS API',
    skills: ['nestjs-patterns', 'nestjs-monorepo-scaffold', 'external-service-patterns', 'resilience-observability-patterns', 'api-contract-sync'],
    templates: ['templates/docker', 'templates/eslint'],
    docs: ['docs/architecture/api-design.md', 'docs/tooling/api-contract-sync.md', 'docs/architecture/resilience.md', 'docs/architecture/observability.md'],
  },
  // `design-taste-skills` routes to the tracked design corpus and holds the
  // by-surface split: a dense product UI and a landing page want opposite advice,
  // so a project loads one group, never both. `ai-native-ui-patterns` is
  // orthogonal — it covers agent-surface behaviour, not taste.
  'angular-web': {
    label: 'Angular app',
    skills: [
      'angular-patterns', 'figma-mcp-frontend', 'figma-tokens-to-designmd',
      'design-taste-skills', 'ai-native-ui-patterns', 'visual-regression-playwright',
    ],
    external: ['high-end-visual-design', 'minimalist-ui', 'redesign-existing-projects'],
    templates: ['templates/mcp'],
    docs: ['docs/tooling/mcp-servers.md'],
  },
  'react-web': {
    label: 'React app',
    skills: [
      'react-admin-dashboard-patterns', 'figma-mcp-frontend', 'figma-tokens-to-designmd',
      'design-taste-skills', 'ai-native-ui-patterns', 'visual-regression-playwright',
    ],
    external: ['high-end-visual-design', 'minimalist-ui', 'redesign-existing-projects'],
    templates: ['templates/design-system', 'templates/eslint'],
    docs: [],
  },
  'next-web': {
    label: 'Next.js app',
    skills: [
      'figma-mcp-frontend', 'figma-tokens-to-designmd',
      'design-taste-skills', 'ai-native-ui-patterns', 'visual-regression-playwright',
    ],
    external: [
      'design-taste-frontend', 'industrial-brutalist-ui', 'stitch-design-taste',
      'imagegen-frontend-web', 'image-to-code', 'brandkit',
    ],
    templates: ['templates/design-system', 'templates/docker'],
    docs: [],
  },
  'expo-mobile': {
    label: 'Expo mobile',
    skills: [
      'expo-react-native-patterns', 'figma-mcp-frontend',
      'design-taste-skills', 'ai-native-ui-patterns', 'visual-regression-playwright',
    ],
    external: [
      'high-end-visual-design', 'minimalist-ui', 'redesign-existing-projects',
      'imagegen-frontend-mobile',
    ],
    templates: ['templates/eslint'],
    docs: [],
  },
  // Native mobile. The platform guidance itself lives in two tracked external
  // corpora that Agent Compass pins but never copies — `native-mobile-skills`
  // routes to them. See docs/tooling/native-mobile-skills.md and ADR 002.
  'android-compose': {
    label: 'Android Compose',
    skills: ['native-mobile-skills', 'figma-mcp-frontend', 'design-taste-skills', 'ai-native-ui-patterns'],
    external: ['high-end-visual-design', 'minimalist-ui', 'imagegen-frontend-mobile'],
    templates: [],
    docs: ['docs/tooling/native-mobile-skills.md'],
  },
  'swift-ios': {
    label: 'Swift iOS',
    skills: ['native-mobile-skills', 'figma-mcp-frontend', 'design-taste-skills', 'ai-native-ui-patterns'],
    external: ['high-end-visual-design', 'minimalist-ui', 'imagegen-frontend-mobile'],
    templates: [],
    docs: ['docs/tooling/native-mobile-skills.md', 'docs/guidelines/accessibility.md'],
  },
  'drizzle-postgres': {
    label: 'Drizzle/Postgres',
    skills: ['drizzle-postgres-patterns', 'docs-to-dbml'],
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
const FILE_MARKERS = [
  'turbo.json', 'drizzle.config.ts', '.specify', 'angular.json',
  'AndroidManifest.xml', 'Package.swift', 'Podfile',
]

// Dependency names + marker files across the whole workspace. Monorepos keep
// their real stacks in apps/*/package.json, not the root — root-only scanning
// detects "turbo" and nothing else.
const collectWorkspace = (root, depth = 3, acc = { deps: new Set(), markers: new Set() }) => {
  if (depth < 0 || !existsSync(root)) return acc
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    for (const name of Object.keys({ ...pkg.dependencies, ...pkg.devDependencies })) acc.deps.add(name)
  } catch {}
  for (const marker of FILE_MARKERS) {
    if (existsSync(join(root, marker))) acc.markers.add(marker)
  }
  // Flutter owns its `android/` and `ios/` trees the same way React Native does.
  const pubspec = join(root, 'pubspec.yaml')
  if (existsSync(pubspec)) {
    try {
      if (/^\s*(flutter:|sdk:\s*flutter)/m.test(readFileSync(pubspec, 'utf8'))) acc.markers.add('flutter')
    } catch {}
  }
  // A Gradle build is only an Android build when a build file applies an Android
  // plugin — a Kotlin service uses the same file names.
  for (const build of ['build.gradle.kts', 'build.gradle']) {
    const file = join(root, build)
    if (!existsSync(file)) continue
    try {
      if (readFileSync(file, 'utf8').includes('com.android.')) acc.markers.add('android-gradle-plugin')
    } catch {}
  }
  try {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      // An Xcode project or workspace is a directory, not a file.
      if (entry.isDirectory() && (entry.name.endsWith('.xcodeproj') || entry.name.endsWith('.xcworkspace'))) {
        acc.markers.add('xcode-project')
      }
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
  // A cross-platform toolkit generates the native `android/` and `ios/` trees, so
  // its markers are build output, not a native app to route work to.
  const crossPlatform = deps.has('expo') || deps.has('react-native') || markers.has('flutter')
  const reactNative = deps.has('expo') || deps.has('react-native')
  return [
    anyDep((n) => n.startsWith('@nestjs/')) && 'nestjs-api',
    (anyDep((n) => n.startsWith('@angular/')) || markers.has('angular.json')) && 'angular-web',
    (deps.has('react') || deps.has('react-dom')) && !deps.has('react-native') && 'react-web',
    deps.has('next') && 'next-web',
    reactNative && 'expo-mobile',
    // React Native and Flutter both ship generated `android/` and `ios/` trees, so
    // the native markers below only mean "native app" when neither is present.
    !crossPlatform && (markers.has('AndroidManifest.xml') || markers.has('android-gradle-plugin')) && 'android-compose',
    !crossPlatform && (markers.has('xcode-project') || markers.has('Podfile') || markers.has('Package.swift')) && 'swift-ios',
    (anyDep((n) => n.includes('drizzle')) || markers.has('drizzle.config.ts')) && 'drizzle-postgres',
    (deps.has('bullmq') || deps.has('@nestjs/bullmq')) && 'bullmq',
    (deps.has('turbo') || markers.has('turbo.json')) && 'turbo-monorepo',
    markers.has('.specify') && 'spec-kit',
  ].filter(Boolean)
}

const dedupe = (arr) => [...new Set(arr)]

// Merge core + matched profiles into one fit-based asset selection.
//
// `external` names skills that live in a tracked source rather than in this
// repository. They are merged into `skills` because every consumer installs
// through `skills-sync --only`, which routes each name to the right path — a
// caller never needs to know which kind a name is. `external` is also returned
// on its own for a caller that wants to report the split.
export const selectAssets = (stackIds) => {
  const matched = stackIds.map((id) => PROFILES[id]).filter(Boolean)
  const local = dedupe([...CORE_PROFILE.skills, ...matched.flatMap((p) => p.skills)])
  const external = dedupe([
    ...(CORE_PROFILE.external || []),
    ...matched.flatMap((p) => p.external || []),
  ])
  return {
    stacks: stackIds.filter((id) => PROFILES[id]),
    skills: dedupe([...local, ...external]),
    localSkills: local,
    external,
    templates: dedupe([...CORE_PROFILE.templates, ...matched.flatMap((p) => p.templates)]),
    docs: dedupe([...CORE_PROFILE.docs, ...matched.flatMap((p) => p.docs)]),
  }
}

export const stackLabels = (stackIds) => stackIds.map((id) => PROFILES[id]?.label || id)
