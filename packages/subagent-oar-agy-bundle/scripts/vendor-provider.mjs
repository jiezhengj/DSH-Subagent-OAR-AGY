/** 把提供方构建产物复制进组合包，使组合包可独立安装。 */

import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const source = fileURLToPath(new URL('../../subagent-oar-agy-provider/dist', import.meta.url))
const locale = fileURLToPath(new URL('../../subagent-oar-agy-provider/locale', import.meta.url))
const target = fileURLToPath(new URL('../provider', import.meta.url))
if (!existsSync(source)) throw new Error(`provider build output not found: ${source}`)
rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })
cpSync(source, target, { recursive: true })
cpSync(locale, `${target}/locale`, { recursive: true })
console.log(`vendored provider -> ${target}`)
