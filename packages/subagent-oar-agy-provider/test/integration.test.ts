
import { chmodSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { ResolvedSubagentStartRequest, SubagentProvider } from '@deepseek-ai/dsh-subagent'
import { startAgyRun, type AgyRunSpec } from '../src/run.js'
import { apply, type Config } from '../src/index.js'
import { RunRegistry } from '../src/runs.js'

const fixture = fileURLToPath(new URL('./fixtures/fake-agy.mjs', import.meta.url))

beforeAll(() => {
  chmodSync(fixture, 0o755)
})

function request(overrides: Partial<ResolvedSubagentStartRequest> = {}): ResolvedSubagentStartRequest {
  return {
    cwd: process.cwd(),
    prompt: [{ type: 'text', text: 'reply with FAKE_OK' }] as ContentBlock[],
    parent: { id: 'parent' } as never,
    signal: new AbortController().signal,
    ...overrides,
  }
}

function spec(env: Record<string, string | null> = {}, overrides: Partial<AgyRunSpec> = {}): AgyRunSpec {
  return {
    providerName: 'agy',
    command: fixture,
    permissionMode: 'yolo',
    locale: 'en',
    killGraceMs: 150,
    env,
    ...overrides,
  }
}

describe('startAgyRun', () => {
  it('completes on a SUCCESS result and returns the final response', async () => {
    const run = await startAgyRun(request(), spec())
    const result = await run.result
    expect(result.stopReason).toBe('completed')
    expect(result.output.map(block => (block.type === 'text' ? block.text : '')).join('')).toContain('FAKE_OK')
    await run.dispose()
  })

  it('settles an ERROR result as a categorized failure', async () => {
    const run = await startAgyRun(request(), spec({ FAKE_AGY_MODE: 'error-result' }))
    const result = await run.result
    expect(result.stopReason).toBe('error')
    expect(result.diagnostic).toBeTruthy()
    await run.dispose()
  })

  it('classifies authentication failures', async () => {
    const run = await startAgyRun(request(), spec({ FAKE_AGY_MODE: 'auth-failure' }))
    const result = await run.result
    expect(result.stopReason).toBe('error')
    expect(result.diagnostic).toContain('sign in')
    await run.dispose()
  })

  it('classifies malformed output as a protocol failure', async () => {
    const run = await startAgyRun(request(), spec({ FAKE_AGY_MODE: 'malformed' }))
    const result = await run.result
    expect(result.stopReason).toBe('error')
    expect(result.diagnostic).toContain('could not be parsed')
    await run.dispose()
  })


  it('settles a crash without a result as a protocol failure', async () => {
    const run = await startAgyRun(request(), spec({ FAKE_AGY_MODE: 'crash-no-result' }))
    const result = await run.result
    expect(result.stopReason).toBe('error')
    expect(result.diagnostic).toContain('could not be parsed')
    await run.dispose()
  })

  it('keeps partial output separate from the failure diagnostic', async () => {
    const run = await startAgyRun(request(), spec({ FAKE_AGY_MODE: 'partial' }))
    const result = await run.result
    expect(result.stopReason).toBe('error')
    expect(JSON.stringify(result.output)).toContain('partial text')
    expect(result.diagnostic).toBeTruthy()
    await run.dispose()
  })

  it('surfaces an automatic permission denial in plan/strict mode', async () => {
    const run = await startAgyRun(request(), spec({ FAKE_AGY_MODE: 'denied' }, { permissionMode: 'strict', locale: 'zh' }))
    const result = await run.result
    expect(result.stopReason).toBe('completed')
    const text = JSON.stringify(result.output)
    expect(text).toContain('权限档 strict')
    expect(text).toContain('write_file')
    await run.dispose()
  })

  it('times out after the configured limit', async () => {
    const run = await startAgyRun(request(), spec({ FAKE_AGY_MODE: 'slow' }, { timeoutMs: 200, locale: 'zh' }))
    const result = await run.result
    expect(result.stopReason).toBe('error')
    expect(result.diagnostic).toContain('超时')
    await run.dispose()
  })

  it('settles as aborted when the parent aborts', async () => {
    const controller = new AbortController()
    const run = await startAgyRun(request({ signal: controller.signal }), spec({ FAKE_AGY_MODE: 'slow' }))
    controller.abort()
    const result = await run.result
    expect(result.stopReason).toBe('aborted')
    await run.dispose()
  })

  it('rejects a non-text prompt before spawning', async () => {
    const prompt = [{ type: 'image', source: { type: 'base64', mediaType: 'image/png', data: '' } }] as unknown as ContentBlock[]
    await expect(startAgyRun(request({ prompt }), spec())).rejects.toMatchObject({ category: 'protocol' })
  })

  it('rejects when the signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(startAgyRun(request({ signal: controller.signal }), spec())).rejects.toMatchObject({ category: 'cancelled' })
  })

  it('runs concurrent delegations without cross-talk', async () => {
    const first = await startAgyRun(request(), spec({ FAKE_AGY_TEXT: 'RUN_A' }))
    const second = await startAgyRun(request(), spec({ FAKE_AGY_TEXT: 'RUN_B' }))
    const [a, b] = await Promise.all([first.result, second.result])
    expect(a.stopReason).toBe('completed')
    expect(b.stopReason).toBe('completed')
    expect(JSON.stringify(a.output)).toContain('RUN_A')
    expect(JSON.stringify(b.output)).toContain('RUN_B')
    expect(JSON.stringify(a.output)).not.toContain('RUN_B')
    await Promise.all([first.dispose(), second.dispose()])
  })
})


describe('observability and watchdogs', () => {
  it('fails a run that never becomes ready with startup-timeout', async () => {
    const registry = new RunRegistry()
    const run = await startAgyRun(request(), spec({ FAKE_AGY_MODE: 'no-init' }, { startupTimeoutMs: 300, registry }))
    const result = await run.result
    expect(result.stopReason).toBe('error')
    expect(registry.status('parent', String(run.id)).runs[0]).toMatchObject({ state: 'failed', failureCategory: 'startup-timeout' })
    await run.dispose()
  })

  it('fails a silent run with stalled after ready', async () => {
    const registry = new RunRegistry()
    const run = await startAgyRun(request(), spec({ FAKE_AGY_MODE: 'silent' }, { startupTimeoutMs: 1000, stallTimeoutMs: 300, registry }))
    const result = await run.result
    expect(result.stopReason).toBe('error')
    const view = registry.status('parent', String(run.id)).runs[0]
    expect(view).toMatchObject({ state: 'failed', failureCategory: 'stalled' })
    expect(view.activity.some(entry => entry.kind === 'init')).toBe(true)
    await run.dispose()
  })

  it('prefers absolute timeout when it competes with the stall window', async () => {
    const registry = new RunRegistry()
    const run = await startAgyRun(request(), spec({ FAKE_AGY_MODE: 'slow' }, { timeoutMs: 200, stallTimeoutMs: 200, registry }))
    const result = await run.result
    expect(result.stopReason).toBe('error')
    expect(registry.status('parent', String(run.id)).runs[0].failureCategory).toBe('timeout')
    await run.dispose()
  })

  it('exposes status and bounded activity through the registry', async () => {
    const registry = new RunRegistry()
    const run = await startAgyRun(request(), spec({}, { registry }))
    await run.result
    const view = registry.status('parent', String(run.id)).runs[0]
    expect(view).toMatchObject({ state: 'completed', stopReason: 'completed' })
    expect(view.pid).toBeTypeOf('number')
    expect(view.activity.map(entry => entry.kind)).toContain('init')
    expect(view.activity.map(entry => entry.kind)).toContain('text')
    expect(view.activity.map(entry => entry.kind)).toContain('result')
    await run.dispose()
  })

  it('records an explicit cancellation without leaking the parent prompt', async () => {
    const registry = new RunRegistry()
    const controller = new AbortController()
    const run = await startAgyRun(request({ signal: controller.signal }), spec({ FAKE_AGY_MODE: 'slow' }, { registry }))
    expect(registry.requestCancel('parent', String(run.id))).toMatchObject({ accepted: true })
    controller.abort()
    const result = await run.result
    expect(result.stopReason).toBe('aborted')
    const cancelledView = registry.status('parent', String(run.id)).runs[0]
    expect(cancelledView.state).toBe('cancelled')
    expect(cancelledView.failureCategory).toBeNull()
    await run.dispose()
  })

  it('scrubs credential-shaped and DSH_* variables from the child environment', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'agy-env-'))
    const dump = join(dir, 'env.json')
    const saved = {
      DSH_TEST_SECRET_CANARY: process.env.DSH_TEST_SECRET_CANARY,
      TEST_API_KEY: process.env.TEST_API_KEY,
      SERVICE_TOKEN: process.env.SERVICE_TOKEN,
      REMOVE_ME: process.env.REMOVE_ME,
    }
    process.env.DSH_TEST_SECRET_CANARY = 'CANARY_DO_NOT_LEAK'
    process.env.TEST_API_KEY = 'API_KEY_DO_NOT_LEAK'
    process.env.SERVICE_TOKEN = 'SERVICE_TOKEN_DO_NOT_LEAK'
    process.env.REMOVE_ME = 'PARENT_ONLY'
    try {
      const run = await startAgyRun(request(), spec({ FAKE_AGY_MODE: 'env-dump', FAKE_AGY_ENV_DUMP_FILE: dump, EXPLICIT: 'yes', REMOVE_ME: null }))
      const result = await run.result
      expect(result.stopReason).toBe('completed')
      const child = JSON.parse(readFileSync(dump, 'utf8')) as Record<string, string>
      expect(child.DSH_TEST_SECRET_CANARY).toBeUndefined()
      expect(child.TEST_API_KEY).toBeUndefined()
      expect(child.SERVICE_TOKEN).toBeUndefined()
      expect(child.EXPLICIT).toBe('yes')
      expect(child.REMOVE_ME).toBeUndefined()
      expect(child.PATH).toBeTruthy()
      expect(child.HOME).toBeTruthy()
      await run.dispose()
    } finally {
      for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('keeps raw sensitive stderr out of parent diagnostics and redacts the local log', async () => {
    const logs: string[] = []
    const saved = process.env.DSH_TEST_SECRET_CANARY
    process.env.DSH_TEST_SECRET_CANARY = 'CANARY_DO_NOT_LEAK'
    try {
      const run = await startAgyRun(request(), spec({ FAKE_AGY_MODE: 'sensitive-stderr' }, { debugLog: message => logs.push(message) }))
      const result = await run.result
      expect(result.stopReason).toBe('error')
      expect(result.diagnostic ?? '').not.toContain('CANARY_DO_NOT_LEAK')
      expect(result.diagnostic ?? '').not.toContain('Authorization')
      expect(logs.join('\n')).not.toContain('CANARY_DO_NOT_LEAK')
      await run.dispose()
    } finally {
      if (saved === undefined) delete process.env.DSH_TEST_SECRET_CANARY
      else process.env.DSH_TEST_SECRET_CANARY = saved
    }
  })

  it('rejects invalid integer watchdog configuration', () => {
    const ctx = { subagents: { registerProvider: () => () => {} }, logger: { warn: () => {} } }
    expect(() => apply(ctx as never, { activityLimit: 21 } as Config)).toThrow(/activityLimit/)
    expect(() => apply(ctx as never, { maxRecordsPerParent: 51 } as Config)).toThrow(/maxRecordsPerParent/)
    expect(() => apply(ctx as never, { startupTimeoutMs: 1.5 } as Config)).toThrow(/startupTimeoutMs/)
  })



  it('terminates the AGY process tree after a stall timeout', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'agy-tree-timeout-'))
    const pidFile = join(dir, 'tree.pid')
    const registry = new RunRegistry()
    const run = await startAgyRun(request(), spec({ FAKE_AGY_MODE: 'tree', FAKE_AGY_TREE_PID_FILE: pidFile }, { startupTimeoutMs: 1000, stallTimeoutMs: 300, killGraceMs: 100, registry }))
    for (let i = 0; i < 40 && !existsSync(pidFile); i += 1) await delay(25)
    const childPid = Number(readFileSync(pidFile, 'utf8'))
    const result = await run.result
    expect(result.stopReason).toBe('error')
    await delay(500)
    expect(() => process.kill(childPid, 0)).toThrow()
    const parentPid = registry.status('parent', String(run.id)).runs[0]?.pid
    expect(parentPid).toBeTypeOf('number')
    expect(() => process.kill(parentPid, 0)).toThrow()
    await run.dispose()
    rmSync(dir, { recursive: true, force: true })
  })

  it('keeps concurrent normal, startup-stuck and silent runs independent', async () => {
    const registry = new RunRegistry()
    const [normal, startup, silent] = await Promise.all([
      startAgyRun(request(), spec({ FAKE_AGY_MODE: 'success' }, { registry })),
      startAgyRun(request(), spec({ FAKE_AGY_MODE: 'no-init' }, { startupTimeoutMs: 300, registry })),
      startAgyRun(request(), spec({ FAKE_AGY_MODE: 'silent' }, { startupTimeoutMs: 1000, stallTimeoutMs: 300, registry })),
    ])
    const [a, b, c] = await Promise.all([normal.result, startup.result, silent.result])
    expect(a.stopReason).toBe('completed')
    expect(b.stopReason).toBe('error')
    expect(c.stopReason).toBe('error')
    const views = registry.status('parent').runs
    expect(views).toHaveLength(3)
    expect(views.map(view => view.state).sort()).toEqual(['completed', 'failed', 'failed'])
    await Promise.all([normal.dispose(), startup.dispose(), silent.dispose()])
  })


  it('keeps multi-step activity bounded and expires terminal records after TTL', async () => {
    let now = Date.now()
    const registry = new RunRegistry({ now: () => now, terminalRetentionMs: 100 })
    const run = await startAgyRun(request(), spec({ FAKE_AGY_MODE: 'multi-step' }, { registry }))
    await run.result
    const view = registry.status('parent', String(run.id)).runs[0]
    expect(view.activity.length).toBeGreaterThanOrEqual(3)
    expect(view.activity.length).toBeLessThanOrEqual(20)
    now += 101
    expect(registry.status('parent').runs).toEqual([])
    await run.dispose()
  })

  it('reports a running slow run before it completes', async () => {
    const registry = new RunRegistry()
    const controller = new AbortController()
    const run = await startAgyRun(request({ signal: controller.signal }), spec({ FAKE_AGY_MODE: 'slow' }, { registry }))
    let view = registry.status('parent', String(run.id)).runs[0]
    for (let i = 0; i < 40 && view.lastActivityAt === null; i += 1) {
      await delay(25)
      view = registry.status('parent', String(run.id)).runs[0]
    }
    expect(['starting', 'running']).toContain(view.state)
    expect(view.pid).toBeTypeOf('number')
    expect(view.lastActivityAt).toBeTruthy()
    controller.abort()
    await run.result
    view = registry.status('parent', String(run.id)).runs[0]
    expect(view.state).toBe('cancelled')
    await run.dispose()
  })

  it('cancels a slow run through the registry request and parent abort', async () => {
    const registry = new RunRegistry()
    const controller = new AbortController()
    const run = await startAgyRun(request({ signal: controller.signal }), spec({ FAKE_AGY_MODE: 'slow' }, { registry }))
    expect(registry.requestCancel('parent', String(run.id))).toMatchObject({ accepted: true, reason: 'accepted' })
    controller.abort()
    const result = await run.result
    expect(result.stopReason).toBe('aborted')
    expect(registry.status('parent', String(run.id)).runs[0].state).toBe('cancelled')
    expect(registry.status('parent', String(run.id)).runs[0].failureCategory).toBeNull()
    expect(registry.requestCancel('parent', String(run.id))).toMatchObject({ accepted: false, reason: 'already-ended' })
    await run.dispose()
  })

  it('settles only one terminal state when cancel races with the absolute timeout', async () => {
    const registry = new RunRegistry()
    const controller = new AbortController()
    const run = await startAgyRun(request({ signal: controller.signal }), spec({ FAKE_AGY_MODE: 'slow' }, { timeoutMs: 100, registry }))
    controller.abort()
    const result = await run.result
    expect(['aborted', 'error']).toContain(result.stopReason)
    const view = registry.status('parent', String(run.id)).runs[0]
    expect(['cancelled', 'failed']).toContain(view.state)
    expect(registry.status('parent', String(run.id)).runs).toHaveLength(1)
    await run.dispose()
  })

  it('returns actionable not-authenticated diagnostics after env scrubbing', async () => {
    const registry = new RunRegistry()
    const run = await startAgyRun(request(), spec({ FAKE_AGY_MODE: 'auth-failure' }, { registry }))
    const result = await run.result
    expect(result.stopReason).toBe('error')
    expect(result.diagnostic).toContain('sign in')
    expect(registry.status('parent', String(run.id)).runs[0].failureCategory).toBe('not-authenticated')
    await run.dispose()
  })

  it('terminates an active AGY process tree when the plugin effect is disposed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'agy-tree-'))
    const pidFile = join(dir, 'tree.pid')
    let cleanup: (() => Promise<void>) | undefined
    let provider: SubagentProvider | undefined
    const ctx = {
      subagents: { registerProvider: (candidate: SubagentProvider) => { provider = candidate; return () => {} } },
      logger: { warn: () => {} },
      effect(fn: () => () => Promise<void>) { cleanup = fn() },
    }
    apply(ctx as never, {
      command: fixture,
      startupTimeoutMs: 1000,
      stallTimeoutMs: 5000,
      killGraceMs: 200,
      env: { FAKE_AGY_MODE: 'tree', FAKE_AGY_TREE_PID_FILE: pidFile },
    } as Config)
    const run = await provider!.start!(request())
    for (let i = 0; i < 40 && !existsSync(pidFile); i += 1) await delay(25)
    const childPid = Number(readFileSync(pidFile, 'utf8'))
    expect(childPid).toBeGreaterThan(0)
    await cleanup?.()
    await delay(500)
    expect(() => process.kill(childPid, 0)).toThrow()
    await run.dispose()
    rmSync(dir, { recursive: true, force: true })
  })

  it('stops timers and terminates active runs when the plugin effect is disposed', async () => {
    let cleanup: (() => Promise<void>) | undefined
    const ctx = {
      subagents: { registerProvider: () => () => {} },
      logger: { warn: () => {} },
      effect(fn: () => () => Promise<void>) { cleanup = fn() },
    }
    apply(ctx as never, { startupTimeoutMs: 60_000, stallTimeoutMs: 900_000 } as Config)
    expect(typeof cleanup).toBe('function')
    await cleanup?.()
  })
})

describe('apply', () => {
  it('registers a one-shot provider with no start capabilities', () => {
    let captured: SubagentProvider | undefined
    const ctx = {
      subagents: { registerProvider: (provider: SubagentProvider) => { captured = provider; return () => {} } },
      logger: { warn: () => {} },
    }
    apply(ctx as never, {} as Config)
    expect(captured?.name).toBe('agy')
    expect(captured?.inheritsParentContext).toBe(false)
    expect(captured?.capabilities).toEqual({
      agentOptions: false,
      agentPreset: false,
      outputSchema: false,
      depthLimit: false,
    })
    expect(typeof captured?.start).toBe('function')
    expect(captured && 'prepareContinuable' in captured).toBe(false)
  })

  it('rejects an unknown permission mode', () => {
    const ctx = { subagents: { registerProvider: () => () => {} }, logger: { warn: () => {} } }
    expect(() => apply(ctx as never, { permissionMode: 'nope' } as unknown as Config)).toThrow(/permissionMode/)
  })
})
