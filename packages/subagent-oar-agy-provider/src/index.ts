/** DSH 插件入口：注册一个把独立任务委派给本机 AGY CLI 的一次性提供方。 */

import type { Context } from '@deepseek-ai/cordis'
import { NO_START_CAPABILITIES, assertPositiveFinite, type SubagentProvider } from '@deepseek-ai/dsh-subagent'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'
import Schema from '@deepseek-ai/schemastery'
import { startAgyRun, type AgyRunSpec } from './run.js'
import { RunRegistry, setDefaultRunRegistry } from './runs.js'
import type { PermissionMode } from './agy/spawn.js'
import { redactSensitive } from './agy/errors.js'
import { detectLocale, isLocale, readSettingsText, LOCALES, type Locale } from './i18n.js'

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
  /** 从 spawn 到 init 的启动等待窗口（毫秒），默认 60000。 */
  startupTimeoutMs?: number
  /** init 后连续无协议事件的静默窗口（毫秒），默认 900000。 */
  stallTimeoutMs?: number
  /** 单次时限（毫秒），从 AGY init 事件起算；省略则不设内部计时。 */
  timeoutMs?: number
  /** 每运行活动摘要上限（1–20），默认 20。 */
  activityLimit?: number
  /** 终态记录保留时间（毫秒），默认 300000。 */
  terminalRetentionMs?: number
  /** 每父会话记录上限（1–50），默认 50。 */
  maxRecordsPerParent?: number
  /** 终止宽限（毫秒），默认 10000。 */
  killGraceMs?: number
  /** 子进程环境变量覆盖；null 表示删除。 */
  env?: Record<string, string | null>
  /** 面向用户文案的语言：`auto`（跟随 DSH 设置/系统）或 de/en/es/fr/ja/pt/ru/zh。 */
  locale?: string
}

const PERMISSION_MODES: readonly PermissionMode[] = ['yolo', 'plan', 'strict']

/** 配置 schema（由 DSH 在加载时校验）。 */
export const Config = Schema.object({
  providerName: Schema.string().min(1).default('agy'),
  command: Schema.string().min(1).default('agy'),
  model: Schema.string().min(1),
  effort: Schema.string().min(1),
  permissionMode: Schema.string().min(1).default('yolo'),
  startupTimeoutMs: Schema.number().min(1).max(MAX_TIMER_DELAY_MS).default(60_000),
  stallTimeoutMs: Schema.number().min(1).max(MAX_TIMER_DELAY_MS).default(900_000),
  timeoutMs: Schema.number().min(1).max(MAX_TIMER_DELAY_MS),
  activityLimit: Schema.number().min(1).max(20).default(20),
  terminalRetentionMs: Schema.number().min(1).max(MAX_TIMER_DELAY_MS).default(300_000),
  maxRecordsPerParent: Schema.number().min(1).max(50).default(50),
  killGraceMs: Schema.number().min(1).max(MAX_TIMER_DELAY_MS).default(10_000),
  env: Schema.dict(Schema.union([Schema.string(), Schema.const(null)])).default({}),
  locale: Schema.string().min(1).default('auto'),
}) as unknown as Schema<Config>

/** 校验整数范围（Schemastery 允许小数，这里保持配置语义严格）。 */
function assertIntegerRange(name: string, value: number, min: number, max: number): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`subagent-agy: ${name} 必须是 ${min}–${max} 的整数，收到 ${String(value)}`)
  }
}

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
  assertIntegerRange('startupTimeoutMs', config.startupTimeoutMs ?? 60_000, 1, MAX_TIMER_DELAY_MS)
  assertIntegerRange('stallTimeoutMs', config.stallTimeoutMs ?? 900_000, 1, MAX_TIMER_DELAY_MS)
  assertIntegerRange('activityLimit', config.activityLimit ?? 20, 1, 20)
  assertIntegerRange('terminalRetentionMs', config.terminalRetentionMs ?? 300_000, 1, MAX_TIMER_DELAY_MS)
  assertIntegerRange('maxRecordsPerParent', config.maxRecordsPerParent ?? 50, 1, 50)
  if (config.locale !== undefined && config.locale !== 'auto' && !isLocale(config.locale)) {
    throw new Error(`subagent-agy: locale 必须是 auto 或 ${LOCALES.join(' / ')}，收到 ${String(config.locale)}`)
  }
  const locale: Locale = detectLocale(config.locale ?? 'auto', process.env, readSettingsText())
  const registry = new RunRegistry({
    activityLimit: config.activityLimit ?? 20,
    terminalRetentionMs: config.terminalRetentionMs ?? 300_000,
    maxRecordsPerParent: config.maxRecordsPerParent ?? 50,
  })
  setDefaultRunRegistry(registry)

  const spec: AgyRunSpec = {
    providerName,
    command: config.command ?? 'agy',
    ...(config.model === undefined ? {} : { model: config.model }),
    ...(config.effort === undefined ? {} : { effort: config.effort }),
    permissionMode,
    locale,
    startupTimeoutMs: config.startupTimeoutMs ?? 60_000,
    stallTimeoutMs: config.stallTimeoutMs ?? 900_000,
    ...(config.timeoutMs === undefined ? {} : { timeoutMs: config.timeoutMs }),
    killGraceMs: config.killGraceMs ?? 10_000,
    env: config.env ?? {},
    registry,
    debugLog: message => { ctx.logger.warn('%s', message) },
    onError: (error, stopReason) => {
      ctx.logger.warn('subagent-agy "%s" [%s]: %s', providerName, stopReason, redactSensitive(error.message))
    },
  }

  const provider: SubagentProvider = {
    name: providerName,
    capabilities: NO_START_CAPABILITIES,
    inheritsParentContext: false,
    start: request => startAgyRun(request, spec),
  }
  const unregister = ctx.subagents.registerProvider(provider)
  if (typeof ctx.effect === 'function') {
    ctx.effect(() => async () => {
      await registry.dispose()
      unregister?.()
    })
  }
}
