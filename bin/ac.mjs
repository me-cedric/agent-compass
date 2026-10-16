#!/usr/bin/env node
// ac — the agent-compass engine CLI. No prompts. Exit 0: success. Exit 1: errors or drift. Exit 2: usage error.

import { spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { doctor } from '../engine/doctor.mjs'
import { pinTag } from '../engine/git.mjs'
import { syncHost } from '../engine/sync.mjs'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))
const COMMANDS = ['init', 'sync', 'check', 'doctor']
const USAGE = `Usage: ac <command> [options]

Commands:
  init     Create .agents/compass.json if it is missing. Then sync.
  sync     Write the compass files, keys and blocks into the project.
  check    Compare the project with the compass state. Write nothing.
  doctor   Check the tools, the configuration and the ownership rules.

Options:
  --root <dir>   Use this project root. The default is the current directory.
  --dry          Show the changes. Write nothing.
  --json         Print the result as JSON.
  --frozen       With check: exit 1 if the project is different from the lock.
  --to <tag>     With sync: check out this compass tag, then sync with it.
  --help, -h     Show this help.`

const HINTS = {
  kept: 'Edited items stay as they are. Revert an item to get updates, or add it to "exclude" in .agents/compass.json.',
  release: 'Released items stay on disk. The lock does not record them in their old form now.',
}

const usage = (message) => {
  console.error(`${message}\n\n${USAGE}`)
  return 2
}

const print = (command, opts, result, failed, root) => {
  if (opts.json) {
    console.log(JSON.stringify({ command, dry: Boolean(opts.dry) || command === 'check', ...result, ok: !failed }, null, 2))
    return
  }
  if (command === 'doctor') {
    console.log(`ac doctor → ${root}`)
    for (const c of result.checks) console.log(`  ${c.status.padEnd(5)} ${c.name.padEnd(8)} ${c.detail}`)
    return
  }
  console.log(`ac ${command}${opts.dry ? ' (dry)' : ''} → ${root}  (compass ${result.version}${result.tag ? ` ${result.tag}` : ''})`)
  for (const w of result.warnings) console.log(`  warn    ${w}`)
  for (const c of result.changes) console.log(`  ${c.action.padEnd(7)} ${c.path}${c.key ? `#${c.key}` : ''}`)
  for (const [action, hint] of Object.entries(HINTS)) if (result.changes.some((c) => c.action === action)) console.log(hint)
  for (const e of result.errors) console.error(`error: ${e}`)
  if (result.ok) console.log(result.drift ? `${result.changes.length} change(s).` : 'Up to date.')
  if (command === 'check' && opts.frozen && result.drift) console.error('error: the project is different from the compass lock; run "ac sync"')
}

const main = () => {
  let parsed
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: {
        root: { type: 'string' },
        dry: { type: 'boolean' },
        json: { type: 'boolean' },
        frozen: { type: 'boolean' },
        to: { type: 'string' },
        help: { type: 'boolean', short: 'h' },
      },
    })
  } catch (err) {
    return usage(err.message)
  }
  const { values: opts, positionals } = parsed
  if (opts.help) {
    console.log(USAGE)
    return 0
  }
  const [command, ...extra] = positionals
  if (!COMMANDS.includes(command)) return usage(command ? `Unknown command: ${command}` : 'A command is necessary.')
  if (extra.length) return usage(`Unexpected argument: ${extra[0]}`)
  if (opts.frozen && command !== 'check') return usage('--frozen applies to check only.')
  if (opts.to !== undefined && command !== 'sync') return usage('--to applies to sync only.')

  const fail = (message) => {
    if (opts.json) console.log(JSON.stringify({ command, ok: false, errors: [message] }, null, 2))
    else console.error(`error: ${message}`)
    return 1
  }
  const root = resolve(opts.root || process.cwd())
  let same
  try { same = realpathSync(root) === realpathSync(AC) } catch { return fail(`the project root ${root} does not exist`) }
  if (same) return fail('run ac from the project root, not from the compass checkout')

  if (opts.to !== undefined) {
    const pin = pinTag(AC, opts.to, { dry: opts.dry })
    if (!pin.ok) return fail(pin.error)
    if (opts.dry) {
      console.log(opts.json ? JSON.stringify({ command, ok: true, dry: true, pin: pin.message }, null, 2) : pin.message)
      return 0
    }
    if (opts.json) console.error(pin.message)
    else console.log(pin.message)
    // Sync with the engine of the new tag, not with the code that is already loaded.
    const args = [join(AC, 'bin/ac.mjs'), 'sync', '--root', root, ...(opts.json ? ['--json'] : [])]
    return spawnSync(process.execPath, args, { stdio: 'inherit', timeout: 300_000 }).status ?? 1
  }

  const result = command === 'doctor'
    ? doctor({ AC, root })
    : syncHost({ AC, root, init: command === 'init', apply: command !== 'check' && !opts.dry })
  const failed = !result.ok || (command === 'check' && Boolean(opts.frozen) && result.drift)
  print(command, opts, result, failed, root)
  return failed ? 1 : 0
}

// exitCode, not exit(): exit() can cut piped output short.
try {
  process.exitCode = main()
} catch (err) {
  console.error(`error: ${err.message}`)
  process.exitCode = 1
}
