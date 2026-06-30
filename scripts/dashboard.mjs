#!/usr/bin/env node
// dashboard.mjs — static HTML dashboard for agent setup status.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const help = `Usage: node scripts/dashboard.mjs [root] [--write]`
if (args.includes('--help')) { console.log(help); process.exit(0) }
const root = resolve(args.find((a) => !a.startsWith('--')) || process.cwd())
const read = (p) => existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : ''
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
const cards = [
  ['Runbook', '.agent/RUNBOOK.md'],
  ['Provider Verification', '.agent/provider-verification.md'],
  ['Recommendations', '.agent/recommendations.md'],
  ['Quality Gates', '.agent/quality-gates.md'],
  ['Migration Plan', '.agent/migration-plan.md'],
  ['Policy', '.agent/policy.md'],
  ['MCP Readiness', '.agent/mcp-readiness.md'],
  ['Spec Validation Map', '.agent/spec-validation-map.md'],
  ['Failure Mining', '.agent/failure-mining.md'],
  ['Design System', 'docs/design/DESIGN-SYSTEM.md'],
  ['Doctor Report', '.agent/doctor-report.md'],
]
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Agent Compass Dashboard</title>
<style>
body{font-family:system-ui,-apple-system,Segoe UI,sans-serif;margin:0;background:#f7f7f4;color:#202020}
header{padding:24px 32px;background:#1f2937;color:white}
main{padding:24px 32px;display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:16px}
section{background:white;border:1px solid #ddd;border-radius:8px;padding:16px;min-height:180px}
pre{white-space:pre-wrap;font-size:13px;line-height:1.45}
.ok{color:#166534}.missing{color:#991b1b}
</style>
</head>
<body>
<header><h1>Agent Compass Dashboard</h1><p>${esc(root)}</p></header>
<main>
${cards.map(([title, path]) => `<section><h2>${title} <span class="${read(path) ? 'ok' : 'missing'}">${read(path) ? 'ok' : 'missing'}</span></h2><pre>${esc(read(path) || `Run the matching agent-compass command to generate ${path}.`)}</pre></section>`).join('\n')}
</main>
</body>
</html>
`
if (args.includes('--write')) {
  mkdirSync(join(root, '.agent'), { recursive: true })
  writeFileSync(join(root, '.agent', 'report.html'), html)
  console.log(join(root, '.agent', 'report.html'))
} else console.log(html)
