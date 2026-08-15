# Performance (of the work, and of the agent)

## Runtime performance

Measure before optimizing. Prefer the simple correct version, then optimize the
proven hot path. Cache with the smallest tool that fits (memoization before a
cache layer). Watch N+1 queries, unbounded loops over external calls, and
serial awaits that could be `Promise.all`. Add an index before rewriting a query.

## Agent efficiency

- **Model selection** (when you control it): a fast/cheap model for mechanical or
  high-frequency work; a strong model for orchestration, architecture, and final
  verification. Push bulk implementation down; keep judgment up.
- **Context budget.** Read the part of a file you need, not the whole file. Avoid
  the last ~20% of the context window for large multi-file refactors. Prefer
  targeted reads and code-intelligence tooling over broad grep.
- **Parallelize** independent reads/searches and independent sub-tasks. Send
  independent tool calls in one batch; start independent subagents together.
- **One writer per file.** Give each parallel subagent a file set that no other
  subagent writes. Split by non-overlapping boundaries and merge the results in
  the main thread. Never trade correctness for speed.

## Build troubleshooting

On build failure: read the error, fix incrementally, re-validate after each fix.
Don't stack speculative changes. Keep `turbo`'s cache working — see
[tooling/turbo.md](../tooling/turbo.md).
