// adr.mjs — compass 0.9 ADRs (NNN-slug.md with Status and Date lines) to NNNN-slug.md with MADR frontmatter,
// and the Markdown link edits that follow the renames, for `ac migrate --docs`.

import { readdirSync, readFileSync } from 'node:fs'
import { basename, join, posix } from 'node:path'
import { isFence, isTemplate } from '../engine/docs.mjs'
import { frontmatter, walk } from '../engine/util.mjs'
import { MIGRATED, slug } from './common.mjs'

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
export const adrItems = (root, paths) => {
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
// A fenced code block and an inline code span stay as they are.
const retarget = (text, from, renames) => text.replace(/(\]\(\s*<?)([^)\s<>#?]+)/g, (whole, open, target) => {
  if (/^[a-z][a-z0-9+.-]*:/i.test(target)) return whole
  const to = renames.get(posix.normalize(target.startsWith('/') ? target.slice(1) : posix.join(posix.dirname(from), target)))
  return to ? `${open}${target.slice(0, target.length - posix.basename(target).length)}${posix.basename(to)}` : whole
})

export const relink = (text, from, renames) => {
  let fenced = false
  return text.split('\n').map((line) => {
    if (isFence(line)) { fenced = !fenced; return line }
    return fenced ? line : line.split(/(`+[^`]*`+)/).map((part, i) => (i % 2 ? part : retarget(part, from, renames))).join('')
  }).join('\n')
}

export const mdFiles = (root, dir = '') => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => {
  const rel = dir ? `${dir}/${e.name}` : e.name
  if (e.isDirectory()) return ['node_modules', '.git', MIGRATED].includes(e.name) ? [] : mdFiles(root, rel)
  return e.isFile() && /\.md$/i.test(e.name) ? [rel] : []
})
