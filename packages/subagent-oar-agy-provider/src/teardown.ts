/** 终止 AGY 进程树：POSIX 进程组 SIGTERM → 宽限 → SIGKILL；Windows taskkill /T /F。 */

import { spawn, type ChildProcess } from 'node:child_process'

/** 终止参数。 */
export interface TerminateOptions {
  /** SIGTERM 后等待退出的宽限毫秒数。 */
  readonly graceMs: number
  /** 目标平台，默认当前平台（便于测试注入）。 */
  readonly platform?: NodeJS.Platform
  /** 信号发送器，默认 `process.kill`（便于测试注入）。 */
  readonly kill?: (pid: number, signal: NodeJS.Signals) => void
}

/** 子进程是否已退出。 */
export function hasExited(child: Pick<ChildProcess, 'exitCode' | 'signalCode'>): boolean {
  return child.exitCode !== null || child.signalCode !== null
}

/** 等待退出或超时，返回是否已退出。 */
function waitExit(child: ChildProcess, timeoutMs: number): Promise<boolean> {
  if (hasExited(child)) return Promise.resolve(true)
  return new Promise<boolean>(resolve => {
    let done = false
    const finish = (exited: boolean): void => {
      if (done) return
      done = true
      clearTimeout(timer)
      child.removeListener('exit', onExit)
      child.removeListener('close', onExit)
      resolve(exited)
    }
    const onExit = (): void => { finish(true) }
    const timer = setTimeout(() => { finish(hasExited(child)) }, timeoutMs)
    timer.unref?.()
    child.once('exit', onExit)
    child.once('close', onExit)
  })
}

/** Windows 上用 taskkill 终止整棵进程树。 */
function taskkill(pid: number): Promise<void> {
  return new Promise<void>(resolve => {
    const killer = spawn('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true })
    killer.once('error', () => { resolve() })
    killer.once('close', () => { resolve() })
  })
}

/**
 * 幂等地终止进程树并等到退出（或再等 2 秒兜底）。
 * @param child - 已启动的子进程。
 * @param options - 宽限与平台；测试可注入 kill。
 */
export async function terminate(child: ChildProcess, options: TerminateOptions): Promise<void> {
  const platform = options.platform ?? process.platform
  const pid = child.pid
  if (pid === undefined || hasExited(child)) return
  const send = options.kill ?? ((target: number, signal: NodeJS.Signals) => { process.kill(target, signal) })

  if (platform === 'win32') {
    await taskkill(pid)
    if (await waitExit(child, options.graceMs)) return
    try { child.kill('SIGKILL') } catch { /* 已退出 */ }
    await waitExit(child, 2000)
    return
  }

  try { send(-pid, 'SIGTERM') } catch {
    try { send(pid, 'SIGTERM') } catch { /* 已退出 */ }
  }
  if (await waitExit(child, options.graceMs)) return
  try { send(-pid, 'SIGKILL') } catch {
    try { child.kill('SIGKILL') } catch { /* 已退出 */ }
  }
  await waitExit(child, 2000)
}
