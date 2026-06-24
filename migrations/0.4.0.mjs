// 0.4.0 — sync writes <file>.acnew on conflict; make sure git ignores them.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

export default {
  version: '0.4.0',
  describe: 'Ignore sync conflict files (*.acnew) in .gitignore.',
  apply({ host, log }) {
    const gitignore = join(host, '.gitignore')
    const line = '*.acnew'
    const text = existsSync(gitignore) ? readFileSync(gitignore, 'utf8') : ''
    if (text.split(/\r?\n/).some((entry) => entry.trim() === line)) return
    const prefix = text && !text.endsWith('\n') ? '\n' : ''
    writeFileSync(gitignore, `${text}${prefix}\n# agent-compass sync conflicts\n${line}\n`)
    log('added *.acnew to .gitignore')
  },
}
