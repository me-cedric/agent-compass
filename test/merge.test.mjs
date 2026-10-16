import assert from 'node:assert/strict'
import test from 'node:test'
import { blockFind, blockRemove, blockSet, jsonDelete, jsonGet, jsonSet, tomlDelete, tomlGet, tomlSet, tomlText } from '../engine/merge.mjs'

test('blockSet appends, replaces and keeps other text', () => {
  const start = '# Title\n\n<!-- konvoy:begin -->\nK\n<!-- konvoy:end -->\n'
  const one = blockSet(start, 'v1\n')
  assert.ok(one.startsWith(start.trimEnd()))
  assert.equal(blockFind(one).inner, '\nv1\n')
  const two = blockSet(one, 'v2')
  assert.equal(two, one.replace('v1', 'v2'))
  assert.equal(blockRemove(two), start)
  assert.equal(blockSet('', 'x'), '<!-- compass:begin -->\nx\n<!-- compass:end -->\n')
})

test('blockFind refuses broken markers', () => {
  assert.throws(() => blockFind('<!-- compass:begin -->\nno end\n'))
  assert.throws(() => blockFind('<!-- compass:end -->\n<!-- compass:begin -->\n'))
  assert.equal(blockFind('plain'), null)
})

test('JSON keys splice the text and keep other bytes', () => {
  const user = '{\n  "mcpServers": {\n    "konvoy": { "url": "k", "args": ["a", "b"] }\n  },\n  "big": 12345678901234567890,\n  "f": 1.0\n}\n'
  const one = jsonSet(user, 'mcpServers.docs', { command: 'd' })
  assert.equal(one, user.replace('"args": ["a", "b"] }', '"args": ["a", "b"] },\n    "docs": {\n      "command": "d"\n    }'))
  assert.deepEqual(jsonGet(JSON.parse(one), 'mcpServers.docs'), { command: 'd' })
  assert.equal(jsonSet(one, 'mcpServers.docs', { command: 'd' }), one)
  assert.equal(jsonDelete(one, 'mcpServers.docs'), user)
  const nested = jsonSet(user, 'permissions.deny', ['Read(.env)'])
  assert.ok(nested.endsWith('"f": 1.0,\n  "permissions": {\n    "deny": [\n      "Read(.env)"\n    ]\n  }\n}\n'))
  assert.equal(jsonDelete(nested, 'permissions'), user)
  assert.equal(jsonSet('{"a": 1}', 'b', { c: [1] }), '{"a": 1, "b": {"c":[1]}}')
  assert.equal(jsonSet('{}\n', 'a', 1), '{\n  "a": 1\n}\n')
  assert.equal(jsonDelete('{\n  "a": 1,\n  "b": 2\n}', 'a'), '{\n  "b": 2\n}')
  assert.throws(() => jsonSet('{"a": 1}', 'a.b', 2), /"a" is not an object/)
})

test('TOML keys edit one line or one table and keep the rest byte for byte', () => {
  const user = '# top\nmodel = "x"\n\n[mcp_servers.konvoy]\nurl = "http://k"\n# note\n\n[[profiles]]\nname = "p"\n'
  let text = tomlSet(user, 'model_verbosity', 'low')
  text = tomlSet(text, 'mcp_servers.docs', { command: 'docs', args: ['--ro'], env: { A: '${A}' } })
  assert.equal(tomlGet(text, 'model_verbosity'), 'model_verbosity = "low"')
  assert.equal(tomlGet(text, 'mcp_servers.docs'), '[mcp_servers.docs]\ncommand = "docs"\nargs = ["--ro"]\nenv = { A = "${A}" }')
  assert.ok(text.includes('[mcp_servers.konvoy]\nurl = "http://k"\n# note\n\n[[profiles]]\nname = "p"\n'))
  assert.equal(tomlSet(text, 'mcp_servers.docs', { command: 'docs', args: ['--ro'], env: { A: '${A}' } }), text)
  assert.equal(tomlDelete(tomlDelete(text, 'mcp_servers.docs'), 'model_verbosity'), user)
})

test('TOML set handles empty files and a change from line to table', () => {
  assert.equal(tomlSet('', 'a', 1), 'a = 1\n')
  assert.equal(tomlSet('[t]\nx = 1\n', 'a', true), 'a = true\n\n[t]\nx = 1\n')
  assert.equal(tomlSet('a = 1\n', 'a', { b: 2 }), '[a]\nb = 2\n')
  assert.equal(tomlText('one\ntwo'), "'''\none\ntwo'''")
  assert.equal(tomlText("has ''' quotes"), '"has \'\'\' quotes"')
})

test('TOML scan skips multi-line strings and arrays; CRLF files compare clean', () => {
  const user = 'desc = """\n[fake]\nx = 1\n"""\nnotify = [\n  ["a"]\n]\n\n[real]\nz = 1\n'
  const text = tomlSet(user, 'model_verbosity', 'low')
  assert.equal(text, user.replace(']\n\n[real]', ']\nmodel_verbosity = "low"\n\n[real]'))
  assert.equal(tomlGet(text, 'fake'), undefined)
  assert.equal(tomlGet(text, 'x'), undefined)
  assert.equal(tomlDelete(text, 'model_verbosity'), user)
  assert.equal(tomlGet('a = 1\r\n\r\n[t]\r\nb = 2\r\n', 't'), '[t]\nb = 2')
})
