import assert from 'node:assert/strict'
import test from 'node:test'
import { randomUUID } from 'node:crypto'
import { createAssistantHealthHandler, createAstronautChatHandler } from './astronaut-handler.mjs'

function createResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value
    },
    writeHead(status) {
      this.statusCode = status
    },
    end(body) {
      this.body = body
    },
  }
}

async function invoke(handler, { method = 'POST', body, ip = randomUUID() } = {}) {
  const request = { method, body, headers: { 'x-forwarded-for': ip }, socket: { remoteAddress: ip } }
  const response = createResponse()
  await handler(request, response)
  return { ...response, json: JSON.parse(response.body) }
}

const configuredEnv = {
  ASTRONAUT_API_URL: 'https://provider.example/v1/chat/completions',
  ASTRONAUT_API_KEY: 'private-test-key',
  ASTRONAUT_MODEL: 'test-model',
}

test('assistant health reports provider setup without returning secrets', async () => {
  const healthy = await invoke(createAssistantHealthHandler(configuredEnv), { method: 'GET' })
  assert.equal(healthy.statusCode, 200)
  assert.deepEqual(healthy.json, { enabled: true, missing: [] })
  assert.equal(JSON.stringify(healthy.json).includes(configuredEnv.ASTRONAUT_API_KEY), false)

  const unconfigured = await invoke(createAssistantHealthHandler({}), { method: 'GET' })
  assert.equal(unconfigured.json.enabled, false)
  assert.deepEqual(unconfigured.json.missing, [
    'ASTRONAUT_API_URL',
    'ASTRONAUT_API_KEY',
    'ASTRONAUT_MODEL',
  ])
})

test('chat validates messages and forwards the provider secret only server-side', async () => {
  let requestOptions
  const handler = createAstronautChatHandler({
    env: configuredEnv,
    fetchImpl: async (_url, options) => {
      requestOptions = options
      return { ok: true, json: async () => ({ choices: [{ message: { content: 'Ready to help.' } }] }) }
    },
  })
  const response = await invoke(handler, { body: { messages: [{ role: 'user', content: 'Help' }] } })
  assert.equal(response.statusCode, 200)
  assert.deepEqual(response.json, { reply: 'Ready to help.' })
  assert.equal(requestOptions.headers.Authorization, `Bearer ${configuredEnv.ASTRONAUT_API_KEY}`)

  const invalid = await invoke(handler, { body: { messages: [{ role: 'system', content: 'No' }] } })
  assert.equal(invalid.statusCode, 400)
})

test('public chat endpoint returns 429 after its per-instance request allowance', async () => {
  const handler = createAstronautChatHandler({
    env: configuredEnv,
    fetchImpl: async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'OK' } }] }) }),
  })
  const ip = randomUUID()
  const body = { messages: [{ role: 'user', content: 'Help' }] }
  for (let request = 0; request < 12; request += 1) {
    const response = await invoke(handler, { body, ip })
    assert.equal(response.statusCode, 200)
  }
  const limited = await invoke(handler, { body, ip })
  assert.equal(limited.statusCode, 429)
  assert.equal(limited.headers['retry-after'] > 0, true)
})
