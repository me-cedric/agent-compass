#!/usr/bin/env node
// check-update.mjs — cheap, cached, zero-LLM-token "is agent-compass behind?"
// notice. Offline by default (reuses sync --check); --remote also compares the
// vendored version to the newest upstream tag. Safe to call from a git hook:
// it prints to the terminal, never into an agent's context, and a 24h cache
// keeps repeated calls effectively free. Silent when current (with --quiet).

import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { acVersion } from './manifest.mjs'

const help = `Usage: node scripts/check-update.mjs [host] [--remote] [--force] [--quiet] [--strict]

Report whether the host's agent-compass files are behind. Cached for 24h.

Options:
  --remote   Also compare the vendored version to the newest upstream git tag.
  --force    Ignore the cache and re-check now.
  --quiet    Print nothing when up to date (still prints when behind).
  --strict   Exit 1 when an update is available.
  --help     Show this help.
`

const args = process.argv.slice(2)
if (args.includes('--help')) { console.log(help); process.exit(0) }

const AC = dirname(dirname(fileURLToPath(import.meta.url)))
const HOST = resolve(args.find((a) => !a.startsWith('--')) || process.cwd())
const remote = args.includes('--remote')
const force = args.includes('--force')
const quiet = args.includes('--quiet')
const strict = args.includes('--strict')
const TTL_MS = 24 * 60 * 60 * 1000
const cachePath = join(HOST, '.agent', '.update-check.json')

const cmpSemver = (a, b) => {
  const pa = String(a).split('.').map(Number)
  const pb = String(b).split('.').map(Number)
  for (let i = 0; i < 3; i++) { const d = (pa[i] || 0) - (pb[i] || 0); if (d) return d > 0 ? 1 : -1 }
  return 0
}

const readCache = () => { try { return JSON.parse(readFileSync(cachePath, 'utf8')) } catch { return null } }
const cache = readCache()
const isFresh = cache && cache.lastCheck && Date.parse(cache.lastCheck) > Date.now() - TTL_MS

let result
if (!force && isFresh) {
  result = cache
} else {
  const messages = []
  let behind = false

  if (HOST !== AC) {
    const drift = spawnSync(process.execPath, [join(AC, 'scripts', 'sync.mjs'), HOST, '--check'], { encoding: 'utf8' })
    if (drift.status === 1) {
      behind = true
      const count = (drift.stderr || '').match(/\((\d+) item/)
      const syncCmd = relative(HOST, join(AC, 'scripts', 'sync.mjs')) || 'scripts/sync.mjs'
      messages.push(`${count ? count[1] : 'some'} managed file(s) behind — run: node ${syncCmd} .`)
    }
  }

  if (remote) {
    const ls = spawnSync('git', ['-C', AC, 'ls-remote', '--tags', '--refs', 'origin'], { encoding: 'utf8' })
    if (ls.status === 0) {
      const tags = [...(ls.stdout || '').matchAll(/refs\/tags\/v?(\d+\.\d+\.\d+)/g)].map((m) => m[1]).sort(cmpSemver)
      const latest = tags[tags.length - 1]
      const current = acVersion(AC)
      if (latest && cmpSemver(latest, current) > 0) {
        behind = true
        messages.push(`upstream ${latest} available (vendored ${current}) — run upgrade-host`)
      }
    } else {
      messages.push('(remote check skipped: git ls-remote failed)')
    }
  }

  result = { lastCheck: new Date().toISOString(), behind, message: messages.join('; ') || 'up to date' }
  try {
    mkdirSync(dirname(cachePath), { recursive: true })
    writeFileSync(cachePath, JSON.stringify(result, null, 2) + '\n')
  } catch {}
}

if (result.behind) {
  console.log(`agent-compass update available: ${result.message}`)
} else if (!quiet) {
  const note = HOST === AC && !remote ? ' (source repo; use --remote to check upstream)' : ''
  console.log(`✓ agent-compass up to date${note}`)
}

if (strict && result.behind) process.exit(1)
