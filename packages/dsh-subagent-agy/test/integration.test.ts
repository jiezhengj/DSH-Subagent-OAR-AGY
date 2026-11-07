
import { chmodSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import type { ResolvedSubagentStartRequest, SubagentProvider } from '@deepseek-ai/dsh-subagent'
import { startAgyRun, type AgyRunSpec } from '../src/run.js'
import { apply, type Config } from '../src/index.js'

const fixture = fileURLToPath(new URL('./fixtures/fake-agy.mjs', import.meta.url))

beforeAll(() => {
  chmodSync(fixture, 0o755)
})

function request(overrides: Partial<ResolvedSubagentStartRequest> = {}): ResolvedSubagentStartRequest {
  return {
    cwd: process.cwd(),
    prompt: [{ type: 'text', text: 'reply with FAKE_OK' }] as ContentBlock[],
    parent: {} as never,
    signal: new AbortController().signal,
    ...overrides,
  }
}

function spec(env: Record<string, string | null> = {}, overrides: Partial<AgyRunSpec> = {}): AgyRunSpec {
  return {
    providerName: 'agy',
    command: fixture,
    permissionMode: 'yolo',
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
    expect(result.diagnostic).toContain('登录')
    await run.dispose()
  })

  it('classifies malformed output as a protocol failure', async () => {
    const run = await startAgyRun(request(), spec({ FAKE_AGY_MODE: 'malformed' }))
    const result = await run.result
    expect(result.stopReason).toBe('error')
    expect(result.diagnostic).toContain('无法解析')
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
    const run = await startAgyRun(request(), spec({ FAKE_AGY_MODE: 'denied' }, { permissionMode: 'strict' }))
    const result = await run.result
    expect(result.stopReason).toBe('completed')
    const text = JSON.stringify(result.output)
    expect(text).toContain('权限档 strict')
    expect(text).toContain('write_file')
    await run.dispose()
  })

  it('times out after the configured limit', async () => {
    const run = await startAgyRun(request(), spec({ FAKE_AGY_MODE: 'slow' }, { timeoutMs: 200 }))
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
