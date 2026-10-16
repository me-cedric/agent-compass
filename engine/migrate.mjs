// migrate.mjs — the docs layout for Konvoy (docs/contract/ownership.md).
//   stageSpecs   `ac init --from-specs <dir>`: create the layout and copy the input documents into the inbox.
//   migrateDocs  `ac migrate --docs`: plan, then move spec-kit specs, a root specs/ folder and single-file
//                question registers to OpenSpec changes and Q-NNN files. It renames an ADR NNN-slug.md to
//                NNNN-slug.md with MADR frontmatter and edits the Markdown links to the old name.
// Neither one deletes or overwrites a file. A migrated source moves under migrated/<its path>.

import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, posix, resolve } from 'node:path'
import { projectPaths, SCHEMA } from './config.mjs'
import { isFence, isTemplate, questionsDir, SCREENS_SEED, screensFile } from './docs.mjs'
import { outside, prune } from './sync.mjs'
import { dirs, frontmatter, isDir, walk } from './util.mjs'

export const MIGRATED = 'migrated'
export const inboxDir = (paths) => `${paths.openspec}/inbox`

const SKIP = new Set(['node_modules', MIGRATED, 'dist', 'build', 'target', 'vendor', 'Pods', 'DerivedData'])
const REGISTER = /^(?:(?:open[-_ ]?questions|questions[-_ ]?ouvertes)(?:[-_ ].*)?|questions)\.md$/i
const AGENT_DIRS = ['.claude/skills', '.agents/skills', '.claude/commands', '.codex/prompts', '.github/agents', '.github/prompts']
const hidden = (rel) => /(^|\/)\./.test(rel)

const write = (root, rel, content) => {
  mkdirSync(dirname(join(root, rel)), { recursive: true })
  writeFileSync(join(root, rel), content, { flag: 'wx' })
}

export const stageSpecs = ({ AC, root, input, apply }) => {
  const fail = (errors) => ({ ok: false, changes: [], errors, warnings: [] })
  const { paths, errors } = projectPaths(root, AC)
  if (errors.length) return fail(errors)
  const src = resolve(input)
  const st = statSync(src, { throwIfNoEntry: false })
  if (!st || !(st.isDirectory() || st.isFile())) return fail([`${input} is not a file or a folder`])
  const real = realpathSync(src)
  const top = realpathSync(root)
  if (top === real || top.startsWith(`${real}/`)) return fail([`${input} holds the project; give the folder of the input documents`])
  const inbox = `${join(top, inboxDir(paths))}/`
  if (`${real}/`.startsWith(inbox) || inbox.startsWith(`${real}/`)) return fail([`${input} holds ${inboxDir(paths)} or is in it; give another folder`])

  const staged = `${inboxDir(paths)}/${basename(src)}`
  const dirsToMake = [`${paths.openspec}/changes`, `${paths.openspec}/specs`, questionsDir(paths), paths.adr, paths.designs].filter((d) => !isDir(join(root, d)))
  const seeds = [[screensFile(paths), SCREENS_SEED], [`${paths.openspec}/config.yaml`, `schema: ${SCHEMA}\n`]]
  const writes = seeds.filter(([rel]) => !existsSync(join(root, rel))).map(([rel, text]) => [rel, Buffer.from(text), 'create'])
  const docs = st.isFile() ? [[src, staged]] : walk(src).filter((f) => !hidden(f)).map((f) => [join(src, f), `${staged}/${f}`])
  const clashes = []
  for (const [from, rel] of docs) {
    const content = readFileSync(from)
    const have = statSync(join(root, rel), { throwIfNoEntry: false })
    if (!have) writes.push([rel, content, 'stage'])
    else if (!have.isFile() || !readFileSync(join(root, rel)).equals(content)) clashes.push(`${rel} exists with other content; compass does not overwrite it`)
  }
  const unsafe = writes.map(([rel]) => rel).filter((rel) => outside(root, rel))
  if (clashes.length || unsafe.length) return fail([...clashes, ...unsafe.map((rel) => `${rel} is a symlink or leaves the project root; compass does not write it`)])
  if (apply) {
    for (const dir of dirsToMake) mkdirSync(join(root, dir), { recursive: true })
    for (const [rel, content] of writes) write(root, rel, content)
  }
  const warnings = docs.length ? [] : [`${input} has no documents to stage`]
  if (!apply && dirsToMake.length) warnings.push('the dry run does not show the files that the sync installs in the new dirs, for example the OpenSpec schema')
  return {
    ok: true,
    errors: [],
    warnings,
    changes: [...dirsToMake.map((path) => ({ action: 'mkdir', path })), ...writes.map(([path, , action]) => ({ action, path }))],
    staged,
    next: `Next: run the spec-flow skill on ${staged}. It runs grill first, then writes the proposal and the specs.`,
  }
}

// One RAID file in the byte form of the Konvoy codec (formatItem in Konvoy src/lib/raid.ts).
const escHash = (text) => {
  let fenced = false
  return text.split('\n').map((l) => {
    if (isFence(l)) { fenced = !fenced; return l }
    return fenced ? l : l.replace(/^(\\*#{1,6}\s)/, '\\$1')
  }).join('\n')
}

export const raidText = ({ id, today, question }) => [
  '---', `id: ${id}`, 'kind: question', 'status: open', `raisedAt: ${today}`, 'raisedBy: ac-migrate',
  'owner:', 'specRef:', 'taskRef:', 'ticket:', '---', '',
  '## Question', '', escHash(question), '', '## Answer', '', '', '', '## Consequence', '', '',
].join('\n').replace(/\n+$/, '\n')

const cells = (line) => line.trim().replace(/^\||\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim())
const TABLE_RULE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/

// ponytail: two shapes only, a numbered heading ("## 3. <question>") and a table whose first column is
// "Question…". Prose outside them stays in the source under migrated/; the report says so.
export const splitRegister = (text) => {
  const lines = text.replace(/^﻿/, '').replace(/\r\n/g, '\n').split('\n')
  const items = []
  let fenced = false
  for (let i = 0; i < lines.length; i++) {
    if (isFence(lines[i])) { fenced = !fenced; continue }
    if (fenced) continue
    const h = /^(#{2,4})\s+\d+[.)]\s+(.+?)(?:\s+#+)?\s*$/.exec(lines[i])
    if (h) {
      let j = i + 1
      for (let f = false; j < lines.length; j++) {
        if (isFence(lines[j])) f = !f
        else if (!f && (/^(#{1,6})\s/.exec(lines[j])?.[1].length ?? 9) <= h[1].length) break
      }
      items.push({ title: h[2], body: lines.slice(i + 1, j).join('\n').trim().replace(/\n+[-*_]{3,}$/, ''), section: lines[i].replace(/^#+\s*/, '') })
      i = j - 1
      continue
    }
    if (!/^\s*\|/.test(lines[i]) || !TABLE_RULE.test(lines[i + 1] || '')) continue
    const head = cells(lines[i])
    let j = i + 2
    for (; j < lines.length && /^\s*\|/.test(lines[j]); j++) {
      const row = cells(lines[j])
      if (!/^questions?\b/i.test(head[0]) || !row[0]) continue
      const body = head.slice(1).map((name, k) => (row[k + 1] ? `- **${name}**: ${row[k + 1]}` : '')).filter(Boolean).join('\n')
      items.push({ title: row[0], body, section: `table "${head[0]}"` })
    }
    i = j - 1
  }
  return items
}

// The OpenSpec dir is skipped: its inbox holds staged input documents for spec-flow.
const scanRegisters = (root, skip, dir = '') => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => {
  const rel = dir ? `${dir}/${e.name}` : e.name
  if (e.isDirectory()) return SKIP.has(e.name) || e.name.startsWith('.') || rel === skip ? [] : scanRegisters(root, skip, rel)
  return e.isFile() && REGISTER.test(e.name) ? [rel] : []
})

// spec-kit feature dirs (a dir with spec.md) and the other entries below specs/.
const scanSpecs = (root, dir, out = { features: [], loose: [] }) => {
  for (const name of dirs(join(root, dir))) {
    const rel = `${dir}/${name}`
    if (existsSync(join(root, rel, 'spec.md'))) out.features.push(rel)
    else scanSpecs(root, rel, out)
  }
  for (const e of readdirSync(join(root, dir), { withFileTypes: true })) if (e.isFile() && e.name !== '.DS_Store') out.loose.push(`${dir}/${e.name}`)
  return out
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

const proposal = (id, feature, cap) => [
  `# ${id}`, '', '## Why', '', `Migrated from the spec-kit feature \`${feature}/\`. Read \`specs/${cap}/spec.md\`.`, '',
  '## What Changes', '', `- See \`specs/${cap}/spec.md\`.`, '', '## Impact', '', `- Affected capability: \`${cap}\``, '- Affected code/docs: N/A', '',
].join('\n')

const speckitAgentFiles = (root) => {
  const found = AGENT_DIRS.flatMap((dir) => (isDir(join(root, dir)) ? readdirSync(join(root, dir)) : [])
    .filter((name) => /^speckit/i.test(name)).map((name) => `${dir}/${name}`))
  const manual = []
  for (const name of isDir(join(root, '.specify/integrations')) ? readdirSync(join(root, '.specify/integrations')) : []) {
    let files
    try { files = Object.keys(JSON.parse(readFileSync(join(root, '.specify/integrations', name), 'utf8')).files || {}) } catch { continue }
    for (const rel of files) {
      if (rel.startsWith('.specify/') || !existsSync(join(root, rel)) || found.some((f) => rel === f || rel.startsWith(`${f}/`))) continue
      if (/speckit/i.test(rel)) found.push(rel)
      else if (!manual.includes(rel)) manual.push(rel)
    }
  }
  return { found: found.sort(), manual: manual.sort() }
}

const MADR = ['proposed', 'accepted', 'rejected', 'deprecated', 'superseded']
const ADR_HEAD = 30

// A compass 0.9 ADR keeps its status and date in the body: `- Status: accepted`, `**Date:** 2026-01-02`.
const adrFacts = (text) => {
  const { data, body } = frontmatter(text)
  if (body !== text) return { front: true, status: /^[a-z]+/i.exec(data.status || '')?.[0].toLowerCase(), date: /^\d{4}-\d{2}-\d{2}$/.test(data.date || '') ? data.date : undefined }
  const head = text.split(/\r?\n/).slice(0, ADR_HEAD).map((l) => l.replace(/[*_]/g, ''))
  const pick = (re) => head.map((l) => re.exec(l)?.[1]).find(Boolean)
  return { status: pick(/^\s*(?:[-+]\s+)?status\s*:\s*([a-z]+)/i)?.toLowerCase(), date: pick(/^\s*(?:[-+]\s+)?date\s*:\s*(\d{4}-\d{2}-\d{2})\b/i) }
}

// One descriptor per ADR with a 1–3 digit number: a rename to NNNN-slug.md with MADR frontmatter, or a manual item.
// The number counts over every ADR, so a 0005-x.md and a 005-y.md clash.
const adrItems = (root, paths) => {
  const files = walk(join(root, paths.adr)).filter((f) => /\.md$/.test(f) && !/^(readme|index)\.md$/i.test(basename(f)) && !isTemplate(basename(f)))
  const owners = new Map()
  for (const f of files) {
    const n = /^(\d{1,4})-/.exec(basename(f))?.[1]
    if (n) owners.set(+n, [...(owners.get(+n) || []), `${paths.adr}/${f}`])
  }
  return files.flatMap((rel) => {
    const m = /^(\d{1,3})-(.+)\.md$/.exec(basename(rel))
    if (!m) return []
    const source = `${paths.adr}/${rel}`
    const manual = (note) => [{ type: 'adr', source, action: 'manual', note, copies: [], writes: [] }]
    const same = owners.get(+m[1])
    if (same.length > 1) return manual(`ADR number ${+m[1]} is in ${same.length} files (${same.join(', ')}); decide which file keeps it, renumber the others by hand, then run this command again`)
    const text = readFileSync(join(root, source), 'utf8').replace(/^﻿/, '')
    const { front, status, date } = adrFacts(text)
    const name = slug(m[2])
    if (!status) return manual('no "Status:" line or "status" key; write the MADR status by hand')
    if (!MADR.includes(status)) return manual(`the status "${status}" is not a MADR status (${MADR.join(', ')}); decide the MADR status by hand`)
    if (!date) return manual('no "Date: YYYY-MM-DD" line or "date" key; write the date by hand')
    if (!name) return manual('the file name has no slug; name the file by hand')
    const to = `${posix.dirname(source)}/${m[1].padStart(4, '0')}-${name}.md`
    const eol = text.includes('\r\n') ? '\r\n' : '\n'
    const out = front ? text : `---${eol}status: ${status}${eol}date: ${date}${eol}---${eol}${text}`
    return [{ type: 'adr', source, action: 'move', note: `renamed to ${basename(to)}; status ${status}, date ${date}`, copies: [], writes: [[to, out]] }]
  })
}

// Rewrite the Markdown link targets `](path)` that name a renamed ADR. `from` is the repo path of the file with the links.
const relink = (text, from, renames) => text.replace(/(\]\(\s*<?)([^)\s<>#?]+)/g, (whole, open, target) => {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return whole
  const to = renames.get(posix.normalize(target.startsWith('/') ? target.slice(1) : posix.join(posix.dirname(from), target)))
  return to ? `${open}${target.slice(0, target.length - posix.basename(target).length)}${posix.basename(to)}` : whole
})

const mdFiles = (root, dir = '') => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => {
  const rel = dir ? `${dir}/${e.name}` : e.name
  if (e.isDirectory()) return ['node_modules', '.git', MIGRATED].includes(e.name) ? [] : mdFiles(root, rel)
  return e.isFile() && /\.md$/i.test(e.name) ? [rel] : []
})

const nextQ = (root, dir) => {
  const nums = (isDir(join(root, dir)) ? readdirSync(join(root, dir)) : []).filter((n) => /\.(md|markdown)$/i.test(n)).flatMap((n) => {
    const fm = frontmatter(readFileSync(join(root, dir, n), 'utf8')).data.id
    return [/^q-(\d+)/i.exec(n)?.[1], /^q-(\d+)$/i.exec(fm || '')?.[1]].filter(Boolean).map(Number)
  })
  return Math.max(0, ...nums) + 1
}

// Each item: { type, source, action: migrate | move | manual, note, copies: [[from, to]], writes: [[to, text]], edit? }.
// A migrate or move item moves its source to migrated/<source> after its copies and writes. With `edit`, the new text of
// the source is written at the source path after the move (a link edit keeps the original under migrated/).
const planDocs = (root, paths, today) => {
  const items = []
  const claimed = new Set()
  const blocked = (rel) => {
    for (let d = dirname(rel); d !== '.'; d = dirname(d)) if (statSync(join(root, d), { throwIfNoEntry: false })?.isDirectory() === false) return d
    return null
  }
  const add = (item) => {
    const targets = [...item.copies.map(([, to]) => to), ...item.writes.map(([to]) => to)]
    const clash = targets.find((to) => claimed.has(to) || existsSync(join(root, to)))
    if (item.action !== 'manual' && clash) Object.assign(item, { action: 'manual', note: `${clash} exists; merge it by hand` })
    else if (item.action !== 'manual' && existsSync(join(root, MIGRATED, item.source))) Object.assign(item, { action: 'manual', note: `${MIGRATED}/${item.source} exists` })
    else if (item.action !== 'manual' && [item.source, ...item.copies.map(([from]) => from), ...targets].some((rel) => outside(root, rel))) {
      Object.assign(item, { action: 'manual', note: 'a symlink or a path outside the project' })
    }
    else if (item.action !== 'manual' && [`${MIGRATED}/${item.source}`, ...targets].some(blocked)) {
      Object.assign(item, { action: 'manual', note: `${[`${MIGRATED}/${item.source}`, ...targets].map(blocked).find(Boolean)} is a file, not a folder` })
    }
    if (item.action !== 'manual') targets.forEach((to) => claimed.add(to))
    else Object.assign(item, { copies: [], writes: [] })
    items.push(item)
  }
  const constitution = `${paths.openspec}/constitution.md`
  const item = (type, source, action, note, copies = [], writes = []) => ({ type, source, action, note, copies, writes })

  if (isDir(join(root, '.specify'))) {
    const memory = '.specify/memory/constitution.md'
    const copies = existsSync(join(root, memory)) && !existsSync(join(root, constitution)) ? [[memory, constitution]] : []
    add(item('spec-kit', '.specify', 'move', copies.length ? `the constitution goes to ${constitution}` : 'spec-kit config and templates', copies))
  }
  const specsOwn = paths.openspec === 'specs' || paths.openspec.startsWith('specs/')
  const registers = scanRegisters(root, paths.openspec).sort()
  const features = []
  if (isDir(join(root, 'specs')) && !specsOwn) {
    const { features: found, loose } = scanSpecs(root, 'specs')
    features.push(...found)
    for (const rel of loose.sort()) {
      if (registers.includes(rel)) continue
      const taken = claimed.has(constitution) || existsSync(join(root, constitution))
      if (rel !== 'specs/constitution.md') add(item('root-specs', rel, 'manual', 'no OpenSpec place; move it by hand or delete it'))
      else if (!taken) add(item('root-specs', rel, 'move', `goes to ${constitution}`, [[rel, constitution]]))
      else add(item('root-specs', rel, 'manual', `${constitution} comes from another source; merge this constitution into it by hand`))
    }
    const ids = new Set()
    for (const feature of found) {
      const id = slug(basename(feature))
      const cap = id.replace(/^\d+-/, '') || id
      const target = `${paths.openspec}/changes/${id}`
      if (ids.has(id) || existsSync(join(root, target))) { add(item('spec-kit', feature, 'manual', `the change ${id} exists; give it another id by hand`)); continue }
      ids.add(id)
      const copies = walk(join(root, feature)).map((f) => [`${feature}/${f}`, `${target}/specs/${cap}/${f}`])
      add(item('spec-kit', feature, 'migrate', `${target}/ (${copies.length} file(s), capability ${cap})`, copies, [[`${target}/proposal.md`, proposal(id, feature, cap)]]))
    }
  }
  const agents = speckitAgentFiles(root)
  for (const rel of agents.found) add(item('spec-kit-agent', rel, 'move', 'spec-kit agent file; spec-flow replaces it'))
  for (const rel of agents.manual) add(item('spec-kit-agent', rel, 'manual', 'spec-kit wrote to this file; remove its spec-kit part by hand'))

  let n = nextQ(root, questionsDir(paths))
  for (const rel of registers) {
    if (features.some((f) => rel.startsWith(`${f}/`))) continue
    const found = splitRegister(readFileSync(join(root, rel), 'utf8'))
    if (!found.length) { add(item('register', rel, 'manual', 'no numbered question heading or question table; split it with the grill skill')); continue }
    const writes = found.map((q) => {
      const id = `Q-${String(n++).padStart(3, '0')}`
      const source = `Migrated from \`${rel}\` (now \`${MIGRATED}/${rel}\`), ${q.section}.`
      return [`${questionsDir(paths)}/${id}.md`, raidText({ id, today, question: [q.title, q.body, source].filter(Boolean).join('\n\n') })]
    })
    add(item('register', rel, 'move', `${writes.length} RAID file(s) ${basename(writes[0][0], '.md')}…${basename(writes.at(-1)[0], '.md')}; check the prose that is not in a numbered heading or a question table`, [], writes))
    if (items.at(-1).action === 'manual') n -= writes.length
  }

  for (const it of adrItems(root, paths)) add(it)
  const renames = new Map(items.filter((i) => i.type === 'adr' && i.action === 'move').map((i) => [i.source, i.writes[0][0]]))
  if (renames.size) {
    for (const [i, it] of items.entries()) if (renames.has(it.source)) items[i] = { ...it, writes: [[it.writes[0][0], relink(it.writes[0][1], it.source, renames)]] }
    const away = items.filter((i) => i.action !== 'manual').map((i) => i.source)
    for (const rel of mdFiles(root).sort()) {
      if (away.some((s) => rel === s || rel.startsWith(`${s}/`))) continue
      const text = readFileSync(join(root, rel), 'utf8')
      const edit = relink(text, rel, renames)
      if (edit !== text) add({ ...item('adr-links', rel, 'migrate', 'the links to the renamed ADRs change'), edit })
    }
  }
  return items
}

const applyDocs = (root, items) => {
  for (const it of items.filter((i) => i.action !== 'manual')) {
    mkdirSync(dirname(join(root, MIGRATED, it.source)), { recursive: true })
    for (const [from, to] of it.copies) write(root, to, readFileSync(join(root, from)))
    for (const [to, text] of it.writes) write(root, to, text)
    renameSync(join(root, it.source), join(root, MIGRATED, it.source))
    if (it.edit === undefined) prune(root, dirname(join(root, it.source)))
    else write(root, it.source, it.edit)
  }
}

export const migrateDocs = ({ AC, root, apply, today = new Date().toISOString().slice(0, 10) }) => {
  const { paths, errors } = projectPaths(root, AC)
  if (errors.length) return { ok: false, errors, warnings: [], items: [] }
  try {
    const items = planDocs(root, paths, today)
    if (apply) applyDocs(root, items)
    return { ok: true, errors: [], warnings: [], items, paths }
  } catch (err) {
    return { ok: false, errors: [err.message], warnings: [], items: [] }
  }
}
