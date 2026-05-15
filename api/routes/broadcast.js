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
      const { sendBroadcastEmail } = await import('../../lib/email-service.js')
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
      const { getIO } = await import('../../lib/socket-io.js')
      getIO()?.emit('push:notification', body)
    } catch {}
    return json(res, 200, { success: true })
  }

  // ── /api/email/status ─────────────────────────────────────────────────────
  if (pathname === '/api/email/status' && method === 'GET') {
    try {
      const { getEmailServiceStatus } = await import('../../lib/email-service.js')
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
      const { sendTestEmail } = await import('../../lib/email-service.js')
      await sendTestEmail?.({ to: body?.to || auth.user.email })
      return json(res, 200, { success: true })
    } catch (err) { return json(res, 500, { error: err?.message || 'Error enviando email de prueba' }) }
  }

  // ── /api/email/verify & preview ───────────────────────────────────────────
  if (pathname === '/api/email/verify' && method === 'POST') return json(res, 200, { success: true })
  if (pathname === '/api/email/preview' && method === 'GET') {
    try {
      const type = url.searchParams.get('template') || 'test'
      const { getEmailTemplatePreview } = await import('../../lib/email-service.js')
      const preview = getEmailTemplatePreview?.(type)
      return json(res, 200, { html: preview?.html || '', subject: preview?.subject || '', recipient: preview?.recipient || '' })
    } catch { return json(res, 200, { html: '', subject: '', recipient: '' }) }
  }

  if (pathname === '/api/email/preview' && method === 'POST') {
    try {
      const body = await readJson(req)
      const { renderPanelEmail, getBrandConfig } = await import('../../lib/email-service.js')
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
