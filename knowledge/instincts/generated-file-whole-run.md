---
id: generated-file-whole-run
trigger: 'when a committed file is written by a generator that a test run, a build task, or a codegen command drives — bindings, type exports, snapshots, an OpenAPI document, a token file, a fixture corpus'
confidence: 0.9
domain: build
source: host-project-promotion
---

# Never filter a run that regenerates a committed file

## Action

A generator driven by a test or task writes **the whole file** from the set of
cases that executed. Filtering the run narrows that set, so the file is rewritten
with only the matched subset and everything else is deleted:

```bash
cargo test --manifest-path src-tauri/Cargo.toml export_bindings   # WRONG
cargo test --manifest-path src-tauri/Cargo.toml                   # right
```

The wrong command above cut a bindings file from 110 types to 11, and the type
checker then reported 327 errors in code nobody had touched.

Four rules:

1. **Run the whole suite** when it drives a generator, however slow. Note the
   real cost in the module `README` so the next reader does not "optimise" it.
2. **Never hand-edit the output**, even to fix an obvious mistake. A hand edit is
   wrong twice: the next run deletes it, and it re-creates the drift the
   generator exists to remove.
3. **Repair a filtered run immediately** — `git checkout -- <the file>` — before
   running anything else. A partial generated file is a real edit to a committed
   file, not a cache that clears itself.
4. **Prove a checkout is current** by regenerating and diffing, and put that pair
   in CI:

```bash
<the generate command>
git diff --exit-code <the generated file>
```

## Why

Filtering a test run is the reflex for a fast feedback loop, and it is safe for
every test that only asserts. It is destructive for the ones that emit. Nothing
in the command, the output, or the exit code distinguishes the two — the run
passes, and the damage is a silent deletion in a file the author was not looking
at. It surfaces later as a wall of unrelated errors, which is the most expensive
way to learn it.

The related trap is the source of truth: a generated file that is committed looks
editable, and editing it is faster than finding the generator. Say in the module
`README` which command owns the file, and keep the regenerate-and-diff check in
CI so a stale copy cannot merge.

Related: [[vendored-corpus-manifest]] and [[embedded-tree-lifecycle]] for
generated trees; [[env-var-sync]] and [[scalar-bruno-gherkin-sync]] for the
layers that must move together.
