import { spawn } from 'node:child_process'

export const runNode = (args, options = {}) => new Promise((resolve) => {
  const { input, ...spawnOptions } = options
  const child = spawn(process.execPath, args, { ...spawnOptions, stdio: [input == null ? 'ignore' : 'pipe', 'pipe', 'pipe'] })
  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (data) => { stdout += data })
  child.stderr.on('data', (data) => { stderr += data })
  if (input != null) child.stdin.end(input)
  child.on('close', (code) => resolve({ code, stdout, stderr }))
})

// A strict parser for the TOML subset that the engine writes: [tables], key = value, basic, literal and ''' strings,
// numbers, booleans, arrays and inline tables. Any other syntax throws, so a test can prove that the output parses.
export const parseToml = (s) => {
  let i = 0
  const fail = (what) => { throw new Error(`TOML: bad ${what} at ${JSON.stringify(s.slice(i, i + 30))}`) }
  const ws = () => { while (s[i] === ' ' || s[i] === '\t') i++ }
  const gap = () => { for (;;) { ws(); if (s[i] === '#') while (i < s.length && s[i] !== '\n') i++; if (s[i] === '\n' || s[i] === '\r') i++; else return } }
  const put = (obj, path, v) => {
    const last = path.at(-1)
    const at = path.slice(0, -1).reduce((o, k) => (o[k] ??= {}), obj)
    if (Object.hasOwn(at, last)) fail(`duplicate key ${path.join('.')}`)
    at[last] = v
  }
  const key = () => {
    ws()
    const m = /^(?:[A-Za-z0-9_-]+|"(?:[^"\\\n]|\\.)*")(?:[ \t]*\.[ \t]*(?:[A-Za-z0-9_-]+|"(?:[^"\\\n]|\\.)*"))*/.exec(s.slice(i))
    if (!m) fail('key')
    i += m[0].length
    return m[0].split(/[ \t]*\.[ \t]*/).map((k) => (k.startsWith('"') ? JSON.parse(k) : k))
  }
  const value = () => {
    ws()
    if (s.startsWith("'''", i)) {
      const end = s.indexOf("'''", i + 3)
      if (end < 0) fail('multi-line string')
      const v = s.slice(i + 3, end)
      i = end + 3
      return v.replace(/^\r?\n/, '')
    }
    const str = /^"(?:[^"\\\n]|\\.)*"|^'[^'\n]*'/.exec(s.slice(i))
    if (str) { i += str[0].length; return str[0][0] === '"' ? JSON.parse(str[0]) : str[0].slice(1, -1) }
    if (s[i] === '[') {
      i++
      const out = []
      for (;;) {
        gap()
        if (s[i] === ']') { i++; return out }
        out.push(value())
        gap()
        if (s[i] === ',') i++
        else if (s[i] !== ']') fail('array')
      }
    }
    if (s[i] === '{') {
      i++
      const out = {}
      ws()
      if (s[i] === '}') { i++; return out }
      for (;;) {
        const k = key()
        ws()
        if (s[i++] !== '=') fail('inline table')
        put(out, k, value())
        ws()
        const c = s[i++]
        if (c === '}') return out
        if (c !== ',') fail('inline table')
      }
    }
    const m = /^(?:true|false|[+-]?\d+(?:\.\d+)?)(?![\w.])/.exec(s.slice(i))
    if (!m) fail('value')
    i += m[0].length
    return m[0] === 'true' ? true : m[0] === 'false' ? false : Number(m[0])
  }
  const root = {}
  let table = root
  for (gap(); i < s.length; gap()) {
    if (s[i] === '[') {
      i++
      const path = key()
      ws()
      if (s[i++] !== ']') fail('table header')
      table = path.reduce((o, k) => (o[k] ??= {}), root)
    } else {
      const k = key()
      ws()
      if (s[i++] !== '=') fail('key/value')
      put(table, k, value())
    }
    ws()
    if (s[i] === '#') while (i < s.length && s[i] !== '\n') i++
    if (i < s.length && s[i] !== '\n' && s[i] !== '\r') fail('line end')
  }
  return root
}
