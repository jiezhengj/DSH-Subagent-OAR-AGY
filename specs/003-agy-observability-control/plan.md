# Implementation Plan: AGY 委派可观察性与生命周期控制

**Branch**: `003-agy-observability-control` | **Date**: 2026-11-09 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-agy-observability-control/spec.md`

## Summary

在现有 `subagent_oar_agy` 组合包上增加三层能力，同时保持官方 OAR 委派工具的参数、返回结构和一次性外部执行契约不变：

1. **生命周期看门狗**：启动等待窗口 + 运行静默窗口；超时后终止 AGY 进程树、以 `error` 结算并让共享子代理服务通知父会话。
2. **父级运行登记与一个控制工具**：在 provider 内维护有界的运行记录和最近活动；一个模型可见工具 `subagent_oar_agy_control` 提供 `status` 和 `cancel` 两个动作，取消通过官方 `ctx.subagents.interrupt` 授权执行。
3. **安全边界**：子进程环境先经过官方 `scrubbedParentEnv()` 清理，再叠加显式 `env`；父级只收到分类诊断，原始 stderr/路径细节只进入本机脱敏日志。

不修改 DSH 核心、不修改官方 OAR 工具、不增加 ACP、不提供继续/恢复/实时流。

## Technical Context

**Language/Version**: TypeScript 5.9（ESM），Node.js >=22；目标 DSH 0.2.2-rc.1 至 <0.3.0

**Primary Dependencies**: `@deepseek-ai/cordis` 4.1.0、`@deepseek-ai/dsh-subagent` 0.2.2-rc.1、`@deepseek-ai/dsh-tools` 0.2.2-rc.1、`@deepseek-ai/dsh-subprocess` 0.2.2-rc.1（新增，复用官方环境清洗）、`@deepseek-ai/schemastery` 3.19.0；测试使用 Vitest 5

**Storage**: 仅进程内存；provider 内按父会话保存有界运行记录和活动环形缓冲；无数据库、无跨进程持久化

**Testing**: Vitest 单元测试（注册表、状态/取消工具、看门狗、环境清洗、诊断脱敏）、现有 fake AGY 集成测试、组合包安装/校验测试、经用户授权的真实 AGY 冒烟

**Target Platform**: DSH Desktop / Headless 支持的 macOS、Linux、Windows；沿用现有 PATH/PATHEXT 解析与进程树终止实现

**Project Type**: DSH 组合包（bundle）+ 外部 provider + 工具插件

**Performance Goals**: 状态查询只读内存，单次查询 O(当前父会话运行数)，最多 50 条保留记录；活动缓冲每运行最多 20 条；看门狗使用 unref 计时器，不阻止进程退出；空闲时不增加后台轮询

**Constraints**: 不修改官方 `subagent_oar` schema；不改变 `subagent_oar_agy` 的启动参数/返回值；不实现 ACP、继续、恢复、结构化输出、完整流式输出；不把原始 stderr 或凭据送入父会话；不承诺 Host 崩溃后的通知恢复

**Scale/Scope**: 单进程、单父会话通常 1–8 个并发委派（受 DSH 容量限制）；保留策略按父会话隔离；三个模块（provider registry、bundle tool、现有 run 生命周期）加测试与文档

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 宪法原则 | 检查 | 结果 |
|---|---|---|
| I. 官方优先，最小自研 | 继续复用官方 `subagent_oar` 工具、`ctx.subagents` 容量/生命周期/通知、`ctx.subagents.interrupt`、`scrubbedParentEnv()`；自研仅限官方未提供的 AGY 运行登记/看门狗 | PASS |
| II. 非 ACP 与外部进程边界 | 仍只启动本机 `agy` 子进程；不引入 ACP、OAuth、后端 API 或账号轮换 | PASS |
| III. 一次性委派契约 | 不实现 `prepareContinuable`、`inheritsParentContext` 仍为 false；结果仍通过 `SubagentRun.result` 结算；`dispose()` 幂等且等待退出 | PASS |
| IV. 可安装、可恢复、可诊断 | 新增配置和工具随 bundle 分发；看门狗保证不无限挂起；失败有分类与本地脱敏日志；禁用插件后工具/计时器移除 | PASS |
| V. 透明默认与合规声明 | `permissionMode` 默认不变；新增超时/保留/诊断行为写入 README 与 DETAIL；不暗示官方支持 | PASS |

**结论**: 无宪法违反项；无需 Complexity Tracking 例外。

## Project Structure

### Documentation (this feature)

```text
specs/003-agy-observability-control/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── control-tool.md
│   └── run-status.schema.json
├── checklists/
│   └── requirements.md
└── tasks.md              # 由 /speckit-tasks 生成
```

### Source Code (repository root)

```text
packages/subagent-oar-agy-provider/
├── src/
│   ├── index.ts          # 新增配置：startupTimeoutMs / stallTimeoutMs / retention / activity limit
│   ├── run.ts            # 启动/静默看门狗、活动采集、终态登记
│   ├── runs.ts           # 新增：父级有界 RunRegistry、状态快照、取消请求
│   ├── agy/
│   │   ├── spawn.ts      # 环境：scrubbedParentEnv + 显式 env
│   │   ├── errors.ts     # 父级分类诊断；本地脱敏摘要
│   │   └── protocol.ts   # 复用现有事件类型，补充活动字段读取
│   └── i18n.ts           # 新增超时/静默/未找到/无权等文案（8 语言）
└── test/
    ├── runs.test.ts      # 新增
    ├── integration.test.ts
    ├── ...现有测试
    └── fixtures/fake-agy.mjs  # 新增 no-init / silent / slow 等模式

packages/subagent-oar-agy-bundle/
├── tool.js               # 挂载官方工具后注册 subagent_oar_agy_control
├── cordis.patch.yml      # 控制工具随同一工具行注册，无需额外行
├── test/
│   ├── tool.test.ts      # 控制工具注册/动作/权限隔离
│   └── bundle.test.ts
├── docs/DETAIL.<lang>.md # 新增状态/取消/超时/安全边界说明
├── README.md             # 配置表和默认值
└── package.json          # 新增 dsh-subprocess 依赖（如采用官方 helper）

packages/subagent-oar-agy-provider/package.json
└── 新增 dsh-subprocess peer/dev 依赖与 dsh-tools 测试依赖（按实现需要）
```

**Structure Decision**: 保持现有“provider 包 + bundle 包”结构；运行登记放在 provider 内（与 AGY 生命周期同处），控制工具放在 bundle 的 `tool.js`（复用现有官方工具挂载路径）；不新增独立 provider 包或 DSH 核心改动。

## Phase 0: Research

见 [research.md](./research.md)。需要解决的决定：

- 控制工具采用一个 `action` 工具还是两个独立工具。
- 启动/静默窗口默认值与可配置边界。
- 运行登记、终态保留与活动缓冲上限。
- 环境清洗复用官方 helper 还是本地复制。
- 父级安全诊断与本地日志的切分。
- 取消走 `ctx.subagents.interrupt` 还是直接 `run.dispose()`。
- 控制工具注册位置与官方工具配置的兼容方式。

## Phase 1: Design & Contracts

- [data-model.md](./data-model.md)：运行记录、活动摘要、状态快照、取消请求、配置边界。
- [contracts/control-tool.md](./contracts/control-tool.md)：`subagent_oar_agy_control` 的输入、输出、错误与权限语义。
- [contracts/run-status.schema.json](./contracts/run-status.schema.json)：状态快照的机器可读结构。
- [quickstart.md](./quickstart.md)：验证场景、测试命令和真实 AGY 冒烟步骤。

## Post-Design Constitution Check

| 宪法原则 | 设计后复核 | 结果 |
|---|---|---|
| I. 官方优先 | 控制工具只是官方未提供的观察/控制补充；不复制官方委派工具；取消与清洗复用官方接缝 | PASS |
| II. 非 ACP | 仍只有 AGY CLI 子进程 | PASS |
| III. 一次性契约 | 新工具不改变 provider 能力声明和 `result` 语义 | PASS |
| IV. 可安装/可诊断 | 新配置有默认值；失败分类和本地日志可操作；看门狗有界 | PASS |
| V. 透明默认 | 文档说明新增默认窗口、数据保留和诊断边界 | PASS |

## Complexity Tracking

无宪法违反项，无需例外记录。

## Implementation Sequence

1. 运行登记与活动采集（`runs.ts` + `run.ts` 接线）。
2. 启动/静默看门狗与终态去重。
3. 环境清洗与安全诊断。
4. 控制工具（status/cancel）与 bundle 注册。
5. 配置、i18n、README/DETAIL 文档。
6. 单元/集成/组合包测试与真实 AGY 冒烟。

## Risks & Mitigations

- **静默窗口误杀长工具**：默认 15 分钟，可配置；文档建议长任务调大或使用绝对 `timeoutMs`；活动事件包含 step/tool 更新。
- **控制工具在旧会话不可见**：DSH 会话工具表在创建时固定；文档说明需新会话，升级提示重启/重载。
- **终态重复通知**：所有终止路径共用单次 `stopped` 结算；登记表只记录首次终态；测试覆盖竞争。
- **环境清洗导致认证失败**：保留 `HOME`/`PATH`；需要额外凭据时通过显式 `env` 提供，并在诊断中提示。
- **父级诊断泄露**：父级只发分类/建议；原始细节仅本地日志并脱敏；测试用敏感标记回归。
- **内存增长**：活动上限、运行记录上限、终态 TTL 三重约束；状态查询可触发惰性清理。
- **插件禁用后的活动运行**：provider effect 清理停止计时器、清空登记表，并对未结算运行执行现有 teardown/终止；不留下无监控的 AGY 进程。
