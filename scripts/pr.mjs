#!/usr/bin/env node
// pr.mjs — small gh wrapper for agent-compass PR creation.

import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseCliArgs } from './lib/args.mjs'

const { values } = parseCliArgs({
  name: 'pr',
  script: 'pr.mjs',
  summary: 'Create a GitHub PR with agent-compass defaults.',
  options: {
    reviewer: { type: 'string', multiple: true, value: '<login>', desc: 'Reviewer to request. Repeat for multiple reviewers.' },
    title: { type: 'string', value: '<title>', desc: 'PR title. Defaults to latest commit subject.' },
    base: { type: 'string', value: '<branch>', default: 'develop', desc: 'Base branch. Defaults to develop.' },
    label: { type: 'string', multiple: true, value: '<name>', desc: 'Existing label to apply. Repeat for multiple labels.' },
    dry: { type: 'boolean', desc: 'Print the gh command and generated body only.' },
  },
})

const run = (cmd, cmdArgs) => execFileSync(cmd, cmdArgs, { encoding: 'utf8' }).trim()
const tryRun = (cmd, cmdArgs, fallback = '') => {
  try { return run(cmd, cmdArgs) } catch { return fallback }
}
const dry = Boolean(values.dry)
const reviewers = values.reviewer || []
const labels = values.label || []
const base = values.base
const title = values.title || run('git', ['log', '-1', '--pretty=%s'])

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
