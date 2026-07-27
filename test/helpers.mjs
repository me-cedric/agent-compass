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
