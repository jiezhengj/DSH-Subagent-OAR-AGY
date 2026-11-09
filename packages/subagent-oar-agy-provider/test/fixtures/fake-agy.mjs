#!/usr/bin/env node
// 假 AGY：按 FAKE_AGY_MODE 编排 stream-json 事件，用于集成测试。
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const mode = process.env.FAKE_AGY_MODE ?? 'success'
const text = process.env.FAKE_AGY_TEXT ?? 'FAKE_OK'
const emit = (value) => process.stdout.write(`${JSON.stringify(value)}\n`)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const conversation = 'fake-conversation'
const dumpFile = process.env.FAKE_AGY_ENV_DUMP_FILE
const treePidFile = process.env.FAKE_AGY_TREE_PID_FILE

if (mode !== 'no-init') {
  emit({ event: 'init', conversation_id: conversation, init: { cwd: process.cwd(), tools: [], permission_mode: 'request-review' } })
}

switch (mode) {
  case 'success': {
    await sleep(20)
    emit({ event: 'step_update', step_update: { conversation_id: conversation, step_index: 0, state: 'DONE', step_type: 'agent_response', text_delta: text } })
    emit({ event: 'result', result: { conversation_id: conversation, status: 'SUCCESS', response: `${text}\n` } })
    process.exit(0)
    break
  }
  case 'error-result': {
    await sleep(20)
    emit({ event: 'result', result: { conversation_id: conversation, status: 'ERROR', error: 'fake-boom' } })
    process.exit(0)
    break
  }
  case 'auth-failure': {
    process.stderr.write('Authentication required. Please log in and try again.\n')
    process.exit(1)
    break
  }
  case 'malformed': {
    process.stdout.write('this is not json\n')
    process.exit(1)
    break
  }
  case 'partial': {
    await sleep(10)
    emit({ event: 'step_update', step_update: { conversation_id: conversation, step_index: 0, state: 'ACTIVE', step_type: 'agent_response', text_delta: 'partial text' } })
    process.exit(1)
    break
  }
  case 'multi-step': {
    await sleep(10)
    for (let i = 0; i < 3; i += 1) {
      emit({ event: 'step_update', step_update: { conversation_id: conversation, step_index: i, state: 'ACTIVE', step_type: 'tool', tool_name: `tool_${i}` } })
      await sleep(10)
    }
    emit({ event: 'result', result: { conversation_id: conversation, status: 'SUCCESS', response: 'MULTI_OK\n' } })
    process.exit(0)
    break
  }
  case 'slow': {
    await sleep(5000)
    emit({ event: 'result', result: { conversation_id: conversation, status: 'SUCCESS', response: `${text}\n` } })
    process.exit(0)
    break
  }
  case 'denied': {
    await sleep(10)
    emit({ event: 'step_update', step_update: { conversation_id: conversation, step_index: 0, state: 'ERROR', step_type: 'tool', tool_name: 'write_file', tool_info: { name: 'write_file', error: { type: 'TOOL_ERROR', message: 'permission check failed for write_file' } } } })
    emit({ event: 'result', result: { conversation_id: conversation, status: 'SUCCESS', response: '' } })
    process.exit(0)
    break
  }
  case 'hang': {
    process.on('SIGTERM', () => {})
    setInterval(() => {}, 1000)
    break
  }
  case 'no-init': {
    await sleep(10_000)
    break
  }
  case 'silent': {
    setInterval(() => {}, 1000)
    break
  }
  case 'crash-no-result': {
    await sleep(20)
    process.exit(1)
    break
  }
  case 'sensitive-stderr': {
    process.stderr.write(`fatal: Authorization: Bearer ${process.env.DSH_TEST_SECRET_CANARY ?? 'CANARY_DO_NOT_LEAK'}\n`)
    process.stderr.write(`api_key=${process.env.TEST_API_KEY ?? 'API_KEY_DO_NOT_LEAK'}\n`)
    await sleep(20)
    process.exit(1)
    break
  }
  case 'env-dump': {
    if (dumpFile !== undefined) writeFileSync(dumpFile, JSON.stringify(process.env, null, 2))
    emit({ event: 'result', result: { conversation_id: conversation, status: 'SUCCESS', response: 'ENV_DUMPED\n' } })
    process.exit(0)
    break
  }
  case 'tree': {
    const child = spawn(process.execPath, ['-e', 'setInterval(() => {}, 1000)'], { stdio: 'ignore' })
    if (treePidFile !== undefined && child.pid !== undefined) writeFileSync(treePidFile, String(child.pid))
    setInterval(() => {}, 1000)
    break
  }
  default: {
    process.stderr.write(`unknown FAKE_AGY_MODE: ${mode}\n`)
    process.exit(2)
  }
}
