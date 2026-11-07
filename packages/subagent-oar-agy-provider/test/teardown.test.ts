import { spawn } from 'node:child_process'
import { describe, expect, it } from 'vitest'
import { hasExited, terminate } from '../src/teardown.js'

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
