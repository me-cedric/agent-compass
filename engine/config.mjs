// config.mjs — the project config (.agents/compass.json) and the Konvoy ledger (.agents/konvoy.json).
// Konvoy owns its ledger. Compass reads it for path keys and for the files, skills and keys that Konvoy owns.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isDir, isObj, safeRel } from './util.mjs'

export const CONFIG = '.agents/compass.json'
export const KONVOY = '.agents/konvoy.json'
export const LOCK = '.agents/compass.lock.json'
export const SCHEMA = 'konvoy-delivery'
export const DEFAULT_CONFIG = { version: 1, packs: [], exclude: [] }

// Konvoy RepoPaths keys and defaults (konvoy src-tauri/src/infrastructure/config.rs).
export const PATH_DEFAULTS = {
  diagrams: 'docs/diagrams',
  adr: 'docs/decisions',
  openapi: 'docs/api',
  costing: 'docs/costing',
  designs: 'docs/designs',
  flows: 'docs/network/flows.json',
  drawings: 'docs/drawings',
  slides: 'docs/slides',
  data_models: 'docs/data-models',
  personas: 'docs/personas/personas.json',
  openspec: 'docs/openspec',
  delivery: 'docs/delivery',
  planning: 'docs/planning',
  test_plans: 'docs/delivery/test-plans',
}

// The OpenSpec schema dir. Compass installs the schema there only when the Konvoy ledger is absent.
export const schemaDir = (paths) => `${paths.openspec}/schemas/${SCHEMA}/`

// Konvoy writes its MCP server under these keys in the provider files.
const KONVOY_KEYS = { '.mcp.json': ['mcpServers.konvoy'], '.codex/config.toml': ['mcp_servers.konvoy'], '.vscode/mcp.json': ['servers.konvoy'] }

const parse = (root, rel) => {
  try {
    return { data: JSON.parse(readFileSync(join(root, rel), 'utf8')) }
  } catch (err) {
    return { error: `${rel}: ${err.message}` }
  }
}

const strings = (v) => Array.isArray(v) && v.every((s) => typeof s === 'string' && s !== '')

// strict: an unknown key is an error (compass.json). Konvoy may add keys, so its unknown keys are skipped.
const readPaths = (paths, label, errors, strict) => {
  if (paths === undefined) return {}
  if (!isObj(paths)) { errors.push(`${label}: "paths" must be an object`); return {} }
  const out = {}
  for (const [key, value] of Object.entries(paths)) {
    const rel = typeof value === 'string' ? value.replace(/\/+$/, '') : value
    if (!(key in PATH_DEFAULTS)) { if (strict) errors.push(`${label}: paths.${key} is not a known path key`) }
    else if (!safeRel(rel)) errors.push(`${label}: paths.${key} must be a relative path inside the repository`)
    else out[key] = rel
  }
  return out
}

export const loadConfig = (root, AC, { init = false } = {}) => {
  if (!existsSync(join(root, CONFIG))) {
    return init ? { config: { ...DEFAULT_CONFIG, upstream: [], paths: {} }, created: true, errors: [] } : { errors: [`${CONFIG} not found; run "ac init" first`] }
  }
  const { data, error } = parse(root, CONFIG)
  if (error) return { errors: [error] }
  if (!isObj(data)) return { errors: [`${CONFIG}: the file must hold a JSON object`] }
  const errors = []
  const config = { ...DEFAULT_CONFIG, ...data }
  if (!strings(config.exclude)) errors.push(`${CONFIG}: "exclude" must be a list of names and paths`)
  if (data.upstream !== undefined && !strings(data.upstream)) errors.push(`${CONFIG}: "upstream" must be a list of upstream source ids`)
  if (!strings(config.packs)) errors.push(`${CONFIG}: "packs" must be a list of pack names`)
  else {
    for (const pack of config.packs) {
      if (!/^[a-z0-9-]+$/.test(pack) || !isDir(join(AC, 'packs', pack))) errors.push(`${CONFIG}: unknown pack "${pack}"`)
    }
  }
  return { config: { ...config, upstream: strings(data.upstream) ? data.upstream : [], paths: readPaths(data.paths, CONFIG, errors, true) }, errors }
}

const names = (v) => (isObj(v) ? Object.keys(v) : Array.isArray(v) ? v.filter((s) => typeof s === 'string') : [])

// Konvoy ownership. `owns` is the 1.0 contract; the other keys are what Konvoy 0.x already records.
export const loadKonvoy = (root) => {
  if (!existsSync(join(root, KONVOY))) return { konvoy: null, errors: [] }
  const { data, error } = parse(root, KONVOY)
  if (error) return { konvoy: null, errors: [error] }
  if (!isObj(data)) return { konvoy: null, errors: [`${KONVOY}: the file must hold a JSON object`] }
  const errors = []
  const paths = readPaths(data.paths, KONVOY, errors, false)
  const owns = isObj(data.owns) ? data.owns : {}
  const keys = { ...KONVOY_KEYS }
  for (const [file, list] of Object.entries(isObj(owns.keys) ? owns.keys : {})) keys[file] = [...(keys[file] || []), ...names(list)]
  return {
    errors,
    konvoy: {
      paths,
      skills: new Set([...names(data.compass_skills), ...names(data.taste_skills), ...names(owns.skills)]),
      files: new Set([KONVOY, ...names(data.host_files), ...names(owns.files)]),
      prefixes: [`${paths.delivery || PATH_DEFAULTS.delivery}/`, schemaDir({ ...PATH_DEFAULTS, ...paths })],
      keys,
    },
  }
}

// Konvoy paths win when its ledger exists. Else compass.json paths, else the defaults.
export const resolvePaths = (config, konvoy) => {
  if (!konvoy) {
    const from = Object.keys(config.paths).length ? CONFIG : 'defaults'
    return { paths: { ...PATH_DEFAULTS, ...config.paths }, from, warnings: [] }
  }
  const warnings = Object.keys(config.paths).length ? [`${CONFIG}: "paths" is ignored because ${KONVOY} exists`] : []
  return { paths: { ...PATH_DEFAULTS, ...konvoy.paths }, from: KONVOY, warnings }
}

// Paths for a command that can run before "ac init": the same rules, with the default config when compass.json is absent.
export const projectPaths = (root, AC) => {
  const cfg = loadConfig(root, AC, { init: true })
  const kv = loadKonvoy(root)
  const errors = [...cfg.errors, ...kv.errors]
  if (errors.length) return { errors, warnings: [] }
  return { ...resolvePaths(cfg.config, kv.konvoy), konvoy: kv.konvoy, errors }
}

export const konvoyOwns = (konvoy, rel) => konvoy.files.has(rel) || konvoy.prefixes.some((p) => rel.startsWith(p))

// The rules of docs/contract/ownership.md that need both ledgers.
export const ownershipErrors = (plan, lock, konvoy) => {
  if (!konvoy) return []
  const errors = []
  for (const rel of [CONFIG, LOCK]) if (konvoy.files.has(rel)) errors.push(`${KONVOY} lists ${rel}, but compass owns that file`)
  for (const name of new Set([...plan.skills, ...lock.skills])) {
    if (konvoy.skills.has(name)) errors.push(`skill "${name}" is in both ledgers (${KONVOY} and the compass lock)`)
  }
  for (const rel of plan.files.keys()) if (konvoyOwns(konvoy, rel)) errors.push(`${rel} belongs to Konvoy`)
  for (const rel of new Set([...plan.keys.keys(), ...plan.blocks.keys()])) {
    if (konvoyOwns(konvoy, rel)) errors.push(`${rel} belongs to Konvoy as a whole file, so compass cannot own keys or a block in it`)
  }
  for (const [file, keys] of plan.keys) {
    for (const key of keys.keys()) {
      const taken = (konvoy.keys[file] || []).find((k) => k === key || key.startsWith(`${k}.`) || k.startsWith(`${key}.`))
      if (taken) errors.push(`${file}#${key} overlaps the Konvoy key ${taken}`)
    }
  }
  return errors
}
