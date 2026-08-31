#!/usr/bin/env node
// spec-validation-map.mjs — map specs to plan/tasks/checks.
//
// Two layouts, and the report says which one it read. In a spec-kit layout the
// companions sit beside the spec (plan.md, tasks.md, checklist.md). Under
// OpenSpec they belong to the change that produced the spec, not to the settled
// capability — so reporting `plan: missing` for all seventeen capabilities of an
// OpenSpec repo is not a finding, it is the wrong question. See
// docs/workflows/openspec.md.

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseCliArgs, resolveRoot } from './lib/args.mjs'
import { activeChanges, fileArtifacts, findRoots, skipsSpecs, taskProgress, touchedCapabilities } from './lib/openspec.mjs'

const { values, positionals } = parseCliArgs({
  name: 'spec-validation-map',
  script: 'spec-validation-map.mjs',
  summary: 'Map specs to plan/tasks/checks. Detects a spec-kit or an OpenSpec layout.',
  positionals: [{ name: 'root', required: false }],
  options: {
    write: { type: 'boolean', desc: 'Save the map to .agent/spec-validation-map.md.' },
    json: { type: 'boolean', desc: 'Print machine-readable JSON instead of markdown.' },
    strict: { type: 'boolean', desc: 'Exit 1 when a spec lacks plan, tasks, or validation language.' },
    'spec-kit': { type: 'boolean', desc: 'Force the spec-kit layout even when an OpenSpec root exists.' },
  },
})

const root = resolveRoot(positionals)
const openspecRoot = values['spec-kit'] ? null : findRoots(root, null)[0] || null

const walk = (dir, out = []) => {
  if (!existsSync(dir)) return out
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (e.name === 'spec.md') out.push(full)
  }
  return out
}

const hasValidationLanguage = (text) => /validation|test|acceptance/i.test(text)

// --- spec-kit layout: the quartet lives beside the spec -----------------------

const specKitRows = (specsRoot) => walk(specsRoot).map((spec) => {
  const dir = spec.slice(0, -'/spec.md'.length)
  return {
    spec: spec.slice(root.length + 1),
    plan: existsSync(join(dir, 'plan.md')),
    tasks: existsSync(join(dir, 'tasks.md')),
    checklist: existsSync(join(dir, 'checklist.md')) || existsSync(join(dir, 'checklists')),
    validation: hasValidationLanguage(readFileSync(spec, 'utf8')),
  }
})

// --- OpenSpec layout: the artifacts belong to the change ---------------------

const openspecRows = (openspecDir) => activeChanges(openspecDir).map((name) => {
  const changeDir = join(openspecDir, 'changes', name)
  const artifacts = Object.fromEntries(fileArtifacts(changeDir).map((a) => [a.id, a.status]))
  const progress = taskProgress(changeDir)
  const deltaText = walk(join(changeDir, 'specs')).map((f) => readFileSync(f, 'utf8')).join('\n')
  return {
    spec: `${openspecRoot}/changes/${name}`,
    plan: artifacts.design === 'done',
    tasks: artifacts.tasks === 'done',
    checklist: artifacts.specs === 'done' || (artifacts.specs === 'skipped' && skipsSpecs(changeDir)),
    validation: hasValidationLanguage(deltaText) || hasValidationLanguage(readFileSync(join(changeDir, 'tasks.md'), 'utf8').toString()),
    progress,
  }
})

const traceability = (openspecDir) => {
  const touched = touchedCapabilities(openspecDir)
  const specs = walk(join(openspecDir, 'specs')).map((f) => f.slice(join(openspecDir, 'specs').length + 1).replace(/\/spec\.md$/, ''))
  return specs.map((capability) => ({ capability, delta: touched.has(capability) }))
}

const layout = openspecRoot ? 'openspec' : 'spec-kit'
const rows = openspecRoot ? openspecRows(join(root, openspecRoot)) : specKitRows(join(root, 'specs'))
const traced = openspecRoot ? traceability(join(root, openspecRoot)) : []

const header = openspecRoot
  ? `Layout: **OpenSpec** (root \`${openspecRoot}\`). One row per active change — under OpenSpec the plan
(\`design.md\`), the delta specs and the tasks belong to the change, not to the settled capability.
\`Plan\` reads \`design.md\`; \`Delta\` reads \`specs/\` or a declared \`skip_specs\`.

| Change | Plan | Tasks | Delta | Validation Language | Tasks Done |
| ------ | ---- | ----- | ----- | ------------------- | ---------- |
${rows.length
  ? rows.map((r) => `| ${r.spec} | ${r.plan ? 'ok' : 'missing'} | ${r.tasks ? 'ok' : 'missing'} | ${r.checklist ? 'ok' : 'missing'} | ${r.validation ? 'ok' : 'missing'} | ${r.progress.total ? `${r.progress.done}/${r.progress.total}` : '—'} |`).join('\n')
  : '| none active | — | — | — | — | — |'}

## Capability traceability

A capability with no delta anywhere — active or archived — has no recorded history.

| Capability | Delta on record |
| ---------- | --------------- |
${traced.length ? traced.map((t) => `| ${t.capability} | ${t.delta ? 'yes' : 'no'} |`).join('\n') : '| none | — |'}
`
  : `Layout: **spec-kit** (\`specs/<id-slug>/\`). One row per spec.

| Spec | Plan | Tasks | Checklist | Validation Language |
| ---- | ---- | ----- | --------- | ------------------- |
${rows.length
  ? rows.map((r) => `| ${r.spec} | ${r.plan ? 'ok' : 'missing'} | ${r.tasks ? 'ok' : 'missing'} | ${r.checklist ? 'ok' : 'missing'} | ${r.validation ? 'ok' : 'missing'} |`).join('\n')
  : '| none | missing | missing | missing | missing |'}
`

const report = `# Spec Validation Map\n\n${header}`

if (values.json) console.log(JSON.stringify({ schema: 1, root, layout, openspecRoot, specs: rows, traceability: traced }, null, 2))
else if (values.write) {
  mkdirSync(join(root, '.agent'), { recursive: true })
  writeFileSync(join(root, '.agent', 'spec-validation-map.md'), report)
  console.log(join(root, '.agent', 'spec-validation-map.md'))
} else console.log(report)

if (values.strict && rows.some((r) => !r.plan || !r.tasks || !r.validation)) process.exit(1)
