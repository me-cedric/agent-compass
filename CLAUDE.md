# Claude — agent-compass

@AGENTS.md

## Claude notes

- Answer shape: one-line acknowledgement, no narration between tool calls, one summary at the end.
- Use subagents only for a broad search or a disjoint file cluster. Pin `model` in each delegation.
- Before a structural edit, use the codebase-memory MCP graph. Fall back to targeted reads.
