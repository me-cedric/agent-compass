#!/usr/bin/env node
// check-update.mjs — cheap, cached, zero-LLM-token "is agent-compass behind?"
// notice. Offline by default (reuses sync --check); --remote also compares the
// vendored version to the newest upstream tag and checks external skill pins.
// Safe to call from a git hook:
// it prints to the terminal, never into an agent's context, and a 24h cache
// keeps repeated calls effectively free. Silent when current (with --quiet).

import { spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { acVersion } from './manifest.mjs'
import { parseCliArgs, resolveRoot } from './lib/args.mjs'
import { installDrift } from './lib/external-install.mjs'
import { readSourceRegistry } from './lib/upstream-sources.mjs'

const { values, positionals } = parseCliArgs({
  name: 'check-update',
  script: 'check-update.mjs',
  summary: "Report whether the host's agent-compass files are behind. Cached for 24h.",
  positionals: [{ name: 'host', required: false }],
  options: {
    remote: { type: 'boolean', desc: 'Also check the newest Agent Compass tag and all external skill sources.' },
    force: { type: 'boolean', desc: 'Ignore the cache and re-check now.' },
    quiet: { type: 'boolean', desc: 'Print nothing when up to date (still prints when behind).' },
    strict: { type: 'boolean', desc: 'Exit 1 when an update is available.' },
  },
})

const AC = dirname(dirname(fileURLToPath(import.meta.url)))
const HOST = resolveRoot(positionals)
const remote = Boolean(values.remote)
const force = Boolean(values.force)
const quiet = Boolean(values.quiet)
const strict = Boolean(values.strict)
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
const cacheCoversMode = !remote || cache?.remote === true
const isFresh = cache && cacheCoversMode && cache.lastCheck && Date.parse(cache.lastCheck) > Date.now() - TTL_MS

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

  // Offline and cheap: an install this host made is a snapshot of a pin. When the
  // compass pin has since moved, the installed text is stale — and for the
  // operational corpus that includes the safety gate and the argv-secret
  // narrowings, so it is worth a session-start notice rather than silence.
  try {
    const drift = installDrift(HOST, readSourceRegistry(AC))
    if (drift.stale.length) {
      behind = true
      const gated = drift.stale.filter((item) => item.adapter === 'operational').length
      const names = drift.stale.map((item) => item.id).join(', ')
      messages.push(`${drift.stale.length} external skill install(s) behind their pin (${names})${gated ? ' — safety corrections regenerated since' : ''} — run: external-skills . --upgrade`)
    }
  } catch {}

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

    const sourceArgs = [join(AC, 'scripts', 'upstream-skills.mjs'), AC, '--check-updates', '--json']
    if (force) sourceArgs.push('--force')
    const sourceCheck = spawnSync(process.execPath, sourceArgs, { encoding: 'utf8' })
    if (sourceCheck.status === 0) {
      try {
        const sourceResult = JSON.parse(sourceCheck.stdout)
        if (sourceResult.updates?.length) {
          behind = true
          const names = sourceResult.updates.map((item) => item.id).join(', ')
          messages.push(`${sourceResult.updates.length} external skill source(s) behind (${names}) — run upstream-skills --update <source|all>`)
        }
      } catch {
        messages.push('(external skill check skipped: invalid result)')
      }
    } else {
      messages.push('(external skill check skipped: command failed)')
    }
  }

  result = { lastCheck: new Date().toISOString(), remote, behind, message: messages.join('; ') || 'up to date' }
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
