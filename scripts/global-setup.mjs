#!/usr/bin/env node
// global-setup.mjs — non-destructive user-level Agent Compass setup.

import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { stdin as input, stdout as output } from 'node:process'
import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { fileURLToPath } from 'node:url'

import { CAPABILITY_PACKS } from './lib/capability-packs.mjs'
import { parseCliArgs } from './lib/args.mjs'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))

const { values, positionals } = parseCliArgs({
  name: 'global-setup',
  script: 'global-setup.mjs',
  summary: 'Set up user-level Agent Compass references without replacing existing entries.',
  positionals: [{ name: 'home-dir', required: false }],
  options: {
    copy: { type: 'boolean', desc: 'Copy skills into user-level skill dirs (default).' },
    symlink: { type: 'boolean', desc: 'Symlink skills instead of copying.' },
    'no-skills': { type: 'boolean', desc: 'Skip syncing skills.' },
    jira: { type: 'boolean', desc: 'Configure mcp-atlassian globally for Codex and Claude.' },
    'jira-url': { type: 'string', value: '<url>', desc: 'Jira base URL; prompted when omitted. The Jira personal token is always prompted and never echoed.' },
    dry: { type: 'boolean', desc: 'Print what would change; write nothing.' },
  },
})

const jiraUrlFlag = values['jira-url'] || null
const home = resolve(positionals[0] || process.env.HOME || process.cwd())
const dry = Boolean(values.dry)
const mode = values.symlink ? 'symlink' : 'copy'
const noSkills = Boolean(values['no-skills'])
const jira = Boolean(values.jira)

const collectJiraConfig = async () => {
  let muted = false
  const terminal = Boolean(input.isTTY && output.isTTY)
  const promptOutput = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) output.write(chunk, encoding)
      callback()
    },
  })
  const rl = createInterface({ input, output: promptOutput, terminal })
  try {
    const rawUrl = (jiraUrlFlag || await rl.question('Jira URL: ')).trim()
    let url
    try {
      url = new URL(rawUrl)
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error()
    } catch {
      throw new Error('Jira URL must be a valid HTTP(S) URL.')
    }

    const tokenAnswer = rl.question('Jira personal token: ')
    muted = terminal
    const token = (await tokenAnswer).trim()
    muted = false
    if (terminal) output.write('\n')
    if (!token) throw new Error('Jira personal token is required.')

    return { url: url.toString().replace(/\/$/, ''), token }
  } finally {
    muted = false
    rl.close()
  }
}

let jiraConfig = null
if (jira && !dry) {
  try {
    jiraConfig = await collectJiraConfig()
  } catch (error) {
    console.error(`Jira MCP setup failed: ${error.message}`)
    process.exit(1)
  }
}

const writeMissing = (rel, text) => {
  const dest = join(home, rel)
  if (existsSync(dest)) { console.log(`skip ${rel}`); return }
  if (dry) { console.log(`would create ${rel}`); return }
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, text)
  console.log(`created ${rel}`)
}
writeMissing('.agent-compass/README.md', `# Global Agent Compass

This directory records user-level Agent Compass setup.

Repo source: ${AC}

Project rules still win over global rules. Keep personal preferences here, not
in shared project files.
`)
writeMissing('.codex/AGENTS.md', `# Global Codex Agent Compass Pointer

Prefer project-local AGENTS.md. If absent, use Agent Compass baseline:
${AC}/AGENTS.md

Default personal style:

- English unless the user asks otherwise.
- Use caveman full for concise, useful output.
- Use ponytail full for the smallest correct change.
- Never invent validation commands; use the repo command registry.
- No commit, push, PR, deploy, publish, or production write unless requested.
`)
writeMissing('.claude/CLAUDE.md', `# Global Claude Agent Compass Pointer

Prefer project-local AGENTS.md or CLAUDE.md. If absent, use:
${AC}/AGENTS.md
`)
if (!noSkills) {
  const capabilitySkills = new Set(Object.values(CAPABILITY_PACKS).flatMap((pack) => pack.skills))
  const skills = readdirSync(join(AC, 'skills'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && !capabilitySkills.has(d.name))
  for (const relDir of ['.agents/skills', '.codex/skills', '.claude/skills']) {
    const dir = join(home, relDir)
    if (!dry) mkdirSync(dir, { recursive: true })
    for (const skill of skills) {
      const src = join(AC, 'skills', skill.name)
      const dest = join(dir, skill.name)
      if (existsSync(dest)) continue
      if (dry) console.log(`would ${mode} ${skill.name} -> ${relDir}`)
      else if (mode === 'symlink') symlinkSync(src, dest, 'dir')
      else cpSync(src, dest, { recursive: true })
    }
  }
}

const secureWrite = (dest, text) => {
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, text, { mode: 0o600 })
  chmodSync(dest, 0o600)
}

const configureJiraMcp = ({ url, token }) => {
  const codexPath = join(home, '.codex', 'config.toml')
  const codex = existsSync(codexPath) ? readFileSync(codexPath, 'utf8') : ''
  const claudePath = join(home, '.claude.json')
  const claudeExists = existsSync(claudePath)
  let claude = {}
  if (claudeExists) {
    try {
      claude = JSON.parse(readFileSync(claudePath, 'utf8'))
    } catch {
      throw new Error('.claude.json is not valid JSON; Jira MCP was not configured.')
    }
  }
  if (claude.mcpServers == null) claude.mcpServers = {}
  if (typeof claude.mcpServers !== 'object' || Array.isArray(claude.mcpServers)) {
    throw new Error('.claude.json mcpServers must be an object.')
  }

  if (/^\s*\[mcp_servers\.(?:"mcp-atlassian"|mcp-atlassian)\]\s*$/m.test(codex)) {
    console.log('skip .codex/config.toml (mcp-atlassian exists)')
  } else {
    const block = `[mcp_servers.mcp-atlassian]
type = "stdio"
command = "uvx"
args = ["mcp-atlassian"]

[mcp_servers.mcp-atlassian.env]
JIRA_URL = ${JSON.stringify(url)}
JIRA_PERSONAL_TOKEN = ${JSON.stringify(token)}
`
    const separator = codex && !codex.endsWith('\n') ? '\n\n' : codex ? '\n' : ''
    secureWrite(codexPath, codex + separator + block)
    console.log(`${codex ? 'updated' : 'created'} .codex/config.toml`)
  }

  if (Object.hasOwn(claude.mcpServers, 'mcp-atlassian')) {
    console.log('skip .claude.json (mcp-atlassian exists)')
  } else {
    claude.mcpServers['mcp-atlassian'] = {
      type: 'stdio',
      command: 'uvx',
      args: ['mcp-atlassian'],
      env: { JIRA_URL: url, JIRA_PERSONAL_TOKEN: token },
    }
    secureWrite(claudePath, JSON.stringify(claude, null, 2) + '\n')
    console.log(`${claudeExists ? 'updated' : 'created'} .claude.json`)
  }
}

if (jiraConfig) {
  try {
    configureJiraMcp(jiraConfig)
  } catch (error) {
    console.error(`Jira MCP setup failed: ${error.message}`)
    process.exit(1)
  }
} else if (jira && dry) {
  console.log('would configure Jira MCP -> .codex/config.toml, .claude.json')
}

const manifest = { schema: 1, source: AC, mode, skills: !noSkills, capabilityPacks: [], updatedAt: new Date().toISOString() }
if (!dry) writeFileSync(join(home, '.agent-compass', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
else console.log(JSON.stringify(manifest, null, 2))
