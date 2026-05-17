import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

process.env.JWT_SECRET = 'test-secret-for-jwt-tests-minimum-32-chars-long'

const { createAccessToken, verifyAccessToken, createRefreshToken, hashRefreshToken } =
  await import('../lib/jwt/index.js')

describe('createAccessToken', () => {
  test('returns token, jti, expiresIn', () => {
    const { token, jti, expiresIn } = createAccessToken({ username: 'juan', rol: 'usuario' })
    assert.ok(typeof token === 'string' && token.length > 20)
    assert.ok(typeof jti === 'string' && jti.length > 10)
    assert.strictEqual(expiresIn, 900)
  })
  test('verifyAccessToken decodes sub and rol', () => {
    const { token } = createAccessToken({ username: 'maria', rol: 'admin' })
    const payload = verifyAccessToken(token)
    assert.strictEqual(payload.sub, 'maria')
    assert.strictEqual(payload.rol, 'admin')
  })
  test('verifyAccessToken throws on invalid token', () => {
    assert.throws(() => verifyAccessToken('bad.token.value'))
  })
})

describe('createRefreshToken', () => {
  test('returns rawToken and tokenHash', () => {
    const { rawToken, tokenHash } = createRefreshToken()
    assert.ok(typeof rawToken === 'string' && rawToken.length > 30)
    assert.ok(typeof tokenHash === 'string' && tokenHash.length === 64)
    assert.notStrictEqual(rawToken, tokenHash)
  })
  test('hashRefreshToken is deterministic', () => {
    const { rawToken, tokenHash } = createRefreshToken()
    assert.strictEqual(hashRefreshToken(rawToken), tokenHash)
  })
  test('two calls produce different tokens', () => {
    const a = createRefreshToken()
    const b = createRefreshToken()
    assert.notStrictEqual(a.rawToken, b.rawToken)
  })
})
