#!/usr/bin/env node
// migration-plan.mjs — compare host setup to current Agent Compass and plan upgrade.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FILE_MANIFEST, LOCK_REL, loadSubst, renderSource, sha, acVersion } from './manifest.mjs'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))
const args = process.argv.slice(2)
const help = `Usage: node scripts/migration-plan.mjs [host-dir] [--write] [--json]`
if (args.includes('--help')) { console.log(help); process.exit(0) }
const host = resolve(args.find((a) => !a.startsWith('--')) || process.cwd())
const { subst } = loadSubst(host)
let lock = { version: '0.0.0', managed: {} }
try { lock = JSON.parse(readFileSync(join(host, LOCK_REL), 'utf8')) } catch {}
const rows = []
for (const item of FILE_MANIFEST) {
  const dest = join(host, item.dest)
  const current = renderSource(AC, item.src, subst)
  if (!existsSync(dest)) rows.push({ path: item.dest, mode: item.mode, status: 'missing', action: 'create' })
  else if (item.mode === 'seed') rows.push({ path: item.dest, mode: item.mode, status: 'host-owned', action: 'leave' })
  else {
    const hostSha = sha(readFileSync(dest, 'utf8'))
    const currentSha = sha(current)
    const lockSha = lock.managed?.[item.dest]
    rows.push({
      path: item.dest,
      mode: item.mode,
      status: hostSha === currentSha ? 'current' : lockSha && hostSha === lockSha ? 'fast-forwardable' : 'conflict-review',
      action: hostSha === currentSha ? 'none' : lockSha && hostSha === lockSha ? 'sync overwrite' : 'write .acnew',
    })
  }
}
const report = `# Agent Compass Migration Plan

Host: \`${host}\`
From: \`${lock.version || '0.0.0'}\`
To: \`${acVersion(AC)}\`

| Path | Mode | Status | Action |
| ---- | ---- | ------ | ------ |
${rows.map((r) => `| ${r.path} | ${r.mode} | ${r.status} | ${r.action} |`).join('\n')}
`
if (args.includes('--json')) console.log(JSON.stringify({ schema: 1, host, from: lock.version || '0.0.0', to: acVersion(AC), rows }, null, 2))
else if (args.includes('--write')) {
  mkdirSync(join(host, '.agent'), { recursive: true })
  writeFileSync(join(host, '.agent', 'migration-plan.md'), report)
  console.log(join(host, '.agent', 'migration-plan.md'))
} else console.log(report)
