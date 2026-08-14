import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { getSmtpMode, getSmtpWarnings, getSmtpTransportHint, getBrandConfig } from '../services/email/config.js'

describe('getSmtpMode', () => {
  test('puerto 465 → implicit-tls', () => {
    assert.equal(getSmtpMode({ port: 465, secure: false }), 'implicit-tls')
  })
  test('secure true + puerto 587 → starttls', () => {
    assert.equal(getSmtpMode({ port: 587, secure: true }), 'starttls')
  })
  test('sin secure ni 465 → plain', () => {
    assert.equal(getSmtpMode({ port: 587, secure: false }), 'plain')
  })
  test('config null → plain', () => {
    assert.equal(getSmtpMode(null), 'plain')
  })
})

describe('getSmtpWarnings', () => {
  test('null config → aviso de host', () => {
    const w = getSmtpWarnings(null)
    assert.ok(w.length > 0)
    assert.ok(w[0].includes('host'))
  })
  test('sin credenciales → aviso', () => {
    const w = getSmtpWarnings({ host: 'smtp.test.com', port: 587, secure: false, user: '', pass: '' })
    assert.ok(w.some(m => m.includes('credenciales')))
  })
  test('config completa → sin warnings de credenciales', () => {
    const w = getSmtpWarnings({ host: 'h', port: 587, secure: false, user: 'u', pass: 'p', replyTo: 'r@r.com' })
    assert.ok(!w.some(m => m.includes('credenciales')))
  })
})

describe('getSmtpTransportHint', () => {
  test('null → mensaje de configurar', () => {
    assert.ok(getSmtpTransportHint(null).includes('Configura'))
  })
  test('465 → TLS implícito', () => {
    assert.ok(getSmtpTransportHint({ port: 465, secure: false }).includes('TLS'))
  })
  test('secure + 587 → STARTTLS', () => {
    assert.ok(getSmtpTransportHint({ port: 587, secure: true }).includes('STARTTLS'))
  })
  test('plain → aviso sobre TLS explícito', () => {
    assert.ok(getSmtpTransportHint({ port: 587, secure: false }).includes('Verifica'))
  })
})

describe('getBrandConfig', () => {
  test('retorna objeto con keys requeridas', () => {
    const b = getBrandConfig()
    assert.ok(b.panelUrl)
    assert.ok(b.name)
    assert.ok(b.product)
    assert.ok(b.background)
    assert.ok(b.card)
  })
})
