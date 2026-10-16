// assets.mjs — list what compass can install into a project, and change that choice in .agents/compass.json.
// An asset is { kind, id, title, description, source, on, available, recommended, reason } and, for a pack, an MCP server or a plugin, auto.
//   id: skill name · rule '.claude/rules/<rel>' · agent name · pack name · MCP server name · Claude plugin id · upstream source id · host path (file, block).
//   source: compass | core | pack:<name> | upstream:<id> | catalog.
//   on: the plan installs it (a pack, MCP server or upstream source: it is active). The plan is one buildPlan pass.
//   available: false when its frontmatter `stacks` do not fit the project. recommended: it fits (see recommendedPacks).
//   auto: the project selects it by itself (a detected pack, an MCP server or plugin of a detected stack), so setAsset adds an "exclude" entry to switch it off.
// A pack-sourced asset is recommended only when its pack is. A change touches .agents/compass.json only: run "ac sync" to apply it.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { CONFIG, loadConfig, loadKonvoy, resolvePaths } from './config.mjs'
import { detectPacks, detectSignals } from './detect.mjs'
import { CATALOG, stackHits } from './mcp.mjs'
import { buildPlan } from './plan.mjs'
import { outside } from './sync.mjs'
import { loadUpstream } from './upstream.mjs'
import { dirs, frontmatter, isDir, list, readJson, walk } from './util.mjs'

export const KINDS = ['skill', 'rule', 'agent', 'pack', 'mcp', 'plugin', 'upstream', 'file', 'block']
const LISTS = { pack: 'packs', mcp: 'mcp', plugin: 'plugins', upstream: 'upstream' }
const PREFIXED = ['agent', 'pack', 'mcp', 'plugin']
const RENOVATE = ['renovate.json', 'renovate.json5', '.renovaterc', '.renovaterc.json', '.github/renovate.json', '.github/renovate.json5', '.gitlab/renovate.json']

const add = (items = [], v) => (items.includes(v) ? items : [...items, v])
const drop = (items = [], v) => items.filter((x) => x !== v)
const packOf = (source = '') => /^pack:(.+)$/.exec(source)?.[1]

// The "exclude" entries that switch an asset off. The first one is the entry that setAsset writes.
const marks = ({ kind, id }) => {
  if (kind === 'rule') return [id, /^\.claude\/rules\/(stack-[a-z0-9-]+)\.md$/.exec(id)?.[1]].filter(Boolean)
  return kind === 'upstream' ? [] : [PREFIXED.includes(kind) ? `${kind}:${id}` : id]
}

// A new config with one asset on or off. Lists keep their order and hold no duplicate. Other keys stay as they are.
// `also`: the owned keys that call a file (the hook keys of the hook script) go off and on with it.
export const setAsset = (config, asset, on) => {
  const key = LISTS[asset.kind]
  const gone = marks(asset)
  const also = asset.also ?? []
  const pack = on && asset.kind !== 'pack' ? packOf(asset.source) : undefined
  let exclude = config.exclude
  if (on) exclude = [...gone, ...also].reduce(drop, exclude)
  else if (gone.length && !(key && asset.auto === false)) exclude = [gone[0], ...also].reduce(add, exclude)
  return {
    ...config,
    exclude: pack ? drop(exclude, `pack:${pack}`) : exclude,
    ...(key && !(on && asset.auto) && { [key]: on ? add(config[key], asset.id) : drop(config[key], asset.id) }),
    ...(pack && { packs: add(config.packs, pack) }),
  }
}

const asset = (kind, id, source, fields) => ({ kind, id, title: id, description: '', source, on: false, available: true, recommended: false, reason: '', ...fields })

const fitOf = (text, stacks) => {
  const want = list(frontmatter(text).data.stacks)
  const hit = want.filter((s) => stacks.includes(s))
  if (!want.length) return { available: true, recommended: true, reason: 'baseline' }
  return hit.length
    ? { available: true, recommended: true, reason: `stack ${hit.join(', ')}` }
    : { available: false, recommended: false, reason: `needs stack ${want.join(' or ')}` }
}

// Packs that fit the project, with the reason: the detected ones, CI packs by CI signal, renovate when the compass submodule has no renovate config.
const recommendedPacks = ({ AC, root, signals, detected }) => new Map([
  ...detected.map((p) => [p, `pack ${p} detected`]),
  ...[['ci-github', 'github'], ['ci-gitlab', 'gitlab']].filter(([, s]) => signals.has(s)).map(([p, s]) => [p, `signal ${s}`]),
  ...(signals.has('compass-submodule') && !RENOVATE.some((f) => existsSync(join(root, f))) ? [['renovate', 'signal compass-submodule']] : []),
].filter(([p]) => isDir(join(AC, 'packs', p))))

const layerAssets = ({ AC, plan, stacks, why }) => [['compass', AC], ['core', join(AC, 'core')], ...dirs(join(AC, 'packs')).map((p) => [`pack:${p}`, join(AC, 'packs', p)])]
  .flatMap(([source, dir]) => {
    const pack = packOf(source)
    const make = (kind, id, text, on, extra) => {
      const fit = fitOf(text, stacks)
      const tied = pack && fit.available ? { recommended: why.has(pack), reason: why.get(pack) ?? `pack ${pack} is opt-in` } : {}
      return asset(kind, id, source, { description: frontmatter(text).data.description ?? '', on, ...fit, ...tied, ...extra })
    }
    const read = (rel) => readFileSync(join(dir, rel), 'utf8')
    const keys = readJson(join(dir, 'keys.json')) ?? {}
    const callers = (f) => Object.entries(keys).flatMap(([file, map]) => Object.entries(map).filter(([, v]) => JSON.stringify(v).includes(f)).map(([k]) => `${file}#${k}`))
    return [
      ...dirs(join(dir, 'skills')).filter((n) => existsSync(join(dir, 'skills', n, 'SKILL.md')))
        .map((n) => make('skill', n, read(`skills/${n}/SKILL.md`), plan.skills.has(n))),
      ...walk(join(dir, 'rules')).filter((f) => f.endsWith('.md'))
        .map((f) => make('rule', `.claude/rules/${f}`, read(`rules/${f}`), plan.files.has(`.claude/rules/${f}`), { title: f.slice(0, -3) })),
      ...walk(join(dir, 'agents')).filter((f) => /^[^/]+\.md$/.test(f))
        .map((f) => make('agent', f.slice(0, -3), read(`agents/${f}`), plan.files.has(`.claude/agents/${f}`))),
      ...walk(join(dir, 'files')).map((f) => make('file', f, '', plan.files.has(f), { description: 'Managed file', ...(callers(f).length && { also: callers(f) }) })),
      ...walk(join(dir, 'blocks')).map((f) => make('block', f, '', plan.blocks.has(f), { description: 'Compass block' })),
    ]
  })

const contents = (dir) => ['skills', 'agents', 'rules', 'files', 'seed', 'blocks']
  .map((d) => [d, walk(join(dir, d)).length]).filter(([, n]) => n).map(([d, n]) => `${d}: ${n}`).join(', ')

const packAssets = ({ AC, plan, detected, why }) => dirs(join(AC, 'packs')).map((name) => asset('pack', name, `pack:${name}`, {
  description: contents(join(AC, 'packs', name)), on: plan.packs.includes(name), auto: detected.includes(name), recommended: why.has(name), reason: why.get(name) ?? 'opt-in',
}))

// A catalog entry is "auto" when a detected stack lists it ("*" lists every project).
const catalogAssets = (kind, entries, { stacks, signals }, on) => Object.entries(entries ?? {}).map(([id, e]) => {
  const hit = stackHits(e, stacks)
  const via = (e.suggest ?? []).find((s) => s === '*' || signals.has(s))
  return asset(kind, id, 'catalog', {
    description: e.description ?? '',
    on: on(id),
    auto: hit.length > 0,
    recommended: hit.length > 0 || via !== undefined,
    reason: hit.includes('*') || via === '*' ? 'baseline' : hit.length ? `stack ${hit.join(', ')}` : via ? `signal ${via}` : 'opt-in',
  })
})

const mcpAssets = (ctx) => catalogAssets('mcp', readJson(join(ctx.AC, CATALOG))?.servers, ctx, (id) => ctx.plan.mcp.includes(id))

const pluginAssets = (ctx) => catalogAssets('plugin', readJson(join(ctx.AC, CATALOG))?.plugins, ctx,
  (id) => ctx.plan.keys.get('.claude/settings.json')?.has(`enabledPlugins.${id}`) ?? false)

const upstreamAssets = ({ AC, config, stacks }) => Object.entries(loadUpstream(AC).sources).map(([id, src]) => {
  const want = src.stacks ?? []
  const hit = want.filter((s) => stacks.includes(s))
  const fit = !want.length || hit.length > 0
  const reason = !want.length ? 'baseline' : hit.length ? `stack ${hit.join(', ')}` : `for stack ${want.join(' or ')}`
  return asset('upstream', id, `upstream:${id}`, {
    description: `${src.skills.length} skills, ${src.licence} licence`,
    on: config.upstream.includes(id),
    recommended: fit && !src.recommend,
    reason: src.recommend === 'user' ? 'user level: the compass-user plugin and ac doctor --global'
      : src.recommend === 'manual' && fit ? `${src.skills.length} skills: switch it on by hand` : reason,
  })
})

const collect = ({ AC, root, config: given, konvoy }) => {
  const config = { packs: [], exclude: [], upstream: [], mcp: [], plugins: [], paths: {}, ...given }
  const { paths } = resolvePaths(config, konvoy)
  const plan = buildPlan({ AC, root, config, paths, konvoy: Boolean(konvoy) })
  const signals = detectSignals(root, { openspecDir: paths.openspec, designs: paths.designs })
  const detected = detectPacks(root).filter((p) => isDir(join(AC, 'packs', p)))
  const ctx = { AC, root, plan, config, signals, detected, stacks: plan.stacks, why: recommendedPacks({ AC, root, signals, detected }) }
  const all = [...layerAssets(ctx), ...packAssets(ctx), ...mcpAssets(ctx), ...pluginAssets(ctx), ...upstreamAssets(ctx)]
  return { errors: plan.errors, stacks: plan.stacks, signals, detected, assets: KINDS.flatMap((k) => all.filter((a) => a.kind === k)) }
}

export const listAssets = ({ AC, root }) => {
  const cfg = loadConfig(root, AC, { init: true })
  const kv = loadKonvoy(root)
  const early = [...cfg.errors, ...kv.errors]
  if (early.length) return { errors: early, stacks: [], signals: [], packs: { detected: [], configured: [] }, assets: [] }
  const { errors, stacks, signals, detected, assets } = collect({ AC, root, config: cfg.config, konvoy: kv.konvoy })
  return { errors, stacks, signals: [...signals].sort(), packs: { detected, configured: cfg.config.packs }, assets }
}

// The config with every recommended asset on. A detected pack, a stack MCP server and a stack plugin stay automatic. Other excludes stay.
export const recommendedConfig = ({ AC, root, config }) => {
  const want = collect({ AC, root, config, konvoy: loadKonvoy(root).konvoy }).assets.filter((a) => a.recommended && a.available)
  const union = (items = [], kind) => [...new Set([...items, ...want.filter((a) => a.kind === kind && !a.auto).map((a) => a.id)])]
  const marked = new Set(want.flatMap(marks))
  return {
    ...config,
    exclude: config.exclude.filter((e) => !marked.has(e)),
    packs: union(config.packs, 'pack'),
    mcp: union(config.mcp, 'mcp'),
    upstream: union(config.upstream, 'upstream'),
  }
}

// Write the config. Empty "upstream", "mcp", "plugins" and "paths" are dropped: loadConfig adds them.
export const writeConfig = (root, config) => {
  if (outside(root, CONFIG)) throw new Error(`${CONFIG} is a symlink or leaves the project root; compass does not write it`)
  const out = Object.fromEntries(Object.entries(config).filter(([k, v]) => !(['upstream', 'mcp', 'plugins', 'paths'].includes(k) && !Object.keys(v ?? {}).length)))
  mkdirSync(join(root, '.agents'), { recursive: true })
  writeFileSync(join(root, CONFIG), `${JSON.stringify(out, null, 2)}\n`)
}
