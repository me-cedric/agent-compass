#!/usr/bin/env node
// design-importer.mjs — create design-system docs from Figma/token export.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parseCliArgs, resolveRoot } from './lib/args.mjs'

const { values, positionals } = parseCliArgs({
  name: 'design-importer',
  script: 'design-importer.mjs',
  summary: 'Source JSON may contain tokens/colors/type/components. Without source, writes starter.',
  positionals: [{ name: 'root', required: false }],
  options: {
    source: { type: 'string', value: '<json>', desc: 'Figma/token export JSON to import.' },
    write: { type: 'boolean', desc: 'Write docs/design/DESIGN-SYSTEM.md and FIGMA-CODE-MAP.md.' },
  },
})

const root = resolveRoot(positionals)
let source = {}
try { source = JSON.parse(readFileSync(resolve(values.source), 'utf8')) } catch {}
const colors = source.colors || source.tokens?.colors || {}
const components = source.components || []
const report = `# Design System

Source: ${values.source || 'starter'}

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
if (values.write) {
  mkdirSync(join(root, 'docs', 'design'), { recursive: true })
  writeFileSync(join(root, 'docs', 'design', 'DESIGN-SYSTEM.md'), report)
  writeFileSync(join(root, 'docs', 'design', 'FIGMA-CODE-MAP.md'), map)
  console.log(join(root, 'docs', 'design', 'DESIGN-SYSTEM.md'))
} else console.log(report)
