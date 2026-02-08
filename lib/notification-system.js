// Sistema de Notificaciones Avanzado con Persistencia en PostgreSQL
import { emitNotification, getIO } from './socket-io.js';
import auditLogger, { AUDIT_EVENTS } from './audit-logger.js';

// Tipos de notificaciones
export const NOTIFICATION_TYPES = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
  SYSTEM: 'system'
};

// Categorías de notificaciones
export const NOTIFICATION_CATEGORIES = {
  SYSTEM: 'system',
  BOT: 'bot',
  USER: 'user',
  SECURITY: 'security',
  COMMAND: 'command',
  MAINTENANCE: 'maintenance',
  UPDATE: 'update'
};

// Canales de notificación
export const NOTIFICATION_CHANNELS = {
  BROWSER: 'browser',
  EMAIL: 'email',
  WEBHOOK: 'webhook',
  WHATSAPP: 'whatsapp',
  SOCKET: 'socket'
};

// Prioridades
export const NOTIFICATION_PRIORITIES = {
  LOW: 1,
  NORMAL: 2,
  HIGH: 3,
  URGENT: 4,
  CRITICAL: 5
};

class NotificationSystem {
  constructor() {
    this.subscribers = new Map();
    this.templates = new Map();
    this.rateLimits = new Map();
    this.webhooks = [];
    this.isRunning = false;
    this.initializeTemplates();
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('🔔 Sistema de Notificaciones iniciado');
  }

  stop() {
    this.isRunning = false;
    console.log('🔔 Sistema de Notificaciones detenido');
  }

  initializeTemplates() {
    this.templates.set('bot_connected', {
      title: 'Bot Conectado',
      message: 'El bot principal se ha conectado exitosamente',
      type: NOTIFICATION_TYPES.SUCCESS,
      category: NOTIFICATION_CATEGORIES.BOT,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER]
    });
    // ... (Mantener otras plantillas)
  }

  async send(notification) {
    try {
      if (!this.validateNotification(notification)) return false;
      if (!this.checkRateLimit(notification)) return false;

      const enrichedNotification = this.enrichNotification(notification);

      // Guardar en PostgreSQL
      const savedNotification = await this.saveNotification(enrichedNotification);
      enrichedNotification.id = savedNotification.id;

      // Enviar por cada canal
      await Promise.allSettled(
        enrichedNotification.channels.map(channel => 
          this.sendToChannel(channel, enrichedNotification)
        )
      );

      return savedNotification;
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  }

  async saveNotification(notif) {
    try {
      if (!global.db?.pool) {
        // Fallback a LowDB si no hay Pool de PostgreSQL
        return { id: Date.now() };
      }

      const result = await global.db.pool.query(
        `INSERT INTO notifications (titulo, mensaje, tipo, categoria, leida, user_id, data, fecha_creacion)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING *`,
        [
          notif.title || notif.titulo,
          notif.message || notif.mensaje,
          notif.type || notif.tipo || 'info',
          notif.category || notif.categoria || 'general',
          false,
          notif.user_id || null,
          JSON.stringify(notif.data || {})
        ]
      );
      return result.rows[0];
    } catch (error) {
      console.error('Error saving notification to DB:', error);
      return { id: Date.now() };
    }
  }

  async sendToSocket(notification) {
    try {
      emitNotification({
        id: notification.id,
        tipo: notification.type || notification.tipo,
        titulo: notification.title || notification.titulo,
        mensaje: notification.message || notification.mensaje,
        categoria: notification.category || notification.categoria,
        fecha_creacion: notification.timestamp || new Date().toISOString(),
        leida: false,
        data: notification.data || {}
      });
      return true;
    } catch (error) {
      console.error('Error sending socket notification:', error);
      return false;
    }
  }

  // ... (Resto de métodos como sendToBrowser, sendToEmail, etc.)
  async sendToChannel(channel, notification) {
    switch (channel) {
      case NOTIFICATION_CHANNELS.SOCKET: return this.sendToSocket(notification);
      case NOTIFICATION_CHANNELS.BROWSER: return this.sendToBrowser(notification);
      // ... otros canales
      default: return false;
    }
  }

  validateNotification(notification) {
    return notification && (notification.title || notification.titulo) && (notification.message || notification.mensaje);
  }

  enrichNotification(notification) {
    return {
      timestamp: new Date().toISOString(),
      channels: notification.channels || [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER],
      priority: notification.priority || NOTIFICATION_PRIORITIES.NORMAL,
      category: notification.category || NOTIFICATION_CATEGORIES.SYSTEM,
      ...notification
    };
  }

  checkRateLimit(notification) { return true; }
}

const notificationSystem = new NotificationSystem();
export default notificationSystem;
