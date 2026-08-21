import assert from 'node:assert/strict'
import test from 'node:test'
import axios from 'axios'

import { melodiaRequest, withFallback, resetMelodiaCircuitForTests } from '../lib/melodia-api.js'

test('melodiaRequest sends configured credentials and returns data', async () => {
  const original = axios.defaults.adapter
  const oldApis = global.APIs
  const oldUrl = process.env.MELODIA_API_URL
  const oldKey = process.env.MELODIA_API_KEY
  process.env.MELODIA_API_URL = 'https://melodia.test'
  process.env.MELODIA_API_KEY = 'secret-test-key'
  resetMelodiaCircuitForTests()
  axios.defaults.adapter = async config => {
    assert.equal(config.url, 'https://melodia.test/healthz')
    assert.equal(config.headers.get('x-api-key'), 'secret-test-key')
    return { data: { status: true }, status: 200, statusText: 'OK', headers: {}, config }
  }
  try {
    assert.deepEqual(await melodiaRequest('/healthz', { retries: 0 }), { status: true })
  } finally {
    axios.defaults.adapter = original
    global.APIs = oldApis
    if (oldUrl == null) delete process.env.MELODIA_API_URL
    else process.env.MELODIA_API_URL = oldUrl
    if (oldKey == null) delete process.env.MELODIA_API_KEY
    else process.env.MELODIA_API_KEY = oldKey
  }
})

test('withFallback returns fallback result after primary failure', async () => {
  const value = await withFallback(
    async () => { throw new Error('primary down') },
    async error => `fallback:${error.message}`
  )
  assert.equal(value, 'fallback:primary down')
})
