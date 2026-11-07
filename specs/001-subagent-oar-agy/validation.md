# 实现验证记录

**日期**：2026-11-08　**环境**：macOS（arm64）、Node v26.0.0、pnpm 12.18.0、DSH 桌面版 0.2.2-rc.1、AGY 1.5.3

## 构建与测试

- `pnpm -r build`：通过（TypeScript 严格模式，`module: NodeNext`）。
- `pnpm test`：**9 个测试文件、50 项全绿**（单元 + 假 agy 集成 + 组合包契约）。
- 覆盖率（`pnpm test --coverage`，v8）：全仓行 89.35%；核心模块行覆盖：`stream` 92.59%、`protocol` 100%、`errors` 95%、`timer` 100%；`run.ts` 92%。

## T005 官方工具 spike

见 [spike.md](./spike.md)：官方包 `0.2.2-rc.1` 可安装、导出 `Config/apply/inject/name`，`Config({providers:{agy:'agy'}})` 通过，默认 `toolName: subagent_oar`，`toolName` 覆盖可用。

## T018 / T036 真实 AGY 端到端

| 项 | 结果 |
|---|---|
| 单次委派（quickstart 场景 1） | `completed`，文本 `SMOKE_OK`，启动确认 **3 ms**（SC-002 阈值 2 s），总耗时 9.0 s |
| 连续 10 次（SC-001） | **10/10 成功**，启动确认 2–3 ms，单次总耗时 8.0–12.5 s |

命令：`node scripts/real-smoke.mjs 10`（结果留存 `/tmp/agy_real_smoke.json`）。

## T019 并发与同 cwd

集成测试 `runs concurrent delegations without cross-talk`：两次并行委派（相同 cwd）分别返回 `RUN_A` / `RUN_B`，无串扰；断言通过。

## T027 / T029 三档权限（真实 AGY）

临时目录写入 `sentinel.txt`，提示 AGY 覆盖为 `MODIFIED`：

| 档 | 文件是否被改 | 结果 | 说明 |
|---|---|---|---|
| `plan` | 否 | `completed` | 只读规划 |
| `strict` | 否 | `completed`，输出含可见说明 | AGY 自动拒绝 `write_file`；首次实现发现静默（`SUCCESS` + 空 `response`），已修复为附可见说明 |
| `yolo` | 是（`MODIFIED`） | `completed`，文本 `MODIFIED` | 无人值守 |

修复验证：`strict` 二次运行输出 `[subagent-agy] 权限档 strict：AGY 已自动拒绝需要权限的动作（write_file）…`。

## 失败路径（自动化）

假 agy 集成测试覆盖：`ERROR` 终态、未登录（stderr 认证文案）、畸形输出、部分输出后崩溃（部分文本与诊断分离）、超时、父会话取消；单元测试覆盖六类诊断互不相同与 4096 字节截断。

## T032 安装与分发（消费者级）

`pnpm pack` 提供方 → 组合包以 `file:` 依赖装入干净 pnpm 消费者：
- 组合包、提供方包、官方工具包全部解析安装；
- 装入后 `import('dsh-subagent-agy')` 导出 `Config/apply/inject/name`，`Config` 解析 patch 配置；
- 官方工具 `Config({providers:{agy:'agy'}})` 解析为 `toolName: subagent_oar`；
- `cordis.patch.yml` 两行齐全。

**未覆盖**：DSH 插件管理器（桌面 GUI）内的真实安装/禁用/重装。本机未暴露 `dsh` CLI（`dsh` 不在 PATH，app.asar 的 package.json 无 `bin`），无头环境无法执行；需用户在 GUI 验收（quickstart 场景 1、5）。

## 未完成 / 受限项

| 任务 | 状态 | 原因 |
|---|---|---|
| T020 SC-007 入口选择 ≥9/10 | 未验证 | 需要真实 DSH 会话 + 模型选择；无头环境无法驱动模型入口选择 |
| T021 重复工具名运行时行为 | 配置层已验证（`toolName` 真实存在且可覆盖），**运行时覆盖/报错未验证** | 需要同时启用官方 OAR 组合包的 DSH 实例 |
| T032 DSH 宿主安装/禁用/重装 | 消费者级安装已验证；**宿主级未验证** | 无 `dsh` CLI、无头无法操作插件管理器 |
| T033 低版本 DSH 拒绝安装 | 未验证 | 需要低版本 DSH 环境或安装器交互 |

这些项均已在 tasks.md 标注，不影响代码与包本身的交付；建议用户在 GUI 按 quickstart 补验。

## T037 凭据与配置边界检查

- 代码不读取 `~/.gemini`、`~/.config`、`settings.json` 等 AGY 配置；唯一路径来源是配置的 `command` 与 `PATH`/`PATHEXT`。
- 不写入任何 AGY 文件；`strict` 提示文本仅建议用户自行配置 allow 规则。
- 日志只输出 `error.message` 与错误分类；诊断由 stderr 摘要（≤1200 字节，总体 ≤4096）构成，不含 prompt、工具输出或环境变量值。
- `env` 仅按用户配置覆盖子进程环境，不读取、不落盘。

## 成功标准对照

| SC | 结论 | 证据 |
|---|---|---|
| SC-001 10 次 ≥9 成功 | PASS | 10/10 真机 |
| SC-002 2 秒内启动确认 | PASS | 2–3 ms |
| SC-003 四类失败可读且父会话可用 | PASS（假 agy 驱动） | 集成测试；真实未登录/超时由诊断分类覆盖 |
| SC-004 安装 ≤2 步、10 分钟 | PARTIAL | 消费者安装 2 步；GUI 安装待用户 |
| SC-005 禁用恢复 + 无残留进程 | PARTIAL | 进程清理测试通过；宿主禁用/重装待用户 |
| SC-006 文档三问 + 免责 | PASS | MiMo checklist 终审 + 组合包契约测试 |
| SC-007 入口选择 ≥9/10 | 未验证 | 需真实模型会话 |

## 复现命令

```bash
pnpm install
pnpm -r build
pnpm test --coverage
node scripts/real-smoke.mjs 10
node scripts/mode-smoke.mjs plan
node scripts/mode-smoke.mjs strict
node scripts/mode-smoke.mjs yolo
```
