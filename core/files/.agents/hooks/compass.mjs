#!/usr/bin/env node
// compass.mjs — compass hooks for Claude Code and Codex (same stdin JSON, same exit codes).
//   guard  PreToolUse:   exit 2 blocks a Read, Grep or shell call that names a .env file.
//   gate   Stop:         exit 2 asks for the completion-gate summary once, after a turn that edited files.
//   start  SessionStart: print the style reminder.
// A hook that cannot read its input exits 0. A guard rail must not stop the session.

import { readFileSync } from 'node:fs'
import { basename } from 'node:path'

const START = 'compass: the style contract is on (ponytail full, i-have-adhd, caveman; asd-ste100 for durable text). ' +
  'One-line acknowledgement, no text between tool calls, one end summary with the changed files and each check with its result. ' +
  'The rules are in the compass block of AGENTS.md.'

const TEMPLATE = /\.(example|sample|template)$/
const secretFile = (p) => { const b = basename(p); return b.startsWith('.env') && !TEMPLATE.test(b) }
// ponytail: word split, not a shell parser. It stops a plain read, not a read that hides the file name.
const words = (cmd) => cmd.split(/[\s'"`<>|;&()={},]+/).filter(Boolean)

// A Grep glob such as `*.env` names no file, so test it against typical .env names. Only the last segment counts.
const ENV_NAMES = ['.env', '.env.local', '.env.production', '.envrc']
const globHit = (glob) => {
  const re = new RegExp(`^${glob.split('/').pop().replace(/[.+^$()|\\]/g, '\\$&').replace(/\*+/g, '.*').replace(/\?/g, '.')
    .replace(/\{([^}]*)\}/g, (_, alt) => `(${alt.split(',').join('|')})`)}$`)
  return ENV_NAMES.find((n) => re.test(n))
}

const guard = (input) => {
  const t = input.tool_input || {}
  const paths = [t.file_path, t.path, t.notebook_path].filter((p) => typeof p === 'string')
  const cmd = Array.isArray(t.command) ? t.command.join(' ') : typeof t.command === 'string' ? t.command : ''
  const hit = [...paths, ...words(cmd)].find(secretFile) || (typeof t.glob === 'string' && globHit(t.glob))
  return hit && `compass: the read of ${hit} is blocked because .env files hold secrets. Read .env.example, or ask the user for the variable names.`
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

const mode = process.argv[2]
if (mode === 'start') console.log(START)
else if (mode === 'guard' || mode === 'gate') {
  const input = read()
  let reason = null
  try { reason = input && (mode === 'guard' ? guard(input) : gate(input)) } catch { reason = null }
  if (reason) {
    console.error(reason)
    process.exitCode = 2
  }
} else {
  console.error('usage: compass.mjs guard|gate|start')
  process.exitCode = 1
}
