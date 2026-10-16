// raid.mjs — single-file question registers to Konvoy RAID files (Q-NNN.md) for `ac migrate --docs`.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isFence } from '../engine/docs.mjs'
import { frontmatter, isDir } from '../engine/util.mjs'
import { SKIP } from './common.mjs'

const REGISTER = /^(?:(?:open[-_ ]?questions|questions[-_ ]?ouvertes)(?:[-_ ].*)?|questions)\.md$/i

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
export const scanRegisters = (root, skip, dir = '') => readdirSync(join(root, dir), { withFileTypes: true }).flatMap((e) => {
  const rel = dir ? `${dir}/${e.name}` : e.name
  if (e.isDirectory()) return SKIP.has(e.name) || e.name.startsWith('.') || rel === skip ? [] : scanRegisters(root, skip, rel)
  return e.isFile() && REGISTER.test(e.name) ? [rel] : []
})

export const nextQ = (root, dir) => {
  const nums = (isDir(join(root, dir)) ? readdirSync(join(root, dir)) : []).filter((n) => /\.(md|markdown)$/i.test(n)).flatMap((n) => {
    const fm = frontmatter(readFileSync(join(root, dir, n), 'utf8')).data.id
    return [/^q-(\d+)/i.exec(n)?.[1], /^q-(\d+)$/i.exec(fm || '')?.[1]].filter(Boolean).map(Number)
  })
  return Math.max(0, ...nums) + 1
}
