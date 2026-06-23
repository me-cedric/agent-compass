#!/usr/bin/env node
// release.mjs — bump package.json + changelog; tag after validation if requested.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const help = `Usage: node scripts/release.mjs <version> [--commit] [--tag] [--dry]

Bump package.json and CHANGELOG.md from Unreleased to a dated release section.

Options:
  --commit  Commit package.json and CHANGELOG.md.
  --tag     Create annotated v<version> tag. Requires --commit or clean tree.
  --dry     Print changes, do not write, commit, or tag.
`

const args = process.argv.slice(2)
if (args.includes('--help')) {
  console.log(help)
  process.exit(0)
}

const version = args.find((arg) => /^\d+\.\d+\.\d+/.test(arg))
if (!version) {
  console.error('Usage: node scripts/release.mjs <version>')
  process.exit(1)
}

const dry = args.includes('--dry')
const date = new Date().toISOString().slice(0, 10)
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
pkg.version = version
const changelog = readFileSync('CHANGELOG.md', 'utf8').replace('## [Unreleased]', `## [Unreleased]\n\n## [${version}] - ${date}`)

if (dry) {
  console.log(`package.json version -> ${version}`)
  console.log(`CHANGELOG.md adds ## [${version}] - ${date}`)
  process.exit(0)
}

writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`)
writeFileSync('CHANGELOG.md', changelog)

if (args.includes('--tag')) {
  if (args.includes('--commit')) {
    execFileSync('git', ['add', 'package.json', 'CHANGELOG.md'], { stdio: 'inherit' })
    execFileSync('git', ['commit', '-m', `chore: release v${version}`], { stdio: 'inherit' })
  } else {
    try {
      execFileSync('git', ['diff', '--quiet'], { stdio: 'ignore' })
      execFileSync('git', ['diff', '--cached', '--quiet'], { stdio: 'ignore' })
    } catch {
      console.error('--tag requires a clean tree or --commit')
      process.exit(1)
    }
  }
  execFileSync('git', ['tag', '-a', `v${version}`, '-m', `v${version}`], { stdio: 'inherit' })
}

console.log(`Prepared v${version}`)
