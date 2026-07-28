#!/usr/bin/env node
// recommend.mjs — scan host and propose exact agent-compass setup next actions.

import { existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parseCliArgs, resolveRoot } from './lib/args.mjs'
import { detectStacks, selectAssets, stackLabels } from './lib/profiles.mjs'

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
if (stackIds.includes('react-web') && !has('.github/instructions/backoffice.instructions.md')) recs.push(`Install backoffice path instructions: ${installInstructions('backoffice')} (adjust the \`applyTo\` glob if the app is not in \`apps/backoffice\`).`)
if (!scripts.check && !(scripts.lint && scripts.test)) recs.push('Add a single `check` script or fill lint/typecheck/test registry entries.')
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
