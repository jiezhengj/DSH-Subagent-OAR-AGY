# 任务：subagent_oar_agy

**Feature**: `001-subagent-oar-agy` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

**测试策略**：计划要求单元测试 + 假 `agy` 集成测试；真实 AGY 与临时 profile 任务需用户授权。**T005 是硬门禁**：未通过前不开始任何实现任务（T006 起）。

## Phase 1：项目初始化

- [x] T001 初始化 pnpm workspace：`package.json`、`pnpm-workspace.yaml`、`tsconfig.base.json`、根 `.gitignore`（忽略 `node_modules/`、`dist/`、`*.tsbuildinfo`）
- [x] T002 配置测试与构建：`vitest.config.ts`、各包 `tsconfig.json`（`module: nodenext`、`strict`）
- [x] T003 创建提供方包骨架 `packages/subagent-oar-agy-provider/package.json`（`type: module`、`exports`、`peerDependencies`：`@deepseek-ai/cordis`、`@deepseek-ai/dsh-subagent`、`@deepseek-ai/schemastery`、`@deepseek-ai/dsh-timeout`）
- [x] T004 创建组合包骨架 `packages/subagent-oar-agy-bundle/{package.json,cordis.patch.yml,icon.svg}`（`dsh.bundle.patch`、`listedByDefault: false`）

## Phase 2：基础能力（T005 门禁通过后）

- [x] T005 执行官方工具 spike：在隔离 profile/临时目录安装 `@deepseek-ai/dsh-experimental-tool-subagent-oar@0.2.2-rc.1`，验证可加载且 `providers` 接受 `agy`；记录到 `specs/001-subagent-oar-agy/spike.md`。失败则记录 Option B 结论并暂停后续任务
- [x] T006 [P] 实现 `packages/subagent-oar-agy-provider/src/agy/stream.ts`：NDJSON 行缓冲（UTF-8 安全、单行上限 8 MiB、处理 `\r\n`、末尾无换行）与测试 `test/stream.test.ts`
- [x] T007 [P] 实现 `packages/subagent-oar-agy-provider/src/agy/protocol.ts`：`init`/`step_update`/`result`/未知事件的宽松判别类型与终态映射（SUCCESS→completed、ERROR→error、CANCELED/INTERRUPTED→aborted、其余→error）与测试 `test/protocol.test.ts`
- [x] T008 [P] 实现 `packages/subagent-oar-agy-provider/src/agy/resolve.ts`：`command` 含分隔符按路径校验，否则扫描 `PATH`（Windows 追加 `PATHEXT`）；找不到时返回可操作诊断，提示通过 `command` 配置绝对路径（FR-021）；测试 `test/resolve.test.ts`
- [x] T009 [P] 实现 `packages/subagent-oar-agy-provider/src/teardown.ts`：POSIX 进程组 `SIGTERM` → `killGraceMs`（默认 10000）→ `SIGKILL`；Windows `taskkill /PID <pid> /T /F`；幂等、等待退出；测试 `test/teardown.test.ts`
- [x] T010 实现 `packages/subagent-oar-agy-provider/src/agy/errors.ts`：六类失败分类（`not-installed`/`not-authenticated`/`timeout`/`spawn-failed`/`protocol`/`cancelled`）与可操作诊断文案（≤4096 UTF-8 字节、不含 prompt/工具输出/环境变量值）；测试 `test/errors.test.ts`（依赖 T007）
- [x] T011 编写假 `agy` fixture `packages/subagent-oar-agy-provider/test/fixtures/fake-agy.mjs`：按环境变量编排 `init`/`step_update`/`result`、退出码、延迟、忽略 SIGTERM、部分输出后崩溃
- [x] T012 实现 `packages/subagent-oar-agy-provider/src/agy/spawn.ts`：`cwd` 相对父会话目录解析为绝对路径并 `assertUsableCwd('subagent-agy','cwd',abs)`（FR-005），启动失败在 spawn 前报错；写入 stdin 的 `{"event":"user","message":{"content":"…"}}`；接线 `AbortSignal`（依赖 T006–T010）
- [x] T013 实现 `packages/subagent-oar-agy-provider/src/agy/timer.ts`：`timeoutMs` 计时器（从 `init` 事件起算、未配置则不设时限）与测试 `test/timeout.test.ts`（FR-009）

## Phase 3：用户故事 1 - 端到端委派（P1）

**目标**：在 DSH 会话中把独立任务交给 AGY 并取回最终答复。
**独立测试**：假 `agy` 成功路径、并发路径与一次真实 AGY 委派（quickstart 场景 1、4）。

- [x] T014 [US1] 实现 `packages/subagent-oar-agy-provider/src/run.ts`：`startAgyRun` 组装 run handle（`SubagentRunId(randomUUID())`、`subprocessRunHandle`、`settleRunResult`），`result.response` 转单个 text block；显式声明一次性契约（`NO_START_CAPABILITIES`、`inheritsParentContext: false`、不实现 `prepareContinuable`，FR-004）；失败时已获得的部分文本与诊断分开呈现（FR-018）（依赖 T012、T013）
- [x] T015 [US1] 实现 `packages/subagent-oar-agy-provider/src/index.ts`：`inject: ['subagents']`、`Config` 校验（`timeoutMs`/`killGraceMs` 正有限数且 ≤ `MAX_TIMER_DELAY_MS`、`permissionMode` 枚举）与 `ctx.subagents.registerProvider`（FR-004；依赖 T014）
- [x] T016 [US1] 集成测试 `packages/subagent-oar-agy-provider/test/integration.test.ts`：假 `agy` 输出 `init→step_update→result SUCCESS`，断言输出文本、run 发布、dispose 幂等，并断言 provider 形状（无 `prepareContinuable`、`inheritsParentContext === false`、能力为零）
- [x] T017 [US1] 接线组合包 `packages/subagent-oar-agy-bundle/cordis.patch.yml` 两行（提供方 + 官方工具 `providers: {agy: agy}`）并验证 patch 被接受（依赖 T004、T005、T015）
- [x] T018 [US1] 真实 AGY 端到端验证 quickstart 场景 1（需用户授权）；记录耗时/模型/结果到 `specs/001-subagent-oar-agy/validation.md`，含 SC-002 启动确认计时
- [x] T019 [US1] 并发集成测试 `packages/subagent-oar-agy-provider/test/integration.test.ts`：假 `agy` 并行发起 ≥2 次委派（含相同 `cwd`），断言 run id 与结果一一对应、无串扰（FR-006、FR-020；quickstart 场景 4）
- [x] T020 [US1] SC-007 入口选择验证：在启用内置子代理工具的环境中，10 次任务描述明确指向 AGY 的委派，统计 `subagent_oar_agy` 被选中的比例 ≥9/10；记录到 `validation.md`
- [x] T021 [US1] 工具名冲突实验：同时启用官方 OAR 组合包，验证 DSH 对重复 `subagent_oar` 的处理（覆盖/报错），并验证 `toolName` 配置项是否真实存在且生效；结论写入 `research.md` 与 README（FR-016、research D9）

## Phase 4：用户故事 2 - 失败可读、可恢复（P2）

**目标**：未安装/未登录/超时/异常四类失败可读，父会话不受影响。
**独立测试**：四类失败各返回不同错误并保持父会话可用（quickstart 场景 3）。

- [x] T022 [US2] 把 `errors.ts` 接入 `run.ts` 与 `spawn.ts`：进程退出码、stderr 摘要、`result.error`、缺失 `result` 事件、部分输出后崩溃（FR-010、FR-018）；不自动重试（FR-019）
- [x] T023 [US2] 在 `packages/subagent-oar-agy-provider/src/run.ts` 接入 `timeoutMs` 计时（T013）：从 `init` 起算 → 终止阶梯 → `error` + timeout 诊断；未配置时限时不设内部计时（FR-009）
- [x] T024 [US2] 在 `packages/subagent-oar-agy-provider/src/run.ts` 接取消：`request.signal` abort → 终止阶梯 → `aborted` 结算；`dispose` 等待退出（FR-011）
- [x] T025 [P] [US2] 集成测试 `packages/subagent-oar-agy-provider/test/integration.test.ts`（测试先行，可与 T022–T024 并行）：四类失败、部分输出、取消（假 `agy` 编排退出码 1/认证文案/延迟/畸形 NDJSON/忽略 SIGTERM）
- [x] T026 [US2] 验证父会话在失败/取消后继续可用，且无残留 AGY 进程（`ps` 检查）；记录失败/取消后父会话可用性结论到 `specs/001-subagent-oar-agy/validation.md`

## Phase 5：用户故事 3 - 默认行为透明可调（P3）

- [x] T027 [US3] 在 `packages/subagent-oar-agy-provider/src/agy/spawn.ts` 实现 `permissionMode` 三档参数映射（`yolo`→`--dangerously-skip-permissions`；`plan`→`--mode plan`；`strict`→不追加）（FR-012）
- [x] T028 [US3] 编写 `packages/subagent-oar-agy-bundle/README.md`：默认无人值守及其风险、`plan`/`strict` 差异与配置示例、"默认是否自动执行/风险/如何改保守"三问的明确答案（SC-006）、非官方免责声明与 Antigravity 政策表述引用（FR-017）、重试与配额说明（FR-019）、同 `cwd` 并发风险（FR-020）、`command` 绝对路径示例（FR-021）、工具名冲突与改名步骤（FR-016）
- [x] T029 [P] [US3] 三档行为验证并记录到 `specs/001-subagent-oar-agy/validation.md`：`plan` 不写文件、`strict` 出现软拒绝说明、`yolo` 可写（quickstart 场景 2）；按 SC-006 核对 README 三问 3/3

## Phase 6：用户故事 4 - 可安装、可升级（P4）

- [x] T030 [US4] 完成组合包 `package.json`：`engines.dsh: ">=0.2.2-rc.1 <0.3.0"`、`files`（含 `locale`、`provider`）、`exports`（`./agy-provider`、`./agy-provider/locale/*`、`./locale/*`、`./icon`、`./package.json`）、精确锁定官方工具与宿主包版本，提供方仅 devDependency（FR-014、FR-023）
- [x] T031 [US4] 编写安装文档 `packages/subagent-oar-agy-bundle/docs/INSTALL.md` 与根 README 索引：安装框粘贴 GitHub Release tarball 地址、本地 tarball 备选、升级与禁用/启用步骤、工具名冲突处理、8 语言 README 链接（FR-013、FR-016、FR-023）
- [x] T032 [P] [US4] 临时 profile 安装冒烟并记录到 `specs/001-subagent-oar-agy/validation.md`：安装 → 重载 → 首次委派 → 禁用 → 重装，确认配置保留且 DSH 正常启动；记录 SC-004 的步骤数与耗时，以及 SC-005 的 3 次禁用后无残留进程抽样（FR-013、FR-011）

## Phase 7：收尾

- [x] T033 编写 `packages/subagent-oar-agy-bundle/docs/DETAIL.<lang>.md`（8 语言）：架构、安全边界、失败语义、与官方 OAR 的关系
- [x] T034 跑通 `packages/subagent-oar-agy-provider/test/` 全部单元/集成测试，核心模块（`stream`/`protocol`/`errors`/`timer`）行覆盖 ≥ 90%
- [x] T035 真实 AGY 10 次委派冒烟并记录 SC-001/SC-002 数据到 `specs/001-subagent-oar-agy/validation.md`（需用户授权、消耗配额）
- [x] T038 [US4] 自包含组合包：`scripts/vendor-provider.mjs` 构建时复制提供方 `dist` 与 `locale` 至 `provider/`，patch 改为包内子路径 `@jiezhengj/subagent-oar-agy/agy-provider`，移除提供方运行时依赖；测试断言 tarball 自包含（FR-014、FR-023）
- [x] T039 [US4] 公开发布：GitHub 仓库 public + topics（含 `dsh-plugin`）、Release `v0.2.3` 附 tarball、根 README 索引页与 8 语言正文互链；在临时 `DSH_HOME` 与桌面 profile 用安装框地址安装并真实冒烟（FR-023、SC-009）
- [x] T040 [US4] 显示名回归修复：`exports` 补齐 `./locale/*` 等元数据子路径（否则 DSH 回退包名），用 `readPluginMeta` 复核组合包与提供方标题为 8 语言，并补充资源可解析性测试（FR-022、SC-008）
- [x] T041 [US4] 图标改为 36×36 透明画布（官方风格，无固定底色），随卡片浅/深主题背景呈现；发布 v0.2.4 并实装复核（FR-022、SC-008）
- [x] T036 凭据与配置边界检查并记录到 `specs/001-subagent-oar-agy/validation.md`：代码走查确认无凭据读取路径、无 AGY 认证文件与 `~/.gemini/.../settings.json` 的写入（含读取检查）、日志无环境变量值（FR-015）；提交前检查 Conventional Commits 与无用户路径/令牌泄漏
- [x] T037 [P] 显示名/介绍正文/详情与运行时文案的 8 语言本地化：`locale/<lang>.json`、`docs/DETAIL.<lang>.md`、`src/i18n.ts` 与本地化测试（FR-022、SC-008）

## 依赖关系

```text
T001 ─► T002, T003, T004
T005（硬门禁）─► T006 … T040（未通过不开始任何实现任务）
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
T017 ─► T030 ─► T038 ─► T039
T038 ─► T040
T030, T038 ─► T032
T017 ─► T033
T016, T019, T025, T032 ─► T034
T018 ─► T035
T018, T026, T032, T034, T035 ─► T036
T036, T037, T039, T040, T041 ─► 完成
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
- T039/T040 在发布后进行：先推送并创建 Release，再用 README 的安装框地址在干净环境与桌面 profile 复验，最后补 `readPluginMeta` 断言。

## Phase 8：Convergence

本阶段由收敛评估追加（实现后对照 spec/plan/tasks 的差异），完成前 feature 不视为收敛。既有任务不重写、不重排；新任务只做追加。

### 发现汇总

| # | 严重度 | 差距类型 | 来源 | 发现 |
|---|---|---|---|---|
| F1 | HIGH | missing | FR-014 | 未实现官方 OAR 工具包的加载时可用性校验，也没有"自写同形工具"回退形态；`cordis.patch.yml` 直接挂载 `@deepseek-ai/dsh-experimental-tool-subagent-oar`，包缺失时只能由 pnpm 安装失败兜底，不满足 FR-014 的"明确报错并回退"要求。 |
| F2 | MEDIUM | contradicts | FR-023、FR-022、SC-004 | `packages/subagent-oar-agy-bundle/README.md` 仍写"最短路径：`dsh plugin add @jiezhengj/subagent-oar-agy`"，但本包未上架 npm，该命令不可用；同一 README 的配置表缺少 `locale` 行，与运行时支持的 8 语言配置不一致。 |
| F3 | MEDIUM | partial | SC-001、SC-002、SC-005、SC-007 | 真机会话验收证据早于改名与自包含打包：`validation.md` 的 SC-007/T020 仍记录 `subagent_oar(runtime=agy)`，10 次委派、启动确认、禁用恢复等证据也未在 v0.2.4 的 `subagent_oar_agy` 上重新基线。 |
| F4 | MEDIUM | partial | US4/AC4、FR-016 | "与官方 OAR 组合包共存"从未真正验证：T021 实际测试的是同一包的第二行实例（重复 `subagent_oar`），未安装官方 OAR 组合包并确认两个工具名同时可用。 |
| F5 | MEDIUM | missing | Constitution 附加约束（许可证） | 公开仓库没有 `LICENSE` 文件，两个 `package.json` 均无 `license` 字段，plan 也未确定许可证；与"npm 包名、scope、许可证与免责声明在 plan 阶段确定"不符。 |
| F6 | LOW | partial | FR-009 | 文档只写 `timeoutMs` 默认"不设"，未说明"未配置时限时委派只能由父会话取消/关闭终止"，不满足 FR-009 的文档要求。 |
| F7 | LOW | partial | FR-014（版本拒绝部分） | 未记录 `engines.dsh` 不满足时宿主拒绝安装/加载并提示版本范围的证据；机制依赖 DSH，但当前验证文件没有对应结论。 |

### 追加任务

- [x] T042 [US1] 按 FR-014 补齐官方 OAR 工具包可用性校验与备选形态：加载时检测工具包可解析，缺失时给出可操作诊断；实现"自写同形工具"回退并保持工具名、参数与返回表面不变；补工具包缺失/回退路径测试（per FR-014，missing）
- [x] T043 [US4] 修正组合包 README：删除未上架 npm 的 `dsh plugin add @jiezhengj/subagent-oar-agy` 说法，统一为 Release tarball 地址与本地 tarball 两种安装路径；配置表补 `locale` 行（per FR-023、FR-022、SC-004，contradicts）
- [x] T044 [US1] 在 v0.2.4 上重跑真机会话验收：10 次委派（SC-001）、启动确认计时（SC-002）、禁用/重装恢复与无残留进程（SC-005）、10 次入口选择（SC-007），全部使用 `subagent_oar_agy` 并更新 `validation.md` 的旧工具名与证据（per SC-001、SC-002、SC-005、SC-007，partial）
- [x] T045 [US4] 安装官方 OAR 组合包与本插件并存，验证 `subagent_oar` 与 `subagent_oar_agy` 同时注册、互不覆盖，两套工具均可独立委派；记录到 `validation.md` 与 `research.md` D9（per US4/AC4、FR-016，partial）
- [x] T046 [US4] 与用户确认许可证（建议 MIT），新增 `LICENSE`，在两个 `package.json` 补 `license` 字段，并在根 README 声明；如用户在 plan 阶段已另有决定则按该决定执行（per Constitution 附加约束，missing）
- [x] T047 [US3] 在组合包 README（及详情文档需要处）补一句：`timeoutMs` 未配置时不设内部时限，委派只能由父会话取消/关闭终止，并说明超时从 `agy init` 起算（per FR-009，partial）
- [x] T048 [US1] 验证并记录 DSH 版本不满足时 `engines.dsh` 的安装/加载阻断与版本范围提示；若当前环境无法复现，记录宿主校验代码路径与结论（per FR-014，partial）

- 收敛结论：F1–F7 已全部完成并通过验证（见 `validation.md` 收敛修复章节与 v0.2.5 发布后实装）；T001–T048 全部完成，feature 收敛。
