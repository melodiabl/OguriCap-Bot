/**
 * api/routes/subbots.js — /api/subbots/* + /api/subbot/*
 * Extraído de lib/panel-api.js
 * Nota: la lógica pesada (yukiJadiBot, sesiones) se delega a helpers de panel-api.js
 * hasta que sea migrada completamente.
 */
import { json, readJson, getJwtAuth, safeString } from '../middleware/core.js'

function isAdmin(user) {
  return ['owner', 'admin', 'administrador'].includes(safeString(user?.rol || '').toLowerCase())
}

export async function handleSubbots({ req, res, url, panelDb }) {
  const pathname = url.pathname
  const method = req.method.toUpperCase()

  // Delegar a panel-api.js para rutas que aún tienen lógica compleja no migrada
  // Esto permite migración incremental sin romper funcionalidad
  const { handleSubbotsLegacy } = await import('../../lib/panel-api.js').catch(() => ({ handleSubbotsLegacy: null }))

  // ── GET /api/subbots ──────────────────────────────────────────────────────
  if ((pathname === '/api/subbots' || pathname === '/api/subbot/list') && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const subbots = Object.values(panelDb?.subbots || {})
    const list = isAdmin(auth.user) ? subbots : subbots.filter(s => safeString(s?.usuario) === safeString(auth.user.username))
    return json(res, 200, list)
  }

  // ── GET /api/subbots/status | /api/subbot/status ──────────────────────────
  if ((pathname === '/api/subbots/status' || pathname === '/api/subbot/status') && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const subbots = Object.values(panelDb?.subbots || {})
    const list = isAdmin(auth.user) ? subbots : subbots.filter(s => safeString(s?.usuario) === safeString(auth.user.username))
    return json(res, 200, { subbots: list.map(s => ({ subbotId: s.code, isOnline: s.isOnline || false, status: s.status || 'unknown', connectionState: s.connectionState || 'close' })) })
  }

  // ── GET /api/subbot/capacity ──────────────────────────────────────────────
  if (pathname === '/api/subbot/capacity' && method === 'GET') {
    try {
      const { getSubbotCapacityInfo } = await import('../../lib/subbot-capacity.js')
      const auth = await getJwtAuth(req)
      if (!auth.ok) return json(res, auth.status, { error: auth.error })
      const info = getSubbotCapacityInfo(panelDb, auth.user)
      return json(res, 200, info)
    } catch { return json(res, 200, { canCreate: true, current: 0, max: -1 }) }
  }

  // ── POST /api/subbots/reindex | /api/subbot/reindex ───────────────────────
  if ((pathname === '/api/subbots/reindex' || pathname === '/api/subbot/reindex') && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    try { const { emitSubbotStatus } = await import('../../lib/socket-io.js'); emitSubbotStatus() } catch {}
    const list = Object.values(panelDb?.subbots || {})
    return json(res, 200, { success: true, count: list.length })
  }

  // ── POST /api/subbots/normalize | /api/subbot/normalize ───────────────────
  if ((pathname === '/api/subbots/normalize' || pathname === '/api/subbot/normalize') && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    return json(res, 200, { success: true, message: 'Normalización completada' })
  }

  // ── POST /api/subbots/qr — crear subbot con QR ────────────────────────────
  if (pathname === '/api/subbots/qr' && method === 'POST') {
    if (handleSubbotsLegacy) return handleSubbotsLegacy({ req, res, url, panelDb, action: 'qr' })
    return json(res, 501, { error: 'No implementado' })
  }

  // ── POST /api/subbots/code — crear subbot con código ─────────────────────
  if (pathname === '/api/subbots/code' && method === 'POST') {
    if (handleSubbotsLegacy) return handleSubbotsLegacy({ req, res, url, panelDb, action: 'code' })
    return json(res, 501, { error: 'No implementado' })
  }

  // ── POST /api/subbot/create ───────────────────────────────────────────────
  if (pathname === '/api/subbot/create' && method === 'POST') {
    if (handleSubbotsLegacy) return handleSubbotsLegacy({ req, res, url, panelDb, action: 'create' })
    return json(res, 501, { error: 'No implementado' })
  }

  // ── POST /api/subbot/settings ─────────────────────────────────────────────
  if (pathname === '/api/subbot/settings' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    const code = safeString(body?.code || body?.subbotId || '').trim()
    if (!code) return json(res, 400, { error: 'code es requerido' })
    const subbot = panelDb?.subbots?.[code]
    if (!subbot) return json(res, 404, { error: 'Subbot no encontrado' })
    if (!isAdmin(auth.user) && safeString(subbot.usuario) !== safeString(auth.user.username)) return json(res, 403, { error: 'Sin permisos' })
    const allowed = ['nombre', 'prefix', 'auto_read', 'auto_typing', 'welcome_enabled', 'welcome_message']
    for (const k of allowed) { if (k in body) subbot[k] = body[k] }
    subbot.updated_at = new Date().toISOString()
    if (global.db?.write) await global.db.write()
    try { const { emitSubbotUpdated } = await import('../../lib/socket-io.js'); emitSubbotUpdated(subbot) } catch {}
    return json(res, 200, { success: true, subbot })
  }

  // ── DELETE /api/subbot/:code ──────────────────────────────────────────────
  const deleteMatch = pathname.match(/^\/api\/subbot\/([^/]+)$/)
  if (deleteMatch && method === 'DELETE') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const code = decodeURIComponent(deleteMatch[1])
    const subbot = panelDb?.subbots?.[code]
    if (!subbot) return json(res, 404, { error: 'Subbot no encontrado' })
    if (!isAdmin(auth.user) && safeString(subbot.usuario) !== safeString(auth.user.username)) return json(res, 403, { error: 'Sin permisos' })
    delete panelDb.subbots[code]
    if (global.db?.write) await global.db.write()
    try { const { emitSubbotDeleted } = await import('../../lib/socket-io.js'); emitSubbotDeleted(code) } catch {}
    return json(res, 200, { success: true, message: 'Subbot eliminado' })
  }

  return json(res, 404, { error: 'Ruta no encontrada' })
}
