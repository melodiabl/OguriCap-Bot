import { Server } from 'socket.io'

let io = null
const connectedClients = new Map()

// Eventos que se pueden emitir
export const SOCKET_EVENTS = {
  // Bot principal
  BOT_STATUS: 'bot:status',
  BOT_QR: 'bot:qr',
  BOT_CONNECTED: 'bot:connected',
  BOT_DISCONNECTED: 'bot:disconnected',
  BOT_MESSAGE: 'bot:message',
  
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
    transports: ['websocket', 'polling'],
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
    })
    
    socket.on('error', (error) => {
      console.error(`[Socket.IO] Error en socket ${socket.id}:`, error)
    })
  })
  
  console.log('[Socket.IO] Servidor inicializado')
  
  // Emitir stats del sistema cada 10 segundos
  setInterval(() => {
    emitSystemStats()
  }, 10000)
  
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
  
  const status = {
    connected,
    isConnected: connected,
    connecting,
    status: statusRaw,
    connectionStatus: statusRaw,
    phone,
    qrCode: qr,
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
  
  socket.emit(SOCKET_EVENTS.BOT_STATUS, {
    connected,
    isConnected: connected,
    connecting,
    status: statusRaw,
    connectionStatus: statusRaw,
    phone,
    qrCode: qr,
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
export function emitSubbotStatus(subbots) {
  if (!io) return
  io.emit(SOCKET_EVENTS.SUBBOT_STATUS, { 
    subbots, 
    timestamp: new Date().toISOString() 
  })
}

function emitSubbotStatusTo(socket) {
  const conns = Array.isArray(global.conns) ? global.conns : []
  const subbots = conns.map(conn => ({
    subbotCode: conn?.subbotCode || 'unknown',
    isOnline: Boolean(conn?.user),
    phone: conn?.user?.id || null,
  }))
  socket.emit(SOCKET_EVENTS.SUBBOT_STATUS, { subbots, timestamp: new Date().toISOString() })
}

/**
 * Emite actualización de estadísticas
 */
export function emitStatsUpdate(stats) {
  if (!io) return
  io.emit(SOCKET_EVENTS.STATS_UPDATE, { ...stats, timestamp: new Date().toISOString() })
}

function emitStatsTo(socket) {
  // Emitir stats básicas
  const stats = {
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    timestamp: new Date().toISOString(),
  }
  socket.emit(SOCKET_EVENTS.STATS_UPDATE, stats)
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
  io.emit(SOCKET_EVENTS.LOG_ENTRY, { ...log, timestamp: new Date().toISOString() })
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
