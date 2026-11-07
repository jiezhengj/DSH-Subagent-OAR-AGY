# 想法捕获：仿照官方 subagent_oar 做 subagent_oar_agy（对接本机 AGY CLI）

- **Slug**: subagent-oar-agy
- **Created**: 2026-11-07
- **Source**: 用户消息（粘贴文本）；本 intake 取代 `subagent-oar-delegation`（原 intake 问的是"使用官方 OAR 工具"，现修正为"自建 AGY 变体"）
- **Type**: new-capability

## 捕获的原想法

> 我真正想要 intake 的问题是，能否仿照该官方插件，做一个插件「subagent_oar_agy」，可将独立任务交给本机 AGY CLI。
> 但我在本版本 DSH 里就没看到「subagent_oar工具」插件，只看到老的 @deepseek-ai/dsh-subagent-codex、@deepseek-ai/dsh-subagent-claude-code。
> 最先的问题是，到底这个插件在哪？如何启用？新插件和以前 2 个老插件的区别是什么？

## 重述

评估是否值得做一个新插件 `subagent_oar_agy`，把独立任务从 DSH 会话内交给本机 AGY（Antigravity）CLI 执行；先弄清官方 `subagent_oar` 插件的存在形式与启用方式、它与现有两个原生子智能体提供方（Codex / Claude Code）的差异，再决定自建形态与范围。

## 来源与背景

- **提出者**：当前用户。
- **触发**：DSH v0.2.2-rc.1 发布说明提到实验性 `subagent_oar` 工具；用户在已安装的桌面版中看不到该插件，只看到两个老的 subagent 提供方；本机已装 AGY CLI，希望把外部委派目标换成 AGY。
- **已知本机事实**：AGY CLI 为 `~/.local/bin/agy`（1.5.3，提供 `agy acp` ACP stdio 子命令）；Codex / Claude CLI 未安装；DSH 0.2.2-rc.1 的 `desktop` profile 未包含 OAR 两个包，官方组合包目录也无 OAR 条目。

## 初判未知

- [NEEDS CLARIFICATION: 目标形态是"本机自用（配置或小包装）"、"可分发插件包"，还是"提交 DSH 上游"？]
- [NEEDS CLARIFICATION: OAR 0.67.0 的 antigravity 适配会启动独立二进制 `agy_acp_server`（macOS 默认 `agy_acp_server.par`，可用 `OAR_ANTIGRAVITY_BIN` 覆盖），而本机只有一个 `agy` 可执行文件（ACP 通过 `agy acp` 子命令）；能否用包装器/环境变量对接，还是必须新写 provider？]
- [NEEDS CLARIFICATION: 是否复用 DSH 已有的 ACP 子智能体后端（源码中的 `@deepseek-ai/dsh-subagent-acp`）而非另起插件？该包是否随桌面版提供/可安装？]
- [NEEDS CLARIFICATION: 新插件只需单次任务，还是要多轮/可继续/结构化输出？]
- [NEEDS CLARIFICATION: 权限边界：AGY 的 `--dangerously-skip-permissions` / ACP yolo 模式是否允许？]
- [NEEDS CLARIFICATION: 命名与归属：`subagent_oar_agy` 是插件名、工具名还是 providerName？是否需与官方 OAR 并存？]
