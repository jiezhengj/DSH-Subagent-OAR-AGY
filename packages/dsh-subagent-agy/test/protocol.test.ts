import { describe, expect, it } from 'vitest'
import {
  isInitEvent,
  isResultEvent,
  isStepEvent,
  parseAgyLine,
  statusToStopReason,
  textDelta,
} from '../src/agy/protocol.js'

describe('protocol', () => {
  it('parses valid NDJSON events', () => {
    expect(parseAgyLine('{"event":"init"}')).toEqual({ event: 'init' })
    expect(parseAgyLine('{"event":"result","result":{"status":"SUCCESS"}}')?.event).toBe('result')
  })

  it('returns undefined for invalid JSON or non-event payloads', () => {
    expect(parseAgyLine('not json')).toBeUndefined()
    expect(parseAgyLine('42')).toBeUndefined()
    expect(parseAgyLine('{"a":1}')).toBeUndefined()
  })

  it('maps statuses to stop reasons', () => {
    expect(statusToStopReason('SUCCESS')).toBe('completed')
    expect(statusToStopReason('ERROR')).toBe('error')
    expect(statusToStopReason('CANCELED')).toBe('aborted')
    expect(statusToStopReason('INTERRUPTED')).toBe('aborted')
    expect(statusToStopReason(undefined)).toBe('error')
    expect(statusToStopReason('SOMETHING_NEW')).toBe('error')
  })

  it('discriminates event kinds', () => {
    const init = parseAgyLine('{"event":"init","init":{"cwd":"/tmp"}}')
    expect(init !== undefined && isInitEvent(init)).toBe(true)
    const step = parseAgyLine('{"event":"step_update","step_update":{"text_delta":"x"}}')
    expect(step !== undefined && isStepEvent(step)).toBe(true)
    const result = parseAgyLine('{"event":"result","result":{"status":"SUCCESS"}}')
    expect(result !== undefined && isResultEvent(result)).toBe(true)
  })

  it('reads text deltas', () => {
    const step = parseAgyLine('{"event":"step_update","step_update":{"text_delta":"hello"}}')
    expect(step !== undefined && isStepEvent(step) ? textDelta(step) : undefined).toBe('hello')
  })
})
