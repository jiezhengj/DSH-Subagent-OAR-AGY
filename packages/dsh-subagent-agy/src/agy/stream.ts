/** UTF-8 安全的 NDJSON 行解码：把 stdout 数据块切成完整行，容忍跨块的多字节字符。 */

import { StringDecoder } from 'node:string_decoder'

/** 单行最大字节数；超过视为协议错误。 */
export const DEFAULT_MAX_LINE_BYTES = 8 * 1024 * 1024

/** 行解码器的接收端。 */
export interface LineSink {
  /** 收到一条非空行（已去掉行尾换行与 `\r`）。 */
  onLine(line: string): void
  /** 流上出现无法继续解析的问题（例如单行超限或非法 JSON）。 */
  onError?(error: Error): void
}

/** 增量行缓冲：`push` 喂入数据块，`end` 冲刷最后一行。 */
export class NdjsonLineReader {
  private readonly decoder = new StringDecoder('utf8')
  private buffer = ''

  /**
   * @param maxLineBytes - 单行上限；超出时调用 `onError` 并丢弃当前缓冲。
   * @param sink - 行接收端。
   * @param logger - 可选的协议告警接收端（未知事件等），默认写入 `onError`。
   */
  constructor(
    private readonly maxLineBytes: number,
    private readonly sink: LineSink,
  ) {}

  /** 喂入一个数据块。 */
  push(chunk: Buffer | string): void {
    this.buffer += typeof chunk === 'string' ? chunk : this.decoder.write(chunk)
    this.drain()
  }

  /** 结束输入，冲刷最后一行。 */
  end(chunk?: Buffer | string): void {
    if (chunk !== undefined) this.buffer += typeof chunk === 'string' ? chunk : this.decoder.end(chunk)
    else this.buffer += this.decoder.end()
    this.drain()
    const rest = this.buffer.trim()
    this.buffer = ''
    if (rest.length > 0) this.emit(rest)
  }

  private drain(): void {
    let index: number
    while ((index = this.buffer.indexOf('\n')) >= 0) {
      let line = this.buffer.slice(0, index)
      this.buffer = this.buffer.slice(index + 1)
      if (line.endsWith('\r')) line = line.slice(0, -1)
      if (line.trim().length === 0) continue
      this.emit(line)
    }
    if (Buffer.byteLength(this.buffer, 'utf8') > this.maxLineBytes) {
      const error = new Error(`agy stream line exceeds ${this.maxLineBytes} bytes`)
      this.buffer = ''
      this.sink.onError?.(error)
    }
  }

  private emit(line: string): void {
    if (Buffer.byteLength(line, 'utf8') > this.maxLineBytes) {
      this.sink.onError?.(new Error(`agy stream line exceeds ${this.maxLineBytes} bytes`))
      return
    }
    this.sink.onLine(line)
  }
}
