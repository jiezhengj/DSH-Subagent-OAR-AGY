# Installation

1. Open DeepSeek Harness plugin management (Settings → Plugins).
2. Paste this into the install box and install:

```
@jiezhengj/subagent-oar-agy
```

Fallback (tgz): `https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/download/v0.3.0/subagent-oar-agy-0.3.0.tgz`

3. Enable “AGY subagent”, then the model can call `subagent_oar_agy` in a new session.
4. Reload DSH when prompted (restart if needed), then call `subagent_oar_agy` in a new session.

Requirements: DSH 0.2.2-rc.1 or newer (below 0.3.0), with Antigravity CLI (`agy`) installed and signed in locally. The tarball ships this plugin's runtime code; the official OAR tool is installed from npm.

# Migrating from a tgz install

A profile installed from a tgz cannot check for updates. Remove the old entry in Plugin Management (or run `dsh plugin remove @jiezhengj/subagent-oar-agy`), then install by the name above; the plugin configuration is normally retained; if it is removed with the old entry, re-enter your previous settings. The version section should then show the current version and “Up to date”, so later upgrades can happen in the app.

# What this plugin does

It delegates independent tasks to the local Antigravity CLI (`agy`): the model calls `subagent_oar_agy`, the plugin spawns `agy --input-format stream-json --output-format stream-json`, parses the NDJSON event stream, and returns the final answer to DSH.

- Reuses the official OAR tool implementation and shape (`runtime`/`description`/`prompt`/`cwd`, `runtime` is only `agy`); only the non-ACP AGY runtime is written here.
- Coexists with the official OAR bundle: this plugin's tool name is `subagent_oar_agy`, the official one is `subagent_oar`.
- Display name, plugin-page description, detail docs and runtime messages cover 8 UI languages (de/en/es/fr/ja/pt/ru/zh).

# Observability and control

Version 0.3.0 adds startup and stall watchdogs (60 s / 15 min by default), a `subagent_oar_agy_control` tool with `status` and `cancel`, and bounded activity summaries (50 runs, 20 activities, 200 characters). Watchdogs have no off switch; increase the windows for long tasks. Status never exposes prompts, tool arguments, full answers, or raw stderr.

# Configuration

Set via profile patch (no dedicated settings UI):

```yaml
- id: subagent-agy
  config:
    permissionMode: yolo   # yolo (default) / plan / strict
    timeoutMs: 600000      # optional
    startupTimeoutMs: 60000
    stallTimeoutMs: 900000
    controlToolName: subagent_oar_agy_control
    locale: auto           # auto or de/en/es/fr/ja/pt/ru/zh
    command: agy           # optional: absolute path to agy
```

- `yolo`: unattended; `plan`: read-only planning; `strict`: actions needing permission are auto-denied by AGY and the result carries a visible note.

# Alternative install

```bash
dsh plugin add @jiezhengj/subagent-oar-agy
```

Or build from this repository:

```bash
pnpm install
pnpm -r build
cd packages/subagent-oar-agy-bundle && pnpm pack
```

# Repository layout

- `packages/subagent-oar-agy-provider/`: AGY runtime provider (subprocess, event stream, timeout/cancel, i18n messages).
- `packages/subagent-oar-agy-bundle/`: distributable DSH bundle (plugin manifest, patch, 8-language metadata and detail docs, provider vendored at build time).
- `specs/001-subagent-oar-agy/`: SDD specification, plan, tasks and validation records.
- `specs/003-agy-observability-control/`: SDD specification, plan, tasks and validation for watchdogs, status and cancel.

# Development

```bash
pnpm install
pnpm -r build
pnpm test
```

# Disclaimer

This is an unofficial wrapper, not affiliated with DeepSeek or Google. Use at your own risk and follow Antigravity's terms of service.
