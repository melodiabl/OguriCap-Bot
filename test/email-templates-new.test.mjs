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

import { buildBotAlertEmail } from '../lib/email/templates/bot-alert.js'

describe('buildBotAlertEmail', () => {
  const disconnected = buildBotAlertEmail({ botName: 'OguriBot', status: 'disconnected', reason: 'Timeout' })
  const reconnected  = buildBotAlertEmail({ botName: 'OguriBot', status: 'reconnected' })
  test('disconnected: html contiene botName', () => assert.ok(disconnected.html.includes('OguriBot')))
  test('disconnected: html contiene reason',  () => assert.ok(disconnected.html.includes('Timeout')))
  test('reconnected: html contiene botName',  () => assert.ok(reconnected.html.includes('OguriBot')))
  test('disconnected: subject contiene 🔴',   () => assert.ok(disconnected.subject.includes('🔴')))
  test('reconnected: subject contiene 🟢',    () => assert.ok(reconnected.subject.includes('🟢')))
})

import { buildSubbotAlertEmail } from '../lib/email/templates/subbot-alert.js'

describe('buildSubbotAlertEmail', () => {
  const result = buildSubbotAlertEmail({ subbotNumber: '+5491155555555', status: 'disconnected', reason: 'QR expirado' })
  test('retorna html string',           () => assert.ok(typeof result.html === 'string'))
  test('html contiene subbotNumber',    () => assert.ok(result.html.includes('+5491155555555')))
  test('html contiene reason',          () => assert.ok(result.html.includes('QR expirado')))
  test('subject contiene "Subbot"',     () => assert.ok(result.subject.includes('Subbot')))
})

import { buildAporteReceivedEmail } from '../lib/email/templates/aporte-received.js'

describe('buildAporteReceivedEmail', () => {
  const result = buildAporteReceivedEmail({ username: 'Juan', amount: '$500', concept: 'Mes de octubre', date: '16/05/2026' })
  test('retorna html string',     () => assert.ok(typeof result.html === 'string'))
  test('html contiene amount',    () => assert.ok(result.html.includes('$500')))
  test('html contiene username',  () => assert.ok(result.html.includes('Juan')))
  test('html contiene concept',   () => assert.ok(result.html.includes('Mes de octubre')))
  test('subject contiene "aporte"', () => assert.ok(result.subject.toLowerCase().includes('aporte')))
})
