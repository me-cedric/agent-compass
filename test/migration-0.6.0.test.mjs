import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { runNode } from './helpers.mjs'
import { sha } from '../scripts/manifest.mjs'

const root = new URL('..', import.meta.url)
const install = new URL('../scripts/install.mjs', import.meta.url).pathname
const sync = new URL('../scripts/sync.mjs', import.meta.url).pathname
const LOCK = '.agent/agent-compass.lock'

// Byte-exact copy of the templates/mcp/cursor.example.json shipped before
// 0.6.0 (the template itself was deleted). Its sha() must equal the constant
// hardcoded in migrations/0.6.0.mjs for the migration to delete host copies.
const SHIPPED_CURSOR_MCP = `{
  "mcpServers": {
    "projectmem": {
      "command": "uvx",
      "args": ["--from", "projectmem", "pjm-mcp"],
      "cwd": "."
    },
    "figma": {
      "url": "http://127.0.0.1:3845/mcp"
    },
    "figma-mcp-go": {
      "command": "npx",
      "args": ["-y", "@vkhanhqui/figma-mcp-go@latest"]
    }
  }
}
`

// Pointer bodies install.mjs used to write — both carry our signature line.
const OUR_CURSOR_POINTER = `---
description: Agent Compass contract
alwaysApply: true
---

Read \`../docs/agent-compass/AGENTS.md\` first. It is the canonical agent-compass contract.

Host project \`AGENTS.md\` takes precedence when it adds project-specific rules.
`
const OUR_WINDSURF_POINTER = `# sample — Windsurf Agent Guide

Read \`../docs/agent-compass/AGENTS.md\` first. It is the canonical agent-compass contract.

Host project \`AGENTS.md\` takes precedence when it adds project-specific rules.
`

const setup = async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-mig060-'))
  const r = await runNode([install, host], { cwd: root.pathname })
  assert.equal(r.code, 0, r.stderr)
  await pinLock(host, '0.5.0')
  return host
}

// Pin the lock below 0.6.0 so sync --target 0.6.0 selects the migration.
const pinLock = async (host, version) => {
  const lock = JSON.parse(await readFile(join(host, LOCK), 'utf8'))
  lock.version = version
  await writeFile(join(host, LOCK), JSON.stringify(lock, null, 2))
}

const seedLegacyPointers = async (host, { cursor, windsurf, mcp }) => {
  await mkdir(join(host, '.cursor', 'rules'), { recursive: true })
  await mkdir(join(host, '.windsurf', 'rules'), { recursive: true })
  await writeFile(join(host, '.cursor', 'rules', 'agent-compass.mdc'), cursor)
  await writeFile(join(host, '.windsurf', 'rules', 'agent-compass.md'), windsurf)
  await writeFile(join(host, '.mcp', 'cursor.example.json'), mcp)
}

test('shipped cursor MCP fixture matches the migration hash constant', () => {
  assert.equal(sha(SHIPPED_CURSOR_MCP), 'c20b4fea92d9fa62')
})

test('migration 0.6.0 removes our cursor/windsurf pointers and the untouched MCP example', async () => {
  const host = await setup()
  try {
    await seedLegacyPointers(host, {
      cursor: OUR_CURSOR_POINTER,
      windsurf: OUR_WINDSURF_POINTER,
      mcp: SHIPPED_CURSOR_MCP,
    })

    const r = await runNode([sync, host, '--target', '0.6.0'], { cwd: root.pathname })
    assert.equal(r.code, 0, r.stderr)
    assert.match(r.stdout, /0\.6\.0/)
    assert.ok(!existsSync(join(host, '.cursor')), '.cursor should be removed once emptied')
    assert.ok(!existsSync(join(host, '.windsurf')), '.windsurf should be removed once emptied')
    assert.ok(!existsSync(join(host, '.mcp', 'cursor.example.json')), 'shipped MCP example should be removed')

    // Idempotent: re-running against the already-cleaned host succeeds.
    await pinLock(host, '0.5.0')
    const again = await runNode([sync, host, '--target', '0.6.0'], { cwd: root.pathname })
    assert.equal(again.code, 0, again.stderr)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('migration 0.6.0 preserves user-authored rules and edited MCP examples', async () => {
  const host = await setup()
  try {
    const editedMcp = SHIPPED_CURSOR_MCP.replace('"cwd": "."', '"cwd": "./apps/api"')
    await seedLegacyPointers(host, {
      cursor: 'my own cursor rules\n',
      windsurf: 'my own windsurf rules\n',
      mcp: editedMcp,
    })

    const r = await runNode([sync, host, '--target', '0.6.0'], { cwd: root.pathname })
    assert.equal(r.code, 0, r.stderr)
    assert.equal(await readFile(join(host, '.cursor', 'rules', 'agent-compass.mdc'), 'utf8'), 'my own cursor rules\n')
    assert.equal(await readFile(join(host, '.windsurf', 'rules', 'agent-compass.md'), 'utf8'), 'my own windsurf rules\n')
    assert.equal(await readFile(join(host, '.mcp', 'cursor.example.json'), 'utf8'), editedMcp)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})
