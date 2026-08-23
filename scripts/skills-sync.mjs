#!/usr/bin/env node
// skills-sync.mjs — copy or symlink Agent Compass skills into host provider dirs.

import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, symlinkSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CAPABILITY_PACKS } from './lib/capability-packs.mjs'
import { parseCliArgs, resolveRoot } from './lib/args.mjs'
import {
  PROJECT_TARGETS,
  partitionSkills,
  referenceSources,
  stageExternalSkills,
  writeExternalSkills,
} from './lib/external-install.mjs'
import { readSourceRegistry } from './lib/upstream-sources.mjs'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))

// Named in a pack but absent from skills/ — these come from the tracked
// operational source, so a request for one gets an install hint, not a bare error.
const CAPABILITY_SKILLS = new Set(Object.values(CAPABILITY_PACKS).flatMap((pack) => pack.skills))


const { values, positionals } = parseCliArgs({
  name: 'skills-sync',
  script: 'skills-sync.mjs',
  summary: `Copy or symlink Agent Compass skills into host provider dirs.

Targets: agents (.agents/skills), claude (.claude/skills), codex (.agents/skills), all
Default: --copy --target all

A skill that lives in a tracked external source is fetched and installed
automatically — one --only list can name local and tracked skills together.
Operational capability packs: --list-packs.`,
  positionals: [{ name: 'host-dir', required: false }],
  options: {
    copy: { type: 'boolean', desc: 'Copy skills into provider dirs (default).' },
    symlink: { type: 'boolean', desc: 'Symlink skills instead of copying.' },
    target: { type: 'string', value: '<name>', desc: 'Provider target: agents | claude | codex | all (default: all).' },
    all: { type: 'boolean', desc: 'Sync every skill, including all capability packs.' },
    only: { type: 'string', value: '<a,b,c>', desc: 'Sync a fit-based subset (comma-separated skill names; see `recommend --json` assets.skills).' },
    'list-packs': { type: 'boolean', desc: 'List operational capability packs and how to install one.' },
    'no-external': { type: 'boolean', desc: 'Skip tracked external skills instead of fetching them.' },
    'allow-scripts': { type: 'boolean', desc: 'Allow executable payloads from a tracked source (refused by default).' },
    dry: { type: 'boolean', desc: 'Show what would sync; write nothing.' },
  },
})

if (values['list-packs']) {
  for (const [id, pack] of Object.entries(CAPABILITY_PACKS)) {
    console.log(`${id.padEnd(18)} ${String(pack.skills.length).padStart(3)}  ${pack.description}`)
  }
  console.log('\nThese skills live in a tracked external source, not in this repository.')
  console.log('Install one pack: agent-compass external-skills <host> --source devops-security \\')
  console.log(`  --skill ${CAPABILITY_PACKS.compliance.skills.slice(0, 3).join(',')}`)
  console.log('List a pack\'s skills: agent-compass skills --pack <id>')
  process.exit(0)
}

const root = resolveRoot(positionals)
const mode = values.symlink ? 'symlink' : 'copy'
const target = values.target || 'all'
const all = Boolean(values.all)
const only = values.only?.split(',').map((s) => s.trim()).filter(Boolean) || null
const dry = Boolean(values.dry)
if (all && only) {
  console.error('Use either --all or --only, not both.')
  process.exit(1)
}
const targets = {
  agents: '.agents/skills',
  codex: '.agents/skills',
  claude: '.claude/skills',
}
const selected = target === 'all' ? Object.entries(targets) : [[target, targets[target]]]
if (selected.some(([, dir]) => !dir)) { console.error(`Unknown target: ${target}`); process.exit(1) }

let skills = readdirSync(join(AC, 'skills'), { withFileTypes: true }).filter((d) => d.isDirectory())
// A requested name is either a skill this repository holds or one a tracked
// source holds. Routing it here is what makes the two kinds interchangeable to
// every caller: `recommend --json` emits one list and this resolves it.
let externalPlan = new Map()
if (only) {
  const registry = (() => {
    try { return readSourceRegistry(AC) } catch { return { schema: 1, sources: {} } }
  })()
  const { local, external, unknown } = partitionSkills({
    names: only,
    localNames: new Set(skills.map((d) => d.name)),
    registry,
  })
  if (unknown.length) {
    console.error(`Unknown skill(s): ${unknown.join(', ')}`)
    const packed = unknown.filter((name) => CAPABILITY_SKILLS.has(name))
    if (packed.length) {
      console.error(`${packed.join(', ')} belong to a capability pack whose source is not registered. Check skills/upstream-sources.json.`)
    }
    process.exit(1)
  }
  skills = skills.filter((d) => local.includes(d.name))
  if (!values['no-external']) externalPlan = external
  else if (external.size) {
    console.log(`skipped ${[...external.values()].flat().length} tracked external skill(s) (--no-external)`)
  }
}

for (const [, relDir] of selected) {
  const dir = join(root, relDir)
  if (!dry) mkdirSync(dir, { recursive: true })
  for (const skill of skills) {
    const src = join(AC, 'skills', skill.name)
    const dest = join(dir, skill.name)
    if (dry) {
      console.log(`would ${mode} ${skill.name} -> ${relDir}`)
      continue
    }
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true })
    if (mode === 'symlink') symlinkSync(src, dest, 'dir')
    else cpSync(src, dest, { recursive: true })
  }
}
// Dry output stays one line per skill operation, so callers can count it.
if (!dry) {
  console.log(`synced ${skills.length} skills to ${selected.map(([, d]) => d).join(', ')} (${mode})`)
}

if (externalPlan.size) {
  const registry = readSourceRegistry(AC)
  const sources = referenceSources(registry)
  const relDirs = [...new Set(selected.flatMap(([name]) => PROJECT_TARGETS[name] || []))]
  for (const [id, names] of externalPlan) {
    const source = sources[id]
    if (dry) {
      names.forEach((name) => console.log(`would fetch ${name} from ${id} -> ${relDirs.join(', ')}`))
      continue
    }
    let result
    try {
      result = stageExternalSkills({ id, source, names, allowScripts: values['allow-scripts'] })
    } catch (error) {
      console.error(`${id}: ${error.message}`)
      process.exit(1)
    }
    writeExternalSkills({
      root,
      relDirs,
      id,
      source,
      staged: result.staged,
      wantsCopilot: relDirs.includes('.agents/skills'),
    })
    const corrected = source.adapter === 'operational' ? ', safety gate applied' : ''
    console.log(`fetched ${result.staged.length} skill(s) from ${id} @ ${source.commit.slice(0, 7)}${corrected}`)
    if (result.skipped.length) console.log(`skipped ${result.skipped.length} executable payload(s) from ${id}`)
  }
}
