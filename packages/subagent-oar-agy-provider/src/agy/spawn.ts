/** 组装并启动 AGY 子进程（headless + stream-json 双向）。 */

import { spawn, type ChildProcess } from 'node:child_process'
import { scrubbedParentEnv } from '@deepseek-ai/dsh-subprocess'

/** 权限档：默认无人值守；两档保守模式。 */
export type PermissionMode = 'yolo' | 'plan' | 'strict'

/** 启动 AGY 所需的配置。 */
export interface AgySpawnSpec {
  readonly command: string
  readonly cwd: string
  readonly model?: string
  readonly effort?: string
  readonly permissionMode: PermissionMode
  readonly env: Readonly<Record<string, string | null>>
}

/** 把配置翻译为 AGY 命令行参数。 */
export function buildAgyArgs(spec: Pick<AgySpawnSpec, 'model' | 'effort' | 'permissionMode'>): string[] {
  const args = ['--input-format', 'stream-json', '--output-format', 'stream-json']
  if (spec.model !== undefined && spec.model.length > 0) args.push('--model', spec.model)
  if (spec.effort !== undefined && spec.effort.length > 0) args.push('--effort', spec.effort)
  if (spec.permissionMode === 'yolo') args.push('--dangerously-skip-permissions')
  else if (spec.permissionMode === 'plan') args.push('--mode', 'plan')
  // strict：不追加任何权限选项，需要权限的动作由 AGY 软拒绝。
  return args
}

/** 在官方清洗后的父环境上叠加插件配置；`null` 表示删除；显式覆盖可重新提供凭据。 */
export function agyEnvironment(
  overlay: Readonly<Record<string, string | null>>,
  base: NodeJS.ProcessEnv = scrubbedParentEnv(),
): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base }
  for (const [key, value] of Object.entries(overlay)) {
    if (value === null) delete env[key]
    else env[key] = value
  }
  return env
}

/** 一条用户消息的 NDJSON 行；schema 由 AGY `--input-format stream-json` 约定。 */
export function userMessageLine(prompt: string): string {
  return `${JSON.stringify({ event: 'user', message: { content: prompt } })}\n`
}

/** 启动 AGY 子进程；stdin 由调用方写入并关闭。 */
export function spawnAgy(spec: AgySpawnSpec): ChildProcess {
  return spawn(spec.command, buildAgyArgs(spec), {
    cwd: spec.cwd,
    env: agyEnvironment(spec.env),
    stdio: ['pipe', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
    windowsHide: true,
  })
}
