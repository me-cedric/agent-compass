#!/usr/bin/env node
// pr-review.mjs — fetch a local review packet, optionally submit gh review.

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'

const help = `Usage: node scripts/pr-review.mjs <number> [--out <file>] [--submit comment|approve|request-changes --body <file>]

Create a local PR review packet, or submit a prepared GitHub review.

Options:
  --out <file>       Output packet path. Defaults to .agent/pr-<number>-review.md.
  --submit <event>   Submit review: comment, approve, request-changes.
  --body <file>      Review body file for --submit.
  --help             Show this help.
`

const args = process.argv.slice(2)
if (args.includes('--help')) {
  console.log(help)
  process.exit(0)
}

const number = args.find((arg) => /^\d+$/.test(arg))
const value = (flag) => args[args.indexOf(flag) + 1]
const run = (cmd, cmdArgs) => execFileSync(cmd, cmdArgs, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }).trim()

if (!number) {
  console.error('Usage: node scripts/pr-review.mjs <number>')
  process.exit(1)
}

const submit = value('--submit')
if (submit) {
  const body = value('--body')
  if (!body) {
    console.error('--submit requires --body <file>')
    process.exit(1)
  }
  const eventFlag = submit === 'approve' ? '--approve' : submit === 'request-changes' ? '--request-changes' : '--comment'
  console.log(run('gh', ['pr', 'review', number, eventFlag, '--body-file', body]))
  process.exit(0)
}

const out = resolve(value('--out') || join('.agent', `pr-${number}-review.md`))
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
