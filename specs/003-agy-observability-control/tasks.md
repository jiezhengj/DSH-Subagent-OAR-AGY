# Tasks: AGY 委派可观察性与生命周期控制

**Input**: Design documents from `/specs/003-agy-observability-control/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 本 Feature 包含测试任务；项目宪法要求提供方单元测试、组合包冒烟和真实 AGY 端到端冒烟。

**Organization**: 按用户故事分组；每个故事在依赖允许时独立完成和验证。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无未完成依赖）
- **[Story]**: 对应用户故事（US1–US5）
- 每个任务包含明确文件路径

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 依赖、配置与测试替身准备

- [x] T001 在根 `package.json`、`packages/subagent-oar-agy-provider/package.json`、`packages/subagent-oar-agy-bundle/package.json` 添加 `@deepseek-ai/dsh-subprocess@0.2.2-rc.1`，运行 `pnpm install` 并确认 `import { scrubbedParentEnv } from '@deepseek-ai/dsh-subprocess'` 可解析；不可解析时暂停并记录偏差，不静默改回全量环境继承
- [x] T002 [P] 扩展 `packages/subagent-oar-agy-provider/test/fixtures/fake-agy.mjs`，新增 `no-init`、`silent`、`crash-no-result`、`sensitive-stderr`、`env-dump`、`tree` 模式，并保留现有模式
- [x] T003 [P] 在 `packages/subagent-oar-agy-provider/test/test-helpers.ts` 新增测试辅助：可识别 canary 环境、读取子进程环境转储、等待终态的超时包装

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 运行登记、配置和 i18n 是所有用户故事的共同基础

**⚠️ CRITICAL**: 本阶段完成前不得开始用户故事实现

- [x] T004 在 `packages/subagent-oar-agy-provider/src/runs.ts` 定义 `RunRecord`、`ActivityEntry`、`StatusSnapshot`、`CancelReceipt` 和 `RunRegistry`；实现按 `parentId` 索引、`childId` 唯一、单次终态裁决；默认值必须与 data-model 一致并可被 T006 的配置覆盖：`activityLimit=20`、`lastText≤200`、`summary≤160`、`terminalRetentionMs=300000`、`maxRecordsPerParent=50`
- [x] T005 在 `packages/subagent-oar-agy-provider/test/runs.test.ts` 覆盖登记/查询/父级隔离/记录上限/终态幂等/未知 childId 不泄露
- [x] T006 在 `packages/subagent-oar-agy-provider/src/index.ts` 增加配置 `startupTimeoutMs`（默认 60000）、`stallTimeoutMs`（默认 900000）、`activityLimit`（默认 20）、`terminalRetentionMs`（默认 300000）、`maxRecordsPerParent`（默认 50）；校验为整数并限制范围：两个超时与保留时间为 1–2_147_483_647，`activityLimit` 为 1–20，`maxRecordsPerParent` 为 1–50；拒绝非法值
- [x] T007 [P] 在 `packages/subagent-oar-agy-provider/src/i18n.ts`（8 语言）新增文案键：启动超时、静默超时、未找到/无权、取消已受理/已请求/已结束/不可用
- [x] T008 在 `packages/subagent-oar-agy-provider/src/run.ts` 接线 registry：spawn 后登记 `childId=run.id` 与 `request.parent.id`；`init` 更新 `readyAt`；`step_update` 更新活动；`result`/close/abort/超时更新终态；所有路径只调用一次终态登记；在 `packages/subagent-oar-agy-provider/src/index.ts` 的 `apply` 注册 effect 清理，插件卸载时停止计时器、清空登记表，并对该 provider 尚未结算的运行执行现有 teardown/终止，不留下可调用的后台监控或无监控进程
- [x] T009 在 `packages/subagent-oar-agy-provider/test/integration.test.ts` 增加基础断言：成功运行在 registry 中从 `starting` 到 `running` 到 `completed`，且终态字段与 `SubagentResult` 一致

**Checkpoint**: registry、配置、i18n 和 run 接线完成；US1/US2/US3/US4/US5 可以开始。

---

## Phase 3: User Story 1 - 委派不会永久沉默 (Priority: P1) 🎯 MVP

**Goal**: 启动卡住或运行静默时，在配置窗口内终止并通知父会话。

**Independent Test**: 用 fake `no-init` 和 `silent` 各启动一次，确认窗口到期后 `stopReason: error`、有分类诊断、进程树退出，父会话收到通知。

### Tests for User Story 1

- [x] T010 [US1] 在 `packages/subagent-oar-agy-provider/test/integration.test.ts` 增加 `no-init` + `startupTimeoutMs: 300` 用例，断言失败分类为启动超时、窗口结束后 5 秒内结算且无残留进程
- [x] T011 [US1] 在 `packages/subagent-oar-agy-provider/test/integration.test.ts` 增加 `silent` + `stallTimeoutMs: 300` 用例，断言失败分类为静默超时、窗口结束后 5 秒内结算且无残留进程
- [x] T012 [US1] 在 `packages/subagent-oar-agy-provider/test/integration.test.ts` 增加绝对 `timeoutMs` 与静默窗口竞争用例，断言 `failureCategory === "timeout"`、只有一次终态/一次通知

### Implementation for User Story 1

- [x] T013 [US1] 在 `packages/subagent-oar-agy-provider/src/run.ts` 从 spawn 起启动 `startupTimeoutMs` 计时，收到 `init` 时清除；到期调用现有取消/终止阶梯并以 `error` 结算
- [x] T014 [US1] 在 `packages/subagent-oar-agy-provider/src/run.ts` 在 `init` 后启动 `stallTimeoutMs`，每个已解析 AGY 事件和生命周期边沿（init、结算）重置；到期以 `error` 结算并终止进程树
- [x] T015 [US1] 在 `packages/subagent-oar-agy-provider/src/agy/errors.ts` 与 `src/i18n.ts` 增加 `startup-timeout`、`stalled` 分类映射（8 语言）；父级诊断只含分类和可操作建议
- [x] T016 [US1] 在 `packages/subagent-oar-agy-provider/src/run.ts` 统一 `interrupt`/`terminal`/`attempt` 的相位与终态裁决，确保启动超时、静默超时、绝对超时、取消、正常完成只产生一次终态；同步更新 registry 终态；终止失败/进程未退出时记录可诊断信息，不阻塞结算

### Verification tests for User Story 1

- [x] T017 [US1] 在 `packages/subagent-oar-agy-provider/test/integration.test.ts` 增加进程树终止断言：启动 `tree` 模式的 fake AGY，超时后父/子 PID 均不存活
- [x] T018 [US1] 在 `packages/subagent-oar-agy-provider/test/integration.test.ts` 增加并发用例：一个正常、一个启动卡住、一个静默；互不影响，各自只通知一次

**Checkpoint**: US1 独立可验证；父 Agent 不会因启动卡住或静默而永久等待。

---

## Phase 4: User Story 2 - 能查询委派的当前状态 (Priority: P1)

**Goal**: 当前父会话可查询 AGY 委派的实时/终态摘要，不创建或恢复任何任务。

**Independent Test**: 在启动中、运行中、成功、失败、取消后分别查询，确认状态、耗时、最近活动和终态准确；跨父会话/不存在返回不泄露结果。

### Tests for User Story 2

- [x] T019 [US2] 在 `packages/subagent-oar-agy-provider/test/runs.test.ts` 增加状态快照测试：字段完整性、`action:"status"`、`lastText≤200`、`activity≤20`、按 `startedAt` 降序、`found` 语义
- [x] T020 [US2] 在 `packages/subagent-oar-agy-bundle/test/tool.test.ts` 增加控制工具注册测试：默认名 `subagent_oar_agy_control`、官方/回退工具保持原名、`controlToolName` 覆盖与空串拒绝、传给官方工具的配置不含控制字段、effect 释放后控制工具不可调用

### Implementation for User Story 2

- [x] T021 [US2] 在 `packages/subagent-oar-agy-provider/src/runs.ts` 实现 `status(parentId, childId?)`：只返回当前父级记录；指定不存在/已清理/其他父级统一 `found:false, runs:[]`；空列表返回 `found:true, runs:[]`
- [x] T022 [US2] 在 `packages/subagent-oar-agy-bundle/tool.js` 增加控制工具定义与 `status` action：参数 `action: "status"|"cancel"`、可选 `childId`；输出为 `{ action: "status", ... }` 并直接符合 `specs/003-agy-observability-control/contracts/run-status.schema.json`；`status` 无副作用
- [x] T023 [US2] 在 `packages/subagent-oar-agy-bundle/tool.js` 的 `mountTool()` 成功后注册控制工具；新增 `controlToolName` 配置默认 `subagent_oar_agy_control` 且校验非空，传给官方工具前剥离该配置；控制工具注册随 Cordis effect 释放，禁用后不可调用

### Verification tests for User Story 2

- [x] T024 [US2] 在 `packages/subagent-oar-agy-bundle/test/tool.test.ts` 增加 `status` 行为测试：空列表、指定运行、未知 childId、跨父级隔离、无 AGY 调用
- [x] T025 [US2] 在 `packages/subagent-oar-agy-provider/test/integration.test.ts` 增加运行中查询：启动 slow fake，查询到 `starting/running`、pid、lastActivityAt；完成后查询到 `completed`

### Documentation for User Story 2

- [x] T026 [US2] 在 `packages/subagent-oar-agy-bundle/docs/DETAIL.zh.md` 与 `README.md` 增加 status 用法示例和字段说明（其他语言在 Polish 补）

**Checkpoint**: US2 独立可验证；用户/模型可以判断委派是启动中、运行中还是已结束。

---

## Phase 5: User Story 3 - 能主动停止不需要的委派 (Priority: P2)

**Goal**: 当前父会话可显式请求取消直接 AGY 委派；受理异步、终态由共享服务通知。

**Independent Test**: 启动 slow fake，显式 cancel，确认 `accepted:true`、进程树终止、父会话收到停止通知；重复 cancel 和取消已结束任务无异常。

### Tests for User Story 3

- [x] T027 [US3] 在 `packages/subagent-oar-agy-provider/test/runs.test.ts` 增加取消登记测试：首次 `accepted`、重复 `already-requested`、已结束 `already-ended`、不存在/无权 `not-found`
- [x] T028 [US3] 在 `packages/subagent-oar-agy-bundle/test/tool.test.ts` 增加 cancel 参数测试：缺少 `childId` 参数校验失败；无权/不存在不泄露；`unavailable` 只返回安全分类

### Implementation for User Story 3

- [x] T029 [US3] 在 `packages/subagent-oar-agy-provider/src/runs.ts` 增加 `requestCancel(parentId, childId)`：只记录首次 `cancelRequestedAt`，返回 `accepted`/`already-requested`/`already-ended`/`not-found`，不直接改终态
- [x] T030 [US3] 在 `packages/subagent-oar-agy-bundle/tool.js` 实现 `cancel` action：校验当前 `exec.agent`（缺失时返回 `accepted:false, reason:"unavailable"`）、调用 `ctx.subagents.interrupt(childId, { kind: 'ancestor', agent: exec.agent })`，成功返回受理收据；异常只返回 `unavailable` 并写脱敏本地日志

### Verification tests for User Story 3

- [x] T031 [US3] 在 `packages/subagent-oar-agy-provider/test/integration.test.ts` 增加取消集成测试：slow fake + cancel，断言进程树退出、`SubagentRun.result` 为 `aborted`/停止、父级通知一次
- [x] T032 [US3] 在 `packages/subagent-oar-agy-provider/test/integration.test.ts` 增加竞态测试：cancel 与正常完成/超时同时触发，断言只有一次终态与一次通知

**Checkpoint**: US3 独立可验证；用户可以不关闭父会话而停止错误/过长的 AGY 委派。

---

## Phase 6: User Story 4 - 环境与诊断不会越过安全边界 (Priority: P2)

**Goal**: AGY 不继承凭据形状变量和 `DSH_*`；父级诊断不泄露原始细节；本地日志保留脱敏摘要。

**Independent Test**: 注入 canary 和 `DSH_*`，用 fake `env-dump` 断言不存在；用 fake `sensitive-stderr` 断言父级诊断不含 canary、本地日志已脱敏。

### Tests for User Story 4

- [x] T033 [US4] 在 `packages/subagent-oar-agy-provider/test/integration.test.ts` 增加环境清洗测试：canary、`DSH_*`、显式 env、`null` 删除、`PATH`/`HOME` 保留
- [x] T034 [P] [US4] 在 `packages/subagent-oar-agy-provider/test/errors.test.ts` 增加诊断脱敏测试：Bearer、API key、token、URL 凭据、`sk-` 形状、绝对路径和超长 stderr
- [x] T035 [US4] 在 `packages/subagent-oar-agy-provider/test/integration.test.ts` 增加敏感 stderr 端到端测试：父级诊断不含 canary，本机日志包含脱敏摘要

### Implementation for User Story 4

- [x] T036 [US4] 在 `packages/subagent-oar-agy-provider/src/agy/spawn.ts` 将 `agyEnvironment()` 改为 `{ ...scrubbedParentEnv(), ...explicitEnv }`，保留 `null` 删除语义；不改变 PATH/PATHEXT 解析
- [x] T037 [US4] 在 `packages/subagent-oar-agy-provider/src/agy/errors.ts` 将父级诊断改为“分类 + 建议 + 安全工具名”；所有父级 `failureDiagnostic` 调用都不得传入 `summarizeStderr()`、`spawnError.message`、`result.error` 或其他原始细节
- [x] T038 [US4] 在 `packages/subagent-oar-agy-provider/src/run.ts` 将原始 stderr/退出码/原始错误经脱敏后写入 `ctx.logger.warn`，消息带 run id；父级只收到 `failureDiagnostic` 安全文本

### Verification tests for User Story 4

- [x] T039 [US4] 在 `packages/subagent-oar-agy-provider/test/integration.test.ts` 增加“清洗导致认证失败”用例：缺少显式认证变量时返回 `not-authenticated` 可操作提示，不静默继承父凭据

**Checkpoint**: US4 独立可验证；子进程环境和父级诊断满足最小暴露。

---

## Phase 7: User Story 5 - 运行活动可回看但受控 (Priority: P3)

**Goal**: 状态查询可回看有限活动摘要；完整流式内容不进入父上下文，终态按 TTL 清理。

**Independent Test**: 产生多步事件的 fake 运行，查询活动数量/顺序/截断；终态超过 TTL 后不再返回；父上下文无完整流。

### Tests for User Story 5

- [x] T040 [US5] 在 `packages/subagent-oar-agy-provider/test/runs.test.ts` 增加活动环形缓冲测试：最多 20 条、序号递增、覆盖最旧、连续 text 合并、`lastText≤200`
- [x] T041 [US5] 在 `packages/subagent-oar-agy-provider/test/runs.test.ts` 增加保留策略测试：终态 5 分钟 TTL、每父会话 50 条上限、惰性清理不误删运行中记录
- [x] T042 [US5] 在 `packages/subagent-oar-agy-bundle/test/tool.test.ts` 增加状态输出边界测试：只返回 `lastText`/活动摘要，不返回完整最终答复、prompt 或工具参数

### Implementation for User Story 5

- [x] T043 [US5] 在 `packages/subagent-oar-agy-provider/src/run.ts` 实现活动采集：`init`、步骤/工具/状态变化、终态入环；连续 `text_delta` 只更新 `lastText`/`lastActivityAt`，不逐条占用槽位
- [x] T044 [US5] 在 `packages/subagent-oar-agy-provider/src/runs.ts` 实现终态 TTL、每父会话记录上限和惰性清理；清理不得移除运行中记录，不得把旧运行误报为当前运行
- [x] T045 [US5] 在 `packages/subagent-oar-agy-provider/src/runs.ts` 实现状态快照的 `activity` 输出上限与顺序；确保 `summary≤160`、`text≤200`

### Verification tests for User Story 5

- [x] T046 [US5] 在 `packages/subagent-oar-agy-provider/test/integration.test.ts` 增加多步活动查询：运行中活动递增，完成后仍可在保留期查询，过期后 `found:false`

**Checkpoint**: US5 独立可验证；活动回看有界、受控、可清理。

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: 文档、组合包校验、完整回归和真实冒烟

- [x] T047 更新 `packages/subagent-oar-agy-bundle/README.md`：配置表加入 `startupTimeoutMs`/`stallTimeoutMs`/`activityLimit`/`terminalRetentionMs`/`maxRecordsPerParent`/`controlToolName`，说明默认值、适用范围、调整方式（本 Feature 不提供看门狗关闭开关）、状态/取消用法、安全边界和本地调试日志的查看方式
- [x] T048 [P] 更新 `packages/subagent-oar-agy-bundle/docs/DETAIL.de.md`、`DETAIL.en.md`、`DETAIL.es.md`、`DETAIL.fr.md`、`DETAIL.ja.md`、`DETAIL.pt.md`、`DETAIL.ru.md`、`DETAIL.zh.md`，与 README 的默认值和边界一致
- [x] T049 [P] 更新 `packages/subagent-oar-agy-bundle/docs/INSTALL.md`：新工具需要新会话/重载才能出现在工具表，控制工具不改官方委派工具
- [x] T050 [P] 在 `packages/subagent-oar-agy-bundle/test/bundle.test.ts` 与 `verify-package.mjs` 增加校验：`cordis.patch.yml` 仍只有原 provider/tool 行，控制工具随工具行注册，bundle 文件清单包含新增 provider 文件
- [x] T051 运行 `pnpm typecheck && pnpm test`，修复回归；记录 US1–US5 与 SC-001–SC-008 的对应结果
- [x] T052 按 `specs/003-agy-observability-control/quickstart.md` 执行 fake AGY 全矩阵；真实 AGY 冒烟只在用户授权且已登录环境执行一次，记录结果但不记录 token/敏感输出
- [x] T053 实现后对照 `specs/003-agy-observability-control/checklists/observability.md` 记录未满足项；需要调整需求时先改 spec/plan/tasks，不通过实现代码绕过
- [x] T054 在 `packages/subagent-oar-agy-provider/test/integration.test.ts`、`test/teardown.test.ts` 增加插件清理测试：effect dispose 后计时器停止、`RunRegistry` 清空、未结算 AGY 运行被 terminate，父/子 PID 不存活；并在 `packages/subagent-oar-agy-bundle/test/tool.test.ts` 断言控制工具不再可调用
- [x] T055 最终检查：核对 `packages/subagent-oar-agy-bundle/cordis.patch.yml`、`README.md`、`docs/INSTALL.md` 与 `test/bundle.test.ts`，确认官方 `subagent_oar_agy` 参数/返回值/描述未变、旧会话提示、插件卸载/重复加载行为符合 FR-016；无新增未使用依赖

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖，可立即开始
- **Foundational (Phase 2)**: 依赖 Setup；阻塞所有用户故事
- **US1 (Phase 3)**: 依赖 Foundational；MVP
- **US2 (Phase 4)**: 依赖 Foundational；与 US1 可并行，但共享 `tool.js` 时建议先完成 US1 再改工具文件
- **US3 (Phase 5)**: 依赖 Foundational + US2 的控制工具骨架（同一 `tool.js`）；先完成 T022/T023
- **US4 (Phase 6)**: 依赖 Foundational；与 US1–US3 可并行（不同文件为主）
- **US5 (Phase 7)**: 依赖 Foundational + US2 的状态快照；与 US3 可并行
- **Polish (Phase 8)**: 依赖所有已选用户故事

### User Story Dependencies

- **US1**: 无故事内前置；需要 foundation registry
- **US2**: 无故事内前置；需要 foundation registry + run 接线
- **US3**: 依赖 US2 的控制工具注册（T022/T023）；取消本身独立
- **US4**: 无故事内前置；环境/诊断改动与 US1 的 `run.ts` 终态路径有交叉，建议 US1 后做
- **US5**: 依赖 US2 的状态快照；活动采集与 US1 的 `run.ts` 有交叉，建议 US1 后做

### Within Each User Story

- 测试先写并确认失败
- registry/模型 → run 接线 → 工具/接口 → 集成测试
- 同一文件（`run.ts`、`tool.js`、`runs.ts`）的任务不要并行
- 完成一个故事后独立验证，再进入下一个

### Parallel Opportunities

- Setup 的 T002/T003 可并行
- Foundational 的 T007 可独立并行；T009 依赖 T008；T004/T005/T006/T008 有依赖（T005 依赖 T004 的 registry API）
- US1 的 T010/T011/T012 均写 `integration.test.ts`，必须串行；不要标记为并行
- US2 的 T019/T020/T042 均写测试文件（runs/tool），不要标记为并行
- US3 的 T027/T028 分别写 runs/tool 测试，但为避免同文件冲突，按顺序执行
- US4 的 T034 可独立并行；T033/T035 均写 `integration.test.ts`，必须串行
- US5 的 T040/T041/T042 涉及 runs/tool 测试文件，按顺序执行
- Polish 的 T048/T049/T050 可并行

---

## Test Ordering Example: US1

```bash
# 先写测试（同一测试文件时串行合并，避免冲突）
# T010 no-init 启动超时
# T011 silent 静默超时
# T012 绝对超时与静默竞争
```

## Test Ordering Example: US4

```bash
# T034 可独立并行；T033/T035 同写 integration.test.ts，必须串行
# T033 环境清洗集成测试
# T034 诊断脱敏单元测试
# T035 敏感 stderr 端到端测试
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成 Setup + Foundational
2. 完成 US1（启动/静默看门狗）
3. **STOP and VALIDATE**：fake `no-init` / `silent` 子进程都在窗口后失败并通知，无残留
4. 这是最小可用的“父 Agent 不再永久沉睡”修复

### Incremental Delivery

1. Foundation → 可运行 registry/配置
2. US1 → MVP，保证不无限等待
3. US2 → 可查询状态，用户能判断“在跑/卡住/已结束”
4. US3 → 可主动取消
5. US4 → 安全环境与诊断边界
6. US5 → 有界活动回看与清理
7. Polish → 文档、组合包校验、真实 AGY 冒烟

### Parallel Team Strategy

- 单人实现：按 Phase 顺序，US2/US3 共享 `tool.js`，US1/US5 共享 `run.ts`，US4 的 `spawn.ts`/`errors.ts` 可并行
- 多成员：Foundation 后，US1、US2、US4 可并行；US3 等 US2 工具骨架；US5 等 US1/US2 稳定后再动 `run.ts`/`runs.ts`

---

## Notes

- 所有新增配置必须有默认值，旧配置无需迁移。
- 控制工具与官方委派工具分开；不改官方 schema。
- 父级诊断不包含原始 stderr；本地日志必须脱敏。
- 终态只结算一次；通知由共享子代理服务负责，控制工具不自行结算。
- 测试优先使用 fake AGY；真实 AGY 冒烟需用户授权。
- 不在本 Feature 实现 UI 状态卡片、Host 崩溃恢复、完整流式输出、继续/恢复。

---

## Phase 9: Convergence

- [x] T056 将 `lastEventKind` 与活动类型分离：在 `packages/subagent-oar-agy-provider/src/runs.ts` 中把活动 `step`/`tool`/`text` 映射为契约的 `step_update`，`init`/`result`/`stderr`/`lifecycle` 保持契约值；更新 `RunView` 类型、`test/runs.test.ts` 与状态快照断言，并增加对 `contracts/run-status.schema.json` 的字段/枚举/上限校验 per FR-003 / T019 / T022 / data-model:lastEventKind (contradicts)
- [x] T057 取消路径不写入 `failureCategory`：在 `packages/subagent-oar-agy-provider/src/run.ts` 中让显式取消/父级取消的终态保持 `failureCategory: null`，与 `contracts/run-status.schema.json` 和 data-model 的失败分类一致；更新 `test/runs.test.ts`、`test/integration.test.ts` 的取消终态断言 per FR-003 / data-model:失败分类 (contradicts)
- [x] T058 控制工具 `cancel` 在缺少 `exec.agent` 时返回 `{ accepted: false, reason: "unavailable" }` 而不是抛错；不查询、不取消，并更新 `packages/subagent-oar-agy-bundle/test/tool.test.ts` per T030 / contracts/control-tool.md 规则 7 (contradicts)
- [x] T059 控制工具重复取消同一运行时返回 `accepted: true`、`reason: "already-requested"`，同时保持 `RunRegistry.requestCancel` 的 registry 收据语义不变；补充 bundle 测试覆盖重复取消 per contracts/control-tool.md 规则 2 / data-model:CancelRequest (contradicts)
- [x] T060 拒绝的 `cancel`（`not-found` / `already-ended`）不返回 `requestedAt: null`，按契约省略该字段或返回字符串；更新 bundle 测试 per contracts/control-tool.md cancel 输出表 (partial)
