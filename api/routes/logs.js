/**
 * api/routes/logs.js — /api/logs/**, /api/audit/**
 */
import { json, getJwtAuth, safeString, paginate, clampInt } from '../middleware/core.js'

function isAdmin(user) {
  return ['owner', 'admin', 'administrador'].includes(safeString(user?.rol || '').toLowerCase())
}

export async function handleLogs({ req, res, url }) {
  const pathname = url.pathname
  const method = req.method.toUpperCase()

  // ── /api/logs/search ──────────────────────────────────────────────────────
  if (pathname === '/api/logs/search' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    try {
      const q        = url.searchParams.get('query') || url.searchParams.get('q') || ''
      const limit    = clampInt(url.searchParams.get('limit'), { min: 1, max: 500, fallback: 50 })
      const page     = clampInt(url.searchParams.get('page'), { min: 1, max: 9999, fallback: 1 })
      const level    = url.searchParams.get('level') || ''
      const category = url.searchParams.get('category') || ''
      const offset   = (page - 1) * limit

      let logs = global.db?.data?.logs || []
      if (q) logs = logs.filter(l => JSON.stringify(l).toLowerCase().includes(q.toLowerCase()))
      if (level) logs = logs.filter(l => l?.level === level)
      if (category) logs = logs.filter(l => l?.category === category)
      logs = [...logs].reverse()
      const total = logs.length
      return json(res, 200, { logs: logs.slice(offset, offset + limit), total, page, limit, totalPages: Math.ceil(total / limit) })
    } catch { return json(res, 200, { logs: [], total: 0, page: 1, limit: 50, totalPages: 0 }) }
  }

  // ── /api/logs (GET) ───────────────────────────────────────────────────────
  if (pathname === '/api/logs' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    try {
      const limit  = clampInt(url.searchParams.get('limit'), { min: 1, max: 500, fallback: 100 })
      const page   = clampInt(url.searchParams.get('page'), { min: 1, max: 9999, fallback: 1 })
      const level  = url.searchParams.get('level') || null
      let logs = global.db?.data?.logs || []
      if (level) logs = logs.filter(l => l?.level === level)
      logs = [...logs].reverse()
      const total  = logs.length
      const offset = (page - 1) * limit
      return json(res, 200, { logs: logs.slice(offset, offset + limit), total, page, limit })
    } catch { return json(res, 200, { logs: [], total: 0 }) }
  }

  // ── /api/logs/stats ───────────────────────────────────────────────────────
  if (pathname === '/api/logs/stats' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const logs = global.db?.data?.logs || []
    const today = new Date().toDateString()
    return json(res, 200, {
      total: logs.length,
      today: logs.filter(l => new Date(l?.timestamp || l?.fecha).toDateString() === today).length,
    })
  }

  // ── /api/logs/export ──────────────────────────────────────────────────────
  if (pathname === '/api/logs/export' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const fmt = safeString(url.searchParams.get('format') || 'json').toLowerCase()
    const raw = global.db?.data?.logs || []
    const ts = new Date().toISOString().slice(0, 19).replace(/:/g, '-')

    if (fmt === 'csv') {
      const headers = ['id','fecha','tipo','nivel','usuario','comando','grupo','detalles']
      const escape = (v) => {
        const s = String(v == null ? '' : v).replace(/"/g, '""')
        return /[",\n\r]/.test(s) ? `"${s}"` : s
      }
      const rows = raw.map(l => headers.map(h => escape(
        h === 'fecha' ? (l?.fecha || l?.timestamp || '') :
        h === 'nivel' ? (l?.nivel || l?.level || '') :
        h === 'detalles' ? (l?.detalles || l?.message || '') :
        l?.[h] ?? ''
      )).join(','))
      const csv = [headers.join(','), ...rows].join('\n')
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename="logs-${ts}.csv"`)
      res.end('﻿' + csv) // BOM for Excel
      return
    }

    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="logs-${ts}.json"`)
    res.end(JSON.stringify(raw, null, 2))
    return
  }

  // ── /api/logs/clear ───────────────────────────────────────────────────────
  if (pathname === '/api/logs/clear' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    if (global.db?.data) global.db.data.logs = []
    if (global.db?.write) await global.db.write()
    return json(res, 200, { success: true })
  }

  // ── /api/logs/config ──────────────────────────────────────────────────────
  if (pathname === '/api/logs/config') {
    if (method === 'GET') return json(res, 200, { level: 'info', maxSize: 1000 })
    if (method === 'PUT') return json(res, 200, { success: true })
  }

  // ── /api/audit/logs ───────────────────────────────────────────────────────
  if (pathname === '/api/audit/logs' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    try {
      const auditLogger = (await import('../../lib/audit-logger.js')).default
      const logs = auditLogger?.getLogs?.() || []
      const { items, pagination } = paginate(logs, { page: url.searchParams.get('page'), limit: url.searchParams.get('limit') })
      return json(res, 200, { logs: items, pagination })
    } catch { return json(res, 200, { logs: [], pagination: {} }) }
  }

  // ── /api/audit/stats ──────────────────────────────────────────────────────
  if (pathname === '/api/audit/stats' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    return json(res, 200, { total: 0, byEvent: {} })
  }
}
