// docs.mjs — `ac migrate --docs`: plan, then move spec-kit specs, a root specs/ folder and single-file question
// registers to OpenSpec changes and Q-NNN files. It renames an ADR NNN-slug.md to NNNN-slug.md with MADR
// frontmatter and edits the Markdown links to the old name. It never deletes or overwrites a file.
// A migrated source moves under migrated/<its path>.

import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { projectPaths } from '../engine/config.mjs'
import { questionsDir } from '../engine/docs.mjs'
import { outside, prune } from '../engine/sync.mjs'
import { dirs, isDir, walk, writeNew } from '../engine/util.mjs'
import { adrItems, mdFiles, relink } from './adr.mjs'
import { MIGRATED, slug } from './common.mjs'
import { nextQ, raidText, scanRegisters, splitRegister } from './raid.mjs'

const AGENT_DIRS = ['.claude/skills', '.agents/skills', '.claude/commands', '.codex/prompts', '.github/agents', '.github/prompts']

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
    for (const [from, to] of it.copies) writeNew(root, to, readFileSync(join(root, from)))
    for (const [to, text] of it.writes) writeNew(root, to, text)
    renameSync(join(root, it.source), join(root, MIGRATED, it.source))
    if (it.edit === undefined) prune(root, dirname(join(root, it.source)))
    else writeNew(root, it.source, it.edit)
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
