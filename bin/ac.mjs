#!/usr/bin/env node
// ac — the agent-compass engine CLI. No prompts. Exit 0: success. Exit 1: errors or drift. Exit 2: usage error.

import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { checkDocs } from '../engine/docs.mjs'
import { doctor } from '../engine/doctor.mjs'
import { pinTag } from '../engine/git.mjs'
import { migrateDocs, stageSpecs } from '../engine/migrate.mjs'
import { syncHost } from '../engine/sync.mjs'
import { hostRoot } from '../engine/util.mjs'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))
const COMMANDS = ['init', 'sync', 'check', 'doctor', 'migrate']
// Dev-loop commands parse their own options. Each module exports cli(argv, { AC }) that returns the exit code.
const DEV_LOOP = { env: 'env.mjs', dev: 'dev.mjs', run: 'run.mjs' }
const USAGE = `Usage: ac <command> [options]

Commands:
  init     Create .agents/compass.json if it is missing. Then sync.
  sync     Fetch the upstream sources that .agents/compass.json lists. Then write the
           compass files, keys and blocks into the project.
  check    Compare the project with the compass state and check the docs layout. Write nothing.
  doctor   Check the tools, the configuration and the ownership rules.
  migrate  With --docs: move spec-kit specs, a root specs/ folder and single-file question
           registers to the Konvoy layout. Each source moves under migrated/.
  env      check | export | import | run: check the env catalog, templates, code reads and
           local files; share values encrypted with age; start a command with the values.
  dev      up | down | status | logs: start and stop the local stack with process-compose.
  run      Run a command from agent-compass.commands.json by name. Store the result in
           .agents/runs/<timestamp>/.

Use "ac <env|dev|run> --help" for the options of a dev-loop command.

Options:
  --root <dir>   Use this project root. The default is the current directory.
  --dry          Show the changes. Write nothing.
  --json         Print the result as JSON.
  --frozen       With check: exit 1 if the project is different from the lock.
  --to <tag>     With sync: check out this compass tag, then sync with it.
  --tokens       With doctor: measure the always-on context and check the budgets.
  --docs         With check: check only the docs layout. With migrate: necessary.
  --from-specs <dir>
                 With init: create the docs layout and copy the documents in <dir> into
                 the OpenSpec inbox. Then run the spec-flow skill.
  --help, -h     Show this help.`

const HINTS = {
  kept: 'Edited items stay as they are. Revert an item to get updates, or add it to "exclude" in .agents/compass.json.',
  release: 'Released items stay on disk. The lock does not record them in their old form now.',
}

const usage = (message) => {
  console.error(`${message}\n\n${USAGE}`)
  return 2
}

const printDocs = (docs) => {
  for (const w of docs.warnings) console.log(`  warn    docs: ${w}`)
  for (const e of docs.errors) console.error(`error: ${e}`)
  if (docs.ok) console.log(`Docs layout: ${docs.warnings.length ? `ok with ${docs.warnings.length} warning(s)` : 'ok'} (paths from ${docs.pathsFrom}).`)
}

const ARROW = { migrate: 'change', move: 'move', manual: 'manual' }

const printMigrate = (result, opts, root) => {
  console.log(`ac migrate --docs${opts.dry ? ' (dry)' : ''} → ${root}`)
  for (const i of result.items) {
    const to = i.action === 'manual' ? `: ${i.note}` : ` → migrated/${i.source}${i.note ? `  (${i.note})` : ''}`
    console.log(`  ${ARROW[i.action].padEnd(7)} ${i.type.padEnd(15)} ${i.source}${to}`)
  }
  for (const e of result.errors) console.error(`error: ${e}`)
  if (!result.ok) return
  const count = (a) => result.items.filter((i) => i.action === a).length
  console.log(result.items.length ? `${count('migrate')} change(s), ${count('move')} move(s), ${count('manual')} manual item(s).` : 'Nothing to migrate.')
  if (opts.dry && result.items.some((i) => i.action !== 'manual')) console.log('Run without --dry to apply. Sources move under migrated/; nothing is deleted.')
}

const print = (command, opts, result, failed, root) => {
  if (opts.json) {
    console.log(JSON.stringify({ command, dry: Boolean(opts.dry) || command === 'check', ...result, ok: !failed }, null, 2))
    return
  }
  if (command === 'migrate') return printMigrate(result, opts, root)
  if (result.docsOnly) {
    console.log(`ac check --docs → ${root}`)
    return printDocs(result.docs)
  }
  if (result.stage && !result.stage.ok) {
    for (const e of result.stage.errors) console.error(`error: ${e}`)
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
  if (result.stage) {
    for (const w of result.stage.warnings) console.log(`  warn    ${w}`)
    for (const c of result.stage.changes) console.log(`  ${c.action.padEnd(7)} ${c.path}`)
    if (result.ok) console.log(result.stage.next)
  }
  if (result.docs) printDocs(result.docs)
}

const main = async () => {
  const first = process.argv[2]
  if (Object.hasOwn(DEV_LOOP, first)) {
    const { cli } = await import(`../engine/${DEV_LOOP[first]}`)
    return cli(process.argv.slice(3), { AC })
  }
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
        tokens: { type: 'boolean' },
        docs: { type: 'boolean' },
        'from-specs': { type: 'string' },
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
  if (opts.tokens && command !== 'doctor') return usage('--tokens applies to doctor only.')
  if (opts.docs && !['check', 'migrate'].includes(command)) return usage('--docs applies to check and migrate only.')
  if (command === 'migrate' && !opts.docs) return usage('migrate needs --docs.')
  if (opts.docs && opts.frozen) return usage('--frozen does not apply with --docs.')
  if (opts['from-specs'] !== undefined && command !== 'init') return usage('--from-specs applies to init only.')
  if (opts['from-specs'] === '') return usage('--from-specs needs a folder.')

  const fail = (message) => {
    if (opts.json) console.log(JSON.stringify({ command, ok: false, errors: [message] }, null, 2))
    else console.error(`error: ${message}`)
    return 1
  }
  const host = hostRoot(AC, opts.root)
  if (host.error) return fail(host.error)
  const { root } = host

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

  const apply = command !== 'check' && !opts.dry
  let result
  if (command === 'doctor') result = doctor({ AC, root, tokens: Boolean(opts.tokens) })
  else if (command === 'migrate') result = migrateDocs({ AC, root, apply })
  else if (command === 'check' && opts.docs) {
    const docs = checkDocs({ AC, root })
    result = { ok: docs.ok, docsOnly: true, docs }
  } else {
    // --from-specs stages first, so the sync sees the new OpenSpec dir and installs the schema there.
    const stage = opts['from-specs'] !== undefined ? stageSpecs({ AC, root, input: opts['from-specs'], apply }) : null
    result = stage && !stage.ok ? { ok: false, errors: [], warnings: [], changes: [], stage } : syncHost({ AC, root, init: command === 'init', apply })
    if (stage) result = { ...result, stage }
    if (command === 'check') result = { ...result, docs: checkDocs({ AC, root }) }
  }
  const failed = !result.ok || (result.stage && !result.stage.ok) || (result.docs && !result.docs.ok) ||
    (command === 'check' && Boolean(opts.frozen) && result.drift)
  print(command, opts, result, failed, root)
  return failed ? 1 : 0
}

// exitCode, not exit(): exit() can cut piped output short.
try {
  process.exitCode = await main()
} catch (err) {
  console.error(`error: ${err.message}`)
  process.exitCode = 1
}
