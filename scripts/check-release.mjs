#!/usr/bin/env node
// check-release.mjs — verify package version, changelog, and local git tag agree.

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const help = `Usage: node scripts/check-release.mjs [--root <dir>]

Verify release metadata before tagging/publishing:
  - package.json version exists
  - CHANGELOG.md has matching dated section
  - local git repo has tag v<version>

Options:
  --root <dir>  Check another root directory.
  --help        Show this help.
`

if (process.argv.includes('--help')) {
  console.log(help)
  process.exit(0)
}

const rootArg = process.argv.indexOf('--root')
const ROOT = rootArg === -1 ? dirname(dirname(fileURLToPath(import.meta.url))) : resolve(process.argv[rootArg + 1] || '')
const hits = []

let version = ''
try {
  version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version || ''
} catch {
  hits.push('package.json: missing or invalid')
}

if (version && !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  hits.push(`package.json: invalid semver ${version}`)
}

if (version) {
  const changelog = existsSync(join(ROOT, 'CHANGELOG.md')) ? readFileSync(join(ROOT, 'CHANGELOG.md'), 'utf8') : ''
  if (!new RegExp(`^## \\[${version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\] - \\d{4}-\\d{2}-\\d{2}$`, 'm').test(changelog)) {
    hits.push(`CHANGELOG.md: missing dated [${version}] section`)
  }
}

if (version && existsSync(join(ROOT, '.git'))) {
  const tag = `v${version}`
  const result = spawnSync('git', ['-C', ROOT, 'tag', '--list', tag], { encoding: 'utf8' })
  if (result.status !== 0) hits.push(`git tag check failed: ${result.stderr.trim()}`)
  else if (result.stdout.trim() !== tag) hits.push(`git: missing tag ${tag}`)
}

if (hits.length) {
  console.error(`✗ ${hits.length} release issue(s):\n`)
  hits.forEach((hit) => console.error(`  ${hit}`))
  process.exit(1)
}

console.log('✓ release check passed — package version, changelog, and local tag agree.')
