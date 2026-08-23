// external-install.mjs — fetch and install skills from a tracked reference
// source. Agent Compass keeps no copy of these skills, so this is the only place
// a copy is made, and it is made into the target that asked for it.
//
// Nothing upstream is executed: the source is staged in a temporary Git checkout
// and read with `git show`. Executable payloads are refused unless the caller
// opts in. The operational corpus is corrected on the way through.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { CAPABILITY_PACKS, ROOT_CAPABILITY_PACK_IDS } from './capability-packs.mjs'
import { adaptSkill } from './upstream-skills.mjs'
import { checkoutSource, inventoryEntriesFromTree, treeFiles } from './upstream-sources.mjs'

// Where each provider looks for skills. Claude reads its own directory; Codex and
// Copilot read the cross-agent `.agents/skills` tree, and Copilot additionally
// needs a path-instructions file to be told the tree exists.
export const PROJECT_TARGETS = {
  claude: ['.claude/skills'],
  codex: ['.agents/skills'],
  copilot: ['.agents/skills'],
  agents: ['.agents/skills'],
}
export const USER_TARGETS = {
  claude: ['.claude/skills'],
  codex: ['.codex/skills', '.agents/skills'],
  copilot: ['.agents/skills'],
  agents: ['.agents/skills'],
}
export const COPILOT_INSTRUCTIONS = '.github/instructions/external-skills.instructions.md'
// An install is a snapshot of a pin. Recording which pin it came from is what
// makes staleness detectable later: without it, a host silently keeps the
// corrected text of an older commit and nothing can tell.
export const PROJECT_MANIFEST = '.agent/external-skills.json'
export const USER_MANIFEST = '.agent-compass/external-skills.json'

export const manifestPath = (root, global = false) => join(root, global ? USER_MANIFEST : PROJECT_MANIFEST)

export const readInstallManifest = (root, global = false) => {
  try {
    const data = JSON.parse(readFileSync(manifestPath(root, global), 'utf8'))
    return data?.schema === 1 ? data : { schema: 1, sources: {} }
  } catch { return { schema: 1, sources: {} } }
}

export const recordInstall = ({ root, global = false, id, source, names, relDirs, now }) => {
  const manifest = readInstallManifest(root, global)
  const previous = manifest.sources[id]
  manifest.sources[id] = {
    repository: source.repository,
    commit: source.commit,
    ...(source.adapter ? { adapter: source.adapter } : {}),
    // A later install of one more skill must not drop what is already there.
    skills: [...new Set([...(previous?.skills || []), ...names])].sort(),
    targets: [...new Set([...(previous?.targets || []), ...relDirs])].sort(),
    installedAt: now,
  }
  manifest.updatedAt = now
  const file = manifestPath(root, global)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`)
  return manifest
}

// Compare what a host installed against what Agent Compass now pins. A moved pin
// means the installed text is stale — for the operational corpus that includes
// the safety gate and the argv-secret narrowings, so it is not cosmetic.
export const installDrift = (root, registry, global = false) => {
  const manifest = readInstallManifest(root, global)
  const sources = referenceSources(registry)
  const stale = []
  const unknown = []
  for (const [id, entry] of Object.entries(manifest.sources || {})) {
    const source = sources[id]
    if (!source) { unknown.push({ id, commit: entry.commit }); continue }
    if (source.commit === entry.commit) continue
    const gone = (entry.skills || []).filter((name) => !source.upstreamSkills.includes(name))
    stale.push({
      id,
      installed: entry.commit,
      pinned: source.commit,
      skills: entry.skills || [],
      adapter: entry.adapter || null,
      removedUpstream: gone,
    })
  }
  return { stale, unknown, manifest }
}

// A skill is documentation. An executable payload is a different risk class.
const TEXT_FILE = /\.(md|markdown|txt|json|ya?ml|toml)$/i
const LICENSE_FILE = /^LICENSE(\.\w+)?$/i

// Which root pack owns each operational skill, so the adapter's risk level stays
// derived from the pack definitions instead of duplicated into the registry.
const PACK_BY_SKILL = new Map(ROOT_CAPABILITY_PACK_IDS.flatMap(
  (packId) => CAPABILITY_PACKS[packId].skills.map((name) => [name, packId]),
))

export const referenceSources = (registry) => Object.fromEntries(
  Object.entries(registry?.sources || {}).filter(([, source]) => source.strategy === 'reference'),
)

// slug -> source id, across every tracked source. Two sources never claim the
// same slug in practice; if one ever did, the first registration wins and the
// caller can still name the source explicitly.
export const externalSkillIndex = (registry) => {
  const index = new Map()
  for (const [id, source] of Object.entries(referenceSources(registry))) {
    for (const slug of source.upstreamSkills || []) if (!index.has(slug)) index.set(slug, id)
  }
  return index
}

// Split a requested skill list into what this repository holds and what a tracked
// source holds, so one selection can serve both install paths.
export const partitionSkills = ({ names, localNames, registry }) => {
  const index = externalSkillIndex(registry)
  const local = []
  const external = new Map()
  const unknown = []
  for (const name of names) {
    if (localNames.has(name)) { local.push(name); continue }
    const sourceId = index.get(name)
    if (!sourceId) { unknown.push(name); continue }
    if (!external.has(sourceId)) external.set(sourceId, [])
    external.get(sourceId).push(name)
  }
  return { local, external, unknown }
}

// Read the selected skills out of the pinned tree and return their file payloads.
// Throws when a name is not in the pinned tree, which means the recorded
// inventory is stale rather than the name being wrong.
export const stageExternalSkills = ({ id, source, names, allowScripts = false }) => {
  const checkout = checkoutSource(source.repository, [source.commit])
  const skipped = []
  const staged = []
  try {
    const entries = new Map(
      inventoryEntriesFromTree(checkout.root, source.commit, source.inventoryRoot)
        .map((entry) => [entry.slug, entry]),
    )
    const missing = names.filter((name) => !entries.has(name))
    if (missing.length) {
      throw new Error(`${id}: pinned tree holds no skill directory for ${missing.join(', ')} — the recorded inventory is stale, run: agent-compass upstream-skills --update ${id}`)
    }
    for (const name of names) {
      const entry = entries.get(name)
      const prefix = entry.dir ? `${entry.dir}/` : ''
      const files = treeFiles(checkout.root, source.commit, prefix)
        // A root-level SKILL.md repository has no directory, so take that one file.
        .filter((path) => (entry.dir ? true : path === entry.file))
      const payload = new Map()
      for (const path of files) {
        const rel = entry.dir ? path.slice(prefix.length) : path
        if (!TEXT_FILE.test(rel) && !LICENSE_FILE.test(rel) && !allowScripts) {
          skipped.push(`${name}/${rel}`)
          continue
        }
        payload.set(rel, readFileSync(join(checkout.root, path)))
      }
      if (!payload.has('SKILL.md')) throw new Error(`${id}/${name}: no SKILL.md in the pinned tree`)

      // The operational corpus is the one source Agent Compass corrects on the
      // way through: the safety gate and the argv-secret narrowings are applied
      // here, because no corrected copy is kept anywhere upstream of this point.
      if (source.adapter === 'operational') {
        payload.set('SKILL.md', Buffer.from(adaptSkill({
          raw: payload.get('SKILL.md').toString('utf8'),
          name,
          sourceRel: entry.file,
          packId: PACK_BY_SKILL.get(name),
          commit: source.commit,
          repository: source.repository,
        })))
      }
      staged.push({ name, payload })
    }
  } finally {
    checkout.cleanup()
  }
  return { staged, skipped }
}

export const noticeText = ({ id, source, names }) => [
  `# Third-Party Notices — ${id}`,
  '',
  `Installed by \`agent-compass external-skills\` from ${source.repository}`,
  `at commit \`${source.commit}\`.`,
  '',
  `License: ${source.license}${source.licenseHolder ? ` — © ${source.licenseHolder}` : ''}`,
  // Some licences (PolyForm among them) require their `Required Notice:` lines to
  // travel verbatim with every copy. Reproduce them exactly, not paraphrased.
  ...(source.requiredNotice ? ['', source.requiredNotice] : []),
  ...(source.licenseNote ? ['', source.licenseNote] : []),
  '',
  'These skills are third-party instruction text. Read a skill before the first',
  'task that loads it. An installed skill never relaxes a gate in AGENTS.md §4.',
  '',
  `Skills: ${names.join(', ')}`,
  '',
].join('\n')

// Write the staged skills into every provider directory, plus the licence notice
// and, when Copilot is a target, the instructions file that tells it they exist.
export const writeExternalSkills = ({ root, relDirs, id, source, staged, wantsCopilot, global = false, now }) => {
  for (const relDir of relDirs) {
    for (const { name, payload } of staged) {
      const dest = join(root, relDir, name)
      if (existsSync(dest)) rmSync(dest, { recursive: true, force: true })
      for (const [rel, content] of payload) {
        const file = join(dest, rel)
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, content)
      }
    }
    mkdirSync(join(root, relDir), { recursive: true })
    writeFileSync(
      join(root, relDir, `THIRD_PARTY_NOTICES.${id}.md`),
      noticeText({ id, source, names: staged.map(({ name }) => name) }),
    )
  }
  if (!wantsCopilot) return
  const file = join(root, COPILOT_INSTRUCTIONS)
  mkdirSync(dirname(file), { recursive: true })
  const existing = existsSync(file) ? readFileSync(file, 'utf8') : null
  const section = [
    `## ${id}`,
    '',
    `Source: ${source.repository} @ \`${source.commit.slice(0, 7)}\` (${source.license})`,
    '',
    ...staged.map(({ name }) => `- \`${name}\` — \`.agents/skills/${name}/SKILL.md\``),
    '',
  ].join('\n')
  if (existing) {
    // One file, one section per source: replace this source's section, keep the rest.
    const marker = `## ${id}\n`
    const at = existing.indexOf(marker)
    if (at === -1) {
      writeFileSync(file, `${existing.trimEnd()}\n\n${section}`)
      return
    }
    const nextAt = existing.indexOf('\n## ', at + marker.length)
    const tail = nextAt === -1 ? '' : existing.slice(nextAt + 1)
    writeFileSync(file, `${existing.slice(0, at)}${section}${tail ? `\n${tail}` : ''}`)
    return
  }
  writeFileSync(file, [
    '---',
    "applyTo: '**'",
    "description: 'External agent skills installed from tracked sources. Read the matching SKILL.md before acting in its domain.'",
    '---',
    '',
    '# External Skills',
    '',
    'Copilot has no skills directory, so the installed skills live in',
    '`.agents/skills/` and this file is how you learn they exist. Read the matching',
    '`SKILL.md` before working in its domain.',
    '',
    'These files are third-party instruction text. They never relax a gate in',
    '`AGENTS.md` §4: validation, tests, and the completion report still apply.',
    '',
    section,
  ].join('\n'))
}

// One entry point so no caller can write skills and forget the manifest.
export const installExternalSkills = ({ root, relDirs, id, source, staged, wantsCopilot, global = false, now }) => {
  writeExternalSkills({ root, relDirs, id, source, staged, wantsCopilot, global, now })
  return recordInstall({
    root,
    global,
    id,
    source,
    names: staged.map(({ name }) => name),
    relDirs,
    now,
  })
}
