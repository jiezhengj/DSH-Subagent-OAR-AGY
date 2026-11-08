# 实现计划：subagent_oar_agy（官方 OAR 工具 + 非 ACP 的 AGY 提供方）

**Branch**: `001-subagent-oar-agy` | **Date**: 2026-11-07（修订 2026-11-08：自包含分发、i18n、元数据导出） | **Spec**: [spec.md](./spec.md)

**Input**: 功能规格 `specs/001-subagent-oar-agy/spec.md`；评估决策 `.specify/assessments/subagent-oar-agy/decision.md`（Option D：官方 `subagent_oar` 工具 + 自写非 ACP 提供方）。

## 摘要

发布一个可分发的 DSH 组合包：组合包挂载**官方** `@deepseek-ai/dsh-experimental-tool-subagent-oar`（模型侧工具名默认 `subagent_oar_agy`，`providers: {agy: agy}`），并挂载我们自写的**只做 AGY 运行时**的提供方包。自 v0.2.2 起提供方在构建时被复制进组合包（`provider/`），组合包成为自包含 tarball，可从公开 GitHub Release 直接安装，不依赖 npm 上架或仓库克隆。提供方收到委派后启动本机 `agy --input-format stream-json --output-format stream-json`，通过 stdin 送入一条 `user` 事件，解析 NDJSON 事件流，把终态 `result.response` 作为最终答复交回 DSH；进程生命周期、取消、超时与进程树清理由提供方负责。全程不实现 ACP，不接触 AGY 凭据或后端 API。

## 技术上下文

**Language/Version**: TypeScript 5.x（ESM，`module: nodenext`），Node.js ≥ 22（DSH 桌面运行时）

**Primary Dependencies**:
- 组合包运行依赖（随 tarball 安装）：`@deepseek-ai/cordis`、`@deepseek-ai/dsh-brand`、`@deepseek-ai/dsh-llm`、`@deepseek-ai/dsh-subagent`（`SubagentProvider`、`NO_START_CAPABILITIES`、`subprocessRunHandle`、`settleRunResult`、`assertUsableCwd`）、`@deepseek-ai/dsh-timeout`（`MAX_TIMER_DELAY_MS`）、`@deepseek-ai/schemastery`，以及官方工具 `@deepseek-ai/dsh-experimental-tool-subagent-oar`（精确锁定 `0.2.2-rc.1`）
- 仓库内提供方：`@jiezhengj/subagent_oar_agy-provider`（workspace，仅 devDependency；构建时 `scripts/vendor-provider.mjs` 把 `dist` 与 `locale` 复制为组合包 `provider/`）
- 组合包 `exports` 必须导出 `./agy-provider`、`./agy-provider/locale/*`、`./locale/*`、`./icon`、`./package.json`，供 patch 加载与 DSH 插件页元数据解析

**Storage**: 无持久化存储；不写 AGY 凭据、不写会话数据

**Testing**: `vitest`（单元 + 以假 `agy` 脚本驱动的集成）；真实 AGY 端到端冒烟由 quickstart 人工执行

**Target Platform**: macOS / Linux / Windows 上的 DSH 桌面（Node 运行时）

**Project Type**: DSH 插件 monorepo（提供方包 + 组合包），pnpm workspace

**Performance Goals**: 发起委派到父会话收到启动确认 < 2 秒（SC-002）；单次委派本身不设吞吐目标；事件流解析为线性 O(n)

**Constraints**: 非 ACP；只通过官方 `agy` CLI 子进程；默认无人值守权限；不设 AGY 版本上下限；未知 `stream-json` 事件必须容错；取消/超时必须整棵进程树终止（Windows 用 `taskkill /T /F`）

**Scale/Scope**: 单用户本机，同时运行的委派数量为个位数到几十；目标代码量约 800–1200 行（提供方 + 测试），组合包配置约 30 行

## Constitution Check

*GATE: Phase 0 研究前通过；Phase 1 设计后复核。*

| 原则 | 判定 | 说明 |
|---|---|---|
| I. 官方优先，最小自研 | PASS | 模型侧工具、参数 schema、完成通知全部复用官方 OAR 工具包；自研仅限官方不提供的 AGY 运行时层（子进程 + 事件流 + 终止阶梯）。官方 OAR 提供方因 antigravity 运行时只支持 ACP 而无法复用，这一点在 decision.md 中有记录。 |
| II. 非 ACP 与外部进程边界 | PASS | 只以 `agy` print 模式子进程工作；无 ACP 客户端/服务端、无 `agy_acp_server`、无 token 读取、无后端 API。 |
| III. 一次性委派契约 | PASS | `capabilities: NO_START_CAPABILITIES`、`inheritsParentContext: false`、无 `prepareContinuable`；`result` 经 `settleRunResult` 永不 reject；`dispose` 由 `subprocessRunHandle` 保证幂等并等待 teardown。 |
| IV. 可安装、可恢复、可诊断 | PASS | 组合包携带 `engines.dsh` 与 patch；提供方给出四类可操作诊断；插件加载失败可用禁用恢复。 |
| V. 透明默认与合规声明 | PASS | 组合包 README 声明默认无人值守、`plan`/`strict` 两档、非官方封装与 Antigravity 政策表述。 |

**结论**：无违规项，无需 Complexity Tracking。

## 项目结构

### 文档（本 feature）

```text
specs/001-subagent-oar-agy/
├── plan.md              # 本文件
├── research.md          # Phase 0 研究结论
├── data-model.md        # Phase 1 实体与状态机
├── quickstart.md        # Phase 1 验证指南
├── spike.md             # T005 官方工具 spike 结论（实施期生成）
├── validation.md        # 验收记录汇总（实施期生成）
├── contracts/           # Phase 1 接口契约
│   ├── subagent-provider.md
│   ├── bundle-patch.md
│   └── agy-cli.md
├── checklists/
│   ├── requirements.md
│   └── security-and-failures.md
└── tasks.md             # 由 /speckit-tasks 生成
```

### 源码（仓库根）

```text
package.json                     # pnpm workspace 根
pnpm-workspace.yaml
tsconfig.base.json
README.md                        # 语言索引页（安装地址 + 8 语言链接）
README.<lang>.md                 # de/en/es/fr/ja/pt/ru/zh 正文
packages/
├── subagent-oar-agy-provider/   # 提供方（发布名 @jiezhengj/subagent_oar_agy-provider，仅开发依赖）
│   ├── package.json             # type: module, exports dist, files: dist + locale
│   ├── tsconfig.json
│   ├── locale/<lang>.json       # 8 语言 meta.title/description
│   ├── src/
│   │   ├── index.ts             # Config + apply → registerProvider
│   │   ├── i18n.ts              # 8 语言运行时文案与语言检测
│   │   ├── run.ts               # start()：run handle、发布、结算
│   │   ├── agy/                 # resolve/spawn/stream/protocol/errors/timer
│   │   └── teardown.ts          # SIGTERM→宽限→SIGKILL（含 Windows）
│   └── test/                    # 单元 + 假 agy 集成 + i18n
└── subagent-oar-agy-bundle/     # 组合包（发布名 @jiezhengj/subagent_oar_agy）
    ├── package.json             # dsh.bundle.patch、engines.dsh、exports、files
    ├── cordis.patch.yml         # 提供方（包内子路径）+ 官方工具，toolName: subagent_oar_agy
    ├── scripts/vendor-provider.mjs  # 构建时复制提供方 dist + locale → provider/
    ├── provider/                # 构建产物（.gitignore；随 tarball 发布）
    ├── locale/<lang>.json       # 插件页 8 语言标题/描述/详情指向
    ├── docs/DETAIL.<lang>.md    # 8 语言实现说明
    ├── docs/INSTALL.md
    ├── README.md
    └── icon.svg
```

**结构决策**：采用 pnpm workspace 两包结构，与官方"提供方包 + 工具/组合包"的切分一致；组合包是唯一用户安装入口，提供方仅作为开发依赖，构建时被复制进组合包（`provider/`）从而自包含。`exports` 同时暴露 patch 所需的 `agy-provider` 与 DSH 元数据所需的 locale/icon/package.json；否则插件页显示名会回退为包名（v0.2.2 回归，v0.2.3 修复）。测试与实现同包；组合包不含源码，只含编译后的 `provider/`、patch、文档、locale 与图标。

## Phase 0：研究与决策（详见 research.md）

已解决的关键未知：

1. **注册接缝**：`ctx.subagents.registerProvider(provider)`；provider `{ name, capabilities, inheritsParentContext, start }`；助手 `subprocessRunHandle` / `settleRunResult` / `assertUsableCwd` 的签名与语义已从源码确认。
2. **AGY 调用形态**：用 `--input-format stream-json` 从 stdin 送入 `{"event":"user","message":{"content":"…"}}`，避免 argv 长度限制；输出 `--output-format stream-json`；不传 `-p` 的提示参数（文档明确该模式下命令行提示会被丢弃）。
3. **事件协议**：`init` / `step_update`（ACTIVE、DONE、text_delta、tool_info、usage）/ `result`（status、response、error、usage）；终态 status 映射 SUCCESS→completed、ERROR→error、CANCELED/INTERRUPTED→aborted、其余→error。
4. **权限三档**：默认 `--dangerously-skip-permissions`；`plan` 传 `--mode plan`；`strict` 不传任何放行参数（需要权限的动作被软拒绝，仍退出 0）。
5. **超时与终止**：提供方自管 `timeoutMs`（从 `init` 事件起算，排除启动）；超时/取消走 SIGTERM 进程组 → `killGraceMs`（默认 10s）→ SIGKILL；Windows 用 `taskkill /PID <pid> /T /F`；`dispose` 幂等并等待退出。
6. **官方工具复用**：`providers` 接受任意已注册的一次性 provider 名；工具拒绝 `prepareContinuable` 或 `inheritsParentContext: true` 的 provider——我们的 provider 两者都不满足，符合校验。
7. **组合包与版本门禁**：官方 ralph-bundle 的 `dsh.bundle.patch` / `listedByDefault: false` / `engines` 写法已确认；官方工具包精确锁定 `0.2.2-rc.1`，升级前必须重跑 spike。
8. **本地化**：包内 `locale/<lang>.json` 提供 8 种界面语言的 `meta.title`/`meta.description`（详情指向 `docs/DETAIL.<lang>.md`）；提供方运行时文案用同一语言表输出，语言由 `locale` 配置（默认 `auto`）解析。
9. **工具名与共存**：默认工具名取 `subagent_oar_agy`，与官方 OAR 组合包的 `subagent_oar` 区分，二者可同时启用；README 提供 `toolName` 覆盖（改为 `subagent_oar`）作为可选兼容路径。实测 DSH 对重复工具名会明确报错并拒绝第二个注册，不会静默覆盖。
10. **自包含分发**：npm 未上架时，DSH 插件管理安装框可直接安装远端 tarball；因此组合包构建时内置提供方运行代码，依赖只保留 npm 上可解析的宿主包与官方工具，发布物为 GitHub Release 资产。
11. **插件页元数据资源**：DSH `readPluginMeta` 用 Node 解析器读取 `<pkg>/locale/en.json`、`<pkg>/package.json`、`<pkg>/icon`；`exports` 一旦声明就必须同时导出这些子路径，否则静默回退包名。组合包对提供方子路径的 locale 也需导出（`./agy-provider/locale/*`）。

## Phase 1：设计与契约（详见 data-model.md、contracts/、quickstart.md）

- **delegation run 状态机**：`starting → running → settling → disposed`，终态 reason 为 `completed | error | aborted | timeout`（timeout 以 error + 诊断呈现）。
- **提供方配置**：`providerName`（默认 `agy`）、`command`（默认 `agy`）、`model`、`effort`、`permissionMode`（`yolo | plan | strict`，默认 `yolo`）、`timeoutMs`（默认不设）、`killGraceMs`（默认 10000）、`env`（默认 `{}`）、`locale`（默认 `auto`，或 8 语言之一）。
- **契约文档**：`contracts/subagent-provider.md`（DSH 接缝契约与本提供方的保证）、`contracts/bundle-patch.md`（组合包两行与配置）、`contracts/agy-cli.md`（命令行、stdin 消息、事件与退出码映射）。
- **快速验证**：`quickstart.md` 覆盖安装、首次委派、三种权限档、超时、取消、禁用恢复、官方工具安装 spike。

## 实施顺序（供 /speckit-tasks 使用）

1. **Spike（硬门禁，T005）**：在隔离 profile 或临时目录验证官方工具包 `0.2.2-rc.1` 可安装、patch 行可加载、`providers` 接受 `agy`；**未通过前不开始任何实现任务**；失败则切换 Option B（自写同形工具），并同步修订本计划。
2. 搭建 pnpm workspace、TS 配置与测试脚手架。
3. 实现 `agy/stream.ts`、`protocol.ts`、`errors.ts`、`resolve.ts`（纯函数优先，先测）。
4. 实现 `spawn.ts` 与 `teardown.ts`（含 Windows 分支），用假 `agy` 脚本做集成测试。
5. 实现 `run.ts` 与 `index.ts`（注册、config 校验、run handle、结算）。
6. 组合包：`package.json`、`cordis.patch.yml`、README、`engines.dsh`、图标。
7. 端到端：真实 AGY 冒烟（需用户授权，消耗配额）、三种权限档、超时/取消、禁用恢复、并发委派与入口选择（SC-007）。
8. **分发（FR-023）**：构建自包含 tarball → 公开 GitHub 仓库并打 topic `dsh-plugin` → Release 附 tarball → 在临时 `DSH_HOME` 与本机桌面用安装框地址安装 → 验证显示名、语言与冒烟 → README 索引页与 8 语言正文。

## 风险与缓解

- 官方工具包升级导致 `providers`/工具契约变化：精确锁版本；升级前重跑 spike；README 记录 `engines.dsh` 范围。
- AGY `stream-json` 协议变化：宽松判别联合 + 未知事件忽略 + 缺 `result` 时按退出码报错；不在解析层做版本门禁。
- Windows 进程树终止：`taskkill /T /F` 兜底 + 超时；集成测试覆盖 Windows 分支（CI 或手工）。
- 默认无人值守的安全风险：README 显式警告；`plan`/`strict` 档提供可验证的保守行为。
- 与官方 OAR 组合包工具名冲突：README 说明；`toolName` 可配置。
- `exports` 阻断 DSH 元数据资源：locale/icon/package.json 缺失时显示名静默回退包名；契约测试 + 发布后用 `readPluginMeta` 复核。
- GitHub Release 资产不可用或 pnpm 拒绝远端 tarball：保持本地 tarball 与仓库构建路径可用，并在 README 给出备选安装方式。

## 复杂度追踪

无宪法违规项，无需记录。
