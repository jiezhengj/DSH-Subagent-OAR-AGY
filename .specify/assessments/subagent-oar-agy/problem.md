# 问题定义：让 DSH 会话把独立任务交给本机 AGY（Antigravity）CLI

- **Slug**: subagent-oar-agy
- **Created**: 2026-11-07
- **Inputs used**: intake.md、research.md

## 问题陈述

同时使用 DeepSeek Harness 与 Google Antigravity CLI 的用户，在 DSH 会话里没有受支持的委派通道把独立任务交给本机 `agy`：DSH 自带的外部子代理后端只覆盖 Codex 与 Claude Code（且需要各自 CLI 已安装登录）；另有 ACP 子代理后端但未随桌面版提供，官方实验性 OAR 插件虽含 `antigravity` 运行时，但其适配面向独立二进制 `agy_acp_server`，与本机 `agy` 1.5.3（ACP 通过 `agy acp` 子命令）形态不一致，且该插件不在桌面版构建与官方组合包目录中。结果是用户要么退出 DSH、在终端手工跑 `agy -p` 再粘贴结果，要么放弃使用 AGY。

## 受影响用户与利益相关方

- **用户**：主要提出者（本用户）——已装 DSH 0.2.2-rc.1 与 AGY CLI 1.5.3，希望复用 AGY 的模型与配额完成 DSH 内的独立子任务，减少人工往返。— [source: intake.md、research.md] (confidence: high)
- **潜在用户**：其他同时使用 DSH 与 AGY 的开发者。需求以提出者本人为主；作为免费开源插件，"可分发"是自然副产品而非需要先验证的独立目标（用户 2026-11-07 澄清）。(confidence: medium)
- **决策与风险承担者**：提出者本人——AGY 账号、Google 服务条款风险与插件维护成本由其承担。
- **平台与政策相关方**：DeepSeek（DSH 插件 API 与分发机制的提供方，仍处实验期）、Google Antigravity（CLI 与 headless 政策边界的制定方）。

## 目标

- 用户能在 DSH 会话内把一个有边界的独立任务交给本机 AGY 执行并取回结果，不需要离开 DSH、不需要手工复制粘贴。
- 委派产物可安装、可禁用、可升级，并与 DSH 版本门禁（`engines.dsh`/peer 依赖）兼容，安装失败时 DSH 仍能正常启动。
- 失败可诊断：AGY 未安装、未登录、版本过低、超时、配额或状态异常等场景给出面向用户与模型的明确信息。
- 权限边界明确可控：默认采用无人值守模式（`--dangerously-skip-permissions`，与官方 OAR 的 Claude 运行时及 Paseo 实践一致），在文档中显式声明其含义，并允许用户改为更保守的方式。
- 对 DSH 现有行为零破坏：不改变内置 `subagent` 工具、官方 OAR 插件或既有配置的语义。

## 非目标

- 不替代、不修改官方 OAR 插件，也不要求 DSH 官方目录收录本插件。
- 不实现多轮/可继续的外部会话：一次委派一次执行，完成后即结束。
- 不抽取或复用 AGY 的 OAuth token、不直接调用 Antigravity 后端 API、不做账号轮换，只启动官方 `agy` 二进制。
- 不实现 `agy_acp_server` 的 ACP 适配（那是 OAR `antigravity` 运行时的路线）。
- 不实现 ACP 客户端/服务端协议栈，不把本插件做成 ACP 后端。
- 不做图形界面（插件页展示沿用 bundle 的现有机制即可）。
- 不人为限制平台，也不承诺超出 AGY CLI 自身可用平台的支持范围：插件按 AGY CLI 实际可用的平台自然跨平台（用户 2026-11-07 澄清；其现有技能与 Paseo 在 Windows 下正常）。

## 成功指标

- 端到端冒烟：在 DSH 内发起一次 AGY 委派，能取回与任务一致的最终答复，且 DSH 会话不中断。基线：本机 `agy -p` 实测 1 次成功（2.85s），但 DSH 内路径尚未存在（基线 = 0）。
- 失败可读性：未安装/未登录/超时/异常四类场景均能给出可操作错误，而不是挂起或静默失败。基线：未知。
- 安装成本：从零到可用所需人工步骤 ≤ 2 步（安装组合包 + 重启/启用），且安装前有版本兼容检查。基线：手改 profile 需 ≥ 3 步（假设）。
- 权限可预期：默认配置下的 AGY 工具调用行为有明确文档，用户能在不读源码的情况下判断"会不会自动执行命令"。基线：未知。
- 稳定性：插件加载失败或 AGY 异常时，DSH 可通过禁用插件恢复启动。基线：未知。

## 不行动的代价

- 用户继续在终端与 DSH 之间手工往返，AGY 的模型与配额无法进入 DSH 工作流；每次委派多一次人工复制粘贴与上下文丢失。
- 对没有 Codex/Claude CLI 的用户，DSH 的外部委派能力事实上不可用；OAR 实验插件也无法直接覆盖本机 AGY 形态。
- 政策风险与「做了再评估」无关：不行动只是不承担分发与维护风险，并不消除"官方不支持第三方封装"这一事实。

## 开放问题

- [NEEDS CLARIFICATION: 是否需要在插件文档与 README 中明示"非官方封装、自担风险"，以应对 Antigravity FAQ 对第三方封装保留的表述？]
- [NEEDS CLARIFICATION: Windows 下终止 AGY 进程树的实现选择（taskkill /T /F 还是 Node 的进程组信号），需要在实现前用小样验证。]

已关闭的问题（用户 2026-11-07 澄清）：

- 需求归属：首先属于提出者本人，未做广泛用户调研；免费开源，可分发是天然结果。
- 政策边界：用户判断本插件不构成"把 agy 包进第三方 Agent"——agy 仍是独立进程、不随插件分发，本质与"让 Agent 拉起 agy 作为子代理"一致；其现有的纯文档技能与开源项目 Paseo 长期以此方式调用 agy（含 Windows），未遇问题。research.md 记录的 FAQ 保守表述作为残余风险保留，交由 decide 阶段权衡。
- 跨平台：不设人为限制，按 AGY CLI 自身可用平台自然跨平台。
- 默认权限：默认 `--dangerously-skip-permissions`，与 OAR Claude 运行时及 Paseo 的最佳实践一致；风险在文档中说明。
- AGY 版本：不主动设置最低/最高版本限制；遇到真实 bad case 再处理。
- ACP 后端：`@deepseek-ai/dsh-subagent-acp` 未随桌面版打包、且只支持 ACP，与本想法"非 ACP"的硬约束冲突，已排除。
- 超时/取消：不设默认轮次超时（与官方 OAR 及原生 provider 一致），提供可配置轮次截止；取消/超时按官方终止阶梯处理——SIGTERM → 宽限（约 10s，可配置）→ SIGKILL，POSIX 按进程组、Windows 按进程树，并把结果结算为 aborted/error 且带诊断。
