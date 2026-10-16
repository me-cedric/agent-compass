// promote.mjs — ac promote: copy a project skill into skills/ of this compass checkout.
// A project skill is a dir in .claude/skills/ that neither the compass lock nor the Konvoy ledger owns.
// The checks refuse a secret, the project name, an absolute path and an existing target. The project copy stays.

import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { findIssues } from '../scripts/lib/redact.mjs'
import { loadKonvoy } from './config.mjs'
import { readLock } from './sync.mjs'
import { dirs, failCommand, frontmatter, hostRoot, parseCommand, usageError, walk } from './util.mjs'

const SKILLS = '.claude/skills'
const ABS_PATH = /\/Users\/|\/home\/|[A-Za-z]:\\/

// The name in compass drops a leading "<project>-".
export const candidates = ({ AC, root }) => {
  const owned = new Set([...readLock(root).lock.skills, ...(loadKonvoy(root).konvoy?.skills ?? [])])
  const prefix = `${basename(root).toLowerCase()}-`
  return dirs(join(root, SKILLS))
    .filter((name) => lstatSync(join(root, SKILLS, name, 'SKILL.md'), { throwIfNoEntry: false })?.isFile() && !owned.has(name))
    .map((name) => ({ name, target: name.toLowerCase().startsWith(prefix) ? name.slice(prefix.length) : name }))
}

const rename = (text, name) => text.replace(/^(---\r?\n)([\s\S]*?)(\r?\n---)/, (_, open, head, close) =>
  `${open}${/^name:/m.test(head) ? head.replace(/^name:.*$/m, `name: ${name}`) : `name: ${name}\n${head}`}${close}`)

export const promote = ({ AC, root, skill, dry = false }) => {
  const found = candidates({ AC, root }).find((c) => c.name === skill)
  if (!found) return { ok: false, errors: [`"${skill}" is not a project skill that compass can promote`], warnings: [], from: null, to: null, files: [] }
  const from = join(root, SKILLS, skill)
  const to = join(AC, 'skills', found.target)
  const project = basename(root).toLowerCase()
  const files = walk(from)
  const out = new Map(files.map((rel) => {
    const buf = readFileSync(join(from, rel))
    return [rel, rel === 'SKILL.md' ? Buffer.from(rename(buf.toString('utf8'), found.target)) : buf]
  }))
  const errors = readdirSync(from, { recursive: true, withFileTypes: true }).filter((e) => e.isSymbolicLink())
    .map((e) => `${skill}/${join(e.parentPath, e.name).slice(from.length + 1)}: a symlink cannot move into compass`)
  if (!/^[a-z0-9][a-z0-9-]*$/.test(found.target)) errors.push(`${skill}: "${found.target}" is not a valid skill name in compass`)
  if (existsSync(to)) errors.push(`skills/${found.target} already exists in the compass checkout`)
  for (const [rel, buf] of out) {
    const text = buf.toString('utf8')
    for (const issue of findIssues(text)) if (issue.kind === 'secret') errors.push(`${skill}/${rel}:${issue.line}: a line looks like a secret`)
    if (text.toLowerCase().includes(project)) errors.push(`${skill}/${rel}: the text has the project name "${project}"`)
    if (ABS_PATH.test(text)) errors.push(`${skill}/${rel}: the text has an absolute path`)
  }
  const head = frontmatter(out.get('SKILL.md').toString('utf8')).data
  const warnings = ['risk_level', 'requires_tools'].filter((key) => !head[key]).map((key) => `${skill}/SKILL.md: the frontmatter has no ${key}`)
  if (!errors.length && !dry) {
    for (const [rel, buf] of out) {
      mkdirSync(dirname(join(to, rel)), { recursive: true })
      writeFileSync(join(to, rel), buf, { mode: statSync(join(from, rel)).mode & 0o777 })
    }
  }
  return { ok: !errors.length, errors, warnings, from, to, files }
}

const HELP = `Usage: ac promote [<skill>] [options]

Without a skill: list the project skills in .claude/skills/ that neither the compass lock nor
the Konvoy ledger owns, with the name that each gets in compass.
With a skill: check it, then copy it into skills/ of this compass checkout. The project copy stays.
The check refuses a secret, the project name, an absolute path and an existing target.

Options:
  --root <dir>  Use this project root. The default is the current directory.
  --dry         Check the skill. Write nothing.
  --json        Print the result as JSON.
  --help, -h    Show this help.`

export const cli = (argv, { AC }) => {
  const { values: v, positionals: [skill, extra], exit } = parseCommand(argv, HELP, { root: { type: 'string' }, dry: { type: 'boolean' }, json: { type: 'boolean' } })
  if (exit !== undefined) return exit
  if (extra) return usageError(HELP, `Unexpected argument: ${extra}`)
  const host = hostRoot(AC, v.root)
  if (host.error) return failCommand(v.json, host.error)
  if (skill === undefined) {
    const list = candidates({ AC, root: host.root })
    if (v.json) console.log(JSON.stringify({ ok: true, candidates: list }, null, 2))
    else console.log(list.length ? list.map((c) => `${c.name.padEnd(30)} → ${c.target}`).join('\n') : 'No project skill to promote.')
    return 0
  }
  const r = promote({ AC, root: host.root, skill, dry: v.dry })
  if (v.json) console.log(JSON.stringify(r, null, 2))
  else {
    for (const w of r.warnings) console.log(`  warn    ${w}`)
    for (const e of r.errors) console.error(`error: ${e}`)
    if (r.ok) console.log(v.dry ? `Ready: ${r.from} → ${r.to} (${r.files.length} files). Nothing written.` : `Copied ${r.files.length} files to ${r.to}. The project copy stays.`)
  }
  return r.ok ? 0 : 1
}
