#!/usr/bin/env node
// bootstrap.mjs — produces a precise project-bootstrap prompt for an AI agent
// (Claude / Codex / Copilot), plus a replayable answers file. Interactive Q&A
// by default; `--answers <file>` runs non-interactively so agents can drive it
// (derive answers from architecture guidelines, write JSON, run this).
// Dependency-free (Node >= 20).
//
// Outputs (in --out dir, default cwd):
//   BOOTSTRAP_PROMPT.md          the prompt to paste into your agent
//   agent-compass.answers.json   your answers (re-runnable, used by install.mjs)

import { createInterface } from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const argv = process.argv.slice(2)
const flagValue = (flag) => {
  const i = argv.indexOf(flag)
  return i === -1 ? null : argv[i + 1] || null
}
const answersPathArg = flagValue('--answers')
const outDir = resolve(flagValue('--out') || process.cwd())

const interactive = Boolean(input.isTTY) && !answersPathArg
const rl = interactive ? createInterface({ input, output }) : null

const help = `Usage: node scripts/bootstrap.mjs [--answers <file>] [--out <dir>]

Project bootstrap prompt generator. Interactive by default; give --answers to
run non-interactively from a JSON file (agents: derive answers from the user's
architecture guidelines, write the file, then run this).

Outputs (in --out dir, default cwd):
  BOOTSTRAP_PROMPT.md
  agent-compass.answers.json

Options:
  --answers <file>  Non-interactive: read answers JSON (missing keys use defaults).
  --out <dir>       Write outputs into this directory (created if missing).
  --schema          Print the answers JSON schema (keys, choices, defaults).
  --help            Show this help.
`

if (argv.includes('--help')) {
  console.log(help)
  process.exit(0)
}

const ask = async (q, def) => {
  if (!interactive) return def
  const hint = def !== undefined && def !== '' ? ` [${def}]` : ''
  const a = (await rl.question(`${q}${hint}: `)).trim()
  return a || def
}
const askBool = async (q, def = true) => /^y/i.test(await ask(`${q} (y/n)`, def ? 'y' : 'n'))
const askChoice = async (q, choices, def) => {
  if (!interactive) return def
  console.log(`\n${q}`)
  choices.forEach((c, i) => console.log(`  ${i + 1}) ${c}`))
  const a = await ask('choose number or name', def)
  const byNum = choices[Number(a) - 1]
  return byNum || (choices.includes(a) ? a : def)
}
const askMulti = async (q, choices, def = []) => {
  if (!interactive) return def
  console.log(`\n${q} (comma-separated numbers or names; Enter for default)`)
  choices.forEach((c, i) => console.log(`  ${i + 1}) ${c}`))
  const a = await ask('select', def.join(','))
  if (!a) return def
  return a
    .split(',')
    .map((t) => t.trim())
    .map((t) => choices[Number(t) - 1] || (choices.includes(t) ? t : null))
    .filter(Boolean)
}

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')

export const STACK_DOC_BY_APP = {
  'nestjs-api': 'stacks/nestjs-api.md',
  'react-admin': 'stacks/react-admin.md',
  'expo-mobile': 'stacks/expo-mobile.md',
  'next-web': 'stacks/next-web.md',
}

// Answers contract for --answers files. `choices: null` means free-form.
export const ANSWER_SCHEMA = {
  name: { type: 'string', default: 'my-app', note: 'kebab-case project name' },
  scope: { type: 'string', default: '@<name>', note: 'npm scope for internal packages' },
  monorepo: { type: 'boolean', default: true },
  apps: { type: 'string[]', choices: Object.keys(STACK_DOC_BY_APP), default: ['nestjs-api'] },
  pm: { type: 'string', choices: ['pnpm', 'npm', 'yarn'], default: 'pnpm' },
  db: { type: 'string', choices: ['drizzle+postgres', 'prisma+postgres', 'none'], default: 'drizzle+postgres' },
  queues: { type: 'boolean', default: true },
  auth: { type: 'string', choices: ['keycloak', 'auth0', 'clerk', 'custom', 'none'], default: 'keycloak' },
  resilience: { type: 'boolean', default: true },
  observability: { type: 'boolean', default: true },
  featureFlags: { type: 'boolean', default: true },
  apiContract: { type: 'boolean', default: true },
  e2e: { type: 'boolean', default: true },
  docker: { type: 'boolean', default: true },
  ci: { type: 'string', choices: ['github-actions', 'gitlab-ci', 'none'], default: 'github-actions' },
  sonar: { type: 'boolean', default: true },
  security: { type: 'boolean', default: true },
  targetDir: { type: 'string', default: './<name>' },
}

export const resolveAnswers = (partial) => {
  const name = slug(String(partial.name || ANSWER_SCHEMA.name.default)) || 'my-app'
  const merged = { name }
  for (const [key, spec] of Object.entries(ANSWER_SCHEMA)) {
    if (key === 'name') continue
    if (partial[key] !== undefined) merged[key] = partial[key]
    else if (key === 'scope') merged[key] = `@${name}`
    else if (key === 'targetDir') merged[key] = `./${name}`
    else merged[key] = spec.default
  }
  return merged
}

export const validateAnswers = (answers) => {
  const errors = []
  for (const [key, spec] of Object.entries(ANSWER_SCHEMA)) {
    const value = answers[key]
    if (spec.type === 'boolean' && typeof value !== 'boolean') errors.push(`${key}: expected boolean, got ${JSON.stringify(value)}`)
    if (spec.type === 'string' && typeof value !== 'string') errors.push(`${key}: expected string, got ${JSON.stringify(value)}`)
    if (spec.type === 'string[]') {
      if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) errors.push(`${key}: expected string array, got ${JSON.stringify(value)}`)
      else if (spec.choices) value.filter((v) => !spec.choices.includes(v)).forEach((v) => errors.push(`${key}: unknown value "${v}" (choices: ${spec.choices.join(', ')})`))
    } else if (spec.choices && typeof value === 'string' && !spec.choices.includes(value)) {
      errors.push(`${key}: unknown value "${value}" (choices: ${spec.choices.join(', ')})`)
    }
  }
  return errors
}

export const stackDocsForApps = (apps, monorepo) => {
  const docs = apps.map((a) => STACK_DOC_BY_APP[a]).filter(Boolean)
  if (monorepo) docs.unshift('stacks/turbo-monorepo.md')
  return docs
}

export const buildPrompt = (answers) => {
  const {
    name, scope, monorepo, apps, pm, db, queues, auth, resilience,
    observability, featureFlags, apiContract, e2e, docker, ci, sonar, security, targetDir,
  } = answers
  const hasApi = apps.includes('nestjs-api')
  const hasWeb = apps.includes('react-admin') || apps.includes('next-web')

  const stackDocs = stackDocsForApps(apps, monorepo)
  const archDocs = [
    resilience && 'docs/architecture/resilience.md',
    observability && 'docs/architecture/observability.md',
    featureFlags && 'docs/architecture/feature-flags.md',
    hasApi && 'docs/architecture/api-design.md',
    monorepo && 'docs/architecture/monorepo.md',
  ].filter(Boolean)

  const toolingDocs = [
    monorepo && 'docs/tooling/pnpm.md',
    monorepo && 'docs/tooling/turbo.md',
    'docs/tooling/version-pinning.md',
    'docs/tooling/husky.md',
    apiContract && 'docs/tooling/api-contract-sync.md',
    docker && 'docs/tooling/docker.md',
    sonar && 'docs/tooling/sonarqube.md',
    security && 'docs/tooling/security-scanning.md',
    'docs/tooling/env-management.md',
  ].filter(Boolean)

  const list = (arr) => arr.map((x) => `  - \`${x}\``).join('\n')
  const yn = (b) => (b ? 'yes' : 'no')

  return `# Bootstrap prompt — ${name}

> Generated by agent-compass. Paste this into Claude Code, Codex, or Copilot.
> Assumes agent-compass is reachable at \`@AC\` (set it to this repo's path, e.g.
> \`docs/agent-compass\` or \`.\` if you run the agent from inside agent-compass).

## Read first (from @AC)

- \`AGENTS.md\` — the agent contract (workflow, validation, completion gate, safety).
- \`docs/workflows/project-memory.md\` — use projectmem summaries and logs when
  project memory is configured.
- Stack presets:
${list(stackDocs) || '  - (none)'}
${archDocs.length ? `- Architecture:\n${list(archDocs)}` : ''}
${toolingDocs.length ? `- Tooling:\n${list(toolingDocs)}` : ''}

Use the templates in \`@AC/templates/\` and the skills in \`@AC/skills/\` rather than
inventing config.

## Project parameters

| Setting        | Value |
| -------------- | ----- |
| Name           | \`${name}\` |
| Internal scope | \`${scope}\` |
| Target dir     | \`${targetDir}\` |
| Monorepo       | ${yn(monorepo)} (${pm} + ${monorepo ? 'turbo' : 'single package'}) |
| Apps           | ${apps.join(', ') || '(none yet)'} |
| Database/ORM   | ${db} |
| Queues (BullMQ)| ${yn(queues)} |
| Auth           | ${auth} |
| Resilience     | ${yn(resilience)} |
| Observability  | ${yn(observability)} |
| Feature flags  | ${yn(featureFlags)} |
| API contract   | ${yn(apiContract)} (Scalar + Bruno + Gherkin) |
| E2E            | ${yn(e2e)} |
| Docker         | ${yn(docker)} |
| CI             | ${ci} |
| SonarQube      | ${yn(sonar)} |
| Security scan  | ${yn(security)} |

## Hard rules (enforce throughout)

1. **Plan before code.** Produce a step-by-step plan (goal, files, validation
   commands) and **STOP for my review** before implementing.
2. **Spec before plan.** Create \`specs/000-project/spec.md\` from
   \`@AC/templates/specs/spec-template.md\`, clarify every
   \`[NEEDS CLARIFICATION]\`, then create \`plan.md\`, \`tasks.md\`, and
   \`checklist.md\` from \`@AC/templates/specs/\`.
3. **TDD.** Write tests first; ≥ 80% coverage on new code.
4. **Smallest change; reuse first.** Stdlib → installed dep → a few lines, before
   adding anything new. No speculative abstraction.
5. **Per-module README.** Every module/package gets a README per
   \`@AC/docs/guidelines/documentation.md\`.
6. **Pin versions** (\`.nvmrc\`, \`packageManager\`, \`engines\`).
7. **Conventional commits**, husky \`pre-commit\`/\`pre-push\`/\`commit-msg\`.
8. **No secrets in git**; ship \`.env.example\` only, keep it current.
9. **Do not commit, push, or deploy** unless I explicitly ask.
10. **Completion gate:** report files changed, exact commands run, pass/fail per
   command, pre-existing vs introduced failures, remaining risks.
11. **Project memory:** if projectmem is configured, read memory before work,
    check pre-action warnings before fragile edits, log failed attempts and
    findings during work, and log decisions/fixes/validation/risks after work.

## Build plan (after I approve the plan)

0. **Create spec artifacts** under \`specs/000-project/\`: \`spec.md\`,
   \`plan.md\`, \`tasks.md\`, and \`checklist.md\`. Keep the spec focused on
   what/why; put stack decisions in the plan.
0.1. **Initialize memory policy** from \`@AC/templates/memory/\`. If the team
     chooses projectmem, run \`pip install projectmem\`, \`pjm init\`, and
     configure MCP using \`@AC/docs/tooling/projectmem.md\`.
1. **Scaffold the ${monorepo ? 'monorepo' : 'project'}** from \`@AC/templates/monorepo/\`
   (${monorepo ? 'turbo.json, pnpm-workspace.yaml, ' : ''}tsconfig.base.json, .prettierrc,
   commitlint.config.js, husky hooks, .nvmrc, .npmrc${security ? ', .osv-scanner.toml' : ''}).
   Use scope \`${scope}\`.
${apps.map((a, i) => `2.${i + 1} Create app **${a}** from \`@AC/${STACK_DOC_BY_APP[a]}\`${a === 'nestjs-api' ? ` (DB: ${db}${queues ? ', BullMQ' : ''}${auth !== 'none' ? `, ${auth} auth` : ''})` : ''}.`).join('\n')}
3. **Shared types** package \`${scope}/shared-types\` for cross-app contracts.
${resilience ? '4. Apply **resilience** policies (created once in onModuleInit; shared env-configurable defaults).\n' : ''}${observability ? '5. Wire **OpenTelemetry** tracing + structured logger; span helpers for jobs/payments.\n' : ''}${featureFlags ? '6. Add **feature-flag** scaffolding (env, dormant-by-default) for risky capabilities.\n' : ''}${apiContract ? '7. Set up **API contract** layers: Scalar/OpenAPI decorators, Bruno collection, Gherkin features — kept in sync.\n' : ''}8. **Testing:** ${hasApi ? 'Jest (jest-mock-extended) for API' : ''}${hasApi && hasWeb ? '; ' : ''}${hasWeb ? 'Vitest for web' : ''}${e2e ? '; Playwright e2e for critical flows' : ''}; coverage for Sonar.
${docker ? '9. **Docker:** multi-stage images + local/test compose from `@AC/templates/docker/`.\n' : ''}${ci !== 'none' ? `10. **CI (${ci}):** lint + typecheck + test + build; adapt \`@AC/templates/ci/\`.\n` : ''}${sonar ? '11. **SonarQube:** sonar-project.properties per app + sonar:do/sonar:doctor scripts.\n' : ''}${security ? '12. **Security:** OSV config + baseline; Checkmarx packaging script.\n' : ''}13. **Root README:** prerequisites, install, env setup, and how to run locally
    and partially/fully connected to dev/preprod.

## Validate before reporting

\`\`\`bash
${pm} install
${pm === 'pnpm' && monorepo ? `${pm} check` : `${pm} run lint && ${pm} run typecheck && ${pm} test`}
\`\`\`

Report against the completion gate. Then I will wire agent-compass in as a
submodule and run \`@AC/scripts/install.mjs\`.
`
}

const writeOutputs = (answers) => {
  const prompt = buildPrompt(answers)
  mkdirSync(outDir, { recursive: true })
  const promptPath = resolve(outDir, 'BOOTSTRAP_PROMPT.md')
  const answersPath = resolve(outDir, 'agent-compass.answers.json')
  writeFileSync(promptPath, prompt)
  writeFileSync(answersPath, JSON.stringify(answers, null, 2) + '\n')
  console.log(`\n✓ Wrote ${promptPath}`)
  console.log(`✓ Wrote ${answersPath}`)
}

const main = async () => {
  if (argv.includes('--schema')) {
    console.log(JSON.stringify({ schema: 1, answers: ANSWER_SCHEMA }, null, 2))
    return
  }

  if (answersPathArg) {
    let parsed
    try {
      parsed = JSON.parse(readFileSync(resolve(answersPathArg), 'utf8'))
    } catch (error) {
      console.error(`Cannot read answers file ${answersPathArg}: ${error.message}`)
      process.exit(1)
    }
    const answers = { ...resolveAnswers(parsed), generatedFrom: 'agent-compass/scripts/bootstrap.mjs' }
    const errors = validateAnswers(answers)
    if (errors.length) {
      console.error(`Invalid answers in ${answersPathArg}:`)
      errors.forEach((e) => console.error(`  - ${e}`))
      console.error('Run with --schema to see keys, choices, and defaults.')
      process.exit(1)
    }
    writeOutputs(answers)
    console.log(`\nNext: paste BOOTSTRAP_PROMPT.md into your agent. It will plan first and wait for approval.\n`)
    return
  }

  console.log(`\n agent-compass · project bootstrap`)
  if (!interactive) console.log(' (non-interactive stdin: using all defaults)\n')

  const name = slug(await ask('Project name', 'my-app')) || 'my-app'
  const scope = (await ask('npm scope for internal packages', `@${name}`)) || `@${name}`
  const monorepo = await askBool('Monorepo (pnpm + turbo)?', true)
  const apps = await askMulti('Which apps?', ['nestjs-api', 'react-admin', 'expo-mobile', 'next-web'], ['nestjs-api'])
  const pm = await askChoice('Package manager?', ['pnpm', 'npm', 'yarn'], 'pnpm')
  const hasApi = apps.includes('nestjs-api')
  const hasWeb = apps.includes('react-admin') || apps.includes('next-web')

  const db = hasApi ? await askChoice('Database / ORM?', ['drizzle+postgres', 'prisma+postgres', 'none'], 'drizzle+postgres') : 'none'
  const queues = hasApi ? await askBool('Queues/jobs (BullMQ)?', true) : false
  const auth = await askChoice('Auth provider?', ['keycloak', 'auth0', 'clerk', 'custom', 'none'], hasApi || hasWeb ? 'keycloak' : 'none')
  const resilience = hasApi ? await askBool('Resilience patterns (circuit breaker + retry)?', true) : false
  const observability = hasApi ? await askBool('Observability (OpenTelemetry + structured logs)?', true) : false
  const featureFlags = await askBool('Feature flags (env, dormant-by-default)?', true)
  const apiContract = hasApi ? await askBool('API contract tooling (Scalar/OpenAPI + Bruno + Gherkin)?', true) : false
  const e2e = await askBool('E2E tests (Playwright for web)?', hasWeb)
  const docker = await askBool('Docker (multi-stage images + local compose)?', true)
  const ci = await askChoice('CI provider?', ['github-actions', 'gitlab-ci', 'none'], 'github-actions')
  const sonar = await askBool('Local SonarQube (scan + reports)?', true)
  const security = await askBool('Security scanning (OSV + Checkmarx)?', true)
  const targetDir = (await ask('Target directory', `./${name}`)) || `./${name}`

  if (rl) rl.close()

  const answers = {
    name, scope, monorepo, apps, pm, db, queues, auth, resilience,
    observability, featureFlags, apiContract, e2e, docker, ci, sonar, security, targetDir,
    generatedFrom: 'agent-compass/scripts/bootstrap.mjs',
  }

  writeOutputs(answers)
  console.log(`\nNext: paste BOOTSTRAP_PROMPT.md into your agent. It will plan first and wait for approval.\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
