import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { diffLines, plan } from '../skills/review/scripts/post-review.mjs'
import { runNode } from './helpers.mjs'

const SCRIPT = join(dirname(dirname(fileURLToPath(import.meta.url))), 'skills/review/scripts/post-review.mjs')
const temps = []
test.after(() => { for (const d of temps) rmSync(d, { recursive: true, force: true }) })
const temp = () => { const d = realpathSync(mkdtempSync(join(tmpdir(), 'ac-post-review-'))); temps.push(d); return d }

const DIFF = 'diff --git a/src/a.ts b/src/a.ts\n--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1,3 +1,4 @@\n line1\n+added\n--- not a header\n line3\n'

// One fake for gh and glab: it logs each call (args and stdin) and answers from the arguments.
const FAKE = `import { appendFileSync, readFileSync } from 'node:fs'
const args = process.argv.slice(2)
const input = (() => { try { return readFileSync(0, 'utf8') } catch { return '' } })()
appendFileSync(process.env.FAKE_LOG, JSON.stringify({ tool: process.env.FAKE_TOOL, args, input }) + '\\n')
const a = args.join(' ')
const me = process.env.FAKE_ME || 'bob'
const out = (v) => process.stdout.write(typeof v === 'string' ? v : JSON.stringify(v))
const hunk = '@@ -1,3 +1,4 @@\\n line1\\n+added\\n line2\\n line3\\n'
if (process.env.FAKE_TOOL === 'gh') {
  if (a.startsWith('pr view')) out({ headRefOid: 'abcdef1234567890', author: { login: process.env.FAKE_AUTHOR || 'alice' } })
  else if (a === 'api user --jq .login') out(me + '\\n')
  else if (a.startsWith('pr diff')) out('diff --git a/src/a.ts b/src/a.ts\\n--- a/src/a.ts\\n+++ b/src/a.ts\\n' + hunk)
  else if (a.includes('/comments --paginate')) out(JSON.stringify({ path: 'src/a.ts', line: 1, body: 'Old thread.' }) + '\\n')
  else if (a.includes('/reviews --method POST')) out({ id: 7, html_url: 'https://github.com/o/r/pull/3#pullrequestreview-7' })
  else if (a.includes('/reviews/7/comments')) out(String(JSON.parse(readFileSync(process.env.FAKE_LOG, 'utf8').split('\\n').filter(Boolean).map(JSON.parse).find((l) => l.args.includes('POST')).input).comments.length))
  else if (a.startsWith('repo view')) out('{"name":"r"}')
  else process.exit(9)
} else {
  if (/^api projects\\/:id\\/merge_requests\\/\\d+$/.test(a)) out({ diff_refs: { base_sha: 'b1', start_sha: 's1', head_sha: 'h1' }, author: { username: process.env.FAKE_AUTHOR || 'alice' }, web_url: 'https://forge.example/g/p/-/merge_requests/5' })
  else if (a === 'api user') out({ username: me })
  else if (a === 'api projects/:id') out({ path_with_namespace: 'g/p' })
  else if (a.startsWith('api graphql')) out(process.env.FAKE_NO_PREMIUM ? { errors: [{ message: 'not available' }] } : { data: { mergeRequestRequestChanges: { errors: [] } } })
  else if (a.includes('/diffs?')) out(a.includes('page=1') ? [{ new_path: 'src/a.ts', old_path: 'src/a.ts', diff: hunk }] : [])
  else if (a.includes('/discussions?')) out([])
  else if (a.includes('/notes --method POST')) out({ id: 11 })
  else if (a.includes('/discussions --method POST')) out({ id: 'd1', notes: [{ id: 12, position: process.env.FAKE_DEGRADE ? null : { new_line: 2 } }] })
  else if (a.includes('/approvals')) out({ approved_by: [{ user: { username: me } }] })
  else if (a.startsWith('mr approve') || a.startsWith('mr revoke')) out('ok')
  else if (a.startsWith('repo view')) out('{}')
  else process.exit(9)
}
`

const setup = (review, remote = 'git@github.com:o/r.git') => {
  const dir = temp()
  spawnSync('git', ['init', '-q', dir])
  spawnSync('git', ['-C', dir, 'remote', 'add', 'origin', remote])
  writeFileSync(join(dir, 'fake.mjs'), FAKE)
  writeFileSync(join(dir, 'review.json'), JSON.stringify(review))
  const env = { ...process.env, AC_GH: join(dir, 'fake.mjs'), AC_GLAB: join(dir, 'fake.mjs'), FAKE_LOG: join(dir, 'log.jsonl') }
  const run = async (args = [], extra = {}) => {
    writeFileSync(env.FAKE_LOG, '')
    const both = (tool) => ({ ...env, ...extra, FAKE_TOOL: tool })
    // The fake tells gh from glab by FAKE_TOOL; the script calls one forge per run, so the env names the forge's tool.
    const tool = extra.FAKE_TOOL ?? (remote.includes('github') ? 'gh' : 'glab')
    const r = await runNode([SCRIPT, '--pr', '3', '--review', 'review.json', ...args], { cwd: dir, env: both(tool) })
    const log = readFileSync(env.FAKE_LOG, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    return { ...r, log }
  }
  return { dir, run }
}

const REVIEW = {
  summary: 'Verdict: changes requested. Two findings.',
  verdict: 'request_changes',
  comments: [
    { path: 'src/a.ts', line: 2, body: 'P1: the added line drops the error.' },
    { path: 'src/a.ts', line: 3, body: 'P3: context line.' },
    { path: 'src/other.ts', line: 40, body: 'P2: outside the diff.' },
    { path: 'src/a.ts', line: 1, body: 'Old thread.' },
  ],
}

test('diffLines maps the new lines of a hunk, and a removed "--- " line is not a header', () => {
  const m = diffLines(DIFF).get('src/a.ts')
  assert.deepEqual([...m], [[1, 1], [2, null], [3, 3]])
})

test('plan splits inline, outside and duplicate comments, and the author verdict becomes a comment', () => {
  const anchors = diffLines(DIFF)
  const p = plan(REVIEW, anchors, [{ path: 'src/a.ts', line: 1, body: 'Old thread.' }], { author: 'bob', me: 'bob' })
  assert.deepEqual([p.inline.length, p.outside.length, p.duplicate.length, p.verdict, p.own], [2, 1, 1, 'comment', true])
  assert.match(p.summary, /- `src\/other\.ts:40` — P2: outside the diff\./)
})

test('GitHub: --dry prints the recap and posts nothing', async () => {
  const { run } = setup(REVIEW)
  const r = await run(['--dry'])
  assert.equal(r.code, 0, r.stderr)
  assert.match(r.stdout, /^Recap \(nothing posted\): github #3 at abcdef12, verdict request_changes/)
  assert.match(r.stdout, /Inline: 2 comments, 1 duplicates skipped/)
  assert.ok(!r.log.some((l) => l.args.includes('POST')))
})

test('GitHub: one review holds the summary, the anchored comments and the verdict', async () => {
  const { run } = setup(REVIEW)
  const r = await run()
  assert.equal(r.code, 0, r.stderr)
  const body = JSON.parse(r.log.find((l) => l.args.includes('POST')).input)
  assert.equal(body.commit_id, 'abcdef1234567890')
  assert.equal(body.event, 'REQUEST_CHANGES')
  assert.deepEqual(body.comments.map((c) => [c.path, c.line, c.side]), [['src/a.ts', 2, 'RIGHT'], ['src/a.ts', 3, 'RIGHT']])
  assert.match(body.body, /src\/other\.ts:40/)
  assert.match(r.stdout, /URL: https:\/\/github\.com\/o\/r\/pull\/3#pullrequestreview-7/)
})

test('GitHub: on your own PR the verdict is a comment', async () => {
  const { run } = setup(REVIEW)
  const r = await run([], { FAKE_AUTHOR: 'bob' })
  assert.equal(JSON.parse(r.log.find((l) => l.args.includes('POST')).input).event, 'COMMENT')
  assert.match(r.stdout, /you are the author/)
})

test('GitLab: the summary note first, then the anchored discussions, then the verdict', async () => {
  const { run } = setup({ ...REVIEW, verdict: 'approve' }, 'git@gitlab.example.com:g/p.git')
  const r = await run()
  assert.equal(r.code, 0, r.stderr)
  const posts = r.log.filter((l) => l.args.includes('POST') || l.args[0] === 'mr').map((l) => l.args[0] === 'mr' ? `mr ${l.args[1]}` : l.args[1].split('/').pop())
  assert.deepEqual(posts, ['notes', 'discussions', 'discussions', 'discussions', 'mr approve'])
  assert.ok(r.log.some((l) => l.args.join(' ') === 'mr approve 3 --sha h1'), 'the approval is for the reviewed head')
  const positions = r.log.filter((l) => l.args[1]?.endsWith('/discussions') && l.args.includes('POST')).map((l) => JSON.parse(l.input).position)
  assert.deepEqual(positions[0], { position_type: 'text', base_sha: 'b1', start_sha: 's1', head_sha: 'h1', old_path: 'src/a.ts', new_path: 'src/a.ts', new_line: 2 })
  assert.equal(positions[1].old_line, 2, 'a context line carries its old line too (new 3 is old 2 below an added line)')
  assert.ok(r.log.filter((l) => l.args.includes('POST')).every((l) => l.args.includes('Content-Type: application/json')))
})

test('GitLab: request changes revokes an earlier approval, and a comment that lost its anchor fails the run', async () => {
  const { run } = setup(REVIEW, 'https://gitlab.com/g/p.git')
  const r = await run()
  assert.ok(r.log.some((l) => l.args.join(' ') === 'mr revoke 3'))
  assert.match(r.log.find((l) => l.args[1] === 'graphql').args[3], /mergeRequestRequestChanges\(input: \{ projectPath: "g\/p", iid: "3" \}\)/)
  const free = await run([], { FAKE_NO_PREMIUM: '1' })
  assert.equal(free.code, 0, 'a GitLab without the feature still posts the review')
  assert.match(free.stdout, /Note: GitLab did not record "request changes" \(not available\); the summary states it/)
  const lost = await run([], { FAKE_DEGRADE: '1' })
  assert.equal(lost.code, 1)
  assert.match(lost.stdout, /Not anchored: src\/a\.ts:2, src\/a\.ts:3/)
})

test('a self-hosted GitLab host is found with glab, and a bad review file is refused', async () => {
  const { run } = setup({ ...REVIEW, verdict: 'comment' }, 'git@forge.example.org:g/p.git')
  const r = await run(['--dry'])
  assert.equal(r.code, 0, r.stderr)
  assert.match(r.stdout, /gitlab #3/)
  for (const bad of [{ ...REVIEW, verdict: 'lgtm' }, { ...REVIEW, summary: '' }, { ...REVIEW, summary: 'Generated with a tool' }]) {
    const { run: again } = setup(bad)
    assert.equal((await again(['--dry'])).code, 1, JSON.stringify(bad).slice(0, 50))
  }
})
