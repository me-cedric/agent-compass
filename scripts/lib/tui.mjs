// tui.mjs — zero-dependency terminal UX for compass scripts: colors, symbols,
// arrow-key select / multi-select, confirm, text input, and a spinner.
// Degrades cleanly: colors off when piped or NO_COLOR is set; interactive
// prompts fall back to their default when stdin is not a TTY (or throw when
// no default exists, pointing at --yes).
//
// The key-handling logic lives in pure reducers (selectReduce/multiselectReduce)
// so tests can drive them without a real TTY.

import readline from 'node:readline'
import { createInterface } from 'node:readline/promises'
import { stdin, stdout } from 'node:process'

// --- colors ----------------------------------------------------------------

export const colorsEnabled = () =>
  !process.env.NO_COLOR && (Boolean(stdout.isTTY) || Boolean(process.env.FORCE_COLOR))

const style = (open, close) => (text) =>
  colorsEnabled() ? `\x1b[${open}m${text}\x1b[${close}m` : String(text)

export const c = {
  bold: style(1, 22),
  dim: style(2, 22),
  red: style(31, 39),
  green: style(32, 39),
  yellow: style(33, 39),
  cyan: style(36, 39),
}

export const sym = {
  ok: () => c.green('✓'),
  fail: () => c.red('✗'),
  skip: () => c.dim('·'),
  plus: () => c.green('+'),
  pointer: () => c.cyan('❯'),
}

// --- pure reducers -----------------------------------------------------------

// keys: 'up' | 'down' | 'space' | 'return' | 'cancel'
export const selectReduce = (state, key) => {
  const { cursor, count } = state
  if (key === 'up') return { ...state, cursor: (cursor - 1 + count) % count }
  if (key === 'down') return { ...state, cursor: (cursor + 1) % count }
  if (key === 'return') return { ...state, done: true }
  if (key === 'cancel') return { ...state, cancelled: true }
  return state
}

export const multiselectReduce = (state, key) => {
  const base = selectReduce(state, key)
  if (key === 'space') {
    const selected = new Set(state.selected)
    selected.has(state.cursor) ? selected.delete(state.cursor) : selected.add(state.cursor)
    return { ...state, selected }
  }
  return base
}

// --- interactive prompts -----------------------------------------------------

const normalizeKey = (str, key) => {
  if (key?.ctrl && key.name === 'c') return 'cancel'
  if (key?.name === 'escape') return 'cancel'
  if (key?.name === 'up' || key?.name === 'k') return 'up'
  if (key?.name === 'down' || key?.name === 'j') return 'down'
  if (key?.name === 'space') return 'space'
  if (key?.name === 'return' || key?.name === 'enter') return 'return'
  return null
}

const normalizeOptions = (options) =>
  options.map((o) => (typeof o === 'string' ? { value: o, label: o } : { label: o.value, ...o }))

const nonInteractiveFallback = (message, fallback) => {
  if (fallback !== undefined) {
    console.log(`${message} ${c.dim(`→ ${Array.isArray(fallback) ? fallback.join(', ') : fallback} (non-interactive default)`)}`)
    return fallback
  }
  throw new Error(`"${message}" needs an interactive terminal. Re-run in a TTY, or pass --yes / explicit flags.`)
}

const eraseLines = (count) => {
  if (count > 0) stdout.write(`\x1b[${count}A\x1b[0J`)
}

const keyLoop = (render, reduce, initialState) => new Promise((resolvePromise) => {
  let state = initialState
  let renderedLines = render(state, true)
  readline.emitKeypressEvents(stdin)
  const wasRaw = stdin.isRaw
  stdin.setRawMode(true)
  stdin.resume()
  const onKeypress = (str, key) => {
    const action = normalizeKey(str, key)
    if (!action) return
    state = reduce(state, action)
    eraseLines(renderedLines)
    if (state.done || state.cancelled) {
      stdin.removeListener('keypress', onKeypress)
      stdin.setRawMode(wasRaw)
      stdin.pause()
      if (state.cancelled) {
        console.log(c.dim('cancelled'))
        process.exit(130)
      }
      resolvePromise(state)
      return
    }
    renderedLines = render(state, false)
  }
  stdin.on('keypress', onKeypress)
})

// select({ message, options: ['a', {value, label, hint}], initial }) → value
export const select = async ({ message, options, initial }) => {
  const opts = normalizeOptions(options)
  const fallback = initial !== undefined ? initial : opts[0]?.value
  if (!stdin.isTTY) return nonInteractiveFallback(message, fallback)
  const start = Math.max(0, opts.findIndex((o) => o.value === initial))
  const render = (state) => {
    const lines = [`${c.bold(message)} ${c.dim('(↑/↓, enter)')}`]
    opts.forEach((o, i) => {
      const active = i === state.cursor
      const label = active ? c.cyan(o.label) : o.label
      lines.push(`  ${active ? sym.pointer() : ' '} ${label}${o.hint ? ` ${c.dim(o.hint)}` : ''}`)
    })
    stdout.write(lines.join('\n') + '\n')
    return lines.length
  }
  const state = await keyLoop(render, selectReduce, { cursor: start, count: opts.length })
  console.log(`${c.bold(message)} ${c.cyan(opts[state.cursor].label)}`)
  return opts[state.cursor].value
}

// multiselect({ message, options, initial: [values] }) → [values]
export const multiselect = async ({ message, options, initial = [] }) => {
  const opts = normalizeOptions(options)
  if (!stdin.isTTY) return nonInteractiveFallback(message, initial)
  const selected = new Set(opts.map((o, i) => (initial.includes(o.value) ? i : -1)).filter((i) => i >= 0))
  const render = (state) => {
    const lines = [`${c.bold(message)} ${c.dim('(↑/↓, space to toggle, enter)')}`]
    opts.forEach((o, i) => {
      const active = i === state.cursor
      const mark = state.selected.has(i) ? c.green('◉') : c.dim('◯')
      lines.push(`  ${active ? sym.pointer() : ' '} ${mark} ${active ? c.cyan(o.label) : o.label}${o.hint ? ` ${c.dim(o.hint)}` : ''}`)
    })
    stdout.write(lines.join('\n') + '\n')
    return lines.length
  }
  const state = await keyLoop(render, multiselectReduce, { cursor: 0, count: opts.length, selected })
  const values = [...state.selected].sort((a, b) => a - b).map((i) => opts[i].value)
  console.log(`${c.bold(message)} ${c.cyan(values.join(', ') || '(none)')}`)
  return values
}

export const confirm = async ({ message, initial = true }) => {
  const value = await select({
    message,
    options: [{ value: true, label: 'yes' }, { value: false, label: 'no' }],
    initial,
  })
  return value === true
}

export const text = async ({ message, initial = '' }) => {
  if (!stdin.isTTY) return nonInteractiveFallback(message, initial)
  const rl = createInterface({ input: stdin, output: stdout })
  const answer = await rl.question(`${c.bold(message)}${initial ? c.dim(` [${initial}]`) : ''}: `)
  rl.close()
  return answer.trim() || initial
}

// --- spinner ------------------------------------------------------------------

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export const spinner = (label) => {
  if (!stdout.isTTY) {
    console.log(`… ${label}`)
    return { update: () => {}, stop: () => {} }
  }
  let frame = 0
  let current = label
  const timer = setInterval(() => {
    stdout.write(`\r\x1b[2K${c.cyan(FRAMES[frame = (frame + 1) % FRAMES.length])} ${current}`)
  }, 80)
  timer.unref?.()
  return {
    update: (next) => { current = next },
    stop: (ok = true, note = '') => {
      clearInterval(timer)
      stdout.write(`\r\x1b[2K${ok ? sym.ok() : sym.fail()} ${current}${note ? c.dim(` ${note}`) : ''}\n`)
    },
  }
}
