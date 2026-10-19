import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { findIssues } from '../scripts/lib/redact.mjs'
import { runNode } from './helpers.mjs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const BIN = join(REPO, 'bin/ac.mjs')
const temps = []
test.after(() => { for (const dir of temps) rmSync(dir, { recursive: true, force: true }) })
const temp = (prefix) => {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), prefix)))
  temps.push(dir)
  return dir
}

const TOKEN = `ghp_${'a'.repeat(36)}`
// Local noon, so the local day is the same in every time zone.
const at = (day, minute = 0) => new Date(2026, 9, day, 12, minute).toISOString()
const use = (id, name, input) => ({ type: 'tool_use', id, name, input })
const result = (id, text, error = false) => ({ type: 'tool_result', tool_use_id: id, content: text, is_error: error })
const line = (session, cwd, day, minute, over) => JSON.stringify({ sessionId: session, cwd, timestamp: at(day, minute), ...over })
const assistant = (s, cwd, day, m, content) => line(s, cwd, day, m, { type: 'assistant', message: { content } })
const user = (s, cwd, day, m, content) => line(s, cwd, day, m, { type: 'user', message: { content } })

// A git project with a lock, a Konvoy ledger and sessions in a fake home.
const fixture = () => {
  const root = temp('ac-reflect-root-')
  spawnSync('git', ['init', '-q', root])
  const files = {
    '.agents/compass.lock.json': JSON.stringify({
      lockVersion: 2, version: '1.0.0', skills: ['review'], files: { '.agents/hooks/compass.mjs': { sha: 'x', owner: 'compass' }, 'renovate.json': { sha: 'y', owner: 'project' } },
      keys: { '.claude/settings.json': { outputStyle: 'z' } }, blocks: { 'AGENTS.md': 'w' },
    }),
    '.agents/konvoy.json': JSON.stringify({ owns: { skills: ['kv'] } }),
    '.claude/skills/review/SKILL.md': '---\nname: review\n---\n',
    '.claude/skills/mine/SKILL.md': '---\nname: mine\n---\n',
    '.claude/skills/kv/SKILL.md': '---\nname: kv\n---\n',
    '.claude/agents/helper.md': '---\nname: helper\n---\n',
    '.agents/lessons/2026-10-11-retry-tests.md': '# Lesson\n',
  }
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), text)
  }
  const home = temp('ac-reflect-home-')
  const put = (rel, lines) => {
    mkdirSync(dirname(join(home, '.claude/projects', rel)), { recursive: true })
    writeFileSync(join(home, '.claude/projects', rel), `${lines.join('\n')}\n`)
  }
  const wt = `${root}/.claude/worktrees/w1`
  put('-root/bad.jsonl', [
    user('bad', root, 10, 0, 'please fix the tests, mail bob@corp.io'),
    assistant('bad', root, 10, 1, [use('t1', 'Bash', { command: 'npm test' })]),
    user('bad', root, 10, 2, [result('t1', 'FAIL 3 tests', true)]),
    assistant('bad', root, 10, 3, [use('t2', 'Bash', { command: 'npm test' })]),
    user('bad', root, 10, 4, [result('t2', 'FAIL 3 tests', true)]),
    assistant('bad', root, 10, 5, [use('t3', 'Read', { file_path: `${root}/.env` })]),
    user('bad', root, 10, 6, [result('t3', 'compass: the read of .env is blocked', true)]),
    assistant('bad', root, 10, 7, [use('t4', 'Bash', { command: 'cat .env.local' })]),
    user('bad', root, 10, 8, [result('t4', 'PLAIN_VALUE=abc123xyz')]),
    assistant('bad', root, 10, 9, [use('t5', 'Bash', { command: 'git log -1' })]),
    user('bad', root, 10, 10, [result('t5', `author alice@corp.io pushed ${TOKEN}`)]),
    user('bad', root, 10, 10, [result('t5', 'the same result twice counts once', true)]),
  ])
  put('-root/clean.jsonl', [
    assistant('clean', root, 11, 0, [use('c1', 'Read', { file_path: 'README.md' })]),
    user('clean', root, 11, 1, [result('c1', 'hello')]),
  ])
  put('-root/mild.jsonl', [
    assistant('mild', root, 12, 0, [use('m1', 'Grep', { pattern: 'x' })]),
    user('mild', root, 12, 1, [result('m1', 'grep failed', true)]),
  ])
  put('-root-wt/stop.jsonl', [
    assistant('stop', wt, 13, 0, [use('w1', 'Edit', { file_path: 'a.js' })]),
    user('stop', wt, 13, 1, [result('w1', 'ok')]),
    line('stop', wt, 13, 2, { type: 'system', subtype: 'stop_hook_summary', preventedContinuation: true, uuid: 'u1' }),
  ])
  put('-y-other/other.jsonl', [
    assistant('other', '/y/other', 10, 0, [use('o1', 'Bash', { command: 'make' })]),
    user('other', '/y/other', 10, 1, [result('o1', 'boom', true)]),
  ])
  return { root, env: { ...process.env, HOME: home, USERPROFILE: home } }
}

const reflectRun = (root, env, ...args) => runNode([BIN, 'reflect', '--root', root, '--since', '2026-10-01', ...args], { env })

test('ac reflect ranks the sessions of this project and prints the ranked list', async () => {
  const { root, env } = fixture()
  const text = await reflectRun(root, env)
  assert.equal(text.code, 0, text.stderr)
  assert.match(text.stdout, /4 sessions since 2026-10-01; 3 with trouble signals/)
  assert.match(text.stdout, /Ranked sessions\n {3}1\. bad .* score 4 {2}blocked 1 {2}failed 2 {2}repeated 1/)
  assert.match(text.stdout, /Output: \.agents\/reflect\/.+\/report\.md/)

  const json = JSON.parse((await reflectRun(root, env, '--json', '--dry')).stdout)
  assert.deepEqual(json.ranked.map((s) => [s.id, s.score]), [['bad', 4], ['stop', 1], ['mild', 1]])
  assert.equal(json.sessions, 4, 'the session of /y/other is not read')
  assert.equal(json.output, null)
})

test('ac reflect lists each setup piece with its owner', async () => {
  const { root, env } = fixture()
  const { pieces } = JSON.parse((await reflectRun(root, env, '--json', '--dry')).stdout)
  const owner = Object.fromEntries(pieces.map((p) => [p.path, `${p.owner} ${p.kind}`]))
  assert.equal(owner['.claude/skills/review/'], 'compass skill')
  assert.equal(owner['.claude/skills/kv/'], 'konvoy skill')
  assert.equal(owner['.claude/skills/mine/'], 'project skill')
  assert.equal(owner['.claude/agents/helper.md'], 'project agent')
  assert.equal(owner['.agents/hooks/compass.mjs'], 'compass hook')
  assert.equal(owner['renovate.json'], 'project file')
  assert.equal(owner['AGENTS.md'], 'shared block')
  assert.equal(owner['.claude/settings.json'], 'shared keys')
})

test('ac reflect shows the signals around each lesson; one session is unclear', async () => {
  const { root, env } = fixture()
  const { lessons } = JSON.parse((await reflectRun(root, env, '--json', '--dry')).stdout)
  assert.deepEqual(lessons, [{
    file: '.agents/lessons/2026-10-11-retry-tests.md', day: '2026-10-11',
    before: { sessions: 1, median: 4 }, after: { sessions: 2, median: 1 }, trend: 'unclear',
  }])
})

test('ac reflect writes redacted trajectories below a git-ignored folder', async () => {
  const { root, env } = fixture()
  assert.equal((await reflectRun(root, env)).code, 0)
  assert.equal(readFileSync(join(root, '.agents/reflect/.gitignore'), 'utf8'), '*\n')
  const [run] = readdirSync(join(root, '.agents/reflect')).filter((n) => n !== '.gitignore')
  const out = join(root, '.agents/reflect', run)
  const files = ['report.md', ...readdirSync(join(out, 'trajectories')).map((f) => `trajectories/${f}`)]
  assert.equal(files.length, 4)
  for (const f of files) {
    const ignored = spawnSync('git', ['-C', root, 'check-ignore', '-q', `.agents/reflect/${run}/${f}`])
    assert.equal(ignored.status, 0, `${f} is not git-ignored`)
    const text = readFileSync(join(out, f), 'utf8')
    assert.deepEqual(findIssues(text), [], `${f} holds a secret or an e-mail address`)
    for (const leak of ['ghp_', 'alice@corp.io', 'bob@corp.io', 'abc123xyz']) assert.ok(!text.includes(leak), `${f} holds ${leak}`)
  }
  const bad = readFileSync(join(out, files.find((f) => f.endsWith('-bad.md'))), 'utf8')
  for (const tag of ['[USER]', '[ACTION] Bash: npm test', '[ERROR] FAIL 3 tests', '[ACTION] Read: ', '[BLOCKED] [redacted: env file]', '[OBSERVATION] [redacted: env file]', '[OBSERVATION] [redacted]']) {
    assert.ok(bad.includes(tag), `the trajectory has no "${tag}"`)
  }
  assert.ok(bad.includes('[USER] please fix the tests, mail [email]'))
  assert.equal((bad.match(/\[ERROR\]/g) ?? []).length, 2, 'a repeated tool_result id counts once')
})

test('ac reflect --dry writes nothing, and a symlinked output folder is refused', async () => {
  const { root, env } = fixture()
  assert.equal((await reflectRun(root, env, '--dry')).code, 0)
  assert.ok(!existsSync(join(root, '.agents/reflect')))
  symlinkSync(temp('ac-reflect-elsewhere-'), join(root, '.agents/reflect'))
  const refused = await reflectRun(root, env)
  assert.equal(refused.code, 1)
  assert.match(refused.stderr, /symlink or leaves the project root/)
})

test('ac reflect rejects bad options', async () => {
  const { root, env } = fixture()
  for (const args of [['--since', '10/01/2026'], ['--sessions', '0'], ['extra']]) {
    assert.equal((await runNode([BIN, 'reflect', '--root', root, ...args], { env })).code, 2, args.join(' '))
  }
})

const lessonRun = async (root, env, data) => {
  writeFileSync(join(root, 'lesson.json'), JSON.stringify(data))
  return runNode([BIN, 'reflect', 'lesson', '--from', join(root, 'lesson.json'), '--root', root, '--json'], { env })
}
const LESSON = { slug: 'retry-tests', situation: 'A test command fails the same way twice.', lesson: 'Add a test-run skill that reads the first failure.', evidence: 'Session bad: npm test failed twice.', confidence: 'low' }
const lessonFiles = (root) => readdirSync(join(root, '.agents/lessons')).filter((n) => n !== '2026-10-11-retry-tests.md')

test('ac reflect owner refuses a compass-owned and a Konvoy-owned path', async () => {
  const { root, env } = fixture()
  const ok = await runNode([BIN, 'reflect', 'owner', '.claude/skills/mine/SKILL.md', 'AGENTS.md', '--root', root], { env })
  assert.equal(ok.code, 0, ok.stdout)
  assert.match(ok.stdout, /^project {2}\.claude\/skills\/mine\/SKILL\.md\nshared {3}AGENTS\.md\n$/)
  for (const path of ['.claude/skills/review/SKILL.md', '.agents/hooks/compass.mjs', '.agents/compass.lock.json', '.claude/skills/kv/SKILL.md', '../outside.md']) {
    const refused = await runNode([BIN, 'reflect', 'owner', path, '--root', root], { env })
    assert.equal(refused.code, 1, path)
    assert.match(refused.stdout, /refused: do not edit/, path)
  }
})

test('ac reflect lesson refuses an edit of a compass-owned path and writes nothing', async () => {
  const { root, env } = fixture()
  const refused = await lessonRun(root, env, { ...LESSON, edits: [{ path: '.claude/skills/review/SKILL.md', change: 'c', observed: 'o', sessions: 3, verdict: 'helped' }] })
  assert.equal(refused.code, 1)
  assert.match(JSON.parse(refused.stdout).errors[0], /compass owns \.claude\/skills\/review\/SKILL\.md; edit project paths only/)
  assert.deepEqual(lessonFiles(root), [])
})

test('ac reflect lesson records a one-session result as unclear', async () => {
  const { root, env } = fixture()
  const res = await lessonRun(root, env, { ...LESSON, edits: [
    { path: '.claude/skills/mine/SKILL.md', change: 'add the trigger', observed: 'one session passed', sessions: 1, verdict: 'helped' },
    { path: 'AGENTS.md', change: 'one rule', observed: 'one session failed', sessions: 1, verdict: 'hurt' },
    { path: '.claude/agents/helper.md', change: 'shorter', observed: 'three sessions passed', sessions: 3, verdict: 'helped' },
  ] })
  assert.equal(res.code, 0, res.stdout)
  assert.deepEqual(JSON.parse(res.stdout).edits.map((e) => e.verdict), ['unclear', 'unclear', 'helped'])
  const [file] = lessonFiles(root)
  const text = readFileSync(join(root, '.agents/lessons', file), 'utf8')
  assert.match(file, /^\d{4}-\d{2}-\d{2}-retry-tests\.md$/)
  assert.match(text, /\| `\.claude\/skills\/mine\/SKILL\.md` \| add the trigger \| one session passed \| 1 \| unclear \|/)
  assert.match(text, /\| `AGENTS\.md` \| one rule \| one session failed \| 1 \| unclear \|/)
  for (const f of ['situation', 'lesson', 'evidence', 'confidence']) assert.match(text, new RegExp(`^- ${f}: `, 'm'))
  const ignored = spawnSync('git', ['-C', root, 'check-ignore', '-q', `.agents/lessons/${file}`])
  assert.equal(ignored.status, 1, 'a lesson file is committed by the user, so git does not ignore it')
  const again = await lessonRun(root, env, { ...LESSON, edits: [] })
  assert.equal(again.code, 1, 'an existing lesson file is not overwritten')
})

test('ac reflect lesson accepts no change, and refuses a secret or a bad field', async () => {
  const { root, env } = fixture()
  const none = await lessonRun(root, env, { ...LESSON, edits: [] })
  assert.equal(none.code, 0, none.stdout)
  assert.match(readFileSync(join(root, '.agents/lessons', lessonFiles(root)[0]), 'utf8'), /- outcome: no change[\s\S]*No change\. The evidence did not support an edit\./)
  for (const bad of [{ evidence: `token ${TOKEN}` }, { situation: 'mail alice@corp.io' }, { confidence: 'sure' }, { slug: 'Bad Slug' }, { lesson: '' }]) {
    const res = await lessonRun(root, env, { ...LESSON, slug: 'other', edits: [], ...bad })
    assert.equal(res.code, 1, JSON.stringify(bad))
  }
  assert.equal(lessonFiles(root).length, 1)
  assert.equal((await runNode([BIN, 'reflect', 'lesson', '--root', root], { env })).code, 2)
})
