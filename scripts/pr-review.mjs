#!/usr/bin/env node
// pr-review.mjs — fetch a local review packet, optionally submit gh review.

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'
import { parseCliArgs } from './lib/args.mjs'

const { values, positionals } = parseCliArgs({
  name: 'pr-review',
  script: 'pr-review.mjs',
  summary: 'Create a local PR review packet, or submit a prepared GitHub review.',
  positionals: [{ name: 'number', required: true }],
  options: {
    out: { type: 'string', value: '<file>', desc: 'Output packet path. Defaults to .agent/pr-<number>-review.md.' },
    submit: { type: 'string', value: '<event>', desc: 'Submit review: comment, approve, request-changes.' },
    body: { type: 'string', value: '<file>', desc: 'Review body file for --submit.' },
  },
})

const number = positionals[0]
const run = (cmd, cmdArgs) => execFileSync(cmd, cmdArgs, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }).trim()

if (!number || !/^\d+$/.test(number)) {
  console.error('Usage: node scripts/pr-review.mjs <number>')
  process.exit(1)
}

const submit = values.submit
if (submit) {
  const body = values.body
  if (!body) {
    console.error('--submit requires --body <file>')
    process.exit(1)
  }
  const eventFlag = submit === 'approve' ? '--approve' : submit === 'request-changes' ? '--request-changes' : '--comment'
  console.log(run('gh', ['pr', 'review', number, eventFlag, '--body-file', body]))
  process.exit(0)
}

const out = resolve(values.out || join('.agent', `pr-${number}-review.md`))
mkdirSync(dirname(out), { recursive: true })
const meta = run('gh', ['pr', 'view', number, '--json', 'title,body,baseRefName,headRefName,author,labels,reviewRequests,url'])
const diff = run('gh', ['pr', 'diff', number])
const comments = run('gh', ['api', `repos/:owner/:repo/issues/${number}/comments`, '--paginate'])

writeFileSync(out, `# PR ${number} Review Packet

## Metadata

\`\`\`json
${meta}
\`\`\`

## Review Notes

- Findings first.
- Use file/line references.
- State approve/comment/request-changes recommendation.

## Comments

\`\`\`json
${comments}
\`\`\`

## Diff

\`\`\`diff
${diff}
\`\`\`
`)
console.log(out)
