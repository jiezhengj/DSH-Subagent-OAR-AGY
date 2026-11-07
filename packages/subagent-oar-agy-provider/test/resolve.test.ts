import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { isExecutableFile, resolveAgyCommand } from '../src/agy/resolve.js'
import { AgyFailure } from '../src/agy/errors.js'

const tempDirs: string[] = []

function makeExecutableDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'agy-resolve-'))
  tempDirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('resolveAgyCommand', () => {
  it('accepts an explicit executable path', () => {
    const dir = makeExecutableDir()
    const binary = path.join(dir, 'agy')
    writeFileSync(binary, '#!/bin/sh\nexit 0\n')
    chmodSync(binary, 0o755)
    expect(isExecutableFile(binary)).toBe(true)
    expect(resolveAgyCommand(binary)).toBe(binary)
  })

  it('rejects an explicit path that is missing or not executable', () => {
    const dir = makeExecutableDir()
    const missing = path.join(dir, 'agy')
    expect(() => resolveAgyCommand(missing)).toThrowError(AgyFailure)
    try { resolveAgyCommand(missing) } catch (error) {
      expect((error as AgyFailure).category).toBe('not-installed')
    }
    const plain = path.join(dir, 'plain')
    writeFileSync(plain, 'no shebang')
    expect(() => resolveAgyCommand(plain)).toThrowError(AgyFailure)
  })

  it('finds the command on PATH', () => {
    const dir = makeExecutableDir()
    const binary = path.join(dir, 'agy')
    writeFileSync(binary, '#!/bin/sh\nexit 0\n')
    chmodSync(binary, 0o755)
    expect(resolveAgyCommand('agy', { PATH: dir }, 'linux')).toBe(binary)
  })

  it('reports not-installed with an actionable message when PATH lookup fails', () => {
    const dir = makeExecutableDir()
    try {
      resolveAgyCommand('agy', { PATH: dir }, 'linux')
      expect.unreachable()
    } catch (error) {
      expect((error as AgyFailure).category).toBe('not-installed')
      expect(error instanceof Error ? error.message : '').toContain('command')
    }
  })

  it('uses PATHEXT candidates on Windows', () => {
    const dir = makeExecutableDir()
    const binary = path.join(dir, 'agy.EXE')
    writeFileSync(binary, 'binary')
    chmodSync(binary, 0o755)
    expect(resolveAgyCommand('agy', { Path: dir, PATHEXT: '.COM;.EXE;.CMD' }, 'win32')).toBe(binary)
  })
})
