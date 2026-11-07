# 实现细节

## 架构

- 提供方包 `dsh-subagent-agy`：实现 DSH 子代理接缝 `SubagentProvider`，一次性委派；每次委派启动一个 agy 子进程，`--input-format stream-json` 写入一条用户消息，`--output-format stream-json` 读取事件流。
- 组合包 `dsh-subagent-agy-bundle`：DSH 插件清单 + `cordis.patch.yml`，同时插入提供方与官方 OAR 工具（`providers: {agy: agy}`，默认 `toolName: subagent_oar_agy`）。
- 不使用 ACP、不调用 agy 的 ACP server、不实现多轮对话或会话恢复。

## 运行流程

1. `start` 校验 prompt 含文本、`cwd` 绝对且可用、解析 agy 可执行文件。
2. 启动子进程（独立进程组），写入 `{"event":"user","message":{"content":"…"}}` 并关闭 stdin。
3. 从 `init` 事件起算可选的 `timeoutMs`；`step_update.text_delta` 累积助手文本；`result` 事件给出终态。
4. `result` 结算：`SUCCESS → completed`，`CANCELED/INTERRUPTED → aborted`，其余 → `error`；进程异常退出、输出不可解析或超时 → `error` 并附诊断。
5. 取消（父回合中断/会话关闭/`dispose`）→ 终止阶梯：SIGTERM → 宽限 → SIGKILL；Windows 用 `taskkill /T /F`。

## 安全边界

- 不读取、不存储、不转发 agy 的凭据；不写 `~/.gemini` 或 agy 全局配置。
- 诊断只包含失败分类与 stderr 摘要（截断到 4096 字节），不含 prompt、工具输出或环境变量值。
- `yolo` 档自动执行；`plan`/`strict` 提供保守选项，用户文档显式声明风险。

## 失败语义

| 分类 | 触发 | 用户可见 |
|---|---|---|
| `not-installed` | PATH/路径找不到 agy | 提示安装或配置 `command` |
| `not-authenticated` | agy 要求登录 | 提示先运行 agy 登录 |
| `timeout` | 超过 `timeoutMs` | 提示调大时限或缩小任务 |
| `spawn-failed` | 进程无法启动 | 检查路径、cwd、权限 |
| `protocol` | 输出畸形或缺少 `result` | 检查 agy 版本/输出干扰 |
| `cancelled` | 父会话取消 | 委派已取消，父会话继续 |

## 与官方 OAR 的关系

复用官方 `@deepseek-ai/dsh-experimental-tool-subagent-oar` 作为模型可见工具，不修改其代码；自写部分只有 AGY 提供方。官方 OAR 自带的 antigravity 运行时基于 ACP，本插件不使用它。

## 已知限制

- 仅文本输入；图片/结构化输入会被拒绝。
- 无自动重试；重试再次消耗 agy 配额。
- 与官方 OAR 组合包同装时需处理工具名冲突（`toolName`）。
