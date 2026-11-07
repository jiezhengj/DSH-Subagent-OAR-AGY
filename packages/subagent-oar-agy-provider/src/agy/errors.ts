/** 失败分类与面向用户的安全诊断文案（按界面语言输出）。 */

import { t, type Locale } from '../i18n.js'

/** 诊断文本上限（UTF-8 字节），与 DSH 接缝的 4096 字节限制一致。 */
export const DIAGNOSTIC_MAX_BYTES = 4096

/** 六类失败。 */
export type FailureCategory =
  | 'not-installed'
  | 'not-authenticated'
  | 'timeout'
  | 'spawn-failed'
  | 'protocol'
  | 'cancelled'

/** 带分类的失败，供提供方在发布前抛错或在发布后转诊断。 */
export class AgyFailure extends Error {
  constructor(
    readonly category: FailureCategory,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'AgyFailure'
  }
}

/** 按 UTF-8 字节安全截断文本。 */
export function truncateUtf8(text: string, maxBytes = DIAGNOSTIC_MAX_BYTES): string {
  const buffer = Buffer.from(text, 'utf8')
  if (buffer.byteLength <= maxBytes) return text
  let end = maxBytes
  while (end > 0 && (buffer[end]! & 0xc0) === 0x80) end -= 1
  return buffer.subarray(0, end).toString('utf8')
}

/** 清洗并截断 stderr 摘要：折叠空白、去掉可能的绝对路径噪声。 */
export function summarizeStderr(stderr: string): string | undefined {
  const cleaned = stderr
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .slice(-5)
    .join(' | ')
  if (cleaned.length === 0) return undefined
  return truncateUtf8(cleaned, 1200)
}

/** 判断 stderr 或结果错误是否指示认证问题。 */
export function looksLikeAuthenticationFailure(text: string | undefined): boolean {
  if (text === undefined) return false
  return /authentication required|not (?:logged|signed) in|please (?:log|sign) ?in|unauthorized/i.test(text)
}

/** 分类与文案键的对应。 */
const DIAGNOSTIC_KEYS = {
  'not-installed': 'notInstalled',
  'not-authenticated': 'notAuthenticated',
  'timeout': 'timeout',
  'spawn-failed': 'spawnFailed',
  'protocol': 'protocol',
  'cancelled': 'cancelled',
} as const

/** 构造分类诊断；`detail` 可选，会被清洗并截断；`locale` 决定语言。 */
export function failureDiagnostic(category: FailureCategory, detail?: string, locale: Locale = 'en'): string {
  const head = t(locale, DIAGNOSTIC_KEYS[category])
  const tail = detail === undefined || detail.length === 0 ? '' : ` ${t(locale, 'detailLabel')}: ${detail}`
  return truncateUtf8(`${head}${tail}`)
}

/** 运行时错误转文本（不泄漏堆栈以外的敏感内容）。 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
