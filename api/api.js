/**
 * api/api.js — Servidor HTTP principal del panel
 * Reemplaza lib/panel-api.js
 */
import http from 'http'
import fs from 'fs'
import path from 'path'
import mime from 'mime-types'

import { withCors, getClientIP, getTokenFromRequest, isAllowedIP, getUserFromToken, json } from './middleware/core.js'
import { apiLimiter } from './middleware/rate-limit.js'

import { handleAuth }          from './routes/auth.js'
import { handleBot }           from './routes/bot.js'
import { handleGrupos }        from './routes/grupos.js'
import { handleSubbots }       from './routes/subbots.js'
import { handleUsuarios }      from './routes/usuarios.js'
import { handleAportes }       from './routes/aportes.js'
import { handleSystem }        from './routes/system.js'
import { handleNotifications } from './routes/notifications.js'
import { handleConfig }        from './routes/config.js'
import { handleMisc }          from './routes/misc.js'

// Re-exportar emitters de Socket.IO para compatibilidad con index.js
export {
  emitBotStatus, emitBotQR, emitBotConnected, emitBotDisconnected,
  emitSubbotCreated, emitSubbotQR, emitSubbotPairingCode,
  emitSubbotConnected, emitSubbotDisconnected, emitSubbotDeleted,
  emitSubbotUpdated, emitSubbotStatus,
  emitAporteCreated, emitAporteUpdated,
  emitPedidoCreated, emitPedidoUpdated,
  emitGrupoUpdated, emitNotification, emitLogEntry
} from '../lib/socket-io.js'

// ─── Sistemas lazy-loaded ─────────────────────────────────────────────────────
let notificationSystem, taskScheduler, backupSystem, alertSystem
let NOTIFICATION_TYPES, NOTIFICATION_CATEGORIES

async function initSystems() {
  const tryLoad = async (mod, fallback) => {
    try { return (await import(mod)).default } catch (e) { console.warn(`[api] ${mod}:`, e.message); return fallback }
  }
  try {
    const m = await import('../lib/notification-system.js')
    notificationSystem = m.default
    global.sendTemplateNotification = m.sendTemplateNotification
    NOTIFICATION_TYPES = m.NOTIFICATION_TYPES
    NOTIFICATION_CATEGORIES = m.NOTIFICATION_CATEGORIES
  } catch (e) {
    console.warn('[api] notification-system:', e.message)
    notificationSystem = { send: () => Promise.resolve(), isRunning: false, start: () => {} }
    global.sendTemplateNotification = () => Promise.resolve()
    NOTIFICATION_TYPES = { INFO: 'info', SUCCESS: 'success', WARNING: 'warning', ERROR: 'error', CRITICAL: 'critical' }
    NOTIFICATION_CATEGORIES = { SYSTEM: 'system', BOT: 'bot', USER: 'user', SECURITY: 'security' }
  }
  taskScheduler = await tryLoad('../lib/task-scheduler.js', { getAllTasks: () => [], isRunning: false, createTask: () => Promise.resolve(), executeTask: () => Promise.resolve() })
  backupSystem   = await tryLoad('../lib/backup-system.js',  { isRunning: false, createBackup: () => Promise.resolve(), getBackups: () => [] })
  alertSystem    = await tryLoad('../lib/alert-system.js',   { getAllAlerts: () => [], collectMetrics: () => Promise.resolve({}), isRunning: false })
}

// ─── ensurePanelDb ────────────────────────────────────────────────────────────
function ensurePanelDb() {
  if (!global.db?.data) return null
  const d = global.db.data

  // Migrar datos legacy de db.data.panel.* → db.data.*
  if (d.panel && typeof d.panel === 'object') {
    const p = d.panel
    if (p.subbots && !Object.keys(d.subbots || {}).length)        d.subbots        = p.subbots
    if (p.groups  && !Object.keys(d.groups  || {}).length)        d.groups         = p.groups
    if (p.aportes && !Object.keys(d.aportes || {}).length)        d.aportes        = p.aportes
    if (p.pedidos && !Object.keys(d.pedidos || {}).length)        d.pedidos        = p.pedidos
    if (p.multimedia && !Object.keys(d.multimedia || {}).length)  d.multimedia     = p.multimedia
    if (p.systemConfig && !Object.keys(d.systemConfig || {}).length) d.systemConfig = p.systemConfig
    if (p.botGlobalState && !d.botGlobalState?.lastUpdated)       d.botGlobalState = p.botGlobalState
    if (p.botGlobalOffMessage && !d.botGlobalOffMessage)          d.botGlobalOffMessage = p.botGlobalOffMessage
    if (p.notifications?.length && !d.notifications?.length)      d.notifications  = p.notifications
    if (p.subbotsCounter && !d.subbotsCounter)                    d.subbotsCounter = p.subbotsCounter
  }

  d.panelConfig    ??= {}
  d.subbots        ??= {}
  d.groups         ??= {}
  d.usuarios       ??= {}
  d.aportes        ??= {}
  d.pedidos        ??= {}
  d.notifications  ??= []
  d.multimedia     ??= {}
  d.systemConfig   ??= {}
  d.botGlobalState ??= { isOn: true }
  return d
}

// ─── Archivos estáticos ───────────────────────────────────────────────────────
function serveStatic(req, res, pathname) {
  const isMedia = pathname.startsWith('/media/')
  const root = path.join(process.cwd(), isMedia ? 'storage/media' : 'storage/library')
  const rel = decodeURIComponent(pathname.slice(isMedia ? 7 : 9)).replace(/\\/g, '/')
  if (!rel || rel.includes('..')) { res.statusCode = 400; res.end('Bad request'); return }
  const filePath = path.resolve(root, rel)
  if (!filePath.startsWith(path.resolve(root))) { res.statusCode = 400; res.end('Bad request'); return }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) { res.statusCode = 404; res.end('Not found'); return }
  res.statusCode = 200
  res.setHeader('Content-Type', mime.lookup(filePath) || 'application/octet-stream')
  fs.createReadStream(filePath).pipe(res)
}

// ─── Servidor ─────────────────────────────────────────────────────────────────
let panelServer = null

export async function startPanelApi({ port, host } = {}) {
  if (panelServer) return panelServer

  await initSystems()

  const PORT = Number(process.env.PANEL_PORT || process.env.PORT || port || 3001)
  const HOST = process.env.PANEL_HOST || host || '0.0.0.0'

  panelServer = http.createServer(async (req, res) => {
    try {
      if (withCors(req, res)) return

      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
      const pathname = url.pathname
      const method = req.method.toUpperCase()

      // Archivos estáticos
      if (method === 'GET' && (pathname.startsWith('/media/') || pathname.startsWith('/library/'))) {
        return serveStatic(req, res, pathname)
      }

      // Rate limiting global — excluir socket.io y endpoints de polling frecuente
      const skipRateLimit = pathname === '/api/health' ||
        pathname.startsWith('/socket.io') ||
        pathname === '/api/bot/status' ||
        pathname === '/api/subbot/status' ||
        pathname === '/api/subbots/status' ||
        pathname === '/api/bot/global-state' ||
        pathname === '/api/system/stats' ||
        pathname === '/api/dashboard/stats'

      if (!skipRateLimit && !apiLimiter(req, res)) {
        return json(res, 429, { error: 'Demasiadas solicitudes. Intenta más tarde.' })
      }

      // Cargar DB
      if (typeof global.loadDatabase === 'function') await global.loadDatabase()
      const panelDb = ensurePanelDb()

      // Modo mantenimiento
      if (panelDb?.systemConfig?.maintenanceMode) {
        const exempt = pathname === '/api/health' || pathname.startsWith('/api/auth/') || pathname === '/api/system/config'
        if (!exempt) {
          const ip = getClientIP(req)
          const token = getTokenFromRequest(req, url)
          const user = token ? getUserFromToken(token) : null
          const isAdmin = user && ['owner', 'admin', 'administrador'].includes(user.rol?.toLowerCase())
          if (!isAllowedIP(ip, panelDb) && !isAdmin) {
            return json(res, 503, {
              error: panelDb.systemConfig.maintenanceMessage || 'Sistema en mantenimiento. Vuelve pronto.',
              maintenance: true,
            })
          }
        }
      }

      const ctx = { req, res, url, panelDb, notificationSystem, taskScheduler, backupSystem, alertSystem, NOTIFICATION_TYPES, NOTIFICATION_CATEGORIES }

      // Dispatch por dominio
      if (pathname.startsWith('/api/auth/'))                                          return await handleAuth(ctx)
      if (pathname.startsWith('/api/bot') || pathname.startsWith('/api/dashboard'))   return await handleBot(ctx)
      if (pathname.startsWith('/api/grupos'))                                         return await handleGrupos(ctx)
      if (pathname.startsWith('/api/subbots') || pathname.startsWith('/api/subbot'))  return await handleSubbots(ctx)
      if (pathname.startsWith('/api/usuarios') || pathname === '/api/users')          return await handleUsuarios(ctx)
      if (pathname.startsWith('/api/aportes') || pathname.startsWith('/api/pedidos')) return await handleAportes(ctx)
      if (pathname.startsWith('/api/system') || pathname.startsWith('/api/dashboard') || pathname === '/api/health') return await handleSystem(ctx)
      if (pathname.startsWith('/api/notificaciones'))                                 return await handleNotifications(ctx)
      // /api/config tiene su propio router — intentar antes de misc
      if (pathname.startsWith('/api/config')) {
        const handled = await handleConfig(ctx)
        if (handled !== null) return handled
      }
      return await handleMisc(ctx)

    } catch (err) {
      console.error('[api] Error no manejado:', err)
      try { json(res, 500, { error: 'Error interno del servidor' }) } catch {}
    }
  })

  // Socket.IO
  const { initSocketIO } = await import('../lib/socket-io.js')
  const io = initSocketIO(panelServer)
  global.io = io

  await new Promise((resolve, reject) => panelServer.listen(PORT, HOST, err => err ? reject(err) : resolve()))
  console.log(`🌐 Panel API en http://${HOST}:${PORT}`)

  startPeriodicTasks(io)
  return panelServer
}

// ─── Tareas periódicas ────────────────────────────────────────────────────────
function startPeriodicTasks(io) {
  // Stats cada 30s
  setTimeout(() => {
    setInterval(() => {
      try {
        const panelDb = ensurePanelDb()
        if (!panelDb || !io?.engine?.clientsCount) return
        const logs = global.db?.data?.logs || []
        const today = new Date().toDateString()
        const logsToday = logs.filter(l => { try { return new Date(l?.timestamp).toDateString() === today } catch { return false } })
        const stats = {
          logsToday: logsToday.length,
          mensajesHoy: logsToday.filter(l => l?.tipo === 'mensaje').length,
          comandosHoy: logsToday.filter(l => l?.tipo === 'comando').length,
          usuariosActivos: new Set(logsToday.map(l => l?.usuario).filter(Boolean)).size,
          botGlobalState: panelDb.botGlobalState?.isOn !== false,
          botConnected: global.stopped === 'open',
          totalGroups: Object.keys(panelDb.groups || {}).length,
          totalSubbots: Object.keys(panelDb.subbots || {}).length,
        }
        const changed = JSON.stringify(stats) !== JSON.stringify(global._lastStats)
        if (changed || !global._lastStatsAt || Date.now() - global._lastStatsAt > 300000) {
          io.emit('stats:updated', stats); io.emit('stats:update', stats)
          global._lastStats = stats; global._lastStatsAt = Date.now()
        }
      } catch {}
    }, 30000)
  }, 5000)

  // Limpieza de notificaciones cada 6h
  setTimeout(async () => {
    try {
      const { performNotificationMaintenance } = await import('../lib/notification-cleanup.js')
      const run = () => { try { const db = ensurePanelDb(); if (db) performNotificationMaintenance(db) } catch {} }
      run()
      setInterval(run, 6 * 60 * 60 * 1000)
    } catch {}
  }, 60000)
}
