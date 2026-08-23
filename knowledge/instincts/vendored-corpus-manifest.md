---
id: vendored-corpus-manifest
trigger: 'when embedding another repository (a skill corpus, a template set, a rules pack) into an application as a vendored tree instead of a runtime dependency'
confidence: 0.9
domain: build
source: local-repo-analysis
---

# Vendor a foreign corpus behind a generated manifest

> **Agent Compass no longer vendors.** It moved every external skill source to a
> tracked pin plus an install-time fetch — see
> [ADR 002](../../docs/decisions/002-tracked-external-reference-sources.md). This
> instinct still holds for the case where copying *is* the right answer: an
> offline requirement, a source with no stable host, or content you must be able
> to review in your own diff. Sections 4, 5, and 6 apply either way — normalize
> at the boundary, keep the licence with the content, and keep host-added
> enforcement outside the foreign tree.

An application that ships another repository's content has three problems: the
copy drifts from its source, the reader has to understand the source's own
tooling, and the licence notice gets lost. One pattern solves all three.

## 1. Copy the tree verbatim, then generate a manifest next to it

Copy the source tree as-is, so its internal relative links keep resolving. Then
write a `manifest.json` beside it that lists what the application needs: names,
descriptions, versions, groups, and per-item metadata.

The application reads **only the manifest**. It never parses the source's own
scripts or config files. A corpus written in one language must not force the host
to implement a second parser for it.

## 2. Give the vendoring script a `--check` mode and run it in CI

```
vendor.mjs                     # refresh the tree from the source
vendor.mjs --source ../local   # vendor from a working copy
vendor.mjs --check             # exit non-zero if the committed tree drifted
```

A CI job that runs `--check` is what makes "vendored" a fact instead of an
intention. Without it, the copy silently ages.

## 3. Version each corpus separately

Give each vendored tree its own version field, taken from the source's own
release marker. A corpus with no release carries only its `source_commit`.

Never share one version across two corpora. A bump of corpus A then marks every
unchanged item of corpus B as outdated, and the staleness signal becomes noise.

## 4. Normalize the contract at the vendoring boundary, not in the reader

When the source's metadata does not match the host's contract — a missing risk
field, a folder name that disagrees with the declared name — fix it in the
vendoring script. One reader then serves every tree, and each missing field gets
a default rather than a special case.

Record each normalization in a comment or a doc. A silent normalization looks
like a bug the next time someone diffs the tree against its source.

## 5. Keep the licence with the content

Copy the `LICENSE` file next to every vendored item that carries one, and add a
test that fails the build when one goes missing. A provenance line in prose is
weaker than the licence text most permissive licences ask you to retain.

## 6. Enforcement that must survive re-vendoring lives outside the tree

Anything the host adds on top of the vendored content — generated entry files,
appended blocks, substituted paths — belongs in host code that runs on the way
out of the tree. An edit inside the vendored tree is erased by the next
`vendor` run.

## 7. A tree that ships needs a lifecycle row

Several embedded trees look alike from the outside. Give each one a row that says
who generates it, who consumes it, when it refreshes, and what breaks when it
drifts. See [`embedded-tree-lifecycle`](embedded-tree-lifecycle.md).
