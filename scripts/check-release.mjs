#!/usr/bin/env node
// check-release.mjs — fail when the release version differs between the files that carry it,
// or when CHANGELOG.md has no dated heading for it.

import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCliArgs } from './lib/args.mjs'
import { getAt, SEMVER, VERSION_FILES } from './lib/versions.mjs'

const { values, positionals } = parseCliArgs({
  name: 'check-release',
  usage: 'node scripts/check-release.mjs [root] [options]',
  summary: `Check before a release:
  - ${VERSION_FILES.map((v) => v.file).join('\n  - ')}
    carry the same version
  - CHANGELOG.md has a "## <version> — <date>" heading for it`,
  positionals: [{ name: 'root', required: false }],
  options: { root: { type: 'string', value: '<dir>', desc: 'Check another root directory.' } },
})

const ROOT = resolve(values.root || positionals[0] || dirname(dirname(fileURLToPath(import.meta.url))))
const hits = []
const read = (file) => readFileSync(join(ROOT, file), 'utf8')

const versions = VERSION_FILES.map(({ file, path }) => {
  try { return [file, getAt(JSON.parse(read(file)), path)] } catch (err) { hits.push(`${file}: ${err.message}`); return [file, null] }
})
const version = versions[0][1]
if (typeof version === 'string' && SEMVER.test(version)) {
  for (const [file, v] of versions.slice(1)) if (v !== null && v !== version) hits.push(`${file}: version ${JSON.stringify(v)} is not ${version}`)
  const heading = new RegExp(`^## ${version.replace(/[.+]/g, '\\$&')} — \\d{4}-\\d{2}-\\d{2}$`, 'm')
  try {
    if (!heading.test(read('CHANGELOG.md'))) hits.push(`CHANGELOG.md: no heading "## ${version} — <date>"`)
  } catch (err) { hits.push(`CHANGELOG.md: ${err.message}`) }
} else if (version !== null) hits.push(`package.json: invalid version ${JSON.stringify(version)}`)

if (hits.length) {
  console.error(`✗ ${hits.length} release issue(s):\n`)
  hits.forEach((hit) => console.error(`  ${hit}`))
  process.exit(1)
}
console.log(`✓ release check passed — ${versions.length} files carry ${version} and CHANGELOG.md has its heading.`)
