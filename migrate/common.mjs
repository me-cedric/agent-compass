// common.mjs — names that the migration modules share.

// A migrated source moves under migrated/<its path>.
export const MIGRATED = 'migrated'
export const SKIP = new Set(['node_modules', MIGRATED, 'dist', 'build', 'target', 'vendor', 'Pods', 'DerivedData'])
export const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
