#!/usr/bin/env sh

# Session-start notice only. Never blocks the agent and never changes content.
project_dir=${CLAUDE_PROJECT_DIR:-${CODEX_PROJECT_DIR:-$(pwd)}}
checker=''

if [ -f "$project_dir/docs/agent-compass/scripts/check-update.mjs" ]; then
  checker="$project_dir/docs/agent-compass/scripts/check-update.mjs"
elif [ -f "$project_dir/scripts/check-update.mjs" ] &&
  [ -f "$project_dir/package.json" ] &&
  grep -q '"name"[[:space:]]*:[[:space:]]*"agent-compass"' "$project_dir/package.json"; then
  checker="$project_dir/scripts/check-update.mjs"
fi

if [ -n "$checker" ] && command -v node >/dev/null 2>&1; then
  node "$checker" "$project_dir" --remote --quiet || true
fi

exit 0
