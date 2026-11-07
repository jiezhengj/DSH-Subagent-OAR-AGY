# 需求质量清单：安全边界与失败语义

**目的**：以"需求的单元测试"方式审查本 feature 在权限/安全与失败/恢复两类高风险领域的需求质量
**创建日期**：2026-11-07
**对应范围**：[spec.md](../spec.md) §FR-007–FR-017、§成功标准；[plan.md](../plan.md)
**深度**：Standard　**受众**：评审者（PR 审查）　**时机**：实现前　**评审状态**：PASS（2026-11-08，MiMo 两轮复审；CHK010/012/014/021 缺口已回补 spec，CHK008/018/027 已随 FR-009/FR-014/US3-4/US4-5 补齐）

> 说明：本清单由评审者所有。`[x]` 表示评审者确认该条需求质量已达标，不表示实现完成。本命令不修改勾选状态。

## 安全与权限需求

- [x] CHK001 - 默认无人值守权限的风险由谁接受、在何处声明，需求中是否明确？ [Clarity, Spec §FR-012]
- [x] CHK002 - `plan` 与 `strict` 两档的可观察差异是否被量化到可验收（只读 vs 软拒绝）？ [Clarity, Spec §FR-012]
- [x] CHK003 - 凭据边界是否完整覆盖"不读取、不存储、不转发、不修改 AGY 配置"四个方面？ [Completeness, Spec §FR-015]
- [x] CHK004 - "非官方封装、自担风险"的声明要求是否可在文档评审中客观判定？ [Measurability, Spec §FR-017]
- [x] CHK005 - 权限档位从默认改为保守时，是否要求用户显式选择并留下可核对的配置记录？ [Coverage, Gap]
- [x] CHK006 - 是否明确禁止通过修改 AGY 的 `settings.json` 实现细粒度权限，以避免越界？ [Consistency, Spec §FR-015]

## 失败与恢复语义

- [x] CHK007 - 四类失败（未安装、未登录、超时、异常）是否都有互不相同且可操作的描述要求？ [Completeness, Spec §FR-007–FR-010]
- [x] CHK008 - 超时的起点、默认值与可配置上限是否明确？ [Clarity, Spec §FR-009]
- [x] CHK009 - 取消的触发源（父回合中断/会话关闭）与结算语义是否明确？ [Clarity, Spec §FR-011]
- [x] CHK010 - AGY 中途崩溃或输出部分损坏时，已获得的输出如何呈现是否定义？ [Coverage, Gap]
- [x] CHK011 - 父会话在失败后"继续可用"是否被写成可验证的验收条件？ [Measurability, Spec §FR-007–FR-010]
- [x] CHK012 - 多次失败是否被允许重试，重试是否会重复消耗配额，需求中是否说明？ [Coverage, Gap]

## 并发与边界场景

- [x] CHK013 - 多个委派并行时，结果与子任务标识的对应关系是否定义？ [Completeness, Spec §FR-006]
- [x] CHK014 - 多个委派指向同一 `cwd` 时的行为（允许/拒绝/隔离）是否定义？ [Coverage, Gap]
- [x] CHK015 - `cwd` 不存在、不可写或为相对路径时的失败时机与提示是否定义？ [Edge Case, Spec 边界情况]
- [x] CHK016 - "中断父回合"与"关闭父会话"是否需要区别对待，需求是否说清？ [Ambiguity, Spec §FR-011]
- [x] CHK017 - 取消/超时后的进程清理在 Windows 上是否被单独要求？ [Coverage, Spec 边界情况]

## 依赖与假设

- [x] CHK018 - 官方工具包的版本锁定与升级验证要求是否明确？ [Dependency, plan.md]
- [x] CHK019 - Option B 回退时"用户可见行为不变"是否可验证？ [Assumption, Gap]
- [x] CHK020 - 不设 AGY 版本门禁所要求的容错行为是否可测试？ [Measurability, Spec §FR-010]
- [x] CHK021 - 桌面环境 PATH 不含用户目录时的可发现性要求是否写明？ [Gap]
- [x] CHK022 - 单用户、本机使用的假设是否限制在需求范围内并被记录？ [Assumption, Spec 假设]

## 一致性与可追溯

- [x] CHK023 - 每条成功标准是否能追溯到至少一条功能需求？ [Traceability]
- [x] CHK024 - "与官方 OAR 插件形态一致"是否被量化到可检查项（工具名、参数、返回格式）？ [Clarity, Spec §FR-016]
- [x] CHK025 - 范围外事项（ACP、多轮、后端 API、账号轮换）是否被明确排除？ [Completeness]
- [x] CHK026 - 术语（委派、子运行、运行时、提供方）是否全文一致？ [Consistency]
- [x] CHK027 - 安装/升级/禁用三条路径的验收是否都覆盖配置保留与恢复？ [Coverage, Spec §FR-013–FR-014]

## 备注

- 本清单只审查需求写作质量，不验证实现；实现验证见 quickstart.md。
- 若勾选过程中发现需求缺口，应回到 spec.md 修订，而不是在清单里补写需求。
