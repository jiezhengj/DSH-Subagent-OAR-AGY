/** 失败分类与面向用户的安全诊断文案。 */

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

/** 构造分类诊断；`detail` 可选，会被清洗并截断。 */
export function failureDiagnostic(category: FailureCategory, detail?: string): string {
  const head: Record<FailureCategory, string> = {
    'not-installed': 'AGY 未安装或不在 PATH 中。请安装 Antigravity CLI，或通过 command 配置指定 agy 的绝对路径。',
    'not-authenticated': 'AGY 需要先登录。请先在终端运行一次 agy 完成交互登录，再重试委派。',
    'timeout': '委派超时，AGY 进程已被终止。可调大 timeoutMs 或让任务更聚焦后重试。',
    'spawn-failed': '无法启动 AGY 进程。请检查 command 路径、cwd 是否可进入以及执行权限。',
    'protocol': 'AGY 输出无法解析或缺少终态结果。请检查 AGY 版本与输出是否被其他程序干扰。',
    'cancelled': '委派已被取消（AGY 进程已终止，父会话可继续）。',
  }
  const tail = detail === undefined || detail.length === 0 ? '' : ` 详情：${detail}`
  return truncateUtf8(`${head[category]}${tail}`)
}

/** 运行时错误转文本（不泄漏堆栈以外的敏感内容）。 */
export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
