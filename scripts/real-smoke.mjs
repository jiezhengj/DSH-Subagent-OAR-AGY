import { writeFileSync } from 'node:fs'
import { startAgyRun } from '../packages/subagent-oar-agy-provider/dist/run.js'

const runs = Number(process.argv[2] ?? 1)
const cwd = process.cwd()
const results = []

for (let index = 0; index < runs; index += 1) {
  const controller = new AbortController()
  const startedAt = performance.now()
  let run
  try {
    run = await startAgyRun(
      { cwd, prompt: [{ type: 'text', text: 'Reply with exactly: SMOKE_OK' }], parent: {}, signal: controller.signal },
      { providerName: 'agy', command: 'agy', permissionMode: 'yolo', killGraceMs: 10_000, env: {} },
    )
  } catch (error) {
    results.push({ index, ok: false, startError: error instanceof Error ? error.message : String(error) })
    continue
  }
  const confirmMs = Math.round(performance.now() - startedAt)
  const result = await run.result
  const totalMs = Math.round(performance.now() - startedAt)
  await run.dispose()
  const text = result.output.map(block => (block.type === 'text' ? block.text : '')).join('').trim()
  results.push({
    index,
    ok: result.stopReason === 'completed' && text.includes('SMOKE_OK'),
    stopReason: result.stopReason,
    confirmMs,
    totalMs,
    text: text.slice(0, 120),
    diagnostic: result.diagnostic?.slice(0, 200),
  })
  if (index < runs - 1) await new Promise(resolve => setTimeout(resolve, 1500))
}

console.log(JSON.stringify(results, null, 2))
writeFileSync('/tmp/agy_real_smoke.json', JSON.stringify({ agyVersion: '1.5.3', runs: results }, null, 2))
