/**
 * api/routes/broadcast.js — /api/broadcast/**, /api/email/**, /api/scheduled-messages/**
 */
import { json, readJson, getJwtAuth, safeString } from '../middleware/core.js'
import { heavyLimiter } from '../middleware/rate-limit.js'

function isAdmin(user) {
  return ['owner', 'admin', 'administrador'].includes(safeString(user?.rol || '').toLowerCase())
}

export async function handleBroadcast({ req, res, url, panelDb }) {
  const pathname = url.pathname
  const method = req.method.toUpperCase()

  // ── /api/broadcast (WhatsApp) ─────────────────────────────────────────────
  if (pathname === '/api/broadcast' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    if (!heavyLimiter(req, res)) return json(res, 429, { error: 'Demasiadas solicitudes' })
    const body = await readJson(req)
    const { message, targets } = body || {}
    if (!message) return json(res, 400, { error: 'message es requerido' })
    const conn = global.conn
    if (!conn) return json(res, 503, { error: 'Bot no conectado' })
    const jids = Array.isArray(targets) ? targets : Object.values(panelDb?.groups || {}).map(g => g?.wa_jid).filter(Boolean)
    const results = []
    for (const jid of jids) {
      try {
        await conn.sendMessage(jid, { text: message })
        results.push({ jid, success: true })
        await new Promise(r => setTimeout(r, 300))
      } catch (err) { results.push({ jid, success: false, error: err?.message }) }
    }
    return json(res, 200, { success: true, sent: results.filter(r => r.success).length, total: jids.length, results })
  }

  // ── /api/broadcast/full ───────────────────────────────────────────────────
  if (pathname === '/api/broadcast/full' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    if (!heavyLimiter(req, res)) return json(res, 429, { error: 'Demasiadas solicitudes' })
    const body = await readJson(req)
    const { message, targets } = body || {}
    if (!message) return json(res, 400, { error: 'message es requerido' })
    const conn = global.conn
    if (!conn) return json(res, 503, { error: 'Bot no conectado' })
    const jids = Array.isArray(targets) ? targets : Object.values(panelDb?.groups || {}).map(g => g?.wa_jid).filter(Boolean)
    const results = []
    for (const jid of jids) {
      try {
        await conn.sendMessage(jid, { text: message })
        results.push({ jid, success: true })
        await new Promise(r => setTimeout(r, 300))
      } catch (err) { results.push({ jid, success: false, error: err?.message }) }
    }
    return json(res, 200, { success: true, sent: results.filter(r => r.success).length, total: jids.length, results })
  }

  // ── /api/broadcast/email ──────────────────────────────────────────────────
  if (pathname === '/api/broadcast/email' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const body = await readJson(req)
    try {
      const { sendBroadcastEmail } = await import('../email/index.js')
      await sendBroadcastEmail?.(body)
      return json(res, 200, { success: true })
    } catch (err) { return json(res, 500, { error: err?.message || 'Error enviando email broadcast' }) }
  }

  // ── /api/broadcast/push ───────────────────────────────────────────────────
  if (pathname === '/api/broadcast/push' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    try {
      const { getIO } = await import('../socket-io.js')
      getIO()?.emit('push:notification', body)
    } catch {}
    return json(res, 200, { success: true })
  }

  // ── /api/email/status ─────────────────────────────────────────────────────
  if (pathname === '/api/email/status' && method === 'GET') {
    try {
      const { getEmailServiceStatus } = await import('../email/index.js')
      return json(res, 200, getEmailServiceStatus?.() || { configured: false })
    } catch { return json(res, 200, { configured: false }) }
  }

  // ── /api/email/test ───────────────────────────────────────────────────────
  if (pathname === '/api/email/test' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const body = await readJson(req)
    try {
      const { sendTestEmail } = await import('../email/index.js')
      await sendTestEmail?.({ to: body?.to || auth.user.email })
      return json(res, 200, { success: true })
    } catch (err) { return json(res, 500, { error: err?.message || 'Error enviando email de prueba' }) }
  }

  // ── /api/email/verify & preview ───────────────────────────────────────────
  if (pathname === '/api/email/verify' && method === 'POST') return json(res, 200, { success: true })
  if (pathname === '/api/email/preview' && method === 'GET') {
    try {
      const type = url.searchParams.get('template') || 'test'
      const { getEmailTemplatePreview } = await import('../email/index.js')
      const preview = getEmailTemplatePreview?.(type)
      return json(res, 200, { html: preview?.html || '', subject: preview?.subject || '', recipient: preview?.recipient || '' })
    } catch { return json(res, 200, { html: '', subject: '', recipient: '' }) }
  }

  if (pathname === '/api/email/preview' && method === 'POST') {
    try {
      const body = await readJson(req)
      const { renderPanelEmail, getBrandConfig } = await import('../email/index.js')
      const brand = getBrandConfig()
      const subject = String(body?.subject || 'Broadcast').trim()
      const title = String(body?.title || subject).trim()
      const content = String(body?.content || '').trim()
      const contentHtml = content
        ? content.replace(/\n/g, '<br />')
        : '<p style="color:#94a3b8;">Sin contenido aún.</p>'
      const html = renderPanelEmail({
        subject,
        preheader: content.slice(0, 100),
        title,
        contentHtml,
        ctaUrl: brand.panelUrl,
        ctaText: 'Ver en el panel',
      })
      return json(res, 200, { html, subject })
    } catch { return json(res, 200, { html: '', subject: '' }) }
  }

  // ── /api/email/send — admin manual send ───────────────────────────────────────
  if (pathname === '/api/email/send' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!['owner', 'admin', 'administrador'].includes(auth.user?.rol)) {
      return json(res, 403, { error: 'Solo administradores pueden enviar emails manuales' })
    }

    let body
    try { body = await readJson(req) } catch { return json(res, 400, { error: 'JSON inválido' }) }

    const { template, to, ...params } = body || {}
    if (!template || !to) return json(res, 400, { error: 'template y to son requeridos' })

    try {
      const emailLib = await import('../email/index.js')

      const TEMPLATE_MAP = {
        'maintenance-notice':     'sendMaintenanceNoticeEmail',
        'maintenance-completed':  'sendMaintenanceCompletedEmail',
        'account-suspended':      'sendAccountSuspendedEmail',
        'account-reactivated': 'sendAccountReactivatedEmail',
        'subbot-created':      'sendSubbotCreatedEmail',
        'subbot-deleted':      'sendSubbotDeletedEmail',
        'two-factor-code':     'sendTwoFactorCodeEmail',
        'system-alert':        'sendSystemAlertEmail',
        'notification':        'sendNotificationEmail',
        'security-alert':      'sendSecurityAlertEmail',
      }

      const fnName = TEMPLATE_MAP[template]
      if (!fnName || typeof emailLib[fnName] !== 'function') {
        return json(res, 400, { error: `Template desconocido: ${template}` })
      }

      await emailLib[fnName]({ to, ...params })
      return json(res, 200, { success: true, template, to })
    } catch (err) {
      return json(res, 500, { error: err?.message || 'Error al enviar email' })
    }
  }

  // ── /api/email/broadcast-all — envío masivo a todos los usuarios con email ──
  if (pathname === '/api/email/broadcast-all' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Solo administradores pueden enviar emails masivos' })

    let body
    try { body = await readJson(req) } catch { return json(res, 400, { error: 'JSON inválido' }) }

    const { title, message, priority = 'normal', preset = 'custom' } = body || {}
    if (!message?.trim()) return json(res, 400, { error: 'message es requerido' })

    try {
      const { pgListUsers } = await import('../lib/pg-usuarios.js')
      const { sendGlobalBroadcastEmail } = await import('../email/broadcast.js')

      const allUsers = await pgListUsers()
      const targets = allUsers.filter(u => u.email && String(u.email).includes('@'))

      let sent = 0, failed = 0
      for (const u of targets) {
        try {
          await sendGlobalBroadcastEmail({
            to: u.email,
            preset: String(preset || 'custom'),
            title: String(title || 'Aviso del sistema').trim(),
            message: String(message).trim(),
            priority,
          })
          sent++
        } catch { failed++ }
      }

      return json(res, 200, { success: true, sent, failed, total: targets.length })
    } catch (err) {
      return json(res, 500, { error: err?.message || 'Error al enviar emails' })
    }
  }

  // ── /api/email/broadcast-all (GET) — contar destinatarios ────────────────
  if (pathname === '/api/email/broadcast-all' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Acceso denegado' })
    try {
      const { pgListUsers } = await import('../lib/pg-usuarios.js')
      const allUsers = await pgListUsers()
      const count = allUsers.filter(u => u.email && String(u.email).includes('@')).length
      return json(res, 200, { count })
    } catch { return json(res, 200, { count: 0 }) }
  }

  // ── /api/email/maintenance-broadcast — envío selectivo de mantenimiento ────
  if (pathname === '/api/email/maintenance-broadcast' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Solo administradores pueden enviar emails de mantenimiento' })

    let body
    try { body = await readJson(req) } catch { return json(res, 400, { error: 'JSON inválido' }) }

    const {
      startTime, durationMinutes, affectedServices = [], unaffectedServices = [],
      reason = '', contactEmail = '',
      recipients = 'all', // 'all' | 'admins' | array of emails
    } = body || {}

    if (!startTime || !durationMinutes) return json(res, 400, { error: 'startTime y durationMinutes son requeridos' })

    try {
      const { pgListUsers } = await import('../lib/pg-usuarios.js')
      const { sendMaintenanceNoticeEmail } = await import('../email/index.js')

      const allUsers = await pgListUsers()
      let targets = allUsers.filter(u => u.email && String(u.email).includes('@'))

      if (recipients === 'admins') {
        targets = targets.filter(u => ['owner', 'admin', 'administrador'].includes(safeString(u?.rol || '').toLowerCase()))
      } else if (Array.isArray(recipients)) {
        const allowed = new Set(recipients.map(e => String(e).toLowerCase().trim()))
        targets = targets.filter(u => allowed.has(String(u.email).toLowerCase().trim()))
      }

      let sent = 0, failed = 0
      for (const u of targets) {
        try {
          await sendMaintenanceNoticeEmail({
            to: u.email, startTime, durationMinutes,
            affectedServices, unaffectedServices, reason, contactEmail,
          })
          sent++
        } catch { failed++ }
      }

      return json(res, 200, { success: true, sent, failed, total: targets.length })
    } catch (err) {
      return json(res, 500, { error: err?.message || 'Error al enviar emails de mantenimiento' })
    }
  }

  // ── /api/email/maintenance-completed-broadcast ────────────────────────────
  if (pathname === '/api/email/maintenance-completed-broadcast' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Solo administradores pueden enviar este email' })

    let body
    try { body = await readJson(req) } catch { return json(res, 400, { error: 'JSON inválido' }) }

    const {
      completedAt = '',
      durationMinutes = '',
      restoredServices = [],
      note = '',
      recipients = 'all', // 'all' | 'admins'
    } = body || {}

    try {
      const { pgListUsers } = await import('../lib/pg-usuarios.js')
      const { sendMaintenanceCompletedEmail } = await import('../email/index.js')

      const allUsers = await pgListUsers()
      let targets = allUsers.filter(u => u.email && String(u.email).includes('@'))

      if (recipients === 'admins') {
        targets = targets.filter(u => ['owner', 'admin', 'administrador'].includes(safeString(u?.rol || '').toLowerCase()))
      }

      let sent = 0, failed = 0
      for (const u of targets) {
        try {
          await sendMaintenanceCompletedEmail({ to: u.email, completedAt, durationMinutes, restoredServices, note })
          sent++
        } catch { failed++ }
      }

      return json(res, 200, { success: true, sent, failed, total: targets.length })
    } catch (err) {
      return json(res, 500, { error: err?.message || 'Error al enviar emails de mantenimiento completado' })
    }
  }

  // ── /api/scheduled-messages ───────────────────────────────────────────────
  if (pathname === '/api/scheduled-messages' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const messages = Object.values(panelDb?.scheduledMessages || {})
    return json(res, 200, { messages, total: messages.length })
  }

  if (pathname === '/api/scheduled-messages' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    if (!body?.message || !body?.jid) return json(res, 400, { error: 'message y jid son requeridos' })
    const id = Date.now()
    const record = { id, ...body, createdAt: new Date().toISOString(), createdBy: auth.user.username, status: 'pending' }
    panelDb.scheduledMessages ||= {}
    panelDb.scheduledMessages[id] = record
    if (global.db?.write) await global.db.write()
    return json(res, 201, { success: true, message: record })
  }
}
