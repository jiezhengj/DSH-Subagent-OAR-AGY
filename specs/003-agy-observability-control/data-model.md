# 数据模型：AGY 委派可观察性与生命周期控制

本 Feature 不改变 DSH 会话存储或官方子代理目录；所有新增状态都是进程内存中的运行观察数据，随 Host 进程结束而消失。

## 实体关系

```text
父会话 (Parent Agent / Session)
  └── 委派运行 (RunRecord) 1..N
        ├── 活动摘要 (ActivityEntry) 0..20
        ├── 状态快照 (StatusSnapshot) 查询时生成
        └── 取消请求 (CancelRequest) 0..N 次，幂等

看门狗配置 (WatchdogConfig)
  ├── 启动等待窗口
  ├── 静默等待窗口
  ├── 活动上限
  └── 终态保留策略
```

## 委派运行 (RunRecord)

一次 AGY 外部委派的观察记录。`childId` 由 provider 生成的 `run.id` 确定，与 DSH 子代理目录中的 external child 标识一致。

| 字段 | 语义 | 约束 |
|---|---|---|
| `childId` | 子任务标识，也是取消/查询的地址 | 非空、进程内唯一 |
| `parentId` | 发起该委派的父会话标识 | 查询/取消时与当前 `exec.agent` 匹配 |
| `state` | 用户可见状态 | `starting` / `running` / `completed` / `failed` / `cancelled` |
| `startedAt` | 子进程启动时间 | ISO 时间 |
| `readyAt` | 收到 `init` 的时间 | 可空；收到前为 `starting` |
| `endedAt` | 终态时间 | 终态必填 |
| `lastActivityAt` | 最近一次重置静默计时的协议事件/生命周期边沿时间 | 启动后随事件更新；stderr 不重置 |
| `lastEventKind` | 最近事件类型 | `init` / `step_update` / `result` / `stderr` / `lifecycle` |
| `pid` | AGY 进程标识 | 可空；启动失败时为空；用于与 `ps` 交叉核对 |
| `conversationId` | AGY 原生会话标识（若 `init`/`result` 提供） | 可空；不用于父会话恢复 |
| `stepIndex` | 最近步骤序号 | 可空 |
| `stepState` | 最近步骤状态 | 可空；来自 `step_update.state` |
| `toolName` | 最近工具名 | 可空；不包含工具参数 |
| `lastText` | 最近文本片段 | 最多 200 字符；滚动截断；不含完整答复 |
| `stopReason` | 官方结果语义 | `completed` / `error` / `aborted`；运行中为空 |
| `failureCategory` | 失败分类 | 终态为失败时必填，见下表 |
| `cancelRequestedAt` | 首次取消请求时间 | 可空；只记录第一次 |
| `terminalNotified` | 是否已产生终态（内部） | 保证只结算一次；不直接暴露 |
| `activity` | 活动摘要环形缓冲 | 最多 20 条，按时间升序 |
| `terminalAt` | 终态清理计时起点 | 终态必填；用于 TTL |

### 状态转换

```text
spawn 成功 ──► starting ──init──► running ──result SUCCESS──► completed
                  │                 │
                  │                 ├─result ERROR──────────► failed
                  │                 ├─result CANCELED───────► cancelled
                  │                 ├─父级取消──────────────► cancelled
                  │                 ├─显式取消──────────────► cancelled
                  │                 ├─绝对 timeoutMs────────► failed (timeout)
                  │                 └─静默窗口到期──────────► failed (stalled)
                  │
                  ├─启动窗口到期────────────────────────────► failed (startup-timeout)
                  ├─spawn 失败/立即崩溃─────────────────────► failed (spawn-failed)
                  └─启动前已取消────────────────────────────► cancelled
```

规则：

1. 每个运行只能进入一次终态；所有竞态（正常完成、父级取消、显式取消、启动超时、静默超时、绝对超时）由同一个结算入口裁决。
2. 进入终态后，看门狗必须清除；终态记录仍可查询，直到 TTL 到期。
3. 取消请求不等于终态；`cancelRequestedAt` 可在 `starting` / `running` 时设置，最终由服务结算。
4. 父会话查询只按 `parentId` 过滤；不同父会话的同名/同 childId 数据不可见。

### 失败分类

| `failureCategory` | 触发场景 | 父级建议方向 |
|---|---|---|
| `startup-timeout` | 启动窗口内未收到 `init` | 检查 AGY 安装/认证/网络，或调大启动窗口 |
| `stalled` | 已就绪后静默窗口内无事件 | 检查任务是否卡住/需要更长窗口 |
| `timeout` | 绝对 `timeoutMs` 到期 | 调大绝对上限或拆分任务 |
| `not-installed` | 命令不存在/不可执行 | 安装 AGY 或修正 `command`/PATH |
| `not-authenticated` | 认证失败 | 在终端完成 AGY 登录/配置认证环境 |
| `spawn-failed` | spawn 系统错误/立即崩溃 | 检查 cwd、权限、进程限制 |
| `protocol` | 非法 JSON、缺少结果、未知致命状态 | 检查 AGY 版本/输出兼容性 |
| `permission` | 权限模式导致自动拒绝 | 调整 `permissionMode` 或任务范围 |
| `unknown` | 未归类错误 | 查看本机脱敏日志 |

## 活动摘要 (ActivityEntry)

运行期间的一条受限观察，用于回答“最近在做什么”，不承载完整转录。

| 字段 | 语义 | 约束 |
|---|---|---|
| `seq` | 运行内递增序号 | 从 1 开始，单调递增 |
| `at` | 事件时间 | ISO 时间 |
| `kind` | 活动类型 | `init` / `step` / `tool` / `text` / `result` / `lifecycle` |
| `stepIndex` | 步骤序号 | 可空 |
| `stepState` | 步骤状态 | 可空 |
| `toolName` | 工具名 | 可空；不含参数 |
| `summary` | 安全短摘要 | 最多 160 字符；已截断/脱敏 |
| `text` | 文本片段（仅 `text` 类） | 最多 200 字符；与 `lastText` 同源 |

规则：

- 只记录有意义的边界（`init`、步骤/工具/状态变化、终态），连续 `text_delta` 不逐条入环，只更新 `lastText` 和 `lastActivityAt`，避免 20 条槽位被 token 填满。
- `stderr` 只作为诊断记录，不重置静默计时；非法 JSON/普通日志同样不重置。
- 环形缓冲满后覆盖最旧条目；序号继续递增。
- 不记录完整 prompt、完整工具参数、完整最终答复、推理内容。

## 状态快照 (StatusSnapshot)

控制工具 `status` 动作的输出，查询时从登记表生成，不持久化；顶层 `action` 固定为 `status`。

| 字段 | 语义 |
|---|---|
| `action` | 固定为 `status` |
| `generatedAt` | 快照生成时间 |
| `found` | 指定 `childId` 时是否存在且有权；列表查询为 `true` |
| `runs` | 运行摘要数组，最多 50 条 |
| `runs[].childId` | 子任务标识 |
| `runs[].state` | 状态 |
| `runs[].readyAt` / `endedAt` | 就绪/结束时间（可空） |
| `runs[].elapsedMs` | 从启动到当前/终态的毫秒数 |
| `runs[].lastActivityAt` | 最近活动时间 |
| `runs[].lastEventKind` | 最近事件类型 |
| `runs[].pid` | 进程标识（若有） |
| `runs[].stepIndex` / `stepState` / `toolName` | 当前/最近步骤信息 |
| `runs[].conversationId` | 原生会话标识（若有） |
| `runs[].lastText` | 受控文本片段 |
| `runs[].stopReason` / `failureCategory` | 终态信息（若已结束） |
| `runs[].cancelRequestedAt` | 取消请求时间（若有） |
| `runs[].activity` | 最近活动摘要，最多 20 条 |

约束：

- 不返回完整最终答复、完整 prompt、工具参数、原始 stderr。
- 指定 `childId` 不存在或不属于当前父会话时，统一 `found: false`，`runs: []`；不区分“不存在”和“无权”。
- 列表查询按 `startedAt` 降序（最新在前）。

## 取消请求 (CancelRequest)

| 字段 | 语义 | 约束 |
|---|---|---|
| `childId` | 目标委派 | 必须是当前父会话的直接子运行 |
| `requestedAt` | 首次请求时间 | 只记录第一次；重复请求不覆盖 |
| `accepted` | 是否已受理 | 已结束/已清理/无权时为 false |
| `reason` | 受理/拒绝原因 | `accepted` / `already-requested` / `already-ended` / `not-found` / `unavailable` |

规则：

- 受理只表示取消信号已提交给共享子代理服务，不表示进程已退出。
- 实际终态与父级通知由共享服务完成；控制工具不自行结算。
- 重复取消返回 `already-requested` 或 `already-ended`，不产生新的终态/通知。

## 看门狗配置 (WatchdogConfig)

| 配置 | 默认值 | 语义 | 边界 |
|---|---|---|---|
| `startupTimeoutMs` | 60_000 | 从 spawn 到 `init` 的等待窗口 | 正整数；过长会延迟启动失败通知 |
| `stallTimeoutMs` | 900_000 | `init` 后连续无“已解析协议事件/生命周期边沿”的等待窗口 | 正整数；过短可能误杀长工具；stderr 不重置 |
| `timeoutMs` | 未设置 | 可选绝对上限，从 `init` 起算 | 保持现有语义；未设置表示不设内部绝对上限 |
| `activityLimit` | 20 | 每运行活动摘要上限 | 1–20；超过后覆盖最旧 |
| `terminalRetentionMs` | 300_000 | 终态记录保留时间 | 正整数；到期后查询不再返回 |
| `maxRecordsPerParent` | 50 | 每父会话记录上限 | 1–50；超限优先淘汰最旧终态 |
| `controlToolName` | `subagent_oar_agy_control` | 控制工具名 | 非空；冲突时用户可改 |

## 不变式与内存边界

1. `childId` 在进程内唯一；记录只能属于一个 `parentId`。
2. 每个运行最多 `activityLimit`（≤20）条活动；每个父会话最多 `maxRecordsPerParent`（≤50）条记录；终态 5 分钟后清理。
3. 最坏情况内存约为 `50 × (20 × 300B + 1KB) ≈ 350KB`/父会话（配置只能降低上限），另有少量运行中记录；不随 token 数增长。
4. 任何父级可见字符串都不包含原始 stderr、完整 prompt、完整工具参数或凭据。
5. 运行登记不改变 `SubagentRun.result`、`dispose()` 或官方子代理目录的数据结构。
