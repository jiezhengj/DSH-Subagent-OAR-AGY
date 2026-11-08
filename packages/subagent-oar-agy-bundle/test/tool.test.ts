import { describe, expect, it, vi } from 'vitest'
import { Config, createFallbackTool, mountTool } from '@jiezhengj/subagent_oar_agy/tool'

/** 构造测试用的最小 Cordis 上下文。 */
function fakeContext() {
  const registered: Array<{ name: string; parameters: { properties: Record<string, { enum?: string[] }> } }> = []
  const activations: unknown[] = []
  const plugin = vi.fn()
  const ctx = {
    logger: { warn: vi.fn() },
    plugin,
    tools: {
      register(definition: { name: string; parameters: { properties: Record<string, { enum?: string[] }> } }) {
        registered.push(definition)
      },
    },
    subagents: {
      getProvider: () => ({ inheritsParentContext: false }),
      async startActivation(args: unknown) {
        activations.push(args)
        return { childId: 'child-1' }
      },
    },
  }
  return { ctx, registered, activations, plugin }
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
    expect(plugin).toHaveBeenCalledWith(official, config)
    expect(registered).toHaveLength(0)
  })

  it('falls back to the bundled tool when the official package is missing', async () => {
    const { ctx, registered, activations } = fakeContext()
    await expect(mountTool(ctx, config, async () => undefined)).resolves.toBe('fallback')
    expect(ctx.logger.warn).toHaveBeenCalled()
    expect(registered).toHaveLength(1)
    expect(registered[0].name).toBe('subagent_oar_agy')
    expect(registered[0].parameters.properties.runtime.enum).toEqual(['agy'])

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
})
