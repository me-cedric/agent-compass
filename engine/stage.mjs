// stage.mjs — `ac init --from-specs <dir>`: create the Konvoy docs layout and copy the input documents into
// the OpenSpec inbox (docs/contract/ownership.md). It never deletes or overwrites a file.

import { existsSync, mkdirSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { projectPaths, SCHEMA } from './config.mjs'
import { questionsDir, SCREENS_SEED, screensFile } from './docs.mjs'
import { outside } from './sync.mjs'
import { isDir, walk, writeNew } from './util.mjs'

export const inboxDir = (paths) => `${paths.openspec}/inbox`

const hidden = (rel) => /(^|\/)\./.test(rel)

export const stageSpecs = ({ AC, root, input, apply }) => {
  const fail = (errors) => ({ ok: false, changes: [], errors, warnings: [] })
  const { paths, errors } = projectPaths(root, AC)
  if (errors.length) return fail(errors)
  const src = resolve(input)
  const st = statSync(src, { throwIfNoEntry: false })
  if (!st || !(st.isDirectory() || st.isFile())) return fail([`${input} is not a file or a folder`])
  const real = realpathSync(src)
  const top = realpathSync(root)
  if (top === real || top.startsWith(`${real}/`)) return fail([`${input} holds the project; give the folder of the input documents`])
  const inbox = `${join(top, inboxDir(paths))}/`
  if (`${real}/`.startsWith(inbox) || inbox.startsWith(`${real}/`)) return fail([`${input} holds ${inboxDir(paths)} or is in it; give another folder`])

  const staged = `${inboxDir(paths)}/${basename(src)}`
  const dirsToMake = [`${paths.openspec}/changes`, `${paths.openspec}/specs`, questionsDir(paths), paths.adr, paths.designs].filter((d) => !isDir(join(root, d)))
  const seeds = [[screensFile(paths), SCREENS_SEED], [`${paths.openspec}/config.yaml`, `schema: ${SCHEMA}\n`]]
  const writes = seeds.filter(([rel]) => !existsSync(join(root, rel))).map(([rel, text]) => [rel, Buffer.from(text), 'create'])
  const docs = st.isFile() ? [[src, staged]] : walk(src).filter((f) => !hidden(f)).map((f) => [join(src, f), `${staged}/${f}`])
  const clashes = []
  for (const [from, rel] of docs) {
    const content = readFileSync(from)
    const have = statSync(join(root, rel), { throwIfNoEntry: false })
    if (!have) writes.push([rel, content, 'stage'])
    else if (!have.isFile() || !readFileSync(join(root, rel)).equals(content)) clashes.push(`${rel} exists with other content; compass does not overwrite it`)
  }
  const unsafe = writes.map(([rel]) => rel).filter((rel) => outside(root, rel))
  if (clashes.length || unsafe.length) return fail([...clashes, ...unsafe.map((rel) => `${rel} is a symlink or leaves the project root; compass does not write it`)])
  if (apply) {
    for (const dir of dirsToMake) mkdirSync(join(root, dir), { recursive: true })
    for (const [rel, content] of writes) writeNew(root, rel, content)
  }
  const warnings = docs.length ? [] : [`${input} has no documents to stage`]
  if (!apply && dirsToMake.length) warnings.push('the dry run does not show the files that the sync installs in the new dirs, for example the OpenSpec schema')
  return {
    ok: true,
    errors: [],
    warnings,
    changes: [...dirsToMake.map((path) => ({ action: 'mkdir', path })), ...writes.map(([path, , action]) => ({ action, path }))],
    staged,
    next: `Next: run the spec-flow skill on ${staged}. It runs grill first, then writes the proposal and the specs.`,
  }
}

