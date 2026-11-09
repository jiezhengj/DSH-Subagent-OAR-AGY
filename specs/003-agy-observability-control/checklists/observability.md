# 可观察性与生命周期 Checklist: AGY 委派可观察性与生命周期控制

**Purpose**: 审查本 Feature 的需求质量，重点检查生命周期、状态语义、取消、安全边界、资源上限、兼容性与可测量性；不验证实现是否工作。
**Created**: 2026-11-09
**Feature**: [spec.md](../spec.md)

**Note**: 本清单由 `/speckit-checklist` 生成，是 reviewer 所有的需求质量审查产物。
**Review Ownership**: 只有 reviewer 确认某项需求质量标准已满足时才标记 `[x]`。
**Marker Semantics**: `[x]` 表示需求质量已审查通过，不代表实现完成。

## 生命周期与看门狗

- [x] CHK001 - 启动等待窗口与静默等待窗口是否被明确区分，并分别给出可验证的起止条件？[Clarity, Spec §FR-001/§FR-002]
- [x] CHK002 - “活动事件”的定义是否足够精确，能明确哪些事件重置静默计时、哪些不重置？[Clarity, Spec §FR-002/§FR-013]
- [x] CHK003 - 两个窗口的默认值、可配置边界和调整方式是否在需求中明确？[Completeness, Spec §FR-017/Assumptions]
- [x] CHK004 - 绝对 `timeoutMs` 与启动/静默窗口同时到期时的优先级和终态是否定义？[Consistency, Spec §FR-008]
- [x] CHK005 - 是否明确要求所有终止路径只产生一次终态和一次父级通知？[Consistency, Spec §FR-008]
- [x] CHK006 - 每个超时路径是否都要求终止进程树并给出可操作诊断？[Coverage, Spec §FR-009]
- [x] CHK007 - 终止动作本身失败（例如 kill 失败或进程不退出）时的行为是否定义？[Edge Case, Gap]
- [x] CHK008 - 启动阶段进程立即崩溃、spawn 失败与启动超时是否被区分为不同失败分类？[Clarity, Spec §FR-001/§FR-009]
- [x] CHK009 - 模型不主动查询状态时，是否仍由看门狗保证父会话最终被通知？[Coverage, User Story 1]

## 状态与可观察性

- [x] CHK010 - 状态字段集合是否足以区分启动中、运行中、已完成、失败和已取消？[Completeness, Spec §FR-003]
- [x] CHK011 - `elapsedMs` 的时间基准（墙钟/活跃时间）和终态计算方式是否明确？[Clarity, Spec §FR-003]
- [x] CHK012 - 最近活动的排序、数量上限和时间戳语义是否明确？[Clarity, Spec §FR-013]
- [x] CHK013 - 是否明确状态查询无副作用，且不得创建、恢复或继续委派？[Consistency, Spec §FR-004]
- [x] CHK014 - 状态查询的父级作用域和“直接委派”边界是否无歧义？[Security, Spec §FR-004]
- [x] CHK015 - 不存在、已清理、其他父会话和无权查询是否统一为不泄露的结果？[Coverage, Spec §FR-005]
- [x] CHK016 - 当前父会话没有委派时的空结果行为是否定义？[Coverage, Spec §FR-005]
- [x] CHK017 - 终态保留期及其到期后的用户可见效果是否明确？[Clarity, Spec §FR-014]
- [x] CHK018 - 状态输出禁止包含的敏感内容（完整 prompt、工具参数、完整答复、原始 stderr）是否明确？[Security, Spec §FR-011/§FR-013]

## 取消语义

- [x] CHK019 - 显式取消与父回合取消、父会话关闭是否被明确区分？[Clarity, Spec §FR-006/§FR-008]
- [x] CHK020 - “取消已受理”与“进程已停止”的区别是否明确，避免把受理误报为完成？[Clarity, Spec §FR-006]
- [x] CHK021 - 重复取消、取消已结束任务、取消不存在任务的行为是否分别定义？[Completeness, Spec §FR-007]
- [x] CHK022 - 取消权限是否限定为当前父会话的直接委派？[Security, Spec §FR-006]
- [x] CHK023 - 取消与正常完成竞争时的终态、通知顺序和去重规则是否定义？[Consistency, Spec §FR-008]
- [x] CHK024 - 取消发生在启动阶段、原生会话尚未就绪时的行为是否定义？[Edge Case, Spec §Edge Cases]

## 安全与隐私边界

- [x] CHK025 - 环境清洗的匹配范围（凭据形状、`DSH_*`、大小写）是否明确？[Clarity, Spec §FR-010]
- [x] CHK026 - 显式 `env` 覆盖与 `null` 删除的优先级是否明确？[Clarity, Spec §FR-010]
- [x] CHK027 - `HOME`、`PATH`、代理/证书等运行必需变量的保留规则是否明确？[Completeness, Spec §FR-010]
- [x] CHK028 - 清洗导致认证失败时，是否要求给出可操作提示而不是静默继承凭据？[Coverage, User Story 4]
- [x] CHK029 - 父级诊断允许包含的内容与禁止包含的内容是否可客观判定？[Clarity, Spec §FR-011]
- [x] CHK030 - 本地调试记录的截断、脱敏、保留和访问边界是否定义？[Completeness, Spec §FR-012]

## 资源上限与保留

- [x] CHK031 - 活动条数、运行记录数、终态保留时间是否有量化上限？[Measurability, Spec §FR-014/Assumptions]
- [x] CHK032 - 清理触发条件（定时、惰性查询或两者）是否定义，避免无限增长？[Completeness, Gap]
- [x] CHK033 - 超过记录上限时淘汰哪类记录、是否影响运行中任务是否明确？[Edge Case, Gap]

## 兼容性与插件生命周期

- [x] CHK034 - 是否明确不改变官方 `subagent_oar_agy` 的参数、返回值和一次性语义？[Consistency, Spec §FR-015/§FR-018]
- [x] CHK035 - 插件禁用后控制工具和登记表生命周期的要求是否定义？[Coverage, Spec §FR-016]
- [x] CHK036 - 已有会话看不到新工具时的用户提示/升级行为是否定义？[Edge Case, Plan §Risks/T049]
- [x] CHK037 - 新配置的非法值（负值、过大值、零值）校验行为是否定义？[Gap, Spec §FR-017]

## 测量与边界

- [x] CHK038 - 每个成功标准是否可测量，并与至少一个用户故事/需求对应？[Measurability, Spec §SC-001–§SC-008]
- [x] CHK039 - 真实 AGY 冒烟的前置条件、授权要求和“不得处理 token”边界是否明确？[Dependency, Assumptions]
- [x] CHK040 - 本 Feature 明确排除的 UI、Host 崩溃恢复、完整流式输出等边界是否写明？[Boundary, Assumptions]

## Notes

- 仅审查需求文本的质量，不把实现行为当作检查对象。
- 未检查项表示仍需 reviewer 判断、补充或修订。
- `/speckit-implement` 会读取本清单的勾选状态作为门禁，但不会修改标记。
- `checklists/requirements.md` 是 `/speckit-specify` 与 `/speckit-clarify` 维护的内置规格质量清单，与本清单分开。
