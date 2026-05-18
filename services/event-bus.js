import EventEmitter from 'events'

/**
 * Event Bus Central - Unifica comunicación entre Baileys, Backend y Frontend
 * 
 * Flujo de datos:
 * Baileys → EventBus → Backend Services → Socket.IO → Frontend
 */

class EventBus extends EventEmitter {
  constructor() {
    super()
    this.setMaxListeners(100) // Aumentar límite para múltiples listeners
    this.eventHistory = []
    this.maxHistorySize = 1000
  }

  /**
   * Emitir evento y guardarlo en historial
   */
  emitEvent(eventName, data) {
    const event = {
      name: eventName,
      data,
      timestamp: new Date().toISOString(),
      id: `${eventName}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }

    // Guardar en historial
    this.eventHistory.unshift(event)
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.pop()
    }

    // Emitir evento
    this.emit(eventName, data)
    this.emit('*', event) // Wildcard para logging

    return event.id
  }

  /**
   * Obtener historial de eventos
   */
  getHistory(eventName = null, limit = 100) {
    if (eventName) {
      return this.eventHistory.filter(e => e.name === eventName).slice(0, limit)
    }
    return this.eventHistory.slice(0, limit)
  }

  /**
   * Limpiar historial
   */
  clearHistory() {
    this.eventHistory = []
  }
}

// Singleton
const eventBus = new EventBus()

// ============================================
// EVENTOS DEL SISTEMA
// ============================================

export const EVENTS = {
  // Conexión de Baileys
  BOT_CONNECTED: 'bot.connected',
  BOT_DISCONNECTED: 'bot.disconnected',
  BOT_QR_GENERATED: 'bot.qr.generated',
  BOT_PAIRING_CODE: 'bot.pairing.code',
  BOT_RECONNECTING: 'bot.reconnecting',

  // Mensajes
  MESSAGE_RECEIVED: 'message.received',
  MESSAGE_SENT: 'message.sent',
  MESSAGE_DELETED: 'message.deleted',
  MESSAGE_UPDATED: 'message.updated',

  // Grupos
  GROUP_SYNCED: 'group.synced',
  GROUP_SYNC_START: 'group.sync.start',
  GROUP_SYNC_COMPLETE: 'group.sync.complete',
  GROUP_SYNC_ERROR: 'group.sync.error',
  GROUP_UPDATED: 'group.updated',
  GROUP_PARTICIPANT_ADDED: 'group.participant.added',
  GROUP_PARTICIPANT_REMOVED: 'group.participant.removed',

  // Usuarios
  USER_JOINED: 'user.joined',
  USER_LEFT: 'user.left',
  USER_UPDATED: 'user.updated',
  USER_BANNED: 'user.banned',
  USER_UNBANNED: 'user.unbanned',

  // Pedidos
  PEDIDO_CREATED: 'pedido.created',
  PEDIDO_UPDATED: 'pedido.updated',
  PEDIDO_DELETED: 'pedido.deleted',
  PEDIDO_RESOLVED: 'pedido.resolved',

  // Aportes
  APORTE_CREATED: 'aporte.created',
  APORTE_UPDATED: 'aporte.updated',
  APORTE_DELETED: 'aporte.deleted',
  APORTE_APPROVED: 'aporte.approved',

  // Subbots
  SUBBOT_CONNECTED: 'subbot.connected',
  SUBBOT_DISCONNECTED: 'subbot.disconnected',
  SUBBOT_QR_GENERATED: 'subbot.qr.generated',
  SUBBOT_CREATED: 'subbot.created',
  SUBBOT_DELETED: 'subbot.deleted',

  // Sistema
  SYSTEM_ERROR: 'system.error',
  SYSTEM_WARNING: 'system.warning',
  SYSTEM_INFO: 'system.info',
  SYSTEM_STATS_UPDATED: 'system.stats.updated',

  // Notificaciones
  NOTIFICATION_CREATED: 'notification.created',
  NOTIFICATION_READ: 'notification.read',
  NOTIFICATION_DELETED: 'notification.deleted',
}

// ============================================
// HELPERS PARA EMITIR EVENTOS COMUNES
// ============================================

export const emitBotConnected = (data) => 
  eventBus.emitEvent(EVENTS.BOT_CONNECTED, data)

export const emitBotDisconnected = (reason) => 
  eventBus.emitEvent(EVENTS.BOT_DISCONNECTED, { reason })

export const emitGroupSyncStart = () => 
  eventBus.emitEvent(EVENTS.GROUP_SYNC_START, { timestamp: Date.now() })

export const emitGroupSyncComplete = (synced, filtered, total) => 
  eventBus.emitEvent(EVENTS.GROUP_SYNC_COMPLETE, { synced, filtered, total })

export const emitGroupSyncError = (error) => 
  eventBus.emitEvent(EVENTS.GROUP_SYNC_ERROR, { error: error.message })

export const emitGroupUpdated = (group) => 
  eventBus.emitEvent(EVENTS.GROUP_UPDATED, group)

export const emitPedidoCreated = (pedido) => 
  eventBus.emitEvent(EVENTS.PEDIDO_CREATED, pedido)

export const emitPedidoUpdated = (pedido) => 
  eventBus.emitEvent(EVENTS.PEDIDO_UPDATED, pedido)

export const emitPedidoDeleted = (id) => 
  eventBus.emitEvent(EVENTS.PEDIDO_DELETED, { id })

export const emitAporteCreated = (aporte) => 
  eventBus.emitEvent(EVENTS.APORTE_CREATED, aporte)

export const emitAporteUpdated = (aporte) => 
  eventBus.emitEvent(EVENTS.APORTE_UPDATED, aporte)

export const emitAporteDeleted = (id) => 
  eventBus.emitEvent(EVENTS.APORTE_DELETED, { id })

export const emitSystemError = (error, context = {}) => 
  eventBus.emitEvent(EVENTS.SYSTEM_ERROR, { error: error.message, stack: error.stack, ...context })

export const emitSystemWarning = (message, context = {}) => 
  eventBus.emitEvent(EVENTS.SYSTEM_WARNING, { message, ...context })

export const emitNotification = (notification) => 
  eventBus.emitEvent(EVENTS.NOTIFICATION_CREATED, notification)

export default eventBus
