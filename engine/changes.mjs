// changes.mjs — the OpenSpec change checks of `ac check` that `openspec validate` does not make.
// Ported from the StoryArc host, where each one caught a real slip (2026-09 to 2026-10). Read only.
//
// - A change whose tasks are all ticked is announced as ready, but `[~]` partials are in no
//   count: a change with no `[ ]` left and some `[~]` reads as finished while it is not.
// - A change with every task ticked and still in changes/ is work nobody archived.
// - A MODIFIED delta replaces its requirement's whole block on archive. A requirement that is in
//   no main spec cannot be merged, and a main-spec scenario the delta omits is dropped.

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isDir, walk } from './util.mjs'

const read = (path) => { try { return readFileSync(path, 'utf8') } catch { return null } }

// Done, open and partial task lines, with the bullet and indent OpenSpec accepts.
export const countTasks = (text) => {
  const tally = { done: 0, open: 0, partial: 0 }
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*[-*]\s*\[ \]/.test(line)) tally.open += 1
    else if (/^\s*[-*]\s*\[[xX]\]/.test(line)) tally.done += 1
    else if (/^\s*[-*]\s*\[~\]/.test(line)) tally.partial += 1
  }
  return tally
}

// The requirements under one `## <kind> Requirements` heading: name → the scenario names.
export const requirements = (text, kind) => {
  const out = new Map()
  let inKind = !kind
  let current = null
  for (const line of text.split(/\r?\n/)) {
    const section = /^##\s+(\w+)\s+Requirements\b/i.exec(line)
    if (section || /^##\s/.test(line)) { inKind = !kind || (section && section[1].toUpperCase() === kind); current = null; continue }
    if (!inKind) continue
    const req = /^###\s+Requirement:\s*(.+?)\s*$/.exec(line)
    if (req) { current = req[1]; out.set(current, []); continue }
    const scenario = /^####\s+Scenario:\s*(.+?)\s*$/.exec(line)
    if (scenario && current) out.get(current).push(scenario[1])
  }
  return out
}

export const checkChanges = (root, paths, out) => {
  const dir = join(root, paths.openspec, 'changes')
  if (!isDir(dir)) return
  for (const change of readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory() && e.name !== 'archive').map((e) => e.name).sort()) {
    const at = `${paths.openspec}/changes/${change}`
    const tasks = read(join(dir, change, 'tasks.md'))
    if (tasks !== null) {
      const { done, open, partial } = countTasks(tasks)
      if (!open && partial) out.warnings.push(`${at}: no task is open and ${partial} are partial ([~]), so the change reads as ready while it is ${done} of ${done + partial} done; finish the partials or split each into a ticked task and an open one`)
      else if (!open && done) out.warnings.push(`${at}: every task is ticked; verify the change and archive it`)
    }
    for (const rel of walk(join(dir, change, 'specs')).filter((f) => f.endsWith('/spec.md'))) {
      const capability = rel.slice(0, -'/spec.md'.length)
      const modified = requirements(read(join(dir, change, 'specs', rel)) || '', 'MODIFIED')
      if (!modified.size) continue
      const main = read(join(root, paths.openspec, 'specs', capability, 'spec.md'))
      const current = main === null ? new Map() : requirements(main)
      for (const [name, scenarios] of modified) {
        if (!current.has(name)) { out.errors.push(`${at}/specs/${rel}: MODIFIED "${name}" is in no main spec ${paths.openspec}/specs/${capability}/spec.md, so the archive has nothing to replace`); continue }
        const dropped = current.get(name).filter((s) => !scenarios.includes(s))
        if (dropped.length) out.warnings.push(`${at}/specs/${rel}: MODIFIED "${name}" omits the scenario(s) ${dropped.map((s) => `"${s}"`).join(', ')}, which the archive drops; carry them or move them to REMOVED`)
      }
    }
  }
}
