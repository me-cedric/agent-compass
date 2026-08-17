#!/usr/bin/env node
// evidence.mjs — build the proof a completion claim owes: test results plus
// screenshots in one bundle, and a before/after report for a spec'd change.
//
//   evidence.mjs [root]                              build .agent/evidence/
//   evidence.mjs [root] --change <slug> --phase start
//   evidence.mjs [root] --change <slug> --phase finish
//
// Configure it with the `evidence` key of agent-compass.commands.json. With no
// key it discovers junit and png files and still produces a bundle.

import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, dirname } from 'node:path'
import { parseCliArgs, resolveRoot } from './lib/args.mjs'
import {
  DEFAULT_EXCLUDED_DIRS, DEFAULT_EXCLUDED_FILES, bundleStatus, changeStatus, compareSnapshots,
  escapeHtml, evidenceConfig, extractSection, isSlug, isTestFile, parseJunit, sumJunit,
} from './lib/evidence.mjs'

const { values, positionals } = parseCliArgs({
  name: 'evidence',
  script: 'evidence.mjs',
  summary: 'Build the test-evidence bundle, or the before/after report for a change.',
  positionals: [{ name: 'root', required: false }],
  options: {
    change: { type: 'string', value: '<slug>', desc: 'Slug of a change spec under specs/changes/.' },
    phase: { type: 'string', value: '<start|finish>', desc: 'Which side of the change to record.' },
    run: { type: 'boolean', desc: 'Run the configured evidence command first, instead of collecting what is on disk.' },
    write: { type: 'boolean', desc: 'Write the bundle (default; kept for symmetry with the other tools).' },
    json: { type: 'boolean', desc: 'Print machine-readable JSON instead of a summary.' },
    strict: { type: 'boolean', desc: 'Exit 1 when the proof is incomplete. --phase finish is a gate and always does.' },
  },
})

const root = resolveRoot(positionals)
const fail = (message) => { console.error(message); process.exit(1) }

const slug = values.change
const phase = values.phase
if (slug !== undefined && !isSlug(slug)) fail('--change needs a kebab-case slug, for example featured-movie.')
if (phase !== undefined && !['start', 'finish'].includes(phase)) fail('--phase must be start or finish.')
if (phase && !slug) fail('--phase needs --change <slug>.')
if (slug && !phase) fail('--change needs --phase start or --phase finish.')

// Two artifact kinds, two roots. A change report copies whole bundles into
// itself, so it must never sit inside the directory the bundle rebuilds.
const evidenceDir = join(root, '.agent', 'evidence')
const changeDir = slug ? join(root, '.agent', 'changes', slug) : null

// ---------------------------------------------------------------- discovery

const readJson = (path, fallback = {}) => {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return fallback }
}
const config = evidenceConfig(readJson(join(root, 'agent-compass.commands.json')))

const walk = (dir, depth, out = []) => {
  if (depth < 0 || !existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!DEFAULT_EXCLUDED_DIRS.includes(entry.name)) walk(join(dir, entry.name), depth - 1, out)
    } else if (entry.isFile() && !DEFAULT_EXCLUDED_FILES.includes(entry.name)) out.push(join(dir, entry.name))
  }
  return out
}

// Report directories are excluded from the source walk on purpose, so they are
// scanned separately and shallowly.
const walkAll = (dir, out = []) => {
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) walkAll(full, out)
    else if (entry.isFile()) out.push(full)
  }
  return out
}

const reportRoots = config.reports.length
  ? config.reports.map((p) => join(root, p))
  : ['artifacts', 'playwright-report', 'reports', 'test-results', 'coverage'].map((p) => join(root, p))

const candidateFiles = [...walk(root, 3), ...reportRoots.flatMap((dir) => walkAll(dir))]

const junitFiles = config.junit.length
  ? config.junit.map((p) => join(root, p)).filter((p) => existsSync(p))
  : [...new Set(candidateFiles.filter((f) => /junit.*\.xml$/i.test(f)))].sort()

const screenshotFiles = config.screenshots.length
  ? config.screenshots.flatMap((p) => walkAll(join(root, p))).filter((f) => f.endsWith('.png'))
  : [...new Set(candidateFiles.filter((f) => f.endsWith('.png') && /screenshot|evidence|shots/i.test(f)))].sort()

// ------------------------------------------------------------------ running

const runEvidenceCommand = () => {
  if (!config.command) fail('--run needs an `evidence.command` (or `check`) in agent-compass.commands.json.')
  const [command, ...args] = config.command.split(/\s+/)
  console.log(`> ${config.command}`)
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: false })
  if (result.error) fail(`${config.command} could not start: ${result.error.message}`)
  if (result.status !== 0) fail(`${config.command} failed with code ${result.status}.`)
}

// ---------------------------------------------------------------- snapshots

const snapshotWorkspace = () => {
  const snapshot = {}
  for (const file of walk(root, 12)) {
    const name = relative(root, file).replaceAll('\\', '/')
    snapshot[name] = { sha256: createHash('sha256').update(readFileSync(file)).digest('hex'), size: statSync(file).size }
  }
  return snapshot
}

const git = (args, fallback = null) => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  return result.status === 0 ? result.stdout.trim() || fallback : fallback
}

// ------------------------------------------------------------------- bundle

const buildBundle = () => {
  const totals = sumJunit(junitFiles.map((file) => parseJunit(readFileSync(file, 'utf8'))))
  const status = bundleStatus({
    totals,
    junitCount: junitFiles.length,
    screenshotCount: screenshotFiles.length,
    expectScreenshots: config.expectScreenshots,
  })
  const generatedAt = new Date().toISOString()
  const commit = git(['rev-parse', '--short', 'HEAD'], 'unavailable')
  const branch = git(['branch', '--show-current'], 'unavailable')

  rmSync(evidenceDir, { recursive: true, force: true })
  mkdirSync(join(evidenceDir, 'raw'), { recursive: true })
  mkdirSync(join(evidenceDir, 'screenshots'), { recursive: true })
  for (const file of junitFiles) cpSync(file, join(evidenceDir, 'raw', relative(root, file).replaceAll(/[\\/]/g, '-')))
  const shots = screenshotFiles.map((file) => {
    const name = relative(root, file).replaceAll('\\', '/').replaceAll('/', '-')
    cpSync(file, join(evidenceDir, 'screenshots', name))
    return name
  })

  const verdict = status.complete ? 'PROOF COMPLETE' : 'PROOF INCOMPLETE'
  const conclusion = status.complete
    ? 'Every declared test passed and the expected screenshots are present. This proves the run, not the visual fidelity: the human review stays required.'
    : `The bundle is incomplete: ${status.reasons.join('; ')}.`

  const summary = `# Test evidence

| Field | Value |
| --- | --- |
| Status | **${verdict}** |
| Generated | ${generatedAt} |
| Commit | \`${commit}\` |
| Branch | \`${branch}\` |
| Sources | ${config.junit.length ? 'configured' : 'discovered'} |
${config.junit.length ? '' : `
> Reports were discovered, not declared. A tree that keeps archived bundles is
> counted more than once. Declare \`evidence.junit\` in
> \`agent-compass.commands.json\` for an exact claim.
`}

## Results

| Tests | Failures | Errors | Skipped | Reports |
| ---: | ---: | ---: | ---: | ---: |
| ${totals.tests} | ${totals.failures} | ${totals.errors} | ${totals.skipped} | ${junitFiles.length} |

## Screenshots

${shots.length ? shots.map((name) => `- [${name}](screenshots/${name})`).join('\n') : '- None collected.'}

## Raw reports

${junitFiles.length ? junitFiles.map((f) => `- \`${relative(root, f)}\``).join('\n') : '- None found.'}

## Conclusion

${conclusion}
`

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Test evidence</title><style>
body{margin:0;background:#070a12;color:#fff;font:16px/1.5 system-ui,sans-serif}main{max-width:1200px;margin:auto;padding:48px 24px}a{color:#60a5fa}
.status{display:inline-block;padding:8px 12px;border-radius:8px;font-weight:700;background:${status.complete ? '#164e2b' : '#7f1d1d'}}
table{width:100%;border-collapse:collapse;margin:24px 0}th,td{padding:10px;border:1px solid #25304a;text-align:left}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:24px}
figure{margin:0;padding:12px;border:1px solid #25304a;border-radius:12px;background:#0d1220}
img{width:100%;height:280px;object-fit:contain;background:#151c2f}figcaption{padding-top:8px;color:#d9deea;word-break:break-all}code{color:#f5b942}
</style></head><body><main>
<p class="status">${verdict}</p><h1>Test evidence</h1>
<p>Generated ${generatedAt} — commit <code>${escapeHtml(commit)}</code> — branch <code>${escapeHtml(branch)}</code></p>
<table><thead><tr><th>Tests</th><th>Failures</th><th>Errors</th><th>Skipped</th><th>Reports</th></tr></thead>
<tbody><tr><td>${totals.tests}</td><td>${totals.failures}</td><td>${totals.errors}</td><td>${totals.skipped}</td><td>${junitFiles.length}</td></tr></tbody></table>
<p><a href="summary.md">Markdown summary</a></p>
<h2>Screenshots</h2><div class="grid">${shots.map((name) => `<figure><a href="screenshots/${name}"><img src="screenshots/${name}" alt="${escapeHtml(name)}"></a><figcaption>${escapeHtml(name)}</figcaption></figure>`).join('')}</div>
<h2>Scope</h2><p>${escapeHtml(conclusion)}</p>
</main></body></html>`

  writeFileSync(join(evidenceDir, 'summary.md'), summary)
  writeFileSync(join(evidenceDir, 'index.html'), html)
  return { totals, status, shots, verdict }
}

// ------------------------------------------------------------------- change

const copyBundle = (destination) => {
  mkdirSync(dirname(destination), { recursive: true })
  cpSync(evidenceDir, destination, { recursive: true, force: true })
}

const startChange = () => {
  const specPath = join(root, 'specs', 'changes', `${slug}.md`)
  if (!existsSync(specPath)) fail(`No change spec at specs/changes/${slug}.md. Copy specs/change-spec-template.md first.`)
  if (values.run) runEvidenceCommand()
  const bundle = buildBundle()
  rmSync(changeDir, { recursive: true, force: true })
  mkdirSync(changeDir, { recursive: true })
  copyBundle(join(changeDir, 'before', 'evidence'))
  writeFileSync(join(changeDir, 'change-state.json'), JSON.stringify({
    schema: 1,
    slug,
    startedAt: new Date().toISOString(),
    specPath: relative(root, specPath).replaceAll('\\', '/'),
    git: { commit: git(['rev-parse', 'HEAD']), branch: git(['branch', '--show-current']) },
    beforeSnapshot: snapshotWorkspace(),
  }, null, 2))
  return bundle
}

const finishChange = () => {
  const statePath = join(changeDir, 'change-state.json')
  if (!existsSync(statePath)) fail(`No recorded start for "${slug}". Run --phase start before changing any file.`)
  const state = readJson(statePath, null)
  if (!state || state.slug !== slug) fail('The recorded state does not match the requested change.')

  if (values.run) runEvidenceCommand()
  const bundle = buildBundle()
  copyBundle(join(changeDir, 'after', 'evidence'))

  const changes = compareSnapshots(state.beforeSnapshot, snapshotWorkspace())
  const changedCount = changes.added.length + changes.modified.length + changes.deleted.length
  const testFiles = [...changes.added, ...changes.modified].filter(isTestFile).sort()
  const status = changeStatus({ evidenceComplete: bundle.status.complete, changedCount })

  const spec = readFileSync(join(root, state.specPath), 'utf8')
  const criteria = extractSection(spec, 'Acceptance criteria')
  const scenarios = extractSection(spec, 'Expected proof scenarios')

  const shotsIn = (side) => {
    const dir = join(changeDir, side, 'evidence', 'screenshots')
    return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.png')).sort() : []
  }
  const before = new Set(shotsIn('before'))
  const after = new Set(shotsIn('after'))
  const names = [...new Set([...before, ...after])].sort()

  const verdict = status.compliant ? 'CHANGE CONFORM' : 'CHANGE INCOMPLETE'
  const finishedAt = new Date().toISOString()
  const kinds = [
    ...changes.added.map((f) => ['Added', f]),
    ...changes.modified.map((f) => ['Modified', f]),
    ...changes.deleted.map((f) => ['Deleted', f]),
  ]

  writeFileSync(join(changeDir, 'change-summary.md'), `# Change report — ${slug}

| Field | Value |
| --- | --- |
| Status | **${verdict}** |
| Started | ${state.startedAt} |
| Finished | ${finishedAt} |
| Start commit | \`${state.git.commit ?? 'unavailable'}\` |
| Current commit | \`${git(['rev-parse', 'HEAD'], 'unavailable')}\` |
| Spec | \`${state.specPath}\` |
| After-proof | ${bundle.verdict} |

## Changed files (${changedCount})

${kinds.length ? kinds.map(([kind, file]) => `- **${kind}** — \`${file}\``).join('\n') : '- None detected.'}

## Tests added or modified

${testFiles.length ? testFiles.map((f) => `- \`${f}\``).join('\n') : '- None. A behaviour change with no test change needs a stated reason.'}

## Acceptance criteria

${criteria.length ? criteria.map((c) => `- ${c}`).join('\n') : '- The spec declares none under `## Acceptance criteria`.'}

## Expected proof scenarios

${scenarios.length ? scenarios.map((s) => `- ${s}`).join('\n') : '- The spec declares none under `## Expected proof scenarios`.'}

## Before / after screenshots

${names.length ? names.map((n) => `- ${n}: ${before.has(n) ? `[before](before/evidence/screenshots/${n})` : 'before: not applicable'} · ${after.has(n) ? `[after](after/evidence/screenshots/${n})` : 'after: missing'}`).join('\n') : '- None collected.'}

## Conclusion

${status.compliant
  ? 'The after-proof is complete and the changed files are identified. The human review of the visual comparison stays required.'
  : `Not conform: ${status.reasons.join('; ')}.`}
`)

  const cards = names.map((name) => `<section class="cmp"><h3>${escapeHtml(name)}</h3><div>
${before.has(name) ? `<figure><img src="before/evidence/screenshots/${name}" alt="Before — ${escapeHtml(name)}"><figcaption>Before</figcaption></figure>` : '<figure class="missing"><p>New proof: no before capture</p><figcaption>Before — not applicable</figcaption></figure>'}
${after.has(name) ? `<figure><img src="after/evidence/screenshots/${name}" alt="After — ${escapeHtml(name)}"><figcaption>After</figcaption></figure>` : '<figure class="missing"><p>After capture missing</p><figcaption>After — missing</figcaption></figure>'}
</div></section>`).join('')

  writeFileSync(join(changeDir, 'index.html'), `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>Change report — ${escapeHtml(slug)}</title><style>
body{margin:0;background:#070a12;color:#fff;font:16px/1.5 system-ui,sans-serif}main{max-width:1400px;margin:auto;padding:48px 24px}a{color:#60a5fa}
.status{display:inline-block;padding:8px 12px;border-radius:8px;font-weight:800;background:${status.compliant ? '#164e2b' : '#7f1d1d'}}
code{color:#f5b942}.files{columns:2}.cmp{margin:32px 0}.cmp>div{display:grid;grid-template-columns:1fr 1fr;gap:20px}
figure{margin:0;padding:12px;background:#0d1220;border:1px solid #25304a;border-radius:12px}
figure.missing{min-height:220px;display:grid;place-items:center;color:#929cb2}
img{width:100%;max-height:620px;object-fit:contain;background:#151c2f}figcaption{padding-top:8px;font-weight:700}
@media(max-width:760px){.cmp>div{grid-template-columns:1fr}.files{columns:1}}
</style></head><body><main>
<p class="status">${verdict}</p><h1>Change report — ${escapeHtml(slug)}</h1>
<p>From ${state.startedAt} to ${finishedAt}. Spec <code>${escapeHtml(state.specPath)}</code>.</p>
<h2>Changed files (${changedCount})</h2><ul class="files">${kinds.map(([kind, file]) => `<li><strong>${kind}</strong> — <code>${escapeHtml(file)}</code></li>`).join('') || '<li>None detected</li>'}</ul>
<h2>Tests added or modified</h2><ul>${testFiles.map((f) => `<li><code>${escapeHtml(f)}</code></li>`).join('') || '<li>None</li>'}</ul>
<p><a href="after/evidence/index.html">Full after-proof</a> · <a href="change-summary.md">Markdown summary</a></p>
<h2>Visual comparison</h2>${cards || '<p>No screenshots collected.</p>'}
</main></body></html>`)

  return { bundle, status, changedCount, testFiles, verdict }
}

// -------------------------------------------------------------------- entry

if (phase === 'start') {
  const bundle = startChange()
  if (values.json) console.log(JSON.stringify({ schema: 1, mode: 'start', slug, status: bundle.verdict, reasons: bundle.status.reasons }, null, 2))
  else console.log(`Before-proof recorded for "${slug}" (${bundle.verdict}).\n${join(changeDir, 'before', 'evidence', 'index.html')}`)
  if (values.strict && !bundle.status.complete) process.exit(1)
} else if (phase === 'finish') {
  const result = finishChange()
  if (values.json) {
    console.log(JSON.stringify({
      schema: 1, mode: 'finish', slug, status: result.verdict, reasons: result.status.reasons,
      changedFiles: result.changedCount, testFiles: result.testFiles,
    }, null, 2))
  } else {
    console.log(`${result.verdict}: ${result.changedCount} changed file(s), ${result.testFiles.length} test file(s).`)
    console.log(join(changeDir, 'index.html'))
  }
  if (!result.status.compliant) process.exit(1)
} else {
  if (values.run) runEvidenceCommand()
  const bundle = buildBundle()
  if (values.json) {
    console.log(JSON.stringify({ schema: 1, mode: 'bundle', status: bundle.verdict, reasons: bundle.status.reasons, ...bundle.totals, screenshots: bundle.shots.length }, null, 2))
  } else {
    console.log(`${bundle.verdict}: ${bundle.totals.tests} test(s), ${bundle.totals.failures + bundle.totals.errors} failure(s), ${bundle.shots.length} screenshot(s).`)
    console.log(join(evidenceDir, 'index.html'))
  }
  if (values.strict && !bundle.status.complete) process.exit(1)
}
