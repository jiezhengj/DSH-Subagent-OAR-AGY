#!/usr/bin/env node
// 假 AGY：按 FAKE_AGY_MODE 编排 stream-json 事件，用于集成测试。
const mode = process.env.FAKE_AGY_MODE ?? 'success'
const text = process.env.FAKE_AGY_TEXT ?? 'FAKE_OK'
const emit = (value) => process.stdout.write(`${JSON.stringify(value)}\n`)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const conversation = 'fake-conversation'

emit({ event: 'init', conversation_id: conversation, init: { cwd: process.cwd(), tools: [], permission_mode: 'request-review' } })

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
  default: {
    process.stderr.write(`unknown FAKE_AGY_MODE: ${mode}\n`)
    process.exit(2)
  }
}
