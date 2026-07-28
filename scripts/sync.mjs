#!/usr/bin/env node
// sync.mjs — bring a host's managed agent-compass files up to date after the
// submodule moves, WITHOUT clobbering host edits.
//
//   managed file, host unchanged since last sync → fast-forward (overwrite)
//   managed file, host edited                    → write <file>.acnew, keep host
//   managed file, missing                        → create
//   seed file, missing                           → create (new since last version)
//   seed file, present                           → leave (host owns it)
//
// Then applies ordered migrations in (lock.version, current] and updates the lock.

import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { FILE_MANIFEST, LOCK_REL, loadSubst, renderSource, sha, isHook, acVersion } from './manifest.mjs'
import { parseCliArgs, resolveRoot } from './lib/args.mjs'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))

const { values, positionals } = parseCliArgs({
  name: 'sync',
  script: 'sync.mjs',
  summary: "Reconcile a host's managed agent-compass files with the current submodule.",
  positionals: [{ name: 'host-dir', required: false }],
  options: {
    dry: { type: 'boolean', desc: 'Show what would change; write nothing.' },
    check: { type: 'boolean', desc: 'Exit 1 if anything is out of date (read-only; for CI).' },
    target: { type: 'string', value: '<ver>', desc: 'Override the agent-compass version (default: package.json).' },
  },
})

const dry = Boolean(values.dry)
const check = Boolean(values.check)
const apply = !dry && !check
const HOST = resolveRoot(positionals)

if (HOST === AC) {
  console.error('Refusing to sync agent-compass into itself. Run from the host project root.')
  process.exit(1)
}

const { subst } = loadSubst(HOST)
const lockPath = join(HOST, LOCK_REL)
let lock = { version: '0.0.0', managed: {} }
try { lock = JSON.parse(readFileSync(lockPath, 'utf8')) } catch {}
lock.managed = lock.managed || {}
const currentVersion = values.target || acVersion(AC)

const cmpSemver = (a, b) => {
  const pa = String(a).split('.').map(Number)
  const pb = String(b).split('.').map(Number)
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d) return d > 0 ? 1 : -1
  }
  return 0
}

const writeFile = (path, content, srcRel) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
  if (isHook(srcRel)) chmodSync(path, 0o755)
}

const created = []
const updated = []
const conflicts = []
const seedAdded = []

for (const { src, dest, mode } of FILE_MANIFEST) {
  if (!existsSync(join(AC, src))) continue
  const dpath = join(HOST, dest)
  const rendered = renderSource(AC, src, subst)
  const newSha = sha(rendered)

  if (mode === 'seed') {
    if (!existsSync(dpath)) {
      if (apply) writeFile(dpath, rendered, src)
      created.push(dest)
      seedAdded.push(dest)
    }
    continue
  }

  // managed
  if (!existsSync(dpath)) {
    if (apply) { writeFile(dpath, rendered, src); lock.managed[dest] = newSha }
    created.push(dest)
    continue
  }
  const hostSha = sha(readFileSync(dpath, 'utf8'))
  if (hostSha === newSha) { lock.managed[dest] = newSha; continue }
  const lockSha = lock.managed[dest]
  if (lockSha && hostSha === lockSha) {
    if (apply) { writeFile(dpath, rendered, src); lock.managed[dest] = newSha }
    updated.push(dest)
  } else {
    if (apply) writeFile(`${dpath}.acnew`, rendered, src)
    conflicts.push(dest)
  }
}

// Migrations in (lock.version, current].
const migrationsDir = join(AC, 'migrations')
const migrated = []
if (existsSync(migrationsDir)) {
  const files = readdirSync(migrationsDir)
    .filter((f) => /^\d+\.\d+\.\d+.*\.mjs$/.test(f))
    .sort((a, b) => cmpSemver(a.match(/^(\d+\.\d+\.\d+)/)[1], b.match(/^(\d+\.\d+\.\d+)/)[1]))
  for (const file of files) {
    const ver = file.match(/^(\d+\.\d+\.\d+)/)[1]
    if (cmpSemver(ver, lock.version) <= 0 || cmpSemver(ver, currentVersion) > 0) continue
    migrated.push(ver)
    if (!apply) continue
    const mod = await import(pathToFileURL(join(migrationsDir, file)).href)
    const migration = mod.default || mod
    if (typeof migration.apply === 'function') {
      migration.apply({ host: HOST, log: (msg) => console.log(`  migration ${ver}: ${msg}`) })
    }
  }
}

if (apply) {
  lock.version = currentVersion
  lock.syncedAt = new Date().toISOString()
  mkdirSync(dirname(lockPath), { recursive: true })
  writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n')
}

const list = (label, items) => items.length ? `\n${label}:\n${items.map((i) => `  ${i}`).join('\n')}` : ''
const pending = created.length + updated.length + conflicts.length + migrated.length
console.log(`agent-compass sync ${dry ? '(dry) ' : check ? '(check) ' : ''}→ ${HOST}
  from version ${lock.version || '0.0.0'} to ${currentVersion}` +
  list('Created', created) +
  list(apply ? 'Updated (fast-forward)' : 'Would update', updated) +
  list('Conflicts (review the .acnew file, then merge)', conflicts.map((c) => `${c} → ${c}.acnew`)) +
  list('Migrations', migrated) +
  (pending ? '' : '\nAlready up to date.'))

if (conflicts.length) {
  console.log(`\n${conflicts.length} file(s) you edited also changed upstream. Review each \`.acnew\`, merge, delete it.`)
}

if (check && pending) {
  console.error(`\n✗ out of date — run sync (${pending} item(s) pending).`)
  process.exit(1)
}
