import { describe, expect, it, vi } from 'vitest'
import { armDeadline, NO_DEADLINE } from '../src/agy/timer.js'

describe('armDeadline', () => {
  it('fires once after the configured delay', async () => {
    vi.useFakeTimers()
    const onFire = vi.fn()
    armDeadline(100, onFire)
    vi.advanceTimersByTime(99)
    expect(onFire).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onFire).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('does nothing when cleared', () => {
    vi.useFakeTimers()
    const onFire = vi.fn()
    const deadline = armDeadline(100, onFire)
    deadline.clear()
    vi.advanceTimersByTime(1000)
    expect(onFire).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('returns a no-op deadline when no limit is configured', () => {
    const onFire = vi.fn()
    expect(armDeadline(undefined, onFire)).toBe(NO_DEADLINE)
  })
})
