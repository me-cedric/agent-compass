---
name: local-run
description: Start the project stack locally with process-compose and docker compose. Use to run, restart or debug the local apps, or to write process-compose.yaml.
risk_level: medium
writes_files: true
requires_tools: [process-compose, docker]
---

# local-run

Run the local stack with `ac dev`. One file, `process-compose.yaml`, lists every process.
Never start `process-compose` directly. `ac dev` sets the socket path and the timeouts.

## 1. Ask before you write

Ask for each input that the repository does not show. Ask one question at a time. Do not guess.

- Secrets: use the `env` skill and `ac env import` to get the values. Never ask the user to paste a secret in chat.
- VPN: does an app or a registry need it? Is it on?
- Corporate certificates: when Node fails with a certificate error, set `NODE_EXTRA_CA_CERTS` to the CA file. Or set `NODE_OPTIONS=--use-system-ca`.
- Docker: is the daemon running? Check with `docker info`.
- Mobile: which target? iOS needs Xcode and a simulator. Android needs the SDK and an emulator.
- Apps: which apps must run now? Which ports are already in use?

## 2. Start from a draft

```bash
ac dev up --dry
```

When `process-compose.yaml` is missing, this prints a draft on stdout. It writes nothing.
The draft has one `infra` process for the first compose file. It has one process for each app with a `dev` script.
When the file exists, the same command validates it.

Read the warnings. A missing port means the process has no readiness probe. Two apps on one port is a clash.
Save the draft as `process-compose.yaml`. Then edit it.

## 3. Write the file

For each app process:

- Add a `readiness_probe` on the app port. The draft uses `nc -z 127.0.0.1 <port>`.
- Add a `log_location` of `.agents/dev/logs/<name>.log`.
- Set `working_dir` relative to the repository root.
- Make the app wait for `infra` with `condition: process_completed_successfully`.
- Use `process_healthy` when an app waits for another app with a probe.

Put infrastructure services in docker compose profiles:

```yaml
services:
  db:
    image: postgres:17
    profiles: [infra]
```

Start them from the `infra` process:

```yaml
infra:
  command: docker compose --profile infra up --wait
  availability:
    restart: "no"
```

Never write a secret value in `process-compose.yaml`. Start a command with `ac env run`, or load an env file.
Keep the file in git. Keep `.agents/dev/` out of git. `ac dev up` adds a `.gitignore` there.

## 4. Run

```bash
ac dev up
ac dev status
ac dev logs <process>
ac dev down
```

- `ac dev up` validates the file first. Then it starts the stack in the background.
- `ac dev status` shows the name, the status, the readiness and the restarts of each process.
- A process that restarts has a problem. Read it with `ac dev logs <process>`. The default is 100 lines. Use `--tail 500` for more. The maximum is 2000.
- `--dry` shows the command and runs nothing. `--json` prints JSON.
- Run `ac dev down` when you finish or when a port clashes.

## 5. process-compose MCP (opt-in)

The MCP server lets an agent read the state and the logs of the stack. It is off by default.

1. Add `process-compose` to `mcp` in `.agents/compass.json`. Run `ac sync`.
2. Add `mcp_server` to `process-compose.yaml`:

```yaml
mcp_server:
  port: 3000
```

3. Leave `expose_control_tools` unset. Control tools can start and stop processes. Use `ac dev` for that.

The server listens on port 3000, as the catalog URL does. Give an app that uses port 3000 another port.

## When a step fails

- `process-compose is not installed`: ask the user to install it. Do not install it yourself.
- `infra` fails: run `ac dev logs infra`. Check that Docker runs and that the ports are free.
- An app never gets ready: run `ac dev logs <process>`. Check the probe port against the real app port.
- A certificate error: go back to step 1 and set the certificate variable.
