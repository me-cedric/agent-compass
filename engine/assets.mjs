// assets.mjs — list what compass can install into a project, and change that choice in .agents/compass.json.
// An asset is { kind, id, title, description, source, on, available, recommended, reason } and, for a pack, an MCP server or a plugin, auto.
//   id: skill name · rule '.claude/rules/<rel>' · agent name · pack name · MCP server name · Claude plugin id · upstream source id ·
//       host path (file, block, seed) · '<file>#<key>' (key) · the schema dir with a trailing slash (schema).
//   source: compass | core | pack:<name> | upstream:<id> | catalog.
//   on: the plan installs it (a pack, MCP server or upstream source: it is active). The plan is one buildPlan pass.
//   available: false when its frontmatter `stacks` do not fit the project. recommended: it fits (see recommendedPacks).
//   auto: the project selects it by itself (a detected pack, an MCP server or plugin of a detected stack), so setAsset adds an "exclude" entry to switch it off.
//   tokens: the always-on cost of a skill, an agent (its listing line), a block or an output style file. See tokens.mjs.
// A key is one owned key of a keys.json. A seed is a file of a seed/ dir. The schema is the OpenSpec schema dir. Each one switches through "exclude".
// An upstream skill is a child of its source: kind "skill", source "upstream:<id>", available only when the source is on.
// A pack-sourced asset is recommended only when its pack is. A change touches .agents/compass.json only: run "ac sync" to apply it.
// ac assets (cli below) lists the assets and switches them from the shell.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { CONFIG, DEFAULT_CONFIG, konvoyOwns, loadConfig, loadKonvoy, resolvePaths, SCHEMA, schemaDir } from './config.mjs'
import { detectPacks, detectSignals } from './detect.mjs'
import { CATALOG, stackHits } from './mcp.mjs'
import { blockInner } from './merge.mjs'
import { buildPlan } from './plan.mjs'
import { outside, syncHost } from './sync.mjs'
import { BUDGET, estimate, estimatePlan, listingTokens } from './tokens.mjs'
import { loadUpstream, sourceDir } from './upstream.mjs'
import { dirs, failCommand, frontmatter, hostRoot, isDir, isObj, list, parseCommand, readJson, usageError, walk } from './util.mjs'

export const KINDS = ['skill', 'rule', 'agent', 'pack', 'mcp', 'plugin', 'upstream', 'file', 'block', 'key', 'seed', 'schema']
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

const ALWAYS_NOTE = 'text only: the SessionStart hook output is not in this estimate'
const STYLE = /^\.claude\/output-styles\/[^/]+\.md$/

// The title and the description of each owned key that compass sets. A Codex file gets the prefix "Codex".
const KEY_TEXT = {
  outputStyle: ['output style', 'Selects the compass output style.'],
  'hooks.PreToolUse': ['guard', 'Blocks a read of a secret file, an edit of a lock file, a tracker worklog or delete tool, and a destructive git or rm command, before the tool runs.'],
  'hooks.Stop': ['gate', 'Asks once for the completion summary when a turn that edited files ends.'],
  'hooks.SessionStart': ['start', 'Prints the style reminder when a session starts.'],
  'permissions.deny': ['tracker deny', 'Blocks the tracker delete tools, the repository delete commands and the read of .env files, and holds the deny patterns of the MCP servers.'],
  attribution: ['attribution', 'Keeps AI attribution lines out of commits and pull requests.'],
  'permissions.ask': ['tracker ask', 'Asks before a tracker write tool or an issue or pull request write command runs.'],
  model_verbosity: ['verbosity', 'Sets the Codex model verbosity to low.'],
  model_reasoning_summary: ['reasoning summary', 'Sets the Codex reasoning summary to none.'],
}

const keyText = (file, key) => {
  const [title, description] = KEY_TEXT[key] ?? [key, `Owned key of ${file}.`]
  return { title: file.startsWith('.codex/') ? `Codex ${title}` : title, description }
}

// The text of a planned file, or the given source text when the plan does not hold the file (the asset is off).
const planned = (plan, rel, source) => plan.files.get(rel)?.content.toString('utf8') ?? source

const asset = (kind, id, source, fields) => ({ kind, id, title: id, description: '', source, on: false, available: true, recommended: false, reason: '', ...fields })

const fitOf = (text, stacks) => {
  const want = list(frontmatter(text).data.stacks)
  const hit = want.filter((s) => stacks.includes(s))
  if (!want.length) return { available: true, recommended: true, reason: 'baseline' }
  return hit.length
    ? { available: true, recommended: true, reason: `stack ${hit.join(', ')}` }
    : { available: false, recommended: false, reason: `needs stack ${want.join(' or ')}` }
}

// Packs that fit the project, with the reason: the detected ones, and renovate when the compass submodule has no renovate config.
// The CI packs stay opt-in: their seeds run install and test commands that the project must set first.
const recommendedPacks = ({ AC, root, signals, detected }) => new Map([
  ...detected.map((p) => [p, `pack ${p} detected`]),
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
      ...dirs(join(dir, 'skills')).filter((n) => existsSync(join(dir, 'skills', n, 'SKILL.md'))).map((n) => {
        const text = read(`skills/${n}/SKILL.md`)
        // A user-invoked skill is not in the always-on listing: it costs 0 tokens until the user starts it.
        const user = frontmatter(text).data['disable-model-invocation'] === 'true'
        return make('skill', n, text, plan.skills.has(n), { tokens: listingTokens(planned(plan, `.claude/skills/${n}/SKILL.md`, text)), ...(user && { userInvoked: true }) })
      }),
      ...walk(join(dir, 'rules')).filter((f) => f.endsWith('.md'))
        .map((f) => make('rule', `.claude/rules/${f}`, read(`rules/${f}`), plan.files.has(`.claude/rules/${f}`), { title: f.slice(0, -3) })),
      ...walk(join(dir, 'agents')).filter((f) => /^[^/]+\.md$/.test(f)).map((f) => {
        const text = read(`agents/${f}`)
        return make('agent', f.slice(0, -3), text, plan.files.has(`.claude/agents/${f}`), { tokens: listingTokens(planned(plan, `.claude/agents/${f}`, text)) })
      }),
      ...walk(join(dir, 'files')).map((f) => make('file', f, '', plan.files.has(f), {
        description: 'Managed file',
        ...(callers(f).length && { also: callers(f) }),
        ...(STYLE.test(f) && { tokens: estimate(frontmatter(planned(plan, f, read(`files/${f}`))).body.length) }),
      })),
      ...walk(join(dir, 'blocks')).map((f) => make('block', f, '', plan.blocks.has(f), {
        description: 'Compass block',
        tokens: estimate(blockInner(plan.blocks.get(f) ?? read(`blocks/${f}`)).length),
      })),
      ...Object.entries(keys).filter(([, map]) => isObj(map)).flatMap(([file, map]) => Object.keys(map)
        .map((key) => make('key', `${file}#${key}`, '', plan.keys.get(file)?.has(key) ?? false, keyText(file, key)))),
      ...walk(join(dir, 'seed')).map((f) => make('seed', f, '', plan.files.has(f), { description: 'Seed file: written once, then the project owns it' })),
    ]
  })

// The OpenSpec schema dir. Compass installs it when the OpenSpec folder exists and Konvoy does not own the schema.
const schemaAssets = ({ root, plan, paths }) => {
  const id = schemaDir(paths)
  const found = isDir(join(root, paths.openspec))
  return [asset('schema', id, 'core', {
    title: SCHEMA,
    description: 'OpenSpec schema of the delivery flow. Compass copies it into the OpenSpec folder.',
    on: [...plan.files.keys()].some((f) => f.startsWith(id)),
    available: found,
    recommended: found,
    reason: found ? `folder ${paths.openspec} found` : `needs the folder ${paths.openspec}`,
  })]
}

const contents = (dir) => ['skills', 'agents', 'rules', 'files', 'seed', 'blocks']
  .map((d) => [d, walk(join(dir, d)).length]).filter(([, n]) => n).map(([d, n]) => `${d}: ${n}`).join(', ')

const packAssets = ({ AC, plan, detected, why }) => dirs(join(AC, 'packs')).map((name) => asset('pack', name, `pack:${name}`, {
  description: contents(join(AC, 'packs', name)), on: plan.packs.includes(name), auto: detected.includes(name), recommended: why.has(name), reason: why.get(name) ?? (name.startsWith('ci-') ? 'opt-in: the CI seeds need your install and test commands first' : 'opt-in'),
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

const skillName = (id, entry) => (entry === '.' ? id : basename(entry))

// The SKILL.md text of an upstream skill entry, read from the cache. The tree of a source is read once.
const sourceReader = (id, src) => {
  const dir = sourceDir(id, src)
  if (!isDir(dir)) return () => undefined
  const tree = walk(dir)
  return (entry) => {
    const name = skillName(id, entry)
    const rel = entry === '.' ? 'SKILL.md' : entry.includes('/') ? `${entry}/SKILL.md`
      : tree.find((f) => !/(^|\/)\./.test(f) && (f === `${name}/SKILL.md` || f.endsWith(`/${name}/SKILL.md`)))
    return rel && tree.includes(rel) ? readFileSync(join(dir, rel), 'utf8') : undefined
  }
}

// A source and its skills. A skill is on and available only with its source on, and it follows the recommendation of its source.
const upstreamAssets = ({ AC, config, stacks, plan }) => Object.entries(loadUpstream(AC).sources).flatMap(([id, src]) => {
  const want = src.stacks ?? []
  const hit = want.filter((s) => stacks.includes(s))
  const fit = !want.length || hit.length > 0
  const reason = !want.length ? 'baseline' : hit.length ? `stack ${hit.join(', ')}` : `for stack ${want.join(' or ')}`
  const on = config.upstream.includes(id)
  const recommended = fit && !src.recommend
  const why = src.recommend === 'user' ? 'user level: the compass-user plugin and ac doctor --global'
    : src.recommend === 'manual' && fit ? `${src.skills.length} skills: switch it on by hand` : reason
  const read = sourceReader(id, src)
  const skills = src.skills.map((entry) => {
    const name = skillName(id, entry)
    const text = read(entry)
    return asset('skill', name, `upstream:${id}`, {
      description: text === undefined ? '' : frontmatter(text).data.description ?? '',
      on: on && plan.skills.has(name),
      available: on,
      recommended,
      reason: on ? why : `switch on the source ${id} first`,
      ...(text !== undefined && { tokens: listingTokens(text) }),
    })
  })
  return [asset('upstream', id, `upstream:${id}`, { description: `${src.skills.length} skills, ${src.licence} licence`, on, recommended, reason: why }), ...skills]
})

// Konvoy owns a key when it owns the whole file, or lists a key that is the same, below it or above it (the rule of ownershipErrors in config.mjs).
const konvoyKey = (konvoy, id) => {
  const [file, key] = id.split('#')
  return konvoyOwns(konvoy, file) || (konvoy.keys[file] ?? []).some((k) => k === key || key.startsWith(`${k}.`) || k.startsWith(`${key}.`))
}

// The recommended set never removes the exclude of these kinds: the project made that choice.
const OWN_CHOICE = ['key', 'seed', 'schema']

// A hook key calls the script of a file asset (its `also` list). Without the script the hook fails, so the key waits for the file.
const needFile = (all) => {
  const files = new Map(all.filter((a) => a.kind === 'file').flatMap((f) => (f.also ?? []).map((id) => [id, f])))
  return (a) => {
    const file = a.kind === 'key' && a.available ? files.get(a.id) : undefined
    return file && file.available && !file.on ? { ...a, available: false, reason: `switch on ${file.id} first` } : a
  }
}

const collect = ({ AC, root, config: given, konvoy }) => {
  const config = { packs: [], exclude: [], upstream: [], mcp: [], plugins: [], paths: {}, ...given }
  const { paths } = resolvePaths(config, konvoy)
  const plan = buildPlan({ AC, root, config, paths, konvoy: Boolean(konvoy) })
  const signals = detectSignals(root, { openspecDir: paths.openspec, designs: paths.designs })
  const detected = detectPacks(root).filter((p) => isDir(join(AC, 'packs', p)))
  const ctx = { AC, root, plan, config, paths, signals, detected, stacks: plan.stacks, why: recommendedPacks({ AC, root, signals, detected }) }
  // An item that the Konvoy ledger owns cannot go on: the recommended set and a switch leave its exclude as it is.
  const path = (a) => (a.kind === 'agent' ? `.claude/agents/${a.id}.md` : ['rule', 'file', 'block', 'seed', 'schema'].includes(a.kind) ? a.id : null)
  const konvoyHas = (a) => konvoy && ((a.kind === 'skill' && konvoy.skills.has(a.id)) || (a.kind === 'key' && konvoyKey(konvoy, a.id)) || (path(a) && konvoyOwns(konvoy, path(a))))
  const owned = [...layerAssets(ctx), ...schemaAssets(ctx), ...packAssets(ctx), ...mcpAssets(ctx), ...pluginAssets(ctx), ...upstreamAssets(ctx)]
    .map((a) => (konvoyHas(a) ? { ...a, available: false, recommended: false, reason: 'Konvoy owns it (.agents/konvoy.json)' } : a))
  const all = owned.map(needFile(owned))
  return { errors: plan.errors, stacks: plan.stacks, signals, detected, plan, paths, konvoy: Boolean(konvoy), assets: KINDS.flatMap((k) => all.filter((a) => a.kind === k)) }
}

// The config with every recommended asset on. A detected pack, a stack MCP server and a stack plugin stay automatic. Other excludes stay.
// The exclude of a key, a seed or the schema stays too: the asset is recommended for a new project, but a project that excluded it chose that.
// An upstream skill counts when its source is recommended: the source goes on in the same step.
const recommendedFrom = (config, assets) => {
  const want = assets.filter((a) => a.recommended && (a.available || (a.kind === 'skill' && a.source.startsWith('upstream:'))))
  const union = (items = [], kind) => [...new Set([...items, ...want.filter((a) => a.kind === kind && !a.auto).map((a) => a.id)])]
  const marked = new Set(want.filter((a) => !OWN_CHOICE.includes(a.kind)).flatMap(marks))
  return {
    ...config,
    exclude: config.exclude.filter((e) => !marked.has(e)),
    packs: union(config.packs, 'pack'),
    mcp: union(config.mcp, 'mcp'),
    upstream: union(config.upstream, 'upstream'),
  }
}

export const recommendedConfig = ({ AC, root, config }) => recommendedFrom(config, collect({ AC, root, config, konvoy: loadKonvoy(root).konvoy }).assets)

// The estimate of the always-on text for the current config and for the recommended config.
const alwaysOn = ({ AC, root, config, found }) => {
  const recommended = buildPlan({ AC, root, config: recommendedFrom(config, found.assets), paths: found.paths, konvoy: found.konvoy })
  return { current: estimatePlan(found.plan).total, recommended: estimatePlan(recommended).total, budget: BUDGET.tokens, note: ALWAYS_NOTE }
}

export const listAssets = ({ AC, root }) => {
  const cfg = loadConfig(root, AC, { init: true })
  const kv = loadKonvoy(root)
  const early = [...cfg.errors, ...kv.errors]
  if (early.length) {
    return { errors: early, stacks: [], signals: [], packs: { detected: [], configured: [] }, always: { current: 0, recommended: 0, budget: BUDGET.tokens, note: ALWAYS_NOTE }, assets: [] }
  }
  const found = collect({ AC, root, config: cfg.config, konvoy: kv.konvoy })
  const { errors, stacks, signals, detected, assets } = found
  return { errors, stacks, signals: [...signals].sort(), packs: { detected, configured: cfg.config.packs }, always: alwaysOn({ AC, root, config: cfg.config, found }), assets }
}

// Write the config. Empty "upstream", "mcp", "plugins" and "paths" are dropped: loadConfig adds them.
export const writeConfig = (root, config) => {
  if (outside(root, CONFIG)) throw new Error(`${CONFIG} is a symlink or leaves the project root; compass does not write it`)
  const out = Object.fromEntries(Object.entries(config).filter(([k, v]) => !(['upstream', 'mcp', 'plugins', 'paths'].includes(k) && !Object.keys(v ?? {}).length)))
  mkdirSync(join(root, '.agents'), { recursive: true })
  writeFileSync(join(root, CONFIG), `${JSON.stringify(out, null, 2)}\n`)
}

const HELP = `Usage: ac assets [on|off <kind>:<id> | recommended] [options]

Without an action: list the assets by kind, with the state, the tokens and the reason.
  on <kind>:<id>   Switch an asset on in .agents/compass.json. Then show the sync diff.
  off <kind>:<id>  Switch an asset off in .agents/compass.json. Then show the sync diff.
  recommended      Switch on every recommended asset. Other excludes stay. Then show the sync diff.
An action writes .agents/compass.json only. Run "ac sync" to apply the diff.
The kinds: ${KINDS.join(', ')}.
Examples: skill:review, mcp:playwright, key:.claude/settings.json#hooks.Stop

Options:
  --root <dir>  Use this project root. The default is the current directory.
  --json        Print the result as JSON.
  --help, -h    Show this help.`

const ACTIONS = ['on', 'off', 'recommended']

// "<kind>:<id>" → { kind, id }. The id can hold colons, so only the first colon splits.
const parseTarget = (text) => {
  const at = text.indexOf(':')
  const kind = text.slice(0, at)
  return KINDS.includes(kind) && at < text.length - 1 ? { kind, id: text.slice(at + 1) } : null
}

const state = (a) => (a.on ? 'on' : a.available ? 'off' : 'n/a')

const printList = (result, root) => {
  const { always } = result
  console.log(`ac assets → ${root}`)
  console.log(`Stacks: ${result.stacks.join(', ') || 'none'}`)
  console.log(`Always-on text: about ${always.current} tokens now, ${always.recommended} with the recommended set. The budget is ${always.budget} (${always.note}).`)
  console.log('State: on, off, n/a (not available). A star marks a recommended asset. The skills of an upstream source show when the source is on.')
  const shown = result.assets.filter((a) => a.available || !a.source.startsWith('upstream:') || a.kind === 'upstream')
  for (const kind of KINDS) {
    const group = shown.filter((a) => a.kind === kind)
    if (!group.length) continue
    const width = Math.max(...group.map((a) => a.id.length))
    console.log(`\n${kind} (${group.length})`)
    for (const a of group) {
      console.log(`  ${state(a).padEnd(3)} ${a.recommended ? '*' : ' '} ${a.id.padEnd(width)}  ${(a.userInvoked ? 'user' : a.tokens === undefined ? '' : `${a.tokens}t`).padStart(6)}  ${a.reason}`)
    }
  }
  for (const e of result.errors) console.error(`error: ${e}`)
}

const showList = ({ AC, root, json }) => {
  const result = listAssets({ AC, root })
  if (json) console.log(JSON.stringify({ ok: !result.errors.length, ...result }, null, 2))
  else printList(result, root)
  return result.errors.length ? 1 : 0
}

// The config after the action, or { error }. The raw file is the base, as in the UI, so a switch does not rewrite other keys.
const nextConfig = ({ AC, root, action, target }) => {
  const errors = [...loadConfig(root, AC).errors, ...loadKonvoy(root).errors]
  if (errors.length) return { error: errors.join(' ') }
  const config = { ...DEFAULT_CONFIG, ...readJson(join(root, CONFIG)) }
  if (action === 'recommended') return { config: recommendedConfig({ AC, root, config }) }
  const found = listAssets({ AC, root }).assets.find((a) => a.kind === target.kind && a.id === target.id)
  if (!found) return { error: `no ${target.kind} asset "${target.id}"; run "ac assets" to list the assets` }
  if (action === 'on' && !found.available) return { error: `${target.kind}:${target.id} is not available: ${found.reason}` }
  return { config: setAsset(config, found, action === 'on') }
}

const change = ({ AC, root, action, target, json }) => {
  const next = nextConfig({ AC, root, action, target })
  if (next.error) return failCommand(json, next.error)
  try { writeConfig(root, next.config) } catch (err) { return failCommand(json, err.message) }
  const sync = syncHost({ AC, root })
  const { changes, warnings, errors } = sync
  if (json) {
    console.log(JSON.stringify({ ok: sync.ok, action, ...(target && { asset: target }), changes, warnings, errors }, null, 2))
    return sync.ok ? 0 : 1
  }
  console.log(`ac assets ${[action, target && `${target.kind}:${target.id}`].filter(Boolean).join(' ')} → ${root}`)
  for (const w of warnings) console.log(`  warn    ${w}`)
  for (const c of changes) console.log(`  ${c.action.padEnd(7)} ${c.path}${c.key ? `#${c.key}` : ''}`)
  for (const e of errors) console.error(`error: ${e}`)
  if (sync.ok) console.log(changes.length ? `${changes.length} change(s) wait. Run "ac sync" to apply them.` : 'Up to date. Sync has nothing to change.')
  return sync.ok ? 0 : 1
}

export const cli = (argv, { AC }) => {
  const { values: v, positionals: [action, ...args], exit } = parseCommand(argv, HELP, { root: { type: 'string' }, json: { type: 'boolean' } })
  if (exit !== undefined) return exit
  if (action !== undefined && !ACTIONS.includes(action)) return usageError(HELP, `Unknown action: ${action}`)
  const wanted = ['on', 'off'].includes(action) ? 1 : 0
  if (args.length > wanted) return usageError(HELP, `Unexpected argument: ${args[wanted]}`)
  if (args.length < wanted) return usageError(HELP, `ac assets ${action} needs <kind>:<id>.`)
  const target = wanted ? parseTarget(args[0]) : undefined
  if (wanted && !target) return usageError(HELP, `"${args[0]}" is not <kind>:<id>. The kinds: ${KINDS.join(', ')}.`)
  const host = hostRoot(AC, v.root)
  if (host.error) return failCommand(v.json, host.error)
  return action === undefined ? showList({ AC, root: host.root, json: v.json }) : change({ AC, root: host.root, action, target, json: v.json })
}
