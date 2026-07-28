// 0.6.0 — remove Cursor/Windsurf integration files we installed (compass now
// ships exactly 4 providers: Claude, Codex, Gemini, GitHub Copilot).
// Only deletes files that are recognizably ours; user-authored content stays.
import { existsSync, readFileSync, rmdirSync, unlinkSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'

// sha256 hex sliced to 16 chars (manifest.mjs sha()) of the exact
// templates/mcp/cursor.example.json content we used to ship. A host copy is
// deleted only when it is byte-identical to that shipped file.
const CURSOR_MCP_SHA16 = 'c20b4fea92d9fa62'

const sha16 = (text) => createHash('sha256').update(text).digest('hex').slice(0, 16)

export default {
  version: '0.6.0',
  describe: 'Remove Cursor/Windsurf pointers and MCP example (providers reduced to 4).',
  apply({ host, log }) {
    const pointerFiles = [
      join(host, '.cursor', 'rules', 'agent-compass.mdc'),
      join(host, '.windsurf', 'rules', 'agent-compass.md'),
    ]
    for (const file of pointerFiles) {
      if (!existsSync(file)) continue
      // Our pointer signature — never delete user-authored rules.
      if (!readFileSync(file, 'utf8').includes('canonical agent-compass contract')) continue
      unlinkSync(file)
      log(`removed ${file.slice(host.length + 1)}`)
      try { rmdirSync(dirname(file)) } catch {}
      try { rmdirSync(dirname(dirname(file))) } catch {}
    }
    const mcpExample = join(host, '.mcp', 'cursor.example.json')
    if (existsSync(mcpExample) && sha16(readFileSync(mcpExample, 'utf8')) === CURSOR_MCP_SHA16) {
      unlinkSync(mcpExample)
      log('removed .mcp/cursor.example.json')
    }
  },
}
