/**
 * api/routes/notifications.js — /api/notificaciones/* + SSE
 * Extraído de lib/panel-api.js
 */
import { json, readJson, getJwtAuth, safeString, paginate, sseInit, sseBroadcast } from '../middleware/core.js'

function isAdmin(user) {
  return ['owner', 'admin', 'administrador'].includes(safeString(user?.rol || '').toLowerCase())
}

export async function handleNotifications({ req, res, url, panelDb }) {
  const pathname = url.pathname
  const method = req.method.toUpperCase()

  // ── GET /api/notificaciones/stream (SSE) ──────────────────────────────────
  if (pathname === '/api/notificaciones/stream' && method === 'GET') {
    return sseInit(req, res, 'notificaciones')
  }

  // ── GET /api/notificaciones/stats ─────────────────────────────────────────
  if (pathname === '/api/notificaciones/stats' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const notifs = Array.isArray(panelDb?.notifications) ? panelDb.notifications : []
    const userNotifs = isAdmin(auth.user) ? notifs : notifs.filter(n => !n?.usuario || n.usuario === auth.user.username)
    return json(res, 200, {
      total: userNotifs.length,
      unread: userNotifs.filter(n => !n?.read && !n?.leida).length,
      byType: userNotifs.reduce((acc, n) => { const t = safeString(n?.type || n?.tipo || 'info'); acc[t] = (acc[t] || 0) + 1; return acc }, {}),
    })
  }

  // ── GET /api/notificaciones/categories ────────────────────────────────────
  if (pathname === '/api/notificaciones/categories' && method === 'GET') {
    return json(res, 200, { categories: ['sistema', 'bot', 'usuario', 'seguridad', 'general'] })
  }

  // ── GET /api/notificaciones/types ─────────────────────────────────────────
  if (pathname === '/api/notificaciones/types' && method === 'GET') {
    return json(res, 200, { types: ['info', 'success', 'warning', 'error', 'critical'] })
  }

  // ── GET /api/notificaciones ───────────────────────────────────────────────
  if (pathname === '/api/notificaciones' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const notifs = Array.isArray(panelDb?.notifications) ? panelDb.notifications : []
    const userNotifs = isAdmin(auth.user) ? notifs : notifs.filter(n => !n?.usuario || n.usuario === auth.user.username)
    const unreadOnly = url.searchParams.get('unread') === 'true'
    const filtered = unreadOnly ? userNotifs.filter(n => !n?.read && !n?.leida) : userNotifs
    const sorted = [...filtered].sort((a, b) => new Date(b?.fecha || b?.created_at || 0) - new Date(a?.fecha || a?.created_at || 0))
    const { items, pagination } = paginate(sorted, { page: url.searchParams.get('page'), limit: url.searchParams.get('limit') || 20 })
    return json(res, 200, { notifications: items, pagination })
  }

  // ── POST /api/notificaciones ──────────────────────────────────────────────
  if (pathname === '/api/notificaciones' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const body = await readJson(req)
    const { title, message, type, categoria } = body || {}
    if (!title || !message) return json(res, 400, { error: 'title y message son requeridos' })
    const notif = {
      id: Date.now(), title: safeString(title), message: safeString(message),
      type: safeString(type || 'info'), categoria: safeString(categoria || 'general'),
      read: false, fecha: new Date().toISOString(), created_at: new Date().toISOString(),
    }
    panelDb.notifications ||= []
    panelDb.notifications.unshift(notif)
    if (panelDb.notifications.length > 500) panelDb.notifications = panelDb.notifications.slice(0, 500)
    if (global.db?.write) await global.db.write()
    sseBroadcast('notificaciones', notif)
    try { const { emitNotification } = await import('../../lib/socket-io.js'); emitNotification(notif) } catch {}
    return json(res, 201, { success: true, notification: notif })
  }

  // ── DELETE /api/notificaciones ────────────────────────────────────────────
  if (pathname === '/api/notificaciones' && method === 'DELETE') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    panelDb.notifications = []
    if (global.db?.write) await global.db.write()
    return json(res, 200, { success: true, message: 'Notificaciones eliminadas' })
  }

  // ── POST /api/notificaciones/mark-all-read ────────────────────────────────
  if ((pathname === '/api/notificaciones/mark-all-read' || pathname === '/api/notificaciones/read-all') && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const notifs = Array.isArray(panelDb?.notifications) ? panelDb.notifications : []
    let count = 0
    for (const n of notifs) {
      if (!n?.read && (!n?.usuario || n.usuario === auth.user.username || isAdmin(auth.user))) {
        n.read = true; n.leida = true; count++
      }
    }
    if (global.db?.write) await global.db.write()
    return json(res, 200, { success: true, marked: count })
  }

  // ── PATCH /api/notificaciones/:id ─────────────────────────────────────────
  const notifMatch = pathname.match(/^\/api\/notificaciones\/(\d+)$/)
  if (notifMatch && method === 'PATCH') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const id = Number(notifMatch[1])
    const notifs = Array.isArray(panelDb?.notifications) ? panelDb.notifications : []
    const notif = notifs.find(n => n?.id === id)
    if (!notif) return json(res, 404, { error: 'Notificación no encontrada' })
    const body = await readJson(req)
    if ('read' in body) { notif.read = body.read; notif.leida = body.read }
    if (global.db?.write) await global.db.write()
    return json(res, 200, { success: true, notification: notif })
  }

  return json(res, 404, { error: 'Ruta no encontrada' })
}
