# 实现说明

## 概述

本插件把独立任务委派给本机 Antigravity CLI（`agy`）。模型通过 `subagent_oar_agy` 工具发起委派，插件启动 `agy --input-format stream-json --output-format stream-json` 子进程，解析 NDJSON 事件流，把终态答复交回 DSH。模型侧复用官方 OAR 工具的实现与参数形态，插件只提供非 ACP 的 AGY 运行时。

## 要求

- 本机已安装 Antigravity CLI（`agy`），并至少完成一次交互登录。
- DSH 0.2.2-rc.1 或兼容版本。
- 支持 macOS、Linux 与 Windows（POSIX 进程组终止 / taskkill）。

## 安装与使用

1. 在插件页安装并启用本组合包。
2. 新会话中让模型把任务交给 AGY，或直接要求调用 `subagent_oar_agy`。
3. 工具参数：`runtime`（固定 `agy`）、`description`、`prompt`、可选 `cwd`。

## 权限

- `yolo`（默认）：无人值守执行。
- `plan`：只读规划，不写入。
- `strict`：需要权限的动作由 AGY 自动拒绝，结果中会附可见说明。
  权限档被自动拒绝时不会静默失败，你会看到被拒绝的动作与放行方法。

## 数据与隐私

任务文本只发送给本机 `agy` 进程；插件不读取、不存储、不转发 AGY 的凭据或认证文件，也不修改其全局配置。

## 工具名与共存

默认工具名是 `subagent_oar_agy`，与官方 OAR 组合包的 `subagent_oar` 互不冲突，可同时启用。如需沿用 `subagent_oar`，可在 profile patch 中覆盖 `toolName`。

## 声明

本插件是非官方封装，与 DeepSeek、Google 均无隶属关系；使用风险自担，请遵守 Antigravity 的服务条款。
