---
id: changelog-entry-in-the-same-task
trigger: 'when you finish a change a user can observe — a new control, a changed default, a fixed failure, a new prerequisite — in a project that keeps a changelog or release notes'
confidence: 0.85
domain: workflow
source: host-project-promotion
---

# A user-visible change carries its changelog entry, written as the feature

## Action

Write the entry as part of the change, not after it. Four mechanics first:

1. **Read the version before you write.** `node -p "require('./package.json').version"`
   names the section. A bullet added to an already-released section describes a
   release that has shipped, and is invisible to every reader of the current one.
2. **Use the project's headings, exactly.** `Added`, `Changed`, `Deprecated`,
   `Removed`, `Fixed`, `Security` when it follows Keep a Changelog — these are
   often matched as identifiers, so a renamed heading is silently skipped.
3. **No entry for what nobody can observe** — a refactor, a test, a comment, a CI
   tweak. If unsure, ask whether a user would notice after upgrading.
4. **Never edit a section below the top one.** A shipped version's notes are a
   record.

Then write it for the person who upgraded this morning, has never seen the code,
and never will:

| Do not write | Write |
| ------------ | ----- |
| `Added FeedbackButton component in the topbar.` | `A **Send feedback** button in the top bar, which opens your mail client on the team inbox.` |
| `Fixed null check in release.rs.` | `The version check no longer reports an update that is already installed.` |
| `Refactored the costing store.` | *(no entry — nobody can observe it)* |

Name a surface the reader can point at: a tab, a button, a dialog, a file the
application writes. A bullet naming a symbol, a module or a commit is a bullet the
reader cannot use.

**Say which entries you wrote, in the handoff**, so a reviewer reads the prose
rather than trusting that it exists.

## Why

You are the only party who knows what changed while the change is being made. A
reader of the diff weeks later is not, and a release built from commit subjects
produces notes written in the vocabulary of the code — which is the vocabulary the
audience does not have.

Offering the entry as a follow-up is the same as not writing it: a feature that
ships with no entry is a feature the team learns about by accident. Making it part
of the change is what keeps that from depending on memory, and a hook that reads
the index is what keeps it from depending on discipline.

Related: [[parallel-locale-artifacts]] when the notes exist in more than one
language, [[commit-convention]] for the commit itself, and
[[documentation-chain-followthrough]] for the rest of the chain a change leaves
stale.
