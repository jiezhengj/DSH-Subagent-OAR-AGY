# 安装与升级

## 前置条件

- DeepSeek Harness 0.2.2-rc.1 或更高（组合包 `engines.dsh` 为 `>=0.2.2-rc.1 <0.3.0`）。
- 本机已安装并登录 Antigravity CLI（agy 1.5 及以上），终端里能以 `agy` 或绝对路径运行。

## 安装

1. 在 DSH 插件管理中安装组合包：
   - 本地目录：`dsh plugin add /path/to/dsh-subagent-agy-bundle`
   - 或发布后：`dsh plugin add dsh-subagent-agy-bundle`
2. 在插件列表启用 `dsh-subagent-agy-bundle`，按提示重载；模型工具列表出现 `subagent_oar`。

安装后默认 `permissionMode: yolo`，如不希望自动执行，先改成 `plan` 或 `strict` 再启用（见 README）。

## 升级

安装新版本后配置保留，无需重新填写。升级后建议做一次最小委派验证；官方 OAR 工具包版本在本组合包内精确锁定，随组合包一起升级。

## 禁用与重新启用

禁用组合包后，`subagent_oar` 工具与 `agy` 提供方一并移除；DSH 其他功能不受影响。重新启用后原配置继续生效。

## 工具名冲突

若同时启用了官方 OAR 组合包，两个插件都会注册 `subagent_oar`。给本插件的工具行加 `toolName: subagent_agy`（见 README）以避免冲突；若 DSH 对重复工具名报错，按提示改名后重载。

## 卸载

`dsh plugin remove dsh-subagent-agy-bundle`（或在插件管理中移除）。卸载不会修改 agy 的安装、登录状态或配置。
