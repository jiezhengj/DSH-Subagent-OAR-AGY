# 想法研究：subagent_oar_agy（可分发 AGY 委派插件）

- **Slug**: subagent-oar-agy
- **Created**: 2026-11-07
- **Evidence confidence (overall)**: medium

## 用户与需求

- 当前唯一提出者与需求方：本用户。本机已装 AGY CLI `agy` 1.5.3（`~/.local/bin/agy`），希望 DSH 会话内把独立任务交给 AGY 执行；明确要求做成**可分发插件包**，而不是本机配置。— [source: 用户消息（会话）] (confidence: high)
- 现有替代路径：手动在终端跑 `agy -p "..."`，再把结果贴回 DSH；成本是人工往返、无法复用 DSH 的工作目录与任务上下文。— [source: ASSUMPTION] (confidence: medium)
- 没有观察到其他用户信号（无 issue、无下载量、无需求票）；需求是否具有普遍性未知。— [source: ASSUMPTION] (confidence: low)

## 先例

- 官方 OAR 插件（`@deepseek-ai/dsh-experimental-subagent-oar` + `-tool-subagent-oar`，0.2.2-rc.1）：一个 provider 实例绑定一个 OAR 运行时，模型通过专用工具 `subagent_oar` 按 `runtime` 别名调用；单次执行、不可继续。— [source: github.com/deepseek-ai/deepseek-harness @dsh-v0.2.2-rc.1 的 packages/experimental/subagent-oar 与 tool-subagent-oar、tool-catalog.zh.md] (confidence: high)
- OAR 默认运行时注册表包含 `antigravity`，但它的 antigravity 适配启动的是独立二进制 `agy_acp_server`（macOS 默认 `agy_acp_server.par`，可用 `OAR_ANTIGRAVITY_BIN` 覆盖，带 ACP 版本/能力探测）；本机 AGY 1.5.3 是单文件 CLI，ACP 通过 `agy acp` 子命令提供，二者不是同一形态。— [source: npm @botiverse/oar@0.67.0 tarball，dist/runtimes/antigravity/session.js、installation.js] (confidence: high)
- OAR 的其它运行时证明"不走 ACP"有成熟先例：Codex 走 `codex app-server --listen stdio://` 的 JSON-RPC；Claude 走 `claude -p --input-format stream-json --output-format stream-json` 的 CLI 事件流；Pi 走内嵌 pi SDK（同进程）。只有 Grok/Kimi/OpenCode/Antigravity 走 ACP。— [source: 同上 tarball，dist/runtimes/*/session.js、launch.js、app-server-client.js] (confidence: high)
- DSH 已有可复用的子代理接缝：`SubagentProvider { name, capabilities, inheritsParentContext, start() }`，外部执行返回 `SubagentRun { id, result, dispose }`；`dsh-subagent` 还导出 `subprocessRunHandle()` 与 `settleRunResult()` 助手，OAR provider 正是用它们把子进程封装成合规的 run。— [source: github.com/.../packages/subagent/subagent/src/out-of-process.ts 与 docs/subsystems/subagent.zh.md] (confidence: high)
- 官方两个老 provider（`dsh-subagent-codex`、`dsh-subagent-claude-code`）是"只有 provider、复用内置 subagent 工具"的形态，且在官方组合包目录中可安装；说明"单运行时 provider + 现成工具"是被官方接受的打包方式。— [source: 本机 plugin_manager list_bundles（codex/claude 条目带 installTarget 0.2.2-rc.1；OAR 无条目）] (confidence: high)
- DSH 另有一个 ACP 子代理后端 `@deepseek-ai/dsh-subagent-acp`：仓库中存在并在 npm 发布，但未随桌面版打包、也不在官方组合包目录；它只能驱动 ACP agent，因此在本想法中被排除。— [source: 仓库 packages/subagent/subagent-acp；本机 app.asar 与 list_bundles 检查] (confidence: high)
- 未系统检索 npm/GitHub 上是否已有同类 DSH-AGY 插件；目前无已知现成实现。— [source: 未系统检索（本评估的局限）| ASSUMPTION] (confidence: low) [NEEDS CLARIFICATION: 是否已有同类社区插件]

## 市场与背景

- AGY CLI 的 headless（print）模式能力齐全：`-p/--print`、`--output-format text|json|stream-json`、`--input-format text|stream-json`、`--json-schema`、`--model`、`--effort`、`--agent`、`--continue/--conversation`、`--print-timeout`、`--sandbox`、`--dangerously-skip-permissions`。— [source: 本机 `agy --help`；antigravity.google/docs/cli/headless] (confidence: high)
- `--output-format stream-json` 是 NDJSON：以 `init` 开始、若干 `step_update`（ACTIVE/DONE，含 `text_delta`、`tool_info`、`usage`）、以 `result` 结束；`json` 模式是单个信封，含 `status`、`response`、`error`、`structured_output`、`usage`、`conversation_id`。这两个格式足以映射到 DSH 的 `SubagentResult`（output + stopReason）。— [source: antigravity.google/docs/cli/headless（示例与字段表）] (confidence: high)
- 退出码语义清晰：成功 0；`status` 可为 SUCCESS/ERROR/CANCELED/INTERRUPTED/INVALID/WAITING/RUNNING；`--print-timeout` 超时退出码 3 并在 stderr 打印 `AGY_ERROR`。— [source: 同上；本机 `agy changelog` 1.5.0 条目] (confidence: high)
- headless 权限：默认遵循 settings 的 ask 规则；无法交互时被 soft-deny（继续运行、exit 0、stderr 提示）；`--dangerously-skip-permissions` 全量放行（1.5.2 起系统命令 denylist 仍会拦截）。可预先在 `~/.gemini/antigravity-cli/settings.json` 的 `permissions.allow` 放行 `command(...)`/`write_file(...)`。— [source: antigravity.google/docs/cli/headless；本机 changelog] (confidence: high)
- 本机 AGY 已登录（存在 `~/.gemini/antigravity-cli/antigravity-oauth-token`，settings.json 含 model/trustedWorkspaces），headless 无需交互登录即可用缓存凭证。— [source: 本机文件系统检查，未读取 token 内容] (confidence: high)
- 分发侧现状：第三方组合包（bundle）通过 npm/Git 安装，DSH 在安装前检查 `engines.dsh` / DSH peer 版本；bundle 用 `dsh.bundle.patch` 声明要插入的行，profile 记录依赖与启用列表；插件页/发现页可安装。— [source: github.com/.../packages/boot/plugin-manager/README.zh.md；docs/user/guide/plugin-market.zh.md；packages/experimental/ralph-bundle] (confidence: high)
- 外部插件按普通 Node 解析，DSH 运行时为缺失的包补依赖（host 包可由插件复用），pnpm 装过的优先；插件与宿主共用同一导出实例。— [source: github.com/.../.agents/notes/implemented/architecture/2026-09-08-desktop-bundled-runtime-and-external-plugins.md] (confidence: high)

## 数据与约束

- 版本基线：DSH 0.2.2-rc.1（本机桌面版与 npm `next` 均为此版本）；AGY CLI 1.5.3；OAR 0.67.0。— [source: 本机版本检查；npm dist-tags] (confidence: high)
- AGY 可执行文件约 208 MB，单次 `-p` 会启动新进程；headless 默认无超时（`--print-timeout 0s`），插件必须自带超时与取消（杀进程树）。— [source: 本机 `ls -l`、`agy --help`；docs] (confidence: high)
- DSH 子代理的完成语义：外部 run 的 `result` 不因模型/传输失败而 reject，而是以 `stopReason: 'error'` 结算；`dispose()` 必须做到幂等并等待子进程真正退出。— [source: docs/subsystems/subagent.zh.md、out-of-process.ts] (confidence: high)
- 子代理容量限制 `maxActiveSubagents` 默认 8；委派深度默认 1。单次外部执行不占本地子会话。— [source: packages/subagent/subagent/README.zh.md] (confidence: high)
- 可分发包需要面对 DSH 版本门禁：`engines.dsh` 或 DSH peer 版本不满足时，点名软件包的安装会在 pnpm 运行前被拒（git/tarball spec 在安装后判定）；不兼容的已装插件在 profile 启动时被拒绝加载。— [source: plugin-manager README.zh.md“版本兼容与豁免”] (confidence: high)
- AGY 的 `stream-json` 协议是 1.1.x 起新增能力，且 1.5.x 仍在改动语义（例如 1.5.2 改了 skip-permissions 行为、1.5.0 才加入 acp）；插件解析器需按版本设下限并容错未知事件。— [source: 本机 `agy changelog`；antigravity.google/docs/cli/headless] (confidence: high)
- 实测（2026-11-07，用户授权）：`agy -p "…SMOKE_OK…" --output-format stream-json --print-timeout 120s` 在 `/tmp` 退出码 0，依次输出 `init`（含 cwd、tools 数组、`permission_mode: "request-review"`）、`step_update`（`user_input` DONE、`agent_response` ACTIVE 带 `text_delta`、DONE 带 `usage`）、`result`（`status: "SUCCESS"`、`response: "SMOKE_OK\n"`、`usage`、`duration_seconds: 2.85`）；stderr 为空。字段与官方文档一致。— [source: 本机实测输出 /tmp/agy_smoke/smoke.ndjson] (confidence: high)
- 同一实测还确认：工具列表包含 `run_command`、`write_to_file`、`browser_*`、`invoke_subagent` 等；默认 `permission_mode` 为 `request-review`（非 always-proceed）。— [source: 同上] (confidence: high)

## 反对证据（Evidence Against the Idea）

- **政策/服务条款风险（最强证据）**：Antigravity 官方 FAQ 明确写着 "Antigravity CLI headless mode (`agy -p`) is intended for direct scripting and CI workflows. Wrapping `agy` inside third-party coding agents or applications, or automating account rotation, is not supported under consumer plans." 同一 FAQ 另一条更严厉："使用第三方软件、工具或服务访问 Antigravity 违反 ToS，可能导致账号被暂停或终止。" 一个"可分发插件"正是把 `agy` 包进第三方 agent，处于"不支持/可能违规"的地带。— [source: antigravity.google/docs/faq] (confidence: high)
- 官方论坛口径与 FAQ 冲突：2026-09-15 一条论坛回复（身份未核实）称"在 headless 模式本地启动官方 agy 二进制是受支持的"；2026-10-27 有用户指出 FAQ 说消费者计划不支持，要求官方澄清，未见答复。政策边界不确定。— [source: discuss.ai.google.dev/t/...183051；antigravity.google/docs/faq] (confidence: medium)
- DSH 插件面仍在实验期：OAR 工具本身是 `experimental`、不在官方目录，依赖 `@botiverse/oar` 这类第三方库；第三方插件必须自行跟踪 DSH 实验 API 变更。— [source: 本机 plugin_manager list_bundles（OAR 无条目）；tool-catalog.zh.md 的 experimental 命名] (confidence: high)
- AGY CLI 的 JSON 输出协议没有稳定性承诺（只有文档化字段，无版本化 schema），且 AGY 自身版本迭代快（1.5.x 多次改行为）→ 解析器与版本矩阵是长期维护负担。— [source: 本机 changelog；docs] (confidence: medium)
- 真正的增量价值有限：OAR 已经能用 Codex/Claude 做外部委派；AGY 的差异化主要在模型（Gemini 系）与账号配额，而非能力形态。若无 AGY 订阅或 Gemini 偏好，插件价值接近零。— [source: ASSUMPTION] (confidence: medium)
- 可分发意味着 npm 发布、命名空间、文档、issue 维护、版本门禁与安全审查；对个人小需求而言投入产出比不明确。— [source: ASSUMPTION] (confidence: medium)
- 安全默认值：若对齐 OAR Claude 的 `--dangerously-skip-permissions` 默认，等于让 AGY 在用户工作区无确认执行命令/写文件；AGY 没有 Claude 的 `--permission-mode` 细粒度等价物（只有 settings 的 permissions.allow 与 `--mode`）。— [source: docs/cli/headless；OAR launch.js] (confidence: high)

## 缺口与开放问题

- [NEEDS CLARIFICATION: Antigravity 对"第三方应用包 agy"在消费者计划下的确切边界；Google AI Studio / Gemini API key 或企业路径是否可作为合规替代？]
- [NEEDS CLARIFICATION: 用 `--output-format json`（简单，单信封）还是 `stream-json`（可观测、可流式，但解析更复杂）？]
- [已关闭，由 concept.md 的 Option D 决定] 可分发形态：完整组合包（bundle）分发。
- [NEEDS CLARIFICATION: 官方实验工具包与自写提供方的版本组合策略——官方工具包升级时如何验证兼容并避免把用户锁在旧版。]
- [已关闭，由 problem.md 决定] 默认权限：`--dangerously-skip-permissions`，风险在文档中说明。
- [NEEDS CLARIFICATION: 认证失败、AGY 未安装、版本过低、配额耗尽等错误的分类与面向模型的提示文案。]
- [已关闭，由 problem.md 决定] 不主动设置 AGY 版本上下限；容错策略见上一条开放问题。
- [NEEDS CLARIFICATION: npm 包名与 scope、是否同时发布插件索引（Discover 源）、许可证与免责声明。]
- [NEEDS CLARIFICATION: AGY 后续版本新增或改名 stream-json 事件时，提供方的容错与告警策略（前提是已决定不设版本门禁）。]

## 来源

- https://antigravity.google/docs/cli/headless（host: antigravity.google，policy: confirmed-by-user）
- https://antigravity.google/docs/cli/reference（host: antigravity.google，policy: confirmed-by-user）
- https://antigravity.google/docs/faq（host: antigravity.google，policy: confirmed-by-user）
- https://discuss.ai.google.dev/t/is-external-orchestration-of-antigravity-cli-headless-mode-supported-with-account-based-usage/183051（host: discuss.ai.google.dev，policy: confirmed-by-user）
- https://github.com/deepseek-ai/deepseek-harness（host: github.com，policy: allowlisted；release tag dsh-v0.2.2-rc.1 的包、文档与架构笔记）
- npm registry：`@botiverse/oar@0.67.0`、`@deepseek-ai/dsh-experimental-subagent-oar@0.2.2-rc.1`、`@deepseek-ai/dsh-experimental-tool-subagent-oar@0.2.2-rc.1`（host: registry.npmjs.org，policy: confirmed-by-user（tarball 本地解包核对））
- 本机：`agy --help`、`agy changelog`、`~/.gemini/antigravity-cli/` 状态检查（host: 本机，非网络来源）
