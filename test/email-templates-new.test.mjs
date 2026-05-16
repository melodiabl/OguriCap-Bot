import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { buildRoleChangedEmail } from '../lib/email/templates/role-changed.js'

describe('buildRoleChangedEmail', () => {
  const result = buildRoleChangedEmail({ username: 'María', oldRole: 'Usuario', newRole: 'Admin' })
  test('retorna html, subject, text', () => {
    assert.ok(typeof result.html === 'string')
    assert.ok(typeof result.subject === 'string')
    assert.ok(typeof result.text === 'string')
  })
  test('html contiene newRole', () => assert.ok(result.html.includes('Admin')))
  test('html contiene oldRole', () => assert.ok(result.html.includes('Usuario')))
  test('subject contiene "rol"', () => assert.ok(result.subject.toLowerCase().includes('rol')))
})
