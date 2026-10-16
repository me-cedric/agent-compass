import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { PATH_DEFAULTS } from '../engine/config.mjs'
import { STACK_IDS } from '../engine/detect.mjs'
import { loadUpstream } from '../engine/upstream.mjs'
import { dirs, frontmatter, list, walk } from '../engine/util.mjs'
import { runNode } from './helpers.mjs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const temps = []
test.after(() => { for (const d of temps) rmSync(d, { recursive: true, force: true }) })
const temp = (prefix) => { const d = mkdtempSync(join(tmpdir(), prefix)); temps.push(d); return d }

// Own skills and pack skills: skills/<n>/ and packs/<p>/skills/<n>/. A pack can install with the own skills.
const skillDirs = [
  ...dirs(join(REPO, 'skills')).map((n) => `skills/${n}`),
  ...dirs(join(REPO, 'packs')).flatMap((p) => dirs(join(REPO, 'packs', p, 'skills')).map((n) => `packs/${p}/skills/${n}`)),
].filter((d) => existsSync(join(REPO, d, 'SKILL.md')))
const skills = skillDirs.map((d) => d.split('/').pop())
const skillText = (n) => readFileSync(join(REPO, skillDirs[skills.indexOf(n)], 'SKILL.md'), 'utf8')
const rules = walk(join(REPO, 'rules')).filter((f) => f.endsWith('.md'))
const assets = [...skillDirs.flatMap((d) => walk(join(REPO, d)).map((f) => `${d}/${f}`)), ...rules.map((f) => `rules/${f}`)]

test('the model-invoked skill listing is 3,000 characters or fewer', () => {
  const lines = skills.map((n) => frontmatter(skillText(n)).data)
    .filter((d) => d['disable-model-invocation'] !== 'true')
    .map((d) => `- ${d.name}: ${d.description}`)
  const chars = lines.join('\n').length
  assert.ok(chars <= 3000, `${chars} characters`)
})

test('every skill names its dir and every asset uses known stack ids', () => {
  assert.deepEqual(skills.filter((n, i) => skills.indexOf(n) !== i), [], 'two skill dirs share a name')
  for (const n of skills) assert.equal(frontmatter(skillText(n)).data.name, n)
  for (const rel of assets.filter((f) => f.endsWith('.md'))) {
    for (const id of list(frontmatter(readFileSync(join(REPO, rel), 'utf8')).data.stacks)) assert.ok(STACK_IDS.includes(id), `${rel}: unknown stack ${id}`)
  }
})

test('no skill or rule hard-codes a Konvoy path; placeholders are used instead', () => {
  const literals = Object.values(PATH_DEFAULTS).map((p) => p.split('/').slice(0, 2).join('/'))
  for (const rel of assets) {
    const text = readFileSync(join(REPO, rel), 'utf8')
    for (const literal of literals) assert.ok(!text.includes(literal), `${rel} contains ${literal}`)
  }
})

test('every stack rule has a description, paths and stacks', () => {
  assert.ok(rules.length >= 8, `${rules.length} rules`)
  for (const rel of rules) {
    const text = readFileSync(join(REPO, 'rules', rel), 'utf8')
    const { data } = frontmatter(text)
    assert.match(rel, /^stack-[a-z0-9-]+\.md$/)
    assert.ok(data.description && data.stacks, rel)
    assert.match(text, /^paths:\n( {2}- ".+"\n)+/m, rel)
  }
})

test('upstream.json pins every source by sha', () => {
  const { sources, errors } = loadUpstream(REPO)
  assert.deepEqual(errors, [])
  for (const id of ['ponytail', 'caveman', 'i-have-adhd', 'asd-ste100', 'mattpocock', 'android', 'swift-ios', 'dimillian', 'agent-device']) {
    assert.ok(sources[id], `missing source ${id}`)
  }
  // Two sources that ship one name cannot install together, and an own skill would collide too.
  const names = Object.entries(sources).flatMap(([id, s]) => s.skills.map((e) => (e === '.' ? id : e.split('/').pop())))
  assert.deepEqual(names.filter((n, i) => names.indexOf(n) !== i || skills.includes(n)), [])
})

test('a real fresh install (git init + NestJS) stays within the token budget', async () => {
  const host = temp('ac-fresh-')
  spawnSync('git', ['init', '-q'], { cwd: host, timeout: 10_000 })
  writeFileSync(join(host, 'package.json'), JSON.stringify({ dependencies: { '@nestjs/core': '11', 'drizzle-orm': '0.45' } }))
  const env = { ...process.env, AC_CACHE: temp('ac-fresh-cache-') }
  const ac = (...args) => runNode([join(REPO, 'bin/ac.mjs'), ...args, '--root', host, '--json'], { env })
  const init = await ac('init')
  assert.equal(init.code, 0, init.stdout + init.stderr)
  const doctor = await ac('doctor', '--tokens')
  const { tokens } = JSON.parse(doctor.stdout)
  assert.equal(doctor.code, 0, JSON.stringify(tokens))
  assert.ok(tokens.total <= 2000, `${tokens.total} tokens`)
  for (const rel of ['.claude/rules/stack-nestjs.md', '.claude/rules/stack-drizzle.md', '.agents/skills/stack-nestjs/SKILL.md']) {
    assert.ok(existsSync(join(host, rel)), rel)
  }
  assert.ok(!existsSync(join(host, '.claude/rules/stack-react.md')), 'an undetected stack installs nothing')
  for (const rel of walk(join(host, '.claude'))) {
    assert.ok(!/\{\{[A-Z][A-Z0-9_]*\}\}/.test(readFileSync(join(host, '.claude', rel), 'utf8')), `.claude/${rel} has a placeholder`)
  }
})
