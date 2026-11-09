# 快速验证：AGY 委派可观察性与生命周期控制

本文件是设计阶段的验证指南，不包含实现代码。实现完成后按以下顺序验证；真实 AGY 步骤只在用户授权并已登录的机器上执行。

## 前置条件

- 仓库根目录：`/Users/jiezhengj/Documents/Project/subagent_oar_agy`
- Node.js >= 22、pnpm 12.x
- DSH 0.2.2-rc.1（或声明的兼容范围）与可用的 `agy` CLI
- 真实 AGY 冒烟需要已登录的 AGY 环境；不要使用或复制 OAuth token
- 测试不需要真实 AGY，使用 `packages/subagent-oar-agy-provider/test/fixtures/fake-agy.mjs`

## 1. 构建与静态检查

```bash
pnpm install
pnpm typecheck
pnpm build
```

预期：

- 两个包构建成功，bundle 的 `provider/` 包含新增的 `runs.js`。
- `pnpm typecheck` 无错误。
- bundle 的 `verify` 脚本通过：

```bash
node packages/subagent-oar-agy-bundle/scripts/verify-package.mjs
```

## 2. 单元与集成测试

```bash
pnpm test
```

重点用例：

| 用例 | 输入/模式 | 预期 |
|---|---|---|
| 启动卡住 | fake `no-init` + `startupTimeoutMs: 300` | 约 300ms 后 `stopReason: error`，诊断含启动超时分类，子进程退出 |
| 就绪后静默 | fake `silent` + `stallTimeoutMs: 300` | 约 300ms 后失败，诊断含静默超时分类 |
| 绝对超时兼容 | fake `slow` + `timeoutMs: 200` | 仍从 `init` 起算并失败，旧行为不变 |
| 正常完成 | fake 默认 | `completed`，输出含 `FAKE_OK` |
| 进程无结果退出 | fake `crash-no-result` | `error`，诊断可操作，不无限等待 |
| 敏感 stderr | fake `sensitive-stderr` + canary | 父级诊断不含 canary；本地日志有脱敏记录 |
| 环境清洗 | fake `env-dump` + canary/`DSH_*` | 子进程环境无 canary/`DSH_*`；`PATH`/`HOME` 保留 |
| 状态隔离 | 父 A 查询父 B 的 childId | `found: false`，不泄露 B 信息 |
| 取消幂等 | 连续两次 cancel | 首次 `accepted`，再次 `already-requested` 或 `already-ended`，只有一次终态 |
| 竞态 | 取消/超时/完成同时触发 | 只有一个终态、一次父级通知 |

## 3. 控制工具表面（无需真实 AGY）

在测试中用 mock `ctx.tools` 捕获注册结果，确认：

1. `subagent_oar_agy`（官方/回退）保持原名称、参数、返回结构。
2. 同一插件加载后注册 `subagent_oar_agy_control`。
3. `status` 无参返回当前父会话的运行列表；指定不存在的 childId 返回 `found: false`。
4. `cancel` 缺少 childId 时参数校验失败；无权/不存在统一 `not-found`。
5. 插件卸载/禁用后控制工具不可调用，登记表不再增长。

## 4. 组合包安装与 DSH 内冒烟

```bash
# 构建后在 DSH 的插件安装入口安装本地 tarball，或按 docs/INSTALL.md 使用远端 tarball
pnpm --dir packages/subagent-oar-agy-bundle pack
```

在 DSH 中安装后，**新建会话**（已有会话工具表在创建时固定，不会自动出现新工具），然后：

1. 让模型调用 `subagent_oar_agy` 委派一个会持续几十秒的任务，例如“逐步检查当前目录并报告，每步之间等待”。
2. 立即让模型调用 `subagent_oar_agy_control`，`action: "status"`：
   - 预期看到 `state` 为 `starting` 或 `running`；
   - `pid`、`startedAt`、`elapsedMs`、`lastActivityAt` 有值；
   - 随任务推进，`lastEventKind`、`stepIndex`、`toolName`、`lastText` 更新。
3. 再调用 `action: "cancel"`，带该 `childId`：
   - 预期 `accepted: true`；
   - 随后父会话收到停止/失败通知；
   - 再次查询，状态为 `cancelled`，随后按保留期清理。
4. 委派一个很快完成的任务，不查询状态，确认父会话在完成时自动恢复并收到最终答复。
5. 启动一个长任务后保持父会话空闲，确认启动/静默看门狗不会误杀正常活动；将 `stallTimeoutMs` 临时调小，确认会按预期失败并通知。
6. 禁用插件后确认控制工具不可调用、登记表不再增长，且尚未结算的 AGY 进程树已退出。

## 5. 真实 AGY 成功冒烟

在已登录、已授权的环境执行一次最小任务：

```text
请只回复 AGY_SMOKE_OK，不要读取文件、不要运行命令。
```

预期：

- `subagent_oar_agy` 返回 `started subagent <id>`。
- 父会话先继续做别的事，随后自动收到完成通知，最终答复包含 `AGY_SMOKE_OK`。
- 使用 `subagent_oar_agy_control` 查询该 id，终态为 `completed`，`stopReason: completed`。
- 父会话诊断/状态中不出现完整原生转录。

## 6. 安全边界验证

在启动 DSH 前设置可识别 canary：

```bash
export DSH_TEST_SECRET_CANARY="CANARY_DO_NOT_LEAK"
export DSH_TEST_INTERNAL_CANARY="DSH_INTERNAL_DO_NOT_LEAK"
export TEST_API_KEY="API_KEY_DO_NOT_LEAK"
export SERVICE_TOKEN="SERVICE_TOKEN_DO_NOT_LEAK"
```

用 fake `env-dump` 委派，检查子进程环境转储：

- 四个 canary 均不存在；
- `PATH`、`HOME` 存在；
- 显式配置的 `env` 值存在，`null` 删除生效。

用 fake `sensitive-stderr` 触发失败，检查：

- 父级完成通知/诊断不含 canary；
- 本机日志含脱敏后的摘要，原始 token/路径被替换或截断；
- 状态工具 `lastText`/`activity` 不含 canary 或完整 stderr。

## 7. 失败注入与可诊断性

| 场景 | 方法 | 预期 |
|---|---|---|
| 未安装 | `command` 指向不存在路径 | 启动前 `not-installed`，提示安装/修正命令 |
| 未认证 | 使用未登录环境或 fake `auth-failure` | `not-authenticated`，提示登录，不泄露原始 token |
| 启动卡住 | fake `no-init` | `startup-timeout`，进程树终止 |
| 运行静默 | fake `silent` | `stalled`，进程树终止 |
| 非法输出 | fake `malformed` | `protocol`，不无限等待 |
| 取消 | 运行中 cancel | `cancelled`，无残留进程 |
| 父会话取消 | 中断父回合 | `aborted`，无残留进程 |

## 8. 回归检查

```bash
pnpm test
pnpm typecheck
node packages/subagent-oar-agy-bundle/scripts/verify-package.mjs
```

必须保持：

- 现有 `subagent_oar_agy` 成功/失败/认证/权限/超时/取消测试通过；
- `cordis.patch.yml` 仍只有原有 provider 行和工具行（控制工具由同一工具行注册）；
- 新配置都有默认值，旧配置无需迁移；
- README/DETAIL 的配置表、默认值、状态/取消用法和安全边界与实际一致。

## 默认值速查

| 配置 | 默认值 | 作用 |
|---|---|---|
| `startupTimeoutMs` | 60000 | spawn 到 `init` 的启动窗口 |
| `stallTimeoutMs` | 900000 | `init` 后无事件静默窗口 |
| `timeoutMs` | 未设置 | 可选的绝对上限，从 `init` 起算 |
| `activityLimit` | 20 | 每运行活动摘要上限 |
| `terminalRetentionMs` | 300000 | 终态记录保留时间 |
| `maxRecordsPerParent` | 50 | 每父会话记录上限 |
| `controlToolName` | `subagent_oar_agy_control` | 控制工具名 |

## 不在本 Feature 验证范围

- DSH external 子代理目录行变成可打开/可展开；
- Host 崩溃后的完成通知恢复或孤儿进程清理；
- 完整原生转录、实时 token 流、继续对话、结构化输出；
- 跨父会话/跨进程的全局运行管理。
