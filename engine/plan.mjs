// plan.mjs — the desired host state: whole files, skill dirs, owned JSON/TOML keys and Markdown blocks.
//
// Every source layer has the same layout. A layer can hold any of these entries:
//   skills/<name>/   one skill dir    → .claude/skills/<name>/ and .agents/skills/<name>/ (same bytes)
//   agents/<name>.md one role agent   → .claude/agents/<name>.md, .codex/agents/<name>.toml and,
//                                       with `copilot-model`, .github/agents/<name>.agent.md
//   rules/**/*.md    rule files       → .claude/rules/ (Copilot reads .claude/* too). A top-level
//                                       rules/stack-<n>.md also installs as the Codex skill
//                                       .agents/skills/stack-<n>/ (Codex has no path-scoped rules)
//   files/**         managed files    → the same path in the host
//   seed/**          seed files       → written once, then the project owns them
//   blocks/<path>    Markdown block   → the compass block in <path>
//   keys.json        owned keys       → { "<host .json or .toml file>": { "<dotted.key>": value } }
// Layers: the compass root, core/, then each pack in compass.json "packs" and each detected pack (detectPacks:
// env, local-run, e2e, security). A detected pack that is not in the compass checkout is skipped. Then the upstream sources
// in compass.json "upstream", from the user cache (upstream.mjs).
// "exclude" removes a skill by name, a whole file or a rule by path, and an owned key as "<file>#<key>". It also takes
// two prefixed forms: "agent:<name>" drops a role agent (all its provider files), "pack:<name>" drops a pack, even a detected one.
// Docs layout: core/openspec/<schema>/ → {{OPENSPEC_DIR}}/schemas/<schema>/ when that dir exists and the Konvoy
// ledger does not (Konvoy owns the schema otherwise). An empty {{DESIGNS_DIR}}/screens.json seeds into a designs dir.
// MCP: mcp/catalog.json and compass.json "mcp" → keys in .mcp.json, .codex/config.toml, .vscode/mcp.json, plus
// deny patterns in .claude/settings.json (mcp.mjs).
// Copilot hooks: the planned hook keys of .claude/settings.json → the managed file .github/hooks/compass.json.
// An asset whose frontmatter has `stacks: [...]` installs only when one of those stacks is detected.
// Skill, rule and block text gets the path placeholders of the resolved paths: {{DELIVERY_DIR}}, {{PERSONAS_FILE}} …

import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { basename, join, relative, sep } from 'node:path'
import { PATH_DEFAULTS, SCHEMA, schemaDir } from './config.mjs'
import { detectPacks, detectStacks } from './detect.mjs'
import { SCREENS_SEED, screensFile } from './docs.mjs'
import { mcpPlan } from './mcp.mjs'
import { tomlText, tomlValue } from './merge.mjs'
import { loadUpstream, sourceDir } from './upstream.mjs'
import { dirs, frontmatter, isDir, list, safeRel, walk } from './util.mjs'

const SKILL_ROOTS = ['.claude/skills', '.agents/skills']

const TEXT = /\.(md|txt|json|ya?ml|toml)$/
const LICENCE = /^(LICEN[CS]E|COPYING)([.-][\w.-]+)?$/i
// Apache-2.0 section 4(d): a NOTICE file goes with each copy. It does not count as a licence file.
const NOTICE = /^NOTICE([.-][\w.-]+)?$/i

// {{DELIVERY_DIR}} for a directory key, {{PERSONAS_FILE}} for a file key. {{COMPASS_DIR}} is the compass checkout
// relative to the host root, with '/' separators (a managed CI file runs bin/ac.mjs from it).
export const placeholders = (paths, { AC, root } = {}) => ({
  ...Object.fromEntries(Object.entries(paths)
    .map(([key, value]) => [`${key.toUpperCase()}_${/\.\w+$/.test(PATH_DEFAULTS[key]) ? 'FILE' : 'DIR'}`, value])),
  ...(AC && root && { COMPASS_DIR: relative(realpathSync(root), realpathSync(AC)).split(sep).join('/') || '.' }),
})

const fill = (label, buf, vars, errors) => {
  if (!TEXT.test(label)) return buf
  const text = buf.toString('utf8')
  const out = text.replace(/\{\{([A-Z][A-Z0-9_]*)\}\}/g, (token, key) => {
    if (key in vars) return vars[key]
    const error = `${label}: unknown placeholder ${token}`
    if (!errors.includes(error)) errors.push(error)
    return token
  })
  return out === text ? buf : Buffer.from(out)
}

const fits = (text, stacks) => {
  const want = list(frontmatter(text).data.stacks)
  return !want.length || want.some((s) => stacks.includes(s))
}

// Codex reads role agents as TOML. Frontmatter `codex-model`, `codex-effort` and `codex-sandbox` set the Codex model and sandbox.
const codexAgent = (name, text) => {
  const { data, body } = frontmatter(text)
  return [
    `name = ${tomlValue(data.name || name)}`,
    data.description && `description = ${tomlValue(data.description)}`,
    data['codex-model'] && `model = ${tomlValue(data['codex-model'])}`,
    data['codex-effort'] && `model_reasoning_effort = ${tomlValue(data['codex-effort'])}`,
    data['codex-sandbox'] && `sandbox_mode = ${tomlValue(data['codex-sandbox'])}`,
    `developer_instructions = ${tomlText(body.trim())}`,
  ].filter(Boolean).join('\n') + '\n'
}

// Copilot ignores `model` in .claude/agents. Frontmatter `copilot-model` is a Copilot model display name.
// `effort` gives the Copilot reasoning effort. `copilot-instructions: true` loads the custom instructions (AGENTS.md) into the agent.
const copilotAgent = (name, text) => {
  const { data, body } = frontmatter(text)
  const head = [
    `name: ${data.name || name}`,
    data.description && `description: ${JSON.stringify(data.description)}`,
    data.tools && `tools: [${list(data.tools).join(', ')}]`,
    `model: ${JSON.stringify(data['copilot-model'])}`,
    data.effort && `reasoning-effort: ${data.effort}`,
    data['copilot-instructions'] === 'true' && 'include-custom-instructions: true',
  ].filter(Boolean)
  return `---\n${head.join('\n')}\n---\n${body}`
}

// The Copilot CLI and the Copilot cloud agent read .github/hooks/*.json. A PascalCase event keeps the Claude payload,
// the Claude tool names and the Claude matcher. The planned Claude hook keys give the entries, so an excluded key leaves
// its event out. Copilot has no SessionStart source names of Claude, so only PreToolUse keeps its matcher.
// cwd '.' is the repository root: the cloud agent does not set CLAUDE_PROJECT_DIR.
const COPILOT_HOOKS = '.github/hooks/compass.json'
const COPILOT_EVENTS = ['PreToolUse', 'Stop', 'SessionStart']
const copilotHooks = (claude = new Map()) => {
  const hooks = Object.fromEntries(COPILOT_EVENTS.flatMap((event) => {
    const entries = (claude.get(`hooks.${event}`) ?? []).flatMap((group) => (group.hooks ?? []).map((h) => ({
      type: 'command',
      ...(event === 'PreToolUse' && group.matcher && { matcher: group.matcher }),
      bash: `${h.command} --copilot`,
      cwd: '.',
      ...(h.timeout && { timeoutSec: h.timeout }),
    })))
    return entries.length ? [[event, entries]] : []
  }))
  return Object.keys(hooks).length ? `${JSON.stringify({ version: 1, hooks }, null, 2)}\n` : null
}

export const buildPlan =({ AC, root, config, paths, konvoy = false }) => {
  const errors = []
  const warnings = []
  const held = []
  const vars = placeholders(paths, { AC, root })
  const stacks = detectStacks(root, { openspecDir: paths.openspec })
  const excluded = (id) => config.exclude.some((e) => id === e || (e.endsWith('/') && id.startsWith(e)))
  const files = new Map()
  const keys = new Map()
  const blocks = new Map()
  const skills = new Set()

  const addFile = (dest, content, mode = 'managed', exec = false) => {
    if (excluded(dest)) return
    if (files.has(dest)) errors.push(`two sources write ${dest}`)
    else files.set(dest, { content, mode, exec })
  }
  const exec = (abs) => (statSync(abs).mode & 0o111) !== 0
  const copy = (abs, dest, mode) => addFile(dest, readFileSync(abs), mode, exec(abs))
  const addSkill = (name) => {
    if (skills.has(name)) { errors.push(`two sources ship skill ${name}`); return false }
    skills.add(name)
    return true
  }

  const putKeys = (file, entries) => {
    const target = new Map(keys.get(file))
    for (const [key, value] of entries) {
      if (excluded(`${file}#${key}`)) continue
      if (target.has(key)) errors.push(`two sources set ${file}#${key}`)
      target.set(key, value)
    }
    // A file whose keys are all excluded stays out of the plan: compass does not own any part of it.
    if (target.size) keys.set(file, target)
  }
  const addKeys = (source) => {
    let data
    try { data = JSON.parse(readFileSync(source, 'utf8')) } catch (err) { errors.push(`${source}: ${err.message}`); return }
    for (const [file, map] of Object.entries(data)) {
      if (!safeRel(file) || !/\.(json|toml)$/.test(file)) { errors.push(`${source}: ${file} is not a .json or .toml path`); continue }
      putKeys(file, Object.entries(map))
    }
  }

  const packs = [...new Set([...config.packs, ...detectPacks(root).filter((p) => isDir(join(AC, 'packs', p)))])]
    .filter((p) => !excluded(`pack:${p}`))
  const layers = [AC, join(AC, 'core'), ...packs.map((p) => join(AC, 'packs', p))]
  for (const layer of layers) {
    for (const name of dirs(join(layer, 'skills'))) {
      const dir = join(layer, 'skills', name)
      const all = walk(dir)
      if (!all.includes('SKILL.md') || excluded(name) || !fits(readFileSync(join(dir, 'SKILL.md'), 'utf8'), stacks)) continue
      if (!addSkill(name)) continue
      for (const rel of all) {
        const content = fill(`skills/${name}/${rel}`, readFileSync(join(dir, rel)), vars, errors)
        for (const base of SKILL_ROOTS) addFile(`${base}/${name}/${rel}`, content, 'managed', exec(join(dir, rel)))
      }
    }
    for (const rel of walk(join(layer, 'agents')).filter((f) => /^[^/]+\.md$/.test(f))) {
      const text = readFileSync(join(layer, 'agents', rel), 'utf8')
      if (!fits(text, stacks) || excluded(`agent:${rel.slice(0, -3)}`)) continue
      addFile(`.claude/agents/${rel}`, Buffer.from(text))
      addFile(`.codex/agents/${rel.slice(0, -3)}.toml`, Buffer.from(codexAgent(rel.slice(0, -3), text)))
      if (frontmatter(text).data['copilot-model']) addFile(`.github/agents/${rel.slice(0, -3)}.agent.md`, Buffer.from(copilotAgent(rel.slice(0, -3), text)))
    }
    for (const rel of walk(join(layer, 'rules')).filter((f) => f.endsWith('.md'))) {
      const text = fill(`rules/${rel}`, readFileSync(join(layer, 'rules', rel)), vars, errors).toString('utf8')
      const name = /^(stack-[a-z0-9-]+)\.md$/.exec(rel)?.[1]
      if (!fits(text, stacks) || excluded(`.claude/rules/${rel}`) || (name && excluded(name))) continue
      addFile(`.claude/rules/${rel}`, Buffer.from(text))
      if (!name) continue
      const { data, body } = frontmatter(text)
      if (!data.description) errors.push(`rules/${rel} needs a description for its Codex skill`)
      else if (addSkill(name)) addFile(`.agents/skills/${name}/SKILL.md`, Buffer.from(`---\nname: ${name}\ndescription: ${JSON.stringify(data.description)}\n---\n${body}`))
    }
    for (const rel of walk(join(layer, 'files'))) addFile(rel, fill(`files/${rel}`, readFileSync(join(layer, 'files', rel)), vars, errors), 'managed', exec(join(layer, 'files', rel)))
    for (const rel of walk(join(layer, 'seed'))) copy(join(layer, 'seed', rel), rel, 'seed')
    for (const rel of walk(join(layer, 'blocks'))) {
      if (excluded(rel)) continue
      if (blocks.has(rel)) errors.push(`two sources write the compass block in ${rel}`)
      else blocks.set(rel, fill(`blocks/${rel}`, readFileSync(join(layer, 'blocks', rel)), vars, errors).toString('utf8'))
    }
    if (existsSync(join(layer, 'keys.json'))) addKeys(join(layer, 'keys.json'))
  }

  // MCP servers: the keys go into the provider files. Deny patterns join the planned permissions.deny list.
  const mcp = mcpPlan({ AC, config, stacks })
  errors.push(...mcp.errors)
  warnings.push(...mcp.warnings)
  for (const [file, map] of mcp.keys) putKeys(file, map)
  for (const [dest, abs] of mcp.files) copy(abs, dest, 'managed')
  const settings = '.claude/settings.json'
  if (mcp.deny.length && !excluded(`${settings}#permissions.deny`)) {
    const target = new Map(keys.get(settings))
    target.set('permissions.deny', [...new Set([...(target.get('permissions.deny') || []), ...mcp.deny])])
    keys.set(settings, target)
  }

  const copilot = copilotHooks(keys.get(settings))
  if (copilot) addFile(COPILOT_HOOKS, Buffer.from(copilot))

  const schema = join(AC, 'core/openspec', SCHEMA)
  if (!konvoy && isDir(join(root, paths.openspec))) for (const rel of walk(schema)) copy(join(schema, rel), `${schemaDir(paths)}${rel}`, 'managed')
  if (isDir(join(root, paths.designs))) addFile(screensFile(paths), Buffer.from(SCREENS_SEED), 'seed')

  // Upstream skills are third-party text: copied as they are, with the source licence file beside each one.
  // A source that is not in the cache holds its installed files, so offline work removes nothing.
  const upstream = loadUpstream(AC)
  errors.push(...upstream.errors)
  for (const id of config.upstream) {
    const src = upstream.sources[id]
    if (!Object.hasOwn(upstream.sources, id)) { if (!upstream.errors.length) errors.push(`.agents/compass.json: unknown upstream source "${id}"`); continue }
    const dir = sourceDir(id, src)
    const cached = existsSync(dir)
    if (!cached) warnings.push(`upstream ${id} is not in the cache; run "ac sync" online to install it`)
    // walk() skips symlinks, so no upstream link can copy a file from outside the cache.
    const tree = cached ? walk(dir) : []
    const licences = tree.filter((f) => LICENCE.test(f))
    // A source without a licence file in its repository carries the text in upstream.json; it is written as LICENSE beside each skill.
    if (cached && !licences.length && !src.licenceText) { errors.push(`upstream ${id} has no licence file at its root; compass does not install it`); continue }
    for (const entry of src.skills) {
      const name = entry === '.' ? id : basename(entry)
      if (excluded(name) || !addSkill(name)) continue
      if (!cached) { held.push(...SKILL_ROOTS.map((base) => `${base}/${name}/`)); continue }
      const found = entry === '.' ? [''] : entry.includes('/') ? [`${entry}/`]
        : tree.filter((f) => !/(^|\/)\./.test(f) && (f === `${name}/SKILL.md` || f.endsWith(`/${name}/SKILL.md`)))
          .map((f) => f.slice(0, -'SKILL.md'.length))
      if (found.length !== 1 || !tree.includes(`${found[0]}SKILL.md`)) {
        errors.push(`upstream ${id}: skill "${entry}" ${found.length > 1 ? 'is in more than one dir; give its path' : 'has no SKILL.md'}`)
        continue
      }
      const own = tree.filter((f) => f.startsWith(found[0]) && !/(^|\/)\./.test(f.slice(found[0].length)))
        .map((f) => [join(dir, f), f.slice(found[0].length)])
      for (const f of [...licences, ...tree.filter((t) => NOTICE.test(t))]) if (!own.some(([, rel]) => rel === f)) own.push([join(dir, f), f])
      for (const [abs, rel] of own) for (const base of SKILL_ROOTS) copy(abs, `${base}/${name}/${rel}`)
      if (!licences.length) for (const base of SKILL_ROOTS) addFile(`${base}/${name}/LICENSE`, Buffer.from(src.licenceText))
    }
  }

  for (const path of files.keys()) {
    if (keys.has(path) || blocks.has(path)) errors.push(`${path} is both a whole file and a merged file`)
  }
  for (const path of blocks.keys()) if (keys.has(path)) errors.push(`${path} has both a block and owned keys`)
  return { files, keys, blocks, skills, stacks, packs, mcp: mcp.selected, errors, warnings, held }
}
