/** 解析 AGY 可执行文件：显式路径或 PATH/PATHEXT 查找。 */

import { accessSync, constants, statSync } from 'node:fs'
import path from 'node:path'
import { AgyFailure } from './errors.js'

/** 判断路径是否是普通文件且可执行。 */
export function isExecutableFile(candidate: string): boolean {
  try {
    if (!statSync(candidate).isFile()) return false
    accessSync(candidate, constants.X_OK)
    return true
  } catch {
    return false
  }
}

/** 拆分 PATH。 */
export function pathEntries(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string[] {
  const raw = env.PATH ?? env.Path ?? ''
  const separator = platform === 'win32' ? ';' : ':'
  return raw.split(separator).filter(entry => entry.length > 0)
}

/** Windows 上按 PATHEXT 展开候选扩展名。 */
export function candidateNames(name: string, env: NodeJS.ProcessEnv, platform: NodeJS.Platform): string[] {
  if (platform !== 'win32') return [name]
  const extensions = (env.PATHEXT ?? '.COM;.EXE;.BAT;.CMD').split(';').filter(Boolean)
  const lower = name.toLowerCase()
  if (extensions.some(ext => lower.endsWith(ext.toLowerCase()))) return [name]
  const names = [name]
  for (const extension of extensions) names.push(name + extension)
  return names
}

/**
 * 解析命令。
 * @param command - 配置的命令（名称或路径）。
 * @param env - 用于 PATH/PATHEXT 的环境。
 * @param platform - 目标平台，默认当前平台。
 * @returns 可执行文件绝对路径。
 * @throws AgyFailure('not-installed') 找不到时抛出。
 */
export function resolveAgyCommand(
  command: string,
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string {
  const trimmed = command.trim()
  if (trimmed.length === 0) {
    throw new AgyFailure('not-installed', 'command 不能为空')
  }
  const hasSeparator = trimmed.includes('/') || trimmed.includes('\\')
  if (hasSeparator) {
    const resolved = path.resolve(trimmed)
    if (isExecutableFile(resolved)) return resolved
    throw new AgyFailure(
      'not-installed',
      `配置的 command 不可执行：${resolved}`,
    )
  }
  const names = candidateNames(trimmed, env, platform)
  for (const entry of pathEntries(env, platform)) {
    for (const name of names) {
      const candidate = path.join(entry, name)
      if (isExecutableFile(candidate)) return candidate
    }
  }
  throw new AgyFailure(
    'not-installed',
    `在 PATH 中找不到 ${trimmed}。请安装 Antigravity CLI，或通过 command 配置绝对路径。`,
  )
}
