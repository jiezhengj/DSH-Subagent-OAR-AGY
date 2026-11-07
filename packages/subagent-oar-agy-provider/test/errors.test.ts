import { describe, expect, it } from 'vitest'
import {
  DIAGNOSTIC_MAX_BYTES,
  failureDiagnostic,
  looksLikeAuthenticationFailure,
  summarizeStderr,
  truncateUtf8,
} from '../src/agy/errors.js'

describe('errors', () => {
  it('produces distinct actionable messages for the six categories', () => {
    const categories = ['not-installed', 'not-authenticated', 'timeout', 'spawn-failed', 'protocol', 'cancelled'] as const
    const messages = categories.map(category => failureDiagnostic(category))
    expect(new Set(messages).size).toBe(categories.length)
    for (const message of messages) expect(message.length).toBeGreaterThan(10)
    expect(failureDiagnostic('timeout', 'detail')).toContain('detail')
  })

  it('detects authentication failures from stderr text', () => {
    expect(looksLikeAuthenticationFailure('Authentication required. Please log in.')).toBe(true)
    expect(looksLikeAuthenticationFailure('Not logged in')).toBe(true)
    expect(looksLikeAuthenticationFailure(undefined)).toBe(false)
    expect(looksLikeAuthenticationFailure('some other failure')).toBe(false)
  })

  it('truncates safely at UTF-8 boundaries', () => {
    const text = '你'.repeat(2000)
    const truncated = truncateUtf8(text, 100)
    expect(Buffer.byteLength(truncated, 'utf8')).toBeLessThanOrEqual(100)
    expect(truncated.endsWith('你')).toBe(true)
    expect(truncateUtf8('short', 100)).toBe('short')
  })

  it('keeps diagnostics within the seam byte limit', () => {
    const diagnostic = failureDiagnostic('protocol', 'x'.repeat(8000))
    expect(Buffer.byteLength(diagnostic, 'utf8')).toBeLessThanOrEqual(DIAGNOSTIC_MAX_BYTES)
  })

  it('summarizes the last stderr lines', () => {
    expect(summarizeStderr('\n\nfirst\nsecond\n\n')).toBe('first | second')
    expect(summarizeStderr('   ')).toBeUndefined()
  })
})
