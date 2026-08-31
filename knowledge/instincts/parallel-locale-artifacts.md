---
id: parallel-locale-artifacts
trigger: 'when a project keeps the same artifact in two or more languages — locale tables, a translated changelog, bilingual release notes, a handbook, onboarding copy — and you change one of them'
confidence: 0.85
domain: workflow
source: host-project-promotion
---

# Change every language in the same task, and let a test refuse a paste

## Action

Treat the set as one artifact with several files. Change them together, and gate
the three properties a test can actually judge:

1. **Same identifiers, same order, same counts.** Every key, section and list
   item present in each file. A missing key is the common failure and it is
   trivially detectable.
2. **No item is byte-identical across two languages.** This is the assertion that
   catches the shortcut — pasting the English into the French file passes every
   presence check and ships untranslated text to half the audience.
3. **Every heading parses.** A version heading, a section anchor or a category
   name that the reader matches as an identifier is silently skipped when it is
   malformed, so that entry never appears anywhere.

Then two rules for the prose:

- **Translate; never paste.** If you cannot write the other language, say so in
  the handoff and name the file and the entry that needs it. An untranslated entry
  flagged is a task; an untranslated entry shipped is a defect nobody sees.
- **Write for the reader of that language**, not a word-for-word mapping. The same
  fact, in the register that language uses.

Put the gate in the pre-commit hook as well as CI. A hook that reads the index
refuses a commit staging one language without the other, which is where the
mistake is actually made.

## Why

The application looks correct in both languages. Nothing renders wrong, no test
fails, and no error is logged — the reader in the second language simply never
learns the thing exists. A feature announced in one changelog and forgotten in the
other means half the team discovers it by accident, and the person who wrote it
is the only one who could have noticed.

The byte-identity assertion earns its place because presence checks are exactly
what a paste satisfies. It is the one mechanical proxy for "somebody actually
translated this", and it costs one test.

Related: [[test-proves-presence-not-truth]] (structure is checkable, truth is
not), [[documentation-chain-followthrough]] (a documentation change is never one
file).
