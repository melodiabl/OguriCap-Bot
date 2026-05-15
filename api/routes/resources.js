/**
 * api/routes/resources.js — /api/resources/**, /api/analytics/**, /api/stats/realtime
 */
import { json, readJson, getJwtAuth, safeString } from '../middleware/core.js'

function isAdmin(user) {
  return ['owner', 'admin', 'administrador'].includes(safeString(user?.rol || '').toLowerCase())
}

async function getResourceMonitor() {
  try { return (await import('../../lib/resource-monitor.js')).default } catch { return null }
}

async function getRealTimeData() {
  try { return (await import('../../lib/real-time-data.js')).default } catch { return null }
}

export async function handleResources({ req, res, url }) {
  const pathname = url.pathname
  const method = req.method.toUpperCase()

  // ── /api/resources/stats ──────────────────────────────────────────────────
  if (pathname === '/api/resources/stats' && method === 'GET') {
    const rm = await getResourceMonitor()
    const stats = await rm?.getStats?.() || rm?.getCurrentStats?.() || {}
    return json(res, 200, stats)
  }

  // ── /api/resources/history ────────────────────────────────────────────────
  if (pathname === '/api/resources/history' && method === 'GET') {
    const rm = await getResourceMonitor()
    return json(res, 200, { history: rm?.getHistory?.() || [] })
  }

  // ── /api/resources/start ──────────────────────────────────────────────────
  if (pathname === '/api/resources/start' && method === 'POST') {
    const rm = await getResourceMonitor()
    rm?.start?.()
    return json(res, 200, { success: true })
  }

  // ── /api/resources/stop ───────────────────────────────────────────────────
  if (pathname === '/api/resources/stop' && method === 'POST') {
    const rm = await getResourceMonitor()
    rm?.stop?.()
    return json(res, 200, { success: true })
  }

  // ── /api/resources/thresholds ─────────────────────────────────────────────
  if (pathname === '/api/resources/thresholds' && method === 'PUT') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    const rm = await getResourceMonitor()
    rm?.setThresholds?.(body)
    return json(res, 200, { success: true })
  }

  // ── /api/resources/export ─────────────────────────────────────────────────
  if (pathname === '/api/resources/export' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const rm = await getResourceMonitor()
    const data = rm?.getHistory?.() || []
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="resources-${Date.now()}.json"`)
    res.end(JSON.stringify(data, null, 2))
    return
  }

  // ── /api/resources/clear-history ──────────────────────────────────────────
  if (pathname === '/api/resources/clear-history' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const rm = await getResourceMonitor()
    rm?.clearHistory?.()
    return json(res, 200, { success: true })
  }

  // ── /api/analytics ────────────────────────────────────────────────────────
  if (pathname === '/api/analytics' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const rtd = await getRealTimeData()
    return json(res, 200, { data: rtd?.getDashboardStats?.() || {}, period: url.searchParams.get('period') || '7d' })
  }

  if (pathname === '/api/analytics/stats' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const rtd = await getRealTimeData()
    return json(res, 200, rtd?.getDashboardStats?.() || {})
  }

  // ── /api/stats/realtime ───────────────────────────────────────────────────
  if (pathname === '/api/stats/realtime' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const rtd = await getRealTimeData()
    return json(res, 200, rtd?.getDashboardStats?.() || {})
  }
}
