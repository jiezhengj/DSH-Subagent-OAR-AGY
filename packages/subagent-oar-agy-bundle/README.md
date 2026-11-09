本插件把独立任务委派给本机 Antigravity CLI（`agy`）执行：模型通过 `subagent_oar_agy` 工具把任务交给 agy，取回最终答复。本插件是非官方封装，与 DeepSeek 或 Google 均无隶属关系，使用风险自担。

其他语言：[English](https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/blob/main/README.en.md) · [Deutsch](https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/blob/main/README.de.md) · [Español](https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/blob/main/README.es.md) · [Français](https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/blob/main/README.fr.md) · [日本語](https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/blob/main/README.ja.md) · [Português](https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/blob/main/README.pt.md) · [Русский](https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/blob/main/README.ru.md)

## 安装

1. 打开 DeepSeek Harness 的插件管理（设置 → 插件）。
2. 在安装输入框粘贴这一行并安装：

```
@jiezhengj/subagent-oar-agy
```

tgz 备选：`https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/download/v0.2.8/subagent-oar-agy-0.2.8.tgz`

3. 启用「AGY 子智能体」，新会话即可让模型调用 `subagent_oar_agy`。
4. 安装或升级后按提示重载（必要时重启）DSH，再在新会话调用 `subagent_oar_agy`。

前置条件：DSH 0.2.2-rc.1 及以上（低于 0.3.0）、本机已安装并登录 Antigravity CLI（`agy`）。本包自带运行时代码，官方 OAR 工具会从 npm 安装。也可以手动执行 `dsh plugin add @jiezhengj/subagent-oar-agy`。

## 从 tgz 迁移到名称安装

已通过 tgz 安装的 profile 不能直接检查更新。先在插件管理移除旧条目（或执行 `dsh plugin remove @jiezhengj/subagent-oar-agy`），再按上面的名称重新安装；插件配置通常会保留；若配置随旧条目被移除，重新填写原来的设置即可。装好后版本区应显示当前版本与「已是最新版本」，后续可在应用内检查更新。

## 显示名与界面语言

插件页里的正式显示名是「AGY 子智能体」，跟随 DSH 界面语言显示：

| 语言 | 显示名 |
|---|---|
| 简体中文（zh） | AGY 子智能体 |
| English（en） | AGY subagent |
| Deutsch（de） | AGY-Subagent |
| Español（es） | Subagente AGY |
| Français（fr） | Sous-agent AGY |
| 日本語（ja） | AGY サブエージェント |
| Português（pt） | Subagente AGY |
| Русский（ru） | Субагент AGY |

插件页的介绍正文与详情文档同样提供这 8 种语言（`locale/<lang>.json` 的 `meta.title`/`meta.description`，以及 `docs/DETAIL.<lang>.md`）。运行时面向用户的错误、超时、取消与权限拒绝说明也会按界面语言输出：默认 `locale: auto` 跟随 DSH 的 `locale.preference` 或系统语言，也可显式设为 `de`/`en`/`es`/`fr`/`ja`/`pt`/`ru`/`zh`。

## 默认是否自动执行？

默认自动执行：插件以 `yolo` 档运行 agy，即传入 `--dangerously-skip-permissions`，agy 可以在你给它的工作目录中读写文件、运行命令，不再逐次询问权限。

## 风险是什么？

- agy 以当前用户身份运行，拥有该用户的文件与命令权限；任务提示词可能诱导它修改或删除文件。
- 模型选择此工具后不会弹出权限确认；是否委派、委派什么内容由模型决定，最终影响由你承担。
- agy 会把任务内容与工作目录信息发送给其模型服务（Antigravity 的政策适用）；本插件不额外收集数据，但也不改变 agy 自身的网络与遥测行为。
- 同一目录的并发委派可能产生文件竞争（见下文）。

## 如何改保守？

在插件配置里改 `permissionMode`：

- `plan`：只读规划，agy 只分析、不修改文件（等价于 `--mode plan`）。
- `strict`：不传 `--dangerously-skip-permissions`，需要权限的动作被 agy 自动拒绝；插件会在结果里附上可见说明（哪个动作被拒、如何放行）。
- `yolo`（默认）：无人值守。

示例（组合包 patch 或 DSH 插件配置）：

```yaml
permissionMode: plan
```

## 安装

见 [docs/INSTALL.md](./docs/INSTALL.md)。最短路径是在 DSH 插件管理页的安装框填 `@jiezhengj/subagent-oar-agy`，或执行 `dsh plugin add @jiezhengj/subagent-oar-agy`；tgz 仅作备选。

## 配置项

| 键 | 默认 | 说明 |
|---|---|---|
| `providerName` | `agy` | 注册到子代理服务的运行时名 |
| `command` | `agy` | agy 可执行文件：名称（走 PATH）或绝对路径 |
| `model` | 空 | 传给 `agy --model` |
| `effort` | 空 | 传给 `agy --effort` |
| `permissionMode` | `yolo` | `yolo` / `plan` / `strict` |
| `locale` | `auto` | 面向用户文案的语言；`auto` 跟随 DSH，或显式 `de` / `en` / `es` / `fr` / `ja` / `pt` / `ru` / `zh` |
| `timeoutMs` | 不设 | 单次时限，从 agy `init` 起算；不配置时不设内部时限，委派只能由父会话取消或关闭终止 |
| `killGraceMs` | `10000` | SIGTERM 后等待退出的宽限 |
| `env` | `{}` | 子进程环境变量覆盖，`null` 表示删除 |

## 官方工具包不可用时

工具行优先挂载官方 `@deepseek-ai/dsh-experimental-tool-subagent-oar`。如果该包缺失或无法解析，插件会记录警告，并回退到内置的同形一次性工具：工具名、参数、返回结构与官方一致，委派仍走本插件的 AGY 提供方。

## 找不到 agy 时

如果桌面环境的 PATH 不含 `~/.local/bin`，把 `command` 配成绝对路径即可：

```yaml
command: /Users/your-name/.local/bin/agy
```

## 并行与重试

- **同一目录并发**：允许多个委派并行，文件竞争风险由你承担；重要任务建议分开工作目录。
- **重试**：插件不会自动重试；失败后由你或模型显式再次发起。每次重试都会再次消耗 agy 的配额。

## 工具名与共存

本插件默认工具名是 **`subagent_oar_agy`**，与官方 OAR 组合包的 `subagent_oar` 天然区分，可以同时启用、互不冲突。

如果你没有安装官方 OAR 组合包，又希望沿用 `subagent_oar` 这个名字，可在自己的 profile patch 中覆盖：

```yaml
- id: tool-subagent-oar-agy
  config:
    toolName: subagent_oar
```

反向也可：官方 OAR 已占用 `subagent_oar` 时不要覆盖，保持默认即可。

## 合规声明

本插件是非官方封装，不代表 Antigravity 的官方集成；使用前请自行阅读并遵守 Antigravity（Google）的服务条款。插件不索取、不存储、不转发 agy 的登录凭据，也不修改 agy 的认证状态或全局配置。

## 卸载与禁用

在 DSH 插件管理中禁用或移除本组合包即可；禁用后工具与提供方一并消失，配置保留，重新启用后继续生效。
