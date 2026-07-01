#!/usr/bin/env node
// cli.mjs — one entrypoint for every agent-compass script. Dispatches
// `agent-compass <command> [...args]` to the matching script, passing flags
// through untouched. `agent-compass help [command]` and `--version` included.

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = dirname(fileURLToPath(import.meta.url))
const version = (() => {
  try { return JSON.parse(readFileSync(join(DIR, '..', 'package.json'), 'utf8')).version } catch { return '0.0.0' }
})()

// name → { script | argv, group, desc }. argv runs a script with fixed leading args.
const COMMANDS = {
  adopt: { script: 'adopt.mjs', group: 'Setup', desc: 'One-command host adoption: setup + fit sync + verify.' },
  bootstrap: { script: 'bootstrap.mjs', group: 'Setup', desc: 'New-project prompt generator (--answers for agents).' },
  wizard: { script: 'setup-wizard.mjs', group: 'Setup', desc: 'Interactive host adoption wizard.' },
  'apply-recommendations': { script: 'apply-recommendations.mjs', group: 'Setup', desc: 'Apply safe project/global setup recommendations.' },
  'global-setup': { script: 'global-setup.mjs', group: 'Setup', desc: 'Non-destructive user-level Agent Compass setup.' },
  'setup-host': { script: 'setup-host.mjs', group: 'Setup', desc: 'Full host setup: install, fix, reports, onboard.' },
  install: { script: 'install.mjs', group: 'Setup', desc: 'Wire agent-compass into a host (create missing files).' },
  'doctor-fix': { script: 'doctor-fix.mjs', group: 'Setup', desc: 'Autofix host agent setup and regenerate reports.' },
  sync: { script: 'sync.mjs', group: 'Setup', desc: 'Update managed files from the submodule (no clobber).' },
  vendor: { script: 'vendor.mjs', group: 'Setup', desc: 'Create/refresh a plain-copy vendoring with provenance.' },
  'spec-kit-bridge': { script: 'spec-kit-bridge.mjs', group: 'Setup', desc: 'Install optional Spec Kit bridge files.' },
  'skills-sync': { script: 'skills-sync.mjs', group: 'Setup', desc: 'Copy or symlink skills into provider dirs.' },
  'policy-pack': { script: 'policy-pack.mjs', group: 'Setup', desc: 'List/apply setup policy packs.' },
  upgrade: { script: 'upgrade-host.mjs', group: 'Setup', desc: 'Bump the submodule, sync, then doctor.' },
  'check-update': { script: 'check-update.mjs', group: 'Setup', desc: 'Cheap cached "are we behind?" check (no tokens).' },

  doctor: { argv: ['install.mjs', '--doctor'], group: 'Health', desc: 'Verify host wiring (add --deep, --fix).' },
  'doctor-report': { script: 'doctor-report.mjs', group: 'Health', desc: 'Print a host readiness report.' },
  onboard: { script: 'agent-onboard.mjs', group: 'Health', desc: 'One-command readiness aggregate.' },
  'provider-verify': { script: 'provider-verify.mjs', group: 'Health', desc: 'Verify provider files and prompts are discoverable.' },
  recommend: { script: 'recommend.mjs', group: 'Health', desc: 'Scan host and recommend agent setup improvements.' },
  'quality-gates': { script: 'quality-gates.mjs', group: 'Health', desc: 'Run generic agent handoff quality gates.' },
  dashboard: { script: 'dashboard.mjs', group: 'Health', desc: 'Write static .agent/report.html dashboard.' },
  'migration-plan': { script: 'migration-plan.mjs', group: 'Health', desc: 'Plan host upgrade against current manifest.' },
  'mcp-probe': { script: 'mcp-probe.mjs', group: 'Health', desc: 'Probe MCP config readiness.' },
  'spec-validation-map': { script: 'spec-validation-map.mjs', group: 'Health', desc: 'Map specs to plan/tasks/validation coverage.' },
  'design-importer': { script: 'design-importer.mjs', group: 'Health', desc: 'Create design-system docs from Figma/token export.' },
  drift: { script: 'agent-drift.mjs', group: 'Health', desc: 'Drift dashboard across guidance validators.' },
  conformance: { script: 'agent-conformance.mjs', group: 'Health', desc: 'Provider customization + smoke prompts.' },
  evals: { script: 'agent-evals.mjs', group: 'Health', desc: 'Validate teaching/tool-offer eval fixtures.' },

  context: { script: 'context.mjs', group: 'Context', desc: 'Compact repo snapshot for agents.' },
  'context-pack': { script: 'context-pack.mjs', group: 'Context', desc: 'Machine-readable .agent/context.json.' },
  catalog: { script: 'catalog.mjs', group: 'Context', desc: 'Machine-readable asset catalog (skills, stacks, templates, docs).' },
  runbook: { script: 'runbook.mjs', group: 'Context', desc: 'Compact agent runbook.' },
  depgraph: { script: 'gen-depgraph.mjs', group: 'Context', desc: 'Mermaid dependency graph from imports.' },

  new: { script: 'new.mjs', group: 'Build', desc: 'Scaffold a skill, ADR, spec, or instinct.' },
  run: { script: 'run-command.mjs', group: 'Build', desc: 'Run a registry command (refuses unknown/destructive).' },
  'check-companions': { script: 'check-change-companions.mjs', group: 'Build', desc: 'Fail when source changes ship without a test.' },
  redact: { script: 'redact.mjs', group: 'Build', desc: 'Scan files/staged diff for secret/PII leaks.' },

  trace: { script: 'agent-trace.mjs', group: 'Learning', desc: 'Validate a trace/outcome log (no secrets).' },
  'task-log': { script: 'task-log.mjs', group: 'Learning', desc: 'Append/read completion-gate task log.' },
  'failure-mine': { script: 'failure-mine.mjs', group: 'Learning', desc: 'Mine task logs/traces into improvement themes.' },
  'trace-to-evals': { script: 'trace-to-evals.mjs', group: 'Learning', desc: 'Turn failed trace rows into regression evals.' },
  'pull-knowledge': { script: 'pull-knowledge.mjs', group: 'Learning', desc: 'Stage reusable knowledge from a project.' },

  pr: { script: 'pr.mjs', group: 'Git', desc: 'Create a PR with Agent Compass defaults.' },
  'pr-review': { script: 'pr-review.mjs', group: 'Git', desc: 'Build or submit a PR review.' },
  release: { script: 'release.mjs', group: 'Git', desc: 'Prepare version/changelog release metadata.' },
}

const ALIASES = {
  'new-project': 'bootstrap', 'setup-wizard': 'wizard', 'install-into': 'install', 'sync-into': 'sync', 'upgrade-host': 'upgrade',
  'agent-onboard': 'onboard', 'agent-drift': 'drift', 'agent-conformance': 'conformance', 'agent-evals': 'evals',
  'agent-trace': 'trace', 'gen-depgraph': 'depgraph', 'run-command': 'run', 'check-change-companions': 'check-companions',
}
const GROUPS = ['Setup', 'Health', 'Context', 'Build', 'Learning', 'Git']
const resolve = (name) => ALIASES[name] || name

const printHelp = () => {
  let out = `agent-compass ${version}

Usage: agent-compass <command> [options]
       agent-compass help <command>     per-command help
       agent-compass --version
`
  for (const group of GROUPS) {
    out += `\n${group}\n`
    for (const [name, entry] of Object.entries(COMMANDS)) {
      if (entry.group === group) out += `  ${name.padEnd(18)} ${entry.desc}\n`
    }
  }
  out += `\nEvery command passes its flags straight through, e.g.:
  agent-compass install --dry            agent-compass sync . --check
  agent-compass doctor . --deep          agent-compass new skill my-thing
`
  console.log(out)
}

const argv = process.argv.slice(2)
const first = argv[0]

if (!first || first === 'help' || first === '--help' || first === '-h') {
  const topic = argv[1]
  if (topic) {
    const entry = COMMANDS[resolve(topic)]
    if (!entry) { console.error(`Unknown command: ${topic}`); process.exit(1) }
    const script = entry.script || entry.argv[0]
    const result = spawnSync(process.execPath, [join(DIR, script), '--help'], { stdio: 'inherit' })
    process.exit(result.status === null ? 1 : result.status)
  }
  printHelp()
  process.exit(0)
}

if (first === '--version' || first === '-v' || first === 'version') {
  console.log(version)
  process.exit(0)
}

const entry = COMMANDS[resolve(first)]
if (!entry) {
  console.error(`Unknown command: ${first}\nRun \`agent-compass help\` for the command list.`)
  process.exit(1)
}

const lead = entry.argv ? [join(DIR, entry.argv[0]), ...entry.argv.slice(1)] : [join(DIR, entry.script)]
const result = spawnSync(process.execPath, [...lead, ...argv.slice(1)], { stdio: 'inherit' })
process.exit(result.status === null ? 1 : result.status)
