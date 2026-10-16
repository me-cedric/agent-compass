// tokens.mjs — measure the always-on context that compass adds to a host, and check it against the budgets.
// The text items come from the plan. The hook items run the planned Claude hook commands in the host.

import { spawnSync } from 'node:child_process'
import { loadConfig, loadKonvoy, resolvePaths } from './config.mjs'
import { blockInner } from './merge.mjs'
import { buildPlan } from './plan.mjs'
import { frontmatter } from './util.mjs'

export const BUDGET = { tokens: 2000, sessionStartChars: 1000 }
// ponytail: about 4 characters per token for English Markdown. Use a real tokenizer when a total is within 10% of a budget.
export const estimate = (chars) => Math.ceil(chars / 4)

const SETTINGS = '.claude/settings.json'
// Hook events whose output goes into the context on every session or every prompt.
const ALWAYS_ON = ['SessionStart', 'UserPromptSubmit']

// The listing line that a provider shows for each skill or agent: name and description.
const listing = (plan, pattern) => [...plan.files]
  .filter(([rel]) => pattern.test(rel))
  .map(([, f]) => frontmatter(f.content.toString('utf8')).data)
  .filter((d) => d['disable-model-invocation'] !== 'true')
  .map((d) => `- ${d.name}: ${d.description || ''}`)
  .join('\n')

const runHook = (root, command, event) => {
  const r = spawnSync(command, {
    shell: true,
    cwd: root,
    input: JSON.stringify({ hook_event_name: event, source: 'startup', prompt: '', cwd: root }),
    encoding: 'utf8',
    timeout: 10_000,
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
  })
  if (r.status === 0) return { out: r.stdout || '' }
  return { error: (r.stderr || r.error?.message || `exit code ${r.status}`).trim().split('\n')[0] }
}

export const measureTokens = ({ AC, root }) => {
  const cfg = loadConfig(root, AC)
  const kv = loadKonvoy(root)
  if (cfg.errors.length || kv.errors.length) return { ok: false, items: [], total: 0, errors: [...cfg.errors, ...kv.errors] }
  const plan = buildPlan({ AC, root, config: cfg.config, paths: resolvePaths(cfg.config, kv.konvoy).paths })
  const errors = []
  const items = []
  const add = (name, text) => items.push({ name, chars: text.length, tokens: estimate(text.length) })

  for (const [file, body] of plan.blocks) add(`${file} block`, blockInner(body))
  add('skill listing', listing(plan, /^\.claude\/skills\/[^/]+\/SKILL\.md$/))
  add('agent listing', listing(plan, /^\.claude\/agents\/[^/]+\.md$/))
  const settings = plan.keys.get(SETTINGS) || new Map()
  const style = settings.get('outputStyle')
  const styleFile = style && plan.files.get(`.claude/output-styles/${style}.md`)
  if (styleFile) add('output style', frontmatter(styleFile.content.toString('utf8')).body)

  let startChars = 0
  for (const event of ALWAYS_ON) {
    const commands = (settings.get(`hooks.${event}`) || []).flatMap((m) => m.hooks || []).filter((h) => h.type === 'command')
    for (const { command } of commands) {
      const r = runHook(root, command, event)
      if (r.error) { errors.push(`the ${event} hook "${command}" failed: ${r.error}; run "ac sync" first`); continue }
      if (event === 'SessionStart') startChars += r.out.length
      add(`${event} hook output`, r.out)
    }
  }

  const total = items.reduce((sum, i) => sum + i.tokens, 0)
  if (total > BUDGET.tokens) errors.push(`the always-on context is about ${total} tokens; the budget is ${BUDGET.tokens}`)
  if (startChars > BUDGET.sessionStartChars) errors.push(`the SessionStart output is ${startChars} characters; the budget is ${BUDGET.sessionStartChars}`)
  return { ok: !errors.length, items, total, startChars, errors }
}
