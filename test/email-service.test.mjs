import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeRecipients, getEmailServiceStatus } from '../lib/email/service.js'

describe('normalizeRecipients', () => {
  test('filtra emails inválidos', () => {
    const result = normalizeRecipients(['valid@test.com', 'invalid', 'also@valid.org'])
    assert.deepEqual(result, ['valid@test.com', 'also@valid.org'])
  })
  test('acepta string único', () => {
    assert.deepEqual(normalizeRecipients('a@b.com'), ['a@b.com'])
  })
  test('deduplica', () => {
    assert.deepEqual(normalizeRecipients(['a@b.com', 'a@b.com']), ['a@b.com'])
  })
  test('separa por coma', () => {
    assert.deepEqual(normalizeRecipients('a@b.com,c@d.com'), ['a@b.com', 'c@d.com'])
  })
  test('ignora null/undefined', () => {
    assert.deepEqual(normalizeRecipients([null, undefined, 'good@email.com']), ['good@email.com'])
  })
  test('array vacío → array vacío', () => {
    assert.deepEqual(normalizeRecipients([]), [])
  })
})

describe('getEmailServiceStatus', () => {
  test('retorna objeto con keys esperadas', () => {
    const status = getEmailServiceStatus()
    assert.ok('configured' in status)
    assert.ok('warnings' in status)
    assert.ok('brand' in status)
    assert.ok(Array.isArray(status.warnings))
    assert.ok(typeof status.brand.name === 'string')
  })
  test('configured es boolean', () => {
    assert.equal(typeof getEmailServiceStatus().configured, 'boolean')
  })
})
