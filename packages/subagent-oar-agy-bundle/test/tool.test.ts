import { describe, expect, it, vi } from 'vitest'
import { Config, createFallbackTool, mountTool, registerControlTool } from '@jiezhengj/subagent-oar-agy/tool'
import { RunRegistry } from '../../subagent-oar-agy-provider/src/runs.js'

/** 构造测试用的最小 Cordis 上下文。 */
function fakeContext() {
  const registered: Array<{ name: string; parameters: { properties: Record<string, { enum?: string[] }> } }> = []
  const activations: unknown[] = []
  const interrupts: unknown[] = []
  const plugin = vi.fn()
  const ctx = {
    logger: { warn: vi.fn() },
    plugin,
    tools: {
      register(definition: { name: string; parameters: { properties: Record<string, { enum?: string[] }> } }) {
        registered.push(definition)
        return () => {
          const index = registered.indexOf(definition)
          if (index >= 0) registered.splice(index, 1)
        }
      },
    },
    subagents: {
      getProvider: () => ({ inheritsParentContext: false }),
      interrupt(...args: unknown[]) { interrupts.push(args) },
      async startActivation(args: unknown) {
        activations.push(args)
        return { childId: 'child-1' }
      },
    },
  }
  return { ctx, registered, activations, interrupts, plugin }
}

const config = { providers: { agy: 'agy' }, toolName: 'subagent_oar_agy' }

describe('bundle tool entry', () => {
  it('defaults to the subagent_oar_agy tool name and accepts the official provider map', () => {
    const parsed = Config({ providers: { agy: 'agy' } }) as { toolName: string; providers: Record<string, string> }
    expect(parsed.toolName).toBe('subagent_oar_agy')
    expect(parsed.providers).toEqual({ agy: 'agy' })
  })

  it('mounts the official tool plugin when the official package resolves', async () => {
    const { ctx, plugin, registered } = fakeContext()
    const official = { apply: vi.fn(), inject: ['tools', 'subagents'] }
    await expect(mountTool(ctx, config, async () => official)).resolves.toBe('official')
    expect(plugin).toHaveBeenCalledWith(official, { providers: config.providers, toolName: config.toolName })
    expect(registered).toHaveLength(1)
    expect(registered[0].name).toBe('subagent_oar_agy_control')
  })

  it('falls back to the bundled tool when the official package is missing', async () => {
    const { ctx, registered, activations } = fakeContext()
    await expect(mountTool(ctx, config, async () => undefined)).resolves.toBe('fallback')
    expect(ctx.logger.warn).toHaveBeenCalled()
    expect(registered).toHaveLength(2)
    expect(registered[0].name).toBe('subagent_oar_agy')
    expect(registered[0].parameters.properties.runtime.enum).toEqual(['agy'])
    expect(registered[1].name).toBe('subagent_oar_agy_control')

    const definition = createFallbackTool(new Map([['agy', 'agy']]), 'subagent_oar_agy', ctx)
    const result = await definition.execute(
      { runtime: 'agy', description: 'demo', prompt: 'say OK' },
      { agent: { id: 'parent' }, signal: new AbortController().signal },
    )
    expect(result).toEqual({ kind: 'activation', subagentId: 'child-1' })
    expect(activations).toHaveLength(1)
    expect(activations[0]).toMatchObject({
      provider: 'agy',
      label: 'demo',
      request: { prompt: [{ type: 'text', text: 'say OK' }] },
      delivery: 'parent',
    })
  })

  it('rejects an empty provider map in the fallback path', async () => {
    const { ctx } = fakeContext()
    await expect(mountTool(ctx, { providers: {}, toolName: 'x' }, async () => undefined)).rejects.toThrow(
      /providers must contain at least one non-empty runtime alias/u,
    )
  })
  it('registers a control tool that returns status and cancel receipts for the current parent', async () => {
    const { ctx, registered, interrupts } = fakeContext()
    const registry = new RunRegistry({ now: () => 1_000 })
    const record = registry.register('parent-1', 'child-1', 42)
    registry.markReady(record)
    await mountTool(ctx, config, async () => undefined, registry)
    const control = registered.find(entry => entry.name === 'subagent_oar_agy_control') as {
      execute: (args: unknown, exec: unknown) => Promise<unknown>
    }
    await expect(control.execute({ action: 'status' }, { agent: { id: 'parent-1' }, signal: new AbortController().signal })).resolves.toMatchObject({
      action: 'status',
      found: true,
      runs: [{ childId: 'child-1', state: 'running', pid: 42 }],
    })
    await expect(control.execute({ action: 'status', childId: 'other' }, { agent: { id: 'parent-1' }, signal: new AbortController().signal })).resolves.toMatchObject({ found: false, runs: [] })
    registry.recordActivity(record, 'text', { text: 'PROMPT_SECRET not a full answer' })
    const bounded = await control.execute({ action: 'status' }, { agent: { id: 'parent-1' }, signal: new AbortController().signal }) as { runs: Array<{ lastText: string }> }
    expect(bounded.runs[0].lastText.length).toBeLessThanOrEqual(200)
    expect(bounded.runs[0]).not.toHaveProperty('output')
    expect(bounded.runs[0]).not.toHaveProperty('prompt')
    expect(bounded.runs[0]).not.toHaveProperty('toolArgs')
    await expect(control.execute({ action: 'cancel', childId: 'child-1' }, { agent: { id: 'parent-1' }, signal: new AbortController().signal })).resolves.toMatchObject({ action: 'cancel', accepted: true, reason: 'accepted', requestedAt: expect.any(String) })
    expect(interrupts).toHaveLength(1)
    await expect(control.execute({ action: 'cancel', childId: 'child-1' }, { agent: { id: 'parent-1' }, signal: new AbortController().signal })).resolves.toMatchObject({ action: 'cancel', accepted: true, reason: 'already-requested', requestedAt: expect.any(String) })
    expect(interrupts).toHaveLength(2)
    const missing = await control.execute({ action: 'cancel', childId: 'missing' }, { agent: { id: 'parent-1' }, signal: new AbortController().signal })
    expect(missing).toMatchObject({ action: 'cancel', accepted: false, reason: 'not-found' })
    expect(missing).not.toHaveProperty('requestedAt')
    await expect(control.execute({ action: 'cancel' }, { agent: { id: 'parent-1' }, signal: new AbortController().signal })).rejects.toThrow(/childId is required/)
  })

  it('rejects an empty control tool name and accepts an override', async () => {
    const { ctx } = fakeContext()
    await expect(mountTool(ctx, { ...config, controlToolName: '' }, async () => undefined, new RunRegistry())).rejects.toThrow(/controlToolName/)
    const { ctx: overrideCtx, registered } = fakeContext()
    await mountTool(overrideCtx, { ...config, controlToolName: 'agy_status' }, async () => undefined, new RunRegistry())
    expect(registered.map(entry => entry.name)).toContain('agy_status')
  })


  it('removes the control tool when its registration effect is disposed', async () => {
    const { ctx, registered } = fakeContext()
    const registry = new RunRegistry()
    const dispose = registerControlTool(ctx, config, registry)
    expect(registered.map(entry => entry.name)).toEqual(['subagent_oar_agy_control'])
    expect(typeof dispose).toBe('function')
    dispose?.()
    expect(registered).toEqual([])
  })


  it('returns a safe unavailable receipt and redacted log when interrupt throws', async () => {
    const { ctx, registered } = fakeContext()
    const registry = new RunRegistry()
    registry.register('parent-1', 'child-1')
    registerControlTool(ctx, config, registry)
    const control = registered.find(entry => entry.name === 'subagent_oar_agy_control') as {
      execute: (args: unknown, exec: unknown) => Promise<unknown>
    }
    ctx.subagents.interrupt = vi.fn(() => { throw new Error('Authorization: Bearer CANARY_DO_NOT_LEAK') })
    await expect(control.execute({ action: 'cancel', childId: 'child-1' }, { agent: { id: 'parent-1' }, signal: new AbortController().signal })).resolves.toMatchObject({
      action: 'cancel',
      accepted: false,
      reason: 'unavailable',
    })
    expect(ctx.logger.warn.mock.calls.join('\n')).not.toContain('CANARY_DO_NOT_LEAK')
    expect(ctx.logger.warn.mock.calls.join('\n')).toContain('[redacted]')
  })


  it('returns unavailable without querying when cancel has no calling agent', async () => {
    const { ctx, registered, interrupts } = fakeContext()
    const registry = new RunRegistry()
    registry.register('parent-1', 'child-1')
    registerControlTool(ctx, config, registry)
    const control = registered.find(entry => entry.name === 'subagent_oar_agy_control') as {
      execute: (args: unknown, exec: unknown) => Promise<unknown>
    }
    await expect(control.execute({ action: 'cancel', childId: 'child-1' }, { signal: new AbortController().signal })).resolves.toEqual({
      action: 'cancel',
      childId: 'child-1',
      accepted: false,
      reason: 'unavailable',
    })
    expect(interrupts).toHaveLength(0)
    expect(registry.status('parent-1', 'child-1').runs[0].cancelRequestedAt).toBeNull()
  })

  it('omits requestedAt for an already-ended cancel', async () => {
    const { ctx, registered, interrupts } = fakeContext()
    const registry = new RunRegistry()
    const record = registry.register('parent-1', 'child-1')
    registry.recordTerminal(record, 'completed', { stopReason: 'completed' })
    registerControlTool(ctx, config, registry)
    const control = registered.find(entry => entry.name === 'subagent_oar_agy_control') as {
      execute: (args: unknown, exec: unknown) => Promise<unknown>
    }
    const result = await control.execute({ action: 'cancel', childId: 'child-1' }, { agent: { id: 'parent-1' }, signal: new AbortController().signal })
    expect(result).toEqual({ action: 'cancel', childId: 'child-1', accepted: false, reason: 'already-ended' })
    expect(interrupts).toHaveLength(0)
  })

  it('requires a calling agent for the control tool', async () => {
    const { ctx, registered } = fakeContext()
    await mountTool(ctx, config, async () => undefined, new RunRegistry())
    const control = registered.find(entry => entry.name === 'subagent_oar_agy_control') as {
      execute: (args: unknown, exec: unknown) => Promise<unknown>
    }
    await expect(control.execute({ action: 'status' }, { signal: new AbortController().signal })).rejects.toThrow(/requires a calling agent/)
  })
})
