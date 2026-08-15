// changelog.mjs — read one version section out of a Keep a Changelog file.

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// No `m` flag: `$` must mean end of file, or the lazy body stops at the first blank line.
export const changelogSection = (changelog, version) => {
  const match = changelog.match(new RegExp(`(?:^|\n)## \\[${escapeRegExp(version)}\\][^\n]*\n([\\s\\S]*?)(?=\n## \\[|$)`))
  return (match ? match[1].trim() : '') || `Release v${version}`
}
