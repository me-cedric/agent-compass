# Dev loop

Three packs cover the loop on a developer machine: `env`, `local-run` and `e2e`. Each pack has a skill that tells the agent the steps.
See [assets.md](assets.md#packs) for when each pack installs.

## Env

An env var has three homes: the catalog, the template and the code. Keep them equal.
A new, renamed or removed var changes all three in one task. Then run `ac env check`.

| Command | Does |
|---|---|
| `ac env check` | Compares `env.catalog.json`, the templates (`.env.example`), the names that code reads and the local env files. Exit 1 on an error. Prints names and files, never a value. |
| `ac env export --to <recipients>` | Encrypts the local, git-ignored env values with `age`. Writes `env-bundle.age`. |
| `ac env import <file.age>` | Decrypts a bundle. Merges it into git-ignored env files. |
| `ac env run -- <command>` | Starts a command with the env values. The values stay in memory. No file is written. |

- A recipient is an SSH public key file (`.pub`), `host/user`, or a user name. A bare user uses `--forge` (default `github.com`) to fetch `https://<forge>/<user>.keys`.
- `age` 1.3 or later must be on `PATH`, or `AC_AGE` must name it. Never put a plain value in git, chat or a ticket.
- The catalog is optional. It makes the check strict. A TypeScript project with Zod 4 can generate it from the schema with `assets/zod-catalog.mjs` in the `env` skill.
- A hook blocks every read of a `.env*` file that is not a template. Read `.env.example` or `env.catalog.json` for the names.
- Validate the env at startup with a schema. A missing var must fail fast and name the var. Parse numbers and booleans so that garbage gives a safe default.
- A name with a public prefix (`VITE_`, `NEXT_PUBLIC_`, `EXPO_PUBLIC_`, `REACT_APP_`, `NUXT_PUBLIC_`, `PUBLIC_`) must never hold a secret.
- Document in the project README how to run locally, and how to point at another environment.

The `env` skill has the catalog format, each finding kind and its fix.

## Local run

`ac dev` starts the stack with process-compose. `process-compose.yaml` lists each process.
Infrastructure (database, cache, identity server) runs in docker compose profiles. App processes wait for the `infra` process.

| Command | Does |
|---|---|
| `ac dev up` | Validates `process-compose.yaml`, then starts the stack in the background. |
| `ac dev up --dry` | Validates the file. When it is missing, prints a draft from the compose file and the `dev` scripts. |
| `ac dev status` | Shows the name, status, readiness and restarts of each process. |
| `ac dev logs <name> [--tail <n>]` | Shows the last lines of one log. The default is 100. The maximum is 2000. |
| `ac dev down` | Stops the stack. |

- Never start `process-compose` directly. `ac dev` sets the socket path and the timeouts.
- Give each app a readiness probe on its port. Never write a secret in the file. Start the command with `ac env run` instead.
- Commit `process-compose.yaml`. Keep `.agents/dev/` out of git.
- The `process-compose` MCP server (opt in) gives an agent the state and logs. It listens on port 3000.
- The `local-run` skill asks for secrets, VPN, certificates, Docker and the mobile target before it writes the file.

### Docker files

`packs/local-run/extras/` holds reference files. Sync does not install them. Copy and adapt them.

| File | Use |
|---|---|
| `Dockerfile.nestjs`, `Dockerfile.web` | Multi-stage images: install from the lockfile, build, then a slim runtime with a non-root user. They use pnpm. |
| `.dockerignore` | A tight build context: dependencies, build output, `.git`, `.env` and OS metadata. |
| `docker-compose.local.example.yml` | Local infrastructure. Keep the dev stack and the test stack separate. |

- Pin base image tags, and pin a digest for production. Build the same artifact that CI ships. Never run as root.
- A compose file reads env from `.env`. Commit only the `.example` variant.
- Strip OS metadata (`.DS_Store`, `._*`, `Thumbs.db`, `desktop.ini`) in every step that copies files into an artifact: archive, image context and bundler.
  `.gitignore` hides them from git, but it does not remove them from the disk.

## E2E and the run registry

`agent-compass.commands.json` lists the commands that agents may run. `ac run` runs one by name.

```json
{
  "e2e": {
    "web": "npx playwright test",
    "smoke": { "cmd": "npx playwright test --grep @smoke", "timeout": 600 }
  }
}
```

```bash
ac run --list
ac run e2e.web [--timeout <s>] [--confirm]
```

- A nested name has dots, as in `e2e.web`. An entry is a string, or an object with `cmd`, `timeout` (seconds) and `destructive`.
- No shell runs. A pipe, a redirect, a glob or `$VAR` is an error. Leading `NAME=value` words set the env.
- The default timeout is 1800 seconds. A command that looks destructive (push, deploy, publish, release, `rm`, `reset --hard`, drop, `--force`) needs `--confirm`.
- The result goes to `.agents/runs/<timestamp>-<name>/`. `result.json` has `exitCode`, `timedOut`, `durationMs`, the last lines in `tail`, and the paths in `junit` and `html`.
  `output.log` has the full output with secret-like lines redacted.
- The Tests tab of `ac ui` runs the same commands and opens the reports.

The `e2e` skill has the steps: read `tail`, then the JUnit file, then the HTML report. Fix one failure at a time.

### Playwright

- Set up the test agents once with `npx playwright init-agents`. The planner writes a plan, the generator writes tests and the healer fixes failed tests.
- Review each healer edit as a code change. Reject an edit that removes or weakens an assertion, adds a sleep, widens a selector or skips a test.
- Create `toHaveScreenshot` baselines only on the pinned CI image. A laptop renders fonts in another way. A person must look at each changed baseline.
- Retry once in CI and never locally. Capture a trace on the first retry only.
- Declare which tests gate a change. Run long walks and screenshot passes on demand, for example behind an env flag.
- Set the test timeout and the assertion timeout apart. Write the measurement in a comment next to each number.

### Mobile

- Write stable flows as Maestro YAML. Run them through the registry.
- Use agent-device to explore a native app and to reproduce a failure. See [native.md](native.md#device-automation).
