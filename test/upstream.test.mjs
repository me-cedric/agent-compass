import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { runNode } from './helpers.mjs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const temps = []
test.after(() => { for (const d of temps) rmSync(d, { recursive: true, force: true }) })
const temp = (prefix) => { const d = mkdtempSync(join(tmpdir(), prefix)); temps.push(d); return d }
const put = (root, files) => {
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), text)
  }
}
const git = (cwd, ...args) => spawnSync('git', args, { cwd, encoding: 'utf8', timeout: 10_000 }).stdout.trim()

// A fake upstream repo: one skill found by name (with a mirror in a dot dir), one given by path, and a root licence file.
const upstreamRepo = ({ licence = true } = {}) => {
  const repo = temp('ac-up-repo-')
  git(repo, 'init', '-q')
  put(repo, {
    'skills/foo/SKILL.md': '---\nname: foo\ndescription: Foo.\n---\nFoo {{NOT_A_PATH}}.\n',
    'skills/foo/ref/notes.md': 'Notes.\n',
    'skills/foo/.hidden': 'x\n',
    '.claude/skills/foo/SKILL.md': 'Mirror.\n',
    'more/bar/SKILL.md': '---\nname: bar\ndescription: Bar.\n---\nBar.\n',
    ...(licence && { 'LICENSE-MIT': 'MIT text.\n', 'LICENSE-APACHE': 'Apache text.\n' }),
  })
  git(repo, 'add', '-A')
  git(repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init')
  return { repo, sha: git(repo, 'rev-parse', 'HEAD') }
}

const makeCompass = (sources) => {
  const ac = temp('ac-up-compass-')
  for (const d of ['bin', 'engine']) cpSync(join(REPO, d), join(ac, d), { recursive: true })
  put(ac, { 'package.json': '{ "version": "1.0.0-test" }\n', 'upstream.json': JSON.stringify({ sources }) })
  return ac
}

const run = async (compass, host, cache, ...args) => {
  const r = await runNode([join(compass, 'bin/ac.mjs'), ...args, '--root', host, '--json'], { env: { ...process.env, AC_CACHE: cache } })
  return { ...r, json: r.stdout ? JSON.parse(r.stdout) : null }
}

const { repo, sha } = upstreamRepo()
const compass = makeCompass({ fake: { repo, sha, licence: 'MIT', skills: ['foo', 'more/bar'] } })
const host = temp('ac-up-host-')
put(host, { '.agents/compass.json': JSON.stringify({ version: 1, upstream: ['fake'] }) })
const read = (rel) => readFileSync(join(host, rel), 'utf8')

test('check does not fetch; sync fetches the pinned sha into the cache and installs the listed skills', async () => {
  const cache = temp('ac-up-cache-')
  const check = await run(compass, host, cache, 'check')
  assert.equal(check.code, 0, check.stderr)
  assert.match(check.json.warnings.join('\n'), /upstream fake is not in the cache/)
  assert.ok(!existsSync(join(cache, 'fake')), 'check writes no cache')

  const sync = await run(compass, host, cache, 'sync')
  assert.equal(sync.code, 0, sync.stderr)
  assert.deepEqual(sync.json.warnings, [])
  assert.ok(existsSync(join(cache, 'fake', sha, 'skills/foo/SKILL.md')))
  assert.ok(!existsSync(join(cache, 'fake', sha, '.git')))
  for (const base of ['.claude/skills', '.agents/skills']) {
    assert.equal(read(`${base}/foo/SKILL.md`), '---\nname: foo\ndescription: Foo.\n---\nFoo {{NOT_A_PATH}}.\n', 'upstream text is not filled')
    assert.equal(read(`${base}/foo/ref/notes.md`), 'Notes.\n')
    assert.equal(read(`${base}/foo/LICENSE-MIT`), 'MIT text.\n')
    assert.equal(read(`${base}/bar/LICENSE-MIT`), 'MIT text.\n')
    assert.equal(read(`${base}/bar/LICENSE-APACHE`), 'Apache text.\n')
    assert.ok(!existsSync(join(host, base, 'foo/.hidden')))
  }
  assert.deepEqual(JSON.parse(read('.agents/compass.lock.json')).skills, ['bar', 'foo'])
  const again = await run(compass, host, cache, 'sync')
  assert.deepEqual(again.json.changes, [])
})

test('offline with an empty cache warns, exits 0 and keeps the installed upstream files', async () => {
  const offline = makeCompass({ fake: { repo: join(repo, 'gone'), sha, licence: 'MIT', skills: ['foo', 'more/bar'] } })
  const lock = read('.agents/compass.lock.json')
  const r = await run(offline, host, temp('ac-up-cache-'), 'sync')
  assert.equal(r.code, 0, r.stderr)
  assert.match(r.json.warnings.join('\n'), /upstream fake: the fetch failed .*the installed copy stays as it is/)
  assert.match(r.json.warnings.join('\n'), /upstream fake is not in the cache/)
  assert.deepEqual(r.json.changes, [])
  assert.equal(read('.claude/skills/foo/SKILL.md').includes('Foo'), true)
  assert.equal(read('.agents/compass.lock.json'), lock)
})

test('an unknown source id, a bad pin or a missing skill is an error', async () => {
  const cache = temp('ac-up-cache-')
  const other = temp('ac-up-host-')
  put(other, { '.agents/compass.json': JSON.stringify({ version: 1, upstream: ['nope'] }) })
  assert.match((await run(compass, other, cache, 'check')).json.errors.join('\n'), /unknown upstream source "nope"/)
  const bad = makeCompass({ fake: { repo, sha: 'main', licence: 'MIT', skills: ['foo'] } })
  assert.match((await run(bad, host, cache, 'check')).json.errors.join('\n'), /source "fake" needs a repo .* a 40-character sha/)
  const missing = makeCompass({ fake: { repo, sha, licence: 'MIT', skills: ['baz'] } })
  const r = await run(missing, host, cache, 'sync')
  assert.equal(r.code, 1)
  assert.match(r.json.errors.join('\n'), /upstream fake: skill "baz" has no SKILL\.md/)
  const bare = upstreamRepo({ licence: false })
  const unlicensed = makeCompass({ fake: { repo: bare.repo, sha: bare.sha, licence: 'MIT', skills: ['foo'] } })
  assert.match((await run(unlicensed, host, cache, 'sync')).json.errors.join('\n'), /upstream fake has no licence file at its root/)
})

test('a fetched source with hidden Unicode is a warning with the file path and stays out of the cache; a leading BOM and zero-width spaces are fine', async () => {
  const hidden = temp('ac-up-repo-')
  git(hidden, 'init', '-q')
  put(hidden, {
    'LICENSE': 'MIT text.\n',
    'skills/foo/SKILL.md': '﻿---\nname: foo\ndescription: Foo 👨‍👩‍👧 ن‌م.\n---\nFoo.\n',
    'skills/foo/ref/trap.md': 'Run the tests‮ and push.\n',
    'skills/foo/ref/web.md': 'Copied\u200b\u200b web text.\n',
    'skills/foo/ref/tag.md': `Tag ${String.fromCodePoint(0xE0041)} text.\n`,
  })
  git(hidden, 'add', '-A')
  git(hidden, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'init')
  const evil = makeCompass({ fake: { repo: hidden, sha: git(hidden, 'rev-parse', 'HEAD'), licence: 'MIT', skills: ['foo'] } })
  const other = temp('ac-up-host-')
  put(other, { '.agents/compass.json': JSON.stringify({ version: 1, upstream: ['fake'] }) })
  const cache = temp('ac-up-cache-')
  const r = await run(evil, other, cache, 'sync')
  assert.equal(r.code, 0, 'one bad source does not stop the sync')
  assert.deepEqual(r.json.errors, [])
  assert.ok(r.json.warnings.includes('upstream fake: skills/foo/ref/tag.md, skills/foo/ref/trap.md hold hidden Unicode characters (bidi or tag); compass does not install the source'), r.json.warnings.join('\n'))
  assert.equal(existsSync(join(cache, 'fake')) && readdirSync(join(cache, 'fake')).length > 0, false)
  assert.equal(existsSync(join(other, '.claude/skills/foo')), false)
})
