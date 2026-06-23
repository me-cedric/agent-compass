# projectmem

This project may use `projectmem` for durable local agent memory.

Setup:

```bash
pip install projectmem
pjm init
```

Daily agent workflow:

- Before work: read relevant summaries and run pre-action checks.
- During work: log failed attempts and important findings.
- After work: log decisions, fixes, changed files, validation, and risks.

Do not log secrets, credentials, tokens, personal data, or temporary
brainstorming.

See `projectmem-policy.md` for the project memory policy.
