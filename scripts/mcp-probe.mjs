#!/usr/bin/env node
// mcp-probe.mjs — static MCP readiness probe, safe by default.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'

const args = process.argv.slice(2)
const help = `Usage: node scripts/mcp-probe.mjs [root] [--write] [--json] [--strict]`
if (args.includes('--help')) { console.log(help); process.exit(0) }
const root = resolve(args.find((a) => !a.startsWith('--')) || process.cwd())
const readJson = (rel) => { try { return JSON.parse(readFileSync(join(root, rel), 'utf8')) } catch { return null } }
const configs = ['.mcp.json', '.mcp/recommended.example.json', '.mcp/projectmem.example.json', '.mcp/figma.example.json'].map((path) => [path, readJson(path)]).filter(([, json]) => json)
const commandExists = (cmd) => Boolean(spawnSync('sh', ['-lc', `command -v ${cmd}`], { encoding: 'utf8' }).stdout.trim())
const rows = []
for (const [path, cfg] of configs) {
  for (const [name, server] of Object.entries(cfg.mcpServers || {})) {
    const placeholder = JSON.stringify(server).includes('/absolute/path/to/repo')
    const command = server.command || (server.url || server.httpUrl ? 'http' : '')
    const ok = placeholder ? false : command === 'http' ? true : commandExists(command)
    rows.push({ path, name, command, ok, detail: placeholder ? 'placeholder path' : ok ? 'available' : 'command missing' })
  }
}
const report = `# MCP Readiness

| Config | Server | Command | Status | Detail |
| ------ | ------ | ------- | ------ | ------ |
${rows.length ? rows.map((r) => `| ${r.path} | ${r.name} | ${r.command} | ${r.ok ? 'ok' : 'issue'} | ${r.detail} |`).join('\n') : '| none | none | none | issue | no MCP config found |'}
`
if (args.includes('--json')) console.log(JSON.stringify({ schema: 1, root, servers: rows }, null, 2))
else if (args.includes('--write')) {
  mkdirSync(join(root, '.agent'), { recursive: true })
  writeFileSync(join(root, '.agent', 'mcp-readiness.md'), report)
  console.log(join(root, '.agent', 'mcp-readiness.md'))
} else console.log(report)
if (args.includes('--strict') && (!rows.length || rows.some((r) => !r.ok))) process.exit(1)
