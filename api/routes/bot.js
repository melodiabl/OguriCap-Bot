/**
 * api/routes/bot.js — /api/bot/* + /api/dashboard/*
 * Extraído de lib/panel-api.js
 */
import { json, readJson, getJwtAuth, safeString, clampInt } from '../middleware/core.js'

function isAdmin(user) {
  return ['owner', 'admin', 'administrador'].includes(safeString(user?.rol || '').toLowerCase())
}

export async function handleBot({ req, res, url, panelDb }) {
  const pathname = url.pathname
  const method = req.method.toUpperCase()

  // ── GET /api/bot/config ───────────────────────────────────────────────────
  if (pathname === '/api/bot/config' && method === 'GET') {
    return json(res, 200, panelDb?.botConfig || {})
  }

  // ── GET /api/bot/status ───────────────────────────────────────────────────
  if (pathname === '/api/bot/status' && method === 'GET') {
    return json(res, 200, {
      connected: global.stopped === 'open',
      status: global.stopped === 'open' ? 'connected' : 'disconnected',
      isOn: panelDb?.botGlobalState?.isOn !== false,
      uptime: process.uptime(),
    })
  }

  // ── GET /api/bot/auth/status ──────────────────────────────────────────────
  if (pathname === '/api/bot/auth/status' && method === 'GET') {
    return json(res, 200, {
      authenticated: global.stopped === 'open',
      status: global.stopped === 'open' ? 'authenticated' : 'unauthenticated',
    })
  }

  // ── PATCH|POST /api/bot/config ────────────────────────────────────────────
  if (pathname === '/api/bot/config' && (method === 'PATCH' || method === 'POST')) {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!['owner','admin','administrador'].includes(safeString(auth.user.rol).toLowerCase())) return json(res, 403, { error: 'Permisos insuficientes' })
    const body = await readJson(req)
    panelDb.botConfig = { ...(panelDb.botConfig || {}), ...(body || {}) }
    return json(res, 200, panelDb.botConfig)
  }

  // ── POST /api/bot/send ────────────────────────────────────────────────────
  if (pathname === '/api/bot/send' && method === 'POST') {
    if (!global.conn) return json(res, 503, { error: 'Bot no conectado' })
    const body = await readJson(req)
    const jid = safeString(body?.jid || body?.to || '').trim()
    const message = safeString(body?.message || body?.text || '').trim()
    if (!jid) return json(res, 400, { error: 'jid es requerido' })
    if (!message) return json(res, 400, { error: 'message es requerido' })
    try {
      const result = await global.conn.sendMessage(jid, { text: message })
      return json(res, 200, { success: true, messageId: result?.key?.id })
    } catch (err) { return json(res, 500, { error: err?.message || 'Error al enviar mensaje' }) }
  }

  // ── POST /api/bot/broadcast ───────────────────────────────────────────────
  if (pathname === '/api/bot/broadcast' && method === 'POST') {
    if (!global.conn) return json(res, 503, { error: 'Bot no conectado' })
    const body = await readJson(req)
    const jids = Array.isArray(body?.jids) ? body.jids : []
    const message = safeString(body?.message || body?.text || '').trim()
    if (!jids.length) return json(res, 400, { error: 'jids es requerido (array)' })
    if (!message) return json(res, 400, { error: 'message es requerido' })
    const results = []
    for (const jid of jids) {
      try {
        const r = await global.conn.sendMessage(jid, { text: message })
        results.push({ jid, success: true, messageId: r?.key?.id })
        await new Promise(r => setTimeout(r, 500))
      } catch (err) { results.push({ jid, success: false, error: err?.message }) }
    }
    return json(res, 200, { success: true, results, sent: results.filter(r => r.success).length, total: jids.length })
  }

  // ── GET /api/bot/global-state ─────────────────────────────────────────────
  if (pathname === '/api/bot/global-state' && method === 'GET') {
    return json(res, 200, panelDb?.botGlobalState || { isOn: true, lastUpdated: null })
  }

  // ── POST /api/bot/global-state ────────────────────────────────────────────
  if (pathname === '/api/bot/global-state' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!['owner','admin','administrador'].includes(safeString(auth.user.rol).toLowerCase())) return json(res, 403, { error: 'Permisos insuficientes' })
    const body = await readJson(req)
    const isOn = body?.isOn !== false
    panelDb.botGlobalState = { isOn, lastUpdated: new Date().toISOString() }
    try {
      const { emitBotStatus, emitNotification, getIO } = await import('../../lib/socket-io.js')
      emitBotStatus()
      getIO()?.emit('bot:globalStateChanged', { isOn })
      emitNotification({ type: isOn ? 'success' : 'warning', title: isOn ? 'Bot Activado Globalmente' : 'Bot Desactivado Globalmente', message: isOn ? 'El bot está operativo en todos los grupos.' : 'El bot no responderá en ningún grupo.', categoria: 'bot' })
    } catch {}
    return json(res, 200, { success: true, ...panelDb.botGlobalState })
  }

  // ── POST /api/bot/global-shutdown ─────────────────────────────────────────
  if (pathname === '/api/bot/global-shutdown' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!['owner','admin','administrador'].includes(safeString(auth.user.rol).toLowerCase())) return json(res, 403, { error: 'Permisos insuficientes' })
    panelDb.botGlobalState = { isOn: false, lastUpdated: new Date().toISOString() }
    try { const { emitBotStatus } = await import('../../lib/socket-io.js'); emitBotStatus() } catch {}
    return json(res, 200, { success: true, message: 'Bot global OFF' })
  }

  // ── POST /api/bot/global-startup ──────────────────────────────────────────
  if (pathname === '/api/bot/global-startup' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!['owner','admin','administrador'].includes(safeString(auth.user.rol).toLowerCase())) return json(res, 403, { error: 'Permisos insuficientes' })
    panelDb.botGlobalState = { isOn: true, lastUpdated: new Date().toISOString() }
    return json(res, 200, { success: true, message: 'Bot global ON' })
  }

  // ── GET|POST /api/bot/global-off-message ──────────────────────────────────
  if (pathname === '/api/bot/global-off-message') {
    if (method === 'GET') return json(res, 200, { message: panelDb?.botGlobalOffMessage || 'El bot está desactivado globalmente.' })
    if (method === 'POST') {
      const auth = await getJwtAuth(req)
      if (!auth.ok) return json(res, auth.status, { error: auth.error })
      const body = await readJson(req)
      const message = safeString(body?.message).trim()
      if (!message) return json(res, 400, { error: 'Mensaje inválido' })
      panelDb.botGlobalOffMessage = message
      return json(res, 200, { success: true, message: 'Mensaje actualizado' })
    }
  }

  // ── GET /api/bot/stats ────────────────────────────────────────────────────
  if (pathname === '/api/bot/stats' && method === 'GET') {
    try {
      const realTimeData = (await import('../../lib/real-time-data.js')).default
      return json(res, 200, realTimeData.getDashboardStats?.() || {})
    } catch { return json(res, 200, {}) }
  }

  // ── GET /api/bot/commands ─────────────────────────────────────────────────
  if (pathname === '/api/bot/commands' && method === 'GET') {
    const plugins = global.plugins || []
    return json(res, 200, { commands: plugins.map(p => ({ name: p.command || p.name, category: p.category || 'general', description: p.help || '' })) })
  }

  // ── GET /api/bot/commands/categories ─────────────────────────────────────
  if (pathname === '/api/bot/commands/categories' && method === 'GET') {
    const plugins = global.plugins || []
    const cats = [...new Set(plugins.map(p => p.category || 'general'))]
    return json(res, 200, { categories: cats })
  }

  // ── GET /api/bot/commands/stats ───────────────────────────────────────────
  if (pathname === '/api/bot/commands/stats' && method === 'GET') {
    const plugins = global.plugins || []
    return json(res, 200, { total: plugins.length })
  }

  // ── GET /api/dashboard/stats ──────────────────────────────────────────────
  if (pathname === '/api/dashboard/stats' && method === 'GET') {
    try {
      const realTimeData = (await import('../../lib/real-time-data.js')).default
      return json(res, 200, realTimeData.getDashboardStats?.() || {})
    } catch { return json(res, 500, { error: 'Error obteniendo stats' }) }
  }

  // ── GET /api/dashboard/recent-activity ───────────────────────────────────
  if (pathname === '/api/dashboard/recent-activity' && method === 'GET') {
    try {
      const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 50, fallback: 10 })
      const realTimeData = (await import('../../lib/real-time-data.js')).default
      const data = realTimeData.getRecentActivity?.(limit) || {}
      return json(res, 200, { data: data.activities || [], total: data.total || 0, lastUpdate: data.lastUpdate, systemStatus: data.systemStatus })
    } catch { return json(res, 500, { error: 'Error obteniendo actividad' }) }
  }

  // ── POST /api/bot/auth/pair ───────────────────────────────────────────────
  if (pathname === '/api/bot/auth/pair' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    const phoneNumber = safeString(body?.phoneNumber || '').replace(/[^0-9]/g, '')
    if (!phoneNumber) return json(res, 400, { error: 'phoneNumber es requerido' })
    if (typeof global.startMainAuth !== 'function') return json(res, 503, { error: 'Bot no inicializado' })
    const result = await global.startMainAuth({ method: 'pairing', phoneNumber })
    if (!result?.success) return json(res, 500, { error: result?.error || 'Error generando código' })
    return json(res, 200, result)
  }

  // ── POST /api/bot/auth/disconnect | /api/bot/disconnect ──────────────────
  if ((pathname === '/api/bot/auth/disconnect' || pathname === '/api/bot/disconnect') && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    if (typeof global.closeAuthConnection === 'function') await global.closeAuthConnection().catch(() => {})
    else if (global.conn) await global.conn.logout().catch(() => {})
    return json(res, 200, { success: true })
  }

  // ── GET /api/bot/auth/qr | /api/bot/qr | /api/bot/main/qr ───────────────
  if ((pathname === '/api/bot/auth/qr' || pathname === '/api/bot/qr' || pathname === '/api/bot/main/qr') && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const qr = global.panelApiMainQr || null
    return json(res, 200, { qr, available: Boolean(qr) })
  }

  // ── POST /api/bot/main/qr — iniciar auth QR ───────────────────────────────
  if (pathname === '/api/bot/main/qr' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (typeof global.startMainAuth !== 'function') return json(res, 503, { error: 'Bot no inicializado' })
    const result = await global.startMainAuth({ method: 'qr' })
    if (!result?.success) return json(res, 500, { error: result?.error || 'Error iniciando QR' })
    return json(res, 200, result)
  }

  // ── GET /api/bot/main/pairing-code ────────────────────────────────────────
  if (pathname === '/api/bot/main/pairing-code' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const code = global.panelPairingCode || null
    return json(res, 200, { pairingCode: code, available: Boolean(code) })
  }

  // ── POST /api/bot/restart ─────────────────────────────────────────────────
  if (pathname === '/api/bot/restart' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    setTimeout(async () => {
      try { if (global.reloadHandler) await global.reloadHandler(true) } catch {}
    }, 500)
    return json(res, 200, { success: true, message: 'Reiniciando...' })
  }

  // ── POST /api/bot/execute ─────────────────────────────────────────────────
  if (pathname === '/api/bot/execute' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const body = await readJson(req)
    const command = safeString(body?.command || '').trim()
    if (!command) return json(res, 400, { error: 'command es requerido' })
    try {
      const { exec } = await import('child_process')
      const output = await new Promise((resolve, reject) => {
        exec(command, { timeout: 10000 }, (err, stdout, stderr) => {
          if (err) reject(err)
          else resolve(stdout || stderr)
        })
      })
      return json(res, 200, { success: true, output })
    } catch (err) {
      return json(res, 500, { error: err?.message || 'Error ejecutando comando' })
    }
  }

  // ── GET /api/bot/categories | /api/bot/popular ───────────────────────────
  if ((pathname === '/api/bot/categories' || pathname === '/api/bot/popular') && method === 'GET') {
    const plugins = global.plugins || []
    if (pathname === '/api/bot/categories') {
      const cats = [...new Set(plugins.map(p => p.category || 'general'))]
      return json(res, 200, { categories: cats })
    }
    const popular = plugins.slice(0, 10).map(p => ({ name: p.command || p.name, uses: 0 }))
    return json(res, 200, { commands: popular })
  }

  // ── POST /api/bot/main/method ─────────────────────────────────────────────
  if (pathname === '/api/bot/main/method' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    const authMethod = safeString(body?.method || 'qr').toLowerCase()
    const phoneNumber = safeString(body?.phoneNumber || '').replace(/[^0-9]/g, '')
    if (typeof global.setMainAuthMethod === 'function') {
      await global.setMainAuthMethod(authMethod, phoneNumber || undefined).catch(() => {})
    } else if (panelDb) {
      panelDb.whatsapp = panelDb.whatsapp || {}
      panelDb.whatsapp.authMethod = authMethod
      if (phoneNumber) panelDb.whatsapp.phoneNumber = phoneNumber
    }
    return json(res, 200, { success: true, method: authMethod })
  }

  // ── POST /api/bot/main/restart ────────────────────────────────────────────
  if (pathname === '/api/bot/main/restart' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const body = await readJson(req)
    const authMethod = safeString(body?.method || '').toLowerCase()
    const phoneNumber = safeString(body?.phoneNumber || '').replace(/[^0-9]/g, '')
    if (authMethod && typeof global.startMainAuth === 'function') {
      // Iniciar auth directamente con el método indicado
      const result = await global.startMainAuth({ method: authMethod, phoneNumber: phoneNumber || undefined })
      return json(res, 200, { success: result?.success !== false, ...result })
    }
    setTimeout(async () => {
      try {
        global.panelApiMainDisconnect = false
        if (global.reloadHandler) await global.reloadHandler(true)
      } catch {}
    }, 500)
    return json(res, 200, { success: true, message: 'Reiniciando bot principal...' })
  }

  return json(res, 404, { error: 'Ruta no encontrada' })
}
