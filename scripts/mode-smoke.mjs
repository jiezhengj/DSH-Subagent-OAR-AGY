import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { startAgyRun } from '../packages/subagent-oar-agy-provider/dist/run.js'

const mode = process.argv[2] ?? 'plan'
const dir = mkdtempSync(path.join(tmpdir(), `agy-mode-${mode}-`))
const sentinel = path.join(dir, 'sentinel.txt')
writeFileSync(sentinel, 'ORIGINAL')

const result = await (async () => {
  const run = await startAgyRun(
    {
      cwd: dir,
      prompt: [{ type: 'text', text: 'Overwrite the file sentinel.txt in the current directory with exactly MODIFIED (no other text). Then reply with the final file content.' }],
      parent: {},
      signal: new AbortController().signal,
    },
    { providerName: 'agy', command: 'agy', permissionMode: mode, killGraceMs: 10_000, env: {}, timeoutMs: 180_000 },
  )
  const settled = await run.result
  await run.dispose()
  return settled
})()

const content = readFileSync(sentinel, 'utf8')
console.log(JSON.stringify({
  mode,
  stopReason: result.stopReason,
  fileChanged: content !== 'ORIGINAL',
  finalFile: content.slice(0, 40),
  output: result.output.map(block => (block.type === 'text' ? block.text : '')).join('').slice(0, 300),
  diagnostic: result.diagnostic,
}, null, 2))
rmSync(dir, { recursive: true, force: true })
