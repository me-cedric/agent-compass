import assert from 'node:assert/strict'
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { candidates, promote, promoteLesson } from '../engine/promote.mjs'
import { runNode } from './helpers.mjs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const temps = []
test.after(() => { for (const dir of temps) rmSync(dir, { recursive: true, force: true }) })
const temp = (prefix) => {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  temps.push(dir)
  return dir
}
const put = (root, files) => {
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, rel)), { recursive: true })
    writeFileSync(join(root, rel), text)
  }
}

const skill = (name, body = 'Do the work.\n', head = 'risk_level: low\nrequires_tools: [git]\n') => `---\nname: ${name}\ndescription: Does the job.\n${head}---\n${body}`

// A compass checkout with `skills/` and a host project named "acme".
const setup = () => {
  const ac = temp('ac-promote-ac-')
  put(ac, { 'package.json': '{ "version": "1.0.0-test" }\n', 'skills/taken/SKILL.md': skill('taken') })
  const root = join(temp('ac-promote-host-'), 'Acme')
  put(root, {
    '.agents/compass.lock.json': JSON.stringify({ lockVersion: 2, skills: ['locked'], files: {}, keys: {}, blocks: {} }),
    '.agents/konvoy.json': JSON.stringify({ compass_skills: ['kv-owned'] }),
    '.claude/skills/acme-deploy/SKILL.md': skill('acme-deploy'),
    '.claude/skills/acme-deploy/references/guide.md': 'A guide.\n',
    '.claude/skills/acme-deploy/scripts/run.sh': '#!/bin/sh\necho ok\n',
    '.claude/skills/plain/SKILL.md': skill('plain'),
    '.claude/skills/lite/SKILL.md': '---\nname: lite\ndescription: Lite.\n---\nBody.\n',
    '.claude/skills/taken/SKILL.md': skill('taken'),
    '.claude/skills/locked/SKILL.md': skill('locked'),
    '.claude/skills/kv-owned/SKILL.md': skill('kv-owned'),
    '.claude/skills/leaky/SKILL.md': skill('leaky', 'Set api_key = abcdef123456 first.\n'),
    '.claude/skills/named/SKILL.md': skill('named', 'Deploy the ACME portal.\n'),
    '.claude/skills/pathy/SKILL.md': skill('pathy', 'Read /Users/bob/notes.md.\n'),
    '.claude/skills/winpath/SKILL.md': skill('winpath', 'Read C:\\Work\\notes.md.\n'),
    '.claude/skills/notaskill/readme.md': 'No SKILL.md here.\n',
  })
  chmodSync(join(root, '.claude/skills/acme-deploy/scripts/run.sh'), 0o755)
  return { ac, root }
}

test('candidates lists the project skills that neither the lock nor Konvoy owns', () => {
  const { ac, root } = setup()
  const names = candidates({ AC: ac, root }).map((c) => c.name)
  assert.deepEqual(names, ['acme-deploy', 'leaky', 'lite', 'named', 'pathy', 'plain', 'taken', 'winpath'])
  assert.deepEqual(candidates({ AC: ac, root }).find((c) => c.name === 'acme-deploy'), { name: 'acme-deploy', target: 'deploy' })
  assert.equal(candidates({ AC: ac, root }).find((c) => c.name === 'plain').target, 'plain')
  assert.deepEqual(candidates({ AC: ac, root: temp('ac-promote-none-') }), [])
})

test('promote --dry checks the skill and writes nothing', () => {
  const { ac, root } = setup()
  const r = promote({ AC: ac, root, skill: 'acme-deploy', dry: true })
  assert.deepEqual([r.ok, r.errors, r.warnings], [true, [], []])
  assert.equal(r.from, join(root, '.claude/skills/acme-deploy'))
  assert.equal(r.to, join(ac, 'skills/deploy'))
  assert.deepEqual(r.files, ['SKILL.md', 'references/guide.md', 'scripts/run.sh'])
  assert.ok(!existsSync(join(ac, 'skills/deploy')))
})

test('promote copies the dir, renames the skill and keeps the project copy', () => {
  const { ac, root } = setup()
  const before = readFileSync(join(root, '.claude/skills/acme-deploy/SKILL.md'), 'utf8')
  const r = promote({ AC: ac, root, skill: 'acme-deploy' })
  assert.deepEqual([r.ok, r.errors], [true, []])
  assert.match(readFileSync(join(ac, 'skills/deploy/SKILL.md'), 'utf8'), /^---\nname: deploy\ndescription: Does the job\.\nrisk_level: low/)
  assert.equal(readFileSync(join(ac, 'skills/deploy/references/guide.md'), 'utf8'), 'A guide.\n')
  if (process.platform !== 'win32') assert.equal(statSync(join(ac, 'skills/deploy/scripts/run.sh')).mode & 0o111, 0o111)
  assert.equal(readFileSync(join(root, '.claude/skills/acme-deploy/SKILL.md'), 'utf8'), before)
  assert.equal(promote({ AC: ac, root, skill: 'acme-deploy' }).ok, false, 'a second run finds the target')
})

test('promote refuses a skill with a secret, the project name, an absolute path or an existing target', () => {
  const { ac, root } = setup()
  const errors = (name) => promote({ AC: ac, root, skill: name, dry: true })
  assert.match(errors('leaky').errors.join('\n'), /leaky\/SKILL\.md:7: .*secret/)
  assert.ok(!errors('leaky').errors.join('\n').includes('abcdef123456'), 'the error never repeats the secret')
  assert.match(errors('named').errors.join('\n'), /named\/SKILL\.md: .*project name "acme"/)
  assert.match(errors('pathy').errors.join('\n'), /\/SKILL\.md: .*absolute path/)
  assert.match(errors('winpath').errors.join('\n'), /\/SKILL\.md: .*absolute path/)
  assert.match(errors('taken').errors.join('\n'), /skills\/taken already exists/)
  for (const name of ['leaky', 'named', 'pathy', 'winpath', 'taken']) assert.equal(errors(name).ok, false, name)
  assert.ok(!existsSync(join(ac, 'skills/leaky')))
  assert.equal(promote({ AC: ac, root, skill: 'leaky' }).ok, false)
  assert.ok(!existsSync(join(ac, 'skills/leaky')), 'an error writes nothing')
})

test('promote warns when risk_level or requires_tools is missing', () => {
  const { ac, root } = setup()
  const r = promote({ AC: ac, root, skill: 'lite', dry: true })
  assert.equal(r.ok, true)
  assert.match(r.warnings.join('\n'), /risk_level/)
  assert.match(r.warnings.join('\n'), /requires_tools/)
})

test('promote refuses a skill that is not a candidate, and a path', () => {
  const { ac, root } = setup()
  for (const name of ['locked', 'kv-owned', 'notaskill', 'missing', '../x', '', 'a/b']) {
    const r = promote({ AC: ac, root, skill: name, dry: true })
    assert.equal(r.ok, false, name)
    assert.match(r.errors[0], /not a project skill that compass can promote/, name)
  }
})

test('ac promote lists candidates, checks with --dry and copies', async () => {
  const { root } = setup()
  const ac = temp('ac-promote-cli-')
  for (const dir of ['bin', 'engine', 'scripts/lib']) cpSync(join(REPO, dir), join(ac, dir), { recursive: true })
  put(ac, { 'package.json': '{ "version": "1.0.0-test" }\n', 'skills/taken/SKILL.md': skill('taken') })
  const ac1 = (...args) => runNode([join(ac, 'bin/ac.mjs'), 'promote', ...args, '--root', root])
  const list = await ac1()
  assert.equal(list.code, 0, list.stderr)
  assert.match(list.stdout, /acme-deploy\s+→\s+deploy/)
  assert.deepEqual(JSON.parse((await ac1('--json')).stdout).candidates.map((c) => c.name).slice(0, 2), ['acme-deploy', 'leaky'])
  const dry = JSON.parse((await ac1('acme-deploy', '--dry', '--json')).stdout)
  assert.deepEqual([dry.ok, dry.files.length, existsSync(join(ac, 'skills/deploy'))], [true, 3, false])
  const done = await ac1('acme-deploy')
  assert.equal(done.code, 0, done.stderr)
  assert.ok(existsSync(join(ac, 'skills/deploy/SKILL.md')))
  const bad = await ac1('leaky')
  assert.equal(bad.code, 1)
  assert.match(bad.stderr, /error: .*secret/)
  assert.equal((await runNode([join(ac, 'bin/ac.mjs'), 'promote', '--bogus', '--root', root])).code, 2)
  assert.match((await runNode([join(ac, 'bin/ac.mjs'), 'promote', '--help'])).stdout, /--dry/)
})

test('a symlink in a skill dir is an error, not a crash', async () => {
  const { symlinkSync } = await import('node:fs')
  const { ac, root } = setup()
  const outside = temp('ac-promote-outside-')
  put(outside, { 'SKILL.md': skill('linked'), 'notes.md': 'Notes.\n' })
  mkdirSync(join(root, '.claude/skills/linked'), { recursive: true })
  symlinkSync(join(outside, 'SKILL.md'), join(root, '.claude/skills/linked/SKILL.md'))
  put(root, { '.claude/skills/partial/SKILL.md': skill('partial') })
  symlinkSync(join(outside, 'notes.md'), join(root, '.claude/skills/partial/notes.md'))
  assert.ok(!candidates({ AC: ac, root }).some((c) => c.name === 'linked'), 'a symlinked SKILL.md is no candidate')
  const r = promote({ AC: ac, root, skill: 'partial', dry: true })
  assert.equal(r.ok, false)
  assert.match(r.errors.join('\n'), /partial\/notes\.md: .*symlink/)
})

const lesson = (rows, extra = '') => `# Lesson: retry-tests\n\n- date: 2026-10-19\n- outcome: changed\n- situation: A test command fails the same way twice.${extra}\n` +
  '- lesson: Add a test-run skill that reads the first failure.\n- evidence: Three sessions.\n- confidence: medium\n\n## Edits\n\n' +
  `| path | change | observed | sessions | verdict |\n|---|---|---|---|---|\n${rows.map((v) => `| \`.claude/skills/test-run/SKILL.md\` | add | seen | 3 | ${v} |`).join('\n')}\n`

test('promote --lesson copies a lesson with evidence into lessons/ of the compass checkout', () => {
  const { ac, root } = setup()
  const text = lesson(['unclear', 'helped'])
  put(root, { '.agents/lessons/2026-10-19-retry-tests.md': text })
  const dry = promoteLesson({ AC: ac, root, file: '.agents/lessons/2026-10-19-retry-tests.md', dry: true })
  assert.equal(dry.ok, true, dry.errors.join('; '))
  assert.ok(!existsSync(join(ac, 'lessons')))
  const r = promoteLesson({ AC: ac, root, file: './.agents/lessons/2026-10-19-retry-tests.md' })
  assert.equal(r.ok, true, r.errors.join('; '))
  assert.equal(readFileSync(join(ac, 'lessons/2026-10-19-retry-tests.md'), 'utf8'), text)
  assert.ok(existsSync(join(root, '.agents/lessons/2026-10-19-retry-tests.md')), 'the project copy stays')
  assert.match(promoteLesson({ AC: ac, root, file: '.agents/lessons/2026-10-19-retry-tests.md' }).errors.join(), /already exists in the compass checkout/)
})

test('promote --lesson refuses a lesson without evidence, with private text, or outside .agents/lessons', () => {
  const { ac, root } = setup()
  const cases = {
    '2026-10-19-all-unclear.md': [lesson(['unclear', 'unclear']), /no edit has a verdict other than "unclear"/],
    '2026-10-19-no-change.md': ['# Lesson: x\n\n- outcome: no change\n\n## Edits\n\nNo change.\n', /no edit has a verdict/],
    '2026-10-19-mail.md': [lesson(['helped'], ' Ask bob@corp.io.'), /an e-mail address/],
    '2026-10-19-secret.md': [lesson(['helped'], ' Set api_key = abcdef123456.'), /a secret/],
    '2026-10-19-named.md': [lesson(['helped'], ' Seen in the ACME portal.'), /the project name "acme"/],
    '2026-10-19-path.md': [lesson(['helped'], ' See /Users/bob/notes.md.'), /an absolute path/],
  }
  for (const [name, [text, error]] of Object.entries(cases)) {
    put(root, { [`.agents/lessons/${name}`]: text })
    const r = promoteLesson({ AC: ac, root, file: `.agents/lessons/${name}` })
    assert.equal(r.ok, false, name)
    assert.match(r.errors.join('\n'), error, name)
  }
  assert.match(promoteLesson({ AC: ac, root, file: 'notes/2026-10-19-x.md' }).errors[0], /a lesson is \.agents\/lessons\//)
  assert.match(promoteLesson({ AC: ac, root, file: '.agents/lessons/2026-10-19-missing.md' }).errors[0], /is not a file/)
  assert.ok(!existsSync(join(ac, 'lessons')), 'nothing was written')
})

test('ac promote --lesson takes no skill name, and --dry writes nothing', async () => {
  const { root } = setup()
  put(root, { '.agents/lessons/2026-10-19-retry-tests.md': lesson(['helped']) })
  const bin = join(REPO, 'bin/ac.mjs')
  assert.equal((await runNode([bin, 'promote', 'plain', '--lesson', '.agents/lessons/2026-10-19-retry-tests.md', '--root', root])).code, 2)
  const dry = await runNode([bin, 'promote', '--lesson', '.agents/lessons/2026-10-19-retry-tests.md', '--root', root, '--dry'])
  assert.equal(dry.code, 0, dry.stderr)
  assert.match(dry.stdout, /Nothing written/)
  assert.ok(!existsSync(join(REPO, 'lessons/2026-10-19-retry-tests.md')))
})
