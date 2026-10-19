// run-plan.mjs — turn an agent-compass.commands.json entry into argv, env words and a time limit. No shell is used.

import { statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { isObj } from './util.mjs'

export const REGISTRY = 'agent-compass.commands.json'
export const MAX_SECONDS = 2_147_483
const DESTRUCTIVE = /\b(push|deploy|publish|release|force)\b|\brm\s|reset\s+--hard|drop\s+(table|database)|--force\b/i
const ENV_WORD = /^[A-Za-z_][A-Za-z0-9_]*=/
// A word is plain characters, double-quoted text without $ or `, and single-quoted text. Other shell characters stop the match.
const WORD = /(?:[^\s"'$`|&;<>()*?~{}[\]!\\]|"[^"$`]*"|'[^']*')+/y

export const runnable = (v) => typeof v === 'string' || (isObj(v) && typeof v.cmd === 'string')
export const names = (node, prefix = '') => Object.entries(node).flatMap(([k, v]) => (runnable(v) ? [`${prefix}${k}`] : isObj(v) ? names(v, `${prefix}${k}.`) : []))

const tokenize = (cmd) => {
  const words = []
  for (let i = 0; i < cmd.length;) {
    if (/\s/.test(cmd[i])) { i++; continue }
    WORD.lastIndex = i
    const m = WORD.exec(cmd)
    if (!m) {
      const end = cmd.indexOf(cmd[i], i + 1)
      if (/["']/.test(cmd[i]) && end < 0) return { error: 'has a quote that is not closed' }
      return { shell: /["']/.test(cmd[i]) ? /[$`]/.exec(cmd.slice(i, end))[0] : cmd[i] }
    }
    words.push(m[0].replace(/"([^"]*)"|'([^']*)'/g, '$1$2'))
    i = WORD.lastIndex
  }
  return { words }
}

// A registry entry to what spawn needs, or { error }.
export const prepare = (name, entry, { confirm, seconds }) => {
  const cmd = typeof entry === 'string' ? entry : entry.cmd
  const placeholder = /<[A-Za-z][\w.-]*>/.exec(cmd)
  if (placeholder) return { error: `${name} has the placeholder ${placeholder[0]}. Replace it in ${REGISTRY} first.` }
  const { words, shell, error } = tokenize(cmd)
  if (shell) return { error: `${name} needs a shell; compass runs registry commands without one (found ${shell}).` }
  if (error) return { error: `${name} ${error}.` }
  const split = words.findIndex((w) => !ENV_WORD.test(w))
  if (split < 0) return { error: `${name} has no command to run.` }
  const destructive = isObj(entry) && typeof entry.destructive === 'boolean' ? entry.destructive : DESTRUCTIVE.test(cmd)
  if (destructive && !confirm) return { error: `${name} looks destructive (${cmd}). Run it again with --confirm.` }
  if (isObj(entry) && entry.timeout > MAX_SECONDS) return { error: `${name} has a timeout above ${MAX_SECONDS} seconds.` }
  const env = Object.fromEntries(words.slice(0, split).map((w) => [w.slice(0, w.indexOf('=')), w.slice(w.indexOf('=') + 1)]))
  return { cmd, argv: words.slice(split), env, limit: (seconds ?? (isObj(entry) && entry.timeout > 0 ? entry.timeout : 1800)) * 1000 }
}

const isFile = (p) => { try { return statSync(p).isFile() } catch { return false } }

// Windows starts a .cmd or .bat file (npm, npx, pnpm) only through cmd.exe, and Node does not look it up on PATH.
// Find argv[0] with PATHEXT. For a .cmd or .bat file, give the cmd.exe line; otherwise null (spawn it as it is).
// cmd.exe expands % and ^, and a " ends the quoted argument, so an argument with one of them is refused (BatBadBut).
// A relative command path counts from cwd, the folder that the command runs in.
export const windowsStart = (argv, { env = process.env, exists = isFile, cwd } = {}) => {
  const [name, ...args] = argv
  const exts = ['', ...(env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)]
  const dirs = /[\\/]/.test(name) ? [''] : (env.PATH ?? env.Path ?? '').split(';').filter(Boolean)
  const found = dirs.flatMap((dir) => exts.map((ext) => (dir ? join(dir, name + ext) : name + ext))).find((p) => exists(cwd ? resolve(cwd, p) : p))
  if (!found || !/\.(cmd|bat)$/i.test(found)) return null
  const bad = argv.find((a) => /["%^\r\n]/.test(a))
  if (bad !== undefined) return { error: `cmd.exe runs ${name}, so an argument cannot hold ", %, ^ or a line break (found in ${bad})` }
  // A trailing backslash would escape the closing quote for the program that reads the arguments.
  const line = [found, ...args].map((a) => `"${a.replace(/(\\+)$/, '$1$1')}"`).join(' ')
  return { cmd: env.ComSpec || env.COMSPEC || 'cmd.exe', args: ['/d', '/s', '/c', `"${line}"`] }
}
