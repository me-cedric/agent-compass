import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

import { rootCapabilitySkills } from '../scripts/lib/capability-packs.mjs'

const AC = new URL('..', import.meta.url).pathname
const COMMIT = '0365f57a079b1332f95cf26e31dd2d5332a8399f'

test('imported operational skills are knowledge-only, hardened, and attributable', () => {
  const names = rootCapabilitySkills()
  assert.equal(names.length, 146)
  assert.equal(new Set(names).size, 146)

  for (const name of names) {
    const dir = join(AC, 'skills', name)
    // Prose plus the upstream MIT notice, and nothing else. The notice has to
    // travel with a redistributed copy; an executable asset still must not.
    assert.deepEqual(
      readdirSync(dir).sort(),
      ['LICENSE', 'SKILL.md'],
      `${name} must carry its notice and must not vendor executable assets`,
    )

    const text = readFileSync(join(dir, 'SKILL.md'), 'utf8')
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
