# Copy to `.gitattributes`.
#
# How this file and the compass writer combine: `agent-compass install` and
# `agent-compass doctor --fix` append the projectmem block below when a line is
# missing.
# The writer compares whole trimmed lines. Keep the line
# `.projectmem/events.jsonl merge=union` exactly as written here. The writer then
# finds it and appends nothing. Change the text, and the host file gets two lines
# with one meaning.

# projectmem shared event log (source of truth)
.projectmem/events.jsonl merge=union

# Vendored tree. Replace `<path>` with the directory that a vendor script
# regenerates wholesale. Never edit that directory by hand. `linguist-vendored`
# keeps the tree out of the repository language statistics.
#
# The line carries no `-diff`, on purpose. `-diff` makes git treat the files as
# binary, so `git diff` prints "Binary files differ" instead of the change. A
# vendored pin that moves is the one change a reviewer must read. Mark the
# language statistics, and keep the diff readable.
<path>/** linguist-vendored

# Generated lock files. `linguist-generated` keeps them out of the language
# statistics, and a review view collapses them. The diff stays readable when you
# expand it, for the same reason as above. Delete the line for a lock file the
# project does not have.
pnpm-lock.yaml linguist-generated
Cargo.lock linguist-generated
