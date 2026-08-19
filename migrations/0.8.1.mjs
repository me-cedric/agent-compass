// 0.8.1 — widen the external skill-source cache pattern in .gitignore.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ANCHORED = '.agent/.upstream-source-check.json'
const WANTED = `**/${ANCHORED}`

export default {
  version: '0.8.1',
  describe: 'Match the external source cache at any depth in .gitignore.',
  apply({ host, log }) {
    const gitignore = join(host, '.gitignore')
    if (!existsSync(gitignore)) return
    const text = readFileSync(gitignore, 'utf8')
    const lines = text.split(/\r?\n/)

    // 0.7.10 wrote the anchored form. A pattern holding a slash is anchored to
    // the directory of the .gitignore, so it never matched the cache in a host
    // that vendors compass under docs/agent-compass/.
    let changed = false
    const next = lines.map((line) => {
      if (line.trim() !== ANCHORED) return line
      changed = true
      return WANTED
    })
    if (!changed) {
      if (next.some((line) => line.trim() === WANTED)) return
      const prefix = text && !text.endsWith('\n') ? '\n' : ''
      writeFileSync(gitignore, `${text}${prefix}\n# agent-compass runtime\n${WANTED}\n`)
      log(`added ${WANTED} to .gitignore`)
      return
    }
    writeFileSync(gitignore, next.join('\n'))
    log(`widened ${ANCHORED} to ${WANTED}`)
  },
}
