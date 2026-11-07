/** AGY `--output-format stream-json` 的宽松事件类型与终态映射。 */

/** AGY 结果状态；未知值按字符串保留。 */
export type AgyStatus = 'SUCCESS' | 'ERROR' | 'CANCELED' | 'INTERRUPTED' | 'INVALID' | 'WAITING' | 'RUNNING' | string

/** 子代理停止原因（与 DSH 接缝的字符串联合对齐）。 */
export type AgyStopReason = 'completed' | 'error' | 'aborted' | 'max-tokens' | 'refusal'

/** `init` 事件。 */
export interface AgyInitEvent {
  event: 'init'
  conversation_id?: string
  init?: {
    cwd?: string
    tools?: readonly string[]
    permission_mode?: string
    model?: string
  }
}

/** `step_update` 事件。 */
export interface AgyStepEvent {
  event: 'step_update'
  step_update?: {
    conversation_id?: string
    step_index?: number
    state?: 'ACTIVE' | 'DONE' | string
    step_type?: string
    text_delta?: string
    tool_name?: string
    tool_info?: unknown
    usage?: unknown
  }
}

/** `result` 事件（终态）。 */
export interface AgyResultEvent {
  event: 'result'
  result?: {
    conversation_id?: string
    status?: AgyStatus
    response?: string
    error?: string
    duration_seconds?: number
    num_turns?: number
    usage?: unknown
  }
}

/** 未知事件。 */
export interface AgyUnknownEvent {
  event: string
  [key: string]: unknown
}

export type AgyEvent = AgyInitEvent | AgyStepEvent | AgyResultEvent | AgyUnknownEvent

/** 解析一行 NDJSON；非法 JSON 返回 undefined。 */
export function parseAgyLine(line: string): AgyEvent | undefined {
  try {
    const parsed: unknown = JSON.parse(line)
    if (typeof parsed !== 'object' || parsed === null) return undefined
    const event = (parsed as { event?: unknown }).event
    if (typeof event !== 'string') return undefined
    return parsed as AgyEvent
  } catch {
    return undefined
  }
}

/** 判别 `init` 事件。 */
export function isInitEvent(event: AgyEvent): event is AgyInitEvent {
  return event.event === 'init'
}

/** 判别 `step_update` 事件。 */
export function isStepEvent(event: AgyEvent): event is AgyStepEvent {
  return event.event === 'step_update'
}

/** 判别 `result` 事件。 */
export function isResultEvent(event: AgyEvent): event is AgyResultEvent {
  return event.event === 'result'
}

/** 把 AGY 终态 status 映射为 DSH 停止原因。 */
export function statusToStopReason(status: string | undefined): AgyStopReason {
  switch (status) {
    case 'SUCCESS': return 'completed'
    case 'CANCELED':
    case 'INTERRUPTED': return 'aborted'
    default: return 'error'
  }
}

/** 从 `step_update` 提取文本增量；没有时返回 undefined。 */
export function textDelta(event: AgyStepEvent): string | undefined {
  return event.step_update?.text_delta
}
