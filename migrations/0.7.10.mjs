// 0.7.10 — ignore the external skill-source update cache.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export default {
  version: '0.7.10',
  describe: 'Ignore the external skill-source update cache in .gitignore.',
  apply({ host, log }) {
    const gitignore = join(host, '.gitignore')
    const wanted = '.agent/.upstream-source-check.json'
    const text = existsSync(gitignore) ? readFileSync(gitignore, 'utf8') : ''
    const have = new Set(text.split(/\r?\n/).map((entry) => entry.trim()))
    if (have.has(wanted)) return
    const prefix = text && !text.endsWith('\n') ? '\n' : ''
    writeFileSync(gitignore, `${text}${prefix}\n# agent-compass runtime\n${wanted}\n`)
    log(`added ${wanted} to .gitignore`)
  },
}
