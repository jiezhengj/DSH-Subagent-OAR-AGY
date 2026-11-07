import { describe, expect, it } from 'vitest'
import { agyEnvironment, buildAgyArgs, userMessageLine } from '../src/agy/spawn.js'

describe('buildAgyArgs', () => {
  it('always requests stream-json in and out', () => {
    const args = buildAgyArgs({ permissionMode: 'yolo' })
    expect(args).toContain('--input-format')
    expect(args).toContain('stream-json')
    expect(args).toContain('--output-format')
  })

  it('maps permission modes', () => {
    expect(buildAgyArgs({ permissionMode: 'yolo' })).toContain('--dangerously-skip-permissions')
    expect(buildAgyArgs({ permissionMode: 'plan' })).toEqual(expect.arrayContaining(['--mode', 'plan']))
    expect(buildAgyArgs({ permissionMode: 'strict' })).not.toContain('--dangerously-skip-permissions')
    expect(buildAgyArgs({ permissionMode: 'strict' })).not.toContain('--mode')
  })

  it('passes model and effort when provided', () => {
    const args = buildAgyArgs({ permissionMode: 'strict', model: 'm1', effort: 'high' })
    expect(args).toEqual(expect.arrayContaining(['--model', 'm1', '--effort', 'high']))
  })
})

describe('agyEnvironment', () => {
  it('overlays values and deletes keys set to null', () => {
    const env = agyEnvironment({ ADDED: 'yes', REMOVED: null }, { KEEP: '1', REMOVED: 'x' })
    expect(env.ADDED).toBe('yes')
    expect(env.KEEP).toBe('1')
    expect('REMOVED' in env).toBe(false)
  })
})

describe('userMessageLine', () => {
  it('emits one NDJSON user event and escapes content', () => {
    const line = userMessageLine('hello "world"\nline2')
    expect(line.endsWith('\n')).toBe(true)
    const parsed = JSON.parse(line.trim()) as { event: string; message: { content: string } }
    expect(parsed.event).toBe('user')
    expect(parsed.message.content).toBe('hello "world"\nline2')
  })
})
