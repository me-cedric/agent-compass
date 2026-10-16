#!/usr/bin/env node
// statusline.mjs — Claude Code status line: "<model> · <dir> · cache <N>% · ctx <K>k".
// Input: the status line JSON on stdin. The usage numbers come from the last 64 KB of the transcript. No network.
// On any error the script prints the model only. It never throws.

import { closeSync, fstatSync, openSync, readFileSync, readSync } from 'node:fs'
import { basename } from 'node:path'

const TAIL = 64 * 1024

const tail = (path) => {
  const fd = openSync(path, 'r')
  try {
    const size = fstatSync(fd).size
    const start = Math.max(0, size - TAIL)
    const buf = Buffer.alloc(size - start)
    readSync(fd, buf, 0, buf.length, start)
    return buf.toString('utf8')
  } finally {
    closeSync(fd)
  }
}

// The newest main-thread assistant message that has usage numbers. The first line of the tail can be cut, so a bad line is skipped.
const lastUsage = (text) => {
  for (const line of text.split('\n').reverse()) {
    let e
    try { e = JSON.parse(line) } catch { continue }
    const u = e?.type === 'assistant' && !e.isSidechain && e.message?.usage
    if (!u) continue
    const read = u.cache_read_input_tokens || 0
    const total = (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0) + read
    if (total > 0) return { read, total }
  }
  return null
}

let input = {}
try { input = JSON.parse(readFileSync(0, 'utf8')) } catch { /* the model name stays empty */ }
const model = input?.model?.display_name || ''
try {
  const parts = [model, basename(input.workspace?.current_dir || '')]
  const usage = input.transcript_path && lastUsage(tail(input.transcript_path))
  if (usage) parts.push(`cache ${Math.round((usage.read / usage.total) * 100)}%`, `ctx ${Math.round(usage.total / 1000)}k`)
  console.log(parts.filter(Boolean).join(' · '))
} catch {
  console.log(model)
}
