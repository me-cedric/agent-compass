#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const START = 'compass: the style contract is on (ponytail full, i-have-adhd, caveman; asd-ste100 for durable text). ' +
  'One-line acknowledgement, no text between tool calls, one end summary with the changed files and each check with its result. ' +
  'The rules are in the compass block of AGENTS.md when the project has one, else in the compass-style skill.'

const TEMPLATE = /\.(example|sample|template)$/
const envFile = (p) => { const b = basename(p); return b.startsWith('.env') && !TEMPLATE.test(b) }
const words = (cmd) => cmd.split(/[\s'"`<>|;&()={},]+/).filter(Boolean)
const home = (p) => (p === '~' || p.startsWith('~/') ? join(homedir(), p.slice(1)) : p.replace(/^\$\{?HOME\}?(?=\/|$)/, homedir()))

const ENV_NAMES = ['.env', '.env.local', '.env.production', '.envrc']
const globHit = (glob) => {
  const re = new RegExp(`^${glob.split('/').pop().replace(/[.+^$()|\\]/g, '\\$&').replace(/\*+/g, '.*').replace(/\?/g, '.')
    .replace(/\{([^}]*)\}/g, (_, alt) => `(${alt.split(',').join('|')})`)}$`)
  return ENV_NAMES.find((n) => re.test(n))
}

// A key, a credential store or a keystore. A public key (.pub) is not a secret.
const SSH = /(^|[/\\])\.ssh([/\\]|$)/
const KEY_NAME = /^(id_(rsa|dsa|ecdsa|ed25519)(?!.*\.pub$).*|_?\.?netrc|google-services\.json|GoogleService-Info\.plist|[^.].*\.(pem|key|p12|pfx|keystore|jks))$/
const NPM_TOKEN = /^[^#;\n]*_(auth|authToken|password)\s*=\s*(?!\$\{)\S/m
const npmToken = (p) => { try { return NPM_TOKEN.test(readFileSync(home(p), 'utf8')) } catch { return false } }
const keyFile = (p) => SSH.test(p) || KEY_NAME.test(basename(p)) || (basename(p) === '.npmrc' && npmToken(p))
// A shell word counts only when it names a file that exists, so `e.key` in a script passes.
const keyWord = (w) => SSH.test(w) || (existsSync(home(w)) && keyFile(w))

const LOCKS = new Set(['package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb', 'Podfile.lock',
  'Package.resolved', 'gradle.lockfile', 'Cargo.lock', 'composer.lock', 'Gemfile.lock', 'poetry.lock', 'uv.lock'])
const COMPASS_LOCK = /(^|[/\\])\.agents[/\\]compass\.lock\.json$/
const PATCH_FILE = /^\*\*\* (?:(?:Update|Add|Delete) File|Move to): (.+)$/gm
const lockEdit = (paths) => {
  const hit = paths.find((p) => COMPASS_LOCK.test(p) || LOCKS.has(basename(p)))
  if (!hit) return null
  const fix = COMPASS_LOCK.test(hit) ? 'Run ac sync to change it.' : 'Run the package manager to change a lock file.'
  return `compass: the edit of ${hit} is blocked. ${fix}`
}

// Codex has no deny rules, so the guard blocks the MCP tools that the Claude deny rules block.
const MCP_DENY = /worklog|delete/i
const mcpBlock = (name) => MCP_DENY.test(name.split('__').slice(2).join('__')) &&
  `compass: the tool ${name} is blocked because the contract forbids a worklog or a delete. Ask the user to do it.`

const shortFlag = (args, c) => args.some((a) => /^-[a-zA-Z]+$/.test(a) && a.includes(c))
const GIT_OPTS_WITH_VALUE = ['-C', '-c', '--git-dir', '--work-tree', '--namespace']
const gitDanger = (w) => {
  let i = w.indexOf('git') + 1
  if (!i) return false
  while (w[i]?.startsWith('-')) i += GIT_OPTS_WITH_VALUE.includes(w[i]) ? 2 : 1
  const [sub, ...args] = w.slice(i)
  if (sub === 'push') return args.some((a) => a.startsWith('--force') || a.startsWith('+')) || shortFlag(args, 'f')
  if (sub === 'reset') return args.includes('--hard')
  if (sub === 'clean') return args.includes('--force') || shortFlag(args, 'f')
  return false
}
const RISKY = new Set(['/', '~', '~/', '.', './', '..', '../', '*', '$HOME', '${HOME}'])
const rmDanger = (w, cwd, root) => {
  const i = w.indexOf('rm')
  if (i < 0) return false
  const args = w.slice(i + 1)
  if (!args.includes('--recursive') && !shortFlag(args, 'r') && !shortFlag(args, 'R')) return false
  return args.filter((a) => !a.startsWith('-')).some((a) => {
    if (RISKY.has(a)) return true
    const rel = relative(root, resolve(cwd, home(a)))
    return rel === '' || rel === '..' || rel.startsWith(`..${sep}`) || isAbsolute(rel)
  })
}
const danger = (cmd, cwd) => {
  const root = process.env.CLAUDE_PROJECT_DIR || cwd
  const hit = cmd.split(/&&|\|\||[;|&\n]/).map((s) => s.trim())
    .find((s) => { const w = s.split(/\s+/).map((x) => x.replace(/^['"]|['"]$/g, '')).filter(Boolean); return gitDanger(w) || rmDanger(w, cwd, root) })
  return hit && `compass: the command \`${hit}\` is blocked because you cannot undo it. Ask the user to run it.`
}

const guard = (input) => {
  const name = typeof input.tool_name === 'string' ? input.tool_name : ''
  const t = input.tool_input || {}
  const cmd = Array.isArray(t.command) ? t.command.join(' ') : typeof t.command === 'string' ? t.command : ''
  if (name.startsWith('mcp__')) return mcpBlock(name)
  if (EDITS.has(name)) {
    const patch = [cmd, t.input, t.patch].filter((s) => typeof s === 'string').join('\n')
    return lockEdit([t.file_path, t.notebook_path, ...[...patch.matchAll(PATCH_FILE)].map((m) => m[1].trim())].filter((p) => typeof p === 'string'))
  }
  const paths = [t.file_path, t.path, t.notebook_path].filter((p) => typeof p === 'string')
  const glob = name === 'Glob' ? t.pattern : t.glob
  const env = [...paths, ...words(cmd)].find(envFile) || (typeof glob === 'string' && globHit(glob))
  if (env) return `compass: the read of ${env} is blocked because .env files hold secrets. Read .env.example, or ask the user for the variable names.`
  const key = paths.find(keyFile) || words(cmd).find(keyWord)
  if (key) return `compass: the read of ${key} is blocked because the file holds a key, a token or a credential. Ask the user for the value that you need.`
  return danger(cmd, typeof input.cwd === 'string' ? input.cwd : process.cwd())
}

const EDITS = new Set(['Edit', 'MultiEdit', 'Write', 'NotebookEdit', 'apply_patch'])
// A call to a worker agent or to a workflow edits files too. ponytail: an edit through Bash (sed -i) is not seen.
const edits = (c) => c.type === 'tool_use' && (EDITS.has(c.name) || c.name === 'Workflow' ||
  (['Agent', 'Task'].includes(c.name) && c.input?.subagent_type === 'worker'))
const RESULT = /\b(pass(ed|es|ing)?|fail(ed|s|ing|ures?)?|succeeded|green|not run)\b/i

const textOf = (content) => (typeof content === 'string' ? content
  : Array.isArray(content) ? content.filter((c) => typeof c?.text === 'string').map((c) => c.text).join('\n') : '')

// The last turn of a Claude Code or Codex transcript: did it edit files, and what did the assistant say last?
const lastTurn = (path) => {
  let edited = false
  let text = ''
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    let e
    try { e = JSON.parse(line) } catch { continue }
    const p = e.payload || {}
    const content = e.message?.content
    const prompt = (e.type === 'user' && !e.isMeta && (typeof content === 'string' || content?.some?.((c) => c.type === 'text'))) ||
      (e.type === 'event_msg' && p.type === 'user_message')
    if (prompt) { edited = false; text = ''; continue }
    if (e.type === 'assistant' && Array.isArray(content)) {
      if (content.some(edits)) edited = true
      text = textOf(content) || text
    }
    if (e.type === 'response_item' && ['function_call', 'custom_tool_call'].includes(p.type) && EDITS.has(p.name)) edited = true
    if (e.type === 'response_item' && p.type === 'message' && p.role === 'assistant') text = textOf(p.content) || text
  }
  return { edited, text }
}

const gate = (input) => {
  if (input.stop_hook_active || typeof input.transcript_path !== 'string') return null
  const turn = lastTurn(input.transcript_path)
  const text = typeof input.last_assistant_message === 'string' ? input.last_assistant_message : turn.text
  if (!turn.edited || RESULT.test(text)) return null
  return 'compass completion gate: this turn changed files. End with one summary: the changed files, each check command, ' +
    'and its result (passed, failed, or not run with the reason). Do not say "done" when a check did not run.'
}

const read = () => { try { return JSON.parse(readFileSync(0, 'utf8') || '{}') } catch { return null } }

// The compass lock marks a project with its own copy. That copy sits beside the lock: .agents/hooks/ and .agents/compass.lock.json.
// A copy outside the project (the user plugin) steps back for an event only when the project hook runs it: the project
// lock owns the hook key of that event. A host that kept its own hooks still gets the .env guard from the user copy.
const EVENTS = { start: 'SessionStart', guard: 'PreToolUse', gate: 'Stop' }
const deferred = (mode) => {
  if (existsSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'compass.lock.json'))) return false
  let lock
  try { lock = JSON.parse(readFileSync(join(process.env.CLAUDE_PROJECT_DIR || process.cwd(), '.agents', 'compass.lock.json'), 'utf8')) } catch { return false }
  const file = process.env.CLAUDE_PROJECT_DIR ? '.claude/settings.json' : '.codex/hooks.json'
  return Boolean(lock?.keys?.[file]?.[`hooks.${EVENTS[mode]}`])
}

const mode = process.argv[2]
if (!['start', 'guard', 'gate'].includes(mode)) {
  console.error('usage: compass.mjs guard|gate|start')
  process.exitCode = 1
} else if (!deferred(mode)) {
  if (mode === 'start') console.log(START)
  else {
    const input = read()
    let reason = null
    try { reason = input && (mode === 'guard' ? guard(input) : gate(input)) } catch { reason = null }
    if (reason) {
      console.error(reason)
      process.exitCode = 2
    }
  }
}
