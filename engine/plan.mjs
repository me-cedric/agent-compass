// plan.mjs — the desired host state: whole files, skill dirs, owned JSON/TOML keys and Markdown blocks.
//
// Every source layer has the same layout. A layer can hold any of these entries:
//   skills/<name>/   one skill dir    → .claude/skills/<name>/ and .agents/skills/<name>/ (same bytes)
//   agents/<name>.md one role agent   → .claude/agents/<name>.md and .codex/agents/<name>.toml
//   rules/**/*.md    rule files       → .claude/rules/ (Copilot reads .claude/* too)
//   files/**         managed files    → the same path in the host
//   seed/**          seed files       → written once, then the project owns them
//   blocks/<path>    Markdown block   → the compass block in <path>
//   keys.json        owned keys       → { "<host .json or .toml file>": { "<dotted.key>": value } }
// Layers: the compass root, core/, then each pack in compass.json "packs".
// An asset whose frontmatter has `stacks: [...]` installs only when one of those stacks is detected.

import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { detectStacks } from './detect.mjs'
import { tomlText, tomlValue } from './merge.mjs'
import { dirs, frontmatter, list, safeRel, walk } from './util.mjs'

const SKILL_ROOTS = ['.claude/skills', '.agents/skills']

const fits = (text, stacks) => {
  const want = list(frontmatter(text).data.stacks)
  return !want.length || want.some((s) => stacks.includes(s))
}

// Codex reads role agents as TOML. Frontmatter `codex-model` and `codex-effort` pin the Codex model.
const codexAgent = (name, text) => {
  const { data, body } = frontmatter(text)
  return [
    `name = ${tomlValue(data.name || name)}`,
    data.description && `description = ${tomlValue(data.description)}`,
    data['codex-model'] && `model = ${tomlValue(data['codex-model'])}`,
    data['codex-effort'] && `model_reasoning_effort = ${tomlValue(data['codex-effort'])}`,
    `developer_instructions = ${tomlText(body.trim())}`,
  ].filter(Boolean).join('\n') + '\n'
}

export const buildPlan = ({ AC, root, config, paths }) => {
  const errors = []
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
  const copy = (abs, dest, mode) => addFile(dest, readFileSync(abs), mode, (statSync(abs).mode & 0o111) !== 0)

  const addKeys = (source) => {
    let data
    try { data = JSON.parse(readFileSync(source, 'utf8')) } catch (err) { errors.push(`${source}: ${err.message}`); return }
    for (const [file, map] of Object.entries(data)) {
      if (!safeRel(file) || !/\.(json|toml)$/.test(file)) { errors.push(`${source}: ${file} is not a .json or .toml path`); continue }
      const target = new Map(keys.get(file))
      for (const [key, value] of Object.entries(map)) {
        if (excluded(`${file}#${key}`)) continue
        if (target.has(key)) errors.push(`two sources set ${file}#${key}`)
        target.set(key, value)
      }
      keys.set(file, target)
    }
  }

  const layers = [AC, join(AC, 'core'), ...config.packs.map((p) => join(AC, 'packs', p))]
  for (const layer of layers) {
    for (const name of dirs(join(layer, 'skills'))) {
      const dir = join(layer, 'skills', name)
      const all = walk(dir)
      if (!all.includes('SKILL.md') || excluded(name) || !fits(readFileSync(join(dir, 'SKILL.md'), 'utf8'), stacks)) continue
      if (skills.has(name)) { errors.push(`two sources ship skill ${name}`); continue }
      skills.add(name)
      for (const rel of all) for (const base of SKILL_ROOTS) copy(join(dir, rel), `${base}/${name}/${rel}`)
    }
    for (const rel of walk(join(layer, 'agents')).filter((f) => /^[^/]+\.md$/.test(f))) {
      const text = readFileSync(join(layer, 'agents', rel), 'utf8')
      if (!fits(text, stacks)) continue
      addFile(`.claude/agents/${rel}`, Buffer.from(text))
      addFile(`.codex/agents/${rel.slice(0, -3)}.toml`, Buffer.from(codexAgent(rel.slice(0, -3), text)))
    }
    for (const rel of walk(join(layer, 'rules')).filter((f) => f.endsWith('.md'))) {
      const abs = join(layer, 'rules', rel)
      if (fits(readFileSync(abs, 'utf8'), stacks)) copy(abs, `.claude/rules/${rel}`)
    }
    for (const rel of walk(join(layer, 'files'))) copy(join(layer, 'files', rel), rel, 'managed')
    for (const rel of walk(join(layer, 'seed'))) copy(join(layer, 'seed', rel), rel, 'seed')
    for (const rel of walk(join(layer, 'blocks'))) {
      if (excluded(rel)) continue
      if (blocks.has(rel)) errors.push(`two sources write the compass block in ${rel}`)
      else blocks.set(rel, readFileSync(join(layer, 'blocks', rel), 'utf8'))
    }
    if (existsSync(join(layer, 'keys.json'))) addKeys(join(layer, 'keys.json'))
  }

  for (const path of files.keys()) {
    if (keys.has(path) || blocks.has(path)) errors.push(`${path} is both a whole file and a merged file`)
  }
  for (const path of blocks.keys()) if (keys.has(path)) errors.push(`${path} has both a block and owned keys`)
  return { files, keys, blocks, skills, stacks, errors }
}
