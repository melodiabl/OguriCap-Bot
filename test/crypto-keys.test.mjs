import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

process.env.DB_ENCRYPTION_KEY = 'a'.repeat(64) // 32 bytes as hex

const { getEncryptionKey, getHmacKey } = await import('../api/crypto/keys.js')

describe('getEncryptionKey', () => {
  test('returns a 32-byte Buffer', () => {
    const key = getEncryptionKey()
    assert.ok(Buffer.isBuffer(key))
    assert.strictEqual(key.length, 32)
  })
  test('is deterministic', () => {
    assert.deepStrictEqual(getEncryptionKey(), getEncryptionKey())
  })
})

describe('getHmacKey', () => {
  test('returns a 32-byte Buffer', () => {
    const key = getHmacKey()
    assert.ok(Buffer.isBuffer(key))
    assert.strictEqual(key.length, 32)
  })
  test('is different from encryptionKey', () => {
    assert.notDeepStrictEqual(getEncryptionKey(), getHmacKey())
  })
})
