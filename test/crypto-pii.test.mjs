import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

process.env.DB_ENCRYPTION_KEY = 'b'.repeat(64)

const { encryptPII, decryptPII, blindIndex } = await import('../lib/crypto/pii.js')

describe('encryptPII / decryptPII', () => {
  test('round-trips correctly', () => {
    const enc = encryptPII('test@example.com')
    assert.strictEqual(decryptPII(enc), 'test@example.com')
  })
  test('encrypted value starts with v2:', () => {
    assert.ok(encryptPII('hello').startsWith('v2:'))
  })
  test('two encryptions of same input differ (random IV)', () => {
    assert.notStrictEqual(encryptPII('hello'), encryptPII('hello'))
  })
  test('decryptPII(null) returns null', () => {
    assert.strictEqual(decryptPII(null), null)
  })
  test('decryptPII(malformed) returns null', () => {
    assert.strictEqual(decryptPII('not-valid-format'), null)
  })
  test('encryptPII(null) returns null', () => {
    assert.strictEqual(encryptPII(null), null)
  })
})

describe('blindIndex', () => {
  test('is deterministic', () => {
    assert.strictEqual(blindIndex('test@example.com'), blindIndex('test@example.com'))
  })
  test('normalizes case', () => {
    assert.strictEqual(blindIndex('TEST@EXAMPLE.COM'), blindIndex('test@example.com'))
  })
  test('returns hex string of 64 chars (SHA-256)', () => {
    const idx = blindIndex('hello')
    assert.match(idx, /^[0-9a-f]{64}$/)
  })
  test('blindIndex(null) returns null', () => {
    assert.strictEqual(blindIndex(null), null)
  })
})
