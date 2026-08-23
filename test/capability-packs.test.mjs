import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { rootCapabilitySkills } from '../scripts/lib/capability-packs.mjs'
import { referenceSources, stageExternalSkills } from '../scripts/lib/external-install.mjs'
import { readSourceRegistry } from '../scripts/lib/upstream-sources.mjs'

const AC = new URL('..', import.meta.url).pathname
const COMMIT = '0365f57a079b1332f95cf26e31dd2d5332a8399f'

// The whole curated corpus, staged exactly as an install would write it. This is
// the guarantee that used to be checked against vendored files: Agent Compass no
// longer stores these skills, so the hardening is asserted on install output.
const installed = (() => {
  const source = referenceSources(readSourceRegistry(AC))['devops-security']
  const { staged, skipped } = stageExternalSkills({
    id: 'devops-security',
    source,
    names: rootCapabilitySkills(),
  })
  return {
    source,
    skipped,
    text: new Map(staged.map(({ name, payload }) => [name, payload.get('SKILL.md').toString('utf8')])),
    files: new Map(staged.map(({ name, payload }) => [name, [...payload.keys()].sort()])),
  }
})()

test('the curated operational corpus is tracked, never stored here', () => {
  const names = rootCapabilitySkills()
  assert.equal(names.length, 146)
  assert.equal(new Set(names).size, 146)
  assert.equal(installed.source.commit, COMMIT)
  for (const name of names) {
    assert.equal(
      existsSync(join(AC, 'skills', name, 'SKILL.md')),
      false,
      `skills/${name} must not be vendored — it is installed from the pin`,
    )
  }
})

test('every installed operational skill is knowledge-only, hardened, and attributable', () => {
  for (const name of rootCapabilitySkills()) {
    const text = installed.text.get(name)
    assert.ok(text, `${name}: nothing installed`)

    // Prose only. An executable payload is refused by default, so a skill that
    // ships one arrives without it and the refusal is reported.
    for (const file of installed.files.get(name)) {
      assert.match(file, /\.(md|markdown|txt|json|ya?ml|toml)$/i, `${name}: installed a non-prose file ${file}`)
    }

    assert.match(text, /^license: MIT$/m, `${name}: missing upstream license`)
    assert.match(text, /^risk_level: (medium|high)$/m, `${name}: invalid risk level`)
    assert.match(text, /^writes_files: true$/m, `${name}: invalid writes_files`)
    assert.match(text, /^requires_tools: \[\]$/m, `${name}: invalid requires_tools`)
    assert.match(text, new RegExp(`^source_commit: ${COMMIT}$`, 'm'), `${name}: missing pinned source`)
    assert.match(text, /## Agent Compass safety gate/, `${name}: missing safety gate`)
    assert.match(text, /Never deploy, delete, rotate credentials, fail over, contain, or write to production without explicit approval/, `${name}: unsafe mutation rule missing`)
    assert.match(text, /## Provenance/, `${name}: missing provenance`)
    assert.match(text, /Original content © 2026 Toby Miller, used under the MIT License/, `${name}: missing attribution`)
    assert.doesNotMatch(text, /\]\(\.\.?\//, `${name}: upstream-relative link is not standalone`)
  }
})

test('executable payloads are refused rather than silently installed', () => {
  // Reported, not dropped quietly: a caller has to know what was withheld.
  for (const path of installed.skipped) {
    assert.doesNotMatch(path, /\.(md|markdown|txt|json|ya?ml|toml)$/i, `${path} is prose and should not be skipped`)
  }
})
