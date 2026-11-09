# Phase 0 研究：AGY 委派可观察性与生命周期控制

每条结论给出 Decision / Rationale / Alternatives considered。证据来源：DSH tag `dsh-v0.2.2-rc.1` 源码、本仓库现有 provider/bundle 实现、官方 OAR 包接口。

## D1. 控制工具采用单工具双动作

- **Decision**：新增一个模型可见工具 `subagent_oar_agy_control`，参数为 `action: "status" | "cancel"` 和可选 `childId`。`status` 不带 `childId` 时列出当前父会话的全部 AGY 委派；带 `childId` 时只返回该条。`cancel` 必须带 `childId`。
- **Rationale**：状态与取消共享同一份运行登记和同一套父级权限校验，单工具减少工具表条目与重复描述；模型只需要记住一个入口。官方 `subagent_oar_agy` 保持完全不变，避免父会话工具 schema 漂移。
- **Alternatives considered**：
  - 两个独立工具（`..._status` / `..._cancel`）：发现性更直接，但两个 schema、两段描述、两套测试，且容易让模型在不必要时调用取消。
  - 把 `cancel` 做成 `status` 的副作用参数：语义不清，模型可能误取消。
  - 直接修改官方 `subagent_oar` 工具：违反“不修改官方 schema”的约束，且升级时冲突。

## D2. 看门狗窗口与默认值

- **Decision**：新增 `startupTimeoutMs`（默认 60_000）和 `stallTimeoutMs`（默认 900_000，即 15 分钟）。启动计时从 `spawn` 开始，收到 `init` 后清除；静默计时在 `init` 后启动，并在每个来自 AGY 的已解析事件上重置。两者都通过现有 `armDeadline` 的 unref 计时器实现。`timeoutMs` 继续作为可选绝对上限，从 `init` 起算，语义不变。
- **Rationale**：60 秒足以覆盖正常 AGY 启动与认证预热；15 分钟静默窗口能覆盖大多数长工具，同时保证父会话不会无限等待。使用 unref 计时器不会阻止 DSH 退出。现有 `timeoutMs` 不改语义，避免已有用户配置行为突变。
- **Alternatives considered**：
  - 让 `timeoutMs` 从 `spawn` 起算：更直观，但会改变现有已记录语义（`README` 明确从 `init` 起算），属于破坏性变更。
  - 默认关闭静默看门狗：无法满足“父 Agent 不会永久等待”的核心目标。
  - 默认 5 分钟：长构建/长命令容易误杀；15 分钟是更稳妥的折中，并允许配置。

## D3. 运行登记放在 provider 内，内存有界

- **Decision**：在 provider 包新增 `runs.ts`，导出模块级 `RunRegistry` 单例。provider 在 `publishRun` 中创建记录，键为 `run.id`（即 manager 最终使用的 `childId`），同时记录 `request.parent.id`。活动环形缓冲每运行最多 20 条；每个父会话最多保留 50 条记录；终态记录保留 5 分钟后清理；查询时惰性清理过期项。
- **Rationale**：`startAgyRun` 自己生成 `run.id`，manager 之后以 `run.id` 作为 childId，provider 无需等待 manager 回填即可建立稳定映射。内存登记避免引入数据库或跨进程状态；上限和 TTL 防止长期运行泄漏。控制工具通过 bundle 内的同一模块实例读取，无需新增 Cordis 服务。
- **Alternatives considered**：
  - 用 Cordis 服务跨插件共享：更适合多 provider 实例/多包，但本 Feature 只有一个 AGY provider，增加注册生命周期与测试成本。
  - 持久化到磁盘：跨越 Host 重启需要恢复通知语义，超出本 Feature 范围，也带来隐私和清理问题。
  - 从 `ctx.subagents.listChildren` 反查状态：官方 external 子项 activity 恒为 `inactive`，没有实时状态，无法满足需求。

## D4. 环境清洗复用官方 `scrubbedParentEnv()`

- **Decision**：`agyEnvironment()` 改为先取官方 `scrubbedParentEnv()`，再应用插件 `env` 覆盖；`null` 仍表示删除。新增 `@deepseek-ai/dsh-subprocess` 依赖（provider peer/dev、bundle dependencies、root devDependencies）。
- **Rationale**：官方实现已定义凭据形状匹配（`KEY|PASSWORD|SECRET|TOKEN`，大小写不敏感）、`DSH_*` 大小写不敏感移除，以及代理变量的子进程恢复；复制规则容易漂移。`PATH`、`HOME`、locale、代理变量保留，AGY 仍能正常启动和认证。
- **Alternatives considered**：
  - 本地复制正则：少一个依赖，但官方规则变更时容易不同步，且代理处理复杂。
  - 只移除 `DSH_*`：不能解决父进程凭据泄漏，达不到安全目标。
  - 白名单环境：更严格，但会破坏 AGY 依赖的 `HOME`/代理/证书变量，误伤面大。

## D5. 父级诊断只发安全分类，原始细节进本地脱敏日志

- **Decision**：父会话可见的 `SubagentResult.diagnostic` 只包含失败分类、阶段/建议和安全的工具名；不再拼接 `summarizeStderr()` 或 AGY 原始错误文本。原始 stderr、退出码和原始错误写入 `ctx.logger.warn`，先做截断与脱敏（Bearer/API key/token/secret/password/URL 凭据/`sk-` 形状），并在消息中标注 run id。状态工具只返回受控文本片段（最多 200 字符）和工具名，不返回完整参数。
- **Rationale**：官方 OAR 对父级只发固定 stage/category，原生原因留在本地；这能避免凭据、绝对路径和任务片段进入父会话转录。分类 + 建议仍满足“可操作诊断”，本地日志保留排障能力。
- **Alternatives considered**：
  - 保留 stderr 摘要但做脱敏：仍可能泄露未覆盖的敏感格式，且会污染父上下文；不作为默认。
  - 完全不记录原始细节：排障能力不足；本地日志是必要折中。

## D6. 取消走官方 `ctx.subagents.interrupt`

- **Decision**：控制工具的 `cancel` 动作先校验 `childId` 属于当前 `exec.agent` 的记录，标记 `cancelRequestedAt`，再调用 `ctx.subagents.interrupt(childId, { kind: 'ancestor', agent: exec.agent })`。不直接调用 provider 的 `run.dispose()`，不自行结算结果。
- **Rationale**：共享服务负责权限校验、激活查找、取消传播、结果结算和父级通知；`interrupt` 对 absent/idle/completed 目标是安全 no-op。直接 dispose 会绕过服务通知，造成“进程停了但父 Agent 不知道”。
- **Alternatives considered**：
  - 直接 `run.dispose()`：需要工具持有 run 句柄，且必须自己结算/通知，重复服务职责。
  - 用 `kind: 'user'` + `parentSessionId`：这是浏览器/客户端 authority；模型工具应使用 `ancestor` 的实时 Agent 授权。
  - 自己实现取消队列：增加生命周期状态机，违背最小自研。

## D7. 控制工具注册在 bundle 的 `tool.js`

- **Decision**：在 `mountTool()` 成功挂载官方委派工具后，由同一 `tool.js` 注册控制工具；新增可选配置 `controlToolName`（默认 `subagent_oar_agy_control`），并在传给官方工具前剥离该字段。控制工具从 `./provider/runs.js` 导入同一 registry 实例。
- **Rationale**：bundle 已依赖 `dsh-tools`，并已有工具挂载/回退路径；无需新增 Cordis 行或修改 patch。provider 只负责登记运行，不依赖工具层；职责清晰。`controlToolName` 可让用户在冲突时改名。
- **Alternatives considered**：
  - 新增第三个 patch 行：配置更显式，但增加安装面与行顺序问题。
  - 放在 provider 包：provider 将依赖 `dsh-tools` 并承担工具注册，职责变重。
  - 注册到官方工具内部：不可能，且违反不修改官方包。

## D8. 状态快照结构与保留语义

- **Decision**：状态工具输出包含 `action: "status"` 包装；状态快照包含 `childId`、`state`、`startedAt`、`elapsedMs`、`lastActivityAt`、`lastEventKind`、`pid`、`stepIndex`、`stepState`、`toolName`、`conversationId`、`lastText`（≤200 字符）、`stopReason`、`failureCategory`、`cancelRequestedAt`、`activity`（≤20 条）。终态运行在 5 分钟保留期内可见，之后不再返回；无记录与无权记录统一返回 `found: false`，不区分。
- **Rationale**：字段足以回答“是否活着/在做什么/为什么结束”，同时避免完整最终答复、完整 prompt 和工具参数进入状态输出。统一 not-found 防止跨父会话探测。
- **Alternatives considered**：
  - 返回完整最终答复：父会话已通过完成通知获得，重复且可能很大。
  - 永久保留：内存不可控；跨重启语义也不完整。
  - 暴露原始 `tool_info`：可能包含命令和路径，安全边界不合适。

## D9. i18n 与文档范围

- **Decision**：新增家长可见文本键（启动超时、静默超时、未找到、取消已受理、取消不可用等）加入现有 8 个 locale；README 和 `docs/DETAIL.<lang>.md` 更新配置表、默认值、状态/取消用法、数据保留和安全边界。控制工具描述保持英文（模型可见工具描述与现有委派工具一致），不纳入 locale。
- **Rationale**：现有项目承诺八语言 UI；新增用户可见诊断不能只留英文。工具描述是模型接口，不是 UI 文案。
- **Alternatives considered**：只更新 zh/en：与现有发布质量不一致，测试/校验可能失败。

## D10. 测试与验证策略

- **Decision**：扩展 fake AGY fixture，新增 `no-init`、`silent`、`crash-no-result`、`sensitive-stderr`、`env-dump` 模式；单元测试覆盖 registry、状态/取消工具、超时竞争、环境清洗、诊断脱敏；集成测试用真实子进程验证看门狗和取消；bundle 测试验证控制工具注册与旧会话工具表提示；真实 AGY 只做一次授权冒烟。
- **Rationale**：不依赖真实 AGY 即可覆盖所有生命周期分支；真实冒烟验证认证和端到端通知。环境清洗用可识别 canary 变量和子进程环境转储，能直接断言。
- **Alternatives considered**：只做单元测试：无法验证进程树终止和真实 stdio 关闭；只做真实 AGY：不稳定且无法覆盖故障分支。

## 未决与后续

- 无阻塞性未决项。UI 状态卡片、Host 崩溃后的孤儿清理、活动日志落盘属于后续独立 Feature。
