/** 有界的 AGY 运行登记表：状态快照、活动摘要、取消请求与终态保留。 */

import type { FailureCategory } from './agy/errors.js'

/** 运行状态。 */
export type RunState = 'starting' | 'running' | 'completed' | 'failed' | 'cancelled'

/** 活动类型；`stderr` 只作诊断记录，不重置静默计时。 */
export type ActivityKind = 'init' | 'step' | 'tool' | 'text' | 'result' | 'lifecycle' | 'stderr'

/** 状态快照中的最近协议事件类型；活动类型 `step`/`tool`/`text` 统一映射为 `step_update`。 */
export type ProtocolEventKind = 'init' | 'step_update' | 'result' | 'stderr' | 'lifecycle'

/** 一次活动摘要。 */
export interface ActivityEntry {
  readonly seq: number
  readonly at: number
  readonly kind: ActivityKind
  readonly summary: string
  readonly stepIndex?: number
  readonly stepState?: string
  readonly toolName?: string
  readonly text?: string
}

/** 运行记录；由提供方更新，查询时投影为快照。 */
export interface RunRecord {
  readonly childId: string
  readonly parentId: string
  state: RunState
  readonly startedAt: number
  readyAt?: number
  endedAt?: number
  lastActivityAt?: number
  lastEventKind?: ProtocolEventKind
  pid?: number
  conversationId?: string
  stepIndex?: number
  stepState?: string
  toolName?: string
  lastText?: string
  stopReason?: string
  failureCategory?: FailureCategory
  cancelRequestedAt?: number
  readonly activity: ActivityEntry[]
  /** 运行清理钩子；插件卸载时用来终止尚未结算的进程。 */
  teardown?: () => Promise<void>
}

/** 状态查询输出中的一个运行。 */
export interface RunView {
  readonly childId: string
  readonly state: RunState
  readonly startedAt: string
  readonly readyAt: string | null
  readonly endedAt: string | null
  readonly elapsedMs: number
  readonly lastActivityAt: string | null
  readonly lastEventKind: ProtocolEventKind | null
  readonly pid: number | null
  readonly conversationId: string | null
  readonly stepIndex: number | null
  readonly stepState: string | null
  readonly toolName: string | null
  readonly lastText: string | null
  readonly stopReason: string | null
  readonly failureCategory: FailureCategory | null
  readonly cancelRequestedAt: string | null
  readonly activity: readonly RunViewActivity[]
}

/** 快照中的活动摘要。 */
export interface RunViewActivity {
  readonly seq: number
  readonly at: string
  readonly kind: ActivityKind
  readonly summary: string
  readonly stepIndex?: number
  readonly stepState?: string
  readonly toolName?: string
  readonly text?: string
}

/** `status` 动作的完整输出。 */
export interface StatusSnapshot {
  readonly action: 'status'
  readonly generatedAt: string
  readonly found: boolean
  readonly runs: readonly RunView[]
}

/** 取消受理结果。 */
export interface CancelReceipt {
  readonly accepted: boolean
  readonly reason: 'accepted' | 'already-requested' | 'already-ended' | 'not-found'
  readonly requestedAt?: number
}

/** 登记表配置。 */
export interface RunRegistryOptions {
  readonly activityLimit?: number
  readonly maxRecordsPerParent?: number
  readonly terminalRetentionMs?: number
  readonly now?: () => number
}

const DEFAULT_ACTIVITY_LIMIT = 20
const DEFAULT_MAX_RECORDS = 50
const DEFAULT_RETENTION_MS = 300_000

/** 活动类型到协议事件类型的映射；保持状态契约的 `step_update` 语义。 */
function protocolEventKind(kind: Exclude<ActivityKind, 'stderr'>): ProtocolEventKind {
  if (kind === 'step' || kind === 'tool' || kind === 'text') return 'step_update'
  return kind
}

/** 截断字符串到最多 N 个 Unicode 码点，避免代理对截断。 */
function clip(text: string, max: number): string {
  const chars = Array.from(text)
  return chars.length <= max ? text : chars.slice(0, max).join('')
}

/** 有界登记表。 */
export class RunRegistry {
  private readonly byParent = new Map<string, RunRecord[]>()
  private readonly byId = new Map<string, RunRecord>()
  private readonly timers = new Map<string, NodeJS.Timeout>()
  private readonly activityLimit: number
  private readonly maxRecordsPerParent: number
  private readonly terminalRetentionMs: number
  private readonly now: () => number

  constructor(options: RunRegistryOptions = {}) {
    this.activityLimit = options.activityLimit ?? DEFAULT_ACTIVITY_LIMIT
    this.maxRecordsPerParent = options.maxRecordsPerParent ?? DEFAULT_MAX_RECORDS
    this.terminalRetentionMs = options.terminalRetentionMs ?? DEFAULT_RETENTION_MS
    this.now = options.now ?? (() => Date.now())
  }

  /** 登记一个新运行；childId 必须全局唯一。 */
  register(parentId: string, childId: string, pid?: number): RunRecord {
    this.cleanup()
    const existing = this.byId.get(childId)
    if (existing !== undefined) return existing
    const record: RunRecord = {
      childId,
      parentId,
      state: 'starting',
      startedAt: this.now(),
      ...(pid === undefined ? {} : { pid }),
      activity: [],
    }
    this.byId.set(childId, record)
    const group = this.byParent.get(parentId)
    if (group === undefined) this.byParent.set(parentId, [record])
    else group.push(record)
    this.enforceLimit(parentId)
    return record
  }

  /** 标记 `init` 已到达，进入 running。 */
  markReady(record: RunRecord): void {
    if (record.state !== 'starting') return
    const at = this.now()
    record.state = 'running'
    record.readyAt = at
    record.lastActivityAt = at
    record.lastEventKind = 'init'
    this.pushActivity(record, { at, kind: 'init', summary: 'AGY ready' })
  }

  /** 记录一条协议事件/生命周期活动。 */
  recordActivity(
    record: RunRecord,
    kind: Exclude<ActivityKind, 'stderr'>,
    data: {
      summary?: string
      stepIndex?: number
      stepState?: string
      toolName?: string
      text?: string
    } = {},
  ): void {
    if (record.state === 'completed' || record.state === 'failed' || record.state === 'cancelled') return
    const at = this.now()
    if (kind !== 'lifecycle' || record.state === 'running') {
      record.lastActivityAt = at
      record.lastEventKind = protocolEventKind(kind)
    }
    if (data.stepIndex !== undefined) record.stepIndex = data.stepIndex
    if (data.stepState !== undefined) record.stepState = data.stepState
    if (data.toolName !== undefined) record.toolName = data.toolName
    if (data.text !== undefined) record.lastText = clip(data.text, 200)
    const summary = clip(data.summary ?? data.text ?? kind, 160)
    const last = record.activity[record.activity.length - 1]
    if (kind === 'text' && last?.kind === 'text') {
      // 连续 text_delta 只更新最后一条，避免 20 个槽位被 token 填满。
      const merged: ActivityEntry = {
        seq: last.seq,
        at,
        kind,
        summary,
        ...(last.stepIndex === undefined ? {} : { stepIndex: last.stepIndex }),
        ...(last.stepState === undefined ? {} : { stepState: last.stepState }),
        ...(last.toolName === undefined ? {} : { toolName: last.toolName }),
        ...(data.text === undefined ? {} : { text: clip(data.text, 200) }),
      }
      record.activity[record.activity.length - 1] = merged
      return
    }
    this.pushActivity(record, {
      at,
      kind,
      summary,
      ...(data.stepIndex === undefined ? {} : { stepIndex: data.stepIndex }),
      ...(data.stepState === undefined ? {} : { stepState: data.stepState }),
      ...(data.toolName === undefined ? {} : { toolName: data.toolName }),
      ...(data.text === undefined ? {} : { text: clip(data.text, 200) }),
    })
  }

  /** 记录 stderr 诊断；不重置静默计时，也不进入活动环。 */
  recordStderr(record: RunRecord, summary: string): void {
    if (record.state === 'completed' || record.state === 'failed' || record.state === 'cancelled') return
    record.lastEventKind = 'stderr'
    void summary
  }

  /** 记录终态；重复调用无副作用。 */
  recordTerminal(
    record: RunRecord,
    state: 'completed' | 'failed' | 'cancelled',
    info: { stopReason?: string; failureCategory?: FailureCategory; summary?: string } = {},
  ): void {
    if (record.state === 'completed' || record.state === 'failed' || record.state === 'cancelled') return
    const at = this.now()
    record.state = state
    record.endedAt = at
    record.stopReason = info.stopReason
    record.failureCategory = info.failureCategory
    record.lastActivityAt = at
    record.lastEventKind = 'lifecycle'
    this.pushActivity(record, {
      at,
      kind: 'lifecycle',
      summary: clip(info.summary ?? `run ${state}`, 160),
    })
    this.armCleanup(record)
    this.enforceLimit(record.parentId)
  }

  /** 请求取消；只登记请求，不直接改终态。 */
  requestCancel(parentId: string, childId: string): CancelReceipt {
    this.cleanup()
    const record = this.byId.get(childId)
    if (record === undefined || record.parentId !== parentId) {
      return { accepted: false, reason: 'not-found' }
    }
    if (record.state === 'completed' || record.state === 'failed' || record.state === 'cancelled') {
      return { accepted: false, reason: 'already-ended' }
    }
    if (record.cancelRequestedAt !== undefined) {
      return { accepted: false, reason: 'already-requested', requestedAt: record.cancelRequestedAt }
    }
    const at = this.now()
    record.cancelRequestedAt = at
    return { accepted: true, reason: 'accepted', requestedAt: at }
  }

  /** 生成状态快照；childId 指定时做父级隔离。 */
  status(parentId: string, childId?: string): StatusSnapshot {
    this.cleanup()
    const generatedAt = new Date(this.now()).toISOString()
    if (childId !== undefined) {
      const record = this.byId.get(childId)
      if (record === undefined || record.parentId !== parentId) {
        return { action: 'status', generatedAt, found: false, runs: [] }
      }
      return { action: 'status', generatedAt, found: true, runs: [this.view(record)] }
    }
    const runs = (this.byParent.get(parentId) ?? [])
      .slice()
      .sort((a, b) => b.startedAt - a.startedAt)
      .map(record => this.view(record))
    return { action: 'status', generatedAt, found: true, runs }
  }

  /** 停止全部计时器、终止未结算运行并清空登记表。 */
  async dispose(): Promise<void> {
    for (const timer of this.timers.values()) clearTimeout(timer)
    this.timers.clear()
    const records = [...this.byId.values()]
    await Promise.allSettled(
      records
        .filter(record => record.state === 'starting' || record.state === 'running')
        .map(record => record.teardown?.()),
    )
    this.byId.clear()
    this.byParent.clear()
  }

  /** 删除终态记录（测试与惰性清理共用）。 */
  remove(record: RunRecord): void {
    const timer = this.timers.get(record.childId)
    if (timer !== undefined) {
      clearTimeout(timer)
      this.timers.delete(record.childId)
    }
    if (this.byId.get(record.childId) !== record) return
    this.byId.delete(record.childId)
    const group = this.byParent.get(record.parentId)
    if (group === undefined) return
    const index = group.indexOf(record)
    if (index !== -1) group.splice(index, 1)
    if (group.length === 0) this.byParent.delete(record.parentId)
  }

  private pushActivity(record: RunRecord, entry: Omit<ActivityEntry, 'seq'>): void {
    const seq = record.activity.length === 0 ? 1 : record.activity[record.activity.length - 1]!.seq + 1
    record.activity.push({ seq, ...entry })
    while (record.activity.length > this.activityLimit) record.activity.shift()
  }

  private armCleanup(record: RunRecord): void {
    const existing = this.timers.get(record.childId)
    if (existing !== undefined) clearTimeout(existing)
    const timer = setTimeout(() => {
      this.timers.delete(record.childId)
      this.remove(record)
    }, this.terminalRetentionMs)
    timer.unref?.()
    this.timers.set(record.childId, timer)
  }

  private cleanup(): void {
    const now = this.now()
    for (const record of [...this.byId.values()]) {
      if (
        record.endedAt !== undefined &&
        now - record.endedAt >= this.terminalRetentionMs
      ) {
        this.remove(record)
      }
    }
  }

  private enforceLimit(parentId: string): void {
    const group = this.byParent.get(parentId)
    if (group === undefined) return
    while (group.length > this.maxRecordsPerParent) {
      const index = group.findIndex(record => record.endedAt !== undefined && record.state !== 'starting' && record.state !== 'running')
      if (index === -1) break
      this.remove(group[index]!)
    }
  }

  private view(record: RunRecord): RunView {
    const now = this.now()
    return {
      childId: record.childId,
      state: record.state,
      startedAt: new Date(record.startedAt).toISOString(),
      readyAt: record.readyAt === undefined ? null : new Date(record.readyAt).toISOString(),
      endedAt: record.endedAt === undefined ? null : new Date(record.endedAt).toISOString(),
      elapsedMs: Math.max(0, (record.endedAt ?? now) - record.startedAt),
      lastActivityAt: record.lastActivityAt === undefined ? null : new Date(record.lastActivityAt).toISOString(),
      lastEventKind: record.lastEventKind ?? null,
      pid: record.pid ?? null,
      conversationId: record.conversationId ?? null,
      stepIndex: record.stepIndex ?? null,
      stepState: record.stepState ?? null,
      toolName: record.toolName ?? null,
      lastText: record.lastText ?? null,
      stopReason: record.stopReason ?? null,
      failureCategory: record.failureCategory ?? null,
      cancelRequestedAt: record.cancelRequestedAt === undefined ? null : new Date(record.cancelRequestedAt).toISOString(),
      activity: record.activity.map(entry => ({
        seq: entry.seq,
        at: new Date(entry.at).toISOString(),
        kind: entry.kind,
        summary: entry.summary,
        ...(entry.stepIndex === undefined ? {} : { stepIndex: entry.stepIndex }),
        ...(entry.stepState === undefined ? {} : { stepState: entry.stepState }),
        ...(entry.toolName === undefined ? {} : { toolName: entry.toolName }),
        ...(entry.text === undefined ? {} : { text: entry.text }),
      })),
    }
  }
}

let defaultRegistry: RunRegistry | undefined

/** 取提供方与工具共用的默认登记表。 */
export function getDefaultRunRegistry(): RunRegistry {
  defaultRegistry ??= new RunRegistry()
  return defaultRegistry
}

/** 替换默认登记表（插件 apply 与测试使用）。 */
export function setDefaultRunRegistry(registry: RunRegistry | undefined): void {
  defaultRegistry = registry
}
