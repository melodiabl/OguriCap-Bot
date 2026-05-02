/**
 * api/routes/grupos.js — /api/grupos/*
 * Extraído de lib/panel-api.js
 */
import { json, readJson, getJwtAuth, safeString, paginate, clampInt } from '../middleware/core.js'

export async function handleGrupos({ req, res, url, panelDb }) {
  const pathname = url.pathname
  const method = req.method.toUpperCase()

  // ── GET /api/grupos ───────────────────────────────────────────────────────
  if (pathname === '/api/grupos' && method === 'GET') {
    const grupos = Object.values(panelDb?.groups || {})
    const search = safeString(url.searchParams.get('search') || '').toLowerCase()
    const filtered = search ? grupos.filter(g => safeString(g?.nombre || g?.name || g?.wa_jid || '').toLowerCase().includes(search)) : grupos
    const page = url.searchParams.get('page')
    const limit = url.searchParams.get('limit')
    if (page || limit) {
      const { items, pagination } = paginate(filtered, { page, limit })
      return json(res, 200, { grupos: items, pagination })
    }
    return json(res, 200, { grupos: filtered, total: filtered.length })
  }

  // ── POST /api/grupos ──────────────────────────────────────────────────────
  if (pathname === '/api/grupos' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    const { wa_jid, nombre, bot_enabled } = body || {}
    if (!wa_jid) return json(res, 400, { error: 'wa_jid es requerido' })
    panelDb.groups ||= {}
    const id = wa_jid
    panelDb.groups[id] = { ...(panelDb.groups[id] || {}), wa_jid, nombre: nombre || wa_jid, bot_enabled: bot_enabled !== false, updated_at: new Date().toISOString() }
    try { const { emitGrupoUpdated } = await import('../../lib/socket-io.js'); emitGrupoUpdated(panelDb.groups[id]) } catch {}
    return json(res, 200, { success: true, grupo: panelDb.groups[id] })
  }

  // ── GET /api/grupos/available ─────────────────────────────────────────────
  if (pathname === '/api/grupos/available' && method === 'GET') {
    const grupos = Object.values(panelDb?.groups || {}).filter(g => g?.bot_enabled !== false)
    return json(res, 200, { grupos, total: grupos.length })
  }

  // ── GET /api/grupos/broadcast-targets ────────────────────────────────────
  if (pathname === '/api/grupos/broadcast-targets' && method === 'GET') {
    const grupos = Object.values(panelDb?.groups || {})
    const targets = grupos.map(g => ({ jid: g?.wa_jid || g?.jid, nombre: g?.nombre || g?.name || g?.wa_jid, bot_enabled: g?.bot_enabled !== false }))
    return json(res, 200, { targets, total: targets.length })
  }

  // ── GET /api/grupos/stats ─────────────────────────────────────────────────
  if (pathname === '/api/grupos/stats' && method === 'GET') {
    const grupos = Object.values(panelDb?.groups || {})
    return json(res, 200, {
      total: grupos.length,
      activos: grupos.filter(g => g?.bot_enabled !== false).length,
      inactivos: grupos.filter(g => g?.bot_enabled === false).length,
    })
  }

  // ── POST /api/grupos/sync ─────────────────────────────────────────────────
  if (pathname === '/api/grupos/sync' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    try {
      const conn = global.conn
      if (!conn) return json(res, 503, { error: 'Bot no conectado' })
      const chats = await conn.groupFetchAllParticipating?.() || {}
      panelDb.groups ||= {}
      let synced = 0
      for (const [jid, meta] of Object.entries(chats)) {
        panelDb.groups[jid] = { ...(panelDb.groups[jid] || {}), wa_jid: jid, nombre: meta?.subject || jid, participants: meta?.participants?.length || 0, updated_at: new Date().toISOString() }
        synced++
      }
      if (global.db?.write) await global.db.write()
      return json(res, 200, { success: true, synced })
    } catch (err) { return json(res, 500, { error: err?.message || 'Error sincronizando grupos' }) }
  }

  // ── GET /api/grupos/management ────────────────────────────────────────────
  if (pathname === '/api/grupos/management' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const grupos = Object.values(panelDb?.groups || {})
    return json(res, 200, { grupos, total: grupos.length })
  }

  // ── PATCH /api/grupos/:jid ────────────────────────────────────────────────
  const grupoMatch = pathname.match(/^\/api\/grupos\/(.+)$/)
  if (grupoMatch && (method === 'PATCH' || method === 'PUT')) {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const jid = decodeURIComponent(grupoMatch[1])
    if (!panelDb?.groups?.[jid]) return json(res, 404, { error: 'Grupo no encontrado' })
    const body = await readJson(req)
    Object.assign(panelDb.groups[jid], body, { updated_at: new Date().toISOString() })
    try { const { emitGrupoUpdated } = await import('../../lib/socket-io.js'); emitGrupoUpdated(panelDb.groups[jid]) } catch {}
    return json(res, 200, { success: true, grupo: panelDb.groups[jid] })
  }

  return json(res, 404, { error: 'Ruta no encontrada' })
}
