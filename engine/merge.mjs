// merge.mjs — edit only the parts of a shared file that compass owns:
// one Markdown block, named JSON keys and named TOML keys. Other bytes stay as they are.

import { isObj } from './util.mjs'

// --- Markdown block ---

export const BEGIN = '<!-- compass:begin -->'
export const END = '<!-- compass:end -->'

export const blockInner = (body) => `\n${body.trimEnd()}\n`

export const blockFind = (text) => {
  const start = text.indexOf(BEGIN)
  const end = text.indexOf(END)
  if (start < 0 && end < 0) return null
  if (start < 0 || end < start || text.indexOf(BEGIN, start + 1) >= 0 || text.indexOf(END, end + 1) >= 0) {
    throw new Error(`the compass block markers are not one ${BEGIN} … ${END} pair`)
  }
  return { start, end: end + END.length, inner: text.slice(start + BEGIN.length, end) }
}

export const blockSet = (text, body) => {
  const block = `${BEGIN}${blockInner(body)}${END}`
  const at = blockFind(text)
  if (at) return text.slice(0, at.start) + block + text.slice(at.end)
  const head = text.replace(/\n+$/, '')
  return `${head ? `${head}\n\n` : ''}${block}\n`
}

export const blockRemove = (text) => {
  const at = blockFind(text)
  if (!at) return text
  const head = text.slice(0, at.start).replace(/\n+$/, '')
  const tail = text.slice(at.end).replace(/^\n+/, '')
  if (head && tail) return `${head}\n\n${tail}`
  return head ? `${head}\n` : tail
}

// --- JSON keys: a dotted path into nested objects ---
// Edits splice the text of a valid JSON document, so the bytes outside the owned key stay the same.

export const jsonGet = (obj, key) => key.split('.').reduce((o, k) => (isObj(o) && Object.hasOwn(o, k) ? o[k] : undefined), obj)

// Offsets of every value. An object also lists its members. The text must already pass JSON.parse.
const spans = (text) => {
  let i = 0
  const ws = () => { while (/\s/.test(text[i] || '')) i++ }
  const skipString = () => { for (i++; text[i] !== '"'; i++) if (text[i] === '\\') i++; i++ }
  const value = () => {
    ws()
    const start = i
    const open = text[i]
    if (open === '"') { skipString(); return { start, end: i } }
    if (open !== '{' && open !== '[') { while (i < text.length && !/[\s,\]}]/.test(text[i])) i++; return { start, end: i } }
    const members = open === '{' ? [] : null
    i++
    ws()
    while (text[i] !== (members ? '}' : ']')) {
      if (members) {
        const keyStart = i
        skipString()
        const key = JSON.parse(text.slice(keyStart, i))
        ws()
        i++
        members.push({ key, keyStart, node: value() })
      } else value()
      ws()
      if (text[i] === ',') { i++; ws() }
    }
    i++
    return { start, end: i, members }
  }
  return value()
}

const lineIndent = (text, pos) => /^[ \t]*/.exec(text.slice(text.lastIndexOf('\n', pos - 1) + 1))[0]
const render = (value, pad, unit) => JSON.stringify(value, null, unit).replace(/\n/g, `\n${pad}`)

const locateMember = (text, parts) => {
  let node = spans(text)
  for (let d = 0; d < parts.length; d++) {
    if (!node.members) throw new Error(`cannot set ${parts.join('.')}: "${parts.slice(0, d).join('.')}" is not an object`)
    const member = node.members.findLast((m) => m.key === parts[d])
    if (!member || d === parts.length - 1) return { node, member, rest: parts.slice(d) }
    node = member.node
  }
}

export const jsonSet = (text, key, value) => {
  const unit = /^([ \t]+)\S/m.exec(text)?.[1] || '  '
  const { node, member, rest } = locateMember(text, key.split('.'))
  if (member) return text.slice(0, member.node.start) + render(value, lineIndent(text, member.keyStart), unit) + text.slice(member.node.end)
  const nested = rest.slice(1).reduceRight((v, k) => ({ [k]: v }), value)
  const entry = (pad) => `${JSON.stringify(rest[0])}: ${pad === null ? JSON.stringify(nested) : render(nested, pad, unit)}`
  const last = node.members.at(-1)
  if (last && !text.slice(node.start, node.end).includes('\n')) {
    return `${text.slice(0, last.node.end)}, ${entry(null)}${text.slice(last.node.end)}`
  }
  if (last) {
    const pad = lineIndent(text, last.keyStart)
    return `${text.slice(0, last.node.end)},\n${pad}${entry(pad)}${text.slice(last.node.end)}`
  }
  const outer = lineIndent(text, node.start)
  return `${text.slice(0, node.start)}{\n${outer}${unit}${entry(outer + unit)}\n${outer}}${text.slice(node.end)}`
}

export const jsonDelete = (text, key) => {
  const { node, member } = locateMember(text, key.split('.'))
  if (!member) return text
  const at = node.members.indexOf(member)
  if (node.members.length === 1) return `${text.slice(0, node.start)}{}${text.slice(node.end)}`
  if (at > 0) return text.slice(0, node.members[at - 1].node.end) + text.slice(member.node.end)
  return text.slice(0, member.keyStart) + text.slice(node.members[1].keyStart)
}

// --- TOML keys ---
// An owned key with an object value is a [table]. Any other value is one `key = value` line before the first table.

const HEADER = /^\s*\[\[?\s*([^\]]+?)\s*\]\]?\s*(?:#.*)?$/
const bare = (k) => (/^[A-Za-z0-9_-]+$/.test(k) ? k : JSON.stringify(k))
const tomlKey = (dotted) => dotted.split('.').map(bare).join('.')
const normKey = (k) => k.split('.').map((s) => s.trim().replace(/^"(.*)"$|^'(.*)'$/, '$1$2')).join('.')

export const tomlValue = (v) => {
  if (typeof v === 'string') return JSON.stringify(v)
  if (typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) return String(v)
  if (Array.isArray(v)) return `[${v.map(tomlValue).join(', ')}]`
  if (isObj(v)) return `{ ${Object.entries(v).map(([k, x]) => `${bare(k)} = ${tomlValue(x)}`).join(', ')} }`
  throw new Error(`TOML cannot hold the value ${JSON.stringify(v)}`)
}

// A multi-line literal string when it is safe, else a basic string with escapes.
export const tomlText = (s) => (s.includes("'''") || /[\x00-\x08\x0b-\x1f\x7f]/.test(s) ? JSON.stringify(s) : `'''\n${s}'''`)

export const tomlRender = (key, value) => (isObj(value)
  ? [`[${tomlKey(key)}]`, ...Object.entries(value).map(([k, v]) => `${bare(k)} = ${tomlValue(v)}`)].join('\n')
  : `${tomlKey(key)} = ${tomlValue(value)}`)

// Lines that start outside a multi-line string or array. Only these can hold a table header or an owned key.
const codeLines = (lines) => {
  let quote = null
  let depth = 0
  return lines.map((line) => {
    const free = quote === null && depth === 0
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (quote) {
        if (line.startsWith(quote, i)) { i += quote.length - 1; quote = null }
        else if (quote[0] === '"' && c === '\\') i++
      } else if (c === '#') break
      else if (line.startsWith('"""', i) || line.startsWith("'''", i)) { quote = line.slice(i, i + 3); i += 2 }
      else if (c === '"' || c === "'") quote = c
      else if (c === '[' || c === '{') depth++
      else if (c === ']' || c === '}') depth = Math.max(0, depth - 1)
    }
    if (quote?.length === 1) quote = null
    return free
  })
}

// ponytail: an owned line key is one line. A user edit that makes it span lines reads as "edited" and is kept.
const locate = (lines, key) => {
  const code = codeLines(lines)
  const header = (i) => code[i] && HEADER.test(lines[i])
  const first = lines.findIndex((_, i) => header(i))
  const head = first < 0 ? lines.length : first
  for (let i = head; i < lines.length; i++) {
    const m = header(i) && HEADER.exec(lines[i])
    if (!m || lines[i].trim().startsWith('[[') || normKey(m[1]) !== key) continue
    let end = i + 1
    while (end < lines.length && !header(end)) end++
    // Trailing blank and comment lines belong to the next table.
    while (end > i + 1 && code[end - 1] && /^\s*(#.*)?\r?$/.test(lines[end - 1])) end--
    return { start: i, end, table: true, first }
  }
  for (let i = 0; i < head; i++) {
    const m = code[i] && /^\s*([^=#[]+?)\s*=/.exec(lines[i])
    if (m && normKey(m[1]) === key) return { start: i, end: i + 1, table: false, first }
  }
  return { first }
}

export const tomlGet = (text, key) => {
  const lines = text.split('\n')
  const at = locate(lines, key)
  return at.table === undefined ? undefined : lines.slice(at.start, at.end).join('\n').replace(/\r$/gm, '')
}

export const tomlDelete = (text, key) => {
  const lines = text.split('\n')
  const at = locate(lines, key)
  if (at.table === undefined) return text
  const start = at.table && at.start > 0 && !lines[at.start - 1].trim() ? at.start - 1 : at.start
  return [...lines.slice(0, start), ...lines.slice(at.end)].join('\n')
}

export const tomlSet = (text, key, value) => {
  const lines = text.split('\n')
  const rendered = tomlRender(key, value)
  const at = locate(lines, key)
  if (at.table === isObj(value)) return [...lines.slice(0, at.start), rendered, ...lines.slice(at.end)].join('\n')
  if (at.table !== undefined) return tomlSet(tomlDelete(text, key), key, value)
  const body = text.replace(/\n+$/, '')
  const { first } = at
  if (isObj(value) || first < 0) return `${body ? `${body}\n${isObj(value) ? '\n' : ''}` : ''}${rendered}\n`
  let pos = first
  while (pos > 0 && !lines[pos - 1].trim()) pos--
  return [...lines.slice(0, pos), rendered, ...(pos === 0 ? [''] : []), ...lines.slice(pos)].join('\n')
}
