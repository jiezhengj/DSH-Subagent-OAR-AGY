import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { RunRegistry } from '../src/runs.js'

const statusSchema = JSON.parse(readFileSync(new URL('../../../specs/003-agy-observability-control/contracts/run-status.schema.json', import.meta.url), 'utf8')) as any

function assertStatusSchema(snapshot: any): void {
  const props = statusSchema.properties
  const runSchema = statusSchema.$defs.run
  const activitySchema = statusSchema.$defs.activity
  expect(Object.keys(snapshot).every(key => key in props)).toBe(true)
  for (const key of statusSchema.required) expect(snapshot).toHaveProperty(key)
  expect(snapshot.action).toBe('status')
  expect(snapshot.runs.length).toBeLessThanOrEqual(props.runs.maxItems)
  for (const run of snapshot.runs) {
    expect(Object.keys(run).every(key => key in runSchema.properties)).toBe(true)
    for (const key of runSchema.required) expect(run).toHaveProperty(key)
    expect(runSchema.properties.state.enum).toContain(run.state)
    if (run.lastEventKind !== null) expect(runSchema.properties.lastEventKind.enum).toContain(run.lastEventKind)
    if (run.failureCategory !== null) expect(runSchema.properties.failureCategory.enum).toContain(run.failureCategory)
    if (run.lastText !== null) expect(run.lastText.length).toBeLessThanOrEqual(runSchema.properties.lastText.maxLength)
    expect(run.activity.length).toBeLessThanOrEqual(runSchema.properties.activity.maxItems)
    for (const entry of run.activity) {
      expect(Object.keys(entry).every(key => key in activitySchema.properties)).toBe(true)
      for (const key of activitySchema.required) expect(entry).toHaveProperty(key)
      expect(activitySchema.properties.kind.enum).toContain(entry.kind)
      expect(entry.summary.length).toBeLessThanOrEqual(activitySchema.properties.summary.maxLength)
      if (entry.text !== undefined) expect(entry.text.length).toBeLessThanOrEqual(activitySchema.properties.text.maxLength)
    }
  }
}

function registry(now = () => 1_000): RunRegistry {
  return new RunRegistry({ now, activityLimit: 20, maxRecordsPerParent: 50, terminalRetentionMs: 300_000 })
}

describe('RunRegistry', () => {
  it('moves a run from starting to running to completed and exposes a bounded snapshot', () => {
    const r = registry()
    const record = r.register('parent-a', 'child-a', 1234)
    const starting = r.status('parent-a', 'child-a')
    expect(starting.action).toBe('status')
    expect(starting.found).toBe(true)
    expect(starting.runs[0]).toMatchObject({ childId: 'child-a', state: 'starting', pid: 1234, readyAt: null })
    r.markReady(record)
    r.recordActivity(record, 'text', { text: 'hello', stepIndex: 2, stepState: 'ACTIVE', toolName: 'run_command' })
    const running = r.status('parent-a', 'child-a')
    expect(running.runs[0]).toMatchObject({ state: 'running', lastEventKind: 'step_update', lastText: 'hello', stepIndex: 2, stepState: 'ACTIVE', toolName: 'run_command' })
    expect(running.runs[0].readyAt).toBeTruthy()
    r.recordTerminal(record, 'completed', { stopReason: 'completed', summary: 'done' })
    const completed = r.status('parent-a', 'child-a')
    expect(completed.runs[0]).toMatchObject({ state: 'completed', stopReason: 'completed', failureCategory: null })
    expect(completed.runs[0].endedAt).toBeTruthy()
  })

  it('keeps parents isolated and returns an empty list for a parent without runs', () => {
    const r = registry()
    r.register('parent-a', 'child-a')
    const other = r.status('parent-b')
    expect(other).toMatchObject({ action: 'status', found: true, runs: [] })
    expect(r.status('parent-b', 'child-a')).toEqual({ action: 'status', generatedAt: expect.any(String), found: false, runs: [] })
    expect(r.status('parent-a', 'missing')).toEqual({ action: 'status', generatedAt: expect.any(String), found: false, runs: [] })
  })

  it('records cancellation receipts idempotently without changing terminal state', () => {
    const r = registry()
    r.register('parent-a', 'child-a')
    const first = r.requestCancel('parent-a', 'child-a')
    expect(first).toMatchObject({ accepted: true, reason: 'accepted' })
    expect(r.requestCancel('parent-a', 'child-a')).toMatchObject({ accepted: false, reason: 'already-requested' })
    expect(r.requestCancel('parent-b', 'child-a')).toMatchObject({ accepted: false, reason: 'not-found' })
    const record = r.status('parent-a', 'child-a').runs[0]
    expect(record.cancelRequestedAt).toBeTruthy()
  })

  it('keeps only the configured activity limit and coalesces consecutive text', () => {
    const r = new RunRegistry({ now: () => 1_000, activityLimit: 3 })
    const record = r.register('p', 'c')
    r.markReady(record)
    r.recordActivity(record, 'text', { text: 'a' })
    r.recordActivity(record, 'text', { text: 'b' })
    r.recordActivity(record, 'step', { summary: 'step 1' })
    r.recordActivity(record, 'tool', { toolName: 'x', summary: 'tool x' })
    const view = r.status('p', 'c').runs[0]
    expect(view.activity).toHaveLength(3)
    expect(view.activity.map(entry => entry.kind)).toEqual(['text', 'step', 'tool'])
    expect(view.activity.map(entry => entry.seq)).toEqual([2, 3, 4])
    expect(view.lastText).toBe('b')
    r.recordActivity(record, 'text', { text: 'x'.repeat(500) })
    expect(r.status('p', 'c').runs[0].lastText).toHaveLength(200)
  })

  it('evicts the oldest terminal record after the per-parent limit and expires TTL', () => {
    let now = 1_000
    const r = new RunRegistry({ now: () => now, maxRecordsPerParent: 2, terminalRetentionMs: 500 })
    const a = r.register('p', 'a')
    now += 1
    const b = r.register('p', 'b')
    now += 1
    const c = r.register('p', 'c')
    r.recordTerminal(a, 'completed')
    r.recordTerminal(b, 'completed')
    r.recordTerminal(c, 'completed')
    expect(r.status('p').runs.map(run => run.childId)).toEqual(['c', 'b'])
    now += 500
    expect(r.status('p').runs).toEqual([])
  })

  it('disposes timers, terminates active runs and clears the registry', async () => {
    const r = registry()
    const teardown = vi.fn(async () => {})
    const record = r.register('p', 'c')
    record.teardown = teardown
    await r.dispose()
    expect(teardown).toHaveBeenCalledTimes(1)
    expect(r.status('p').runs).toEqual([])
  })

  it('does not reset lastActivityAt for stderr noise', () => {
    let now = 100
    const r = new RunRegistry({ now: () => now })
    const record = r.register('p', 'c')
    r.markReady(record)
    const activityAt = r.status('p', 'c').runs[0].lastActivityAt
    now = 200
    r.recordStderr(record, 'noise')
    const view = r.status('p', 'c').runs[0]
    expect(view.lastActivityAt).toBe(activityAt)
    expect(view.lastEventKind).toBe('stderr')
  })
  it('maps every activity kind to a contract-valid lastEventKind', () => {
    const r = registry()
    const record = r.register('p', 'c')
    r.markReady(record)
    expect(r.status('p', 'c').runs[0].lastEventKind).toBe('init')
    r.recordActivity(record, 'step', { summary: 'step' })
    expect(r.status('p', 'c').runs[0].lastEventKind).toBe('step_update')
    r.recordActivity(record, 'tool', { toolName: 'x' })
    expect(r.status('p', 'c').runs[0].lastEventKind).toBe('step_update')
    r.recordActivity(record, 'text', { text: 'x' })
    expect(r.status('p', 'c').runs[0].lastEventKind).toBe('step_update')
    r.recordActivity(record, 'result', { summary: 'done' })
    expect(r.status('p', 'c').runs[0].lastEventKind).toBe('result')
    r.recordStderr(record, 'noise')
    expect(r.status('p', 'c').runs[0].lastEventKind).toBe('stderr')
    r.recordTerminal(record, 'cancelled', { stopReason: 'aborted' })
    const view = r.status('p', 'c').runs[0]
    expect(view.lastEventKind).toBe('lifecycle')
    expect(view.failureCategory).toBeNull()
    assertStatusSchema(r.status('p'))
  })

  it('keeps status snapshots within the contract schema for live, failed and cancelled runs', () => {
    const r = registry()
    const live = r.register('p', 'live', 42)
    assertStatusSchema(r.status('p'))
    r.markReady(live)
    r.recordActivity(live, 'tool', { toolName: 'run_command', stepIndex: 1 })
    assertStatusSchema(r.status('p', 'live'))
    r.recordTerminal(live, 'failed', { stopReason: 'error', failureCategory: 'timeout' })
    assertStatusSchema(r.status('p'))
    const cancelled = r.register('p', 'cancelled')
    r.requestCancel('p', 'cancelled')
    r.recordTerminal(cancelled, 'cancelled', { stopReason: 'aborted' })
    assertStatusSchema(r.status('p'))
  })
})
