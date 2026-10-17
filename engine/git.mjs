// git.mjs — the tag of the compass checkout, its submodule state, and `ac sync --to <tag>`.
// Every git call runs through run(): a timeout, GIT_TERMINAL_PROMPT=0 and ssh BatchMode.

import { realpathSync } from 'node:fs'
import { relative, sep } from 'node:path'
import { below, run, versionCmp } from './util.mjs'

const TAG = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/

// A vendored copy inside the project repo must not report the project's tag.
const ownCheckout = (AC) => {
  const top = run('git', ['-C', AC, 'rev-parse', '--show-toplevel'], { timeout: 10_000 })
  return top.ok && realpathSync.native(top.out) === realpathSync.native(AC)
}

export const tagOf = (AC) => {
  if (!ownCheckout(AC)) return null
  const r = run('git', ['-C', AC, 'describe', '--tags', '--exact-match', 'HEAD'], { timeout: 10_000 })
  return r.ok ? r.out : null
}

// The newest local release tag (x.y.z or vx.y.z) of the compass checkout when it is newer than version, else null.
export const newerTag = (AC, version) => {
  if (!ownCheckout(AC)) return null
  const r = run('git', ['-C', AC, 'tag', '--list', '--sort=-v:refname'], { timeout: 10_000 })
  const tag = r.ok ? r.out.split('\n').find((t) => /^v?\d+\.\d+\.\d+$/.test(t)) : undefined
  return tag && versionCmp(tag, version) > 0 ? tag : null
}

// The path of the compass submodule when the project records another commit for it than the one checked out, else null.
export const submoduleMoved = (root, AC) => {
  const [top, ac] = [root, AC].map((p) => realpathSync.native(p))
  if (!below(top, ac)) return null
  const rel = relative(top, ac).split(sep).join('/')
  const r = run('git', ['-C', root, 'submodule', 'status', '--', rel], { timeout: 10_000 })
  return r.ok && r.out.startsWith('+') ? rel : null
}

// Move the compass submodule to a release tag. The caller then syncs with the engine of that tag.
export const pinTag = (AC, tag, { dry = false } = {}) => {
  if (!TAG.test(tag) || tag.includes('..')) return { ok: false, error: `"${tag}" is not a valid tag name` }
  if (!ownCheckout(AC)) return { ok: false, error: `${AC} is not its own git checkout; --to needs compass as a git submodule` }
  const status = run('git', ['-C', AC, 'status', '--porcelain'])
  if (!status.ok || status.out) return { ok: false, error: 'the compass checkout has local changes; commit or discard them first' }
  const resolve = () => run('git', ['-C', AC, 'rev-parse', '--verify', '--quiet', `refs/tags/${tag}^{commit}`])
  const noEngine = (commit) => !run('git', ['-C', AC, 'cat-file', '-e', `${commit}:bin/ac.mjs`]).ok
  const engineError = { ok: false, error: `tag ${tag} has no bin/ac.mjs; it is older than the compass 1.0 engine` }
  if (dry) {
    const local = resolve()
    if (local.ok && noEngine(local.out)) return engineError
    return { ok: true, message: `would fetch tags and check out ${tag} in ${AC}` }
  }
  const fetched = run('git', ['-C', AC, 'fetch', '--tags', '--quiet'], { timeout: 60_000 })
  const commit = resolve()
  if (!commit.ok) return { ok: false, error: `tag ${tag} not found${fetched.ok ? '' : `; fetch failed: ${fetched.err}`}` }
  if (noEngine(commit.out)) return engineError
  const checkout = run('git', ['-C', AC, '-c', 'advice.detachedHead=false', 'checkout', '--quiet', '--detach', commit.out])
  if (!checkout.ok) return { ok: false, error: `checkout of ${tag} failed: ${checkout.err}` }
  return { ok: true, message: `compass is at ${tag}; commit the submodule change in the project` }
}
