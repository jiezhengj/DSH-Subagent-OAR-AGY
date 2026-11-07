# 任务：subagent_oar_agy

**Feature**: `001-subagent-oar-agy` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

**测试策略**：计划要求单元测试 + 假 `agy` 集成测试；真实 AGY 与临时 profile 任务需用户授权。**T005 是硬门禁**：未通过前不开始任何实现任务（T006 起）。

## Phase 1：项目初始化

- [x] T001 初始化 pnpm workspace：`package.json`、`pnpm-workspace.yaml`、`tsconfig.base.json`、根 `.gitignore`（忽略 `node_modules/`、`dist/`、`*.tsbuildinfo`）
- [x] T002 配置测试与构建：`vitest.config.ts`、各包 `tsconfig.json`（`module: nodenext`、`strict`）
- [x] T003 创建提供方包骨架 `packages/dsh-subagent-agy/package.json`（`type: module`、`exports`、`peerDependencies`：`@deepseek-ai/cordis`、`@deepseek-ai/dsh-subagent`、`@deepseek-ai/schemastery`、`@deepseek-ai/dsh-timeout`）
- [x] T004 创建组合包骨架 `packages/dsh-subagent-agy-bundle/{package.json,cordis.patch.yml,icon.svg}`（`dsh.bundle.patch`、`listedByDefault: false`）

## Phase 2：基础能力（T005 门禁通过后）

- [x] T005 执行官方工具 spike：在隔离 profile/临时目录安装 `@deepseek-ai/dsh-experimental-tool-subagent-oar@0.2.2-rc.1`，验证可加载且 `providers` 接受 `agy`；记录到 `specs/001-subagent-oar-agy/spike.md`。失败则记录 Option B 结论并暂停后续任务
- [x] T006 [P] 实现 `packages/dsh-subagent-agy/src/agy/stream.ts`：NDJSON 行缓冲（UTF-8 安全、单行上限 8 MiB、处理 `\r\n`、末尾无换行）与测试 `test/stream.test.ts`
- [x] T007 [P] 实现 `packages/dsh-subagent-agy/src/agy/protocol.ts`：`init`/`step_update`/`result`/未知事件的宽松判别类型与终态映射（SUCCESS→completed、ERROR→error、CANCELED/INTERRUPTED→aborted、其余→error）与测试 `test/protocol.test.ts`
- [x] T008 [P] 实现 `packages/dsh-subagent-agy/src/agy/resolve.ts`：`command` 含分隔符按路径校验，否则扫描 `PATH`（Windows 追加 `PATHEXT`）；找不到时返回可操作诊断，提示通过 `command` 配置绝对路径（FR-021）；测试 `test/resolve.test.ts`
- [x] T009 [P] 实现 `packages/dsh-subagent-agy/src/teardown.ts`：POSIX 进程组 `SIGTERM` → `killGraceMs`（默认 10000）→ `SIGKILL`；Windows `taskkill /PID <pid> /T /F`；幂等、等待退出；测试 `test/teardown.test.ts`
- [x] T010 实现 `packages/dsh-subagent-agy/src/agy/errors.ts`：六类失败分类（`not-installed`/`not-authenticated`/`timeout`/`spawn-failed`/`protocol`/`cancelled`）与可操作诊断文案（≤4096 UTF-8 字节、不含 prompt/工具输出/环境变量值）；测试 `test/errors.test.ts`（依赖 T007）
- [x] T011 编写假 `agy` fixture `packages/dsh-subagent-agy/test/fixtures/fake-agy.mjs`：按环境变量编排 `init`/`step_update`/`result`、退出码、延迟、忽略 SIGTERM、部分输出后崩溃
- [x] T012 实现 `packages/dsh-subagent-agy/src/agy/spawn.ts`：`cwd` 相对父会话目录解析为绝对路径并 `assertUsableCwd('subagent-agy','cwd',abs)`（FR-005），启动失败在 spawn 前报错；写入 stdin 的 `{"event":"user","message":{"content":"…"}}`；接线 `AbortSignal`（依赖 T006–T010）
- [x] T013 实现 `packages/dsh-subagent-agy/src/agy/timer.ts`：`timeoutMs` 计时器（从 `init` 事件起算、未配置则不设时限）与测试 `test/timeout.test.ts`（FR-009）

## Phase 3：用户故事 1 - 端到端委派（P1）

**目标**：在 DSH 会话中把独立任务交给 AGY 并取回最终答复。
**独立测试**：假 `agy` 成功路径、并发路径与一次真实 AGY 委派（quickstart 场景 1、4）。

- [x] T014 [US1] 实现 `packages/dsh-subagent-agy/src/run.ts`：`startAgyRun` 组装 run handle（`SubagentRunId(randomUUID())`、`subprocessRunHandle`、`settleRunResult`），`result.response` 转单个 text block；显式声明一次性契约（`NO_START_CAPABILITIES`、`inheritsParentContext: false`、不实现 `prepareContinuable`，FR-004）；失败时已获得的部分文本与诊断分开呈现（FR-018）（依赖 T012、T013）
- [x] T015 [US1] 实现 `packages/dsh-subagent-agy/src/index.ts`：`inject: ['subagents']`、`Config` 校验（`timeoutMs`/`killGraceMs` 正有限数且 ≤ `MAX_TIMER_DELAY_MS`、`permissionMode` 枚举）与 `ctx.subagents.registerProvider`（FR-004；依赖 T014）
- [x] T016 [US1] 集成测试 `packages/dsh-subagent-agy/test/integration.test.ts`：假 `agy` 输出 `init→step_update→result SUCCESS`，断言输出文本、run 发布、dispose 幂等，并断言 provider 形状（无 `prepareContinuable`、`inheritsParentContext === false`、能力为零）
- [x] T017 [US1] 接线组合包 `packages/dsh-subagent-agy-bundle/cordis.patch.yml` 两行（提供方 + 官方工具 `providers: {agy: agy}`）并验证 patch 被接受（依赖 T004、T005、T015）
- [x] T018 [US1] 真实 AGY 端到端验证 quickstart 场景 1（需用户授权）；记录耗时/模型/结果到 `specs/001-subagent-oar-agy/validation.md`，含 SC-002 启动确认计时
- [x] T019 [US1] 并发集成测试 `packages/dsh-subagent-agy/test/integration.test.ts`：假 `agy` 并行发起 ≥2 次委派（含相同 `cwd`），断言 run id 与结果一一对应、无串扰（FR-006、FR-020；quickstart 场景 4）
- [x] T020 [US1] SC-007 入口选择验证：在启用内置子代理工具的环境中，10 次任务描述明确指向 AGY 的委派，统计 `subagent_oar` 被选中的比例 ≥9/10；记录到 `validation.md`
- [x] T021 [US1] 工具名冲突实验：同时启用官方 OAR 组合包，验证 DSH 对重复 `subagent_oar` 的处理（覆盖/报错），并验证 `toolName` 配置项是否真实存在且生效；结论写入 `research.md` 与 README（FR-016、research D9）

## Phase 4：用户故事 2 - 失败可读、可恢复（P2）

**目标**：未安装/未登录/超时/异常四类失败可读，父会话不受影响。
**独立测试**：四类失败各返回不同错误并保持父会话可用（quickstart 场景 3）。

- [x] T022 [US2] 把 `errors.ts` 接入 `run.ts` 与 `spawn.ts`：进程退出码、stderr 摘要、`result.error`、缺失 `result` 事件、部分输出后崩溃（FR-010、FR-018）；不自动重试（FR-019）
- [x] T023 [US2] 在 `packages/dsh-subagent-agy/src/run.ts` 接入 `timeoutMs` 计时（T013）：从 `init` 起算 → 终止阶梯 → `error` + timeout 诊断；未配置时限时不设内部计时（FR-009）
- [x] T024 [US2] 在 `packages/dsh-subagent-agy/src/run.ts` 接取消：`request.signal` abort → 终止阶梯 → `aborted` 结算；`dispose` 等待退出（FR-011）
- [x] T025 [P] [US2] 集成测试 `packages/dsh-subagent-agy/test/integration.test.ts`（测试先行，可与 T022–T024 并行）：四类失败、部分输出、取消（假 `agy` 编排退出码 1/认证文案/延迟/畸形 NDJSON/忽略 SIGTERM）
- [x] T026 [US2] 验证父会话在失败/取消后继续可用，且无残留 AGY 进程（`ps` 检查）；记录失败/取消后父会话可用性结论到 `specs/001-subagent-oar-agy/validation.md`

## Phase 5：用户故事 3 - 默认行为透明可调（P3）

- [x] T027 [US3] 在 `packages/dsh-subagent-agy/src/agy/spawn.ts` 实现 `permissionMode` 三档参数映射（`yolo`→`--dangerously-skip-permissions`；`plan`→`--mode plan`；`strict`→不追加）（FR-012）
- [x] T028 [US3] 编写 `packages/dsh-subagent-agy-bundle/README.md`：默认无人值守及其风险、`plan`/`strict` 差异与配置示例、"默认是否自动执行/风险/如何改保守"三问的明确答案（SC-006）、非官方免责声明与 Antigravity 政策表述引用（FR-017）、重试与配额说明（FR-019）、同 `cwd` 并发风险（FR-020）、`command` 绝对路径示例（FR-021）、工具名冲突与改名步骤（FR-016）
- [x] T029 [P] [US3] 三档行为验证并记录到 `specs/001-subagent-oar-agy/validation.md`：`plan` 不写文件、`strict` 出现软拒绝说明、`yolo` 可写（quickstart 场景 2）；按 SC-006 核对 README 三问 3/3

## Phase 6：用户故事 4 - 可安装、可升级（P4）

- [x] T030 [US4] 完成组合包 `package.json`：`engines.dsh: ">=0.2.2-rc.1 <0.3.0"`、`files`、精确锁定官方工具版本与提供方版本（FR-014）
- [x] T031 [US4] 编写安装文档 `packages/dsh-subagent-agy-bundle/docs/INSTALL.md`：`dsh plugin add` 本地路径与 npm 两种方式、Discover 说明、升级与禁用/启用步骤、工具名冲突处理（FR-013、FR-016）
- [x] T032 [P] [US4] 临时 profile 安装冒烟并记录到 `specs/001-subagent-oar-agy/validation.md`：安装 → 重载 → 首次委派 → 禁用 → 重装，确认配置保留且 DSH 正常启动；记录 SC-004 的步骤数与耗时，以及 SC-005 的 3 次禁用后无残留进程抽样（FR-013、FR-011）

## Phase 7：收尾

- [x] T033 编写 `packages/dsh-subagent-agy-bundle/docs/DETAIL.md`：架构、安全边界、失败语义、与官方 OAR 的关系
- [x] T034 跑通 `packages/dsh-subagent-agy/test/` 全部单元/集成测试，核心模块（`stream`/`protocol`/`errors`/`timer`）行覆盖 ≥ 90%
- [x] T035 真实 AGY 10 次委派冒烟并记录 SC-001/SC-002 数据到 `specs/001-subagent-oar-agy/validation.md`（需用户授权、消耗配额）
- [x] T036 凭据与配置边界检查并记录到 `specs/001-subagent-oar-agy/validation.md`：代码走查确认无凭据读取路径、无 AGY 认证文件与 `~/.gemini/.../settings.json` 的写入（含读取检查）、日志无环境变量值（FR-015）；提交前检查 Conventional Commits 与无用户路径/令牌泄漏

## 依赖关系

```text
T001 ─► T002, T003, T004
T005（硬门禁）─► T006 … T036（未通过不开始任何实现任务）
T002 ─► T006–T013
T003 ─► T006–T015
T006, T007, T008, T009, T010 ─► T012
T007 ─► T010
T012, T013 ─► T014 ─► T015
T011 ─► T016, T025
T004, T005, T015 ─► T017
T017 ─► T018, T020, T021, T031
T014, T015 ─► T022, T023, T024
T013 ─► T023
T025 ─► T026
T015 ─► T027 ─► T029
T021 ─► T028
T017 ─► T030 ─► T032
T017 ─► T033
T016, T019, T025, T032 ─► T034
T018 ─► T035
T018, T026, T032, T034, T035 ─► T036
T036 ─► 完成
```

## 并行执行示例

- 基础能力：T006–T009 可并行（不同文件），T010 依赖 T007 后并行；T011 独立；T012 等 T006–T010。
- US1：T016、T019、T021 可并行（测试/实验互不依赖实现文件）。
- US2：T025 可与 T022–T024 并行推进（测试先写）。
- US3/US4 的文档任务（T028、T031）可分别与 T027、T030 并行（T031 只依赖 T017）。

## 实施策略

- **MVP**：Phase 1–3（US1）即"能委派、能取回"，可先交付试用。
- 按 US2 → US3 → US4 增量补齐失败语义、权限透明与分发。
- **T005 是硬门禁**：spike 未通过前不开始 T006 起的任何实现任务；失败时先在 plan/research 记录 Option B 决策再继续。
- T018/T020/T026/T032/T035 需要真实 AGY 或真实模型会话；本次实现已在临时 DSH home 的 headless profile 中完成（见 validation.md）。
