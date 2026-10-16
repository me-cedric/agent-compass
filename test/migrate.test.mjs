import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { checkDocs } from '../engine/docs.mjs'
import { migrateDocs, raidText, splitRegister } from '../engine/migrate.mjs'
import { walk } from '../engine/util.mjs'
import { runNode } from './helpers.mjs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const AC_BIN = join(REPO, 'bin/ac.mjs')
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
  return root
}

const ac = (...args) => runNode([AC_BIN, ...args])

test('init --from-specs creates the layout, stages the documents and prints the next step', async () => {
  const input = put(temp('ac-in-'), { 'brief.md': '# Brief\n', 'annex/table.csv': 'a,b\n', '.secret/x': 'no\n' })
  const root = temp('ac-host-')
  const dry = await ac('init', '--from-specs', input, '--root', root, '--dry')
  assert.equal(dry.code, 0, dry.stderr)
  assert.deepEqual(walk(root), [], 'a dry run writes nothing')

  const r = await ac('init', '--from-specs', input, '--root', root)
  assert.equal(r.code, 0, r.stderr)
  const inbox = `docs/openspec/inbox/${input.split('/').pop()}`
  for (const dir of ['docs/openspec/changes', 'docs/openspec/specs', 'docs/delivery/questions', 'docs/decisions']) assert.ok(existsSync(join(root, dir)), dir)
  assert.equal(readFileSync(join(root, inbox, 'brief.md'), 'utf8'), '# Brief\n')
  assert.ok(existsSync(join(root, inbox, 'annex/table.csv')))
  assert.ok(!existsSync(join(root, inbox, '.secret')), 'hidden entries are not staged')
  assert.equal(JSON.parse(readFileSync(join(root, 'docs/designs/screens.json'), 'utf8')).screens.length, 0)
  assert.equal(readFileSync(join(root, 'docs/openspec/config.yaml'), 'utf8'), 'schema: konvoy-delivery\n')
  assert.ok(existsSync(join(root, 'docs/openspec/schemas/konvoy-delivery/schema.yaml')), 'the sync installs the schema in the new dir')
  assert.match(r.stdout, new RegExp(`Next: run the spec-flow skill on ${inbox}\\. It runs grill first`))

  const again = await ac('init', '--from-specs', input, '--root', root)
  assert.equal(again.code, 0, again.stderr)
  assert.doesNotMatch(again.stdout, /\bstage\b/)

  put(input, { 'brief.md': '# Brief v2\n' })
  const clash = await ac('init', '--from-specs', input, '--root', root)
  assert.equal(clash.code, 1)
  assert.match(clash.stderr, /brief\.md exists with other content; compass does not overwrite it/)
  assert.equal(readFileSync(join(root, inbox, 'brief.md'), 'utf8'), '# Brief\n')

  const self = await ac('init', '--from-specs', dirname(root), '--root', root)
  assert.equal(self.code, 1)
  assert.match(self.stderr, /holds the project/)
  for (const dir of ['docs', 'docs/openspec/inbox']) {
    const nested = await ac('init', '--from-specs', join(root, dir), '--root', root)
    assert.equal(nested.code, 1, dir)
    assert.match(nested.stderr, /holds docs\/openspec\/inbox or is in it/)
  }
})

test('the CLI refuses --docs and --from-specs on the wrong command, and migrate without --docs', async () => {
  const root = temp('ac-host-')
  for (const args of [['migrate'], ['sync', '--docs'], ['sync', '--from-specs', 'x'], ['check', '--docs', '--frozen'], ['init', '--from-specs', '']]) {
    const r = await ac(...args, '--root', root)
    assert.equal(r.code, 2, `${args.join(' ')}: ${r.stderr}`)
  }
})

const REGISTER = `# Questions ouvertes

## Qui doit trancher

| # | Décision | Décideur |
|--:|---|---|
| 1 | Not an item | Produit |

## 1. Who approves a sheet?

**Décideur :** Produit

### Options

1. The mentor.

---

## 2. How long is a link valid?

Body two.

\`\`\`
## 9. Not a question, inside a fence
\`\`\`

# Résidus

| Question à trancher | Décideur | Origine |
| ------------------- | -------- | ------- |
| Which retention for archives? | Client | Call of 17 September |
| Who sees the consent? | Produit |  |
`

test('splitRegister reads numbered headings and question tables only', () => {
  assert.deepEqual(splitRegister('## 1. Use C#\n\n## 2. Closed ##\n').map((i) => i.title), ['Use C#', 'Closed'])
  const items = splitRegister(REGISTER)
  assert.deepEqual(items.map((i) => i.title), ['Who approves a sheet?', 'How long is a link valid?', 'Which retention for archives?', 'Who sees the consent?'])
  assert.match(items[0].body, /### Options\n\n1\. The mentor\.$/)
  assert.match(items[1].body, /## 9\. Not a question/)
  assert.equal(items[2].body, '- **Décideur**: Client\n- **Origine**: Call of 17 September')
  const text = raidText({ id: 'Q-001', today: '2026-10-16', question: `${items[0].title}\n\n${items[0].body}` })
  assert.match(text, /^---\nid: Q-001\nkind: question\nstatus: open\nraisedAt: 2026-10-16\nraisedBy: ac-migrate\nowner:\nspecRef:\ntaskRef:\nticket:\n---\n\n## Question\n\n/)
  assert.match(text, /\n\\### Options\n/, 'a heading in the body is escaped, as the Konvoy codec does')
  assert.match(text, /\n## Answer\n\n\n\n## Consequence\n$/, 'the byte form of formatItem in the Konvoy codec')
})

const specKitHost = () => put(temp('ac-host-'), {
  '.specify/memory/constitution.md': '# Constitution\n',
  '.specify/templates/spec-template.md': 'tpl\n',
  '.specify/integrations/claude.manifest.json': JSON.stringify({ files: { '.claude/skills/speckit-plan/SKILL.md': 'h', 'CLAUDE.md': 'h', '.github/prompts/speckit.plan.prompt.md': 'h' } }),
  '.claude/skills/speckit-plan/SKILL.md': 'skill\n',
  '.github/prompts/speckit.plan.prompt.md': 'prompt\n',
  'CLAUDE.md': '# Claude\n',
  'specs/001-user-auth/spec.md': '# Auth spec\n',
  'specs/001-user-auth/plan.md': '# Auth plan\n',
  'specs/001-user-auth/contracts/api.md': '# API\n',
  'specs/group/feat-b/spec.md': '# B spec\n',
  'specs/README.md': '# Specs\n',
  'specs/constitution.md': '# Old constitution\n',
  'docs/QUESTIONS-OUVERTES.md': REGISTER,
  'docs/delivery/questions/Q-004.md': raidText({ id: 'Q-004', today: '2026-01-01', question: 'Old?' }),
})

const files = (root) => walk(root).sort()

test('migrate --docs --dry lists every spec-kit artifact and register, and writes nothing', () => {
  const root = specKitHost()
  const before = files(root)
  const r = migrateDocs({ AC: REPO, root, apply: false, today: '2026-10-16' })
  assert.equal(r.ok, true, r.errors.join('\n'))
  assert.deepEqual(files(root), before)
  const by = Object.fromEntries(r.items.map((i) => [i.source, i]))
  assert.equal(by['.specify'].action, 'move')
  assert.deepEqual(by['.specify'].copies, [['.specify/memory/constitution.md', 'docs/openspec/constitution.md']])
  assert.equal(by['specs/001-user-auth'].action, 'migrate')
  assert.deepEqual(by['specs/001-user-auth'].copies.map(([, to]) => to).sort(), [
    'docs/openspec/changes/001-user-auth/specs/user-auth/contracts/api.md',
    'docs/openspec/changes/001-user-auth/specs/user-auth/plan.md',
    'docs/openspec/changes/001-user-auth/specs/user-auth/spec.md',
  ])
  assert.equal(by['specs/001-user-auth'].writes[0][0], 'docs/openspec/changes/001-user-auth/proposal.md')
  assert.equal(by['specs/group/feat-b'].action, 'migrate')
  assert.equal(by['specs/README.md'].action, 'manual')
  assert.match(by['specs/constitution.md'].note, /merge this constitution into it by hand/)
  assert.equal(by['.claude/skills/speckit-plan'].action, 'move')
  assert.equal(by['.github/prompts/speckit.plan.prompt.md'].action, 'move')
  assert.equal(by['CLAUDE.md'].action, 'manual')
  assert.deepEqual(by['docs/QUESTIONS-OUVERTES.md'].writes.map(([to]) => to), [5, 6, 7, 8].map((n) => `docs/delivery/questions/Q-00${n}.md`))
})

test('migrate --docs moves each source under migrated/, never overwrites, and a second run has nothing left', () => {
  const root = specKitHost()
  const before = Object.fromEntries(files(root).map((rel) => [rel, readFileSync(join(root, rel), 'utf8')]))
  put(root, { 'docs/openspec/changes/feat-b/proposal.md': '# Mine\n' })
  const r = migrateDocs({ AC: REPO, root, apply: true, today: '2026-10-16' })
  assert.equal(r.ok, true, r.errors.join('\n'))
  for (const [rel, text] of Object.entries(before)) {
    const kept = existsSync(join(root, rel)) ? rel : `migrated/${rel}`
    assert.equal(readFileSync(join(root, kept), 'utf8'), text, `${rel} is kept`)
  }
  assert.equal(readFileSync(join(root, 'docs/openspec/changes/001-user-auth/specs/user-auth/spec.md'), 'utf8'), '# Auth spec\n')
  assert.match(readFileSync(join(root, 'docs/openspec/changes/001-user-auth/proposal.md'), 'utf8'), /^# 001-user-auth\n\n## Why\n/)
  assert.equal(readFileSync(join(root, 'docs/openspec/constitution.md'), 'utf8'), '# Constitution\n')
  assert.equal(readFileSync(join(root, 'docs/openspec/changes/feat-b/proposal.md'), 'utf8'), '# Mine\n')
  assert.ok(existsSync(join(root, 'specs/group/feat-b/spec.md')), 'a change that exists stays a manual item')
  assert.ok(!existsSync(join(root, 'specs/001-user-auth')) && !existsSync(join(root, '.specify')))
  assert.ok(existsSync(join(root, 'CLAUDE.md')) && existsSync(join(root, 'specs/README.md')))
  assert.match(readFileSync(join(root, 'docs/delivery/questions/Q-007.md'), 'utf8'), /Which retention for archives\?/)
  assert.deepEqual(checkDocs({ AC: REPO, root }).errors.filter((e) => /questions/.test(e)), [])

  const again = migrateDocs({ AC: REPO, root, apply: false })
  assert.deepEqual(again.items.filter((i) => i.action !== 'manual'), [])
})

test('migrate --docs skips the OpenSpec inbox, and a file in the way makes an item manual', () => {
  const root = put(temp('ac-host-'), {
    'docs/openspec/inbox/brief/open-questions.md': '## 1. Staged?\n',
    'specs/001-a/spec.md': '# A\n',
    'specs/002-b/spec.md': '# B\n',
    migrated: 'a file\n',
  })
  const r = migrateDocs({ AC: REPO, root, apply: true })
  assert.equal(r.ok, true, r.errors.join('\n'))
  assert.ok(!r.items.some((i) => i.type === 'register'))
  assert.deepEqual(r.items.map((i) => [i.source, i.action, i.note]), [
    ['specs/001-a', 'manual', 'migrated is a file, not a folder'],
    ['specs/002-b', 'manual', 'migrated is a file, not a folder'],
  ])
  assert.deepEqual(walk(root).sort(), ['docs/openspec/inbox/brief/open-questions.md', 'migrated', 'specs/001-a/spec.md', 'specs/002-b/spec.md'])
})

test('migrate --docs does not copy a file through a symlink', { skip: process.platform === 'win32' }, () => {
  const outsideFile = join(put(temp('ac-out-'), { 'key.txt': 'SECRET\n' }), 'key.txt')
  const root = put(temp('ac-host-'), { '.specify/templates/x.md': 'tpl\n' })
  mkdirSync(join(root, '.specify/memory'), { recursive: true })
  symlinkSync(outsideFile, join(root, '.specify/memory/constitution.md'))
  const r = migrateDocs({ AC: REPO, root, apply: true })
  assert.deepEqual(r.items.map((i) => [i.source, i.action, i.note]), [['.specify', 'manual', 'a symlink or a path outside the project']])
  assert.ok(!existsSync(join(root, 'docs/openspec/constitution.md')))
})
