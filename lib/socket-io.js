import { Server } from 'socket.io'

let io = null
const connectedClients = new Map()
let resourceMonitorStartedBySockets = false
let resourceMonitorPromise = null

async function getResourceMonitor() {
  if (!resourceMonitorPromise) {
    resourceMonitorPromise = import('./resource-monitor.js')
      .then((m) => m?.default)
      .catch(() => null)
  }
  return resourceMonitorPromise
}

async function startResourceMonitorIfNeeded() {
  const resourceMonitor = await getResourceMonitor()
  if (!resourceMonitor) return
  if (resourceMonitor.isMonitoring) return

  const configured =
    Number(process.env.PANEL_RESOURCE_MONITOR_INTERVAL || process.env.RESOURCE_MONITOR_INTERVAL || NaN)
  const interval = Number.isFinite(configured)
    ? configured
    : Number(resourceMonitor.updateInterval) || 5000

  if (typeof resourceMonitor.startMonitoring === 'function') {
    resourceMonitor.startMonitoring(interval)
    resourceMonitorStartedBySockets = true
  }
}

async function stopResourceMonitorIfIdle() {
  if (!resourceMonitorStartedBySockets) return
  const resourceMonitor = await getResourceMonitor()
  if (!resourceMonitor) return
  if (!resourceMonitor.isMonitoring) {
    resourceMonitorStartedBySockets = false
    return
  }
  if (typeof resourceMonitor.stopMonitoring === 'function') {
    resourceMonitor.stopMonitoring()
  }
  resourceMonitorStartedBySockets = false
}

// Eventos que se pueden emitir
export const SOCKET_EVENTS = {
  // Bot principal
  BOT_STATUS: 'bot:status',
  BOT_QR: 'bot:qr',
  BOT_CONNECTED: 'bot:connected',
  BOT_DISCONNECTED: 'bot:disconnected',
  BOT_MESSAGE: 'bot:message',
  BOT_PAIRING_CODE: 'bot:pairingCode',
  
  // Subbots
  SUBBOT_CREATED: 'subbot:created',
  SUBBOT_QR: 'subbot:qr',
  SUBBOT_PAIRING_CODE: 'subbot:pairingCode',
  SUBBOT_CONNECTED: 'subbot:connected',
  SUBBOT_DISCONNECTED: 'subbot:disconnected',
  SUBBOT_DELETED: 'subbot:deleted',
  SUBBOT_STATUS: 'subbot:status',
  
  // Dashboard
  STATS_UPDATE: 'stats:update',
  
  // Aportes
  APORTE_CREATED: 'aporte:created',
  APORTE_UPDATED: 'aporte:updated',
  APORTE_DELETED: 'aporte:deleted',
  
  // Pedidos
  PEDIDO_CREATED: 'pedido:created',
  PEDIDO_UPDATED: 'pedido:updated',
  PEDIDO_DELETED: 'pedido:deleted',
  
  // Grupos
  GRUPO_UPDATED: 'grupo:updated',
  GRUPO_SYNCED: 'grupo:synced',
  
  // Usuarios
  USUARIO_CREATED: 'usuario:created',
  USUARIO_UPDATED: 'usuario:updated',
  
  // Notificaciones
  NOTIFICATION: 'notification',
  
  // Sistema
  SYSTEM_STATS: 'system:stats',
  LOG_ENTRY: 'log:entry',
  
  // Estado global del bot
  BOT_GLOBAL_STATE_CHANGED: 'bot:globalStateChanged',
  BOT_GLOBAL_SHUTDOWN: 'bot:globalShutdown',
  BOT_GLOBAL_STARTUP: 'bot:globalStartup',

  // Tasks (scheduler)
  TASK_CREATED: 'task:created',
  TASK_UPDATED: 'task:updated',
  TASK_DELETED: 'task:deleted',
  TASK_EXECUTED: 'task:executed',
}

/**
 * Inicializa el servidor Socket.IO
 * @param {http.Server} httpServer - Servidor HTTP existente
 */
export function initSocketIO(httpServer) {
  if (io) return io
  
  const corsOrigin = process.env.PANEL_CORS_ORIGIN || '*'
  
  io = new Server(httpServer, {
    cors: {
      origin: corsOrigin === '*' ? true : corsOrigin.split(','),
      methods: ['GET', 'POST'],
      credentials: corsOrigin !== '*',
    },
    pingTimeout: 120000,
    pingInterval: 30000,
    connectTimeout: 45000,
    transports: ['polling', 'websocket'], // Polling primero, luego websocket
    allowUpgrades: true,
    perMessageDeflate: false,
  })
  
  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Cliente conectado: ${socket.id}`)
    connectedClients.set(socket.id, {
      connectedAt: new Date(),
      subscriptions: new Set(),
    })
    
    // Enviar estado inicial del bot
    emitBotStatus()

    // Iniciar monitor de recursos solo cuando haya clientes conectados (evita intervalos cuando el panel no se usa)
    if (io?.engine?.clientsCount === 1) {
      void startResourceMonitorIfNeeded()
    }
    
    // Suscripción a canales específicos
    socket.on('subscribe', (channels) => {
      const client = connectedClients.get(socket.id)
      if (client && Array.isArray(channels)) {
        channels.forEach(channel => {
          socket.join(channel)
          client.subscriptions.add(channel)
        })
      }
    })
    
    socket.on('unsubscribe', (channels) => {
      const client = connectedClients.get(socket.id)
      if (client && Array.isArray(channels)) {
        channels.forEach(channel => {
          socket.leave(channel)
          client.subscriptions.delete(channel)
        })
      }
    })
    
    // Solicitar estado actual
    socket.on('request:botStatus', () => {
      emitBotStatusTo(socket)
    })
    
    socket.on('request:subbotStatus', () => {
      emitSubbotStatusTo(socket)
    })
    
    socket.on('request:stats', () => {
      emitStatsTo(socket)
    })
    
    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Cliente desconectado: ${socket.id} - ${reason}`)
      connectedClients.delete(socket.id)

      // Detener monitor de recursos cuando no haya clientes conectados
      setTimeout(() => {
        if (!io) return
        if (io.engine.clientsCount === 0) {
          void stopResourceMonitorIfIdle()
        }
      }, 0)
    })
    
    socket.on('error', (error) => {
      console.error(`[Socket.IO] Error en socket ${socket.id}:`, error)
    })
  })
  
  console.log('[Socket.IO] Servidor inicializado')
  
  return io
}

/**
 * Obtiene la instancia de Socket.IO
 */
export function getIO() {
  return io
}

/**
 * Emite un evento a todos los clientes conectados
 */
export function emit(event, data) {
  if (!io) return
  io.emit(event, data)
}

/**
 * Emite un evento a un canal específico
 */
export function emitToChannel(channel, event, data) {
  if (!io) return
  io.to(channel).emit(event, data)
}

/**
 * Emite el estado actual del bot
 */
export function emitBotStatus() {
  if (!io) return
  
  const statusRaw = global.stopped || 'unknown'
  const connected = statusRaw === 'open'
  const connecting = statusRaw === 'connecting'
  const phone = global.conn?.user?.id || null
  const qr = global.panelApiMainQr || null
  const pairingCode = global.panelPairingCode || null
  const pairingPhone = global.panelPairingPhone || null
  
  const status = {
    connected,
    isConnected: connected,
    connecting,
    status: statusRaw,
    connectionStatus: statusRaw,
    phone,
    qrCode: qr,
    pairingCode,
    pairingPhone,
    uptime: formatUptime(process.uptime()),
    lastSeen: global.panelApiLastSeen || null,
    timestamp: new Date().toISOString(),
  }
  
  io.emit(SOCKET_EVENTS.BOT_STATUS, status)
}

function emitBotStatusTo(socket) {
  const statusRaw = global.stopped || 'unknown'
  const connected = statusRaw === 'open'
  const connecting = statusRaw === 'connecting'
  const phone = global.conn?.user?.id || null
  const qr = global.panelApiMainQr || null
  const pairingCode = global.panelPairingCode || null
  const pairingPhone = global.panelPairingPhone || null
  
  socket.emit(SOCKET_EVENTS.BOT_STATUS, {
    connected,
    isConnected: connected,
    connecting,
    status: statusRaw,
    connectionStatus: statusRaw,
    phone,
    qrCode: qr,
    pairingCode,
    pairingPhone,
    uptime: formatUptime(process.uptime()),
    lastSeen: global.panelApiLastSeen || null,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Emite QR del bot principal
 */
export function emitBotQR(qrData) {
  if (!io) return
  global.panelApiMainQr = qrData
  io.emit(SOCKET_EVENTS.BOT_QR, { qr: qrData, timestamp: new Date().toISOString() })
  emitBotStatus()
}

/**
 * Emite cuando el bot se conecta
 */
export function emitBotConnected(phone) {
  if (!io) return
  global.panelApiMainQr = null
  io.emit(SOCKET_EVENTS.BOT_CONNECTED, { phone, timestamp: new Date().toISOString() })
  emitBotStatus()
}

/**
 * Emite cuando el bot se desconecta
 */
export function emitBotDisconnected(reason) {
  if (!io) return
  io.emit(SOCKET_EVENTS.BOT_DISCONNECTED, { reason, timestamp: new Date().toISOString() })
  emitBotStatus()
}

/**
 * Emite código de pairing del bot principal
 */
export function emitBotPairingCode(pairingCode, phoneNumber) {
  if (!io) return
  global.panelPairingCode = pairingCode || null
  global.panelPairingPhone = phoneNumber || global.panelPairingPhone || null
  io.emit(SOCKET_EVENTS.BOT_PAIRING_CODE, {
    pairingCode: pairingCode || null,
    phoneNumber: phoneNumber || null,
    displayCode: pairingCode || null,
    timestamp: new Date().toISOString(),
  })
  emitBotStatus()
}

/**
 * Emite cuando se crea un subbot
 */
export function emitSubbotCreated(subbot) {
  if (!io) return
  io.emit(SOCKET_EVENTS.SUBBOT_CREATED, { subbot, timestamp: new Date().toISOString() })
}

/**
 * Emite QR de un subbot
 */
export function emitSubbotQR(subbotCode, qrData) {
  if (!io) return
  io.emit(SOCKET_EVENTS.SUBBOT_QR, { 
    subbotCode, 
    qr: qrData, 
    timestamp: new Date().toISOString() 
  })
}

/**
 * Emite código de pairing de un subbot
 */
export function emitSubbotPairingCode(subbotCode, pairingCode, phoneNumber) {
  if (!io) return
  io.emit(SOCKET_EVENTS.SUBBOT_PAIRING_CODE, { 
    subbotCode, 
    pairingCode,
    phoneNumber,
    displayCode: pairingCode,
    timestamp: new Date().toISOString() 
  })
}

/**
 * Emite cuando un subbot se conecta
 */
export function emitSubbotConnected(subbotCode, phone) {
  if (!io) return
  io.emit(SOCKET_EVENTS.SUBBOT_CONNECTED, { 
    subbotCode, 
    phone, 
    timestamp: new Date().toISOString() 
  })
}

/**
 * Emite cuando un subbot se desconecta
 */
export function emitSubbotDisconnected(subbotCode, reason) {
  if (!io) return
  io.emit(SOCKET_EVENTS.SUBBOT_DISCONNECTED, { 
    subbotCode, 
    reason, 
    timestamp: new Date().toISOString() 
  })
}

/**
 * Emite cuando se elimina un subbot
 */
export function emitSubbotDeleted(subbotCode) {
  if (!io) return
  io.emit(SOCKET_EVENTS.SUBBOT_DELETED, { 
    subbotCode, 
    timestamp: new Date().toISOString() 
  })
}

/**
 * Emite estado de todos los subbots
 */
function isConnOnline(conn) {
  if (!conn) return false
  if (conn.user) return true
  const readyState =
    conn?.ws?.socket?.readyState ??
    conn?.ws?.readyState ??
    conn?.ws?.ws?.readyState ??
    null
  if (typeof readyState === 'number') return readyState === 1
  return Boolean(conn.isInit)
}

export function emitSubbotStatus(subbots) {
  if (!io) return
  if (!Array.isArray(subbots)) {
    const conns = Array.isArray(global.conns) ? global.conns : []
    subbots = conns.map(conn => ({
      subbotCode: conn?.subbotCode || 'unknown',
      isOnline: isConnOnline(conn),
      phone: conn?.user?.jid || conn?.user?.id || conn?.authState?.creds?.me?.jid || conn?.authState?.creds?.me?.id || null,
    }))
  }
  io.emit(SOCKET_EVENTS.SUBBOT_STATUS, { 
    subbots, 
    timestamp: new Date().toISOString() 
  })
}

function emitSubbotStatusTo(socket) {
  const conns = Array.isArray(global.conns) ? global.conns : []
  const subbots = conns.map(conn => ({
    subbotCode: conn?.subbotCode || 'unknown',
    isOnline: isConnOnline(conn),
    phone: conn?.user?.jid || conn?.user?.id || conn?.authState?.creds?.me?.jid || conn?.authState?.creds?.me?.id || null,
  }))
  socket.emit(SOCKET_EVENTS.SUBBOT_STATUS, { subbots, timestamp: new Date().toISOString() })
}

/**
 * Emite actualización de estadísticas
 */
export function emitStatsUpdate(stats) {
  if (!io) return
  const payload = { ...(stats && typeof stats === 'object' ? stats : {}), timestamp: new Date().toISOString() }
  io.emit(SOCKET_EVENTS.STATS_UPDATE, payload)
  io.emit('stats:updated', payload)
}

function safeNumber(value, fallback = 0) {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function safeString(value, fallback = '') {
  if (typeof value === 'string') return value
  if (value == null) return fallback
  return String(value)
}

function getDayKey(d = new Date()) {
  return new Date(d).toISOString().slice(0, 10)
}

function safePct(current, previous) {
  const c = safeNumber(current, 0)
  const p = safeNumber(previous, 0)
  if (p <= 0) return c > 0 ? 100 : 0
  return Math.round(((c - p) / p) * 100)
}

function buildHourBuckets(entries) {
  const out = {}
  for (const l of entries || []) {
    const iso = safeString(l?.fecha || l?.timestamp || '')
    if (!iso) continue
    const hour = safeString(iso).slice(11, 13)
    if (!hour || hour.length !== 2) continue
    out[hour] = (out[hour] || 0) + 1
  }
  return out
}

function buildActividadPorHora(mensajesPorHora) {
  return Array.from({ length: 12 }, (_, i) => {
    const h0 = String(i * 2).padStart(2, '0')
    const h1 = String(i * 2 + 1).padStart(2, '0')
    const value = safeNumber(mensajesPorHora?.[h0], 0) + safeNumber(mensajesPorHora?.[h1], 0)
    return { label: `${h0}:00`, value, color: '#6366f1' }
  })
}

function getDashboardStatsSnapshot() {
  const now = new Date()
  const todayKey = getDayKey(now)
  const yesterdayKey = getDayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000))

  const db = global.db?.data || {}
  const panel = db.panel || {}

  const logs = Array.isArray(panel.logs) ? panel.logs : []
  const getLogDayKey = (l) => safeString(l?.fecha || l?.timestamp || '').slice(0, 10)
  const logsToday = logs.filter((l) => getLogDayKey(l) === todayKey)
  const logsYesterday = logs.filter((l) => getLogDayKey(l) === yesterdayKey)

  const dailyMetrics = panel?.dailyMetrics && typeof panel.dailyMetrics === 'object' ? panel.dailyMetrics : {}
  const daily = dailyMetrics?.[todayKey] || null
  const dailyYesterday = dailyMetrics?.[yesterdayKey] || null

  const logsMensajesToday = logsToday.filter((l) => l?.tipo === 'mensaje')
  const logsComandosToday = logsToday.filter((l) => l?.tipo === 'comando')

  const mensajesHoy = safeNumber(daily?.mensajes, logsMensajesToday.length)
  const comandosHoy = safeNumber(daily?.comandos, logsComandosToday.length)

  const totalMensajes = Object.values(dailyMetrics).reduce((sum, d) => sum + safeNumber(d?.mensajes, 0), 0)
  const totalComandos = Object.values(dailyMetrics).reduce((sum, d) => sum + safeNumber(d?.comandos, 0), 0)

  const mensajesPorHora =
    daily?.mensajesPorHora && typeof daily.mensajesPorHora === 'object'
      ? daily.mensajesPorHora
      : buildHourBuckets(logsMensajesToday)

  const actividadPorHora = buildActividadPorHora(mensajesPorHora)

  const panelUsers = Object.values(panel.users || {})
  const totalUsuarios = panelUsers.length
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const usuariosActivos = panelUsers.filter((u) => u?.last_login && new Date(u.last_login) >= oneDayAgo).length

  const chats = db.chats || {}
  const groupJids = Object.keys(chats).filter((jid) => safeString(jid).endsWith('@g.us'))
  const totalGrupos = panel?.groups ? Object.keys(panel.groups).length : groupJids.length
  const gruposActivos = groupJids.filter((jid) => chats?.[jid]?.isBanned !== true).length

  const aportes = Array.isArray(db.aportes) ? db.aportes : []
  const aportesHoy = aportes.filter((a) => safeString(a?.fecha_creacion || a?.created_at || a?.fecha || '').slice(0, 10) === todayKey).length
  const totalAportes = aportes.length

  const pedidosMap = panel?.pedidos && typeof panel.pedidos === 'object' ? panel.pedidos : {}
  const pedidos = Object.values(pedidosMap)
  const pedidosHoy = pedidos.filter((p) => safeString(p?.fecha_creacion || p?.created_at || p?.fecha || '').slice(0, 10) === todayKey).length
  const totalPedidos = pedidos.length

  const totalSubbots = panel?.subbots
    ? Object.keys(panel.subbots).length
    : (Array.isArray(global.conns) ? global.conns.length : 0)

  const whatsappUsers = Object.keys(db.users || {}).filter((jid) => safeString(jid).includes('@s.whatsapp.net')).length
  const comunidadActivosHoy = Object.values(db.users || {}).filter((u) => safeString(u?.lastSeen || '').slice(0, 10) === todayKey).length

  const disponibilidad = (global.stopped === 'open' || (global.conn && global.conn.user)) ? 100 : 0
  const erroresComandosHoy = safeNumber(daily?.erroresComandos, 0)
  const errorRate = comandosHoy > 0 ? Math.round(((erroresComandosHoy / comandosHoy) * 100) * 100) / 100 : 0

  return {
    // Compat antiguos
    usuarios: totalUsuarios,
    grupos: totalGrupos,
    aportes: totalAportes,
    pedidos: totalPedidos,
    subbots: totalSubbots,

    totalUsuarios,
    usuariosActivos,
    totalGrupos,
    gruposActivos,
    totalAportes,
    aportesHoy,
    totalPedidos,
    pedidosHoy,
    totalSubbots,

    mensajesHoy,
    comandosHoy,
    totalMensajes,
    totalComandos,
    actividadPorHora,

    comunidad: {
      usuariosWhatsApp: whatsappUsers,
      usuariosActivos: comunidadActivosHoy,
      mensajesHoy,
      comandosHoy,
      totalMensajes,
      totalComandos,
      gruposConBot: gruposActivos,
      mensajesRecibidos: mensajesHoy,
      comandosEjecutados: comandosHoy,
    },

    rendimiento: {
      tiempoRespuesta: 0,
      disponibilidad,
      errorRate,
      throughput: 0,
    },

    tendencias: {
      usuarios: safePct(comunidadActivosHoy, new Set(logsYesterday.map((l) => l?.usuario).filter(Boolean)).size),
      grupos: safePct(gruposActivos, gruposActivos),
      aportes: safePct(aportesHoy, 0),
      pedidos: safePct(pedidosHoy, 0),
      mensajes: safePct(mensajesHoy, safeNumber(dailyYesterday?.mensajes, 0)),
      comandos: safePct(comandosHoy, safeNumber(dailyYesterday?.comandos, 0)),
    },
  }
}

let dashboardStatsEmitTimer = null

export function emitDashboardStatsUpdateThrottled() {
  if (!io) return
  if (io?.engine?.clientsCount === 0) return
  if (dashboardStatsEmitTimer) return

  const throttleMs = safeNumber(process.env.PANEL_DASHBOARD_STATS_THROTTLE_MS, 750)
  dashboardStatsEmitTimer = setTimeout(() => {
    dashboardStatsEmitTimer = null
    try {
      const snapshot = getDashboardStatsSnapshot()
      emitStatsUpdate(snapshot)
    } catch {
      // Silenciar para no spamear logs
    }
  }, Math.max(0, throttleMs))
}

function emitStatsTo(socket) {
  const payload = { ...getDashboardStatsSnapshot(), timestamp: new Date().toISOString() }
  socket.emit(SOCKET_EVENTS.STATS_UPDATE, payload)
  socket.emit('stats:updated', payload)
}

/**
 * Emite estadísticas del sistema
 */
export function emitSystemStats() {
  if (!io) return
  
  const mem = process.memoryUsage()
  const stats = {
    uptime: process.uptime(),
    platform: process.platform,
    node: process.version,
    memory: {
      rss: mem.rss,
      heapUsed: mem.heapUsed,
      heapTotal: mem.heapTotal,
      external: mem.external,
    },
    timestamp: new Date().toISOString(),
  }
  
  io.emit(SOCKET_EVENTS.SYSTEM_STATS, stats)
}

/**
 * Emite un nuevo aporte
 */
export function emitAporteCreated(aporte) {
  if (!io) return
  io.emit(SOCKET_EVENTS.APORTE_CREATED, { aporte, timestamp: new Date().toISOString() })
}

/**
 * Emite actualización de aporte
 */
export function emitAporteUpdated(aporte) {
  if (!io) return
  io.emit(SOCKET_EVENTS.APORTE_UPDATED, { aporte, timestamp: new Date().toISOString() })
}

/**
 * Emite eliminación de aporte
 */
export function emitAporteDeleted(aporteId) {
  if (!io) return
  io.emit(SOCKET_EVENTS.APORTE_DELETED, { aporteId, timestamp: new Date().toISOString() })
}

/**
 * Emite un nuevo pedido
 */
export function emitPedidoCreated(pedido) {
  if (!io) return
  io.emit(SOCKET_EVENTS.PEDIDO_CREATED, { pedido, timestamp: new Date().toISOString() })
}

/**
 * Emite actualización de pedido
 */
export function emitPedidoUpdated(pedido) {
  if (!io) return
  io.emit(SOCKET_EVENTS.PEDIDO_UPDATED, { pedido, timestamp: new Date().toISOString() })
}

/**
 * Emite eliminación de pedido
 */
export function emitPedidoDeleted(pedidoId) {
  if (!io) return
  io.emit(SOCKET_EVENTS.PEDIDO_DELETED, { pedidoId, timestamp: new Date().toISOString() })
}

/**
 * Emite actualización de grupo
 */
export function emitGrupoUpdated(grupo) {
  if (!io) return
  io.emit(SOCKET_EVENTS.GRUPO_UPDATED, { grupo, timestamp: new Date().toISOString() })
}

/**
 * Emite sincronización de grupos
 */
export function emitGruposSynced(grupos) {
  if (!io) return
  io.emit(SOCKET_EVENTS.GRUPO_SYNCED, { grupos, timestamp: new Date().toISOString() })
}

/**
 * Emite notificación
 */
export function emitNotification(notification) {
  if (!io) return
  io.emit(SOCKET_EVENTS.NOTIFICATION, { ...notification, timestamp: new Date().toISOString() })
}

/**
 * Emite entrada de log
 */
export function emitLogEntry(log) {
  if (!io) return
  const ts = log?.timestamp || log?.fecha || new Date().toISOString()
  io.emit(SOCKET_EVENTS.LOG_ENTRY, { ...log, timestamp: ts })
}

/**
 * Obtiene el número de clientes conectados
 */
export function getConnectedClientsCount() {
  return connectedClients.size
}

/**
 * Formatea el uptime
 */
function formatUptime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

export default {
  initSocketIO,
  getIO,
  emit,
  emitToChannel,
  emitBotStatus,
  emitBotQR,
  emitBotConnected,
  emitBotDisconnected,
  emitBotPairingCode,
  emitSubbotCreated,
  emitSubbotQR,
  emitSubbotPairingCode,
  emitSubbotConnected,
  emitSubbotDisconnected,
  emitSubbotDeleted,
  emitSubbotStatus,
  emitStatsUpdate,
  emitSystemStats,
  emitAporteCreated,
  emitAporteUpdated,
  emitAporteDeleted,
  emitPedidoCreated,
  emitPedidoUpdated,
  emitPedidoDeleted,
  emitGrupoUpdated,
  emitGruposSynced,
  emitNotification,
  emitLogEntry,
  getConnectedClientsCount,
  SOCKET_EVENTS,
}
