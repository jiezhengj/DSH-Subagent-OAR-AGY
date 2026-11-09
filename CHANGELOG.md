# 0.3.0 — 2026-11-09

可观察性与控制版本。

- 新增启动看门狗（默认 60 秒）与静默看门狗（默认 15 分钟）；到期终止 AGY 进程树，并以 `startup-timeout` / `stalled` 分类失败。
- 新增 `subagent_oar_agy_control` 工具：`status` 查询当前父会话的 AGY 运行摘要，`cancel` 提交停止请求；`controlToolName` 可改名。
- 状态快照有界：每个父会话最多 50 个运行、每个运行最多 20 条活动、`lastText` 最多 200 字符；不返回 prompt、工具参数、完整答复或原始 stderr。
- 修正 `lastEventKind` 为协议事件类型；取消终态不再写 `failureCategory`；重复取消返回 `accepted:true` / `already-requested`。
- AGY 使用官方 `scrubbedParentEnv()` 清洗后的环境；父会话诊断只含分类与建议，本机日志脱敏。
- 集成测试覆盖启动/静默/绝对超时竞争、进程树终止、并发隔离、状态、取消、环境清洗、TTL 与效果清理。

安装：`@jiezhengj/subagent-oar-agy`；tgz 备选见 Release `v0.3.0`。

# 0.2.8 — 2026-11-09

- 分发名称更正为 `@jiezhengj/subagent-oar-agy`；真实桌面 profile 迁移并完成真实 AGY 冒烟。
- 发布 `v0.2.8` GitHub Release 与 npm 包。

# 0.2.7 — 2026-11-08

- 为验证应用内更新发布内容等价的 `0.2.7`。

# 0.2.6 — 2026-11-08

- 首次发布短名称 npm 包。

# 0.2.5 — 2026-11-08

- 官方工具回退、安装文档与合规修正。
