/** DSH 插件入口：注册一个把独立任务委派给本机 AGY CLI 的一次性提供方。 */

import type { Context } from '@deepseek-ai/cordis'
import { NO_START_CAPABILITIES, assertPositiveFinite, type SubagentProvider } from '@deepseek-ai/dsh-subagent'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'
import Schema from '@deepseek-ai/schemastery'
import { startAgyRun, type AgyRunSpec } from './run.js'
import type { PermissionMode } from './agy/spawn.js'

/** 插件名（Cordis 识别用）。 */
export const name = 'subagent-agy'

/** 依赖的子代理服务。 */
export const inject = ['subagents']

/** 插件配置。 */
export interface Config {
  /** 注册到子代理服务的运行时名；默认 `agy`。 */
  providerName?: string
  /** AGY 可执行文件：名称（走 PATH/PATHEXT）或绝对/相对路径。 */
  command?: string
  /** 传给 AGY 的模型名。 */
  model?: string
  /** 传给 AGY 的推理档位。 */
  effort?: string
  /** 权限档：yolo（默认无人值守）、plan（只读规划）、strict（软拒绝）。 */
  permissionMode?: PermissionMode
  /** 单次时限（毫秒），从 AGY init 事件起算；省略则不设内部计时。 */
  timeoutMs?: number
  /** 终止宽限（毫秒），默认 10000。 */
  killGraceMs?: number
  /** 子进程环境变量覆盖；null 表示删除。 */
  env?: Record<string, string | null>
}

const PERMISSION_MODES: readonly PermissionMode[] = ['yolo', 'plan', 'strict']

/** 配置 schema（由 DSH 在加载时校验）。 */
export const Config = Schema.object({
  providerName: Schema.string().min(1).default('agy'),
  command: Schema.string().min(1).default('agy'),
  model: Schema.string().min(1),
  effort: Schema.string().min(1),
  permissionMode: Schema.string().min(1).default('yolo'),
  timeoutMs: Schema.number().min(1).max(MAX_TIMER_DELAY_MS),
  killGraceMs: Schema.number().min(1).max(MAX_TIMER_DELAY_MS).default(10_000),
  env: Schema.dict(Schema.union([Schema.string(), Schema.const(null)])).default({}),
}) as unknown as Schema<Config>

/** 应用插件：校验配置并注册提供方。 */
export function apply(ctx: Context, config: Config): void {
  const providerName = config.providerName ?? 'agy'
  const permissionMode = (config.permissionMode ?? 'yolo') as PermissionMode
  if (!PERMISSION_MODES.includes(permissionMode)) {
    throw new Error(`subagent-agy: permissionMode 必须是 ${PERMISSION_MODES.join(' / ')}，收到 ${String(config.permissionMode)}`)
  }
  if (config.timeoutMs !== undefined) {
    assertPositiveFinite('subagent-agy', 'timeoutMs', config.timeoutMs)
    if (config.timeoutMs > MAX_TIMER_DELAY_MS) {
      throw new Error(`subagent-agy: timeoutMs 不能大于 ${MAX_TIMER_DELAY_MS}`)
    }
  }
  assertPositiveFinite('subagent-agy', 'killGraceMs', config.killGraceMs ?? 10_000)

  const spec: AgyRunSpec = {
    providerName,
    command: config.command ?? 'agy',
    ...(config.model === undefined ? {} : { model: config.model }),
    ...(config.effort === undefined ? {} : { effort: config.effort }),
    permissionMode,
    ...(config.timeoutMs === undefined ? {} : { timeoutMs: config.timeoutMs }),
    killGraceMs: config.killGraceMs ?? 10_000,
    env: config.env ?? {},
    onError: (error, stopReason) => {
      ctx.logger.warn('subagent-agy "%s" [%s]: %s', providerName, stopReason, error.message)
    },
  }

  const provider: SubagentProvider = {
    name: providerName,
    capabilities: NO_START_CAPABILITIES,
    inheritsParentContext: false,
    start: request => startAgyRun(request, spec),
  }
  ctx.subagents.registerProvider(provider)
}
