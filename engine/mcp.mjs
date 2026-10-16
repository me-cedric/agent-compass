// mcp.mjs — turn mcp/catalog.json and the project picks into owned keys for the Claude, Codex and Copilot MCP files.
// A secret value is "${VAR}" ("Bearer ${VAR}" in an Authorization header). Claude expands "${VAR}" itself and Copilot
// reads "${env:VAR}". Codex cannot expand it, so a Codex entry names the variable (env_vars, bearer_token_env_var,
// env_http_headers) and never holds "${".

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isObj, safeRel } from './util.mjs'

export const CATALOG = 'mcp/catalog.json'
const REF = /^\$\{([A-Z][A-Z0-9_]*)\}$/
const BEARER = /^Bearer \$\{([A-Z][A-Z0-9_]*)\}$/
const PROVIDERS = ['claude', 'codex', 'copilot']

const empty = (v) => v === undefined || (Array.isArray(v) ? !v.length : isObj(v) && !Object.keys(v).length)
const prune = (obj) => Object.fromEntries(Object.entries(obj).filter(([, v]) => !empty(v)))
const transport = (e) => (e.transport === 'sse' ? 'sse' : 'http')

const claude = (e) => prune(e.command
  ? { command: e.command, args: e.args, env: e.env }
  : { type: transport(e), url: e.url, headers: e.headers })

const envRef = (rec) => rec && Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, v.replace(/\$\{(\w+)\}/g, '${env:$1}')]))
const copilot = (e) => prune(e.command
  ? { type: 'stdio', command: e.command, args: e.args, env: envRef(e.env) }
  : { type: transport(e), url: e.url, headers: envRef(e.headers) })

// Split a record into literal values and the variable names of its "${VAR}" values.
const split = (rec = {}) => {
  const literal = {}
  const named = {}
  for (const [k, v] of Object.entries(rec)) {
    const name = REF.exec(v)?.[1]
    if (name) named[k] = name
    else literal[k] = v
  }
  return { literal, named }
}

// ponytail: Codex forwards a stdio variable by its own name, so a catalog env key must equal its variable (test/mcp.test.mjs checks it).
const codex = (e) => {
  if (e.transport === 'sse') return null
  if (e.command) {
    const { literal, named } = split(e.env)
    return prune({ command: e.command, args: e.args, env: literal, env_vars: Object.values(named) })
  }
  const { Authorization: auth, ...rest } = e.headers || {}
  const bearer = BEARER.exec(auth || '')?.[1]
  const { literal, named } = split(bearer || auth === undefined ? rest : { ...rest, Authorization: auth })
  return prune({ url: e.url, bearer_token_env_var: bearer, http_headers: literal, env_http_headers: named })
}

const TARGETS = [
  ['claude', '.mcp.json', 'mcpServers', claude],
  ['codex', '.codex/config.toml', 'mcp_servers', codex],
  ['copilot', '.vscode/mcp.json', 'servers', copilot],
]

const loadCatalog = (AC) => {
  const path = join(AC, CATALOG)
  if (!existsSync(path)) return { servers: {} }
  try {
    const data = JSON.parse(readFileSync(path, 'utf8'))
    return isObj(data?.servers) ? { servers: data.servers } : { servers: {}, error: `${CATALOG}: "servers" must be an object` }
  } catch (err) {
    return { servers: {}, error: `${CATALOG}: ${err.message}` }
  }
}

// A value with "${" is valid only as "${VAR}", or as "Bearer ${VAR}" in an Authorization header.
const shape = (name, e) => {
  if (!/^[a-z][a-z0-9-]*$/.test(name)) return `${CATALOG}: "${name}" is not a valid server name`
  if (typeof (e.command ?? e.url) !== 'string') return `${CATALOG}: ${name} needs a command or a url`
  if ((e.args || []).some((a) => String(a).includes('${'))) return `${CATALOG}: ${name} has "\${" in args`
  const bad = [...Object.values(e.env || {}), ...Object.entries(e.headers || {}).map(([k, v]) => (k === 'Authorization' && BEARER.test(v) ? '' : v))]
    .find((v) => typeof v !== 'string' || (v.includes('${') && !REF.test(v)))
  return bad === undefined ? null : `${CATALOG}: ${name} has a value that compass cannot write: use "\${VAR}"`
}

// Picks: .agents/compass.json "mcp", plus the servers that list a detected stack. "mcp:<name>" in "exclude" removes one.
export const mcpPlan = ({ AC, config, stacks }) => {
  const { servers, error } = loadCatalog(AC)
  const errors = error ? [error] : []
  const warnings = []
  const want = new Set(config.mcp ?? [])
  for (const [name, e] of Object.entries(servers)) if ((e.stacks || []).some((s) => stacks.includes(s))) want.add(name)

  const selected = []
  for (const name of [...want].sort()) {
    if (!Object.hasOwn(servers, name)) { errors.push(`.agents/compass.json: unknown MCP server "${name}"`); continue }
    if ((config.exclude ?? []).includes(`mcp:${name}`)) continue
    const bad = shape(name, servers[name])
    if (bad) errors.push(bad)
    else selected.push(name)
  }

  const keys = new Map()
  const files = new Map()
  const deny = new Set()
  for (const name of selected) {
    const e = servers[name]
    const providers = e.providers || PROVIDERS
    if (e.status === 'trial') warnings.push(`MCP server "${name}" is a trial server`)
    for (const [provider, file, root, render] of TARGETS) {
      const value = providers.includes(provider) && render(e)
      if (value) keys.set(file, (keys.get(file) || new Map()).set(`${root}.${name}`, value))
    }
    if (providers.includes('claude')) for (const pattern of e.deny || []) deny.add(pattern)
    for (const [dest, src] of Object.entries(e.files || {})) {
      if (safeRel(dest) && safeRel(src) && existsSync(join(AC, src))) files.set(dest, join(AC, src))
      else errors.push(`${CATALOG}: ${name} lists the file ${src}, which compass cannot use`)
    }
  }
  return { keys, files: [...files], deny: [...deny], selected, errors, warnings }
}
