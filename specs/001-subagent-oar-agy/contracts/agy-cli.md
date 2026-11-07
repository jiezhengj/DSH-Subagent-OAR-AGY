# 契约：AGY CLI 调用与事件

依据：Antigravity 官方 headless 文档（antigravity.google/docs/cli/headless）与本机 1.5.3 实测（`/tmp/agy_smoke/`，2026-11-07）。

## 命令行

```text
agy --input-format stream-json --output-format stream-json [--model <slug>] [--effort <low|medium|high>] [权限参数]
```

权限参数按 `permissionMode`：

| 模式 | 追加参数 | 预期行为 |
|---|---|---|
| `yolo`（默认） | `--dangerously-skip-permissions` | 所有工具自动放行 |
| `plan` | `--mode plan` | 只读规划，不修改文件 |
| `strict` | 无 | 需要审批的动作被软拒绝，进程仍退出 0 |

不传 `-p` 的提示、不传 `--print-timeout`（由提供方自管超时）。`cwd` 由 spawn 的 `cwd` 决定；环境为宿主环境叠加配置 `env`。

## stdin 消息（每行一个 JSON）

```json
{"event":"user","message":{"content":"<prompt>"}}
```

收到 `result` 事件后关闭 stdin；进程完成当前 turn 后退出。

## stdout 事件（NDJSON）

```json
{"event":"init","conversation_id":"…","init":{"cwd":"…","tools":["…"],"permission_mode":"request-review|always-proceed"}}
{"event":"step_update","step_update":{"conversation_id":"…","step_index":1,"state":"ACTIVE|DONE","step_type":"agent_response","text_delta":"…","tool_name?":"…","tool_info?":{…},"usage?":{…}}}
{"event":"result","result":{"conversation_id":"…","status":"SUCCESS|ERROR|CANCELED|INTERRUPTED|INVALID|WAITING|RUNNING","response":"…","error?":"…","duration_seconds":2.8,"num_turns":1,"usage":{…}}}
```

- `init` 必出现一次（流开始）；`result` 至少出现一次（正常结束时一次）。
- 未知 `event` 必须忽略并记日志，不得中断读取。
- 单行可能很大（含工具输出），行缓冲上限建议 8 MiB，超限视为协议错误。

## 退出码与诊断

| 情况 | 退出码 | 提供方处理 |
|---|---|---|
| 正常完成（stdin 关闭后） | 0 | 以 `result.status` 为准 |
| 认证缺失（非交互） | 非 0，stderr 含认证提示 | 诊断分类 `not-authenticated` |
| 未知模型/参数错误 | 1（结果 status ERROR） | 以 `result.error` 为诊断 |
| 流式输入被破坏（非法 JSON/未知块类型） | 1/2 | `protocol` 诊断，附退出码 |
| 进程被信号终止 | 信号退出 | 按取消/超时分类 |
| 找不到可执行文件 | spawn 前已拦截 | `not-installed` |

## 安全边界

- 不读取、不传递、不落盘任何 AGY 凭据；仅依赖用户已完成的交互登录。
- 不修改 `~/.gemini/antigravity-cli/settings.json` 或全局配置。
- 不调用 Antigravity 后端 API；唯一外部交互是本地 `agy` 进程。
- 诊断信息不得包含 prompt 全文、工具输入/输出、文件内容或环境变量值。
