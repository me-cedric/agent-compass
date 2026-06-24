# Headroom — Context Compression

[Headroom](https://github.com/headroomlabs-ai/headroom) compresses what an agent
sends to the model — tool output, file reads, RAG chunks, and history — for
"60–95% fewer tokens, same answers." It runs as an agent wrapper, a drop-in
proxy, or an MCP server, and can mine failed sessions to improve prompts.

## Headroom vs rtk — use both, different layers

| Layer | Tool | What it shrinks | How you invoke it |
| ----- | ---- | --------------- | ----------------- |
| Command | [`rtk`](rtk.md) | One command's stdout (test/build/git/docker) | You prefix the command: `rtk test` |
| Session | headroom | Everything sent to the model (files, history, tool output — including rtk's) | Set up once: `headroom wrap claude` |

They **stack**: run the agent inside `headroom wrap`, and still use `rtk` for
noisy commands — headroom further compresses whatever rtk emits plus everything
else. Prefer headroom as the default token layer (no per-command discipline);
keep rtk for deterministic, offline, in-terminal command compaction. Neither is
required — both degrade gracefully when absent.

## Install (optional)

```bash
pip install "headroom-ai[all]"     # Python CLI (headroom wrap/proxy/learn)
npm install headroom-ai            # TypeScript/Node library
headroom --version
```

## Easy setup

Wrap the agent — the lowest-effort, highest-leverage mode:

```bash
headroom wrap claude               # or: codex | cursor | aider | copilot | opencode
headroom wrap claude --memory      # add cross-agent memory
headroom perf                      # show token savings
```

Or run a proxy and point an OpenAI-compatible client at it:

```bash
headroom proxy --port 8787
```

> Proxy mode routes model traffic through a local process. Keep API keys in your
> shell/secret store, never in repo files. Treat it like any other credentialed
> local service.

## MCP mode

Headroom can expose `headroom_compress`, `headroom_retrieve`, and
`headroom_stats` to any MCP client. See
[`../../templates/mcp/headroom.example.json`](../../templates/mcp/headroom.example.json)
and record the tools in the [MCP tool contract](../../templates/mcp/tool-contract.md).
Verify the exact server launch command against the headroom docs for your
version before relying on it.

## Learning loop

`headroom learn` mines failed sessions and writes corrections to
`CLAUDE.md` / `AGENTS.md` / `GEMINI.md`:

```bash
headroom learn --verbosity         # preview (dry run)
headroom learn --verbosity --apply # save settings
```

This overlaps the Agent Compass improvement loop. Treat headroom's suggested
edits as input, not truth: review them, and promote durable lessons through
[knowledge-capture](../workflows/knowledge-capture.md) and the
[trace log](../../templates/trace/README.md) rather than letting any tool edit
guidance unattended.

References:

- Headroom: https://github.com/headroomlabs-ai/headroom
- MCP: https://modelcontextprotocol.io/docs/getting-started/intro
