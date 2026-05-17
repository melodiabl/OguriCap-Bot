import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { buildRoleChangedEmail } from '../api/email/templates/role-changed.js'

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

import { buildBotAlertEmail } from '../api/email/templates/bot-alert.js'

describe('buildBotAlertEmail', () => {
  const disconnected = buildBotAlertEmail({ botName: 'OguriBot', status: 'disconnected', reason: 'Timeout' })
  const reconnected  = buildBotAlertEmail({ botName: 'OguriBot', status: 'reconnected' })
  test('disconnected: html contiene botName', () => assert.ok(disconnected.html.includes('OguriBot')))
  test('disconnected: html contiene reason',  () => assert.ok(disconnected.html.includes('Timeout')))
  test('reconnected: html contiene botName',  () => assert.ok(reconnected.html.includes('OguriBot')))
  test('disconnected: html contiene icon 🔴',   () => assert.ok(disconnected.html.includes('🔴')))
  test('reconnected: html contiene icon 🟢',    () => assert.ok(reconnected.html.includes('🟢')))
})

import { buildSubbotAlertEmail } from '../api/email/templates/subbot-alert.js'

describe('buildSubbotAlertEmail', () => {
  const result = buildSubbotAlertEmail({ subbotNumber: '+5491155555555', status: 'disconnected', reason: 'QR expirado' })
  test('retorna html string',           () => assert.ok(typeof result.html === 'string'))
  test('html contiene subbotNumber',    () => assert.ok(result.html.includes('+5491155555555')))
  test('html contiene reason',          () => assert.ok(result.html.includes('QR expirado')))
  test('subject contiene "sub-bot"',     () => assert.ok(result.subject.toLowerCase().includes('sub-bot')))
})

import { buildAporteReceivedEmail } from '../api/email/templates/aporte-received.js'

describe('buildAporteReceivedEmail', () => {
  const result = buildAporteReceivedEmail({ username: 'Juan', amount: '$500', concept: 'Mes de octubre', date: '16/05/2026' })
  test('retorna html string',     () => assert.ok(typeof result.html === 'string'))
  test('html contiene amount',    () => assert.ok(result.html.includes('$500')))
  test('html contiene username',  () => assert.ok(result.html.includes('Juan')))
  test('html contiene concept',   () => assert.ok(result.html.includes('Mes de octubre')))
  test('subject contiene "aporte"', () => assert.ok(result.subject.toLowerCase().includes('aporte')))
})

import { buildLoginNewDeviceEmail } from '../api/email/templates/login-new-device.js'

describe('buildLoginNewDeviceEmail', () => {
  const result = buildLoginNewDeviceEmail({ username: 'María', ip: '192.168.1.1', location: 'Buenos Aires', device: 'Chrome' })
  test('retorna html string',             () => assert.ok(typeof result.html === 'string'))
  test('html contiene IP',               () => assert.ok(result.html.includes('192.168.1.1')))
  test('html contiene location',         () => assert.ok(result.html.includes('Buenos Aires')))
  test('html contiene aviso contraseña', () => assert.ok(result.html.includes('contraseña')))
  test('subject contiene "Acceso"',      () => assert.ok(result.subject.includes('Acceso')))
})

import { buildAccountDeletedEmail } from '../api/email/templates/account-deleted.js'

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

import { buildAporteAceptadoEmail } from '../api/email/templates/aporte-aceptado.js'
import { buildAporteRechazadoEmail } from '../api/email/templates/aporte-rechazado.js'
import { buildAportePendienteEmail } from '../api/email/templates/aporte-pendiente.js'

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
  test('subject contiene rechazado', () => assert.ok(result.subject.toLowerCase().includes('rechazado')))
})

describe('buildAportePendienteEmail', () => {
  const result = buildAportePendienteEmail({ username: 'María', amount: '$1000', dueDate: '31/05/2026' })
  test('retorna html string', () => assert.ok(typeof result.html === 'string'))
  test('html contiene EN REVISIÓN', () => assert.ok(result.html.includes('EN REVISIÓN')))
  test('html contiene dueDate', () => assert.ok(result.html.includes('31/05/2026')))
  test('subject contiene revisión', () => assert.ok(result.subject.toLowerCase().includes('revisi')))
})

import { buildMaintenanceNoticeEmail } from '../api/email/templates/maintenance-notice.js'
import { buildAccountSuspendedEmail } from '../api/email/templates/account-suspended.js'
import { buildAccountReactivatedEmail } from '../api/email/templates/account-reactivated.js'
import { buildSubbotCreatedEmail } from '../api/email/templates/subbot-created.js'
import { buildSubbotDeletedEmail } from '../api/email/templates/subbot-deleted.js'
import { buildTwoFactorCodeEmail } from '../api/email/templates/two-factor-code.js'
import { buildSystemAlertEmail } from '../api/email/templates/system-alert.js'

describe('maintenance-notice', () => {
  const r = buildMaintenanceNoticeEmail({ startTime: '03:00 AM', durationMinutes: 30 })
  test('subject contiene mantenimiento', () => assert.ok(r.subject.toLowerCase().includes('mantenimiento')))
  test('html contiene startTime', () => assert.ok(r.html.includes('03:00 AM')))
  test('html es type warning (color dorado)', () => assert.ok(r.html.includes('#fbbf24')))
  test('html contiene ícono', () => assert.ok(r.html.includes('🛠️')))
  test('affectedServices se listan', () => {
    const r2 = buildMaintenanceNoticeEmail({ startTime: 'T', durationMinutes: 10, affectedServices: ['Panel', 'API'] })
    assert.ok(r2.html.includes('Panel'))
    assert.ok(r2.html.includes('API'))
  })
})

describe('account-suspended', () => {
  const r = buildAccountSuspendedEmail({ username: 'juan', suspendedBy: 'Admin', reason: 'fraude' })
  test('html contiene username', () => assert.ok(r.html.includes('juan')))
  test('html es type danger (color rosa)', () => assert.ok(r.html.includes('#ff4d8d')))
  test('html contiene motivo', () => assert.ok(r.html.includes('fraude')))
})

describe('account-reactivated', () => {
  const r = buildAccountReactivatedEmail({ username: 'juan', reactivatedBy: 'Admin' })
  test('html contiene username', () => assert.ok(r.html.includes('juan')))
  test('html es type success (color verde)', () => assert.ok(r.html.includes('#25d366')))
})

describe('subbot-created', () => {
  const r = buildSubbotCreatedEmail({ subbotName: 'TestBot', subbotNumber: '+549111', createdBy: 'Admin' })
  test('html contiene nombre', () => assert.ok(r.html.includes('TestBot')))
  test('html es type success', () => assert.ok(r.html.includes('#25d366')))
})

describe('subbot-deleted', () => {
  const r = buildSubbotDeletedEmail({ subbotName: 'TestBot', deletedBy: 'Admin' })
  test('html contiene nombre', () => assert.ok(r.html.includes('TestBot')))
  test('html es type danger', () => assert.ok(r.html.includes('#ff4d8d')))
})

describe('two-factor-code', () => {
  const r = buildTwoFactorCodeEmail({ username: 'juan', code: '482917', expiresMinutes: 5 })
  test('html contiene el código', () => assert.ok(r.html.includes('482917')))
  test('html no tiene CTA link', () => assert.ok(!r.html.includes('href="http')))
  test('html es type info (teal)', () => assert.ok(r.html.includes('#2dd4bf')))
  test('subject contiene el código', () => assert.ok(r.subject.includes('482917')))
})

describe('system-alert', () => {
  test('level warning → type warning (dorado)', () => {
    const r = buildSystemAlertEmail({ metric: 'memory_usage', value: '91%', threshold: '85%', level: 'warning' })
    assert.ok(r.html.includes('#fbbf24'))
  })
  test('level critical → type danger (rosa)', () => {
    const r = buildSystemAlertEmail({ metric: 'cpu_usage', value: '99%', threshold: '90%', level: 'critical' })
    assert.ok(r.html.includes('#ff4d8d'))
    assert.ok(r.html.includes('CRÍTICO'))
  })
  test('html contiene la métrica', () => {
    const r = buildSystemAlertEmail({ metric: 'disk_usage', value: '95%', threshold: '80%' })
    assert.ok(r.html.includes('disk_usage'))
  })
})
