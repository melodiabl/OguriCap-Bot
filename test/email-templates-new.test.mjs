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

import { buildLoginNewDeviceEmail } from '../lib/email/templates/login-new-device.js'

describe('buildLoginNewDeviceEmail', () => {
  const result = buildLoginNewDeviceEmail({ username: 'María', ip: '192.168.1.1', location: 'Buenos Aires', device: 'Chrome' })
  test('retorna html string',             () => assert.ok(typeof result.html === 'string'))
  test('html contiene IP',               () => assert.ok(result.html.includes('192.168.1.1')))
  test('html contiene location',         () => assert.ok(result.html.includes('Buenos Aires')))
  test('html contiene aviso contraseña', () => assert.ok(result.html.includes('contraseña')))
  test('subject contiene "Acceso"',      () => assert.ok(result.subject.includes('Acceso')))
})

import { buildAccountDeletedEmail } from '../lib/email/templates/account-deleted.js'

describe('buildAccountDeletedEmail', () => {
  const result = buildAccountDeletedEmail({ username: 'testuser', deletedBy: 'admin', reason: 'Inactividad' })
  test('retorna html string',         () => assert.ok(typeof result.html === 'string'))
  test('html contiene username',      () => assert.ok(result.html.includes('testuser')))
  test('html contiene deletedBy',     () => assert.ok(result.html.includes('admin')))
  test('html contiene reason',        () => assert.ok(result.html.includes('Inactividad')))
  test('sin CTA — no hay href de acceso', () => {
    const r = buildAccountDeletedEmail({ username: 'u', deletedBy: 'sistema' })
    assert.ok(!r.html.includes('Ver mi perfil'))
  })
})

import { buildAporteAceptadoEmail } from '../lib/email/templates/aporte-aceptado.js'
import { buildAporteRechazadoEmail } from '../lib/email/templates/aporte-rechazado.js'
import { buildAportePendienteEmail } from '../lib/email/templates/aporte-pendiente.js'

describe('buildAporteAceptadoEmail', () => {
  const result = buildAporteAceptadoEmail({ username: 'Juan', amount: '$500', concept: 'Mes mayo', acceptedBy: 'admin' })
  test('retorna html string', () => assert.ok(typeof result.html === 'string'))
  test('html contiene amount', () => assert.ok(result.html.includes('$500')))
  test('html contiene ACEPTADO', () => assert.ok(result.html.includes('ACEPTADO')))
  test('subject contiene aceptado', () => assert.ok(result.subject.toLowerCase().includes('aceptado')))
})

describe('buildAporteRechazadoEmail', () => {
  const result = buildAporteRechazadoEmail({ username: 'Juan', amount: '$500', reason: 'Comprobante ilegible' })
  test('retorna html string', () => assert.ok(typeof result.html === 'string'))
  test('html contiene RECHAZADO', () => assert.ok(result.html.includes('RECHAZADO')))
  test('html contiene reason', () => assert.ok(result.html.includes('Comprobante ilegible')))
  test('subject contiene procesado', () => assert.ok(result.subject.toLowerCase().includes('procesado')))
})

describe('buildAportePendienteEmail', () => {
  const result = buildAportePendienteEmail({ username: 'María', amount: '$1000', dueDate: '31/05/2026' })
  test('retorna html string', () => assert.ok(typeof result.html === 'string'))
  test('html contiene PENDIENTE', () => assert.ok(result.html.includes('PENDIENTE')))
  test('html contiene dueDate', () => assert.ok(result.html.includes('31/05/2026')))
  test('subject contiene pendiente', () => assert.ok(result.subject.toLowerCase().includes('pendiente')))
})
