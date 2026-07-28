import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import test from 'node:test'

const AC = new URL('..', import.meta.url).pathname

// Every provider entry file must route mission requests through MISSIONS.md —
// otherwise an agent spawned via that provider misses the adopt/bootstrap/
// extend playbooks entirely.
const PROVIDER_FILES = [
  'CLAUDE.md',
  'CODEX.md',
  'GEMINI.md',
  '.github/copilot-instructions.md',
  'AGENTS.md',
]

test('every provider entry file routes through MISSIONS.md', async () => {
  for (const file of PROVIDER_FILES) {
    const text = await readFile(join(AC, file), 'utf8')
    assert.match(text, /MISSIONS\.md/, `${file} must reference MISSIONS.md`)
  }
})

test('MISSIONS.md routes to playbooks that exist and are runnable', async () => {
  const missions = await readFile(join(AC, 'MISSIONS.md'), 'utf8')
  for (const skill of ['compass-adopt', 'compass-bootstrap', 'compass-extend']) {
    assert.match(missions, new RegExp(`skills/${skill}/SKILL\\.md`), `missing route to ${skill}`)
    await readFile(join(AC, 'skills', skill, 'SKILL.md'), 'utf8')
  }
  // Quick-reference commands must reference scripts that exist.
  for (const match of missions.matchAll(/node (scripts\/[\w-]+\.mjs)/g)) {
    await readFile(join(AC, match[1]), 'utf8')
  }
  assert.match(missions, /catalog\.mjs/, 'catalog must be discoverable from MISSIONS.md')
  assert.match(missions, /adopt\.mjs/, 'adopt must be discoverable from MISSIONS.md')
})
