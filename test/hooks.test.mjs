import assert from 'node:assert/strict'
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { runNode } from './helpers.mjs'

const HOOK = join(dirname(dirname(fileURLToPath(import.meta.url))), 'core/files/.agents/hooks/compass.mjs')
const dir = mkdtempSync(join(tmpdir(), 'ac-hooks-'))
test.after(() => rmSync(dir, { recursive: true, force: true }))

const hook = (mode, input) => runNode([HOOK, mode], { input: typeof input === 'string' ? input : JSON.stringify(input) })
const bash = (command) => hook('guard', { tool_name: 'Bash', tool_input: { command } })
const read = (file_path) => hook('guard', { tool_name: 'Read', tool_input: { file_path } })

let n = 0
const transcript = (lines) => {
  const path = join(dir, `t${n++}.jsonl`)
  writeFileSync(path, `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`)
  return path
}
const claudeTurn = (text, tool = 'Edit') => [
  { type: 'user', message: { role: 'user', content: 'Fix the bug.' } },
  { type: 'assistant', message: { content: [{ type: 'tool_use', name: tool, input: {} }] } },
  { type: 'user', message: { content: [{ type: 'tool_result', content: 'ok' }] } },
  { type: 'assistant', message: { content: [{ type: 'text', text }] } },
]

test('guard blocks a read of .env in Bash, Read and Grep', async () => {
  for (const command of ['cat .env', 'source .env.local', 'grep KEY ./config/.env.production', 'docker run --env-file=.env app', 'cat "$HOME/.env"']) {
    const r = await bash(command)
    assert.equal(r.code, 2, command)
    assert.match(r.stderr, /compass: the read of .*\.env.* is blocked/)
  }
  assert.equal((await read('/repo/.env')).code, 2)
  assert.equal((await hook('guard', { tool_name: 'Grep', tool_input: { pattern: 'KEY', path: '.env' } })).code, 2)
  assert.equal((await hook('guard', { tool_name: 'Grep', tool_input: { pattern: 'KEY', glob: '.env*' } })).code, 2)
  assert.equal((await hook('guard', { tool_name: 'Grep', tool_input: { pattern: 'KEY', glob: '{.env,*.ts}' } })).code, 2)
  for (const glob of ['*.env', '**/*.env', '.e*', '*env*', 'config/.env.*']) {
    assert.equal((await hook('guard', { tool_name: 'Grep', tool_input: { pattern: 'KEY', glob } })).code, 2, glob)
  }
  for (const glob of ['*.ts', '*.env.example', '!.env']) {
    assert.equal((await hook('guard', { tool_name: 'Grep', tool_input: { pattern: 'KEY', glob } })).code, 0, glob)
  }
  assert.equal((await hook('guard', { tool_name: 'Bash', tool_input: { command: ['bash', '-lc', 'cat .env'] } })).code, 2)
})

test('guard allows .env.example and commands that only name env variables', async () => {
  for (const command of ['cat .env.example', 'cp .env.example .env.sample', 'node -e "console.log(process.env.HOME)"', 'npm test']) {
    const r = await bash(command)
    assert.equal(r.code, 0, command)
    assert.equal(r.stderr, '')
  }
  assert.equal((await read('/repo/.env.example')).code, 0)
  assert.equal((await read('/repo/src/env.ts')).code, 0)
})

test('a hook with bad input exits 0 and an unknown mode exits 1', async () => {
  assert.equal((await hook('guard', 'not json')).code, 0)
  assert.equal((await hook('gate', '{}')).code, 0)
  assert.equal((await hook('gate', { transcript_path: join(dir, 'missing.jsonl') })).code, 0)
  assert.equal((await runNode([HOOK, 'nope'])).code, 1)
})

test('gate asks once for the summary after a Claude turn that edited files', async () => {
  const bare = await hook('gate', { transcript_path: transcript(claudeTurn('Fixed it.')) })
  assert.equal(bare.code, 2)
  assert.match(bare.stderr, /compass completion gate/)
  assert.equal((await hook('gate', { transcript_path: transcript(claudeTurn('Fixed it.')), stop_hook_active: true })).code, 0)
  assert.equal((await hook('gate', { transcript_path: transcript(claudeTurn('Changed a.mjs. npm test: passed.')) })).code, 0)
  assert.equal((await hook('gate', { transcript_path: transcript(claudeTurn('Fixed it.', 'Read')) })).code, 0)
  assert.equal((await hook('gate', { transcript_path: transcript(claudeTurn('Changed a.mjs. 85 tests passing.')) })).code, 0)
  const delegated = (subagent_type) => transcript([
    { type: 'user', message: { content: 'Fix the bug.' } },
    { type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Agent', input: { subagent_type } }] } },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'Fixed.' }] } },
  ])
  assert.equal((await hook('gate', { transcript_path: delegated('worker') })).code, 2)
  const tool = (name, input) => transcript([
    { type: 'user', message: { content: 'Fix the bug.' } },
    { type: 'assistant', message: { content: [{ type: 'tool_use', name, input }] } },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'Fixed.' }] } },
  ])
  assert.equal((await hook('gate', { transcript_path: tool('Task', { subagent_type: 'worker' }) })).code, 2)
  assert.equal((await hook('gate', { transcript_path: tool('Workflow', { name: 'deliver' }) })).code, 2)
  assert.equal((await hook('gate', { transcript_path: delegated('scout') })).code, 0)
  const question = [...claudeTurn('Fixed it.'), { type: 'user', message: { content: [{ type: 'text', text: 'Why?' }] } },
    { type: 'assistant', message: { content: [{ type: 'text', text: 'Because.' }] } }]
  assert.equal((await hook('gate', { transcript_path: transcript(question) })).code, 0)
})

test('gate reads a Codex transcript and prefers last_assistant_message', async () => {
  const codex = transcript([
    { type: 'event_msg', payload: { type: 'user_message', message: 'Fix the bug.' } },
    { type: 'response_item', payload: { type: 'custom_tool_call', name: 'apply_patch', input: '*** Begin Patch' } },
    { type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Done.' }] } },
  ])
  assert.equal((await hook('gate', { transcript_path: codex })).code, 2)
  assert.equal((await hook('gate', { transcript_path: codex, last_assistant_message: 'npm test failed: 1 test.' })).code, 0)
})

test('start prints a stable reminder under 1,000 characters', async () => {
  const a = await runNode([HOOK, 'start'])
  const b = await runNode([HOOK, 'start'])
  assert.equal(a.code, 0)
  assert.equal(a.stdout, b.stdout)
  assert.ok(a.stdout.length > 50 && a.stdout.length <= 1000, `${a.stdout.length} chars`)
})

test('a copy outside the project stays silent when the project has the compass lock', async () => {
  const locked = join(dir, 'locked')
  const plain = join(dir, 'plain')
  const own = join(locked, '.agents/hooks/compass.mjs')
  const user = join(dir, 'user/hooks/compass.mjs')
  for (const f of [own, user, join(plain, 'x')]) mkdirSync(dirname(f), { recursive: true })
  writeFileSync(join(locked, '.agents/compass.lock.json'), '{}\n')
  copyFileSync(HOOK, own)
  copyFileSync(HOOK, user)
  const input = JSON.stringify({ tool_name: 'Read', tool_input: { file_path: '/repo/.env' } })
  const edited = JSON.stringify({ transcript_path: transcript(claudeTurn('Fixed it.')) })
  const { CLAUDE_PROJECT_DIR: _, ...bare } = process.env
  const at = (project) => ({ env: { ...bare, CLAUDE_PROJECT_DIR: project } })

  assert.equal((await runNode([own, 'guard'], { input, ...at(locked) })).code, 2)
  assert.equal((await runNode([own, 'gate'], { input: edited, ...at(locked) })).code, 2)
  assert.match((await runNode([own, 'start'], at(locked))).stdout, /^compass: /)
  for (const [mode, text] of [['guard', input], ['gate', edited]]) {
    const r = await runNode([user, mode], { input: text, ...at(locked) })
    assert.deepEqual([r.code, r.stdout, r.stderr], [0, '', ''], mode)
  }
  assert.equal((await runNode([user, 'start'], at(locked))).stdout, '')
  assert.equal((await runNode([user, 'nope'], at(locked))).code, 1)
  assert.equal((await runNode([user, 'guard'], { input, ...at(plain) })).code, 2)
  assert.match((await runNode([user, 'start'], at(plain))).stdout, /^compass: /)
  assert.equal((await runNode([user, 'guard'], { input, env: bare, cwd: locked })).code, 0, 'the project is the current directory')
  assert.equal((await runNode([user, 'guard'], { input, env: bare, cwd: plain })).code, 2)
})
