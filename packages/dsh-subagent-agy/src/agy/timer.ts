/** 提供方自管的单次委派时限（从 AGY 的 `init` 事件起算）。 */

/** 可清除的计时器句柄。 */
export interface Deadline {
  clear(): void
}

/** 空计时器（未配置时限时使用）。 */
export const NO_DEADLINE: Deadline = { clear() {} }

/**
 * 启动一个时限；`ms` 为 undefined 时不设内部计时。
 * @param ms - 时限毫秒数。
 * @param onFire - 到期回调（只调用一次）。
 * @returns 可清除的句柄。
 */
export function armDeadline(ms: number | undefined, onFire: () => void): Deadline {
  if (ms === undefined) return NO_DEADLINE
  const timer = setTimeout(onFire, ms)
  timer.unref?.()
  return { clear: () => { clearTimeout(timer) } }
}
