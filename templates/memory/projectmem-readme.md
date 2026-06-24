# projectmem

This project may use `projectmem` for durable local agent memory.

Setup:

```bash
pip install projectmem
pjm init
```

Generated files:

- `.projectmem/summary.md` may be committed when it contains useful shared
  context and no secrets or local paths.
- `.projectmem/events.jsonl`, `.projectmem/issues/`, watch files, data
  directories, and DB files stay local unless the team explicitly decides to
  version them.
- Backfill/import commands can create many legacy issue files. Run them only
  when the team opts in.

Daily agent workflow:

- Before work: read relevant summaries and run pre-action checks.
- During work: log failed attempts and important findings.
- After work: log decisions, fixes, changed files, validation, and risks.

Do not log secrets, credentials, tokens, personal data, or temporary
brainstorming.

See `projectmem-policy.md` for the project memory policy.
