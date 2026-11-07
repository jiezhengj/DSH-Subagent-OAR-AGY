# Implementation notes

## Overview

This plugin delegates independent tasks to the local Antigravity CLI (`agy`). The model calls `subagent_oar_agy`; the plugin spawns `agy --input-format stream-json --output-format stream-json`, parses the NDJSON event stream, and returns the final answer to DSH. The model-facing tool reuses the official OAR tool implementation and shape; only the non-ACP AGY runtime is supplied here.

## Requirements

- Antigravity CLI (`agy`) installed locally and signed in at least once.
- DSH 0.2.2-rc.1 or a compatible version.
- macOS, Linux and Windows are supported (POSIX process-group termination / taskkill).

## Install and use

1. Install and enable this bundle from the plugin page.
2. In a new session, ask the model to delegate a task to AGY, or to call `subagent_oar_agy` directly.
3. Tool arguments: `runtime` (always `agy`), `description`, `prompt`, optional `cwd`.

## Permissions

- `yolo` (default): unattended execution.
- `plan`: read-only planning, no writes.
- `strict`: actions that need permission are auto-denied by AGY and the result carries a visible note.
  Auto-denials are never silent: you see which action was denied and how to allow it.

## Data and privacy

Task text is sent only to the local `agy` process. The plugin does not read, store or forward AGY credentials or auth files, and does not modify its global configuration.

## Tool name and coexistence

The default tool name is `subagent_oar_agy`, which does not collide with the official OAR bundle's `subagent_oar`; both can be enabled together. To reuse `subagent_oar`, override `toolName` in your profile patch.

## Disclaimer

This is an unofficial wrapper, not affiliated with DeepSeek or Google. Use at your own risk and follow Antigravity's terms of service.
