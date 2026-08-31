#!/usr/bin/env node
// check-docs.mjs — fail on broken local Markdown links and unknown template placeholders.

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCliArgs } from './lib/args.mjs'

const { values, positionals } = parseCliArgs({
  name: 'check-docs',
  usage: 'node scripts/check-docs.mjs [root] [options]',
  summary: 'Fail on broken local Markdown links and unknown placeholder-like tokens in templates.',
  positionals: [{ name: 'root', required: false }],
  options: {
    root: { type: 'string', value: '<dir>', desc: 'Check another root directory (also accepted as a positional).' },
  },
})

const ROOT = resolve(values.root || positionals[0] || dirname(dirname(fileURLToPath(import.meta.url))))
const IGNORE = new Set(['.git', 'node_modules', 'incoming'])
const TEXT_EXT = new Set(['.md', '.mjs', '.cjs', '.js', '.ts', '.tsx', '.json', '.yml', '.yaml', '.toml', '.properties', '.sh', '.tpl', '.txt', ''])
const ALLOWED_TEMPLATE_PLACEHOLDERS = new Set(['project', 'app', 'PM', 'provider', 'key', 'keys', 'projectKey', 'path', 'csvPath', 'htmlPath', 'line', 'prefix', 'KEY', 'unset', 'name', 'id', 'id-slug', 'openspec', 'artifact', 'capability'])
const HTML_TAGS = new Set(['a', 'b', 'br', 'code', 'dd', 'div', 'dt', 'h1', 'h2', 'h3', 'h4', 'li', 'p', 'script', 'span', 'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul'])
const LOCAL_PATH_RE = /(?:\/Users\/(?!runner\b)|\/home\/(?!runner\b)|[A-Za-z]:\\Users\\)[^"'\s)]+/
const hits = []

const walk = (dir, onFile) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE.has(entry.name)) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walk(full, onFile)
    else onFile(full)
  }
}

const markdownFiles = []
walk(ROOT, (file) => {
  if (extname(file) === '.md') markdownFiles.push(file)
})

const stripCodeBlocks = (text) => text.replace(/```[\s\S]*?```/g, '')
const slug = (heading) => heading
  .trim()
  .toLowerCase()
  .replace(/<[^>]+>/g, '')
  .replace(/[^\p{Letter}\p{Number}\s-]/gu, '')
  .replace(/\s+/g, '-')

const headingsFor = (file) => {
  const text = readFileSync(file, 'utf8')
  return new Set([...text.matchAll(/^#{1,6}\s+(.+)$/gm)].map((match) => slug(match[1])))
}

const splitLinkTarget = (target) => {
  const clean = target.trim().replace(/^<|>$/g, '').split(/\s+/)[0]
  const hash = clean.indexOf('#')
  if (hash === -1) return [clean, '']
  return [clean.slice(0, hash), clean.slice(hash + 1)]
}

for (const file of markdownFiles) {
  const text = stripCodeBlocks(readFileSync(file, 'utf8'))
  for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const [rawPath, anchor] = splitLinkTarget(match[1])
    if (!rawPath || rawPath.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(rawPath)) continue
    const target = resolve(dirname(file), decodeURIComponent(rawPath))
    if (!target.startsWith(ROOT)) {
      hits.push(`${file.replace(ROOT + '/', '')}: link escapes repo: ${match[1]}`)
      continue
    }
    if (!existsSync(target)) {
      hits.push(`${file.replace(ROOT + '/', '')}: broken link: ${match[1]}`)
      continue
    }
    if (anchor && statSync(target).isFile() && extname(target) === '.md' && !headingsFor(target).has(anchor)) {
      hits.push(`${file.replace(ROOT + '/', '')}: missing anchor ${anchor} in ${rawPath}`)
    }
  }
}

walk(join(ROOT, 'templates'), (file) => {
  if (!TEXT_EXT.has(extname(file))) return
  let text
  try { text = readFileSync(file, 'utf8') } catch { return }
  const localPath = LOCAL_PATH_RE.exec(text)
  if (localPath) hits.push(`${file.replace(ROOT + '/', '')}: local path in template: ${localPath[0]}`)
  for (const match of text.matchAll(/<([A-Za-z][A-Za-z0-9_-]*)>/g)) {
    const token = match[1]
    if (!ALLOWED_TEMPLATE_PLACEHOLDERS.has(token) && !HTML_TAGS.has(token.toLowerCase())) {
      hits.push(`${file.replace(ROOT + '/', '')}: unknown placeholder <${token}>`)
    }
  }
})

if (hits.length) {
  console.error(`✗ ${hits.length} docs/template issue(s):\n`)
  hits.forEach((hit) => console.error(`  ${hit}`))
  process.exit(1)
}

console.log('✓ docs check passed — local Markdown links valid; template placeholders known.')
