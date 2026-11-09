# 契约：`subagent_oar_agy_control`

**版本**: 1.0.0（Feature `003-agy-observability-control`）

## 目的

为当前父会话提供一个受控入口，用于查询其直接发起的 AGY 委派状态，或请求取消其中一个委派。它不创建、恢复、继续或改变委派；状态查询无副作用，取消只提交停止意图。

## 工具表面

- **名称**: `subagent_oar_agy_control`（可由 bundle 配置 `controlToolName` 改名；默认名固定）
- **描述（模型可见）**: 查询当前父会话的 AGY 委派状态，或请求取消指定委派。状态包含是否启动/运行/结束、耗时、最近活动、当前步骤/工具和失败分类；取消只是受理请求，最终结果由完成通知给出。不要把它当作开始新委派的入口。
- **并发安全**: 是；登记表操作是进程内同步查找/更新，取消由共享子代理服务串行化。

## 输入

```json
{
  "action": "status",
  "childId": "optional-child-id"
}
```

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `action` | string | 是 | `status` 或 `cancel` |
| `childId` | string | 否 | `status` 时可选：省略表示列出当前父会话全部运行；提供时只查询该运行。`cancel` 时必填 |

## 输出

### `status` 动作

返回一个包含 `action: "status"` 的工具输出，结构由 [run-status.schema.json](./run-status.schema.json) 定义：

```json
{
  "action": "status",
  "generatedAt": "2026-11-09T05:00:00.000Z",
  "found": true,
  "runs": [
    {
      "childId": "8f1c...",
      "state": "running",
      "startedAt": "2026-11-09T04:59:30.000Z",
      "elapsedMs": 30000,
      "lastActivityAt": "2026-11-09T04:59:58.000Z",
      "lastEventKind": "step_update",
      "pid": 12345,
      "stepIndex": 7,
      "stepState": "RUNNING",
      "toolName": "run_command",
      "conversationId": "conv-...",
      "lastText": "正在检查构建输出...",
      "cancelRequestedAt": null,
      "activity": [
        {
          "seq": 1,
          "at": "2026-11-09T04:59:31.000Z",
          "kind": "init",
          "summary": "AGY ready"
        }
      ]
    }
  ]
}
```

规则：

- 省略 `childId` 时返回当前父会话所有未清理运行，`found: true`；没有运行时 `runs: []`。
- 顶层 `action` 固定为 `status`，并参与 `run-status.schema.json` 的校验。
- 指定 `childId` 且存在、属于当前父会话时 `found: true`；不存在、已清理或属于其他父会话时 `found: false`、`runs: []`。
- 状态查询不得触发启动、恢复或任何 AGY 调用。
- 不返回完整最终答复、完整 prompt、工具参数或原始 stderr。
- `lastText` 最多 200 字符；`activity` 最多 20 条；`runs` 最多 50 条。

### `cancel` 动作

```json
{
  "action": "cancel",
  "childId": "8f1c...",
  "accepted": true,
  "reason": "accepted",
  "requestedAt": "2026-11-09T05:00:05.000Z"
}
```

| 字段 | 类型 | 说明 |
|---|---|---|
| `accepted` | boolean | 是否已把停止意图提交给共享子代理服务 |
| `reason` | string | `accepted` / `already-requested` / `already-ended` / `not-found` / `unavailable` |
| `requestedAt` | string | 首次受理时间；拒绝时可省略 |

规则：

1. `accepted: true` 只表示请求已受理，不表示 AGY 已退出；最终结果仍通过官方完成通知送达。
2. 重复取消同一运行返回 `accepted: true`、`reason: "already-requested"`，不产生重复通知。
3. 运行已结束/已取消返回 `accepted: false`、`reason: "already-ended"`，无副作用。
4. 不存在、已清理或不属于当前父会话返回 `accepted: false`、`reason: "not-found"`；不得泄露其他会话信息。
5. 共享服务拒绝或不可用时返回 `accepted: false`、`reason: "unavailable"`，只记录安全分类，不把原始异常文本给模型。
6. `cancel` 缺少 `childId` 时工具参数校验失败，不查询、不取消。
7. `cancel` 缺少当前 `exec.agent` 时统一返回 `accepted:false`、`reason:"unavailable"`，不查询、不取消。

## 权限与边界

- 只允许操作当前 `exec.agent` 作为直接父级的 AGY 运行；不跨父会话、不跨进程。
- 取消通过 `ctx.subagents.interrupt(childId, { kind: 'ancestor', agent: exec.agent })` 提交，由共享服务校验地址、生命周期和通知。
- 控制工具不持有 `SubagentRun` 句柄，不直接 `dispose()`，不自行结算结果。
- 插件禁用后工具和登记表生命周期随插件 effect 释放；provider 清理阶段停止计时器，并对尚未结算的 AGY 运行执行现有 teardown/终止（或交给共享服务完成结算），不留下无监控进程。

## 兼容性

- 不修改官方 `subagent_oar` 或 `subagent_oar_agy` 的参数、返回值、描述和一次性语义。
- 控制工具是新增工具；已有会话的工具表在创建时固定，升级后需要新会话才能看到（文档提示重载/新会话）。
- 工具名冲突时可通过 `controlToolName` 改名；改名不影响状态结构和取消语义。
