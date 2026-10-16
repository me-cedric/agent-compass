#!/usr/bin/env node
// release.mjs — set the release version in every file that carries it and add a CHANGELOG heading.
// It never commits, tags or pushes. Run it in the repository root: npm run release -- <version>
// When a last tag exists, the new heading gets the asset files that changed since that tag, grouped as added, changed and removed.

import { readFileSync, writeFileSync } from 'node:fs'
import { run } from '../engine/util.mjs'
import { parseCliArgs } from './lib/args.mjs'
import { SEMVER, setAt, VERSION_FILES } from './lib/versions.mjs'

const { values, positionals } = parseCliArgs({
  name: 'release',
  script: 'release.mjs',
  summary: `Set <version> in ${VERSION_FILES.map((v) => v.file).join(', ')}.
Add a "## <version> — <date>" heading to CHANGELOG.md, with the asset files that changed since the last tag.
Commit, tag and push by hand.`,
  positionals: [{ name: 'version', required: true }],
  options: { dry: { type: 'boolean', desc: 'Print the changes. Write nothing.' } },
})

const version = positionals[0]
if (!SEMVER.test(version ?? '')) {
  console.error('Usage: node scripts/release.mjs <version>  (for example 1.0.1)')
  process.exit(1)
}

const ASSETS = /^(core|skills|packs|rules|mcp)\/|^upstream\.json$/
const GROUPS = { A: 'Added', M: 'Changed', D: 'Removed' }

// The asset files that changed since the last tag. Empty text when there is no tag or git fails.
const assetNote = () => {
  const last = run('git', ['describe', '--tags', '--abbrev=0'], { timeout: 10_000 })
  if (!last.ok || !last.out) return ''
  const diff = run('git', ['diff', '--name-status', '--no-renames', `${last.out}..HEAD`], { timeout: 10_000 })
  if (!diff.ok) return ''
  const rows = diff.out.split('\n').map((line) => line.split('\t')).filter(([, path]) => ASSETS.test(path ?? ''))
  const groupOf = (status) => GROUPS[status[0]] ?? 'Changed'
  const lines = Object.values(GROUPS).map((group) => [group, rows.filter(([status]) => groupOf(status) === group).map(([, path]) => path)])
    .filter(([, paths]) => paths.length).map(([group, paths]) => `- ${group}: ${paths.join(', ')}`)
  return lines.length ? `Asset changes since ${last.out}:\n\n${lines.join('\n')}\n\n` : ''
}

const date = new Date().toISOString().slice(0, 10)
const heading = new RegExp(`^## ${version.replace(/[.+]/g, '\\$&')} — `, 'm')
const changelog = readFileSync('CHANGELOG.md', 'utf8')
const writes = VERSION_FILES.map(({ file, path }) => {
  const json = JSON.parse(readFileSync(file, 'utf8'))
  setAt(json, path, version)
  return [file, `${JSON.stringify(json, null, 2)}\n`]
})
if (heading.test(changelog)) console.log(`CHANGELOG.md has a heading for ${version}: left as it is`)
else {
  const note = assetNote()
  const next = changelog.replace(/^(# .*\r?\n)(\r?\n)?/, (_, title) => `${title}\n## ${version} — ${date}\n\n${note}`)
  if (next === changelog) {
    console.error('CHANGELOG.md must start with a "# " title line. Add it, then run the release again.')
    process.exit(1)
  }
  writes.push(['CHANGELOG.md', next])
}

for (const [file, text] of writes) {
  if (!values.dry) writeFileSync(file, text)
  console.log(`${values.dry ? 'would write' : 'wrote'} ${file}`)
}
console.log(`${values.dry ? 'Checked' : 'Prepared'} ${version}. Commit, tag and push by hand.`)
