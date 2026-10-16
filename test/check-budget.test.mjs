import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { runNode } from './helpers.mjs'

const REPO = dirname(dirname(fileURLToPath(import.meta.url)))
const SCRIPT = join(REPO, 'scripts/check-budget.mjs')
const temps = []
test.after(() => { for (const d of temps) rmSync(d, { recursive: true, force: true }) })

// A git repo with the counted files. `lines` sets the line count of engine/a.mjs.
const repo = ({ lines = 10, files = 0, agents = 10, block = 10 } = {}) => {
  const root = mkdtempSync(join(tmpdir(), 'ac-budget-'))
  temps.push(root)
  const put = (rel, n) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), 'x\n'.repeat(n)) }
  put('engine/a.mjs', lines)
  put('ui/b.mjs', 1)
  put('bin/ac.mjs', 1)
  put('AGENTS.md', agents)
  put('README.md', 1)
  put('core/blocks/AGENTS.md', block)
  for (let i = 0; i < files; i++) put(`extra/f${i}.txt`, 1)
  spawnSync('git', ['init', '-q'], { cwd: root })
  spawnSync('git', ['add', '-A'], { cwd: root })
  return root
}

test('the repository is within its budgets', async () => {
  const r = await runNode([SCRIPT])
  assert.equal(r.code, 0, r.stderr)
  assert.match(r.stdout, /budget check passed/)
})

test('each budget fails when it is over, and names the count', async () => {
  for (const [opts, pattern] of [
    [{ agents: 151 }, /AGENTS\.md: 151 lines; the budget is 150/],
    [{ block: 121 }, /core\/blocks\/AGENTS\.md: 121 lines; the budget is 120/],
  ]) {
    const r = await runNode([SCRIPT, '--root', repo(opts)])
    assert.equal(r.code, 1, JSON.stringify(opts))
    assert.match(r.stderr, pattern)
  }
  assert.equal((await runNode([SCRIPT, '--root', repo({ agents: 150, block: 120, lines: 9000, files: 300 })])).code, 0, 'no file or code-line budget; exactly at a length budget passes')
})
