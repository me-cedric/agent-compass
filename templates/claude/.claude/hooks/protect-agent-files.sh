#!/usr/bin/env bash
set -euo pipefail

input="$(cat)"
file_path="$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')"

case "$file_path" in
  *.env|*.env.*|*/.git/*|*/secrets/*|*/credentials/*)
    printf 'Blocked by Agent Compass hook: protected file %s\n' "$file_path" >&2
    exit 2
    ;;
esac

exit 0
