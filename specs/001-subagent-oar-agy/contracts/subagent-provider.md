# 契约：DSH 子代理提供方

提供方包 `dsh-subagent-agy` 对 DSH `@deepseek-ai/dsh-subagent` 接缝的契约。DSH 侧类型以 tag `dsh-v0.2.2-rc.1` 源码为准。

## 必需形状

```ts
export const name = 'subagent-agy'
export const inject = ['subagents']
export interface Config { /* 见 data-model.md ProviderConfig */ }
export const Config: z<Config> = z.object({ /* … */ })
export function apply(ctx: Context, config: Config): void
```

说明：`export const name = 'subagent-agy'` 是 Cordis 插件名（供组合包/加载器识别）；组合包 patch 行的 `name: dsh-subagent-agy` 是 npm 包名（供模块解析）。两者用途不同，不可互相替代。

`apply` 内：

```ts
const provider: SubagentProvider = {
  name: config.providerName,          // 默认 'agy'
  capabilities: NO_START_CAPABILITIES,
  inheritsParentContext: false,
  start: request => startAgyRun(request, spec),
}
ctx.subagents.registerProvider(provider)
```

## 提供方保证

1. **一次性、独立上下文**：`inheritsParentContext: false` 且不提供 `prepareContinuable`；官方 `subagent_oar` 工具据此接受该 provider。
2. **能力为零**：`agentOptions`/`agentPreset`/`outputSchema`/`depthLimit` 均不支持；服务会在启动前拒绝相关请求，提供方不得假装支持。
3. **result 永不 reject**：`start()` 返回的 `SubagentRun.result` 用 `settleRunResult` 结算；模型/传输失败以 `stopReason: 'error'` + `diagnostic` 呈现；取消以 `aborted` 呈现。
4. **dispose 幂等**：用 `subprocessRunHandle` 发布；`dispose()` 移除 abort 监听、结算本地取消、执行终止阶梯并等待进程退出后才 resolve。
5. **启动失败清理**：在 `start()` reject 之前清理未发布的子进程与监听器（例如 spawn 失败、cwd 校验失败）。
6. **cwd**：`request.cwd` 为相对路径时先相对父代理当前目录解析为绝对路径，并用 `assertUsableCwd('subagent-agy', 'cwd', abs)` 校验；不传则继承父目录。
7. **prompt**：`request.prompt` 只允许 text 内容块；多个块按原顺序拼接（不插入分隔符），非 text 块直接拒绝启动。
8. **id**：`SubagentRun.id` 由提供方生成（`SubagentRunId(randomUUID())`），唯一且不复用。

## 错误语义

| 场景 | `start()` 行为 | `result` 行为 |
|---|---|---|
| 配置非法（激活期） | 插件激活抛错，DSH 记录加载失败 | — |
| command 不可解析 | 抛错，附未安装诊断 | 不发布 |
| cwd 不可用 / prompt 非法 | 抛错 | 不发布 |
| spawn 失败 | 清理后抛错 | 不发布 |
| 发布后进程失败/流损坏 | — | `stopReason: 'error'` + diagnostic |
| 发布后父取消 | — | `stopReason: 'aborted'` |
| 发布后超时 | — | `stopReason: 'error'` + timeout diagnostic |
| teardown 失败 | `dispose()` reject（不影响已结算 result） | — |

## 可观测性

- 每次失败通过 `ctx.logger.warn('subagent-agy "%s": %s', providerName, message)` 记录安全摘要。
- 不记录 prompt 全文、文件内容、环境变量值或 AGY 凭据。
