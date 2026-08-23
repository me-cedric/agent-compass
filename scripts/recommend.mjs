#!/usr/bin/env node
// recommend.mjs — scan host and propose exact agent-compass setup next actions.

import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseCliArgs, resolveRoot } from './lib/args.mjs'
import { CBM_BIN, MCP_EXAMPLE_REL, snapshot } from './lib/codebase-memory.mjs'
import { detectStacks, selectAssets, stackLabels } from './lib/profiles.mjs'
import { installDrift } from './lib/external-install.mjs'
import { readSourceRegistry } from './lib/upstream-sources.mjs'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))

const { values, positionals } = parseCliArgs({
  name: 'recommend',
  script: 'recommend.mjs',
  summary: 'Scan host and propose exact agent-compass setup next actions.',
  positionals: [{ name: 'root', required: false }],
  options: {
    write: { type: 'boolean', desc: 'Write report to .agent/recommendations.md.' },
    json: { type: 'boolean', desc: 'Print machine-readable JSON instead of markdown.' },
  },
})
const root = resolveRoot(positionals)
// Path to a compass asset, as typed from the host root: relative when the
// compass checkout lives inside the host (e.g. docs/agent-compass), absolute otherwise.
// realpath both sides so symlinked roots (macOS /var -> /private/var) still compare.
const realRoot = (() => { try { return realpathSync(root) } catch { return root } })()
const acPath = (...segments) => {
  const rel = relative(realRoot, join(AC, ...segments))
  return rel && !rel.startsWith('..') ? rel : join(AC, ...segments)
}
const installInstructions = (name) => `\`mkdir -p .github/instructions && cp ${acPath('templates', 'agent', '.github', 'instructions', `${name}.instructions.md`)} .github/instructions/\``
const has = (p) => existsSync(join(root, p))
const readJson = (p) => { try { return JSON.parse(readFileSync(join(root, p), 'utf8')) } catch { return null } }
const pkg = readJson('package.json') || {}
const scripts = pkg.scripts || {}
const dirs = new Set(existsSync(root) ? readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : [])
const stackIds = detectStacks(root)
const stacks = stackLabels(stackIds)
const assets = selectAssets(stackIds)
const recs = []
if (!has('AGENTS.md')) recs.push('Run `agent-compass setup-host . --strict` to create root agent contract pointer.')
if (!has('agent-compass.commands.json')) recs.push('Create `agent-compass.commands.json` with real lint/typecheck/test commands.')
if (!has('.agent/context.json')) recs.push('Run `agent-compass context-pack . --write` for low-token repo context.')
if (!has('.agent/RUNBOOK.md')) recs.push('Run `agent-compass runbook . --write` for agent startup path.')
if (!has('.mcp/recommended.example.json')) recs.push('Run `agent-compass sync .` to install MCP examples for context7/fetch/playwright/sequential-thinking/projectmem.')
if (!has('.agent/mcp-readiness.md')) recs.push('Run `agent-compass mcp-probe . --write` to verify MCP commands/placeholders.')
if (!has('.agent/provider-verification.md')) recs.push('Run `agent-compass provider-verify . --write` to verify provider setup.')
if (!has('.agent/policy.json')) recs.push('Apply a policy pack with `agent-compass policy-pack . --apply solo-dev|startup-fast|strict-enterprise|regulated-api`.')
if (!has('specs/README.md')) recs.push(`Adopt specs templates for feature work: \`mkdir -p specs && cp ${acPath('templates', 'specs', 'specs-readme.md')} specs/README.md\`.`)
if (has('specs') && !has('.agent/spec-validation-map.md')) recs.push('Run `agent-compass spec-validation-map . --write` to map specs to validation artifacts.')
if ((stackIds.includes('react-web') || stackIds.includes('next-web')) && !has('docs/design')) recs.push('Add design-system docs before UI-heavy work; use Figma MCP when Figma is source of truth.')
if (stackIds.includes('nestjs-api') && !has('.github/instructions/api.instructions.md')) recs.push(`Install API path instructions for contract sync and targeted validation: ${installInstructions('api')} (adjust the \`applyTo\` glob if the API is not in \`apps/api\`).`)
if (stackIds.includes('expo-mobile') && !has('.github/instructions/mobile-app.instructions.md')) recs.push(`Install mobile-app path instructions: ${installInstructions('mobile-app')} (adjust the \`applyTo\` glob if the app is not in \`apps/mobile-app\`).`)
const externalStale = (() => {
  try { return installDrift(root, readSourceRegistry(AC)).stale } catch { return [] }
})()
if (externalStale.length) recs.push(`${externalStale.length} external skill install(s) are behind their pin (${externalStale.map((item) => item.id).join(', ')}). The installed text — including the operational safety corrections — is a snapshot: run \`agent-compass external-skills . --upgrade\`.`)
if (stackIds.includes('android-compose') || stackIds.includes('swift-ios')) recs.push('Native mobile detected: install the `native-mobile-skills` skill, then pull the matching tracked vendor skill per task — see `docs/tooling/native-mobile-skills.md`.')
if (stackIds.includes('react-web') && !has('.github/instructions/backoffice.instructions.md')) recs.push(`Install backoffice path instructions: ${installInstructions('backoffice')} (adjust the \`applyTo\` glob if the app is not in \`apps/backoffice\`).`)
if (!scripts.check && !(scripts.lint && scripts.test)) recs.push('Add a single `check` script or fill lint/typecheck/test registry entries.')

// Structural code intelligence — advisory when unselected, actionable when selected.
// Reports run occasionally, so this one pays for the config read that
// `agent-compass doctor` skips — auto_index=false is the drift worth naming.
const cbm = snapshot(root, { probeIndex: false, probeConfig: true })
if (!cbm.selected) {
  recs.push(`\`${CBM_BIN}\` not configured. Recommended for large or multi-module repositories to reduce broad agent exploration: run \`agent-compass code-intel setup\`.`)
} else {
  if (!cbm.installed) recs.push(`\`${CBM_BIN}\` selected but the executable is missing. Run \`agent-compass code-intel install\`.`)
  for (const { key, want, have } of cbm.drift) recs.push(`\`${CBM_BIN}\` \`${key}=${have}\` — agents would rebuild project understanding every session. Run \`agent-compass code-intel configure\` (want \`${key}=${want}\`).`)
  if (!cbm.mcpExample) recs.push(`Install the code-intelligence MCP config: run \`agent-compass code-intel setup\` to create \`${MCP_EXAMPLE_REL}\`.`)
  if (!cbm.graphIgnored) recs.push('Ignore the generated graph: add `.codebase-memory/` to `.gitignore` (or run `agent-compass code-intel setup`).')
}

if (dirs.has('apps') && !has('docs/architecture/repo-map.md')) recs.push('Generate repo map so agents choose right app/package before editing.')
const report = `# Agent Compass Recommendations

Root: \`${root}\`

Detected: ${stacks.length ? stacks.join(', ') : 'generic project'}

## Recommended Actions

${recs.length ? recs.map((r) => `- ${r}`).join('\n') : '- No immediate setup gaps found.'}

## Fit-Based Assets

Only what matches this project — core plus detected stacks (see
\`scripts/lib/profiles.mjs\`).

- Skills: ${assets.skills.join(', ')}

  \`\`\`bash
  agent-compass skills-sync . --only ${assets.skills.join(',')}
  \`\`\`

- Templates: ${assets.templates.length ? assets.templates.map((t) => `\`${t}\``).join(', ') : '(core only)'}
- Docs to point agents at: ${assets.docs.length ? assets.docs.map((d) => `\`${d}\``).join(', ') : '(none stack-specific)'}
`
if (values.json) console.log(JSON.stringify({ schema: 1, root, stacks, stackIds, recommendations: recs, assets }, null, 2))
else if (values.write) {
  mkdirSync(join(root, '.agent'), { recursive: true })
  writeFileSync(join(root, '.agent', 'recommendations.md'), report)
  console.log(join(root, '.agent', 'recommendations.md'))
} else console.log(report)
