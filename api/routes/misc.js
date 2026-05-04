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
      const q = url.searchParams.get('query') || url.searchParams.get('q') || ''
      const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 500, fallback: 50 })
      const page = clampInt(url.searchParams.get('page'), { min: 1, max: 9999, fallback: 1 })
      const level = url.searchParams.get('level') || ''
      const category = url.searchParams.get('category') || ''
      const offset = (page - 1) * limit

      let logs = global.db?.data?.logs || []
      if (q) logs = logs.filter(l => JSON.stringify(l).toLowerCase().includes(q.toLowerCase()))
      if (level) logs = logs.filter(l => l?.level === level)
      if (category) logs = logs.filter(l => l?.category === category)

      // newest first
      logs = [...logs].reverse()
      const total = logs.length
      const paginated = logs.slice(offset, offset + limit)
      return json(res, 200, { logs: paginated, total, page, limit, totalPages: Math.ceil(total / limit) })
    } catch { return json(res, 200, { logs: [], total: 0, page: 1, limit: 50, totalPages: 0 }) }
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
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const executions = taskScheduler?.getExecutions?.() || []
    return json(res, 200, { executions })
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
      const resourceMonitor = (await import('../../lib/resource-monitor.js')).default
      const stats = await resourceMonitor.getStats?.() || resourceMonitor.getCurrentStats?.() || {}
      return json(res, 200, stats)
    } catch { return json(res, 200, { cpu: 0, memory: 0, disk: 0 }) }
  }

  if (pathname === '/api/resources/history' && method === 'GET') {
    try {
      const resourceMonitor = (await import('../../lib/resource-monitor.js')).default
      const history = resourceMonitor?.getHistory?.() || []
      return json(res, 200, { history })
    } catch { return json(res, 200, { history: [] }) }
  }

  if (pathname === '/api/resources/start' && method === 'POST') {
    try {
      const resourceMonitor = (await import('../../lib/resource-monitor.js')).default
      resourceMonitor?.start?.()
    } catch {}
    return json(res, 200, { success: true })
  }

  if (pathname === '/api/resources/stop' && method === 'POST') {
    try {
      const resourceMonitor = (await import('../../lib/resource-monitor.js')).default
      resourceMonitor?.stop?.()
    } catch {}
    return json(res, 200, { success: true })
  }

  if (pathname === '/api/resources/thresholds' && method === 'PUT') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    try {
      const resourceMonitor = (await import('../../lib/resource-monitor.js')).default
      resourceMonitor?.setThresholds?.(body)
    } catch {}
    return json(res, 200, { success: true })
  }

  if (pathname === '/api/resources/export' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    try {
      const resourceMonitor = (await import('../../lib/resource-monitor.js')).default
      const data = resourceMonitor?.getHistory?.() || []
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Content-Disposition', `attachment; filename="resources-${Date.now()}.json"`)
      res.end(JSON.stringify(data, null, 2))
      return
    } catch { return json(res, 200, { data: [] }) }
  }

  if (pathname === '/api/resources/clear-history' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    try {
      const resourceMonitor = (await import('../../lib/resource-monitor.js')).default
      resourceMonitor?.clearHistory?.()
    } catch {}
    return json(res, 200, { success: true })
  }

  // ── /api/analytics ────────────────────────────────────────────────────────
  if (pathname === '/api/analytics' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    try {
      const realTimeData = (await import('../../lib/real-time-data.js')).default
      const stats = realTimeData.getDashboardStats?.() || {}
      return json(res, 200, { data: stats, period: url.searchParams.get('period') || '7d' })
    } catch { return json(res, 200, { data: {}, period: '7d' }) }
  }

  if (pathname === '/api/analytics/stats' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    try {
      const realTimeData = (await import('../../lib/real-time-data.js')).default
      return json(res, 200, realTimeData.getDashboardStats?.() || {})
    } catch { return json(res, 200, {}) }
  }

  // ── /api/alerts ───────────────────────────────────────────────────────────
  if (pathname === '/api/alerts' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const alerts = alertSystem?.getAllAlerts?.() || alertSystem?.getAlerts?.() || []
    return json(res, 200, { alerts, total: alerts.length })
  }

  if (pathname === '/api/alerts/rules' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const rules = alertSystem?.getRules?.() || alertSystem?.rules || []
    return json(res, 200, { rules })
  }

  if (pathname === '/api/alerts/rules' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const body = await readJson(req)
    const rule = alertSystem?.addRule?.(body) || body
    return json(res, 201, { success: true, rule })
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
    const body = await readJson(req)
    try {
      const { sendBroadcastEmail } = await import('../../lib/email-service.js')
      await sendBroadcastEmail?.(body)
      return json(res, 200, { success: true })
    } catch (err) { return json(res, 500, { error: err?.message || 'Error enviando email broadcast' }) }
  }

  if (pathname === '/api/broadcast/push' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    try {
      const { getIO } = await import('../../lib/socket-io.js')
      getIO()?.emit('push:notification', body)
      return json(res, 200, { success: true })
    } catch { return json(res, 200, { success: true }) }
  }

  if (pathname === '/api/broadcast/full' && method === 'POST') {
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

  // ── /api/multimedia ───────────────────────────────────────────────────────
  if ((pathname === '/api/multimedia' || pathname === '/api/multimedia/upload') && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    try {
      const { readBodyBuffer } = await import('../middleware/core.js')
      const buf = await readBodyBuffer(req, { limitBytes: 50 * 1024 * 1024 })
      const contentType = req.headers['content-type'] || 'application/octet-stream'
      const filename = safeString(url.searchParams.get('filename') || `upload-${Date.now()}`)
      const fs = await import('fs')
      const path = await import('path')
      const uploadDir = path.join(process.cwd(), 'storage', 'media')
      fs.mkdirSync(uploadDir, { recursive: true })
      const filePath = path.join(uploadDir, filename)
      fs.writeFileSync(filePath, buf)
      const record = { id: Date.now(), filename, path: filePath, size: buf.length, contentType, uploadedAt: new Date().toISOString(), uploadedBy: auth.user.username }
      panelDb.multimedia ||= {}
      panelDb.multimedia[record.id] = record
      if (global.db?.write) await global.db.write()
      return json(res, 200, { success: true, file: record })
    } catch (err) { return json(res, 500, { error: err?.message || 'Error subiendo archivo' }) }
  }

  if (pathname === '/api/multimedia' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const items = Object.values(panelDb?.multimedia || {})
    return json(res, 200, { items, total: items.length })
  }

  // ── GET /api/multimedia/:id — servir archivo ──────────────────────────────
  const multimediaMatch = pathname.match(/^\/api\/multimedia\/([^/]+)$/)
  if (multimediaMatch && method === 'GET') {
    const id = decodeURIComponent(multimediaMatch[1])
    const record = panelDb?.multimedia?.[id] || Object.values(panelDb?.multimedia || {}).find(m => m?.filename === id)
    if (!record?.path) return json(res, 404, { error: 'Archivo no encontrado' })
    try {
      const fs = await import('fs')
      if (!fs.existsSync(record.path)) return json(res, 404, { error: 'Archivo no encontrado en disco' })
      const stat = fs.statSync(record.path)
      res.statusCode = 200
      res.setHeader('Content-Type', record.contentType || 'application/octet-stream')
      res.setHeader('Content-Length', stat.size)
      res.setHeader('Content-Disposition', `inline; filename="${record.filename}"`)
      res.setHeader('Cache-Control', 'public, max-age=86400')
      fs.createReadStream(record.path).pipe(res)
      return
    } catch (err) { return json(res, 500, { error: err?.message }) }
  }

  if (pathname === '/api/multimedia/stats' && method === 'GET') {
    const items = Object.values(panelDb?.multimedia || {})
    return json(res, 200, { total: items.length })
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
      const { getTerminalLines } = await import('../../lib/terminal-mirror.js')
      const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 1000, fallback: 200 })
      return json(res, 200, { output: getTerminalLines(limit) })
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
    const chats = panelDb?.supportChats || {}
    const myChat = chats[auth.user.username] || { messages: [] }
    return json(res, 200, myChat)
  }

  if (pathname === '/api/support/my-chat' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    const msg = { id: Date.now(), text: safeString(body?.text || body?.message || ''), from: auth.user.username, at: new Date().toISOString() }
    panelDb.supportChats ||= {}
    panelDb.supportChats[auth.user.username] ||= { messages: [] }
    panelDb.supportChats[auth.user.username].messages.push(msg)
    if (global.db?.write) await global.db.write()
    return json(res, 200, { success: true, message: msg })
  }

  if (pathname === '/api/support/chats' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const chats = Object.entries(panelDb?.supportChats || {}).map(([user, chat]) => ({ user, ...chat }))
    return json(res, 200, { chats })
  }

  // ── /api/proveedores ──────────────────────────────────────────────────────
  if (pathname === '/api/proveedores/stats' && method === 'GET') {
    const proveedores = Object.values(panelDb?.proveedores || {})
    return json(res, 200, { total: proveedores.length, activos: proveedores.filter(p => p?.activo !== false).length })
  }

  if (pathname === '/api/proveedores/me' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const proveedores = Object.values(panelDb?.proveedores || {})
    const mine = proveedores.find(p => p?.usuario === auth.user.username || p?.jid === auth.user.jid)
    return json(res, 200, { proveedor: mine || null })
  }

  if (pathname === '/api/proveedores' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const proveedores = Object.values(panelDb?.proveedores || {})
    const list = isAdmin(auth.user) ? proveedores : proveedores.filter(p => p?.activo !== false)
    return json(res, 200, { proveedores: list, total: list.length })
  }

  if (pathname === '/api/proveedores' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    const id = safeString(body?.jid || body?.id || Date.now())
    const record = { id, ...body, usuario: auth.user.username, activo: true, createdAt: new Date().toISOString() }
    panelDb.proveedores ||= {}
    panelDb.proveedores[id] = record
    if (global.db?.write) await global.db.write()
    return json(res, 201, { success: true, proveedor: record })
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
    const messages = Object.values(panelDb?.scheduledMessages || {})
    return json(res, 200, { messages, total: messages.length })
  }

  if (pathname === '/api/scheduled-messages' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    if (!body?.message || !body?.jid) return json(res, 400, { error: 'message y jid son requeridos' })
    const id = Date.now()
    const record = { id, ...body, createdAt: new Date().toISOString(), createdBy: auth.user.username, status: 'pending' }
    panelDb.scheduledMessages ||= {}
    panelDb.scheduledMessages[id] = record
    if (global.db?.write) await global.db.write()
    return json(res, 201, { success: true, message: record })
  }

  // ── GET /api/logs ─────────────────────────────────────────────────────────
  if (pathname === '/api/logs' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    try {
      const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 500, fallback: 100 })
      const level = url.searchParams.get('level') || null
      const page = clampInt(url.searchParams.get('page'), { min: 1, max: 9999, fallback: 1 })
      let logs = global.db?.data?.logs || []
      if (level) logs = logs.filter(l => l?.level === level)
      logs = [...logs].reverse()
      const total = logs.length
      const offset = (page - 1) * limit
      return json(res, 200, { logs: logs.slice(offset, offset + limit), total, page, limit })
    } catch { return json(res, 200, { logs: [], total: 0 }) }
  }

  // ── GET|POST /api/custom-commands ─────────────────────────────────────────
  if (pathname === '/api/custom-commands') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const cmds = panelDb?.customCommands || {}
    if (method === 'GET') return json(res, 200, { commands: Object.values(cmds) })
    if (method === 'POST') {
      const body = await readJson(req)
      const name = safeString(body?.name || '').trim()
      if (!name) return json(res, 400, { error: 'name es requerido' })
      cmds[name] = { name, response: safeString(body?.response || ''), createdAt: new Date().toISOString() }
      panelDb.customCommands = cmds
      return json(res, 201, { success: true, command: cmds[name] })
    }
  }

  // ── POST /api/custom-commands/test ────────────────────────────────────────
  if (pathname === '/api/custom-commands/test' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    return json(res, 200, { success: true, output: safeString(body?.response || '') })
  }

  // ── POST /api/grupos/bulk-update ──────────────────────────────────────────
  if (pathname === '/api/grupos/bulk-update' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
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

  // ── DELETE /api/notificaciones/bulk-delete ────────────────────────────────
  if (pathname === '/api/notificaciones/bulk-delete' && method === 'DELETE') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    const ids = Array.isArray(body?.ids) ? body.ids : []
    try {
      const notifSystem = (await import('../../lib/notification-system.js')).default
      let deleted = 0
      for (const id of ids) {
        if (notifSystem?.deleteNotification?.(id)) deleted++
      }
      return json(res, 200, { success: true, deleted })
    } catch { return json(res, 200, { success: true, deleted: 0 }) }
  }

  // ── GET /api/stats/realtime ───────────────────────────────────────────────
  if (pathname === '/api/stats/realtime' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    try {
      const realTimeData = (await import('../../lib/real-time-data.js')).default
      return json(res, 200, realTimeData.getDashboardStats?.() || {})
    } catch { return json(res, 200, {}) }
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

  return json(res, 404, { error: 'Ruta no encontrada' })
}
