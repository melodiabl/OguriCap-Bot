/**
 * api/routes/grupos.js — /api/grupos/*
 * Extraído de lib/panel-api.js
 */
import { json, readJson, getJwtAuth, safeString, paginate, clampInt } from '../middleware/core.js'

const cache = { grupos: null, at: 0 }
const CACHE_TTL = 30_000

export async function handleGrupos({ req, res, url, panelDb }) {
  const pathname = url.pathname
  const method = req.method.toUpperCase()

  // ── GET /api/grupos ───────────────────────────────────────────────────────
  if (pathname === '/api/grupos' && method === 'GET') {
    const now = Date.now()
    if (!cache.grupos || now - cache.at > CACHE_TTL) {
      cache.grupos = Object.values(panelDb?.groups || {})
      cache.at = now
    }
    const grupos = cache.grupos
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
    cache.grupos = null
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
    const todayKey = new Date().toISOString().slice(0, 10)
    // Count messages per group from today's logs
    const logs = global.db?.data?.logs || []
    const logsToday = logs.filter(l => safeString(l?.fecha || l?.timestamp || '').slice(0, 10) === todayKey)
    const groupMsgsPerHour = {}
    for (const l of logsToday) {
      if (!l?.grupo) continue
      const h = safeString(l?.fecha || l?.timestamp || '').slice(11, 13)
      if (!h || h.length !== 2) continue
      groupMsgsPerHour[h] = (groupMsgsPerHour[h] || 0) + 1
    }
    const hourlyActivity = Array.from({ length: 24 }, (_, i) => {
      const h = String(i).padStart(2, '0')
      return { name: `${h}:00`, value: groupMsgsPerHour[h] || 0, timestamp: `${todayKey}T${h}:00:00.000Z` }
    })
    const activeYesterday = grupos.filter(g => g?.bot_enabled !== false).length
    return json(res, 200, {
      total: grupos.length,
      activos: grupos.filter(g => g?.bot_enabled !== false).length,
      inactivos: grupos.filter(g => g?.bot_enabled === false).length,
      activeToday: grupos.filter(g => g?.bot_enabled !== false).length,
      activeYesterday,
      hourlyActivity,
    })
  }

  // ── POST /api/grupos/sync ─────────────────────────────────────────────────
  if (pathname === '/api/grupos/sync' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    
    const { emitGroupSyncStart, emitGroupSyncComplete, emitGroupSyncError, emitGroupUpdated } = await import('../../lib/event-bus.js')
    
    emitGroupSyncStart()

    try {
      const conn = global.conn
      if (!conn) {
        emitGroupSyncError(new Error('Bot no conectado'))
        return json(res, 503, { error: 'Bot no conectado' })
      }

      if (typeof conn.groupFetchAllParticipating !== 'function') {
        emitGroupSyncError(new Error('Función de sincronización no disponible'))
        return json(res, 503, { error: 'Función de sincronización no disponible' })
      }

      const chats = await conn.groupFetchAllParticipating()

      if (!chats || typeof chats !== 'object') {
        emitGroupSyncError(new Error('No se pudieron obtener los grupos'))
        return json(res, 500, { error: 'No se pudieron obtener los grupos' })
      }

      const totalChats = Object.keys(chats).length
      panelDb.groups ||= {}
      let synced = 0
      let filtered = 0

      for (const [jid, meta] of Object.entries(chats)) {
        if (!jid || !jid.endsWith('@g.us') || jid.includes('newsletter') || jid.includes('broadcast')) {
          filtered++; continue
        }
        if (meta?.announce === 'true' || meta?.isAnnounce) { filtered++; continue }

        const groupData = {
          ...(panelDb.groups[jid] || {}),
          wa_jid: jid,
          nombre: meta?.subject || jid,
          participants: meta?.participants?.length || 0,
          updated_at: new Date().toISOString()
        }
        panelDb.groups[jid] = groupData
        emitGroupUpdated(groupData)
        synced++
      }

      if (global.db?.write) {
        try { await global.db.write() } catch {}
      }
      cache.grupos = null
      emitGroupSyncComplete(synced, filtered, totalChats)

      return json(res, 200, {
        success: true, synced, filtered, total: totalChats,
        message: `${synced} grupos sincronizados${filtered > 0 ? ` (${filtered} filtrados)` : ''}`
      })
    } catch (err) {
      emitGroupSyncError(err)
      return json(res, 500, { error: err?.message || 'Error sincronizando grupos' })
    }
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

  // ── POST /api/grupos/bulk-update ──────────────────────────────────────────
  if (pathname === '/api/grupos/bulk-update' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const isAdmin = ['owner', 'admin', 'administrador'].includes(safeString(auth.user?.rol || '').toLowerCase())
    if (!isAdmin) return json(res, 403, { error: 'Permisos insuficientes' })
    const body = await readJson(req)
    const jids = Array.isArray(body?.jids) ? body.jids : []
    const settings = body?.settings || {}
    let updated = 0
    for (const jid of jids) {
      try {
        const g = global.db?.data?.chats?.[jid]
        if (g) { Object.assign(g, settings); updated++ }
      } catch {}
    }
    return json(res, 200, { success: true, updated })
  }

  return json(res, 404, { error: 'Ruta no encontrada' })
}
