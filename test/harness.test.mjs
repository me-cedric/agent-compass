import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { SHELL } from '../engine/util.mjs'
import { fileURLToPath } from 'node:url'
import { parseToml, runNode } from './helpers.mjs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const temps = []
test.after(() => { for (const d of temps) rmSync(d, { recursive: true, force: true }) })
const temp = (prefix) => { const d = mkdtempSync(join(tmpdir(), prefix)); temps.push(d); return d }

// A compass tree with the real engine and the real core/ harness, and no legacy root skills.
const makeCompass = () => {
  const ac = temp('ac-harness-')
  for (const d of ['bin', 'engine', 'core']) cpSync(join(REPO, d), join(ac, d), { recursive: true })
  writeFileSync(join(ac, 'package.json'), '{ "version": "1.0.0-test" }\n')
  return ac
}

const ac = (compass, args) => runNode([join(compass, 'bin/ac.mjs'), ...args])
const read = (root, rel) => readFileSync(join(root, rel), 'utf8')
const shell = (command, root, input) => spawnSync(command, {
  shell: SHELL, cwd: root, input: JSON.stringify(input), encoding: 'utf8', timeout: 10_000,
  env: { ...process.env, CLAUDE_PROJECT_DIR: root, GIT_TERMINAL_PROMPT: '0' },
})

const compass = makeCompass()
const host = temp('ac-harness-host-')
spawnSync('git', ['init', '-q'], { cwd: host, timeout: 10_000 })

test('init installs the harness and every generated JSON and TOML file parses', async () => {
  const r = await ac(compass, ['init', '--root', host])
  assert.equal(r.code, 0, r.stderr)
  const settings = JSON.parse(read(host, '.claude/settings.json'))
  assert.equal(settings.outputStyle, 'compass')
  assert.deepEqual(settings.attribution, { commit: '', pr: '', sessionUrl: false })
  assert.equal(settings.hooks.PreToolUse[0].matcher, 'Read|Grep|Glob|Bash|Edit|Write|MultiEdit|NotebookEdit')
  assert.equal(settings.hooks.PreToolUse[0].hooks[0].onFailure, 'block')
  assert.equal(settings.hooks.Stop[0].hooks[0].onFailure, undefined, 'Stop does not take onFailure')
  const codexHooks = JSON.parse(read(host, '.codex/hooks.json')).hooks
  assert.deepEqual(Object.keys(codexHooks), ['PreToolUse', 'Stop', 'SessionStart'])
  assert.equal(codexHooks.PreToolUse[0].matcher, 'Bash|apply_patch|mcp__.*')

  const config = parseToml(read(host, '.codex/config.toml'))
  assert.deepEqual(config, { model_verbosity: 'low', model_reasoning_summary: 'none' })
  const models = { scout: 'gpt-6-luna', worker: 'gpt-6.1-sol', reviewer: 'gpt-6.1-sol' }
  for (const [name, model] of Object.entries(models)) {
    const agent = parseToml(read(host, `.codex/agents/${name}.toml`))
    assert.equal(agent.name, name)
    assert.equal(agent.model, model)
    assert.ok(agent.description && agent.developer_instructions.startsWith(`You are`))
  }
  assert.match(read(host, '.claude/agents/scout.md'), /^model: haiku$/m)
  assert.match(read(host, '.claude/agents/reviewer.md'), /^model: sonnet$/m)
  assert.match(read(host, '.github/agents/scout.agent.md'), /^---\nname: scout\ndescription: ".+"\ntools: \[Read, Grep, Glob, Bash\]\nmodel: "Claude Haiku 5.5"\nreasoning-effort: low\n---\n/)
  for (const name of ['worker', 'reviewer']) assert.match(read(host, `.github/agents/${name}.agent.md`), /^include-custom-instructions: true$/m, name)
  assert.doesNotMatch(read(host, '.github/agents/scout.agent.md'), /include-custom-instructions/)
  const sandbox = { scout: 'read-only', reviewer: 'read-only', worker: 'workspace-write' }
  for (const [name, mode] of Object.entries(sandbox)) assert.equal(parseToml(read(host, `.codex/agents/${name}.toml`)).sandbox_mode, mode, name)
  assert.match(read(host, '.claude/agents/scout.md'), /^omitClaudeMd: true$/m)
  assert.match(read(host, '.claude/output-styles/compass.md'), /^keep-coding-instructions: true$/m)
  assert.match(read(host, 'CLAUDE.md'), /^@AGENTS\.md$/m)

  const block = read(REPO, 'core/blocks/AGENTS.md').trimEnd().split('\n')
  assert.ok(block.length <= 120, `${block.length} lines`)
  assert.ok(block.join('\n').length <= 2800, `${block.join('\n').length} chars: the block must stay under 700 tokens`)
  const claudeLines = read(host, 'CLAUDE.md').split('\n').filter((l) => l.trim() && !l.startsWith('<!--') && l !== '@AGENTS.md')
  assert.ok(claudeLines.length <= 15, `${claudeLines.length} Claude lines`)
})

test('the installed hook commands block cat .env and Read .env, and allow .env.example', () => {
  const settings = JSON.parse(read(host, '.claude/settings.json'))
  const codex = JSON.parse(read(host, '.codex/hooks.json'))
  for (const command of [settings.hooks.PreToolUse[0].hooks[0].command, codex.hooks.PreToolUse[0].hooks[0].command]) {
    assert.equal(shell(command, host, { tool_name: 'Bash', tool_input: { command: 'cat .env' } }).status, 2, command)
    assert.equal(shell(command, host, { tool_name: 'Read', tool_input: { file_path: join(host, '.env') } }).status, 2, command)
    assert.equal(shell(command, host, { tool_name: 'Bash', tool_input: { command: 'cat .env.example' } }).status, 0, command)
    assert.equal(shell(command, host, { tool_name: 'Read', tool_input: { file_path: join(host, '.env.example') } }).status, 0, command)
    assert.equal(shell(command, host, { tool_name: 'Bash', tool_input: { command: 'git push --force' } }).status, 2, command)
  }
  assert.equal(shell(settings.hooks.PreToolUse[0].hooks[0].command, host, { tool_name: 'Edit', tool_input: { file_path: join(host, 'package-lock.json') } }).status, 2)
  assert.equal(shell(codex.hooks.PreToolUse[0].hooks[0].command, host, { tool_name: 'mcp__mcp-atlassian__jira_add_worklog', tool_input: {} }).status, 2)
})

// Claude permission rules: `*` matches any run of characters, in the tool name and inside Bash(...).
const globRe = (glob) => new RegExp(`^${glob.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replaceAll('*', '.*')}$`)
const hits = (rules, call) => rules.some((r) => globRe(r).test(call))
const jira = (t) => `mcp__mcp-atlassian__${t}`
const gh = (t) => [`mcp__github__${t}`, `mcp__plugin_github_github__${t}`]

test('the permission rules deny, ask and pass the listed tools and commands', () => {
  const { deny, ask } = JSON.parse(read(host, '.claude/settings.json')).permissions
  const denied = [
    ...['jira_add_worklog', 'jira_get_worklog', 'jira_delete_issue', 'confluence_delete_page'].map(jira), ...gh('delete_file'),
    'Read(./.env)', 'Read(app/.env.local)', 'Read(./.env.production)', 'Read(./.envrc)',
    ...['gh issue delete 1', 'gh repo delete o/r', 'glab issue delete 1', 'glab repo delete g/r', 'jira issue delete X-1', 'jira issue worklog add X-1 1h'].map((c) => `Bash(${c})`),
  ]
  const asked = [
    ...['jira_transition_issue', 'jira_add_comment', 'jira_edit_comment', 'jira_create_issue', 'jira_update_issue', 'jira_assign_issue',
      'jira_create_issue_link', 'jira_remove_issue_link', 'jira_link_to_epic', 'jira_move_issue', 'jira_add_issues_to_sprint', 'jira_update_sprint',
      'jira_create_version', 'jira_add_watcher', 'jira_remove_watcher', 'jira_update_proforma_form_answers',
      'confluence_create_page', 'confluence_update_page', 'confluence_add_comment', 'confluence_reply_to_comment', 'confluence_add_label'].map(jira),
    ...['create_pull_request', 'add_issue_comment', 'issue_write', 'pull_request_review_write', 'update_pull_request', 'merge_pull_request',
      'push_files', 'run_workflow', 'rerun_workflow_run', 'assign_copilot_to_issue', 'request_copilot_review', 'create_or_update_file'].flatMap(gh),
    ...['gh api -X POST repos/o/r/issues', 'gh api repos/o/r/issues -f title=x', 'gh api repos/o/r --method PATCH', 'gh api repos/o/r -F a=1',
      'gh api repos/o/r --input body.json', 'gh pr review 1 --approve', 'gh pr close 1', 'gh pr edit 1 --title x', 'gh release create v1',
      'glab mr approve 1', 'glab mr update 1', 'glab mr close 1', 'jira issue create -tBug', 'jira issue edit X-1', 'jira issue move X-1 Done',
      'jira issue assign X-1 me', 'jira issue comment add X-1 hi', 'jira issue link X-1 X-2 Blocks', 'acli jira workitem create',
      'git push --force', 'git push origin x --force-with-lease', 'git push -f origin x', 'git push origin +main', 'git reset --hard HEAD',
      'git reset HEAD~1 --hard', 'git clean -fd', 'git branch -D x', 'rm -rf dist', 'rm -r dist', 'rm -fr dist', 'rm -R dist'].map((c) => `Bash(${c})`),
  ]
  const passed = [
    ...['jira_search', 'jira_get_issue', 'jira_get_sprint_issues', 'jira_get_project_versions', 'jira_get_issue_watchers', 'jira_get_link_types',
      'confluence_search', 'confluence_get_page'].map(jira),
    ...['get_issue', 'list_pull_requests', 'get_issue_comments', 'search_code'].flatMap(gh),
    'Read(./.env.example)', 'Read(./.env.sample)', 'Read(src/env.ts)',
    ...['jira issue list', 'jira issue view X-1', 'gh pr view 1', 'glab mr view 1', 'git push origin x', 'git push -u origin feature-fix',
      'gh api repos/o/r/pulls', 'git reset --soft HEAD~1', 'rm file.txt', 'git branch -d x'].map((c) => `Bash(${c})`),
  ]
  for (const call of denied) assert.ok(hits(deny, call), `deny ${call}`)
  for (const call of asked) assert.ok(hits(ask, call) && !hits(deny, call), `ask ${call}`)
  for (const call of passed) assert.ok(!hits(ask, call) && !hits(deny, call), `pass ${call}`)
})

test('task-flow is model-invoked; its tracker writes stay behind ask rules', () => {
  assert.doesNotMatch(read(REPO, 'skills/task-flow/SKILL.md'), /^disable-model-invocation:/m)
})

test('doctor --tokens passes on a fresh host and fails over budget', async () => {
  const ok = await ac(compass, ['doctor', '--tokens', '--json', '--root', host])
  assert.equal(ok.code, 0, ok.stdout)
  const { tokens } = JSON.parse(ok.stdout)
  assert.ok(tokens.total > 0 && tokens.total <= 2000, `${tokens.total} tokens`)
  assert.ok(tokens.startChars > 0 && tokens.startChars <= 1000, `${tokens.startChars} chars`)
  assert.deepEqual(tokens.items.map((i) => i.name), ['AGENTS.md block', 'CLAUDE.md block', 'skill listing', 'agent listing', 'output style', 'SessionStart hook output'])

  const fat = makeCompass()
  mkdirSync(join(fat, 'skills/huge'), { recursive: true })
  writeFileSync(join(fat, 'skills/huge/SKILL.md'), `---\nname: huge\ndescription: ${'x'.repeat(5000)}\n---\nBody.\n`)
  writeFileSync(join(fat, 'core/files/.agents/hooks/compass.mjs'), `console.log('y'.repeat(1200))\n`)
  const fatHost = temp('ac-harness-fat-')
  assert.equal((await ac(fat, ['init', '--root', fatHost])).code, 0)
  const over = await ac(fat, ['doctor', '--tokens', '--root', fatHost])
  assert.equal(over.code, 1)
  assert.match(over.stdout, /fail {2}budget {3}the always-on context is about \d+ tokens; the budget is 2000/)
  assert.match(over.stdout, /fail {2}budget {3}the SessionStart output is 1201 characters; the budget is 1000/)
  assert.equal((await ac(fat, ['sync', '--tokens', '--root', fatHost])).code, 2)
})

test('doctor warns when a project edit keeps an owned key out', async () => {
  const edited = temp('ac-harness-edited-')
  mkdirSync(join(edited, '.claude'))
  writeFileSync(join(edited, '.claude/settings.json'), '{ "outputStyle": "mine" }\n')
  assert.equal((await ac(compass, ['init', '--root', edited])).code, 0)
  const r = await ac(compass, ['doctor', '--root', edited])
  assert.match(r.stdout, /warn {2}kept {5}\.claude\/settings\.json#outputStyle is edited in the project/)
})

// Run the deliver workflow script with stub agents, to check its control flow.
const src = read(REPO, 'core/files/.claude/workflows/deliver.js')
const AsyncFunction = (async () => {}).constructor
const deliver = async (args, reviewFindings, groups, firstResult = 'passed') => {
  const calls = []
  const phases = []
  const agent = async (prompt, opts) => {
    calls.push(opts)
    if (opts.label === 'plan') return { groups }
    if (opts.agentType === 'reviewer') return { findings: reviewFindings }
    if (opts.label === 'worker 1' && firstResult === null) return null
    if (opts.label === 'worker 1' && firstResult === 'none') return { changed: [], checks: [], open: [] }
    const result = opts.label === 'worker 1' ? firstResult : 'passed'
    return { changed: ['a.mjs'], checks: [{ command: 'npm test', result }], open: [] }
  }
  const parallel = (thunks) => Promise.all(thunks.map((t) => t()))
  const body = src.replace(/^export const meta =/m, 'const meta =')
  const result = await new AsyncFunction('agent', 'parallel', 'phase', 'log', 'args', body)(agent, parallel, (t) => phases.push(t), () => {}, args)
  return { result, calls, phases }
}
const GROUPS = [{ task: 'a', files: ['a.mjs'], checks: ['npm test'] }, { task: 'b', files: ['b.mjs'], checks: ['npm test'] }]

test('deliver stops after 2 fix rounds and pins the worker and reviewer models', async () => {
  const meta = new Function(`return ${src.slice(src.indexOf('{'), src.indexOf('\n}\n') + 2)}`)()
  assert.equal(meta.name, 'deliver')
  const { result, calls, phases } = await deliver('add a check', [{ file: 'a.mjs', line: 1, defect: 'bug', fix: 'fix it' }], GROUPS)
  assert.equal(calls.filter((c) => c.label.startsWith('fix')).length, 2)
  assert.equal(calls.filter((c) => c.agentType === 'reviewer').length, 3)
  assert.equal(result.status, 'partial')
  assert.equal(result.fixRounds, 2)
  for (const c of calls.filter((c) => c.agentType)) assert.equal(c.model, 'sonnet')
  for (const p of phases) assert.ok(meta.phases.some((m) => m.title === p), p)
})

test('deliver with a clean review makes no fix round, and it needs a goal', async () => {
  const overlap = [GROUPS[0], { task: 'c', files: ['a.mjs'], checks: ['npm test'] }]
  const { result, calls } = await deliver({ goal: 'add a check' }, [], overlap)
  assert.equal(result.status, 'review clean')
  assert.deepEqual(calls.map((c) => c.label), ['plan', 'worker 1', 'worker 2', 'review 1'])
  await assert.rejects(deliver(undefined, [], GROUPS), /give the goal as args/)
})

test('deliver fixes a failed worker check even when the review is clean', async () => {
  const { result, calls } = await deliver('add a check', [], GROUPS, 'failed')
  assert.deepEqual(calls.map((c) => c.label), ['plan', 'worker 1', 'worker 2', 'review 1', 'fix 1', 'review 2'])
  assert.equal(result.status, 'review clean')
  assert.equal(result.reports.length, 3)
})

test('deliver treats a lost worker or a worker with no checks as a finding, and scopes the review', async () => {
  for (const first of [null, 'none']) {
    const { result, calls } = await deliver('add a check', [], GROUPS, first)
    assert.equal(calls.filter((c) => c.label.startsWith('fix')).length, 1, String(first))
    assert.equal(result.status, 'review clean')
  }
  const prompts = []
  const body = src.replace(/^export const meta =/m, 'const meta =')
  const spy = async (prompt, opts) => { prompts.push(prompt); return opts.label === 'plan' ? { groups: GROUPS } : opts.agentType === 'reviewer' ? { findings: [] } : { changed: [], checks: [{ command: 'npm test', result: 'passed' }], open: [] } }
  await new AsyncFunction('agent', 'parallel', 'phase', 'log', 'args', body)(spy, (t) => Promise.all(t.map((f) => f())), () => {}, () => {}, 'g')
  assert.match(prompts.at(-1), /for correctness only: a\.mjs, b\.mjs\n.*untracked file that is in this list/)
})
