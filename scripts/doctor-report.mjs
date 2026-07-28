#!/usr/bin/env node
// doctor-report.mjs — markdown readiness report for host agent setup.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { doctorChecks } from './doctor-checks.mjs'
import { parseCliArgs, resolveRoot } from './lib/args.mjs'

const { values, positionals } = parseCliArgs({
  name: 'doctor-report',
  script: 'doctor-report.mjs',
  summary: 'Print a markdown host-readiness report. With --write, save to .agent/doctor-report.md.',
  positionals: [{ name: 'root', required: false }],
  options: {
    write: { type: 'boolean', desc: 'Save the report to .agent/doctor-report.md.' },
  },
})

const root = resolveRoot(positionals)
const check = (label, path) => `| ${label} | ${existsSync(join(root, path)) ? 'ok' : 'missing'} | \`${path}\` |`
const checkRow = ([label, ok, detail]) => `| ${label} | ${ok ? 'ok' : 'issue'} | ${detail?.length ? detail.join(', ') : ''} |`
let scripts = []
try { scripts = Object.keys(JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts || {}).sort() } catch {}
const { required, advisory, deepChecks } = doctorChecks(root, { deep: true })

const report = `# Agent Readiness Report

Root: \`${root}\`

## Required

| Check | Status | Detail |
| ----- | ------ | ------ |
${required.map(checkRow).join('\n')}

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

## Advisory

| Check | Status | Detail |
| ----- | ------ | ------ |
${[...advisory, ...deepChecks].map(checkRow).join('\n')}

## Package Scripts

${scripts.length ? scripts.map((script) => `- ${script}`).join('\n') : '- none'}
`

if (values.write) {
  const out = join(root, '.agent', 'doctor-report.md')
  mkdirSync(join(root, '.agent'), { recursive: true })
  writeFileSync(out, report)
  console.log(out)
} else {
  console.log(report)
}
