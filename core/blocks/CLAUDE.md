@AGENTS.md

### Claude Code

- The `compass` output style is on. Hooks block `.env` reads and check the completion gate when you stop.
- Pass `model` in every Agent call: `scout` (haiku), `worker` (sonnet), `reviewer` (sonnet). Explore uses the main model.
- For multi-file work, run the `deliver` workflow: plan, split, workers, review, fix.
