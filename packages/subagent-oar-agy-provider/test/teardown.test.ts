import { spawn } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { hasExited, terminate } from '../src/teardown.js'
import { RunRegistry } from '../src/runs.js'

describe('terminate', () => {
  it('returns immediately for an exited child', async () => {
    const child = spawn(process.execPath, ['-e', 'process.exit(0)'], { stdio: 'ignore' })
    await new Promise(resolve => child.once('exit', resolve))
    await terminate(child, { graceMs: 200 })
    expect(hasExited(child)).toBe(true)
  })

  it('escalates to SIGKILL when the child ignores SIGTERM', async () => {
    if (process.platform === 'win32') return
    const child = spawn(
      process.execPath,
      ['-e', 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)'],
      { detached: true, stdio: 'ignore' },
    )
    await new Promise(resolve => setTimeout(resolve, 100))
    await terminate(child, { graceMs: 150 })
    expect(hasExited(child)).toBe(true)
  })
})


describe('RunRegistry disposal', () => {
  it('clears records and terminates an unfinished child process', async () => {
    const registry = new RunRegistry()
    const record = registry.register('parent', 'child')
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], {
      detached: true,
      stdio: 'ignore',
    })
    record.teardown = () => terminate(child, { graceMs: 200 })
    await registry.dispose()
    expect(hasExited(child)).toBe(true)
    expect(registry.status('parent').runs).toEqual([])
  })
})
