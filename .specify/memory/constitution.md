# subagent_oar_agy Constitution

## 核心原则

### I. 官方优先，最小自研

必须优先复用官方 DSH 与 OAR 的包、契约与工具表面（例如官方 `subagent_oar` 工具、DSH 子代理接缝与助手函数）。自研代码只允许出现在官方未提供、且确属本插件职责的部分（AGY 运行时适配层）。每一处自研都必须在 plan 中说明理由与被放弃的替代方案；能用配置行解决的问题不得写代码。

Rationale：DSH 插件面处于实验期，复用官方实现可显著降低 API 漂移风险与维护成本。

### II. 非 ACP 与外部进程边界

必须只通过官方 `agy` CLI 子进程（`agy -p`）委派任务。禁止在本项目内实现 ACP、`agy_acp_server` 兼容层或任何 ACP 客户端/服务端；禁止抽取或复用 AGY 的 OAuth token；禁止直接调用 Antigravity 后端 API；禁止账号轮换。`agy` 必须作为独立进程运行，不随插件打包或部署。

Rationale：非 ACP 是用户给定的硬约束；只启动官方 CLI 也是与 Antigravity 政策边界保持一致的唯一安全做法。

### III. 一次性委派契约

提供方必须声明为一次性外部执行：`inheritsParentContext` 为 false，且不得实现 `prepareContinuable`。`result` 不得因模型或传输失败而 reject，必须通过 `stopReason: 'error'` 结算；`dispose()` 必须幂等，并等待子进程真正退出后才返回。必须遵守官方 `subagent_oar` 工具对 provider 的校验与映射语义。

Rationale：DSH 子代理接缝的契约直接决定工具是否接受该 provider，以及父会话能否可靠收到完成通知。

### IV. 可安装、可恢复、可诊断

必须以组合包（bundle）分发：可安装、可禁用、可升级，并声明 `engines.dsh` 或 DSH peer 兼容范围。插件加载失败或 AGY 异常不得破坏 DSH 启动，用户必须能通过禁用插件恢复。失败必须可诊断：AGY 未安装、未登录、超时、异常等场景须给出可操作错误，不得静默失败或无限挂起。

Rationale：这些是问题定义中的成功指标，也是第三方插件被信任的前提。

### V. 透明默认与合规声明

默认采用 `--dangerously-skip-permissions`（与官方 OAR 的 Claude 运行时及 Paseo 实践一致），但必须在 README 中显式声明其含义、风险与更保守的配置方式。文档必须声明本插件是非官方封装、自担风险，并记录 Antigravity 对第三方封装的政策表述；不得暗示获得 Google 官方支持。

Rationale：默认值来自用户决策；透明声明是承担风险的前提。

## 附加约束

- 技术栈：TypeScript（ESM），运行于 DSH 的 Node 运行时；打包与发布遵循 DSH 插件包约定（`dsh.bundle.patch`、locale/display meta、`engines.dsh`）。
- 版本策略：以 DSH 0.2.2-rc.1 为基线并表达兼容范围；不主动设置 AGY CLI 版本上下限，解析器必须容错未知事件与字段。
- 范围：仅支持 AGY 运行时，不扩展为通用外部 CLI 封装。
- 合规：npm 包名、scope、许可证与免责声明在 plan 阶段确定；发布前完成 ToS 风险说明。

## 开发工作流

- 遵循项目 `AGENTS.md` 的 Spec Kit 治理：Feature SDD 按短路径或完整路径逐阶段推进，每阶段产物审阅后再继续。
- 实现前必须先完成 spike：验证官方 `@deepseek-ai/dsh-experimental-tool-subagent-oar` 在 0.2.2-rc.1 可安装，且 `providers` 接受自写 provider；失败则退 Option B（自写同形工具）。
- 测试门槛：提供方单元测试（事件流解析、错误映射、取消/超时）、组合包安装冒烟、一次经用户授权的真实 AGY 端到端冒烟。
- 提交规范：Conventional Commits；评估/规格文档与实现代码分开提交。

## 治理

本宪法优先于其他实践与模板；与 `AGENTS.md` 冲突时以本宪法为准，并同步修订后者。修订必须文档化：变更说明、理由与迁移计划；版本按语义化版本递增（MAJOR：移除或重定义原则；MINOR：新增原则或实质性扩展；PATCH：澄清与措辞修正）。每个 spec、plan、tasks 都必须检查合规性；复杂度必须被论证。运行时开发指导见项目 `AGENTS.md`。

**Version**: 1.0.0 | **Ratified**: 2026-11-07 | **Last Amended**: 2026-11-07
