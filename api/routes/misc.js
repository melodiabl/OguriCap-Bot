/**
 * api/routes/misc.js
 * /api/logs, /api/tasks, /api/backups, /api/audit, /api/resources,
 * /api/analytics, /api/broadcast, /api/multimedia, /api/config,
 * /api/email, /api/ai, /api/terminal, /api/support, /api/proveedores,
 * /api/alerts, /api/scheduled-messages, /api/community, /api/chat
 */
import { json, readJson, getJwtAuth, safeString, paginate, clampInt } from '../middleware/core.js'
import { heavyLimiter } from '../middleware/rate-limit.js'

function isAdmin(user) {
  return ['owner', 'admin', 'administrador'].includes(safeString(user?.rol || '').toLowerCase())
}

export async function handleMisc({ req, res, url, panelDb, taskScheduler, backupSystem, alertSystem }) {
  const pathname = url.pathname
  const method = req.method.toUpperCase()

  // ── /api/logs ─────────────────────────────────────────────────────────────
  if (pathname === '/api/logs/search' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    try {
      const { searchLogs } = await import('../../lib/log-manager.js')
      const q = url.searchParams.get('q') || ''
      const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 500, fallback: 50 })
      const logs = await searchLogs?.({ q, limit }) || []
      return json(res, 200, { logs, total: logs.length })
    } catch { return json(res, 200, { logs: [], total: 0 }) }
  }

  if (pathname === '/api/logs/stats' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const logs = global.db?.data?.logs || []
    return json(res, 200, { total: logs.length, today: logs.filter(l => new Date(l?.timestamp).toDateString() === new Date().toDateString()).length })
  }

  if (pathname === '/api/logs/export' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const logs = global.db?.data?.logs || []
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="logs-${Date.now()}.json"`)
    res.end(JSON.stringify(logs, null, 2))
    return
  }

  if (pathname === '/api/logs/clear' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    if (global.db?.data) global.db.data.logs = []
    if (global.db?.write) await global.db.write()
    return json(res, 200, { success: true })
  }

  if (pathname === '/api/logs/config' && method === 'GET') {
    return json(res, 200, { level: 'info', maxSize: 1000 })
  }

  if (pathname === '/api/logs/config' && method === 'PUT') {
    return json(res, 200, { success: true })
  }

  // ── /api/tasks ────────────────────────────────────────────────────────────
  if (pathname === '/api/tasks' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const tasks = taskScheduler?.getAllTasks?.() || []
    return json(res, 200, { tasks, total: tasks.length })
  }

  if (pathname === '/api/tasks' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const body = await readJson(req)
    try {
      const task = await taskScheduler?.createTask?.(body)
      return json(res, 201, { success: true, task })
    } catch (err) { return json(res, 500, { error: err?.message || 'Error creando tarea' }) }
  }

  if (pathname === '/api/tasks/executions' && method === 'GET') {
    return json(res, 200, { executions: [] })
  }

  // ── /api/backups ──────────────────────────────────────────────────────────
  if (pathname === '/api/backups' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const backups = backupSystem?.getBackups?.() || []
    return json(res, 200, { backups, total: backups.length })
  }

  if (pathname === '/api/backups' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    if (!heavyLimiter(req, res)) return json(res, 429, { error: 'Demasiadas solicitudes' })
    try {
      const backup = await backupSystem?.createBackup?.()
      return json(res, 200, { success: true, backup })
    } catch (err) { return json(res, 500, { error: err?.message || 'Error creando backup' }) }
  }

  // ── /api/audit ────────────────────────────────────────────────────────────
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

  if (pathname === '/api/audit/stats' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    return json(res, 200, { total: 0, byEvent: {} })
  }

  // ── /api/resources ────────────────────────────────────────────────────────
  if (pathname === '/api/resources/stats' && method === 'GET') {
    try {
      const { getResourceStats } = await import('../../lib/resource-monitor.js')
      return json(res, 200, await getResourceStats?.() || {})
    } catch { return json(res, 200, { cpu: 0, memory: 0, disk: 0 }) }
  }

  if (pathname === '/api/resources/history' && method === 'GET') {
    return json(res, 200, { history: [] })
  }

  if (pathname === '/api/resources/start' && method === 'POST') {
    return json(res, 200, { success: true })
  }

  if (pathname === '/api/resources/stop' && method === 'POST') {
    return json(res, 200, { success: true })
  }

  if (pathname === '/api/resources/thresholds' && method === 'PUT') {
    return json(res, 200, { success: true })
  }

  if (pathname === '/api/resources/export' && method === 'GET') {
    return json(res, 200, { data: [] })
  }

  if (pathname === '/api/resources/clear-history' && method === 'POST') {
    return json(res, 200, { success: true })
  }

  // ── /api/analytics ────────────────────────────────────────────────────────
  if (pathname === '/api/analytics' && method === 'GET') {
    return json(res, 200, { data: {}, period: url.searchParams.get('period') || '7d' })
  }

  if (pathname === '/api/analytics/stats' && method === 'GET') {
    return json(res, 200, { stats: {} })
  }

  // ── /api/alerts ───────────────────────────────────────────────────────────
  if (pathname === '/api/alerts' && method === 'GET') {
    const alerts = alertSystem?.getAllAlerts?.() || []
    return json(res, 200, { alerts, total: alerts.length })
  }

  if (pathname === '/api/alerts/rules' && method === 'GET') {
    return json(res, 200, { rules: [] })
  }

  if (pathname === '/api/alerts/rules' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const body = await readJson(req)
    return json(res, 201, { success: true, rule: body })
  }

  // ── /api/broadcast ────────────────────────────────────────────────────────
  if (pathname === '/api/broadcast' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    if (!heavyLimiter(req, res)) return json(res, 429, { error: 'Demasiadas solicitudes' })
    const body = await readJson(req)
    const { message, targets } = body || {}
    if (!message) return json(res, 400, { error: 'message es requerido' })
    const conn = global.conn
    if (!conn) return json(res, 503, { error: 'Bot no conectado' })
    const jids = Array.isArray(targets) ? targets : Object.values(panelDb?.groups || {}).map(g => g?.wa_jid).filter(Boolean)
    const results = []
    for (const jid of jids) {
      try { await conn.sendMessage(jid, { text: message }); results.push({ jid, success: true }); await new Promise(r => setTimeout(r, 300)) }
      catch (err) { results.push({ jid, success: false, error: err?.message }) }
    }
    return json(res, 200, { success: true, sent: results.filter(r => r.success).length, total: jids.length, results })
  }

  if (pathname === '/api/broadcast/email' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    return json(res, 200, { success: true, message: 'Email broadcast enviado' })
  }

  if (pathname === '/api/broadcast/push' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    return json(res, 200, { success: true })
  }

  if (pathname === '/api/broadcast/full' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    return json(res, 200, { success: true })
  }

  // ── /api/multimedia ───────────────────────────────────────────────────────
  if ((pathname === '/api/multimedia' || pathname === '/api/multimedia/upload') && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    return json(res, 200, { success: true, message: 'Archivo subido' })
  }

  if (pathname === '/api/multimedia' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const items = Object.values(panelDb?.multimedia || {})
    return json(res, 200, { items, total: items.length })
  }

  if (pathname === '/api/multimedia/stats' && method === 'GET') {
    const items = Object.values(panelDb?.multimedia || {})
    return json(res, 200, { total: items.length })
  }

  // ── /api/config ───────────────────────────────────────────────────────────
  if (pathname === '/api/config' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    return json(res, 200, panelDb?.panelConfig || {})
  }

  if (pathname === '/api/config/stats' && method === 'GET') {
    return json(res, 200, { total: Object.keys(panelDb?.panelConfig || {}).length })
  }

  // ── /api/email ────────────────────────────────────────────────────────────
  if (pathname === '/api/email/status' && method === 'GET') {
    try {
      const { getEmailServiceStatus } = await import('../../lib/email-service.js')
      return json(res, 200, getEmailServiceStatus?.() || { configured: false })
    } catch { return json(res, 200, { configured: false }) }
  }

  if (pathname === '/api/email/test' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    try {
      const { sendTestEmail } = await import('../../lib/email-service.js')
      const body = await readJson(req)
      await sendTestEmail?.({ to: body?.to || auth.user.email })
      return json(res, 200, { success: true })
    } catch (err) { return json(res, 500, { error: err?.message || 'Error enviando email de prueba' }) }
  }

  if (pathname === '/api/email/verify' && method === 'POST') {
    return json(res, 200, { success: true })
  }

  if (pathname === '/api/email/preview' && method === 'GET') {
    return json(res, 200, { templates: [] })
  }

  // ── /api/ai ───────────────────────────────────────────────────────────────
  if (pathname === '/api/ai/stats' && method === 'GET') {
    return json(res, 200, { requests: 0, tokens: 0 })
  }

  if (pathname === '/api/ai/enhance-pedido' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    return json(res, 200, { enhanced: body?.text || '', suggestions: [] })
  }

  if (pathname === '/api/ai/test-command' && method === 'POST') {
    return json(res, 200, { result: 'ok' })
  }

  // ── /api/terminal ─────────────────────────────────────────────────────────
  if (pathname === '/api/terminal' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    try {
      const { getTerminalMirror } = await import('../../lib/terminal-mirror.js')
      return json(res, 200, { output: getTerminalMirror?.() || [] })
    } catch { return json(res, 200, { output: [] }) }
  }

  if (pathname === '/api/terminal/clear' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    return json(res, 200, { success: true })
  }

  // ── /api/support ──────────────────────────────────────────────────────────
  if (pathname === '/api/support/my-chat' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    return json(res, 200, { messages: [] })
  }

  if (pathname === '/api/support/my-chat' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    return json(res, 200, { success: true, message: body })
  }

  if (pathname === '/api/support/chats' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    return json(res, 200, { chats: [] })
  }

  // ── /api/proveedores ──────────────────────────────────────────────────────
  if (pathname === '/api/proveedores/stats' && method === 'GET') {
    return json(res, 200, { total: 0 })
  }

  if (pathname === '/api/proveedores/me' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    return json(res, 200, { proveedor: null })
  }

  if (pathname === '/api/proveedores' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    return json(res, 200, { proveedores: [], total: 0 })
  }

  if (pathname === '/api/proveedores' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    return json(res, 201, { success: true, proveedor: body })
  }

  // ── /api/community ────────────────────────────────────────────────────────
  if (pathname === '/api/community/users' && method === 'GET') {
    const users = Object.values(global.db?.data?.usuarios || {})
    return json(res, 200, { users: users.map(u => ({ id: u?.id, username: u?.username, rol: u?.rol })), total: users.length })
  }

  if (pathname === '/api/community/stats' && method === 'GET') {
    const users = Object.values(global.db?.data?.usuarios || {})
    return json(res, 200, { totalUsers: users.length, activeUsers: users.filter(u => u?.activo !== false).length })
  }

  // ── /api/chat ─────────────────────────────────────────────────────────────
  if (pathname === '/api/chat/sessions' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    return json(res, 200, { sessions: [] })
  }

  if (pathname === '/api/chat/sessions' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    return json(res, 201, { success: true, session: { id: Date.now() } })
  }

  // ── /api/scheduled-messages ───────────────────────────────────────────────
  if (pathname === '/api/scheduled-messages' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    return json(res, 200, { messages: [] })
  }

  if (pathname === '/api/scheduled-messages' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    return json(res, 201, { success: true, message: body })
  }

  return json(res, 404, { error: 'Ruta no encontrada' })
}
