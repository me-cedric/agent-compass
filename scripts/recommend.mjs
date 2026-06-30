#!/usr/bin/env node
// recommend.mjs — scan host and propose exact agent-compass setup next actions.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const help = `Usage: node scripts/recommend.mjs [root] [--write] [--json]`
if (args.includes('--help')) { console.log(help); process.exit(0) }
const root = resolve(args.find((a) => !a.startsWith('--')) || process.cwd())
const has = (p) => existsSync(join(root, p))
const readJson = (p) => { try { return JSON.parse(readFileSync(join(root, p), 'utf8')) } catch { return null } }
const pkg = readJson('package.json') || {}
const scripts = pkg.scripts || {}
const depsText = JSON.stringify({ ...pkg.dependencies, ...pkg.devDependencies }).toLowerCase()
const dirs = new Set(existsSync(root) ? readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [])
const stacks = [
  depsText.includes('nestjs') && 'NestJS API',
  depsText.includes('react') && 'React app',
  depsText.includes('expo') && 'Expo mobile',
  depsText.includes('next') && 'Next.js app',
  (depsText.includes('drizzle') || has('drizzle.config.ts')) && 'Drizzle/Postgres',
  (depsText.includes('bullmq')) && 'BullMQ',
  (depsText.includes('turbo') || has('turbo.json')) && 'Turborepo',
].filter(Boolean)
const recs = []
if (!has('AGENTS.md')) recs.push('Run `agent-compass setup-host . --strict` to create root agent contract pointer.')
if (!has('agent-compass.commands.json')) recs.push('Create `agent-compass.commands.json` with real lint/typecheck/test commands.')
if (!has('.agent/context.json')) recs.push('Run `agent-compass context-pack . --write` for low-token repo context.')
if (!has('.agent/RUNBOOK.md')) recs.push('Run `agent-compass runbook . --write` for agent startup path.')
if (!has('.mcp/recommended.example.json')) recs.push('Install MCP examples for context7/fetch/playwright/sequential-thinking/projectmem.')
if (!has('.agent/mcp-readiness.md')) recs.push('Run `agent-compass mcp-probe . --write` to verify MCP commands/placeholders.')
if (!has('.agent/provider-verification.md')) recs.push('Run `agent-compass provider-verify . --write` to verify provider setup.')
if (!has('.agent/policy.json')) recs.push('Apply a policy pack with `agent-compass policy-pack . --apply solo-dev|startup-fast|strict-enterprise|regulated-api`.')
if (!has('specs/README.md')) recs.push('Adopt specs templates for feature work.')
if (has('specs') && !has('.agent/spec-validation-map.md')) recs.push('Run `agent-compass spec-validation-map . --write` to map specs to validation artifacts.')
if (stacks.includes('React app') && !has('docs/design')) recs.push('Add design-system docs before UI-heavy work; use Figma MCP when Figma is source of truth.')
if (stacks.includes('NestJS API') && !has('.github/instructions/api.instructions.md')) recs.push('Install API path instructions for contract sync and targeted validation.')
if (!scripts.check && !(scripts.lint && scripts.test)) recs.push('Add a single `check` script or fill lint/typecheck/test registry entries.')
if (dirs.has('apps') && !has('docs/architecture/repo-map.md')) recs.push('Generate repo map so agents choose right app/package before editing.')
const report = `# Agent Compass Recommendations

Root: \`${root}\`

Detected: ${stacks.length ? stacks.join(', ') : 'generic project'}

## Recommended Actions

${recs.length ? recs.map((r) => `- ${r}`).join('\n') : '- No immediate setup gaps found.'}
`
if (args.includes('--json')) console.log(JSON.stringify({ schema: 1, root, stacks, recommendations: recs }, null, 2))
else if (args.includes('--write')) {
  mkdirSync(join(root, '.agent'), { recursive: true })
  writeFileSync(join(root, '.agent', 'recommendations.md'), report)
  console.log(join(root, '.agent', 'recommendations.md'))
} else console.log(report)
