#!/usr/bin/env node
// pr.mjs — small gh wrapper for agent-compass PR creation.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const help = `Usage: node scripts/pr.mjs --reviewer <login> [--title <title>] [--base develop] [--label <name>] [--dry]

Create a GitHub PR with agent-compass defaults.

Options:
  --reviewer <login>  Reviewer to request. Repeat for multiple reviewers.
  --title <title>     PR title. Defaults to latest commit subject.
  --base <branch>     Base branch. Defaults to develop.
  --label <name>      Existing label to apply. Repeat for multiple labels.
  --dry               Print the gh command and generated body only.
  --help              Show this help.
`

const args = process.argv.slice(2)
if (args.includes('--help')) {
  console.log(help)
  process.exit(0)
}

const values = (flag) => args.flatMap((arg, i) => arg === flag ? [args[i + 1]] : []).filter(Boolean)
const value = (flag, fallback) => values(flag)[0] || fallback
const run = (cmd, cmdArgs) => execFileSync(cmd, cmdArgs, { encoding: 'utf8' }).trim()
const tryRun = (cmd, cmdArgs, fallback = '') => {
  try { return run(cmd, cmdArgs) } catch { return fallback }
}
const dry = args.includes('--dry')
const reviewers = values('--reviewer')
const labels = values('--label')
const base = value('--base', 'develop')
const title = value('--title', run('git', ['log', '-1', '--pretty=%s']))

if (!reviewers.length) {
  console.error('Missing --reviewer. Pick at least one reviewer from repo contributors:')
  try {
    console.error(run('gh', ['api', 'repos/:owner/:repo/contributors', '--paginate', '--jq', '.[].login']))
  } catch {
    console.error(run('git', ['shortlog', '-sne', 'HEAD']))
  }
  process.exit(1)
}

let existingLabels = []
try {
  existingLabels = run('gh', ['label', 'list', '--json', 'name', '--jq', '.[].name']).split('\n').filter(Boolean)
} catch {
  if (labels.length) {
    console.error('Cannot verify labels. Run `gh auth status` and `gh label list` first.')
    process.exit(1)
  }
}
const badLabels = labels.filter((label) => existingLabels.length && !existingLabels.includes(label))
if (badLabels.length) {
  console.error(`Unknown label(s): ${badLabels.join(', ')}`)
  console.error(`Existing labels: ${existingLabels.join(', ')}`)
  process.exit(1)
}

const body = `# Summary

## What Changed

${tryRun('git', ['diff', '--stat', `${base}...HEAD`], tryRun('git', ['diff', '--stat', 'HEAD~1...HEAD'], '- See commits.'))}

## Why

- ${title}

## Validation

- Not recorded by script. Paste latest validation result before opening if needed.

## Risks

- None known.
`

const bodyFile = join(mkdtempSync(join(tmpdir(), 'agent-compass-pr-')), 'body.md')
writeFileSync(bodyFile, body)
const ghArgs = ['pr', 'create', '--base', base, '--assignee', '@me', '--title', title, '--body-file', bodyFile]
for (const reviewer of reviewers) ghArgs.push('--reviewer', reviewer)
for (const label of labels) ghArgs.push('--label', label)

if (dry) {
  console.log(`gh ${ghArgs.join(' ')}`)
  console.log('\n' + body)
  process.exit(0)
}

console.log(run('gh', ghArgs))
