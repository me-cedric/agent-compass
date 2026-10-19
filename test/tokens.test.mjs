import assert from 'node:assert/strict'
import test from 'node:test'
import { estimate, estimatePlan } from '../engine/tokens.mjs'

const file = (text) => ({ content: Buffer.from(text) })
const PLAN = {
  blocks: new Map([['AGENTS.md', 'Rule one.\nRule two.\n']]),
  files: new Map([
    ['.claude/skills/alpha/SKILL.md', file('---\nname: alpha\ndescription: Alpha skill.\n---\nBody that the listing does not count.\n')],
    ['.claude/skills/alpha/ref.md', file('Not a listing line.')],
    ['.claude/skills/beta/SKILL.md', file('---\nname: beta\ndescription: Beta skill, a longer description.\n---\nBody.\n')],
    ['.claude/skills/hidden/SKILL.md', file('---\nname: hidden\ndescription: Hidden.\ndisable-model-invocation: true\n---\nBody.\n')],
    ['.claude/agents/worker.md', file('---\nname: worker\ndescription: Makes one change.\n---\nBody.\n')],
    ['.claude/output-styles/terse.md', file('---\nname: terse\n---\nStyle body of 28 characters.\n')],
  ]),
  keys: new Map([['.claude/settings.json', new Map([['outputStyle', 'terse']])]]),
}

test('estimatePlan: the text items, one figure for each skill and agent, and the total', () => {
  const r = estimatePlan(PLAN)
  assert.deepEqual(r.skills, {
    alpha: estimate('- alpha: Alpha skill.'.length),
    beta: estimate('- beta: Beta skill, a longer description.'.length),
    hidden: 0,
  })
  assert.deepEqual(r.agents, { worker: estimate('- worker: Makes one change.'.length) })
  assert.deepEqual(r.items.map((i) => i.name), ['AGENTS.md block', 'skill listing', 'agent listing', 'output style'])
  const item = (name) => r.items.find((i) => i.name === name)
  assert.equal(item('skill listing').tokens, r.skills.alpha + r.skills.beta + r.skills.hidden, 'the listing is the sum of its lines')
  assert.equal(item('skill listing').chars, '- alpha: Alpha skill.\n- beta: Beta skill, a longer description.'.length)
  assert.equal(item('AGENTS.md block').tokens, estimate('\nRule one.\nRule two.\n'.length))
  assert.equal(item('output style').tokens, estimate('Style body of 28 characters.\n'.length))
  assert.equal(r.total, r.items.reduce((n, i) => n + i.tokens, 0))
})

test('estimatePlan: an empty plan has the listing items and no style', () => {
  const r = estimatePlan({ blocks: new Map(), files: new Map(), keys: new Map() })
  assert.deepEqual([r.items.map((i) => i.name), r.skills, r.agents, r.total], [['skill listing', 'agent listing'], {}, {}, 0])
})

test('a block-scalar description is read whole, so the listing counts it', async () => {
  const { frontmatter } = await import('../engine/util.mjs')
  const { listingLine } = await import('../engine/tokens.mjs')
  const folded = '---\nname: guard\ndescription: >-\n  Use when a session is long,\n  or after compaction.\n\n  Keeps the rules.\nmetadata:\n  stacks: [web]\n---\nBody.\n'
  assert.equal(frontmatter(folded).data.description, 'Use when a session is long, or after compaction. Keeps the rules.')
  assert.equal(frontmatter(folded).data.stacks, '[web]', 'a nested key after the block still reads as a top-level key')
  assert.equal(listingLine(folded), '- guard: Use when a session is long, or after compaction. Keeps the rules.')
  const literal = '---\nname: lit\ndescription: |\n  First line.\n  Second line.\n---\nBody.\n'
  assert.equal(frontmatter(literal).data.description, 'First line.\nSecond line.')
  const last = '---\nname: end\ndescription: >\n  Ends at the closing line.\n---\nBody.\n'
  assert.equal(frontmatter(last).data.description, 'Ends at the closing line.')
  assert.equal(frontmatter('---\nname: plain\ndescription: Plain text.\n---\n').data.description, 'Plain text.')
  assert.equal(frontmatter('---\ndescription: >-\nname: empty\n---\n').data.name, 'empty', 'an empty block ends at the next key')
})
