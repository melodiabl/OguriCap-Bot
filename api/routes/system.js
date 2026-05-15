/**
 * api/routes/system.js — /api/system/* + /api/dashboard/* + /api/health
 * Extraído de lib/panel-api.js
 */
import { json, readJson, getJwtAuth, safeString, getClientIP, isAllowedIP } from '../middleware/core.js'

function isAdmin(user) {
  return ['owner', 'admin', 'administrador'].includes(safeString(user?.rol || '').toLowerCase())
}

export async function handleSystem({ req, res, url, panelDb }) {
  const pathname = url.pathname
  const method = req.method.toUpperCase()

  // ── GET /api/health ───────────────────────────────────────────────────────
  if (pathname === '/api/health' && method === 'GET') {
    const clientIP = getClientIP(req)
    const turnstileDisabled = process.env.TURNSTILE_DISABLED === '1'
    const siteKey = safeString(process.env.TURNSTILE_SITE_KEY || '').trim()
    const mem = process.memoryUsage()
    const dbOk = Boolean(global.db?.data)
    const botConnected = global.stopped === 'open'
    return json(res, 200, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      bot: botConnected ? 'connected' : 'disconnected',
      version: process.env.npm_package_version || '1.0.0',
      // Campos que el frontend login necesita
      turnstileSiteKey: (!turnstileDisabled && siteKey) ? siteKey : null,
      turnstileRequired: !turnstileDisabled && Boolean(siteKey),
      maintenanceMode: panelDb?.systemConfig?.maintenanceMode || false,
      maintenanceMessage: panelDb?.systemConfig?.maintenanceMessage || null,
      clientIP,
      ipAllowed: isAllowedIP(clientIP, panelDb),
      canAccessDuringMaintenance: isAllowedIP(clientIP, panelDb),
      // Rich health data
      health: {
        db: { status: dbOk ? 'ok' : 'error', logs: global.db?.data?.logs?.length ?? 0 },
        memory: {
          heapUsed: Math.round(mem.heapUsed / 1024 / 1024),
          heapTotal: Math.round(mem.heapTotal / 1024 / 1024),
          rss: Math.round(mem.rss / 1024 / 1024),
          unit: 'MB'
        },
        bot: { connected: botConnected, uptime: global.botStartTime ? Math.floor((Date.now() - global.botStartTime) / 1000) : null },
        process: { uptime: Math.floor(process.uptime()), pid: process.pid }
      }
    })
  }

  // ── GET /api/system/stats ─────────────────────────────────────────────────
  if (pathname === '/api/system/stats' && method === 'GET') {
    try {
      const realTimeData = (await import('../../lib/real-time-data.js')).default
      return json(res, 200, realTimeData.getSystemStats?.() || {})
    } catch { return json(res, 500, { error: 'Error obteniendo stats' }) }
  }

  // ── GET /api/system/config ────────────────────────────────────────────────
  if (pathname === '/api/system/config' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const clientIP = getClientIP(req)
    return json(res, 200, {
      ...(panelDb?.systemConfig || {}),
      _clientIP: clientIP,
      _isAllowedIP: isAllowedIP(clientIP, panelDb),
    })
  }

  // ── PATCH /api/system/config ──────────────────────────────────────────────
  if (pathname === '/api/system/config' && method === 'PATCH') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const body = await readJson(req)
    panelDb.systemConfig ||= {}
    const allowed = ['maintenanceMode', 'maintenanceMessage', 'autoAddAdminIPOnLogin', 'registrationEnabled', 'maxSubbotsPerUser', 'adminIPs']
    const prevMaintenance = panelDb.systemConfig.maintenanceMode
    for (const k of allowed) { if (k in body) panelDb.systemConfig[k] = body[k] }
    panelDb.systemConfig.updated_at = new Date().toISOString()
    if (global.db?.write) await global.db.write()
    // Emit socket event when maintenance mode changes
    if ('maintenanceMode' in body && body.maintenanceMode !== prevMaintenance) {
      try {
        const { getIO } = await import('../../lib/socket-io.js')
        const io = getIO()
        if (io) io.emit('system:maintenance', {
          enabled: Boolean(body.maintenanceMode),
          message: panelDb.systemConfig.maintenanceMessage || null,
          timestamp: new Date().toISOString(),
        })
      } catch {}
    }
    return json(res, 200, { success: true, config: panelDb.systemConfig })
  }

  // ── POST /api/system/add-admin-ip ─────────────────────────────────────────
  if (pathname === '/api/system/add-admin-ip' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const body = await readJson(req)
    const ip = safeString(body?.ip || getClientIP(req)).trim()
    if (!ip) return json(res, 400, { error: 'IP requerida' })
    panelDb.systemConfig ||= {}
    panelDb.systemConfig.adminIPs ||= []
    if (!panelDb.systemConfig.adminIPs.includes(ip)) panelDb.systemConfig.adminIPs.push(ip)
    if (global.db?.write) await global.db.write()
    return json(res, 200, { success: true, adminIPs: panelDb.systemConfig.adminIPs })
  }

  // ── GET /api/system/alerts ────────────────────────────────────────────────
  if (pathname === '/api/system/alerts' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    return json(res, 200, { alerts: [] })
  }

  // ── GET /api/system/metrics ───────────────────────────────────────────────
  if (pathname === '/api/system/metrics' && method === 'GET') {
    try {
      const realTimeData = (await import('../../lib/real-time-data.js')).default
      return json(res, 200, realTimeData.getSystemStats?.() || {})
    } catch { return json(res, 500, { error: 'Error obteniendo métricas' }) }
  }

  // ── GET /api/system/status ────────────────────────────────────────────────
  if (pathname === '/api/system/status' && method === 'GET') {
    return json(res, 200, {
      bot: global.stopped === 'open' ? 'connected' : 'disconnected',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      maintenanceMode: panelDb?.systemConfig?.maintenanceMode || false,
      botGlobalState: panelDb?.botGlobalState?.isOn !== false,
    })
  }

  // ── GET /api/system/reports ───────────────────────────────────────────────
  if (pathname === '/api/system/reports' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    return json(res, 200, { reports: [] })
  }

  // ── POST /api/system/reports/generate ────────────────────────────────────
  if (pathname === '/api/system/reports/generate' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    return json(res, 200, { success: true, message: 'Reporte generado', timestamp: new Date().toISOString() })
  }

  // ── GET /api/system/metrics/history ──────────────────────────────────────
  if (pathname === '/api/system/metrics/history' && method === 'GET') {
    return json(res, 200, { history: [] })
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
      const realTimeData = (await import('../../lib/real-time-data.js')).default
      const data = realTimeData.getRecentActivity?.(10) || {}
      return json(res, 200, { data: data.activities || [], total: data.total || 0, lastUpdate: data.lastUpdate })
    } catch { return json(res, 500, { error: 'Error obteniendo actividad' }) }
  }

  // ── GET /api/system/ping ──────────────────────────────────────────────────
  if (pathname === '/api/system/ping' && method === 'GET') {
    return json(res, 200, { pong: true, timestamp: Date.now() })
  }

  // ── GET /api/websocket/test ───────────────────────────────────────────────
  if (pathname === '/api/websocket/test' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    try {
      const { getIO } = await import('../../lib/socket-io.js')
      const io = getIO()
      return json(res, 200, { connected: Boolean(io), clients: io?.engine?.clientsCount || 0 })
    } catch { return json(res, 200, { connected: false, clients: 0 }) }
  }

  // ── /api/system/clear-cache ───────────────────────────────────────────────
  if (pathname === '/api/system/clear-cache' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    global.__realTimeDataCache = null
    global.__resourceMonitorCache = null
    return json(res, 200, { success: true, message: 'Caché limpiada correctamente' })
  }

  // ── /api/activity/feed ────────────────────────────────────────────────────
  if (pathname === '/api/activity/feed' && method === 'GET') {
    const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100)
    try {
      const { getRecentActivity } = await import('../../lib/real-time-data.js').catch(() => ({ getRecentActivity: null }))
      if (typeof getRecentActivity === 'function') {
        const data = await getRecentActivity(limit).catch(() => [])
        return json(res, 200, { data, total: data.length, lastUpdate: new Date().toISOString() })
      }
    } catch {}
    const logs = (global.db?.data?.logs || []).slice(-limit).map(l => ({
      id: l?.id || Date.now(),
      type: l?.type || 'evento',
      icon: 'Activity',
      color: 'info',
      title: l?.type || 'Evento',
      desc: safeString(l?.desc || l?.message || '').slice(0, 80),
      time: 'Ahora',
      timestamp: l?.timestamp || new Date().toISOString(),
    }))
    return json(res, 200, { data: logs.reverse(), total: logs.length, lastUpdate: new Date().toISOString() })
  }

  // ── /api/ai (stubs) ───────────────────────────────────────────────────────
  if (pathname === '/api/ai/stats' && method === 'GET') return json(res, 200, { requests: 0, tokens: 0 })
  if (pathname === '/api/ai/enhance-pedido' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    return json(res, 200, { enhanced: body?.text || '', suggestions: [] })
  }
  if (pathname === '/api/ai/test-command' && method === 'POST') return json(res, 200, { result: 'ok' })

  return json(res, 404, { error: 'Ruta no encontrada' })
}
