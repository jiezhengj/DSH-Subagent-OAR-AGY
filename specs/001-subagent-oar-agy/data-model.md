# 数据模型：subagent_oar_agy

本 feature 没有持久化数据；"实体"是进程内配置、委派运行与其事件。以下字段是实现层的数据形状，用户可见行为以 spec.md 为准。

## 1. ProviderConfig（组合包 patch 中的提供方行）

| 字段 | 类型 | 默认值 | 约束 | 说明 |
|---|---|---|---|---|
| `providerName` | string | `agy` | 非空 | 注册到 `ctx.subagents` 的名称，对应官方工具 `providers` 映射的右值 |
| `command` | string | `agy` | 非空 | AGY 可执行文件；相对名称走 PATH，含分隔符按路径解析 |
| `model` | string? | 无 | 非空 | 映射到 `--model`；省略则由 AGY 自身设置决定 |
| `effort` | string? | 无 | 非空 | 映射到 `--effort`；省略则不传 |
| `permissionMode` | `yolo` \| `plan` \| `strict` | `yolo` | 枚举 | 三档权限行为（见 contracts/agy-cli.md） |
| `timeoutMs` | number? | 无（仅随父取消） | 正整数，≤ `MAX_TIMER_DELAY_MS` | 单次委派期限；从 `init` 事件起算 |
| `killGraceMs` | number | `10000` | 正整数，≤ `MAX_TIMER_DELAY_MS` | SIGTERM 到 SIGKILL 的宽限（Windows 不适用） |
| `env` | Record<string, string \| null> | `{}` | 键值合法 | 叠加在父进程环境之上；`null` 表示删除该键 |
| `locale` | `auto` 或 8 语言之一 | `auto` | 枚举/语言标识 | 运行时文案语言；`auto` 依次取 DSH `locale.preference`、`DSH_LOCALE`/`LC_ALL`/`LANG`，最后 `en` |

**校验规则**：`timeoutMs`/`killGraceMs` 必须是正有限数；`permissionMode` 必须是枚举值；`providerName`/`command` 不得为空白；非法配置在插件激活时抛错（与 OAR 的 `assertPositiveFinite` 风格一致）。

## 2. DelegationRun（一次委派的运行状态）

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | branded SessionId | 提供方生成的 run id（UUID），用于 `subagent/start`/`subagent/end` 关联 |
| `childPid` | number? | 子进程 pid；未 spawn 成功时为空 |
| `state` | `starting` \| `running` \| `settling` \| `disposed` | 生命周期状态 |
| `terminal` | `completed` \| `error` \| `aborted` \| `timeout` | 终态原因；与 `SubagentResult.stopReason` 的映射见下 |
| `output` | ContentBlock[] | 最终答复（`result.response` 转为单个 text block） |
| `diagnostic` | string? | 安全失败摘要（≤4096 UTF-8 字节，由 `settleRunResult` 兜底裁剪） |
| `startedAt` / `settledAt` | number | 毫秒时间戳，用于超时与诊断 |

**状态转移**：

```text
starting --spawn ok--> running --result SUCCESS--> settling(completed)
   |                        |
   |                        +--result ERROR / 进程非零退出 / 流损坏--> settling(error)
   |                        +--result CANCELED/INTERRUPTED 或 signal abort--> settling(aborted)
   |                        +--timeoutMs 到期--> settling(timeout→error)
   |                        +--dispose()--> settling(aborted)
   |
   +--spawn/解析失败--> settling(error)（不发布 run，start() reject）
```

`settling` 统一做终止阶梯与清理，完成后进入 `disposed`；`dispose()` 幂等。

## 3. AgyEvent（stream-json 事件，宽松判别）

| 事件 | 关键字段 | 用途 |
|---|---|---|
| `init` | `conversation_id`, `init.cwd`, `init.tools`, `init.permission_mode`, `init.model?` | 记录运行配置；启动 `timeoutMs` 计时；诊断 |
| `step_update` | `conversation_id`, `step_index`, `state`（ACTIVE/DONE）, `step_type`, `text_delta?`, `tool_info?`, `subagent_info?`, `usage?` | 累积文本、记录工具调用用于诊断；不进入最终答复 |
| `result` | `conversation_id`, `status`, `response`, `error?`, `duration_seconds`, `num_turns`, `usage` | 终态判定与最终答复 |
| 未知 `event` | — | 忽略并告警（不中断流） |

**终态映射**：

| AGY `status` | `SubagentStopReason` | 说明 |
|---|---|---|
| `SUCCESS` | `completed` | `response` 作为 output |
| `ERROR` | `error` | `error` 字段（清洗后）作为 diagnostic |
| `CANCELED` | `aborted` | 进程被外部取消 |
| `INTERRUPTED` | `aborted` | 进程收到 SIGINT |
| `INVALID` / `WAITING` / `RUNNING` | `error` | 非正常终态，附 status 说明 |

## 4. FailureCategory（诊断分类）

| 分类 | 触发 | 诊断文案要点 |
|---|---|---|
| `not-installed` | command 解析失败 | 说明未找到 AGY、如何安装/配置 `command` |
| `not-authenticated` | 退出非 0 且 stderr/错误含认证提示，或结果含 "authentication required" | 提示先交互登录 AGY |
| `timeout` | `timeoutMs` 到期 | 说明时限、已终止、可调大 `timeoutMs` |
| `spawn-failed` | spawn 抛错（权限、cwd 不可进入等） | 说明具体原因（EACCES/ENOENT 等） |
| `protocol` | 无 `result` 事件但进程退出/流无法解析 | 附退出码与 stderr 摘要 |
| `cancelled` | 父信号取消 | 不产生面向模型的错误，结算为 aborted |

**关系**：ProviderConfig 1—N DelegationRun；DelegationRun 1—N AgyEvent（仅内存）；DelegationRun 产生 0..1 FailureCategory。

## 5. 分发包（安装单元）

| 组成 | 说明 |
|---|---|
| `package.json` | `dsh.bundle.patch`、`engines.dsh`、`exports`（`./agy-provider`、`./locale/*`、`./agy-provider/locale/*`、`./icon`、`./package.json`） |
| `cordis.patch.yml` | 提供方行（包内子路径）+ 官方工具行（`toolName: subagent_oar_agy`） |
| `provider/` | 构建时复制的提供方 `dist` 与 `locale`（自包含运行时代码） |
| `locale/<lang>.json` | 8 语言插件页标题/描述/详情指向 |
| `docs/DETAIL.<lang>.md` | 8 语言实现说明 |
| `icon.svg`、`README.md`、`docs/INSTALL.md` | 展示与安装说明 |

分发单元以 GitHub Release tarball 发布；安装后由 pnpm 展开到 profile，patch 行经 Cordis loader 解析。
