// sync.mjs — compare the plan with the host and the lock, then write the changes.
//
// For each managed file, owned key and owned block:
//   missing                         → create
//   same as the plan                → no change
//   same as the lock (not edited)   → update
//   edited                          → keep it and report it
// For each lock entry that the plan no longer has: not edited → remove; edited → release (keep it, drop it from the lock).
// Seed files are written once and then belong to the project.

import { chmodSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { CONFIG, DEFAULT_CONFIG, konvoyOwns, loadConfig, loadKonvoy, LOCK, ownershipErrors, resolvePaths } from './config.mjs'
import { tagOf } from './git.mjs'
import { blockFind, blockInner, blockRemove, blockSet, jsonDelete, jsonGet, jsonSet, tomlDelete, tomlGet, tomlRender, tomlSet } from './merge.mjs'
import { buildPlan } from './plan.mjs'
import { fetchUpstream } from './upstream.mjs'
import { isObj, readJson, safeRel, sha, sorted } from './util.mjs'

export { LOCK }
const EMPTY_LOCK = { skills: [], files: {}, keys: {}, blocks: {} }

export const readLock = (root) => {
  if (!existsSync(join(root, LOCK))) return { lock: EMPTY_LOCK, errors: [] }
  let data
  try { data = JSON.parse(readFileSync(join(root, LOCK), 'utf8')) } catch (err) { return { lock: EMPTY_LOCK, errors: [`${LOCK}: ${err.message}`] } }
  if (!isObj(data) || data.lockVersion !== 2) return { lock: EMPTY_LOCK, errors: [`${LOCK}: unknown lock format; lockVersion 2 is necessary`] }
  const lock = { ...EMPTY_LOCK, ...data }
  const shapeOk = Array.isArray(lock.skills) && isObj(lock.files) && isObj(lock.keys) && isObj(lock.blocks) &&
    Object.values(lock.files).every((f) => isObj(f) && typeof f.sha === 'string' && ['compass', 'project'].includes(f.owner)) &&
    Object.values(lock.keys).every(isObj)
  if (!shapeOk) return { lock: EMPTY_LOCK, errors: [`${LOCK}: the lock has an incorrect shape`] }
  const unsafe = [...Object.keys(lock.files), ...Object.keys(lock.keys), ...Object.keys(lock.blocks)].filter((p) => !safeRel(p))
  return { lock, errors: unsafe.map((p) => `${LOCK}: the path "${p}" is not inside the project`) }
}

export const reconcile = (root, plan, lock) => {
  const changes = []
  const errors = []
  const writes = new Map()
  const note = (action, path, key) => changes.push(key ? { action, path, key } : { action, path })
  const read = (rel) => {
    const st = statSync(join(root, rel), { throwIfNoEntry: false })
    if (st && !st.isFile()) throw new Error(`${rel} is not a regular file`)
    return st ? readFileSync(join(root, rel)) : null
  }
  // A path that the plan gives to another mechanism leaves the lock here, without a write.
  const claimed = (rel) => plan.files.has(rel) || plan.keys.has(rel) || plan.blocks.has(rel)

  const files = {}
  for (const [rel, want] of plan.files) {
    const prev = lock.files[rel]
    const have = read(rel)
    const wantSha = sha(want.content)
    if (want.mode === 'seed') {
      if (prev) files[rel] = { ...prev, owner: 'project' }
      else if (have) files[rel] = { sha: sha(have), owner: 'project' }
      else { writes.set(rel, want); files[rel] = { sha: wantSha, owner: 'project' }; note('seed', rel) }
      continue
    }
    const haveSha = have && sha(have)
    if (haveSha === wantSha) files[rel] = { sha: wantSha, owner: 'compass' }
    else if (!have || (prev?.owner === 'compass' && prev.sha === haveSha)) {
      writes.set(rel, want)
      files[rel] = { sha: wantSha, owner: 'compass' }
      note(have ? 'update' : 'create', rel)
    } else {
      if (prev) files[rel] = prev
      note('kept', rel)
    }
  }
  for (const [rel, prev] of Object.entries(lock.files)) {
    if (plan.files.has(rel) || prev.owner !== 'compass') continue
    if (plan.held?.some((p) => rel.startsWith(p))) { files[rel] = prev; continue }
    // A file that Konvoy owns now leaves the lock and stays on disk.
    if (claimed(rel) || plan.released?.(rel)) { note('release', rel); continue }
    const have = read(rel)
    if (!have) continue
    if (sha(have) === prev.sha) { writes.set(rel, null); note('remove', rel) } else note('release', rel)
  }

  for (const file of Object.keys(lock.keys)) if (!plan.keys.has(file) && claimed(file)) note('release', file, 'keys')
  for (const file of Object.keys(lock.blocks)) if (!plan.blocks.has(file) && claimed(file)) note('release', file, 'block')

  const keys = {}
  for (const file of new Set([...plan.keys.keys(), ...Object.keys(lock.keys).filter((f) => !claimed(f))])) {
    // A file that Konvoy took: compass writes nothing there, and the lock drops its keys (rule 8).
    if (plan.released?.(file)) { if (lock.keys[file]) note('release', file); continue }
    const want = plan.keys.get(file) || new Map()
    const prev = lock.keys[file] || {}
    const toml = file.endsWith('.toml')
    const raw = read(file)?.toString('utf8') || ''
    const doc0 = toml || raw.trim() ? raw : '{}\n'
    if (!toml) {
      let data
      try { data = JSON.parse(doc0) } catch (err) { errors.push(`${file}: ${err.message}`); continue }
      if (!isObj(data)) { errors.push(`${file}: the file must hold a JSON object`); continue }
    }
    let doc = doc0
    const current = (k) => {
      const v = toml ? tomlGet(doc, k) : jsonGet(JSON.parse(doc), k)
      return v === undefined ? null : sha(toml ? v : JSON.stringify(v))
    }
    const next = {}
    let changed = false
    try {
      for (const [k, v] of want) {
        const cur = current(k)
        const target = sha(toml ? tomlRender(k, v) : JSON.stringify(v))
        if (cur === target) next[k] = target
        else if (cur === null || cur === prev[k]) {
          doc = toml ? tomlSet(doc, k, v) : jsonSet(doc, k, v)
          changed = true
          next[k] = target
          note(cur === null ? 'create' : 'update', file, k)
        } else {
          if (prev[k]) next[k] = prev[k]
          note('kept', file, k)
        }
      }
    } catch (err) { errors.push(`${file}: ${err.message}`); continue }
    for (const [k, was] of Object.entries(prev)) {
      const cur = want.has(k) ? null : current(k)
      if (cur === null) continue
      if (cur !== was) { note('release', file, k); continue }
      doc = toml ? tomlDelete(doc, k) : jsonDelete(doc, k)
      changed = true
      note('remove', file, k)
    }
    if (changed) writes.set(file, { content: Buffer.from(doc) })
    if (Object.keys(next).length) keys[file] = next
  }

  const blocks = {}
  for (const file of new Set([...plan.blocks.keys(), ...Object.keys(lock.blocks).filter((f) => !claimed(f))])) {
    if (plan.released?.(file)) { if (lock.blocks[file]) note('release', file, 'block'); continue }
    const body = plan.blocks.get(file)
    const raw = read(file)?.toString('utf8') ?? null
    let found
    try { found = raw === null ? null : blockFind(raw) } catch (err) { errors.push(`${file}: ${err.message}`); continue }
    const cur = found ? sha(found.inner) : null
    const prev = lock.blocks[file]
    if (body === undefined) {
      if (cur === null) continue
      if (cur === prev) { writes.set(file, { content: Buffer.from(blockRemove(raw)) }); note('remove', file, 'block') } else note('release', file, 'block')
      continue
    }
    const target = sha(blockInner(body))
    if (cur === target) blocks[file] = target
    else if (cur === null || cur === prev) {
      writes.set(file, { content: Buffer.from(blockSet(raw || '', body)) })
      blocks[file] = target
      note(cur === null ? 'create' : 'update', file, 'block')
    } else {
      if (prev) blocks[file] = prev
      note('kept', file, 'block')
    }
  }

  const lockText = `${JSON.stringify({
    lockVersion: 2,
    version: plan.version,
    tag: plan.tag,
    skills: [...plan.skills].sort(),
    files: sorted(files),
    keys: sorted(keys),
    blocks: sorted(blocks),
  }, null, 2)}\n`
  return { changes, errors, writes, lockText, lockChanged: read(LOCK)?.toString('utf8') !== lockText }
}

export const prune = (root, dir) => {
  while (dir.startsWith(`${root}/`) && existsSync(dir) && !readdirSync(dir).length) {
    rmdirSync(dir)
    dir = dirname(dir)
  }
}

// Refuse a write or a delete through a symlink, or below a parent that resolves outside the root.
export const outside = (root, rel) => {
  const abs = join(root, rel)
  if (lstatSync(abs, { throwIfNoEntry: false })?.isSymbolicLink()) return true
  let dir = dirname(abs)
  while (!existsSync(dir)) dir = dirname(dir)
  const top = realpathSync(root)
  const real = realpathSync(dir)
  return real !== top && !real.startsWith(`${top}/`)
}

const applyWrites = (root, writes, lockText) => {
  for (const [rel, w] of writes) {
    const abs = join(root, rel)
    if (w === null) { rmSync(abs, { force: true }); prune(root, dirname(abs)); continue }
    mkdirSync(dirname(abs), { recursive: true })
    writeFileSync(abs, w.content)
    if (w.exec) chmodSync(abs, 0o755)
  }
  if (lockText) {
    mkdirSync(dirname(join(root, LOCK)), { recursive: true })
    writeFileSync(join(root, LOCK), lockText)
  }
}

const steps = ({ AC, root, apply, init }, version, tag) => {
  const cfg = loadConfig(root, AC, { init })
  const kv = loadKonvoy(root)
  const lk = readLock(root)
  const early = [...cfg.errors, ...kv.errors, ...lk.errors]
  if (early.length) return { errors: early }

  const { paths, from, warnings } = resolvePaths(cfg.config, kv.konvoy)
  const fetched = apply ? fetchUpstream(AC, cfg.config.upstream) : []
  const built = buildPlan({ AC, root, config: cfg.config, paths, konvoy: Boolean(kv.konvoy) })
  // Rule 6: a file that Konvoy owns as a whole gets no compass key and no compass block. Compass leaves them out.
  const whole = kv.konvoy ? [...new Set([...built.keys.keys(), ...built.blocks.keys()])].filter((rel) => konvoyOwns(kv.konvoy, rel)) : []
  const keep = ([rel]) => !whole.includes(rel)
  const plan = { ...built, keys: new Map([...built.keys].filter(keep)), blocks: new Map([...built.blocks].filter(keep)) }
  const left = whole.map((rel) => `${rel} belongs to Konvoy as a whole file; compass leaves its keys and blocks to Konvoy`)
  const out = { paths, pathsFrom: from, warnings: [...warnings, ...fetched, ...built.warnings, ...left], stacks: plan.stacks }
  const planErrors = [...plan.errors, ...ownershipErrors(plan, lk.lock, kv.konvoy)]
  if (planErrors.length) return { ...out, errors: planErrors }

  const released = kv.konvoy && ((rel) => konvoyOwns(kv.konvoy, rel))
  // No tag data (a CI clone without git or tags) is not a tag change: keep the lock tag.
  const rec = reconcile(root, { ...plan, version, tag: tag ?? lk.lock.tag ?? null, released }, lk.lock)
  if (rec.errors.length) return { ...out, errors: rec.errors, changes: rec.changes }
  const configWrite = cfg.created ? [[CONFIG, { content: Buffer.from(`${JSON.stringify(DEFAULT_CONFIG, null, 2)}\n`) }]] : []
  const writes = new Map([...configWrite, ...rec.writes])
  const changes = [...configWrite.map(([path]) => ({ action: 'create', path })), ...rec.changes]
  const drift = writes.size > 0 || rec.lockChanged || changes.some((c) => c.action === 'kept')
  const unsafe = [...writes.keys(), ...(rec.lockChanged ? [LOCK] : [])].filter((rel) => outside(root, rel))
  if (unsafe.length) return { ...out, changes, errors: unsafe.map((rel) => `${rel} is a symlink or leaves the project root; compass does not write it`) }
  if (apply) applyWrites(root, writes, rec.lockChanged && rec.lockText)
  return { ...out, ok: true, changes, drift }
}

// One pass for init, sync and check. apply=false writes nothing.
export const syncHost = ({ AC, root, apply = false, init = false }) => {
  const version = readJson(join(AC, 'package.json'))?.version || '0.0.0'
  const tag = tagOf(AC)
  const base = { ok: false, version, tag, errors: [], warnings: [], changes: [], drift: false, paths: {}, pathsFrom: null, stacks: [] }
  try {
    return { ...base, ...steps({ AC, root, apply, init }, version, tag) }
  } catch (err) {
    return { ...base, errors: [err.message] }
  }
}
