// server.mjs — ac ui: a local web server. It listens on 127.0.0.1 only. An API call needs the URL token.

import { randomBytes, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { createServer as httpServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { failCommand, hostRoot, isObj, parseCommand, usageError } from '../engine/util.mjs'
import { HttpError, routes } from './api.mjs'

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), 'public')
const PAGES = { '/': 'index.html', '/index.html': 'index.html', '/app.js': 'app.js', '/style.css': 'style.css' }
const TYPES = { 'index.html': 'text/html', 'app.js': 'text/javascript', 'style.css': 'text/css' }
const HEADERS = {
  'content-security-policy': "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'cache-control': 'no-store',
}
const MAX_BODY = 1024 * 1024
const USAGE = `Usage: ac ui [--root <dir>] [--port <n>]

Start the local web UI. It listens on 127.0.0.1. The default port is a random free port.
Open the printed URL. The URL holds the token. Press Ctrl+C to stop.`

const send = (res, status, data) => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(data))
}
const fail = (res, status, error) => send(res, status, { ok: false, error })

const same = (a, b) => {
  const x = Buffer.from(String(a))
  const y = Buffer.from(String(b))
  return x.length === y.length && timingSafeEqual(x, y)
}

// Read the body. An oversize body is read and dropped, so the client gets the 413. A body above 16 MB cuts the connection.
const readBody = (req) => new Promise((done) => {
  const chunks = []
  let size = 0
  req.on('data', (chunk) => {
    size += chunk.length
    if (size <= MAX_BODY) chunks.push(chunk)
    else if (size > 16 * MAX_BODY) req.destroy()
  })
  req.on('end', () => done(size > MAX_BODY ? null : Buffer.concat(chunks).toString('utf8')))
  req.on('close', () => done(null))
})

const page = (req, res, path) => {
  const name = PAGES[path]
  if (!['GET', 'HEAD'].includes(req.method)) return fail(res, 405, 'Use GET.')
  if (!name) return fail(res, 404, 'Not found.')
  res.writeHead(200, { 'content-type': `${TYPES[name]}; charset=utf-8` })
  res.end(req.method === 'HEAD' ? undefined : readFileSync(join(PUBLIC, name)))
}

export const createServer = ({ AC, root, token }) => {
  const state = { root, usage: {} }
  const handle = async (req, res) => {
    for (const [name, value] of Object.entries(HEADERS)) res.setHeader(name, value)
    const host = req.headers.host
    const port = server.address()?.port
    if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return fail(res, 403, 'This host name is not allowed.')
    if (!/^\/(?!\/)/.test(req.url)) return fail(res, 400, 'Bad request path.')
    const url = new URL(req.url, `http://${host}`)
    if (!url.pathname.startsWith('/api/')) return page(req, res, url.pathname)

    const given = req.headers['x-ac-token'] ?? (req.method === 'GET' ? url.searchParams.get('token') : null)
    if (given === null || !same(given, token)) return fail(res, 401, 'The token is missing or wrong.')
    const route = routes[`${req.method} ${url.pathname}`]
    if (!route) return fail(res, 404, 'Not found.')

    let body = {}
    if (req.method === 'POST') {
      if (!/^application\/json(;|$)/i.test(req.headers['content-type'] ?? '')) return fail(res, 415, 'Send content-type application/json.')
      if (req.headers.origin !== undefined && req.headers.origin !== `http://${host}`) return fail(res, 403, 'This origin is not allowed.')
      const text = await readBody(req)
      if (text === null) return fail(res, 413, 'The body is above 1 MB.')
      try { body = JSON.parse(text || '{}') } catch { return fail(res, 400, 'The body is not valid JSON.') }
      if (!isObj(body)) return fail(res, 400, 'The body must be a JSON object.')
    }
    const out = await route({ AC, state, body, query: url.searchParams })
    if (typeof out === 'function') out(res)
    else send(res, 200, out ?? { ok: true })
  }
  const server = httpServer((req, res) => {
    handle(req, res).catch((err) => {
      if (res.headersSent) return res.destroy()
      fail(res, err instanceof HttpError ? err.status : 500, err.message)
    })
  })
  return server
}

export const cli = async (argv, { AC }) => {
  const { values: v, exit } = parseCommand(argv, USAGE, { root: { type: 'string' }, port: { type: 'string' } }, { allowPositionals: false, prefix: 'error: ' })
  if (exit !== undefined) return exit
  const port = v.port === undefined ? 0 : Number(v.port)
  if (v.port === '' || !Number.isInteger(port) || port < 0 || port > 65535) return usageError(USAGE, '--port needs a whole number from 0 to 65535.', 'error: ')
  const host = hostRoot(AC, v.root)
  if (host.error) return failCommand(false, host.error)
  const token = randomBytes(24).toString('base64url')
  const server = createServer({ AC, root: host.root, token })
  try {
    await new Promise((ok, no) => { server.once('error', no); server.listen(port, '127.0.0.1', ok) })
  } catch (err) { console.error(`error: cannot listen on port ${port}: ${err.message}`); return 1 }
  console.log(`http://127.0.0.1:${server.address().port}/?token=${token}`)
  console.error(`ac ui serves ${host.root}. Press Ctrl+C to stop.`)
  return 0
}
