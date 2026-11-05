---
name: plugin-author
description: Write a Shipyard plugin. Use when a person creates or edits a plugin folder with manifest.json and files/, or asks how to package one.
risk_level: low
writes_files: true
requires_tools: []
disable-model-invocation: true
---

# Plugin author

A Shipyard plugin is a folder, packaged as a `.zip`. It is data: no plugin code runs.

## Layout

```
manifest.json
plugin-manifest.schema.json   (editor help, not packaged)
files/skills/<name>/SKILL.md
files/rules/<name>.md
files/...                     (other files)
```

## Manifest

- Required: `name` (no slash, no leading dot) and `version`.
- Add `"$schema": "./plugin-manifest.schema.json"`. The schema lists every key.
- `skills` and `rules`: lists of plain names (letters, digits, `-`, `_`).
  A skill copies `files/skills/<name>/` and a rule copies `files/rules/<name>.md`
  to `.claude/` and `.agents/`.
- `files`: a list of `{ "source": "files/x", "target": "x" }`. Without it, each other file goes to the project root.
- `settings`: a key maps to a text default, or to `{ "type", "default", "choices", "required" }`.
  Types: `text`, `number`, `boolean`, `choice`.
- `mcpServers`: remote servers only. Give `url` (`https`) and `headers`.

## Settings in files

Write `config.<key>` between two opening braces and two closing braces in a text file. Shipyard (the sample plugin shows it) fills it when the plugin is applied,
and shows the filled files in the review. A key that is not a setting is an error.
A value is never read again, so braces in a value stay text.

## Limits and guards

- 500 files, 10 MB unpacked, 64 KB manifest.
- No local MCP command. No `http` address. No path with `..`. No link.
- A header value is a `${VAR}` reference. Never write a secret in a plugin.
- A setting whose name holds `token`, `secret`, `password` or `apikey` must stay empty or use `${VAR}`.

## Loop

1. Edit the manifest and the files.
2. In Shipyard, Settings / Extensions, click Try in this project. Read the review.
3. Fix each error. An error names the file and the line.
4. Click Package. Share the `.zip`.

Keep the change small: one skill or one rule at a time, and run the loop after each.
