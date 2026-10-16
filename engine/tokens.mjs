// tokens.mjs — measure the always-on context that compass adds to a host, and check it against the budgets.
// The text items come from the plan (estimatePlan). The hook items run the planned Claude hook commands in the host.
// A skill or agent costs one listing line. The listing is the sum of its lines, so a figure for one skill adds up to the listing.

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

// The listing line that a provider shows for a skill or an agent: name and description. A skill that only a user can call has none.
export const listingLine = (text) => {
  const data = frontmatter(text).data
  return data['disable-model-invocation'] === 'true' ? '' : `- ${data.name}: ${data.description || ''}`
}
export const listingTokens = (text) => estimate(listingLine(text).length)

const SKILL_FILE = /^\.claude\/skills\/([^/]+)\/SKILL\.md$/
const AGENT_FILE = /^\.claude\/agents\/([^/]+)\.md$/

// The listing lines of the planned files that match a pattern: [name, line] with the name from the path.
const lines = (plan, pattern) => [...plan.files].flatMap(([rel, f]) => {
  const name = pattern.exec(rel)?.[1]
  return name ? [[name, listingLine(f.content.toString('utf8'))]] : []
})

const listing = (name, entries) => {
  const text = entries.map(([, line]) => line).filter(Boolean).join('\n')
  return { name, chars: text.length, tokens: entries.reduce((sum, [, line]) => sum + estimate(line.length), 0) }
}

// The text part of the always-on context, from a plan: { items, skills, agents, total }.
// skills and agents map a name to its listing tokens. The hook output is not in it.
export const estimatePlan = (plan) => {
  const skills = lines(plan, SKILL_FILE)
  const agents = lines(plan, AGENT_FILE)
  const text = (name, value) => ({ name, chars: value.length, tokens: estimate(value.length) })
  const style = plan.keys.get(SETTINGS)?.get('outputStyle')
  const styleFile = style && plan.files.get(`.claude/output-styles/${style}.md`)
  const items = [
    ...[...plan.blocks].map(([file, body]) => text(`${file} block`, blockInner(body))),
    listing('skill listing', skills),
    listing('agent listing', agents),
    ...(styleFile ? [text('output style', frontmatter(styleFile.content.toString('utf8')).body)] : []),
  ]
  const tokens = (entries) => Object.fromEntries(entries.map(([name, line]) => [name, estimate(line.length)]))
  return { items, skills: tokens(skills), agents: tokens(agents), total: items.reduce((sum, i) => sum + i.tokens, 0) }
}

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
  if (cfg.errors.length || kv.errors.length) return { ok: false, items: [], total: 0, errors: [...cfg.errors, ...kv.errors], warnings: [] }
  const plan = buildPlan({ AC, root, config: cfg.config, paths: resolvePaths(cfg.config, kv.konvoy).paths })
  const errors = []
  const items = [...estimatePlan(plan).items]
  const add = (name, text) => items.push({ name, chars: text.length, tokens: estimate(text.length) })
  const settings = plan.keys.get(SETTINGS) || new Map()

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

  // A held upstream source is not in the cache, so its skills are not in the listing yet.
  const warnings = plan.held.length ? ['some upstream skills are not in the cache, so the skill listing is not complete; run "ac sync"'] : []
  const total = items.reduce((sum, i) => sum + i.tokens, 0)
  if (total > BUDGET.tokens) errors.push(`the always-on context is about ${total} tokens; the budget is ${BUDGET.tokens}`)
  if (startChars > BUDGET.sessionStartChars) errors.push(`the SessionStart output is ${startChars} characters; the budget is ${BUDGET.sessionStartChars}`)
  return { ok: !errors.length, items, total, startChars, errors, warnings }
}
