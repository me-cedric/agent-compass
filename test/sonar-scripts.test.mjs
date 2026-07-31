import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const root = new URL('..', import.meta.url).pathname

const run = (command, args, options) => new Promise((resolve) => {
  const child = spawn(command, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] })
  let output = ''
  child.stdout.on('data', (data) => { output += data })
  child.stderr.on('data', (data) => { output += data })
  child.on('close', (code) => resolve({ code, output }))
})

test('setup-mode doctor permits CSV drift that the upcoming scan will refresh', async () => {
  const host = await mkdtemp(join(tmpdir(), 'ac-sonar-doctor-'))
  const bin = join(host, 'bin')
  const scripts = join(host, 'scripts')
  try {
    await mkdir(bin)
    await mkdir(scripts)
    await writeFile(join(host, '.env'), 'SONAR_TOKEN=test-token\n')
    await writeFile(join(host, 'sonar-issues-api.csv'), 'header\nissue\n')
    await writeFile(join(scripts, 'sonar-doctor.sh'), await readFile(join(root, 'templates/scripts/sonar-doctor.sh')))
    await writeFile(join(bin, 'curl'), `#!/bin/sh
case "$*" in
  *api/settings/values*) printf '{"settings":[{"value":"git"}]' ;;
  *api/permissions/users*) printf '200' ;;
  *api/issues/search*) printf '{"total":2}' ;;
  *api/ce/activity*) printf '{"tasks":[]}' ;;
esac
`)
    await chmod(join(bin, 'curl'), 0o755)

    const env = { ...process.env, PATH: `${bin}:${process.env.PATH}` }
    const strict = await run('bash', [join(scripts, 'sonar-doctor.sh'), 'api'], { cwd: host, env })
    assert.equal(strict.code, 1)
    assert.match(strict.output, /CSV=1\s+server OPEN=2/)

    const setup = await run('bash', [join(scripts, 'sonar-doctor.sh'), 'api'], {
      cwd: host,
      env: { ...env, SONAR_DOCTOR_FRESH_SETUP: '1' },
    })
    assert.equal(setup.code, 0, setup.output)
    assert.match(setup.output, /setup will refresh it/)
  } finally {
    await rm(host, { recursive: true, force: true })
  }
})

test('setup probes current issueadmin endpoint', async () => {
  const setup = await readFile(join(root, 'templates/scripts/sonar-setup.sh'), 'utf8')
  const cycle = await readFile(join(root, 'templates/scripts/sonar-do.sh'), 'utf8')
  assert.match(setup, /api\/permissions\/users\?permission=issueadmin/)
  assert.doesNotMatch(setup, /api\/permissions\/check|administerIssues/)
  assert.match(setup, /SONAR_DOCTOR_DONE=1 bash scripts\/sonar-do\.sh all/)
  assert.doesNotMatch(setup, /pnpm exec sonar-scanner/)
  assert.match(cycle, /wait_for_ce "\$\{app_dir\}"[\s\S]*fetch_csv "\$\{project\}"/)
  assert.match(cycle, /ceTaskUrl/)
})
