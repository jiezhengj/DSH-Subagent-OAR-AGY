# 安装与升级

## 前置条件

- DeepSeek Harness 0.2.2-rc.1 或更高（组合包 `engines.dsh` 为 `>=0.2.2-rc.1 <0.3.0`）。
- 本机已安装并登录 Antigravity CLI（agy 1.5 及以上），终端里能以 `agy` 或绝对路径运行。

## 安装

1. 在 DSH 插件管理中安装组合包，安装输入框填包名：`@jiezhengj/subagent-oar-agy`（主路径，支持后续检查更新）。
   - tgz 备选：`https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/download/v0.2.8/subagent-oar-agy-0.2.8.tgz`
   - 或本地 tarball：`dsh plugin add /path/to/subagent_oar_agy-<version>.tgz`
2. 在插件列表启用「AGY 子智能体」（包名 `@jiezhengj/subagent-oar-agy`），按提示重载（必要时重启 DSH）；模型工具列表出现 `subagent_oar_agy`。
3. 安装或升级完成后，在新会话调用 `subagent_oar_agy` 验证工具可用。

安装后默认 `permissionMode: yolo`，如不希望自动执行，先改成 `plan` 或 `strict` 再启用（见 README）。

## 从 tgz 迁移到名称安装

已通过 tgz 安装的 profile 不能直接检查更新。先在插件管理移除旧条目（或执行 `dsh plugin remove @jiezhengj/subagent-oar-agy`），再按上面的名称重新安装；插件配置通常会保留；若配置随旧条目被移除，重新填写原来的设置即可。装好后版本区应显示当前版本与「已是最新版本」，后续可在应用内检查更新。

## 升级

按名称安装后，可在插件管理的版本区检查更新并一键升级；升级后配置保留，无需重新填写。升级后建议做一次最小委派验证；官方 OAR 工具包版本在本组合包内精确锁定，随组合包一起升级。

## 禁用与重新启用

禁用组合包后，`subagent_oar_agy` 工具与 `agy` 提供方一并移除；DSH 其他功能不受影响。重新启用后原配置继续生效。

## 工具名冲突

本插件默认工具名是 `subagent_oar_agy`，与官方 OAR 组合包的 `subagent_oar` 不冲突，可同时启用。若你希望本插件也用 `subagent_oar`（仅在没有官方 OAR 时），按 README 覆盖 `toolName`；DSH 对重复工具名会明确报错并拒绝注册第二个，不会静默覆盖。

## 卸载

`dsh plugin remove @jiezhengj/subagent-oar-agy`（或在插件管理中移除）。卸载不会修改 agy 的安装、登录状态或配置。
