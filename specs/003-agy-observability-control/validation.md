# 验证结论

Feature 003 的实现、fake AGY 全矩阵、真实 AGY 冒烟和组合包发布校验均已完成。官方 `subagent_oar_agy` 的参数、返回结构、描述与 `cordis.patch.yml` 的 provider/tool 行未改变；控制工具随同一工具行注册。

# 环境

- 日期：2026-11-09（Asia/Shanghai）
- Node.js：v26.0.0
- pnpm：12.18.0
- 真实 AGY：`agy 1.5.3`（本机已登录；未记录 token 或认证文件）
- Feature 目录：`/Users/jiezhengj/Documents/Project/subagent_oar_agy/specs/003-agy-observability-control`

# 门禁与静态检查

```bash
python3 .specify/scripts/python/check_prerequisites.py --json --require-tasks --include-tasks
pnpm typecheck
```

结果：

- 前置检查返回 `FEATURE_DIR` 和 `AVAILABLE_DOCS`，无错误。
- `.specify/extensions.yml` 存在但 `hooks` 为空；无 before/after implement 钩子需要执行。
- checklist：`observability.md` 40/40，`requirements.md` 16/16，无未勾选项。
- `pnpm typecheck` 通过。

# 测试与发布校验

```bash
pnpm test
node packages/subagent-oar-agy-bundle/scripts/verify-package.mjs
```

结果：

- `pnpm test`：13 个测试文件、107 个测试全部通过；耗时约 4 秒。
- 集成测试覆盖启动卡住、静默、绝对超时竞争、并发隔离、进程树终止、状态查询、取消/竞态、环境清洗、敏感 stderr、多步活动/TTL 和插件清理。
- `verify-package.mjs`：75 个文件，62093 B packed，215215 B unpacked；通过清单、依赖、`npm pack` 和文件白名单校验。

# 需求与成功标准对应

| 项 | 证据 | 结果 |
|---|---|---|
| US1 / SC-001 | `fails a run that never becomes ready with startup-timeout`；`terminates the AGY process tree after a stall timeout` | PASS |
| US1 / SC-002 | `fails a silent run with stalled after ready`；静默进程树终止用例 | PASS |
| US2 / SC-003 | `reports a running slow run before it completes`；`exposes status and bounded activity`；控制工具 status 测试 | PASS |
| US3 / SC-004 | 取消登记、控制工具 cancel、真实 AGY 取消；`settles only one terminal state when cancel races ...` | PASS |
| US4 / SC-005 | `scrubs credential-shaped and DSH_* variables from the child environment`；`env-dump` 断言 canary 不存在、PATH/HOME 保留、显式 env 生效 | PASS |
| US4 / SC-006 | `keeps raw sensitive stderr out of parent diagnostics and redacts the local log`；errors 脱敏测试 | PASS |
| US5 / SC-007 | 活动上限/合并/TTL 单元测试；多步活动与过期集成测试；状态输出边界测试 | PASS |
| SC-008 | 既有成功/失败/认证/权限/超时/取消测试全部通过；真实 AGY 成功冒烟 | PASS |

# 真实 AGY 冒烟

所有调用均通过 provider 的 `startAgyRun`，使用 `status` 登记表查询；未把 token、认证文件或完整原生转录写入记录。

| 场景 | 结果 |
|---|---|
| 成功 + 终态查询 | `stopReason: completed`，输出 `AGY_SMOKE_OK`；状态为 `completed`；活动序列为 `init, step, text, result, lifecycle`；conversation id 正常返回 |
| 运行中查询 | 状态为 `running`，有 pid、`stepIndex: 0`；活动为 `init, step`；最终输出 `AGY_STATUS_OK`，状态为 `completed` |
| 取消 | 启动后登记 receipt 为 `accepted`；父信号中止后 `stopReason: aborted`，状态为 `cancelled`；父/子进程均退出 |

失败路径（认证失败、权限拒绝、协议错误）已由 fake AGY 集成测试覆盖；真实环境未故意制造认证/权限失败，以免修改本机 AGY 状态。

# 未覆盖范围

- DSH Host 崩溃后的通知恢复、孤儿进程清理。
- 完整原生转录、实时 token 流、继续对话、结构化输出。
- 跨父会话或跨进程的全局运行管理。
- Windows 真实 AGY 冒烟（当前验证环境为 macOS；Windows 代码路径由单元/集成测试和 teardown 测试覆盖）。

## Convergence 修复

已按 Phase 9 收敛任务修复以下契约偏差：

- `T056`：`lastEventKind` 现在返回协议事件类型；活动 `step`/`tool`/`text` 统一映射为 `step_update`，并增加 `run-status.schema.json` 的字段/枚举/上限校验。
- `T057`：取消终态不再写入 `failureCategory: "cancelled"`，保持 `null`，与 schema 和 data-model 的失败分类一致。
- `T058`：`cancel` 缺少 `exec.agent` 时返回 `{ accepted:false, reason:"unavailable" }`，不查询、不取消。
- `T059`：重复取消返回 `accepted:true`、`reason:"already-requested"`，同时保持 registry 收据语义不变。
- `T060`：拒绝的 `cancel` 不再返回 `requestedAt:null`，按契约省略该字段。

# 0.3.0 发布与真实安装验证

## 发布信息

| 项 | 值 |
|---|---|
| 版本 | `0.3.0` |
| Git 提交 | `f1b80ed feat(observability): ship 0.3.0 watchdogs, status and cancel control` |
| Tag | `v0.3.0`（指向 `f1b80ed`，已推送 GitHub） |
| GitHub Release | https://github.com/jiezhengj/DSH-Subagent-OAR-AGY/releases/tag/v0.3.0（2026-11-09T10:37:11Z 发布） |
| Release 资产 | `subagent-oar-agy-0.3.0.tgz`（62093 B） |
| Release 资产 SHA-256 | `021d3ebe6857bdf56afade2bf1195a00f831a3b3ba9eb4dbe7a0ffb2c4f01167` |
| npm 版本 | `@jiezhengj/subagent-oar-agy@0.3.0` |
| npm `dist.shasum` | `936826fb7d4c461fc7012482d31a0dbcf46b3f66` |

核对方式：

- `gh release view v0.3.0` 返回资产 `digest: sha256:021d3ebe…`；随后从 Release 重新下载该资产，实测 SHA-256 与上表一致。
- `npm view @jiezhengj/subagent-oar-agy@0.3.0 version dist.shasum` 返回 `0.3.0` 与上表 shasum。
- 本轮验证未重新发布、未移动 tag、未覆盖任何已发布资产。

## 隔离 headless 注册表安装验证

- 环境：隔离 DSH headless（独立 profile，从 npm registry 安装 `0.3.0`）。
- 模型实际调用 `subagent_oar_agy_control`（`{"action":"status"}`），随后调用 `subagent_oar_agy`（`"runtime":"agy"`）。
- AGY 返回 `AGY_030_REGISTRY_OK`（2026-11-09T10:40:05Z 记录），说明注册表安装的 0.3.0 可被真实宿主加载并调用。
- 未记录 token、认证文件或完整模型转录。

## 重启后的桌面真实调用

- 会话环境：DSH Desktop 完全退出后重新打开的新会话；桌面进程启动时间 `2026-11-09T19:15:37+08:00`（`11:15:37Z`），本会话创建于 `19:15:53+08:00`。
- 桌面 profile：`~/.dsh/profiles/desktop/package.json` 依赖 `"@jiezhengj/subagent-oar-agy": "0.3.0"`；已安装包 `node_modules/@jiezhengj/subagent-oar-agy/package.json` 版本 `0.3.0`；`pnpm-lock.yaml` 解析为 `0.3.0`。
- 插件页/清单显示的版本来源一致：安装操作记录在 `2026-11-09T11:10:13.846Z` 以 `version:"0.3.0"`、`application:"applied"` 完成。
- 插件状态：`include:subagent-agy`（`@jiezhengj/subagent-oar-agy/agy-provider`）与 `include:tool-subagent-oar-agy`（`@jiezhengj/subagent-oar-agy/tool`）均 `enabled:true`、`fiberPhase:"active"`。
- 工具表：本会话同时暴露 `subagent_oar_agy` 与 `subagent_oar_agy_control`，即清单对应的 0.3.0 组件已实际加载。

| 步骤 | 调用 | 结果 |
|---|---|---|
| 1 | `subagent_oar_agy_control` `{"action":"status"}` | `action:"status"`、`found:true`、`runs:[]`（`2026-11-09T11:16:35.775Z`） |
| 2 | `subagent_oar_agy` `{"runtime":"agy","description":"real 0.3.0 desktop smoke","prompt":"Reply with exactly AGY_030_DESKTOP_OK"}` | 启动子运行 `ea74d244-5fa5-49ba-8ade-05f9a84afbe8`；运行期 `status` 显示 `state:"starting"`、`pid:52248`；结束后 `state:"completed"`、`stopReason:"completed"`、`failureCategory:null`、`elapsedMs:9880`，活动序列 `init, step, text, result, lifecycle` |
| 3 | 子代理最终答复 | `AGY_030_DESKTOP_OK`（与提示要求完全一致） |

时间线：`11:16:39.561Z` 启动、`11:16:45.162Z` ready、`11:16:49.441Z` 结束；未记录 token、认证文件或完整模型转录。

## 关于 `sessionController is unavailable`

上一轮在运行中的桌面 profile 上调用 `plugin_manager` 的 `remove_bundle` 时调用被中断，插件操作日志中 `2026-11-09T10:41:01.595Z` 与 `2026-11-09T10:50:37.398Z` 的 `remove` 只有 `started`、没有 `settled`；DSH Host 因此两次热重载（Web 地址从 `52827` → `58967` → `60043`）。热重载期间 Web 客户端出现：

```
session/follow: active Service "sessionController" is unavailable
```

该报错是 live profile 重载过程中 Host 服务图暂时缺少 `sessionController` 造成的，不是插件或 AGY 的失败，也没有造成会话或 profile 数据丢失。完全退出并重新打开 DSH 后，新 Host 在 `60521` 端口启动的新会话中两个工具均正常注册，`status` 与真实 AGY 调用均成功，确认已恢复。此后不再在运行中的桌面 profile 上执行 remove/reinstall。

## 结论

0.3.0 的发布记录、npm 与 GitHub 资产一致性、隔离 headless 注册表安装以及重启后桌面真实调用均已验证通过；本轮只追加验证记录，不改变已发布的 0.3.0 资产、tag 或 npm 版本。
