// detect.mjs — map a host repo to stack ids from dependencies and marker files.
// Packs (engine/packs.mjs) map stack ids to the assets worth installing.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

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
const isDir = (path) => { try { return statSync(path).isDirectory() } catch { return false } }

export const detectStacks = (root, { openspecDir } = {}) => {
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
    // A declared path (compass.json or konvoy.json `paths`) wins over the conventional locations.
    [openspecDir, 'docs/openspec', 'openspec', '.openspec'].some((d) => d && isDir(join(root, d))) && 'openspec',
  ].filter(Boolean)
}
