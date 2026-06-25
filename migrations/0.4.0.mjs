// 0.4.0 — ignore sync conflict files and the update-check cache.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export default {
  version: '0.4.0',
  describe: 'Ignore sync conflicts (*.acnew) and update-check cache in .gitignore.',
  apply({ host, log }) {
    const gitignore = join(host, '.gitignore')
    const wanted = ['*.acnew', '.agent/.update-check.json']
    const text = existsSync(gitignore) ? readFileSync(gitignore, 'utf8') : ''
    const have = new Set(text.split(/\r?\n/).map((entry) => entry.trim()))
    const missing = wanted.filter((line) => !have.has(line))
    if (!missing.length) return
    const prefix = text && !text.endsWith('\n') ? '\n' : ''
    writeFileSync(gitignore, `${text}${prefix}\n# agent-compass runtime\n${missing.join('\n')}\n`)
    log(`added ${missing.join(', ')} to .gitignore`)
  },
}
