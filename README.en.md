# Installation

1. Open DeepSeek Harness plugin management (Settings → Plugins).
2. Paste this into the install box and install:

```
https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/download/v0.2.3/subagent_oar_agy-0.2.3.tgz
```

3. Enable “AGY subagent”, then the model can call `subagent_oar_agy` in a new session.

Requirements: DSH 0.2.2-rc.1 or newer (below 0.3.0), with Antigravity CLI (`agy`) installed and signed in locally. The tarball ships this plugin's runtime code; the official OAR tool is installed from npm.

# What this plugin does

It delegates independent tasks to the local Antigravity CLI (`agy`): the model calls `subagent_oar_agy`, the plugin spawns `agy --input-format stream-json --output-format stream-json`, parses the NDJSON event stream, and returns the final answer to DSH.

- Reuses the official OAR tool implementation and shape (`runtime`/`description`/`prompt`/`cwd`, `runtime` is only `agy`); only the non-ACP AGY runtime is written here.
- Coexists with the official OAR bundle: this plugin's tool name is `subagent_oar_agy`, the official one is `subagent_oar`.
- Display name, plugin-page description, detail docs and runtime messages cover 8 UI languages (de/en/es/fr/ja/pt/ru/zh).

# Configuration

Set via profile patch (no dedicated settings UI):

```yaml
- id: subagent-agy
  config:
    permissionMode: yolo   # yolo (default) / plan / strict
    timeoutMs: 600000      # optional
    locale: auto           # auto or de/en/es/fr/ja/pt/ru/zh
    command: agy           # optional: absolute path to agy
```

- `yolo`: unattended; `plan`: read-only planning; `strict`: actions needing permission are auto-denied by AGY and the result carries a visible note.

# Alternative install

```bash
dsh plugin add https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/download/v0.2.3/subagent_oar_agy-0.2.3.tgz
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

# Development

```bash
pnpm install
pnpm -r build
pnpm test
```

# Disclaimer

This is an unofficial wrapper, not affiliated with DeepSeek or Google. Use at your own risk and follow Antigravity's terms of service.
