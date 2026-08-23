#!/usr/bin/env node
// release.mjs — bump package.json + changelog + readme; tag, push, and publish after validation if requested.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { parseCliArgs } from './lib/args.mjs'
import { changelogSection } from './lib/changelog.mjs'

// git@host:owner/repo.git and https://host/owner/repo.git both yield owner/repo.
const repoSlug = (remote) => {
  const url = execFileSync('git', ['remote', 'get-url', remote], { encoding: 'utf8' }).trim()
  return url.match(/[:/]([^/:]+\/[^/]+?)(?:\.git)?$/)?.[1] ?? null
}

const releaseExists = (slug, tag) => {
  try {
    execFileSync('gh', ['release', 'view', tag, '--repo', slug], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

const { values, positionals } = parseCliArgs({
  name: 'release',
  script: 'release.mjs',
  summary: 'Bump package.json, CHANGELOG.md, and README.md from Unreleased to a dated release section.',
  positionals: [{ name: 'version', required: true }],
  options: {
    commit: { type: 'boolean', desc: 'Commit package.json, CHANGELOG.md, and README.md.' },
    tag: { type: 'boolean', desc: 'Create annotated v<version> tag. Requires --commit or clean tree.' },
    push: { type: 'boolean', desc: 'Push HEAD and the v<version> tag to every configured remote. Requires --tag.' },
    release: { type: 'boolean', desc: 'Publish the forge release on every remote after pushing. Implies --push.' },
    dry: { type: 'boolean', desc: 'Print changes, do not write, commit, tag, push, or publish.' },
  },
})

const version = positionals[0]
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error('Usage: node scripts/release.mjs <version>')
  process.exit(1)
}

const push = Boolean(values.push || values.release)
if (push && !values.tag) {
  console.error(`${values.release ? '--release' : '--push'} requires --tag`)
  process.exit(1)
}

const dry = Boolean(values.dry)
const date = new Date().toISOString().slice(0, 10)
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
const previous = pkg.version
pkg.version = version
// Idempotent: a second run for the same version must not insert a second (and
// empty) section heading, because `changelogSection` would then match the empty
// one and every forge release would get a placeholder body instead of the notes.
const changelogSource = readFileSync('CHANGELOG.md', 'utf8')
const alreadyReleased = new RegExp(`^## \\[${version.replace(/\./g, '\\.')}\\]`, 'm').test(changelogSource)
const changelog = alreadyReleased
  ? changelogSource
  : changelogSource.replace('## [Unreleased]', `## [Unreleased]\n\n## [${version}] - ${date}`)
// check-release.mjs requires both markers to match package.json, so bump them here.
const readme = readFileSync('README.md', 'utf8')
  .replaceAll(`version-v${previous}`, `version-v${version}`)
  .replaceAll(`Current version: \`${previous}\``, `Current version: \`${version}\``)

if (dry) {
  console.log(`package.json version -> ${version}`)
  console.log(alreadyReleased
    ? `CHANGELOG.md already has ## [${version}] — left as is`
    : `CHANGELOG.md adds ## [${version}] - ${date}`)
  console.log(`README.md version markers ${previous} -> ${version}`)
  process.exit(0)
}

writeFileSync('package.json', `${JSON.stringify(pkg, null, 2)}\n`)
writeFileSync('CHANGELOG.md', changelog)
writeFileSync('README.md', readme)

if (values.tag) {
  if (values.commit) {
    execFileSync('git', ['add', 'package.json', 'CHANGELOG.md', 'README.md'], { stdio: 'inherit' })
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

if (push) {
  const remotes = execFileSync('git', ['remote'], { encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  if (remotes.length === 0) {
    console.error('--push found no git remote')
    process.exit(1)
  }
  for (const remote of remotes) {
    execFileSync('git', ['push', remote, 'HEAD'], { stdio: 'inherit' })
    execFileSync('git', ['push', remote, `v${version}`], { stdio: 'inherit' })
    console.log(`pushed HEAD and v${version} to ${remote}`)
  }

  if (values.release) {
    try {
      execFileSync('gh', ['--version'], { stdio: 'ignore' })
    } catch {
      console.error(`gh not found. Publish each release by hand: gh release create v${version} --repo <owner/repo>`)
      process.exit(1)
    }
    const notes = changelogSection(readFileSync('CHANGELOG.md', 'utf8'), version)
    // Two remotes can address one repository, so publish once per repository.
    const slugs = [...new Set(remotes.map(repoSlug).filter(Boolean))]
    if (slugs.length === 0) {
      console.error('--release found no repository slug in the remote URLs')
      process.exit(1)
    }
    for (const slug of slugs) {
      if (releaseExists(slug, `v${version}`)) {
        console.log(`release v${version} already exists on ${slug}`)
        continue
      }
      execFileSync('gh', ['release', 'create', `v${version}`, '--repo', slug, '--title', `v${version}`, '--notes-file', '-'], {
        input: notes,
        stdio: ['pipe', 'inherit', 'inherit'],
      })
      console.log(`published release v${version} on ${slug}`)
    }
  }
}

console.log(`Prepared v${version}`)
