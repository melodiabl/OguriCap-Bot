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
    
    const { emitGroupSyncStart, emitGroupSyncComplete, emitGroupSyncError, emitGroupUpdated } = await import('../../lib/event-bus.js')
    
    console.log('[SYNC] Iniciando sincronización de grupos...')
    emitGroupSyncStart()
    
    try {
      const conn = global.conn
      if (!conn) {
        console.log('[SYNC] Error: Bot no conectado')
        emitGroupSyncError(new Error('Bot no conectado'))
        return json(res, 503, { error: 'Bot no conectado' })
      }
      
      if (typeof conn.groupFetchAllParticipating !== 'function') {
        console.log('[SYNC] Error: Función groupFetchAllParticipating no disponible')
        emitGroupSyncError(new Error('Función de sincronización no disponible'))
        return json(res, 503, { error: 'Función de sincronización no disponible' })
      }
      
      console.log('[SYNC] Obteniendo grupos de WhatsApp...')
      const chats = await conn.groupFetchAllParticipating()
      
      if (!chats || typeof chats !== 'object') {
        console.log('[SYNC] Error: No se pudieron obtener los grupos')
        emitGroupSyncError(new Error('No se pudieron obtener los grupos'))
        return json(res, 500, { error: 'No se pudieron obtener los grupos' })
      }
      
      const totalChats = Object.keys(chats).length
      console.log(`[SYNC] Total de chats obtenidos: ${totalChats}`)
      
      panelDb.groups ||= {}
      let synced = 0
      let filtered = 0
      
      for (const [jid, meta] of Object.entries(chats)) {
        // Filtrar: solo grupos normales (@g.us), excluir comunidades (@newsletter) y canales
        if (!jid || !jid.endsWith('@g.us')) {
          filtered++
          continue
        }
        if (jid.includes('newsletter') || jid.includes('broadcast')) {
          filtered++
          continue
        }
        if (meta?.announce === 'true' || meta?.isAnnounce) {
          filtered++
          continue
        }
        
        const groupData = { 
          ...(panelDb.groups[jid] || {}), 
          wa_jid: jid, 
          nombre: meta?.subject || jid, 
          participants: meta?.participants?.length || 0, 
          updated_at: new Date().toISOString() 
        }
        
        panelDb.groups[jid] = groupData
        emitGroupUpdated(groupData) // Emitir evento por cada grupo actualizado
        synced++
      }
      
      console.log(`[SYNC] Grupos sincronizados: ${synced}, Filtrados: ${filtered}`)
      
      if (global.db?.write) {
        try {
          await global.db.write()
          console.log('[SYNC] Base de datos guardada correctamente')
        } catch (writeErr) {
          console.error('[SYNC] Error escribiendo DB:', writeErr)
        }
      }
      
      cache.grupos = null
      
      console.log('[SYNC] Sincronización completada exitosamente')
      
      // Emitir evento de sincronización completada
      emitGroupSyncComplete(synced, filtered, totalChats)
      
      return json(res, 200, { 
        success: true, 
        synced, 
        filtered,
        total: totalChats,
        message: `${synced} grupos sincronizados correctamente${filtered > 0 ? ` (${filtered} filtrados)` : ''}`
      })
    } catch (err) { 
      console.error('Error en /api/grupos/sync:', err)
      emitGroupSyncError(err)
      return json(res, 500, { error: err?.message || 'Error sincronizando grupos', details: err?.stack }) 
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

  return json(res, 404, { error: 'Ruta no encontrada' })
}
