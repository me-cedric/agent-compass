import assert from 'node:assert/strict'
import test from 'node:test'

import { runNode } from './helpers.mjs'

const script = new URL('../scripts/catalog.mjs', import.meta.url).pathname

test('catalog lists every asset type with descriptions', async () => {
  const run = await runNode([script])
  assert.equal(run.code, 0, run.stderr)
  const { schema, count, assets } = JSON.parse(run.stdout)
  assert.equal(schema, 1)
  assert.equal(count, assets.length)

  const types = new Set(assets.map((a) => a.type))
  for (const expected of ['skill', 'capability-pack', 'stack', 'template-group', 'workflow', 'tooling', 'guideline', 'architecture', 'instinct', 'command']) {
    assert.ok(types.has(expected), `missing type ${expected}`)
  }

  const adopt = assets.find((a) => a.id === 'compass-adopt' && a.type === 'skill')
  assert.ok(adopt, 'compass-adopt skill missing')
  assert.match(adopt.description, /existing project/i)
  assert.equal(adopt.risk_level, 'medium')
  assert.equal(adopt.writes_files, true)

  // Block-scalar frontmatter descriptions must be flattened, not left as ">".
  const blockScalar = assets.filter((a) => a.type === 'skill' && /^[>|]$/.test(a.description || ''))
  assert.deepEqual(blockScalar, [])

  // Every command in cli.mjs must be picked up.
  assert.ok(assets.filter((a) => a.type === 'command').length >= 40, 'command parsing regressed')

  const security = assets.find((a) => a.id === 'security' && a.type === 'capability-pack')
  assert.ok(security, 'security capability pack missing')
  assert.equal(security.skill_count, 35)
  assert.ok(security.skills.includes('ai-agent-security'))
})

test('catalog filters by type and grep, and renders markdown', async () => {
  const filtered = await runNode([script, '--type', 'skill', '--grep', 'figma'])
  assert.equal(filtered.code, 0, filtered.stderr)
  const { assets } = JSON.parse(filtered.stdout)
  assert.ok(assets.length >= 1)
  assert.ok(assets.every((a) => a.type === 'skill'))

  const md = await runNode([script, '--md', '--grep', 'compass-bootstrap'])
  assert.equal(md.code, 0, md.stderr)
  assert.match(md.stdout, /\| skill \| `compass-bootstrap` \|/)
})
