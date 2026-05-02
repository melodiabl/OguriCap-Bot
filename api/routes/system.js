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
    return json(res, 200, {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      bot: global.stopped === 'open' ? 'connected' : 'disconnected',
      version: process.env.npm_package_version || '1.0.0',
      // Campos que el frontend login necesita
      turnstileSiteKey: (!turnstileDisabled && siteKey) ? siteKey : null,
      turnstileRequired: !turnstileDisabled && Boolean(siteKey),
      maintenanceMode: panelDb?.systemConfig?.maintenanceMode || false,
      maintenanceMessage: panelDb?.systemConfig?.maintenanceMessage || null,
      clientIP,
      ipAllowed: isAllowedIP(clientIP, panelDb),
      canAccessDuringMaintenance: isAllowedIP(clientIP, panelDb),
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
    for (const k of allowed) { if (k in body) panelDb.systemConfig[k] = body[k] }
    panelDb.systemConfig.updated_at = new Date().toISOString()
    if (global.db?.write) await global.db.write()
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

  return json(res, 404, { error: 'Ruta no encontrada' })
}
