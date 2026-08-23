#!/usr/bin/env node
// external-skills.mjs — install skills from a pinned external reference source
// into a host project or the current user's agent config. The fetch, the
// install-time correction, and the provider layout live in
// lib/external-install.mjs, which skills-sync shares.

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseCliArgs } from './lib/args.mjs'
import {
  COPILOT_INSTRUCTIONS,
  PROJECT_TARGETS,
  USER_TARGETS,
  referenceSources,
  stageExternalSkills,
  writeExternalSkills,
} from './lib/external-install.mjs'
import { readSourceRegistry } from './lib/upstream-sources.mjs'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))

const { values, positionals } = parseCliArgs({
  name: 'external-skills',
  script: 'external-skills.mjs',
  summary: `Install skills from a pinned external source into a project or the
current user's agent config. Agent Compass keeps no copy of these skills, so the
copy is made here. Nothing upstream is executed.`,
  positionals: [{ name: 'host-dir', required: false }],
  options: {
    list: { type: 'boolean', desc: 'List every tracked source with its licence and skill count.' },
    source: { type: 'string', value: '<id>', desc: 'Tracked source id (see --list).' },
    skill: { type: 'string', value: '<a,b,c>', desc: 'Install these upstream skills.' },
    recommended: { type: 'boolean', desc: 'Install the skills Agent Compass recommends from this source.' },
    all: { type: 'boolean', desc: 'Install every skill the source holds.' },
    target: { type: 'string', value: '<name>', desc: 'claude | codex | copilot | agents | all (default: all).' },
    global: { type: 'boolean', desc: "Install into the current user's config instead of a project." },
    'allow-scripts': { type: 'boolean', desc: 'Also install executable payloads (refused by default).' },
    dry: { type: 'boolean', desc: 'Show what would be installed; write nothing.' },
  },
})

const registry = (() => {
  try { return readSourceRegistry(AC) } catch {
    console.error(`Missing ${join(AC, 'skills', 'upstream-sources.json')}.`)
    process.exit(1)
  }
})()
const sources = referenceSources(registry)

if (values.list) {
  for (const [id, source] of Object.entries(sources)) {
    const curated = source.recommended?.length ? `${source.recommended.length} recommended` : 'no curation'
    console.log(`${id.padEnd(17)} ${String(source.upstreamSkills.length).padStart(3)} skills  ${curated.padEnd(16)} ${source.license}`)
  }
  console.log('\nInstall:   agent-compass external-skills [host-dir] --source <id> --recommended')
  console.log('User-wide: agent-compass external-skills --source <id> --recommended --global')
  console.log('\nA fit-based adoption pulls the right ones on its own:')
  console.log('  agent-compass recommend <host> --json   -> assets.skills')
  console.log('  agent-compass skills-sync <host> --only <that list>')
  process.exit(0)
}

const id = values.source
if (!id) {
  console.error('Pass --source <id>, or --list to see the tracked sources.')
  process.exit(1)
}
const source = sources[id]
if (!source) {
  console.error(`Unknown tracked source: ${id}. Known: ${Object.keys(sources).join(', ')}`)
  process.exit(1)
}

if ([values.skill, values.recommended, values.all].filter(Boolean).length !== 1) {
  console.error('Choose exactly one of --skill <a,b>, --recommended, or --all.')
  process.exit(1)
}
let wanted
if (values.skill) {
  wanted = values.skill.split(',').map((name) => name.trim()).filter(Boolean)
  const unknown = wanted.filter((name) => !source.upstreamSkills.includes(name))
  if (unknown.length) {
    console.error(`${id} holds no skill named: ${unknown.join(', ')}`)
    console.error(`Known: ${source.upstreamSkills.join(', ')}`)
    process.exit(1)
  }
} else if (values.recommended) {
  wanted = source.recommended || []
  if (!wanted.length) {
    console.error(`${id} carries no Agent Compass curation. Use --all or --skill <a,b>.`)
    process.exit(1)
  }
} else {
  wanted = [...source.upstreamSkills]
}

const target = values.target || 'all'
const scope = values.global ? USER_TARGETS : PROJECT_TARGETS
if (target !== 'all' && !scope[target]) {
  console.error(`Unknown target: ${target}. Known: ${Object.keys(scope).join(', ')}, all`)
  process.exit(1)
}
const root = values.global ? homedir() : resolve(positionals[0] || '.')
if (!values.global && !existsSync(root)) {
  console.error(`Host directory not found: ${root}`)
  process.exit(1)
}
const relDirs = [...new Set(target === 'all' ? Object.values(scope).flat() : scope[target])]
const wantsCopilot = target === 'all' || target === 'copilot'

let result
try {
  result = stageExternalSkills({ id, source, names: wanted, allowScripts: values['allow-scripts'] })
} catch (error) {
  console.error(`Install failed: ${error.message}`)
  process.exit(1)
}

if (values.dry) {
  for (const { name, payload } of result.staged) {
    for (const relDir of relDirs) console.log(`would install ${name} (${payload.size} files) -> ${relDir}`)
  }
  if (wantsCopilot) console.log(`would write ${COPILOT_INSTRUCTIONS}`)
  if (result.skipped.length) console.log(`would skip ${result.skipped.length} executable payload(s): ${result.skipped.join(', ')}`)
  console.log(`dry-run: no files written (${source.repository} @ ${source.commit.slice(0, 7)})`)
  process.exit(0)
}

writeExternalSkills({ root, relDirs, id, source, staged: result.staged, wantsCopilot })

console.log(`installed ${result.staged.length} skill(s) from ${id} @ ${source.commit.slice(0, 7)} to ${relDirs.join(', ')}${values.global ? ' (user-wide)' : ''}`)
if (wantsCopilot) console.log(`wrote ${COPILOT_INSTRUCTIONS} so Copilot sees them`)
if (source.adapter === 'operational') console.log('applied the Agent Compass safety gate and argv-secret narrowings to each skill')
if (result.skipped.length) {
  console.log(`skipped ${result.skipped.length} executable payload(s): ${result.skipped.join(', ')}`)
  console.log('Pass --allow-scripts to install them after reviewing each one.')
}
