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
