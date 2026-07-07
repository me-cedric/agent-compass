#!/usr/bin/env node
// global-setup.mjs — non-destructive user-level Agent Compass setup.

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, symlinkSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const AC = dirname(dirname(fileURLToPath(import.meta.url)))
const args = process.argv.slice(2)
const help = `Usage: node scripts/global-setup.mjs [home-dir] [--copy|--symlink] [--no-skills] [--dry]

Set up user-level Agent Compass references. Never overwrites existing global files.
`
if (args.includes('--help')) { console.log(help); process.exit(0) }
const home = resolve(args.find((a) => !a.startsWith('--')) || process.env.HOME || process.cwd())
const dry = args.includes('--dry')
const mode = args.includes('--symlink') ? 'symlink' : 'copy'
const noSkills = args.includes('--no-skills')
const writeMissing = (rel, text) => {
  const dest = join(home, rel)
  if (existsSync(dest)) { console.log(`skip ${rel}`); return }
  if (dry) { console.log(`would create ${rel}`); return }
  mkdirSync(dirname(dest), { recursive: true })
  writeFileSync(dest, text)
  console.log(`created ${rel}`)
}
writeMissing('.agent-compass/README.md', `# Global Agent Compass

This directory records user-level Agent Compass setup.

Repo source: ${AC}

Project rules still win over global rules. Keep personal preferences here, not
in shared project files.
`)
writeMissing('.codex/AGENTS.md', `# Global Codex Agent Compass Pointer

Prefer project-local AGENTS.md. If absent, use Agent Compass baseline:
${AC}/AGENTS.md

Default personal style:

- English unless the user asks otherwise.
- Use caveman full for concise, useful output.
- Use ponytail full for the smallest correct change.
- Never invent validation commands; use the repo command registry.
- No commit, push, PR, deploy, publish, or production write unless requested.
`)
writeMissing('.claude/CLAUDE.md', `# Global Claude Agent Compass Pointer

Prefer project-local AGENTS.md or CLAUDE.md. If absent, use:
${AC}/AGENTS.md
`)
if (!noSkills) {
  const skills = readdirSync(join(AC, 'skills'), { withFileTypes: true }).filter((d) => d.isDirectory())
  for (const relDir of ['.agents/skills', '.codex/skills', '.claude/skills']) {
    const dir = join(home, relDir)
    if (!dry) mkdirSync(dir, { recursive: true })
    for (const skill of skills) {
      const src = join(AC, 'skills', skill.name)
      const dest = join(dir, skill.name)
      if (existsSync(dest)) continue
      if (dry) console.log(`would ${mode} ${skill.name} -> ${relDir}`)
      else if (mode === 'symlink') symlinkSync(src, dest, 'dir')
      else cpSync(src, dest, { recursive: true })
    }
  }
}
const manifest = { schema: 1, source: AC, mode, skills: !noSkills, updatedAt: new Date().toISOString() }
if (!dry) writeFileSync(join(home, '.agent-compass', 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
else console.log(JSON.stringify(manifest, null, 2))
