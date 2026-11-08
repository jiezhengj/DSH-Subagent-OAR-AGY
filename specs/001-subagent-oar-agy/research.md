# Phase 0 研究：subagent_oar_agy

每条结论给出 Decision / Rationale / Alternatives considered，并标注证据来源（DSH 源码按 tag `dsh-v0.2.2-rc.1`；AGY 文档为官方 headless 页；本机实测样本在 `/tmp/agy_smoke/`）。

## D1. 注册接缝与 provider 形态

- **Decision**：提供方包导出 `apply(ctx, config)`，构造 `SubagentProvider { name, capabilities: NO_START_CAPABILITIES, inheritsParentContext: false, start }` 并调用 `ctx.subagents.registerProvider(provider)`。
- **Rationale**：与官方 OAR 提供方源码完全一致的注册方式；`NO_START_CAPABILITIES` 表明不支持 `agentOptions`/`agentPreset`/`outputSchema`/`depthLimit`，服务会在启动前拒绝这些请求，而不是静默忽略。
- **Alternatives considered**：
  - 实现本地 Agent 子运行（in-process）：需要共享父上下文与工具注册，违背"独立任务、非父上下文"的产品定义。
  - 复用官方 OAR 提供方：其 antigravity 运行时只支持 ACP，与硬约束冲突（见 decision.md）。

## D2. AGY 调用形态：stdin stream-json，而非 argv 提示

- **Decision**：启动 `agy --input-format stream-json --output-format stream-json`，向 stdin 写入一行 `{"event":"user","message":{"content":"<prompt>"}}`；收到 `result` 后关闭 stdin，等待进程退出。
- **Rationale**：官方文档明确 `--input-format stream-json` 从 stdin 读取每条提示、每条执行一个 turn 并以 `result` 结束；关闭 stdin 后当前 turn 完成即退出（退出码 0）。这避免 argv 长度上限（composed prompt 可能很长），也避免 `-p "..."` 的引号/转义问题。
- **Alternatives considered**：
  - `agy -p "<prompt>" --output-format stream-json`：实现最简单，但长提示受 `ARG_MAX` 限制；文档也说明与 `--input-format stream-json` 同用时命令行提示会被丢弃，混用易错。
  - `--output-format json` 单信封：更简单，但拿不到中途事件，无法区分"运行中卡住"与"正常长任务"，且失去未来流式展示空间。

## D3. 事件解析与终态映射

- **Decision**：逐行解析 NDJSON，按 `event` 字段分派：`init`（记录 `cwd/tools/permission_mode`）、`step_update`（累积 `text_delta`、记录 `tool_info`，仅用于诊断）、`result`（终态）。终态 `status` 映射：`SUCCESS → completed`，`ERROR → error`，`CANCELED`/`INTERRUPTED → aborted`，其余（`INVALID`/`WAITING`/`RUNNING`）→ `error`。
- **Rationale**：与官方文档的流结构与状态表一致；本机实测样本（2026-11-07）验证 `init → step_update → result` 顺序与字段。
- **Alternatives considered**：
  - 只读最后一行 `result`：实现简单但错误恢复差（进程被杀时无最后一行）。
  - 严格校验每个字段：未知事件/新增字段会直接失败，违背"容错未知事件"的要求。

## D4. 权限三档映射

- **Decision**：`permissionMode` 配置三档：`yolo`（默认）追加 `--dangerously-skip-permissions`；`plan` 追加 `--mode plan`；`strict` 不追加任何权限放行参数（AGY 在非交互下对需要审批的动作软拒绝，仍退出 0，并在 stderr 提示）。
- **Rationale**：AGY 没有 Claude 式的 `--permission-mode` 细粒度开关；`plan` 是官方提供的只读模式，`strict` 依赖官方软拒绝语义，两档都可观测、可文档化。用户已确认默认 `yolo`，并要求提供两档保守模式（spec 澄清 Q1）。
- **Alternatives considered**：
  - 默认 `strict`：与用户决策冲突，且多数任务无法完成。
  - 用 `settings.json` 的 `permissions.allow` 做细粒度控制：属于修改 AGY 全局配置，违背"不修改 AGY 配置"的边界。

## D5. 可执行文件解析

- **Decision**：配置 `command`（默认 `agy`）。启动前解析：含路径分隔符则按路径检查可执行；否则扫描 `PATH`（Windows 追加 `PATHEXT`），命中第一个可执行文件；找不到则返回"AGY 未安装/不在 PATH"的可操作错误，不进入 spawn。
- **Rationale**：桌面 App 的 PATH 通常不含 `~/.local/bin`，提前解析能给出比 `spawn ENOENT` 更可诊断的提示；与官方 OAR `locateExecutable` 的思路一致。
- **Alternatives considered**：直接 `spawn` 并依赖 ENOENT：错误信息难读，且 Windows 上 `ENOENT` 与权限错误难区分。

## D6. 超时与进程终止阶梯

- **Decision**：`timeoutMs` 可选，从收到 `init` 事件起算（排除启动）；到期与取消共用同一条终止阶梯：POSIX 向进程组 `SIGTERM`，等待 `killGraceMs`（默认 10000），仍存活则 `SIGKILL`；Windows 直接 `taskkill /PID <pid> /T /F`。`dispose()` 幂等，等待进程真正退出后才 resolve。
- **Rationale**：`agy` 会派生工具子进程，必须整组/整树终止；与官方 OAR 的 `KILL_GRACE_MS = 10_000` 一致。超时以 `stopReason: 'error'` + 诊断呈现（与 spec FR-009、SC-003 的"四类可读错误"一致）；取消以 `aborted` 呈现（由 `settleRunResult` 的 cancelled 分支决定）。
- **Alternatives considered**：
  - 传 `--print-timeout` 交给 AGY 自己超时：AGY 退出码 3 但外层进程与工具子进程可能残留，且无法覆盖"启动阶段卡住"。
  - 只杀父进程：会留下工具子进程（尤其 `run_command` 派生的 shell）。

## D7. 官方工具复用与版本锁定

- **Decision**：组合包依赖官方 `@deepseek-ai/dsh-experimental-tool-subagent-oar`，**精确锁定 `0.2.2-rc.1`**；patch 行配置 `providers: {agy: agy}`。若 spike 发现该版本不可安装或接口不符，退回 Option B（自写同形工具与提供方），并同步修订 plan/spec 的实现部分（用户可见行为不变）。
- **Rationale**：官方工具源码已确认 `providers` 的值是"已注册 provider 名"，且只拒绝 `prepareContinuable`/`inheritsParentContext: true`；精确锁定避免实验包漂移导致用户端静默变化。
- **Alternatives considered**：用 `^0.2.2-rc.1` 范围：实验期小版本也可能改变工具 schema，用户侧难以诊断。

## D8. 组合包结构与版本门禁

- **Decision**（v0.2.2 修订）：组合包 `@jiezhengj/subagent_oar_agy` 的 `package.json` 声明 `dsh.bundle.patch: ./cordis.patch.yml`、`listedByDefault: false`、`engines.dsh: ">=0.2.2-rc.1 <0.3.0"`；提供方只作 devDependency，构建时复制其 `dist` 与 `locale` 到 `provider/`，patch 用包内子路径引用；运行依赖为宿主包与官方工具（精确版本），发布物为自包含 tarball。
- **Rationale**：与官方 `ralph-bundle` 的打包方式一致；自包含使未上架 npm 的插件可由 DSH 安装框直接安装远端 tarball（FR-023）。
- **Alternatives considered**：
  - 依赖单独的提供方 npm 包：需要先发布提供方，且用户安装失败面更大。
  - 单包（提供方源码并入组合包）：开发/测试成本更高，保持 workspace 两包更清晰。
  - 只发提供方包：用户需手工插行，违背"安装 ≤ 2 步"（SC-004）。

## D9. 工具名与冲突

- **Decision**：组合包默认把 `toolName` 设为 `subagent_oar_agy`，与官方 OAR 组合包的 `subagent_oar` 区分，二者可同时启用；没有官方 OAR 的用户可覆盖回 `subagent_oar`。实测 DSH 对重复工具名会报错并拒绝第二个注册（`tool "subagent_oar" is already registered`），不会静默覆盖，因此发布版 MUST NOT 默认占用官方名字。
- **Rationale**：用户要求"像官方新插件"，名称一致最直观；官方 OAR 组合包目前不在桌面默认组合包中，冲突是少数场景。
- **Alternatives considered**：默认 `subagent_oar`（与官方同名，冲突不可接受）；默认 `subagent_oar_agy`（选用，唯一且贴合项目名）。

## D10. 测试策略

- **Decision**：单元测试覆盖纯函数（行缓冲、事件解析、错误分类、命令解析、超时状态机）；集成测试用 Node 写的假 `agy` 脚本（可编排事件、退出码、延迟、信号处理）驱动真实子进程；真实 AGY 端到端只在 quickstart 手工执行（需授权、消耗配额）。
- **Rationale**：不依赖真实 AGY 也能覆盖协议与生命周期；真实冒烟验证端到端集成与认证路径。
- **Alternatives considered**：只做真实 AGY 测试：不稳定、耗配额、无法在 CI 覆盖错误分支。

## 未决与后续

- 官方工具包 spike 已执行：PASS（见 spike.md）。
- `toolName` 冲突行为已实测：DSH 报错并拒绝第二个注册；发布版默认 `subagent_oar_agy`。
- Windows 进程树终止仍需在 Windows 环境验证一次（CI 或手工）。
- 若后续上架 npm，需要恢复发布流程与版本策略；当前分发以 GitHub Release tarball 为准。

## D11. 自包含 tarball 与 GitHub Release 分发

- **Decision**：组合包构建时把提供方 `dist` 与 `locale` 复制进 `provider/`，patch 引用 `@jiezhengj/subagent_oar_agy/agy-provider`；发布物为 GitHub Release 资产，README 给出安装框完整 URL。根 README 作为语言索引页，链接 8 个 `README.<lang>.md`。
- **Rationale**：插件未上架 npm；DSH 插件管理把安装输入作为 pnpm spec，可直接拉取远端 tarball。自包含避免 workspace/file 依赖在用户机器上不可解析。
- **Alternatives considered**：发布 npm 包（需要账号与版本管理，且用户明确先走 GitHub）；要求用户 clone 后本地 `dsh plugin add`（步骤多、违背 SC-004）。

## D12. exports 与插件页元数据资源

- **Decision**：组合包 `exports` 显式导出 `./locale/*`、`./agy-provider/locale/*`、`./icon`、`./package.json`。`package.json` 一旦声明 `exports`，DSH 的 `readPluginMeta` 才能通过 Node 解析器读到 locale 元数据；否则标题回退为包名。
- **Rationale**：v0.2.2 实测回归：自包含改造加 `exports` 后，插件页显示 `@jiezhengj/subagent_oar_agy`；`readPluginMeta` 对缺失资源返回 undefined。v0.2.3 补齐导出后，组合包与提供方子路径均解析出 8 语言标题/描述/图标。
- **Alternatives considered**：移除 `exports`（会破坏 `agy-provider` 子路径加载）；把 provider 作为独立包（增加分发复杂度）。

## D13. README 风格

- **Decision**：仓库根 `README.md` 只做语言索引与安装入口，正文拆到 `README.<lang>.md`；语言导航在索引与各正文中互链。
- **Rationale**：用户要求"README 是索引页，链接 8 种语言"；也避免根 README 过长。
- **Alternatives considered**：单 README 内嵌多语言（过长、语言跳转体验差）。
