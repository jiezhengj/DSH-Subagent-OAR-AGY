DSH plugin that delegates standalone tasks to the local Antigravity CLI (`agy`). It reuses the official OAR tool shape with a non-ACP AGY runtime; unofficial wrapper.

## What's new in 0.3.0

- Startup watchdog (default 60 s) and stall watchdog (default 15 min) end silent runs with one terminal notification.
- `subagent_oar_agy_control` adds `status` and `cancel` for AGY runs started by the current parent session.
- Bounded status snapshots: at most 50 runs, 20 activity entries, and 200-character excerpts; no prompts, tool arguments, full answers, or raw stderr.
- AGY starts from the official scrubbed parent environment, local failure logs are redacted, and process-tree teardown is verified.

# Languages

[简体中文](README.zh.md) · [English](README.en.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [Português](README.pt.md) · [Русский](README.ru.md)

# Install

Paste this into the DeepSeek Harness plugin manager install box (Settings → Plugins):

```
@jiezhengj/subagent-oar-agy
```

Fallback tarball: `https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/download/v0.3.0/subagent-oar-agy-0.3.0.tgz`

Then enable "AGY Subagent" and reload DSH when prompted (restart if needed). Requirements: DSH 0.2.2-rc.1 or later (below 0.3.0), and Antigravity CLI (`agy`) installed and signed in on this machine.

# Migrating from a tgz install

A profile installed from a tgz cannot check for updates. Remove the old entry in Plugin Management (or run `dsh plugin remove @jiezhengj/subagent-oar-agy`), then install by the name above; the plugin configuration is normally retained; if it is removed with the old entry, re-enter your previous settings. The version section should then show the current version and “Up to date”, so later upgrades can happen in the app.

# Links

- [GitHub Release v0.3.0](https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/tag/v0.3.0)
- [Changelog](CHANGELOG.md)
- [Bundle README (Chinese)](packages/subagent-oar-agy-bundle/README.md)
- [Install and upgrade](packages/subagent-oar-agy-bundle/docs/INSTALL.md)
- [Implementation notes (Chinese)](packages/subagent-oar-agy-bundle/docs/DETAIL.zh.md)
- [Feature 001 specification](specs/001-subagent-oar-agy/)
- [Feature 002 specification](specs/002-npm-distribution/spec.md) and [validation record](specs/002-npm-distribution/validation.md)
- [Feature 003 specification](specs/003-agy-observability-control/spec.md) and [validation record](specs/003-agy-observability-control/validation.md)

# Disclaimer

Unofficial wrapper, not affiliated with DeepSeek or Google; use at your own risk and follow Antigravity's terms of service.

License: [MIT](LICENSE).
