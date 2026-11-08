DSH plugin that delegates standalone tasks to the local Antigravity CLI (`agy`). It reuses the official OAR tool shape with a non-ACP AGY runtime; unofficial wrapper.

# Languages

[简体中文](README.zh.md) · [English](README.en.md) · [Deutsch](README.de.md) · [Español](README.es.md) · [Français](README.fr.md) · [日本語](README.ja.md) · [Português](README.pt.md) · [Русский](README.ru.md)

# Install

Paste this into the DeepSeek Harness plugin manager install box (Settings → Plugins):

```
@jiezhengj/subagent_oar_agy
```

Fallback tarball: `https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/download/v0.2.6/subagent_oar_agy-0.2.6.tgz`

Then enable "AGY Subagent". Requirements: DSH 0.2.2-rc.1 or later (below 0.3.0), and Antigravity CLI (`agy`) installed and signed in on this machine.

# Links

- [GitHub Release v0.2.6](https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/tag/v0.2.6)
- [Bundle README (Chinese)](packages/subagent-oar-agy-bundle/README.md)
- [Install and upgrade](packages/subagent-oar-agy-bundle/docs/INSTALL.md)
- [Implementation notes (Chinese)](packages/subagent-oar-agy-bundle/docs/DETAIL.zh.md)
- [Specification and validation record](specs/001-subagent-oar-agy/)

# Disclaimer

Unofficial wrapper, not affiliated with DeepSeek or Google; use at your own risk and follow Antigravity's terms of service.

License: [MIT](LICENSE).
