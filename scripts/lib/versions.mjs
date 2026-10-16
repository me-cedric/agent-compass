// versions.mjs — the files that carry the release version. release.mjs writes them. check-release.mjs compares them.

export const VERSION_FILES = [
  { file: 'package.json', path: ['version'] },
  { file: 'plugins/compass-user/.claude-plugin/plugin.json', path: ['version'] },
  { file: 'plugins/compass-user/.codex-plugin/plugin.json', path: ['version'] },
  { file: '.claude-plugin/marketplace.json', path: ['plugins', 0, 'version'] },
]

export const SEMVER = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/

export const getAt = (json, path) => path.reduce((value, key) => value?.[key], json)

export const setAt = (json, path, value) => {
  getAt(json, path.slice(0, -1))[path.at(-1)] = value
}
