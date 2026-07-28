#!/usr/bin/env node
// spec-validation-map.mjs — map specs to plan/tasks/checks.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCliArgs, resolveRoot } from './lib/args.mjs'

const { values, positionals } = parseCliArgs({
  name: 'spec-validation-map',
  script: 'spec-validation-map.mjs',
  summary: 'Map specs to plan/tasks/checks.',
  positionals: [{ name: 'root', required: false }],
  options: {
    write: { type: 'boolean', desc: 'Save the map to .agent/spec-validation-map.md.' },
    json: { type: 'boolean', desc: 'Print machine-readable JSON instead of markdown.' },
    strict: { type: 'boolean', desc: 'Exit 1 when a spec lacks plan, tasks, or validation language.' },
  },
})

const root = resolveRoot(positionals)
const specsRoot = join(root, 'specs')
const walk = (dir, out = []) => {
  if (!existsSync(dir)) return out
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (e.name === 'spec.md') out.push(full)
  }
  return out
}
const rows = walk(specsRoot).map((spec) => {
  const dir = spec.slice(0, -'/spec.md'.length)
  const text = readFileSync(spec, 'utf8')
  return {
    spec: spec.slice(root.length + 1),
    plan: existsSync(join(dir, 'plan.md')),
    tasks: existsSync(join(dir, 'tasks.md')),
    checklist: existsSync(join(dir, 'checklist.md')) || existsSync(join(dir, 'checklists')),
    validation: /validation|test|acceptance/i.test(text),
  }
})
const report = `# Spec Validation Map

| Spec | Plan | Tasks | Checklist | Validation Language |
| ---- | ---- | ----- | --------- | ------------------- |
${rows.length ? rows.map((r) => `| ${r.spec} | ${r.plan ? 'ok' : 'missing'} | ${r.tasks ? 'ok' : 'missing'} | ${r.checklist ? 'ok' : 'missing'} | ${r.validation ? 'ok' : 'missing'} |`).join('\n') : '| none | missing | missing | missing | missing |'}
`
if (values.json) console.log(JSON.stringify({ schema: 1, root, specs: rows }, null, 2))
else if (values.write) {
  mkdirSync(join(root, '.agent'), { recursive: true })
  writeFileSync(join(root, '.agent', 'spec-validation-map.md'), report)
  console.log(join(root, '.agent', 'spec-validation-map.md'))
} else console.log(report)
if (values.strict && rows.some((r) => !r.plan || !r.tasks || !r.validation)) process.exit(1)
