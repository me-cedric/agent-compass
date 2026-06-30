#!/usr/bin/env node
// design-importer.mjs — create design-system docs from Figma/token export.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const help = `Usage: node scripts/design-importer.mjs [root] [--source <json>] [--write]

Source JSON may contain tokens/colors/type/components. Without source, writes starter.
`
if (args.includes('--help')) { console.log(help); process.exit(0) }
const flag = (name) => { const i = args.indexOf(name); return i === -1 ? null : args[i + 1] }
const root = resolve(args.find((a) => !a.startsWith('--') && a !== flag('--source')) || process.cwd())
let source = {}
try { source = JSON.parse(readFileSync(resolve(flag('--source')), 'utf8')) } catch {}
const colors = source.colors || source.tokens?.colors || {}
const components = source.components || []
const report = `# Design System

Source: ${flag('--source') || 'starter'}

## Tokens

### Colors

${Object.entries(colors).map(([k, v]) => `- \`${k}\`: \`${v}\``).join('\n') || '- Add color tokens from Figma MCP/export.'}

## Components

${(Array.isArray(components) ? components : Object.keys(components)).map((c) => `- ${typeof c === 'string' ? c : c.name}`).join('\n') || '- Add components from Figma frames/components.'}

## Agent Rules

- Figma or this document is source of truth for UI.
- Use tokens before raw values.
- Reuse shared components before page-local UI.
- Update this file and component map when UI changes.
`
const map = `# Figma To Code Map

| Figma Node | Code Path | Notes |
| ---------- | --------- | ----- |
| TBD | TBD | Add during implementation |
`
if (args.includes('--write')) {
  mkdirSync(join(root, 'docs', 'design'), { recursive: true })
  writeFileSync(join(root, 'docs', 'design', 'DESIGN-SYSTEM.md'), report)
  writeFileSync(join(root, 'docs', 'design', 'FIGMA-CODE-MAP.md'), map)
  console.log(join(root, 'docs', 'design', 'DESIGN-SYSTEM.md'))
} else console.log(report)
