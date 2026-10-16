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

const tool = (tool_name, tool_input) => hook('guard', { tool_name, tool_input })

test('guard blocks a read of a key, a credential or a keystore, and allows a public key', async () => {
  const secrets = ['/home/u/.ssh/config', '/home/u/.ssh/id_ed25519', '/repo/id_rsa', '/repo/certs/server.pem', '/repo/tls.key',
    '/home/u/.netrc', '/repo/cert.p12', '/repo/android/release.keystore', '/repo/android/app/google-services.json', '/repo/ios/GoogleService-Info.plist']
  for (const p of secrets) {
    const r = await read(p)
    assert.equal(r.code, 2, p)
    assert.match(r.stderr, /^compass: the read of .+ is blocked because the file holds a key, a token or a credential\./, p)
  }
  for (const command of ['cat ~/.ssh/id_rsa', 'grep -r token ~/.ssh']) assert.equal((await bash(command)).code, 2, command)
  assert.equal((await tool('Grep', { pattern: 'x', path: '/home/u/.ssh' })).code, 2)
  const keys = join(dir, 'keys')
  mkdirSync(join(keys, 'certs'), { recursive: true })
  for (const f of ['certs/server.pem', 'id_rsa', 'obj.txt']) writeFileSync(join(keys, f), 'x')
  const inKeys = (command) => runNode([HOOK, 'guard'], { input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), cwd: keys })
  for (const command of ['openssl x509 -in certs/server.pem -text', 'cat id_rsa']) assert.equal((await inKeys(command)).code, 2, command)
  for (const command of ['grep -n "e.key" src', 'node -e "console.log(obj.key)"', 'jq .key obj.txt']) assert.equal((await inKeys(command)).code, 0, `${command}: a word that is not a file passes`)
  for (const p of ['/repo/keys/id_rsa.pub', '/repo/src/keymap.ts', '/repo/docs/ssh.md']) assert.equal((await read(p)).code, 0, p)
})

test('guard blocks a read of an .npmrc that holds a literal token, and allows a ${VAR} reference', async () => {
  const npmrc = (name, text) => { const p = join(dir, name); mkdirSync(p, { recursive: true }); writeFileSync(join(p, '.npmrc'), text); return join(p, '.npmrc') }
  assert.equal((await read(npmrc('tok', '//registry.npmjs.org/:_authToken=npm_abc123\n'))).code, 2)
  assert.equal((await read(npmrc('ref', '//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n'))).code, 0)
  assert.equal((await read(npmrc('plain', 'registry=https://registry.npmjs.org/\n'))).code, 0)
  assert.equal((await read(join(dir, 'missing/.npmrc'))).code, 0)
})

test('guard blocks an edit of a lock file in Claude and Codex shapes', async () => {
  const locks = ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb', 'ios/Podfile.lock', 'App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved', 'gradle.lockfile']
  for (const name of ['Edit', 'Write', 'MultiEdit']) {
    for (const lock of locks) {
      const r = await tool(name, { file_path: `/repo/${lock}` })
      assert.equal(r.code, 2, `${name} ${lock}`)
      assert.match(r.stderr, /^compass: the edit of .+ is blocked\. Run the package manager to change a lock file\./)
    }
  }
  const own = await tool('Write', { file_path: '/repo/.agents/compass.lock.json' })
  assert.equal(own.code, 2)
  assert.match(own.stderr, /Run ac sync to change it\./)
  assert.equal((await tool('NotebookEdit', { notebook_path: '/repo/yarn.lock' })).code, 2)
  for (const name of ['Edit', 'Write']) assert.equal((await tool(name, { file_path: '/repo/src/a.ts' })).code, 0, name)
  assert.equal((await tool('Write', { file_path: '/repo/.env' })).code, 0, 'an edit is not a read')

  const patch = (path) => `*** Begin Patch\n*** Update File: ${path}\n@@\n-a\n+b\n*** End Patch\n`
  assert.equal((await tool('apply_patch', { command: patch('package-lock.json') })).code, 2)
  assert.equal((await tool('apply_patch', { input: patch('sub/yarn.lock') })).code, 2)
  assert.equal((await tool('apply_patch', { command: ['apply_patch', patch('.agents/compass.lock.json')] })).code, 2)
  assert.equal((await tool('apply_patch', { command: `*** Begin Patch\n*** Add File: src/a.ts\n+x\n*** End Patch\n` })).code, 0)
  assert.equal((await tool('apply_patch', { command: patch('src/package-lock.json.md') })).code, 0)
})

test('guard blocks a worklog or delete MCP tool (Codex has no deny rules) and passes other MCP tools', async () => {
  for (const name of ['mcp__mcp-atlassian__jira_add_worklog', 'mcp__mcp-atlassian__confluence_delete_page', 'mcp__github__delete_file']) {
    const r = await tool(name, {})
    assert.equal(r.code, 2, name)
    assert.match(r.stderr, /^compass: the tool .+ is blocked because the contract forbids a worklog or a delete\. Ask the user to do it\./)
  }
  for (const name of ['mcp__mcp-atlassian__jira_create_issue', 'mcp__github__get_issue', 'mcp__codebase-memory-mcp__search_graph']) {
    assert.deepEqual(await tool(name, {}), { code: 0, stdout: '', stderr: '' }, name)
  }
})

test('guard blocks a destructive git or rm command and passes the safe forms', async () => {
  const blocked = ['git push --force', 'git push -f origin main', 'git push origin +main', 'git push --force-with-lease origin x',
    'git reset --hard HEAD~1', 'git clean -fd', 'git -C sub clean -xdf', 'npm test && git reset --hard',
    'rm -rf /', 'rm -rf ~', 'rm -rf ~/', 'rm -rf .', 'rm -rf ./', 'rm -rf ..', 'rm -rf ../other', 'rm -rf /tmp/x', 'rm -fr "$HOME"', 'rm -r -f *', 'sudo rm -Rf /etc']
  for (const command of blocked) {
    const r = await bash(command)
    assert.equal(r.code, 2, command)
    assert.match(r.stderr, /^compass: the command .+ is blocked because you cannot undo it\. Ask the user to run it\./, command)
  }
  assert.equal((await tool('Bash', { command: ['bash', '-lc', 'git push --force'] })).code, 2)
  const safe = ['git push origin x', 'git push -u origin feature-fix', 'git reset --soft HEAD~1', 'git clean -n', 'git status',
    'rm file.txt', 'rm -rf node_modules', 'rm -rf ./dist build', 'rm -r coverage', 'echo "rm -rf is bad"', 'git log --grep=force']
  for (const command of safe) assert.equal((await bash(command)).code, 0, command)
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

test('gate reads only the end of a large transcript, and a turn there still counts', async () => {
  // 40 MB of older turns with edits, then the last turn. The gate looks at the last 2 MB only.
  const old = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Edit', input: { pad: 'x'.repeat(4000) } }] } })
  const path = join(dir, 'big.jsonl')
  writeFileSync(path, `${`${old}\n`.repeat(10_000)}${claudeTurn('Fixed it.').map((l) => JSON.stringify(l)).join('\n')}\n`)
  const started = Date.now()
  const asked = await hook('gate', { transcript_path: path })
  assert.equal(asked.code, 2, 'the last turn edited a file and has no result')
  assert.ok(Date.now() - started < 3000, `${Date.now() - started} ms`)
  const quiet = transcript([...claudeTurn('Fixed it.'), { type: 'user', message: { role: 'user', content: 'Thanks.' } }, { type: 'assistant', message: { content: [{ type: 'text', text: 'Good.' }] } }])
  assert.equal((await hook('gate', { transcript_path: quiet })).code, 0)
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
  const owned = { 'hooks.PreToolUse': 'x', 'hooks.Stop': 'x', 'hooks.SessionStart': 'x' }
  writeFileSync(join(locked, '.agents/compass.lock.json'), JSON.stringify({ keys: { '.claude/settings.json': owned, '.codex/hooks.json': owned } }))
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

test('the user copy runs an event when the project lock does not own its hook (the host kept its own hooks)', async () => {
  const kept = join(dir, 'kept')
  const user = join(dir, 'user2/hooks/compass.mjs')
  for (const f of [user, join(kept, '.agents/x')]) mkdirSync(dirname(f), { recursive: true })
  copyFileSync(HOOK, user)
  writeFileSync(join(kept, '.agents/compass.lock.json'), JSON.stringify({ keys: { '.claude/settings.json': { 'hooks.Stop': 'x' }, '.codex/hooks.json': {} } }))
  const input = JSON.stringify({ tool_name: 'Read', tool_input: { file_path: '/repo/.env' } })
  const { CLAUDE_PROJECT_DIR: _, ...bare } = process.env
  const claude = { env: { ...bare, CLAUDE_PROJECT_DIR: kept } }
  assert.equal((await runNode([user, 'guard'], { input, ...claude })).code, 2, 'Claude: the lock does not own hooks.PreToolUse')
  assert.match((await runNode([user, 'start'], claude)).stdout, /^compass: /)
  const edited = JSON.stringify({ transcript_path: transcript(claudeTurn('Fixed it.')) })
  assert.equal((await runNode([user, 'gate'], { input: edited, ...claude })).code, 0, 'Claude: the lock owns hooks.Stop')
  assert.equal((await runNode([user, 'guard'], { input, env: bare, cwd: kept })).code, 2, 'Codex: .codex/hooks.json owns no hook')
  writeFileSync(join(kept, '.agents/compass.lock.json'), 'not json')
  assert.equal((await runNode([user, 'guard'], { input, ...claude })).code, 2, 'an unreadable lock does not switch the guard off')
})
