# 决策：subagent_oar_agy（官方 OAR 工具 + 自写非 ACP 提供方）

- **Slug**: subagent-oar-agy
- **Decided**: 2026-11-07
- **Verdict**: go
- **Artifacts reviewed**: intake.md | research.md | problem.md | concept.md

## 评分卡

| 准则 | 评级 | 依据 |
|---|---|---|
| 问题有效性（Problem validity） | strong | 用户真实且具体地缺一个 DSH 内的 AGY 委派通道：内置外部后端只有 Codex/Claude，官方 OAR 的 antigravity 运行时是 ACP 且面向 `agy_acp_server`，与本机 `agy 1.5.3` 形态不符；现有替代是"退出 DSH、手工终端跑 `agy -p` 再粘贴"，问题可复现、边界清楚。 |
| 证据强度（Evidence strength） | adequate | 官方文档（headless 输出格式、权限、退出码）、OAR 源码（工具 `providers` 语义、运行时实现）、本机版本与登录状态、以及一次授权实测（`agy -p --output-format stream-json` 成功、事件流与文档一致）共同支撑；需求侧仅有个人信号，无广泛用户数据。 |
| 价值 vs 不行动（Value vs. inaction） | adequate | 对提出者本人是明确的生产力改进（省去终端往返、复用 AGY 配额与模型）；对他人是否值得尚未验证。不行动的成本是可量化的手工往返，但影响面限于个人与小圈子。 |
| 可行性 / 投入匹配（Feasibility / appetite） | strong | Option D：官方 `subagent_oar` 工具包原样复用（源码已确认 `providers` 接受任意一次性 provider 名），自写部分仅一个非 ACP 的 AGY 提供方（启动 `agy -p --output-format stream-json`、解析事件流、终止阶梯），投入为 small；OAR 的 Claude 运行时（CLI + stream-json）是同形态先例。 |
| 战略契合（Strategic fit） | adequate | 与 DSH 的子代理接缝、实验性插件生态和"官方优先"原则一致；项目尚未建立 constitution，此处按 DSH 架构与用户既定约束判断。 |
| 风险姿态（Risk posture） | adequate | 主要风险已识别且有对策：Google FAQ 对"第三方封装"的保留表述（用户已判断本插件形态与既有技能/Paseo 一致并可接受，作为残余风险记录）；依赖 experimental 工具包（有 B 方案兜底）；AGY 输出协议无版本承诺（解析器容错、不设版本门禁）。不走 ACP、不碰 OAuth token/后端 API、自写代码面小，均为风险削减项。 |

## 判定与理由

**go。** 问题真实、证据达到 adequate、推荐概念（Option D）在 small 投入内可行，且同时满足用户的两条硬约束（非 ACP；尽量复用官方新 OAR 插件）。Option D 把"像官方新插件"与"自写最少"统一起来：模型入口与工具 schema 由官方维护，我们只实现一次性、非 ACP 的 AGY 运行时层。证据的薄弱点（需求只有个人信号）和残余风险（官方 FAQ 的保守表述、experimental 工具包兼容性）都已被显式记录，不影响进入规格化；其中"官方工具包在 0.2.2-rc.1 可安装且 `providers` 接受我们的 provider"应作为实现阶段的第一项验证，失败时退到 Option B（自写同形工具）。

## go — 交给 `/speckit-specify` 的输入

- **问题**：同时使用 DSH 与 AGY 的用户，在 DSH 会话内没有受支持的非 ACP 委派通道把独立任务交给本机 `agy`。
- **选定方案**：Option D — 组合包挂载官方 `@deepseek-ai/dsh-experimental-tool-subagent-oar`（`providers: {agy: agy}`）与自写的非 ACP AGY 提供方（`agy -p --output-format stream-json`，一次性、不继承父上下文），模型侧工具仍为 `subagent_oar`，`runtime` 枚举只有 `agy`。
- **范围内**：DSH 内发起 AGY 委派并取回最终答复；组合包安装/禁用/升级；`engines.dsh` 版本门禁；默认 `--dangerously-skip-permissions`；可配置轮次超时；失败可诊断（未安装/未登录/超时/异常）。
- **范围外**：ACP / `agy_acp_server`；多轮、继续、恢复；OAuth token 抽取与 Antigravity 后端 API；账号轮换；GUI；DSH 官方目录收录；替代官方 OAR；AGY 以外的运行时；AGY 版本上下限。
- **成功指标**：DSH 内一次端到端委派成功（基线 0）；未安装/未登录/超时/异常四类场景错误可读；安装 ≤ 2 步；默认权限行为可预期；插件失败可禁用恢复。
- **带入规格化的开放问题**：
  - [NEEDS CLARIFICATION: 官方工具包在 0.2.2-rc.1 下能否安装并接受我们的 provider（实现第一阶段验证，失败退 Option B）]
  - [NEEDS CLARIFICATION: 插件文档是否明示"非官方封装、自担风险"以应对 FAQ 保守表述]
  - [NEEDS CLARIFICATION: Windows 下终止 AGY 进程树的实现（taskkill /T /F 与进程组信号的取舍）]
