// evidence.mjs — pure helpers for the test-evidence bundle and the before/after
// change report. Everything here is a function of its arguments so the CLI in
// scripts/evidence.mjs stays a thin shell around them.

// Excluded everywhere: from the discovery walk and from the change snapshot.
// A dot-directory that is not listed here is still walked, so a change under
// .github or .claude counts as a change.
export const DEFAULT_EXCLUDED_DIRS = [
  '.agent', '.cache', '.git', '.gradle', '.idea', '.mypy_cache', '.next', '.nuxt',
  '.pytest_cache', '.svelte-kit', '.turbo', '.venv', '.vscode',
  'artifacts', 'build', 'coverage', 'dist', 'node_modules', 'out',
  'playwright-report', 'storybook-static', 'target', 'test-results', 'vendor',
]

export const DEFAULT_EXCLUDED_FILES = ['.env', '.env.local', '.DS_Store']

// A slug names a directory under .agent/evidence/changes, so keep it boring.
export const isSlug = (value) => typeof value === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)

// Read the opening <testsuites> (or <testsuite>) tag. Every runner writes those
// counts on it, so there is no reason to parse the body.
export const parseJunit = (xml) => {
  const tag = xml.match(/<testsuites?\b[^>]*>/)?.[0] ?? ''
  const number = (name) => Number(tag.match(new RegExp(`${name}="(\\d+)"`))?.[1] ?? 0)
  return { tests: number('tests'), failures: number('failures'), errors: number('errors'), skipped: number('skipped') }
}

export const sumJunit = (results) => results.reduce(
  (total, r) => ({
    tests: total.tests + r.tests,
    failures: total.failures + r.failures,
    errors: total.errors + r.errors,
    skipped: total.skipped + r.skipped,
  }),
  { tests: 0, failures: 0, errors: 0, skipped: 0 },
)

// The `evidence` key of agent-compass.commands.json, normalised. Every field is
// optional: a project with no key still gets a bundle, it just claims less.
export const evidenceConfig = (commands = {}) => {
  const raw = commands.evidence ?? {}
  const list = (value) => (Array.isArray(value) ? value : value ? [value] : [])
  return {
    command: typeof raw.command === 'string' ? raw.command : commands.check || commands.test || null,
    junit: list(raw.junit),
    screenshots: list(raw.screenshots),
    reports: list(raw.reports),
    expectScreenshots: Number.isInteger(raw.expectScreenshots) ? raw.expectScreenshots : 0,
  }
}

// A bundle is complete when nothing failed and the promised screenshots exist.
// A missing junit file is not "zero failures", it is an unproven claim.
export const bundleStatus = ({ totals, junitCount, screenshotCount, expectScreenshots }) => {
  const reasons = []
  if (junitCount === 0) reasons.push('no test report found')
  if (totals.failures + totals.errors > 0) reasons.push(`${totals.failures + totals.errors} failure(s)/error(s)`)
  if (screenshotCount < expectScreenshots) reasons.push(`${screenshotCount}/${expectScreenshots} expected screenshot(s)`)
  return { complete: reasons.length === 0, reasons }
}

// A change is conform when its after-proof is complete and it actually changed
// something. A green suite over an empty diff proves nothing about the change.
export const changeStatus = ({ evidenceComplete, changedCount }) => {
  const reasons = []
  if (!evidenceComplete) reasons.push('after-proof incomplete')
  if (changedCount === 0) reasons.push('no changed file detected')
  return { compliant: reasons.length === 0, reasons }
}

export const compareSnapshots = (before, after) => {
  const relevant = (file) => !file.endsWith('.tsbuildinfo')
  const beforeFiles = new Set(Object.keys(before).filter(relevant))
  const afterFiles = new Set(Object.keys(after).filter(relevant))
  return {
    added: [...afterFiles].filter((f) => !beforeFiles.has(f)).sort(),
    modified: [...afterFiles].filter((f) => beforeFiles.has(f) && before[f].sha256 !== after[f].sha256).sort(),
    deleted: [...beforeFiles].filter((f) => !afterFiles.has(f)).sort(),
  }
}

export const isTestFile = (file) => /(?:\.test\.|\.spec\.|(?:^|\/)tests?\/)/.test(file)

// The change spec is a machine contract: these headings are read literally.
export const extractSection = (markdown, heading) => {
  const lines = markdown.split(/\r?\n/)
  const start = lines.findIndex((line) => line.trim().toLowerCase() === `## ${heading}`.toLowerCase())
  if (start < 0) return []
  const items = []
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith('## ')) break
    if (/^[-*] /.test(line.trim())) items.push(line.trim().slice(2))
  }
  return items
}

export const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
