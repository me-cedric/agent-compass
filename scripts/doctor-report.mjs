#!/usr/bin/env node
// doctor-report.mjs — markdown readiness report for host agent setup.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const help = `Usage: node scripts/doctor-report.mjs [root] [--write]

Print a markdown host-readiness report. With --write, save to .agent/doctor-report.md.
`

const args = process.argv.slice(2)
if (args.includes('--help')) {
  console.log(help)
  process.exit(0)
}

const root = resolve(args.find((arg) => !arg.startsWith('--')) || process.cwd())
const check = (label, path) => `| ${label} | ${existsSync(join(root, path)) ? 'ok' : 'missing'} | \`${path}\` |`
let scripts = []
try { scripts = Object.keys(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts || {}).sort() } catch {}

const report = `# Agent Readiness Report

Root: \`${root}\`

## Required

| Check | Status | Path |
| ----- | ------ | ---- |
${[
  check('Agent guide', 'AGENTS.md'),
  check('Command registry', 'agent-compass.commands.json'),
  check('PR template', '.github/PULL_REQUEST_TEMPLATE.md'),
].join('\n')}

## Optional Workflows

| Check | Status | Path |
| ----- | ------ | ---- |
${[
  check('Specs', 'specs/README.md'),
  check('Constitution', 'specs/constitution.md'),
  check('Project memory', '.projectmem/README.md'),
  check('MCP docs', '.mcp/README.md'),
  check('Repo map', 'docs/architecture/repo-map.md'),
  check('ADR template', 'docs/decisions/000-template.md'),
].join('\n')}

## Package Scripts

${scripts.length ? scripts.map((script) => `- ${script}`).join('\n') : '- none'}
`

if (args.includes('--write')) {
  const out = join(root, '.agent', 'doctor-report.md')
  mkdirSync(join(root, '.agent'), { recursive: true })
  writeFileSync(out, report)
  console.log(out)
} else {
  console.log(report)
}
