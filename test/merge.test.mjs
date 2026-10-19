import assert from 'node:assert/strict'
import test from 'node:test'
import { arrayMerge, blockFind, blockRemove, blockSet, entrySha, jsonDelete, jsonGet, jsonSet, tomlDelete, tomlGet, tomlSet, tomlText } from '../engine/merge.mjs'

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

const group = (matcher, command, extra = {}) => ({ ...(matcher && { matcher }), hooks: [{ type: 'command', command: `node ".agents/hooks/compass.mjs" ${command}`, timeout: 10, ...extra }] })
const own = { matcher: 'Bash', hooks: [{ type: 'command', command: 'echo ours' }] }
const shas = (list) => list.map(entrySha)

test('TOML: a key that the project wrote in another form is there, and set and delete leave it as it is', () => {
  for (const text of ['[mcp_servers]\ncontext7 = { command = "npx" }\n', 'mcp_servers.context7.command = "npx"\n', '[mcp_servers.context7.env]\nA = "1"\n',
    '[mcp_servers]\n"context7" = { command = "npx" }\n']) {
    assert.notEqual(tomlGet(text, 'mcp_servers.context7'), undefined, text)
    assert.equal(tomlSet(text, 'mcp_servers.context7', { command: 'x' }), text, text)
    assert.equal(tomlDelete(text, 'mcp_servers.context7'), text, text)
  }
  assert.equal(tomlGet('[mcp_servers.context70]\ncommand = "x"\n', 'mcp_servers.context7'), undefined)
})

test('entrySha ignores key order at any depth, also inside arrays', () => {
  const a = { matcher: 'Bash', hooks: [{ type: 'command', command: 'x', timeout: 10 }] }
  const b = { hooks: [{ timeout: 10, command: 'x', type: 'command' }], matcher: 'Bash' }
  assert.equal(entrySha(a), entrySha(b))
  assert.notEqual(entrySha(a), entrySha({ ...a, matcher: 'Read' }))
  assert.notEqual(entrySha('a'), entrySha('b'))
})

test('arrayMerge appends the planned entries after the host entries and keeps the host part as it is', () => {
  const guard = group('Read|Bash', 'guard')
  const host = [own]
  const r = arrayMerge(host, [guard], [])
  assert.deepEqual(r.next, [own, guard])
  assert.equal(r.next[0], own)
  assert.deepEqual(r.entries, shas([guard]))
  assert.deepEqual(r.kept, [])
  assert.deepEqual(host, [own], 'the input does not change')
  const again = arrayMerge(r.next, [guard], r.entries)
  assert.deepEqual(again.next, r.next)
  assert.deepEqual(again.entries, r.entries)
})

test('arrayMerge never duplicates: the same entry in another key order, or twice in the plan, is added once', () => {
  const guard = group('Bash', 'guard')
  const reordered = { hooks: [{ timeout: 10, command: guard.hooks[0].command, type: 'command' }], matcher: 'Bash' }
  const r = arrayMerge([own, reordered], [guard, guard], [])
  assert.deepEqual(r.next, [own, reordered])
  assert.deepEqual(r.entries, [], 'the host had it first')
  assert.deepEqual(arrayMerge([], [guard, guard], []).next, [guard])
})

test('arrayMerge removes a stale compass entry that is unchanged and keeps one that the host edited', () => {
  const [a, b, c] = [group('Bash', 'a'), group('Read', 'b'), group('Grep', 'c')]
  const editedB = group('Read', 'b', { timeout: 99 })
  const r = arrayMerge([a, own, editedB, c], [c], shas([a, b, c]))
  assert.deepEqual(r.next, [own, editedB, c])
  assert.deepEqual(r.entries, shas([c]))
  assert.deepEqual(r.kept, [])
  assert.deepEqual(arrayMerge([own, a], [], shas([a])).next, [own])
})

test('arrayMerge reports an edited compass hook as kept and does not add a second one', () => {
  const guard = group('Read|Bash', 'guard')
  const edited = group('Read|Bash', 'guard --strict')
  const r = arrayMerge([own, edited], [guard], [])
  assert.deepEqual(r.next, [own, edited])
  assert.deepEqual(r.kept, [guard])
  assert.deepEqual(r.entries, [])
  const narrowed = group('Bash', 'guard')
  const other = arrayMerge([own, narrowed], [guard], [])
  assert.deepEqual(other.next, [own, narrowed], 'a changed matcher is still an edited compass group')
  assert.deepEqual(other.kept, [guard])
  const gate = arrayMerge([own, group('Bash', 'gate')], [guard], [])
  assert.equal(gate.next.length, 3, 'a group for another compass subcommand is another group')
  assert.deepEqual(gate.kept, [])
  const plain = arrayMerge([{ matcher: 'Read|Bash', hooks: [{ type: 'command', command: 'echo ours' }] }], [guard], [])
  assert.equal(plain.next.length, 2, 'a host hook that is not the compass script does not count')
  assert.deepEqual(plain.kept, [])
})

test('arrayMerge handles permission strings: host strings stay, compass strings append, no string twice', () => {
  const r = arrayMerge(['Read(.env)', 'Bash(rm *)'], ['Bash(rm *)', 'Bash(curl *)'], [])
  assert.deepEqual(r.next, ['Read(.env)', 'Bash(rm *)', 'Bash(curl *)'])
  assert.deepEqual(r.entries, shas(['Bash(curl *)']), 'a host string that equals a planned string stays the host string')
  const edited = arrayMerge(r.next, ['Bash(curl -s *)'], r.entries)
  assert.deepEqual(edited.next, ['Read(.env)', 'Bash(rm *)', 'Bash(curl -s *)'])
  assert.deepEqual(edited.kept, [], 'a string has no edited form')
})

test('arrayMerge records an entry in the lock only when the lock had it or compass adds it now', () => {
  const [a, b] = [group('Bash', 'a'), group('Read', 'b')]
  const first = arrayMerge([a], [a, b], [])
  assert.deepEqual(first.entries, shas([b]), 'the host had a before compass')
  const again = arrayMerge(first.next, [a, b], first.entries)
  assert.deepEqual(again.entries, shas([b]))
  assert.deepEqual(arrayMerge(first.next, [], first.entries).next, [a], 'the host entry stays when the plan drops it')
  assert.deepEqual(arrayMerge([a], [a], shas([a])).entries, shas([a]), 'an entry of the lock stays recorded')
})
