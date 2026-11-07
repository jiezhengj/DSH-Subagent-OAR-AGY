/** 一次 AGY 委派的完整生命周期：解析、启动、事件流、时限/取消、结算。 */

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
  looksLikeAuthenticationFailure,
  summarizeStderr,
  truncateUtf8,
  type FailureCategory,
} from './agy/errors.js'
import { resolveAgyCommand } from './agy/resolve.js'
import { terminate } from './teardown.js'

const PROVIDER_PREFIX = 'subagent-agy'

/** 提供方运行配置（由插件 Config 派生）。 */
export interface AgyRunSpec {
  readonly providerName: string
  readonly command: string
  readonly model?: string
  readonly effort?: string
  readonly permissionMode: PermissionMode
  readonly timeoutMs?: number
  readonly killGraceMs: number
  readonly env: Readonly<Record<string, string | null>>
  readonly onError?: (error: Error, stopReason: SubagentResult['stopReason']) => void
}

/** 提取任务文本；没有可用文本时按协议失败拒绝。 */
function textTask(prompt: readonly ContentBlock[]): string {
  const parts: string[] = []
  for (const block of prompt) {
    if (block.type === 'text') parts.push(block.text)
  }
  const text = parts.join('')
  if (text.trim().length === 0) {
    throw new AgyFailure('protocol', '委派任务必须包含文本内容（AGY 运行时不接受纯图片/结构化输入）')
  }
  return text
}

/** 已取消失败（启动前检查用）。 */
function cancelledFailure(): AgyFailure {
  return new AgyFailure('cancelled', failureDiagnostic('cancelled'))
}

/** 创建一次运行并在进程发布后返回握手。 */
function publishRun(child: ChildProcess, prompt: string, request: ResolvedSubagentStartRequest, spec: AgyRunSpec): SubagentRun {
  let resolveStopped!: (result: SubagentResult) => void
  const stopped = { promise: new Promise<SubagentResult>(resolve => { resolveStopped = resolve }), resolve: (result: SubagentResult): void => { resolveStopped(result) } }
  let phase: 'running' | 'settled' | 'cancelled' | 'timeout' = 'running'
  let resultEvent: AgyResultEvent | undefined
  let streamedText = ''
  let stderr = ''
  let spawnError: Error | undefined
  let malformedOutput = false
  let permissionDeniedFromStderr = false
  const permissionDeniedTools = new Set<string>()
  let deadline: Deadline = { clear() {} }
  let disposal: Promise<void> | undefined

  const collectOutput = (): ContentBlock[] => {
    const response = resultEvent?.result?.response
    const answer = response !== undefined && response.length > 0 ? response : streamedText
    return answer.length === 0 ? [] : [{ type: 'text', text: answer }]
  }

  const dispose = (): Promise<void> => {
    disposal ??= (async () => {
      deadline.clear()
      await terminate(child, { graceMs: spec.killGraceMs })
    })()
    return disposal
  }

  const interrupt = (reason: 'cancelled' | 'timeout'): void => {
    if (phase !== 'running') return
    phase = reason
    stopped.resolve({
      output: collectOutput(),
      stopReason: reason === 'cancelled' ? 'aborted' : 'error',
      ...(reason === 'timeout' ? { diagnostic: failureDiagnostic('timeout') } : {}),
    })
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
      if (isInitEvent(event)) {
        deadline = armDeadline(spec.timeoutMs, () => { interrupt('timeout') })
      } else if (isStepEvent(event)) {
        const step = event.step_update
        if (step?.state === 'ERROR' && step.tool_name !== undefined) {
          const info = step.tool_info as { error?: { message?: string } } | undefined
          if (/permission/i.test(info?.error?.message ?? '')) permissionDeniedTools.add(step.tool_name)
        }
        const delta = textDelta(event)
        if (delta !== undefined) streamedText += delta
      } else if (isResultEvent(event)) {
        resultEvent = event
      }
    },
    onError(): void { malformedOutput = true },
  })

  child.stdout?.on('data', (chunk: Buffer) => { reader.push(chunk) })
  child.stdout?.on('end', () => { reader.end() })
  child.stderr?.on('data', (chunk: Buffer) => {
    stderr = truncateUtf8(`${stderr}${chunk.toString('utf8')}`, 16 * 1024)
    if (/headless mode cannot prompt|permission check failed/i.test(stderr)) permissionDeniedFromStderr = true
  })

  const writeInput = (): void => {
    const stdin = child.stdin
    if (stdin === null || stdin === undefined) return
    stdin.end(prompt.length === 0 ? '' : `${JSON.stringify({ event: 'user', message: { content: prompt } })}\n`)
  }

  const terminal = (): SubagentResult => {
    if (phase === 'cancelled') return { output: collectOutput(), stopReason: 'aborted' }
    if (phase === 'timeout') return { output: collectOutput(), stopReason: 'error', diagnostic: failureDiagnostic('timeout') }
    if (spawnError !== undefined) {
      return { output: collectOutput(), stopReason: 'error', diagnostic: failureDiagnostic('spawn-failed', spawnError.message) }
    }
    const result = resultEvent?.result
    if (result !== undefined) {
      const stopReason = statusToStopReason(result.status)
      if (stopReason === 'completed') {
        const denied = permissionDeniedTools.size > 0 || permissionDeniedFromStderr
        if (!denied) return { output: collectOutput(), stopReason }
        const tools = [...permissionDeniedTools].join('、') || '需要权限的工具'
        const note = `[subagent-agy] 权限档 ${spec.permissionMode}：AGY 已自动拒绝需要权限的动作（${tools}），相关修改未执行。若要允许，请把 permissionMode 改为 yolo，或在 AGY 的 settings.json 中配置 allow 规则。`
        const answer = collectOutput()
        const prefix = answer
          .map(block => (block.type === 'text' ? block.text : ''))
          .join('')
          .trim()
        return { output: [{ type: 'text', text: prefix.length > 0 ? `${prefix}\n\n${note}` : note }], stopReason }
      }
      if (stopReason === 'aborted') return { output: collectOutput(), stopReason }
      const errorText = result.error ?? result.response
      const category: FailureCategory = looksLikeAuthenticationFailure(errorText) ? 'not-authenticated' : 'protocol'
      return { output: collectOutput(), stopReason: 'error', diagnostic: failureDiagnostic(category, summarizeStderr(stderr)) }
    }
    const detail = summarizeStderr(stderr)
    const category: FailureCategory = looksLikeAuthenticationFailure(detail) ? 'not-authenticated' : 'protocol'
    const suffix = malformedOutput ? 'AGY 输出包含无法解析的行。' : detail
    return { output: collectOutput(), stopReason: 'error', diagnostic: failureDiagnostic(category, suffix) }
  }

  const attempt = async (): Promise<SubagentResult> => {
    writeInput()
    const first = await Promise.race([closed.then(() => 'closed' as const), stopped.promise])
    // stopped 先结算（取消/超时）：直接返回已结算结果。
    if (first !== 'closed') return first
    if (phase !== 'running') return stopped.promise
    phase = 'settled'
    return terminal()
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
    deadline.clear()
  })

  request.signal.addEventListener('abort', onAbort, { once: true })
  if (request.signal.aborted) onAbort()

  return subprocessRunHandle({
    id: brandString(randomUUID()) as SubagentRun['id'],
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
  const prompt = textTask(request.prompt)
  if (request.signal.aborted) throw cancelledFailure()
  const cwd = assertUsableCwd(PROVIDER_PREFIX, 'child cwd', request.cwd)
  const command = resolveAgyCommand(spec.command)

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
  } catch (error) {
    throw new AgyFailure('spawn-failed', failureDiagnostic('spawn-failed', error instanceof Error ? error.message : String(error)))
  }

  if (request.signal.aborted) {
    await terminate(child, { graceMs: spec.killGraceMs })
    throw cancelledFailure()
  }

  const run = publishRun(child, prompt, request, spec)
  if (request.signal.aborted) {
    await run.dispose()
    throw cancelledFailure()
  }
  return run
}
