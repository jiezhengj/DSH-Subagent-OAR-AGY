# 概念方案：subagent_oar_agy（把独立任务交给本机 AGY 的可分发包）

- **Slug**: subagent-oar-agy
- **Created**: 2026-11-07
- **Recommended option**: D — 官方 OAR 工具 + 自写非 ACP 提供方（组合包分发）

## 选项

### Option A — 组合包 + 轻量提供方（复用官方 subagent 工具）

- **Sketch**：发布一个 npm 组合包（bundle），内含一个只做一件事的提供方：收到委派时启动 `agy -p --output-format stream-json`，把最终答复交回 DSH。模型入口复用 DSH 已有的 `@deepseek-ai/dsh-tool-subagent`，在该组合包中配置为 `provider: agy`、`toolName: subagent_agy`。用户从插件页或 Discover 安装后即可在会话里调用 `subagent_agy`，无需手工编辑 profile。
- **Appetite**：small（以"天"为预算）
- **Trade-offs**：
  - 赢：新增代码最少；复用官方工具的完成通知、取消、容量与提示词；组合包自动挂载/禁用/升级；安装一步到位。
  - 牺牲：模型侧工具的参数与文案受官方工具约束，不能像 OAR 那样按 runtime 定制；需要依赖 DSH 宿主提供的工具包在第三方组合包中可解析。
  - 风险：官方工具未来改配置 schema 或删除 `toolName` 配置项；第三方组合包引用宿主工具包的解析行为未经验证。
- **Rabbit holes**：宿主工具包在第三方 bundle 中的模块解析与版本门禁；工具名/描述与内置 `subagent` 的区分度；官方工具能力位（`outputSchema`、`depthLimit`）与本提供方的兼容声明。

### Option B — 全自包含组合包（提供方 + 专用工具）

- **Sketch**：按官方新插件（OAR）的双包结构切分：一个提供方包（`subagent` 提供方，单次外部执行，配置 `model`/`effort`/`env`/`launchArgs`/`timeoutMs`）加一个专用工具包（工具名 `subagent_oar_agy`，参数与 OAR 对齐：`description`、`prompt` 必填、`cwd` 可选），外面套一个组合包（bundle）把两者挂载并分发。模型看到的入口是专用工具，而不是通用 `subagent`。
- **Appetite**：medium（以"周"为预算）
- **Trade-offs**：
  - 赢：工具表面完全可控，可暴露 AGY 特有参数；不依赖宿主是否提供某个工具包；可与官方 OAR 的 `subagent_oar` 保持形态一致（runtime 固定为 agy）。
  - 牺牲：多一个包与一套工具层代码；要跟随 DSH 实验期工具 API 变化；工具文档、测试与提示词设计成本更高。
  - 风险：重复实现官方工具的完成通知/取消/容量语义，容易与宿主行为不一致。
- **Rabbit holes**：工具 schema 与提示词设计；取消与完成通知的时序；与内置 `subagent` 同时存在时的模型选择混乱；宿主工具 API 变更。

### Option C — 仅提供方包（手工插行）

- **Sketch**：只发布提供方包，用户在 `cordis.patch.yml` 里自己加提供方行，并用现有 `dsh-tool-subagent` 配一个工具行。没有组合包，也没有自动挂载。
- **Appetite**：small（以"小时"为预算）
- **Trade-offs**：
  - 赢：最快能跑，代码面最小；升级只需更新包；适合先做可行性验证。
  - 牺牲：不是"可分发插件"的体验（需要手工编辑 YAML、理解 profile）；无法被插件页/Discover 发现；文档负担落在用户身上。
  - 备注：如果不做插件的"do nothing"基线（继续用现有纯文档技能手动拉起 `agy`），成本最低，但正是要解决的"手工往返"问题。
- **Rabbit holes**：几乎没有工程风险，主要是文档与用户支持成本。

### Option D — 官方 OAR 工具 + 自写非 ACP 提供方（组合包分发）

- **Sketch**：原样复用官方新插件里的 `@deepseek-ai/dsh-experimental-tool-subagent-oar`（模型侧工具名仍为 `subagent_oar`，`runtime` 枚举只有 `agy`），只自写一个非 ACP 的 `subagent` 提供方：收到委派后启动 `agy -p --output-format stream-json`，解析 `init/step_update/result` 事件流，把最终答复交回。模型入口、提示词、返回格式、完成通知全部来自官方工具包；我们只实现"运行时"这一层，能力声明为一次性、不继承父上下文。外面套一个组合包，把官方工具行（`providers: {agy: agy}`）与我们的提供方行一起挂载并分发。
- **Appetite**：small（以"天"为预算）
- **Trade-offs**：
  - 赢：同时满足两条硬约束——不走 ACP；官方 `subagent_oar` 工具原样复用（新插件形态、工具文案与 schema 由官方维护）。自写代码只剩一个提供方（事件流解析 + 终止阶梯），比 B 少一个工具包。
  - 牺牲：官方 OAR 的**提供方**用不上（其 antigravity 运行时是 ACP），所以 `subagent_oar` 的 `runtime` 枚举里只有 `agy`，不能同时用 OAR 的 codex/claude 运行时；官方工具仍在实验期，需跟随其 schema/文案变化。
  - 风险：官方工具包版本与 DSH 的兼容性；组合包需要同时依赖官方工具包与我们的提供方包，安装链更长。
- **Rabbit holes**：官方工具包的 experimental 版本门禁与后续改动；`providers` 映射与 provider 名称冲突；提供方必须严格保持"一次性、`inheritsParentContext: false`、无 `prepareContinuable`"，否则官方工具会拒绝；事件流解析与取消/超时的对齐。

## 推荐

**推荐 Option D**。用户的两条硬约束是"不接受 ACP"与"尽量复用官方新 OAR 插件"，D 是唯一同时满足两者的形态：

| 诉求 | A（老插件形态） | B（自包含） | C（仅提供方） | **D（推荐）** |
|---|---|---|---|---|
| 像官方新插件（专用 `subagent_oar` 工具） | 否 | 是（自写同形工具） | 否 | **是（官方工具原样用）** |
| 非 ACP | 是 | 是 | 是 | **是（print 模式）** |
| 官方代码复用度 | 低 | 低 | 低 | **最高（工具包官方维护）** |
| 自写代码量 | 最小 | 最大 | 最小 | **小（仅提供方）** |
| 安装体验（组合包） | 是 | 是 | 否 | **是** |

- B 保留为备选：若官方工具的 experimental 版本/接口与目标 DSH 版本不兼容，退到 B（自己写同形工具）。
- C 仍作为先跑通提供方的临时脚手架。
- A 明确不选：它就是"老插件"形态（通用 `subagent` 工具），与"像新插件"冲突。

## 推荐选项的范围外（Out of Scope）

- 不走 ACP、不实现/兼容 `agy_acp_server`。
- 不支持多轮、继续、恢复（一次委派一次执行）。
- 不抽取或复用 AGY OAuth token，不直接调用 Antigravity 后端 API，不做账号轮换。
- 不做图形界面；插件页展示沿用组合包现有机制。
- 不提交到 DSH 官方目录、不替换官方 OAR 插件。
- 不支持 AGY 以外的运行时：官方 OAR 工具只配置 `agy` 一个 runtime 别名；模型参数（model/effort 等）走提供方配置，不在工具上暴露。
- 不主动设置 AGY 版本上下限，也不承诺超出 AGY CLI 自身可用平台的支持范围。

## 待验证的假设

- 官方 `@deepseek-ai/dsh-experimental-tool-subagent-oar` 在 0.2.2-rc.1 下可安装，且其 `providers` 接受任意已注册的一次性 provider 名称（源码已确认该语义，需实机验证）。
- 官方 `subagent_oar` 工具与内置 `subagent` 并存时，模型能依据名称/描述正确区分两者。
- 组合包安装后，DSH 重载即可在模型工具列表看到 `subagent_oar`（`runtime` 枚举只有 `agy`），无需重启应用。
- 提供方按 `agy -p --output-format stream-json` 的 `init/step_update/result` 事件流能稳定取到最终答复；未知事件可安全忽略。
- `agy` 可通过 PATH 发现（或通过配置指定命令），且用户已交互登录、有可用配额。
- 默认 `--dangerously-skip-permissions` 的行为与风险可在 README 中说清，用户接受。
- 组合包通过 npm 发布，并带 `engines.dsh`/peer 声明以通过插件管理器的版本门禁。
