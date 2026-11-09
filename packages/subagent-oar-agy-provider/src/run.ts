/** 一次 AGY 委派的完整生命周期：解析、启动、事件流、看门狗/取消、结算。 */

import { randomUUID } from 'node:crypto'
import type { ChildProcess } from 'node:child_process'
import { brandString } from '@deepseek-ai/dsh-brand'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import {
  assertUsableCwd,
  settleRunResult,
  subprocessRunHandle,
  type ResolvedSubagentStartRequest,
  type SubagentResult,
  type SubagentRun,
} from '@deepseek-ai/dsh-subagent'
import { NdjsonLineReader, DEFAULT_MAX_LINE_BYTES } from './agy/stream.js'
import { isInitEvent, isResultEvent, isStepEvent, parseAgyLine, statusToStopReason, textDelta, type AgyResultEvent } from './agy/protocol.js'
import { spawnAgy } from './agy/spawn.js'
import type { PermissionMode } from './agy/spawn.js'
import { armDeadline, type Deadline } from './agy/timer.js'
import {
  AgyFailure,
  failureDiagnostic,
  localStderrSummary,
  looksLikeAuthenticationFailure,
  redactSensitive,
  summarizeStderr,
  truncateUtf8,
  type FailureCategory,
} from './agy/errors.js'
import { resolveAgyCommand } from './agy/resolve.js'
import { hasExited, terminate } from './teardown.js'
import { t, type Locale } from './i18n.js'
import { getDefaultRunRegistry, type RunRecord, type RunRegistry } from './runs.js'

const PROVIDER_PREFIX = 'subagent-agy'
const DEFAULT_STARTUP_TIMEOUT_MS = 60_000
const DEFAULT_STALL_TIMEOUT_MS = 900_000

/** 提供方运行配置（由插件 Config 派生）。 */
export interface AgyRunSpec {
  readonly providerName: string
  readonly command: string
  readonly model?: string
  readonly effort?: string
  readonly permissionMode: PermissionMode
  /** 面向用户文案的语言。 */
  readonly locale: Locale
  /** 从 spawn 到 init 的启动等待窗口。 */
  readonly startupTimeoutMs?: number
  /** init 后连续无协议事件的静默窗口。 */
  readonly stallTimeoutMs?: number
  readonly timeoutMs?: number
  readonly killGraceMs: number
  readonly env: Readonly<Record<string, string | null>>
  readonly registry?: RunRegistry
  /** 本机脱敏日志出口；默认不写。 */
  readonly debugLog?: (message: string) => void
  readonly onError?: (error: Error, stopReason: SubagentResult['stopReason']) => void
}

/** 提取任务文本；没有可用文本时按协议失败拒绝。 */
function textTask(prompt: readonly ContentBlock[], locale: Locale): string {
  const parts: string[] = []
  for (const block of prompt) {
    if (block.type === 'text') parts.push(block.text)
  }
  const text = parts.join('')
  if (text.trim().length === 0) {
    throw new AgyFailure('protocol', t(locale, 'textRequired'))
  }
  return text
}

/** 已取消失败（启动前检查用）。 */
function cancelledFailure(locale: Locale): AgyFailure {
  return new AgyFailure('cancelled', failureDiagnostic('cancelled', undefined, locale))
}

/** 创建一次运行并在进程发布后返回握手。 */
function publishRun(
  child: ChildProcess,
  prompt: string,
  request: ResolvedSubagentStartRequest,
  spec: AgyRunSpec,
  childId: string,
): SubagentRun {
  let resolveStopped!: (result: SubagentResult) => void
  const stopped = {
    promise: new Promise<SubagentResult>(resolve => { resolveStopped = resolve }),
    resolve: (result: SubagentResult): void => { resolveStopped(result) },
  }
  let resultEvent: AgyResultEvent | undefined
  let streamedText = ''
  let stderr = ''
  let spawnError: Error | undefined
  let malformedOutput = false
  let permissionDeniedFromStderr = false
  const permissionDeniedTools = new Set<string>()
  let deadline: Deadline = { clear() {} }
  let startupTimer: Deadline = { clear() {} }
  let stallTimer: Deadline = { clear() {} }
  let absoluteDueAt: number | undefined
  let disposal: Promise<void> | undefined
  let settled = false
  let phase: 'running' | 'cancelled' | 'failed' | 'settled' = 'running'

  const registry = spec.registry ?? getDefaultRunRegistry()
  const parentId = String(request.parent.id)
  const record: RunRecord = registry.register(parentId, childId, child.pid)

  const clearTimers = (): void => {
    deadline.clear()
    startupTimer.clear()
    stallTimer.clear()
  }

  const collectOutput = (): ContentBlock[] => {
    const response = resultEvent?.result?.response
    const answer = response !== undefined && response.length > 0 ? response : streamedText
    return answer.length === 0 ? [] : [{ type: 'text', text: answer }]
  }

  const dispose = (): Promise<void> => {
    disposal ??= (async () => {
      clearTimers()
      await terminate(child, { graceMs: spec.killGraceMs })
      if (!hasExited(child)) spec.debugLog?.(`subagent-agy ${childId} termination-incomplete`)
    })()
    return disposal
  }
  record.teardown = dispose

  const settle = (
    result: SubagentResult,
    state: 'completed' | 'failed' | 'cancelled',
    info: { stopReason: string; failureCategory?: FailureCategory },
  ): void => {
    if (settled) return
    settled = true
    phase = state === 'cancelled' ? 'cancelled' : state === 'completed' ? 'settled' : 'failed'
    clearTimers()
    registry.recordTerminal(record, state, info)
    stopped.resolve(result)
  }

  const logFailure = (category: FailureCategory): void => {
    if (spec.debugLog === undefined) return
    const detail = localStderrSummary(stderr)
    const suffix = detail === undefined ? '' : `: ${redactSensitive(detail)}`
    spec.debugLog(`subagent-agy ${childId} ${category}${suffix}`)
  }

  const failureResult = (category: FailureCategory, stopReason: 'error' | 'aborted'): SubagentResult => {
    const result: SubagentResult = {
      output: collectOutput(),
      stopReason,
      ...(stopReason === 'error' ? { diagnostic: failureDiagnostic(category, undefined, spec.locale) } : {}),
    }
    logFailure(category)
    return result
  }

  const armAbsolute = (): void => {
    deadline.clear()
    absoluteDueAt = undefined
    if (spec.timeoutMs === undefined) return
    absoluteDueAt = Date.now() + spec.timeoutMs
    deadline = armDeadline(spec.timeoutMs, () => {
      if (settled || resultEvent !== undefined) return
      interrupt('timeout')
    })
  }

  const armStall = (): void => {
    stallTimer.clear()
    if (settled || resultEvent !== undefined) return
    stallTimer = armDeadline(spec.stallTimeoutMs ?? DEFAULT_STALL_TIMEOUT_MS, () => {
      if (settled || resultEvent !== undefined) return
      // FR-008：绝对 timeoutMs 与静默窗口同 tick 到期时，绝对超时优先。
      if (absoluteDueAt !== undefined && Date.now() >= absoluteDueAt) interrupt('timeout')
      else interrupt('stalled')
    })
  }

  const interrupt = (reason: 'cancelled' | 'startup-timeout' | 'stalled' | 'timeout'): void => {
    if (settled) return
    if (reason === 'cancelled') {
      settle(failureResult('cancelled', 'aborted'), 'cancelled', { stopReason: 'aborted' })
    } else {
      settle(failureResult(reason, 'error'), 'failed', { stopReason: 'error', failureCategory: reason })
    }
    void dispose()
  }

  const onAbort = (): void => { interrupt('cancelled') }

  const closed = new Promise<void>(resolve => {
    child.once('error', (error: Error) => { spawnError = error; resolve() })
    child.once('close', () => { resolve() })
  })

  const reader = new NdjsonLineReader(DEFAULT_MAX_LINE_BYTES, {
    onLine(line: string): void {
      const event = parseAgyLine(line)
      if (event === undefined) { malformedOutput = true; return }
      if (settled) return
      if (isInitEvent(event)) {
        startupTimer.clear()
        if (event.conversation_id !== undefined) record.conversationId = event.conversation_id
        registry.markReady(record)
        armAbsolute()
        armStall()
      } else if (isStepEvent(event)) {
        const step = event.step_update
        if (step?.conversation_id !== undefined) record.conversationId = step.conversation_id
        if (step?.state === 'ERROR' && step.tool_name !== undefined) {
          const info = step.tool_info as { error?: { message?: string } } | undefined
          if (/permission/i.test(info?.error?.message ?? '')) permissionDeniedTools.add(step.tool_name)
        }
        const delta = textDelta(event)
        if (delta !== undefined) {
          streamedText += delta
          registry.recordActivity(record, 'text', {
            text: delta,
            ...(step?.step_index === undefined ? {} : { stepIndex: step.step_index }),
            ...(step?.state === undefined ? {} : { stepState: step.state }),
            ...(step?.tool_name === undefined ? {} : { toolName: step.tool_name }),
          })
        } else if (step !== undefined) {
          const summary = step.tool_name !== undefined
            ? `tool ${step.tool_name}`
            : `step ${step.step_index ?? '?'} ${step.state ?? ''}`.trim()
          registry.recordActivity(record, step.tool_name === undefined ? 'step' : 'tool', {
            summary,
            ...(step.step_index === undefined ? {} : { stepIndex: step.step_index }),
            ...(step.state === undefined ? {} : { stepState: step.state }),
            ...(step.tool_name === undefined ? {} : { toolName: step.tool_name }),
          })
        }
        armStall()
      } else if (isResultEvent(event)) {
        resultEvent = event
        if (event.result?.conversation_id !== undefined) record.conversationId = event.result.conversation_id
        registry.recordActivity(record, 'result', { summary: 'result received' })
        // result 是终态事件：立即裁决，避免 AGY 收到结果后迟迟不退出时无限等待。
        const outcome = terminalOutcome()
        settle(outcome.result, outcome.state, {
          stopReason: outcome.result.stopReason,
          ...(outcome.category === undefined ? {} : { failureCategory: outcome.category }),
        })
        void dispose()
      }
    },
    onError(): void { malformedOutput = true },
  })

  child.stdout?.on('data', (chunk: Buffer) => { reader.push(chunk) })
  child.stdout?.on('end', () => { reader.end() })
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr = truncateUtf8(`${stderr}${chunk.toString('utf8')}`, 16 * 1024)
    if (/headless mode cannot prompt|permission check failed/i.test(stderr)) permissionDeniedFromStderr = true
    const summary = summarizeStderr(stderr)
    if (summary !== undefined) registry.recordStderr(record, summary)
  })

  const writeInput = (): void => {
    const stdin = child.stdin
    if (stdin === null || stdin === undefined) return
    stdin.end(prompt.length === 0 ? '' : `${JSON.stringify({ event: 'user', message: { content: prompt } })}\n`)
  }

  const terminalOutcome = (): { result: SubagentResult; state: 'completed' | 'failed' | 'cancelled'; category?: FailureCategory } => {
    if (spawnError !== undefined) {
      return {
        result: failureResult('spawn-failed', 'error'),
        state: 'failed',
        category: 'spawn-failed',
      }
    }
    const resultPayload = resultEvent?.result
    if (resultPayload !== undefined) {
      const stopReason = statusToStopReason(resultPayload.status)
      if (stopReason === 'completed') {
        const denied = permissionDeniedTools.size > 0 || permissionDeniedFromStderr
        if (!denied) return { result: { output: collectOutput(), stopReason }, state: 'completed' }
        const tools = [...permissionDeniedTools].join(', ') || t(spec.locale, 'permissionToolFallback')
        const note = t(spec.locale, 'permissionDenied', { mode: spec.permissionMode, tools })
        const answer = collectOutput()
        const prefix = answer
          .map(block => (block.type === 'text' ? block.text : ''))
          .join('')
          .trim()
        return {
          result: { output: [{ type: 'text', text: prefix.length > 0 ? `${prefix}\n\n${note}` : note }], stopReason },
          state: 'completed',
        }
      }
      if (stopReason === 'aborted') {
        return { result: { output: collectOutput(), stopReason }, state: 'cancelled' }
      }
      const errorText = resultPayload.error ?? resultPayload.response
      const category: FailureCategory = looksLikeAuthenticationFailure(errorText) ? 'not-authenticated' : 'protocol'
      return {
        result: failureResult(category, 'error'),
        state: 'failed',
        category,
      }
    }
    const category: FailureCategory = looksLikeAuthenticationFailure(summarizeStderr(stderr)) ? 'not-authenticated' : 'protocol'
    const failure: SubagentResult = {
      output: collectOutput(),
      stopReason: 'error',
      diagnostic: failureDiagnostic(category, malformedOutput ? t(spec.locale, 'malformedLines') : undefined, spec.locale),
    }
    logFailure(category)
    return { result: failure, state: 'failed', category }
  }

  const attempt = async (): Promise<SubagentResult> => {
    writeInput()
    const first = await Promise.race([closed.then(() => 'closed' as const), stopped.promise])
    if (first !== 'closed') return first
    if (settled) return stopped.promise
    const outcome = terminalOutcome()
    settle(outcome.result, outcome.state, {
      stopReason: outcome.result.stopReason,
      ...(outcome.category === undefined ? {} : { failureCategory: outcome.category }),
    })
    return outcome.result
  }

  const result = settleRunResult({
    attempt,
    collectOutput,
    collectDiagnostic: () => undefined,
    cancelled: () => phase === 'cancelled',
    ...(spec.onError === undefined ? {} : { onError: spec.onError }),
    signal: request.signal,
    onAbort,
  }).finally(() => {
    clearTimers()
  })

  request.signal.addEventListener('abort', onAbort, { once: true })
  if (request.signal.aborted) onAbort()

  // 启动窗口从 spawn 起算；init 到达后切换到静默/绝对窗口。
  startupTimer = armDeadline(spec.startupTimeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS, () => {
    if (settled || resultEvent !== undefined) return
    interrupt('startup-timeout')
  })

  return subprocessRunHandle({
    id: brandString(childId) as SubagentRun['id'],
    result,
    signal: request.signal,
    onAbort,
    requestCancel: onAbort,
    teardown: async () => {
      await dispose()
      await result
    },
  })
}

/**
 * 启动一次 AGY 委派。
 * @param request - 已解析的启动请求（绝对 cwd、文本 prompt、取消信号）。
 * @param spec - 插件配置派生的运行参数。
 * @returns 已发布的运行句柄；启动前失败会抛出分类明确的 AgyFailure。
 */
export async function startAgyRun(request: ResolvedSubagentStartRequest, spec: AgyRunSpec): Promise<SubagentRun> {
  const prompt = textTask(request.prompt, spec.locale)
  if (request.signal.aborted) throw cancelledFailure(spec.locale)
  const cwd = assertUsableCwd(PROVIDER_PREFIX, 'child cwd', request.cwd)
  let command: string
  try {
    command = resolveAgyCommand(spec.command)
  } catch (error) {
    throw new AgyFailure('not-installed', failureDiagnostic('not-installed', undefined, spec.locale), { cause: error })
  }

  let child: ChildProcess
  try {
    child = spawnAgy({
      command,
      cwd,
      ...(spec.model === undefined ? {} : { model: spec.model }),
      ...(spec.effort === undefined ? {} : { effort: spec.effort }),
      permissionMode: spec.permissionMode,
      env: spec.env,
    })
  } catch {
    throw new AgyFailure('spawn-failed', failureDiagnostic('spawn-failed', undefined, spec.locale))
  }

  if (request.signal.aborted) {
    await terminate(child, { graceMs: spec.killGraceMs })
    throw cancelledFailure(spec.locale)
  }

  const run = publishRun(child, prompt, request, spec, randomUUID())
  if (request.signal.aborted) {
    await run.dispose()
    throw cancelledFailure(spec.locale)
  }
  return run
}
