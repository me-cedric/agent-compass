#!/usr/bin/env node
// mcp-probe.mjs — static MCP readiness probe, safe by default.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { parseCliArgs, resolveRoot } from './lib/args.mjs'
import { MCP_EXAMPLE_REL, codeIntelSelected } from './lib/codebase-memory.mjs'

const { values, positionals } = parseCliArgs({
  name: 'mcp-probe',
  script: 'mcp-probe.mjs',
  summary: 'Static MCP readiness probe, safe by default.',
  positionals: [{ name: 'root', required: false }],
  options: {
    write: { type: 'boolean', desc: 'Write report to .agent/mcp-readiness.md.' },
    json: { type: 'boolean', desc: 'Print machine-readable JSON instead of markdown.' },
    strict: { type: 'boolean', desc: 'Exit 1 when no config is found or any server has issues.' },
  },
})
const root = resolveRoot(positionals)
const readJson = (rel) => { try { return JSON.parse(readFileSync(join(root, rel), 'utf8')) } catch { return null } }
const configs = [
  '.mcp.json',
  '.mcp/recommended.example.json',
  '.mcp/projectmem.example.json',
  '.mcp/codebase-memory.example.json',
  '.mcp/figma.example.json',
  '.mcp/figma-mcp-go.example.json',
  '.mcp/headroom.example.json',
  '.mcp/gemini.example.json',
  '.mcp/copilot-cloud.example.json',
  '.mcp/angular-cli.example.json',
]
  // The code-intelligence example ships to every host as a catalogue entry.
  // Probing it before the host opts in would report a missing command as an
  // issue for a tool nobody asked for.
  .filter((path) => path !== MCP_EXAMPLE_REL || codeIntelSelected(root))
  .map((path) => [path, readJson(path)]).filter(([, json]) => json)
const commandExists = (cmd) => Boolean(spawnSync('sh', ['-lc', `command -v ${cmd}`], { encoding: 'utf8' }).stdout.trim())
const localPath = (text) => /(^|["'(\s=])((?:\/(?!absolute\/path\/to(?:\/|$)|path\/to(?:\/|$))[A-Za-z0-9._-]+){2,}[^"')\s,;\]]*|[A-Za-z]:\\Users\\[^"')\s,;\]]+)/m.test(text)
const rows = []
for (const [path, cfg] of configs) {
  for (const [name, server] of Object.entries(cfg.mcpServers || {})) {
    const serialized = JSON.stringify(server)
    const placeholder = serialized.includes('/absolute/path/to/repo')
    const pathLeak = localPath(serialized)
    const command = server.command || (server.url || server.httpUrl ? 'http' : '')
    const ok = placeholder || pathLeak ? false : command === 'http' ? true : commandExists(command)
    rows.push({ path, name, command, ok, detail: placeholder ? 'placeholder path' : pathLeak ? 'local absolute path' : ok ? 'available' : 'command missing' })
  }
}
if (existsSync(join(root, '.mcp/codex.example.toml'))) {
  rows.push({ path: '.mcp/codex.example.toml', name: 'codex', command: 'toml', ok: true, detail: 'exists (toml not parsed)' })
}
const report = `# MCP Readiness

| Config | Server | Command | Status | Detail |
| ------ | ------ | ------- | ------ | ------ |
${rows.length ? rows.map((r) => `| ${r.path} | ${r.name} | ${r.command} | ${r.ok ? 'ok' : 'issue'} | ${r.detail} |`).join('\n') : '| none | none | none | issue | no MCP config found |'}
`
if (values.json) console.log(JSON.stringify({ schema: 1, root, servers: rows }, null, 2))
else if (values.write) {
  mkdirSync(join(root, '.agent'), { recursive: true })
  writeFileSync(join(root, '.agent', 'mcp-readiness.md'), report)
  console.log(join(root, '.agent', 'mcp-readiness.md'))
} else console.log(report)
if (values.strict && (!rows.length || rows.some((r) => !r.ok))) process.exit(1)
