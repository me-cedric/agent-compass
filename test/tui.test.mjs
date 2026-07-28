import assert from 'node:assert/strict'
import test from 'node:test'

import { c, colorsEnabled, multiselectReduce, selectReduce } from '../scripts/lib/tui.mjs'

test('selectReduce moves the cursor and wraps around', () => {
  const state = { cursor: 0, count: 3 }
  assert.equal(selectReduce(state, 'down').cursor, 1)
  assert.equal(selectReduce({ cursor: 2, count: 3 }, 'down').cursor, 0)
  assert.equal(selectReduce(state, 'up').cursor, 2)
})

test('selectReduce finishes on return and cancels on cancel', () => {
  assert.equal(selectReduce({ cursor: 1, count: 3 }, 'return').done, true)
  assert.equal(selectReduce({ cursor: 1, count: 3 }, 'cancel').cancelled, true)
})

test('multiselectReduce toggles the item under the cursor with space', () => {
  const state = { cursor: 1, count: 3, selected: new Set() }
  const on = multiselectReduce(state, 'space')
  assert.deepEqual([...on.selected], [1])
  const off = multiselectReduce(on, 'space')
  assert.deepEqual([...off.selected], [])
})

test('multiselectReduce never mutates the previous state', () => {
  const state = { cursor: 0, count: 2, selected: new Set([1]) }
  multiselectReduce(state, 'space')
  assert.deepEqual([...state.selected], [1])
})

test('colors are plain text when NO_COLOR is set', () => {
  const saved = { NO_COLOR: process.env.NO_COLOR, FORCE_COLOR: process.env.FORCE_COLOR }
  try {
    process.env.NO_COLOR = '1'
    assert.equal(colorsEnabled(), false)
    assert.equal(c.green('ok'), 'ok')
  } finally {
    saved.NO_COLOR === undefined ? delete process.env.NO_COLOR : (process.env.NO_COLOR = saved.NO_COLOR)
    saved.FORCE_COLOR === undefined ? delete process.env.FORCE_COLOR : (process.env.FORCE_COLOR = saved.FORCE_COLOR)
  }
})

test('colors carry ANSI codes when FORCE_COLOR is set', () => {
  const saved = { NO_COLOR: process.env.NO_COLOR, FORCE_COLOR: process.env.FORCE_COLOR }
  try {
    delete process.env.NO_COLOR
    process.env.FORCE_COLOR = '1'
    assert.equal(colorsEnabled(), true)
    assert.match(c.green('ok'), /\x1b\[32mok\x1b\[39m/)
  } finally {
    saved.NO_COLOR === undefined ? delete process.env.NO_COLOR : (process.env.NO_COLOR = saved.NO_COLOR)
    saved.FORCE_COLOR === undefined ? delete process.env.FORCE_COLOR : (process.env.FORCE_COLOR = saved.FORCE_COLOR)
  }
})
