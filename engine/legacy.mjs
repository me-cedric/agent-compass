// legacy.mjs — `ac migrate` without --docs: move a host from a compass 0.4–0.9 install to the 1.0 layout.
// The end state is a clean `ac check --frozen`. Compass 1.0 does not manage a skill, file, key or block that Konvoy owns,
// and it does not overwrite a host value that differs from the compass value. Both go into "exclude" of compass.json.
// The 0.x lock holds the hash of each managed file. A skill copy, a vendored copy and a pointer file have no record:
// compass proves them against the git blobs of the local v0.* tags of the compass checkout.
//   same bytes as 0.x            → delete (apply only)
//   edited, 1.0 writes the path  → move to migrated/<path>; merge it by hand
//   edited, 1.0 does not         → keep it and list it
// Compass never follows a symlink. It never touches a seed, a Konvoy path or a file of the 1.0 lock.

import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { CONFIG, DEFAULT_CONFIG, KONVOY, konvoyOwns, loadConfig, loadKonvoy, LOCK, resolvePaths } from './config.mjs'
import { MIGRATED } from './migrate.mjs'
import { buildPlan } from './plan.mjs'
import { outside, prune, readLock, syncHost } from './sync.mjs'
import { loadUpstream } from './upstream.mjs'
import { dirs, isDir, isObj, readJson, run, safeRel, sha } from './util.mjs'

export const OLD_LOCK = '.agent/agent-compass.lock'
const ANSWERS = 'agent-compass.answers.json'
const SKILL_ROOTS = ['.claude/skills', '.agents/skills']
const SKIP = new Set(['node_modules', '.git', MIGRATED])
const NOTES = { konvoy: 'Konvoy owns it', symlink: 'a symlink; compass does not follow it', edited: 'edited 0.x file; review', unedited: 'unedited file in an edited skill dir; review' }

// The pointer files that install.mjs of compass 0.9 wrote when they were missing.
const tool = (label) => (n, a) => `# ${n} — ${label} Agent Guide\n\nRead \`${a}/AGENTS.md\` first. It is the canonical agent-compass contract.\n\nHost project \`AGENTS.md\` takes precedence when it adds project-specific rules.\n`
const POINTERS = {
  'AGENTS.md': (n, a) => [
    `# ${n} — Agent Guide`, '', 'This project follows the shared **agent-compass** contract.', '',
    `- Read \`${a}/AGENTS.md\` first — it is the canonical agent contract.`,
    `- Guidelines: \`${a}/docs/guidelines/\` · Architecture: \`${a}/docs/architecture/\` · Tooling: \`${a}/docs/tooling/\``,
    `- Skills: \`${a}/skills/\` · Templates: \`${a}/templates/\``,
    `- Knowledge: \`${a}/knowledge/\` — instincts and worked examples.`, '',
    'Add project-specific conventions below this line; they take precedence over the\nagent-compass baseline on conflict.', '',
  ].join('\n'),
  'CLAUDE.md': tool('Claude'),
  'CODEX.md': tool('Codex'),
  'GEMINI.md': tool('Gemini'),
  '.github/copilot-instructions.md': tool('GitHub Copilot'),
}

const blobId = (buf) => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex')
const within = (child, parent) => `${realpathSync(child)}/`.startsWith(`${realpathSync(parent)}/`)
const files = (root, dir) => readdirSync(join(root, dir), { withFileTypes: true }).filter((e) => e.name !== '.DS_Store')
  .flatMap((e) => (e.isDirectory() ? files(root, `${dir}/${e.name}`) : [`${dir}/${e.name}`]))

// Path in the compass tree → Set of blob ids, over every local v0.* tag.
const knownBlobs = (AC, warnings) => {
  const known = new Map()
  const tags = run('git', ['-C', AC, 'for-each-ref', '--format=%(refname:short)', 'refs/tags/v0.*'], { timeout: 10_000 })
  for (const tag of tags.ok ? tags.out.split('\n').filter(Boolean) : []) {
    const tree = run('git', ['-C', AC, 'ls-tree', '-rz', tag], { timeout: 20_000 })
    if (!tree.ok) { warnings.push(`tag ${tag}: the tree is not readable (${tree.err.split('\n')[0]})`); continue }
    for (const rec of tree.out.split('\0')) {
      const m = /^\d+ blob ([0-9a-f]+)\t([\s\S]+)$/.exec(rec)
      if (m) known.set(m[2], (known.get(m[2]) || new Set()).add(m[1]))
    }
  }
  return known
}

const submodule = (root) => {
  const text = existsSync(join(root, '.gitmodules')) ? readFileSync(join(root, '.gitmodules'), 'utf8') : ''
  for (const block of text.split(/^\[submodule/m).slice(1)) {
    const path = /^\s*path\s*=\s*(.+?)\s*$/m.exec(block)?.[1]
    const url = /^\s*url\s*=\s*(.+?)\s*$/m.exec(block)?.[1]
    if (path && url?.includes('agent-compass')) return { path, url: url.replace(/\/\/[^/@]*@/, '//') }
  }
  return null
}

// Dirs (3 levels deep) that hold the .vendor.json of vendor.mjs.
const vendored = (root, dir = '', depth = 3) => {
  const meta = dir && readJson(join(root, dir, '.vendor.json'))
  if (isObj(meta) && meta.name === 'agent-compass' && meta.schema === 1) return [{ path: dir, version: meta.version ?? null, commit: meta.commit ?? null }]
  if (!depth) return []
  return dirs(join(root, dir)).filter((n) => !SKIP.has(n)).flatMap((n) => vendored(root, dir ? `${dir}/${n}` : n, depth - 1))
}

// The answers of `ac init` in 0.x → the first compass.json. Null when the file is not a regular file with a JSON object.
const answersConfig = (root) => {
  if (!lstatSync(join(root, ANSWERS), { throwIfNoEntry: false })?.isFile()) return null
  const a = readJson(join(root, ANSWERS))
  if (!isObj(a)) return null
  const packs = [a.ci === 'github-actions' && 'ci-github', a.ci === 'gitlab-ci' && 'ci-gitlab', (a.sonar === true || a.security === true) && 'security'].filter(Boolean)
  return { answers: a, config: { ...DEFAULT_CONFIG, packs, ...(a.codeIntelligence === 'codebase-memory' ? { mcp: ['codebase-memory'] } : {}) } }
}

// A legacy path → { path, class, action }; null when nothing is there. proven(buf) says that the bytes are 0.x compass content.
const classify = (ctx, path, proven) => {
  const st = lstatSync(join(ctx.root, path), { throwIfNoEntry: false })
  if (!st || [CONFIG, LOCK].includes(path) || ctx.owned[path]?.owner === 'compass') return null
  const item = (cls, action) => ({ path, class: cls, action })
  if (ctx.konvoy && konvoyOwns(ctx.konvoy, path)) return item('konvoy', 'keep')
  if (st.isSymbolicLink() || outside(ctx.root, path)) return item('symlink', 'keep')
  if (st.isFile() && proven(readFileSync(join(ctx.root, path)))) return item('unedited', 'delete')
  return st.isFile() && ctx.claimed.has(path) ? item('edited-claimed', 'move') : item('edited', 'keep')
}

// The files below a dir. With `whole`, one edited file makes the dir edited: its unedited files stay unless 1.0 rewrites them.
const group = (ctx, dir, match, whole) => {
  const items = files(ctx.root, dir).map((p) => classify(ctx, p, (buf) => match(p.slice(dir.length + 1), buf))).filter(Boolean)
  const mixed = whole && items.some((i) => i.class !== 'unedited')
  if (mixed) ctx.warnings.push(`${dir} holds a file that is not 0.x compass content; review the dir`)
  return items.map((i) => (mixed && i.class === 'unedited' && !ctx.claimed.has(i.path) ? { ...i, action: 'keep' } : i))
}

// A skill dir with a licence file in a 0.x tag is a third-party copy: compass never deletes or moves it.
// The note names the upstream source that lists the skill, if there is one.
const thirdParty = (AC, known) => {
  const { sources } = loadUpstream(AC)
  const source = (name) => Object.entries(sources).find(([id, s]) => s.skills.some((e) => (e === '.' ? id : basename(e)) === name))?.[0]
  return new Map([...known.keys()].flatMap((p) => /^skills\/([^/]+)\/(LICEN[CS]E|COPYING)([.-][\w.-]+)?$/i.exec(p)?.[1] ?? []).map((name) => [name,
    source(name) ? `third-party skill; enable the upstream source ${source(name)} in .agents/compass.json to manage it with compass` : 'third-party skill; keep or remove it by hand']))
}

// A skill root that is a symlink is listed and not walked.
const skillItems = (ctx, known, names) => SKILL_ROOTS.flatMap((base) => {
  if (lstatSync(join(ctx.root, base), { throwIfNoEntry: false })?.isSymbolicLink()) {
    return names.some((n) => lstatSync(join(ctx.root, base, n), { throwIfNoEntry: false })) ? [{ path: base, class: 'symlink', action: 'keep' }] : []
  }
  return names.flatMap((name) => {
    const dir = `${base}/${name}`
    const st = lstatSync(join(ctx.root, dir), { throwIfNoEntry: false })
    if (!st) return []
    if (ctx.konvoy?.skills.has(name)) return [{ path: dir, class: 'konvoy', action: 'keep' }]
    if (!st.isDirectory()) return [{ path: dir, class: st.isSymbolicLink() ? 'symlink' : 'edited', action: 'keep' }]
    if (ctx.third.has(name)) return [{ path: dir, class: 'third-party', action: 'keep', note: ctx.third.get(name) }]
    return group(ctx, dir, (rel, buf) => known.get(`skills/${name}/${rel}`)?.has(blobId(buf)), true)
  })
})

const lockItems = (ctx, old) => Object.entries(isObj(old?.managed) ? old.managed : {}).flatMap(([path, hash]) => {
  if (!safeRel(path) || typeof hash !== 'string') { ctx.warnings.push(`${OLD_LOCK}: the entry "${path}" is not valid; compass skips it`); return [] }
  return classify(ctx, path, (buf) => sha(buf) === hash) || []
})

const pointerItems = (ctx, names, acRels) => Object.entries(POINTERS).flatMap(([path, text]) => {
  const want = names.flatMap((n) => acRels.map((a) => Buffer.from(text(n, a))))
  return classify(ctx, path, (buf) => want.some((w) => w.equals(buf))) || []
})

// The ids that keep the 1.0 plan out of the Konvoy ledger: a skill name, a path, or "<file>#<key>" (the rules of ownershipErrors).
const konvoyExcludes = (plan, kv) => {
  const overlap = (file, key) => konvoyOwns(kv, file) || (kv.keys[file] || []).some((k) => k === key || key.startsWith(`${k}.`) || k.startsWith(`${key}.`))
  return [...new Set([
    ...[...plan.skills].filter((name) => kv.skills.has(name)),
    ...[...plan.files.keys(), ...plan.blocks.keys()].filter((rel) => konvoyOwns(kv, rel)),
    ...[...plan.keys].flatMap(([file, keys]) => [...keys.keys()].filter((key) => overlap(file, key)).map((key) => `${file}#${key}`)),
  ])].sort()
}

// A kept change names a file, a key ("<file>#<key>") or a block (the key "block" in a Markdown file).
const keptId = ({ path, key }) => (!key || (key === 'block' && !/\.(json|toml)$/.test(path)) ? path : `${path}#${key}`)

// Add ids to "exclude" in compass.json. The old entries stay; the new ids follow in sorted order.
const exclude = (root, ids, fallback = DEFAULT_CONFIG) => {
  const abs = join(root, CONFIG)
  const data = readJson(abs) ?? fallback
  mkdirSync(dirname(abs), { recursive: true })
  writeFileSync(abs, `${JSON.stringify({ ...data, exclude: [...new Set([...(data.exclude ?? []), ...[...ids].sort()])] }, null, 2)}\n`)
}

const scan = ({ AC, root }) => {
  const [errors, warnings] = [[], []]
  const kv = loadKonvoy(root)
  const lk = readLock(root)
  const cfg = loadConfig(root, AC, { init: true })
  const early = [...kv.errors, ...lk.errors, ...cfg.errors]
  if (early.length) return { errors: early, warnings, detected: { found: false }, plan: [], excluded: [] }
  const ans = answersConfig(root)
  const sub = submodule(root)
  const [vend, ...more] = vendored(root)
  const oldLock = existsSync(join(root, OLD_LOCK)) ? readJson(join(root, OLD_LOCK)) : undefined
  if (oldLock === null) warnings.push(`${OLD_LOCK} is not valid JSON; compass keeps it`)
  if (existsSync(join(root, ANSWERS)) && !ans) warnings.push(`${ANSWERS} is not a JSON object in a regular file; compass does not convert it`)
  // Only a 0.x marker starts a migration: the 0.x lock, a compass submodule, a vendored copy or the answers file.
  if (!(isObj(oldLock) || sub || vend || ans)) return { errors, warnings: [...warnings, 'no compass 0.x install found; nothing to migrate'], detected: { found: false }, plan: [], excluded: [] }
  const config = cfg.created && ans ? { ...cfg.config, ...ans.config } : cfg.config
  const plan = buildPlan({ AC, root, config, paths: resolvePaths(config, kv.konvoy).paths, konvoy: Boolean(kv.konvoy) })
  errors.push(...plan.errors)
  const excluded = kv.konvoy ? konvoyExcludes(plan, kv.konvoy).map((id) => ({ id, reason: 'konvoy' })) : []
  if (outside(root, CONFIG)) errors.push(`${CONFIG} is a symlink or leaves the project root; compass does not write it`)
  const claimed = new Set([...plan.files].filter(([, f]) => f.mode === 'managed').map(([p]) => p))
  if (ans) claimed.add(ANSWERS)
  const known = knownBlobs(AC, warnings)
  if (!known.size) return { errors: [...errors, `the compass checkout has no v0.* tags; run "git -C ${AC} fetch --tags" and run ac migrate again`], warnings, detected: { found: true }, plan: [], excluded: [] }
  const ctx = { root, konvoy: kv.konvoy, claimed, owned: lk.lock.files, warnings, third: thirdParty(AC, known) }
  for (const v of more) warnings.push(`another vendored copy is in ${v.path}; run "ac migrate" again after this run`)
  const names = [...new Set([...known.keys()].flatMap((p) => /^skills\/([^/]+)\/./.exec(p)?.[1] ?? []))].sort()
  const acRels = [...new Set([sub?.path, vend?.path, relative(root, AC) || '.'].filter(Boolean))]
  const items = [
    ...lockItems(ctx, oldLock),
    ...skillItems(ctx, known, names),
    ...pointerItems(ctx, [...new Set([ans?.answers.name, basename(root)].filter((n) => typeof n === 'string' && n))], acRels),
    ...(ans ? [classify(ctx, ANSWERS, () => false)].filter(Boolean) : []),
  ]
  if (vend && within(AC, join(root, vend.path))) warnings.push(`${vend.path} holds the compass that runs now; compass does not touch it`)
  else if (vend) items.push(...group(ctx, vend.path, (rel, buf) => rel === '.vendor.json' || known.get(rel)?.has(blobId(buf)), false))

  const kvRaw = readJson(join(root, KONVOY))
  const gemini = ['GEMINI.md', '.mcp/gemini.example.json', ...(lstatSync(join(root, '.gemini'), { throwIfNoEntry: false })?.isDirectory() ? files(root, '.gemini') : [])].filter((p) => lstatSync(join(root, p), { throwIfNoEntry: false }))
  const detected = {
    found: true,
    lock: isObj(oldLock) ? { path: OLD_LOCK, version: oldLock.version ?? null } : null,
    submodule: sub,
    vendored: vend ?? null,
    answers: ans ? ANSWERS : null,
    doubleSkills: names.filter((n) => SKILL_ROOTS.every((b) => isDir(join(root, b, n)))),
    gemini: gemini.sort(),
    konvoy: isObj(kvRaw) ? { version: kvRaw.version ?? null, compassSkills: Object.keys(kvRaw.compass_skills || {}).length } : null,
  }
  // One item for each real file: two paths that reach one file through a directory link give one item.
  const real = (path) => join(realpathSync(dirname(join(root, path))), basename(path))
  const map = new Map()
  for (const i of items) if (!map.has(real(i.path))) map.set(real(i.path), i)
  const out = [...map.values()].sort((a, b) => (a.path < b.path ? -1 : 1))
  for (const { path, action } of out) {
    const to = `${MIGRATED}/${path}`
    if (action === 'move' && (lstatSync(join(root, to), { throwIfNoEntry: false }) || outside(root, to))) errors.push(`${to} exists or leaves the project root; move ${path} by hand`)
  }
  return { errors, warnings, detected, plan: out, excluded }
}

export const legacyPlan = ({ AC, root }) => {
  try { return scan({ AC, root: resolve(root) }) } catch (err) { return { errors: [err.message], warnings: [], detected: { found: false }, plan: [], excluded: [] } }
}

const execute = (AC, root, out) => {
  const ans = answersConfig(root)
  const sync = () => syncHost({ AC, root, apply: true, init: true })
  const fail = (res) => ({ ...out, ok: false, sync: res, errors: res.errors, warnings: [...out.warnings, `${OLD_LOCK} stays because the sync failed; fix the errors and run "ac migrate" again`] })
  if (out.excluded.length || (ans && !existsSync(join(root, CONFIG)))) exclude(root, out.excluded.map((e) => e.id), ans?.config)
  for (const path of out.deleted) { rmSync(join(root, path)); prune(root, dirname(join(root, path))) }
  for (const { path, to } of out.moved) {
    mkdirSync(dirname(join(root, to)), { recursive: true })
    renameSync(join(root, path), join(root, to))
    prune(root, dirname(join(root, path)))
  }
  const first = sync()
  if (!first.ok) return fail(first)
  // A kept change is a host value that differs from the compass value. The host value stays; compass stops managing it.
  const host = [...new Set(first.changes.filter((c) => c.action === 'kept').map(keptId))].sort()
  let result = first
  if (host.length) {
    exclude(root, host)
    const second = sync()
    if (!second.ok) return fail(second)
    result = { ...second, changes: [...first.changes.filter((c) => c.action !== 'kept'), ...second.changes] }
  }
  if (out.detected.lock) { rmSync(join(root, OLD_LOCK)); prune(root, dirname(join(root, OLD_LOCK))) }
  return { ...out, excluded: [...out.excluded, ...host.map((id) => ({ id, reason: 'host value' }))], sync: result }
}

// dry: the plan only. kept, moved and deleted list what the plan does; apply does it.
export const migrateLegacy = ({ AC, root, apply = false }) => {
  root = resolve(root)
  const p = legacyPlan({ AC, root })
  const pick = (action) => p.plan.filter((i) => i.action === action)
  const out = {
    ...p,
    ok: !p.errors.length,
    kept: pick('keep').map(({ path, class: cls, note }) => ({ path, note: note ?? NOTES[cls] })),
    moved: pick('move').map(({ path }) => ({ path, to: `${MIGRATED}/${path}`, note: 'merge by hand' })),
    deleted: pick('delete').map((i) => i.path),
    sync: null,
  }
  if (!apply || !out.ok || !p.detected.found) return out
  try { return execute(AC, root, out) } catch (err) { return { ...out, ok: false, errors: [err.message] } }
}
