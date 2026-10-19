// promote.mjs — ac promote: copy a project skill into skills/ of this compass checkout, or a reflect lesson into lessons/.
// A project skill is a dir in .claude/skills/ that neither the compass lock nor the Konvoy ledger owns.
// The checks refuse a secret, the project name, an absolute path and an existing target. The project copy stays.
// A lesson also needs one edit verdict that is not "unclear": the library holds lessons with evidence only (ADR 0007).

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

const LESSON_FILE = /^\.agents\/lessons\/(\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*)\.md$/
const VERDICT_ROW = /^\|.*\|\s*(helped|hurt|no effect|unclear)\s*\|\s*$/gm

// Copy a project lesson (.agents/lessons/<date>-<slug>.md, written by ac reflect lesson) into lessons/ of this compass checkout.
export const promoteLesson = ({ AC, root, file, dry = false }) => {
  const rel = String(file).replace(/^\.\//, '')
  const m = LESSON_FILE.exec(rel)
  const result = (errors, to = null) => ({ ok: !errors.length, errors, warnings: [], from: join(root, rel), to, files: m ? [`${m[1]}.md`] : [] })
  if (!m) return result([`${file}: a lesson is .agents/lessons/<YYYY-MM-DD>-<slug>.md in the project`])
  if (lstatSync(join(root, rel), { throwIfNoEntry: false })?.isFile() !== true) return result([`${rel} is not a file (a symlink cannot move into compass)`])
  const text = readFileSync(join(root, rel), 'utf8')
  const project = basename(root).toLowerCase()
  const to = join(AC, 'lessons', `${m[1]}.md`)
  const errors = []
  const verdicts = [...text.matchAll(VERDICT_ROW)].map((x) => x[1])
  if (!verdicts.some((v) => v !== 'unclear')) errors.push(`${rel}: no edit has a verdict other than "unclear"; a lesson needs evidence before it moves into compass`)
  for (const issue of findIssues(text)) errors.push(`${rel}:${issue.line}: a line looks like ${issue.kind === 'pii' ? 'an e-mail address' : 'a secret'}`)
  if (text.toLowerCase().includes(project)) errors.push(`${rel}: the text has the project name "${project}"`)
  if (ABS_PATH.test(text)) errors.push(`${rel}: the text has an absolute path`)
  if (existsSync(to)) errors.push(`lessons/${m[1]}.md already exists in the compass checkout`)
  if (!errors.length && !dry) {
    mkdirSync(dirname(to), { recursive: true })
    writeFileSync(to, text)
  }
  return result(errors, to)
}

const HELP = `Usage: ac promote [<skill>] [options]
       ac promote --lesson <file> [options]

Without a skill: list the project skills in .claude/skills/ that neither the compass lock nor
the Konvoy ledger owns, with the name that each gets in compass.
With a skill: check it, then copy it into skills/ of this compass checkout. The project copy stays.
The check refuses a secret, the project name, an absolute path and an existing target.
With --lesson: copy a lesson from .agents/lessons/ into lessons/ of this compass checkout, with the
same checks. A lesson whose edits are all "unclear", or that has no edit, is refused. ac reflect
lists the library lessons that fit a project's sessions.

Options:
  --lesson <file>  The lesson file, for example .agents/lessons/2026-10-19-retry-tests.md.
  --root <dir>  Use this project root. The default is the current directory.
  --dry         Check the skill. Write nothing.
  --json        Print the result as JSON.
  --help, -h    Show this help.`

export const cli = (argv, { AC }) => {
  const { values: v, positionals: [skill, extra], exit } = parseCommand(argv, HELP, { root: { type: 'string' }, dry: { type: 'boolean' }, json: { type: 'boolean' }, lesson: { type: 'string' } })
  if (exit !== undefined) return exit
  if (extra) return usageError(HELP, `Unexpected argument: ${extra}`)
  if (v.lesson !== undefined && skill !== undefined) return usageError(HELP, '--lesson does not take a skill name.')
  const host = hostRoot(AC, v.root)
  if (host.error) return failCommand(v.json, host.error)
  if (v.lesson !== undefined) {
    const r = promoteLesson({ AC, root: host.root, file: v.lesson, dry: v.dry })
    if (v.json) console.log(JSON.stringify(r, null, 2))
    else {
      for (const e of r.errors) console.error(`error: ${e}`)
      if (r.ok) console.log(v.dry ? `Ready: ${r.from} → ${r.to}. Nothing written.` : `Copied the lesson to ${r.to}. The project copy stays.`)
    }
    return r.ok ? 0 : 1
  }
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
