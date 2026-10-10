# Device Automation (agent-device)

[agent-device](https://github.com/callstack/agent-device) (Callstack, MIT) lets
an agent drive and inspect a running app on an iOS simulator or device, an
Android emulator or device, and more. It is a CLI, an MCP server and a typed
Node.js API over one runtime. Agent Compass tracks it as a `reference` source:
the pin, the licence and the skill inventory live in
[`skills/upstream-sources.json`](../../skills/upstream-sources.json), and no
upstream file is copied. The method that uses it is
[mobile-visual-check](../workflows/mobile-visual-check.md).

## Why this tool

- **A CLI.** Every agent, a fenced subagent included, calls it from a shell,
  with no session restart (an MCP server reaches a session only after a reload).
- **Device claims per git worktree.** Parallel lanes do not take each other's
  simulator or emulator.
- **Accessibility snapshots with refs and element bounds**, so an agent acts
  through names and measures hit targets without a screenshot.
- **Evidence:** small screenshots (an iPhone 17 Pro screen is 402 x 874 at 1x,
  about 80 KB), video, logs, network and performance data.
- **Replay:** a run saves as an `.ad` script for CI, or exports strict Maestro
  YAML. It reads React Native component trees.
- **No install script and no analytics.** Its device-cloud connectors
  (BrowserStack, AWS Device Farm, Limrun) are optional and paid; this compass
  does not use them.

Smoke-tested on macOS on 2026-10-09: it built its iOS runner, opened an app on
a simulator and saved a screenshot, and it drove the Play Store on a physical
Android 16 phone.

## Use

Pin the version in one place, for example a package script:
`"device": "npx -y agent-device@0.21.22"`. Then:

```bash
pnpm device open <bundle-or-package> --platform ios --udid <simulator> --session <lane> --foreground
pnpm device settings appearance dark      # and light
pnpm device settings animations off
pnpm device press @e12 --settle           # act on a ref from the last snapshot
pnpm device snapshot -i                   # interactive elements with bounds
pnpm device screenshot /tmp/<lane>/<screen>-dark.png
pnpm device close
```

Android takes `--platform android --serial <emulator-or-device>`. Start with
`open <app> --foreground` and continue from the printed diff; do not probe with
`--help` first. For an unlabelled control (some system apps), take a screenshot,
then `press <x> <y>`.

The MCP form for clients that prefer tools:
[`templates/mcp/agent-device.example.json`](../../templates/mcp/agent-device.example.json).

## Skills

```bash
agent-compass external-skills /path/to/host --source agent-device --recommended
```

## Tracked Inventory

Source: <https://github.com/callstack/agent-device>

<!-- BEGIN GENERATED:agent-device-inventory -->
4 tracked skills:

- `agent-device`, `android-emulator`, `dogfood`, `ios-simulator`
<!-- END GENERATED:agent-device-inventory -->

Refresh the pin, the inventory and the package version together:

```bash
agent-compass upstream-skills --update agent-device --dry
agent-compass upstream-skills --update agent-device
```
