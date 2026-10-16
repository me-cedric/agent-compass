---
name: delivery-digest
description: Write the digest of what changed for the Product Owner or project manager, in plain language, with business impact and planning consequences and no code. Use for a stakeholder update, release notes or a delivery report.
risk_level: low
writes_files: true
requires_tools: [git]
disable-model-invocation: true
---

# delivery-digest

Tell the person who owns the what and the when about the same change that `impact-analysis` tells to the developers.
The digest gets forwarded to clients, steering committees and wikis. Write it so that forwarding is safe.

## Read first

1. The change: `git diff --stat <base>...HEAD` and `git log <base>..HEAD`. Ask for the base when it is missing.
2. The developer note in `{{DELIVERY_DIR}}/impacts/`, if it exists. Reuse its findings.
3. The requirements that the change serves, in `{{OPENSPEC_DIR}}`.
4. The people affected: `{{PERSONAS_FILE}}` and `{{DELIVERY_DIR}}/assignments.json`.
5. The cost frame, when planning moved: `{{COSTING_DIR}}/*.json`.

## Translate, do not summarize

Each line answers "so what" for delivery. Group by feature, never by commit or file.

| Instead of | Write |
|---|---|
| A file or module name | The feature or screen that the user sees |
| A refactor | "No visible change. It lowers the risk of X." Or drop it. |
| An endpoint | The action that it enables, and for whom |
| A migration | Whether there is downtime, and whether data is affected |
| A library bump | Only if it changes behavior, cost or a compliance answer |

## Redaction

Never write these in the file:

- Secrets, tokens, keys, connection strings, internal hostnames or IPs.
- File paths, function names, stack traces, SQL or code.
- A person's name next to a judgment. Name a profile, such as "Backend developer", unless the user asks for names.
- Internal disagreements, or anything said in confidence.
- Vulnerability detail. Write "a security fix was applied in <area>".

If you cannot describe a change without one of these, write the business consequence. Add "Technical detail available on request."

## Output

Write `{{DELIVERY_DIR}}/digests/<YYYY-MM-DD>-<slug>.md`.

```markdown
---
title: <one line that a PO recognizes>
date: <YYYY-MM-DD>
base: <base reference>
audience: product
---

# <title>

**In one sentence:** <text>

## What is now available
## What changed for users
## Scope and planning
| Item | Before | Now | Why |
## Decisions taken
## Waiting on
| What we need | From whom | Blocking | Since |
## Risks and watch points
## Not in this delivery
```

- Write `None.` for an empty section.
- List in "Scope and planning" only the rows where scope, priority, MoSCoW or effort moved.
- Link a decision record by its title.
- Explain a technical term in plain words the first time that you use it.
- Give a number only when you can source it.
- Count a feature as delivered only when it is wired and tested end to end. A ticked task is not proof.
- Name a person or a role in each "Waiting on" row, never "the team".
- Do not commit.
