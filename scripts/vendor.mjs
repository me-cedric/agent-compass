#!/usr/bin/env node
// vendor.mjs — create or refresh a plain-copy vendoring of agent-compass in a
// host (the non-submodule alternative). Archives a ref of this checkout into
// the host and records provenance in .vendor.json, so "which commit is this
// copy?" never needs archaeology again.

import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))
const args = process.argv.slice(2)
const help = `Usage: node scripts/vendor.mjs <host-dir> [--ref <tag|commit>] [--dest <rel-dir>] [--dry]

Copy this agent-compass checkout (at --ref, default HEAD) into the host as
plain files, replacing any previous copy, and write <dest>/.vendor.json with
{version, ref, commit, vendoredAt}. Must run from a git checkout of
agent-compass. After vendoring, run sync to reconcile managed host files:

  node <dest>/scripts/sync.mjs <host-dir>

Options:
  --ref <ref>    Tag or commit to vendor (default: HEAD).
  --dest <dir>   Destination inside the host (default: docs/agent-compass).
  --dry          Report what would happen; write nothing.
  --help         Show this help.
`
if (args.includes('--help') || !args.length) { console.log(help); process.exit(args.length ? 0 : 1) }

const flag = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1] || null }
const ref = flag('--ref') || 'HEAD'
const destRel = flag('--dest') || 'docs/agent-compass'
const dry = args.includes('--dry')
const HOST = resolve(args.find((a) => !a.startsWith('--') && a !== ref && a !== destRel) || '')

if (!HOST || !existsSync(HOST)) { console.error(`Host directory not found: ${HOST || '(missing)'}`); process.exit(1) }

const git = (...argv) => execFileSync('git', ['-C', AC, ...argv], { encoding: 'utf8' }).trim()
let commit
try { commit = git('rev-parse', ref) } catch {
  console.error(`Not a git checkout or unknown ref "${ref}" — vendor.mjs needs a git clone of agent-compass.`)
  process.exit(1)
}

const dest = join(HOST, destRel)
if (existsSync(dest)) {
  // Only replace something that actually looks like an agent-compass copy.
  let pkgName = null
  try { pkgName = JSON.parse(readFileSync(join(dest, 'package.json'), 'utf8')).name } catch {}
  if (pkgName !== 'agent-compass') {
    console.error(`Refusing to replace ${destRel}: not an agent-compass copy (package name: ${pkgName || 'none'}).`)
    process.exit(1)
  }
}

if (dry) {
  console.log(`would vendor ${ref} (${commit.slice(0, 7)}) -> ${dest}`)
  process.exit(0)
}

rmSync(dest, { recursive: true, force: true })
mkdirSync(dest, { recursive: true })
const archive = spawnSync('sh', ['-c', `git -C "${AC}" archive ${commit} | tar -x -C "${dest}"`], { stdio: 'inherit' })
if (archive.status) { console.error('git archive failed.'); process.exit(archive.status || 1) }

const version = JSON.parse(readFileSync(join(dest, 'package.json'), 'utf8')).version
writeFileSync(join(dest, '.vendor.json'), JSON.stringify({
  schema: 1, name: 'agent-compass', version, ref, commit, vendoredAt: new Date().toISOString(),
}, null, 2) + '\n')

console.log(`vendored agent-compass ${version} (${ref} @ ${commit.slice(0, 7)}) -> ${destRel}`)
console.log(`\nNext:`)
console.log(`  node ${destRel}/scripts/sync.mjs ${HOST}     # reconcile managed host files`)
console.log(`  node ${destRel}/scripts/adopt.mjs ${HOST}    # or full refresh (reports, fit sync)`)
