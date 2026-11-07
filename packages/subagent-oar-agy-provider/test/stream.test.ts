import { describe, expect, it, vi } from 'vitest'
import { NdjsonLineReader } from '../src/agy/stream.js'

function collect(): { lines: string[]; errors: Error[]; reader: NdjsonLineReader } {
  const lines: string[] = []
  const errors: Error[] = []
  const reader = new NdjsonLineReader(1024, {
    onLine: line => lines.push(line),
    onError: error => errors.push(error),
  })
  return { lines, errors, reader }
}

describe('NdjsonLineReader', () => {
  it('splits complete lines and keeps the tail buffered', () => {
    const { lines, reader } = collect()
    reader.push('{"a":1}\n{"b":')
    expect(lines).toEqual(['{"a":1}'])
    reader.push('2}\n')
    expect(lines).toEqual(['{"a":1}', '{"b":2}'])
  })

  it('handles CRLF and skips blank lines', () => {
    const { lines, reader } = collect()
    reader.push('\r\n{"a":1}\r\n\r\n')
    expect(lines).toEqual(['{"a":1}'])
  })

  it('decodes multibyte characters split across chunks', () => {
    const { lines, reader } = collect()
    const payload = Buffer.from('{"t":"你好"}\n', 'utf8')
    for (const byte of payload) reader.push(Buffer.from([byte]))
    expect(lines).toEqual(['{"t":"你好"}'])
  })

  it('flushes the final line on end', () => {
    const { lines, reader } = collect()
    reader.push('{"a":1}')
    reader.end()
    expect(lines).toEqual(['{"a":1}'])
  })

  it('reports an error and drops the buffer when a line exceeds the limit', () => {
    const { lines, errors, reader } = collect()
    reader.push('x'.repeat(2000))
    expect(errors).toHaveLength(1)
    expect(lines).toHaveLength(0)
    reader.push('\n{"ok":true}\n')
    expect(lines).toEqual(['{"ok":true}'])
  })

  it('never throws on repeated end calls', () => {
    const { reader } = collect()
    reader.push('{"a":1}\n')
    reader.end()
    expect(() => reader.end()).not.toThrow()
  })
})
