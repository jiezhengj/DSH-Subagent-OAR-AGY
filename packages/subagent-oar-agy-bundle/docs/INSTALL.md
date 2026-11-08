# 安装与升级

## 前置条件

- DeepSeek Harness 0.2.2-rc.1 或更高（组合包 `engines.dsh` 为 `>=0.2.2-rc.1 <0.3.0`）。
- 本机已安装并登录 Antigravity CLI（agy 1.5 及以上），终端里能以 `agy` 或绝对路径运行。

## 安装

1. 在 DSH 插件管理中安装组合包，安装输入框填包名：`@jiezhengj/subagent_oar_agy`（主路径，支持后续检查更新）。
   - tgz 备选：`https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/download/v0.2.6/subagent_oar_agy-0.2.6.tgz`
   - 或本地 tarball：`dsh plugin add /path/to/subagent_oar_agy-<version>.tgz`
2. 在插件列表启用「AGY 子智能体」（包名 `@jiezhengj/subagent_oar_agy`），按提示重载；模型工具列表出现 `subagent_oar_agy`。

安装后默认 `permissionMode: yolo`，如不希望自动执行，先改成 `plan` 或 `strict` 再启用（见 README）。

## 升级

按名称安装后，可在插件管理的版本区检查更新并一键升级；升级后配置保留，无需重新填写。升级后建议做一次最小委派验证；官方 OAR 工具包版本在本组合包内精确锁定，随组合包一起升级。

## 禁用与重新启用

禁用组合包后，`subagent_oar_agy` 工具与 `agy` 提供方一并移除；DSH 其他功能不受影响。重新启用后原配置继续生效。

## 工具名冲突

本插件默认工具名是 `subagent_oar_agy`，与官方 OAR 组合包的 `subagent_oar` 不冲突，可同时启用。若你希望本插件也用 `subagent_oar`（仅在没有官方 OAR 时），按 README 覆盖 `toolName`；DSH 对重复工具名会明确报错并拒绝注册第二个，不会静默覆盖。

## 卸载

`dsh plugin remove @jiezhengj/subagent_oar_agy`（或在插件管理中移除）。卸载不会修改 agy 的安装、登录状态或配置。
