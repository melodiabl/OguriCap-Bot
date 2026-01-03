// Sistema de Notificaciones Avanzado

import { emitNotification, getIO } from './socket-io.js';
import auditLogger, { AUDIT_EVENTS } from './audit-logger.js';

// Tipos de notificaciones
export const NOTIFICATION_TYPES = {
  INFO: 'info',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical'
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
    this.subscribers = new Map(); // Canal -> Set de suscriptores
    this.templates = new Map(); // Plantillas de notificaciones
    this.rateLimits = new Map(); // Rate limiting por usuario/tipo
    this.webhooks = []; // Webhooks configurados
    this.isRunning = false; // Estado del sistema
    
    this.initializeTemplates();
  }

  /**
   * Inicia el sistema de notificaciones
   */
  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log('🔔 Sistema de Notificaciones iniciado');
  }

  /**
   * Detiene el sistema de notificaciones
   */
  stop() {
    this.isRunning = false;
    console.log('🔔 Sistema de Notificaciones detenido');
  }

  /**
   * Inicializa plantillas de notificaciones
   */
  initializeTemplates() {
    this.templates.set('bot_connected', {
      title: 'Bot Conectado',
      message: 'El bot principal se ha conectado exitosamente',
      type: NOTIFICATION_TYPES.SUCCESS,
      category: NOTIFICATION_CATEGORIES.BOT,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER]
    });

    this.templates.set('bot_disconnected', {
      title: 'Bot Desconectado',
      message: 'El bot principal se ha desconectado',
      type: NOTIFICATION_TYPES.ERROR,
      category: NOTIFICATION_CATEGORIES.BOT,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
    });

    this.templates.set('command_error', {
      title: 'Error en Comando',
      message: 'Se ha producido un error ejecutando un comando',
      type: NOTIFICATION_TYPES.WARNING,
      category: NOTIFICATION_CATEGORIES.COMMAND,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      channels: [NOTIFICATION_CHANNELS.SOCKET]
    });

    this.templates.set('security_alert', {
      title: 'Alerta de Seguridad',
      message: 'Se ha detectado actividad sospechosa',
      type: NOTIFICATION_TYPES.CRITICAL,
      category: NOTIFICATION_CATEGORIES.SECURITY,
      priority: NOTIFICATION_PRIORITIES.CRITICAL,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL, NOTIFICATION_CHANNELS.WEBHOOK]
    });

    this.templates.set('maintenance_start', {
      title: 'Mantenimiento Iniciado',
      message: 'El sistema ha entrado en modo de mantenimiento',
      type: NOTIFICATION_TYPES.WARNING,
      category: NOTIFICATION_CATEGORIES.MAINTENANCE,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER]
    });

    this.templates.set('user_login', {
      title: 'Nuevo Inicio de Sesión',
      message: 'Un usuario ha iniciado sesión en el panel',
      type: NOTIFICATION_TYPES.INFO,
      category: NOTIFICATION_CATEGORIES.USER,
      priority: NOTIFICATION_PRIORITIES.LOW,
      channels: [NOTIFICATION_CHANNELS.SOCKET]
    });

    this.templates.set('system_error', {
      title: 'Error del Sistema',
      message: 'Se ha producido un error crítico del sistema',
      type: NOTIFICATION_TYPES.CRITICAL,
      category: NOTIFICATION_CATEGORIES.SYSTEM,
      priority: NOTIFICATION_PRIORITIES.CRITICAL,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL, NOTIFICATION_CHANNELS.WEBHOOK]
    });
  }

  /**
   * Envía una notificación
   */
  async send(notification) {
    try {
      // Validar notificación
      if (!this.validateNotification(notification)) {
        console.error('Invalid notification:', notification);
        return false;
      }

      // Aplicar rate limiting
      if (!this.checkRateLimit(notification)) {
        console.warn('Rate limit exceeded for notification:', notification.type);
        return false;
      }

      // Enriquecer notificación
      const enrichedNotification = this.enrichNotification(notification);

      // Guardar en base de datos
      const savedNotification = await this.saveNotification(enrichedNotification);

      // Enviar por cada canal configurado
      const results = await Promise.allSettled(
        enrichedNotification.channels.map(channel => 
          this.sendToChannel(channel, enrichedNotification)
        )
      );

      // Log de auditoría
      await auditLogger.log(AUDIT_EVENTS.NOTIFICATION_SENT, {
        level: 'info',
        details: {
          notificationId: savedNotification.id,
          type: enrichedNotification.type,
          category: enrichedNotification.category,
          channels: enrichedNotification.channels,
          success: results.every(r => r.status === 'fulfilled')
        }
      });

      return savedNotification;
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  }

  /**
   * Envía notificación usando plantilla
   */
  async sendFromTemplate(templateName, data = {}) {
    const template = this.templates.get(templateName);
    if (!template) {
      console.error('Template not found:', templateName);
      return false;
    }

    const notification = {
      ...template,
      ...data,
      template: templateName,
      message: this.interpolateMessage(template.message, data),
      title: this.interpolateMessage(template.title, data)
    };

    return this.send(notification);
  }

  /**
   * Envía notificación a un canal específico
   */
  async sendToChannel(channel, notification) {
    switch (channel) {
      case NOTIFICATION_CHANNELS.SOCKET:
        return this.sendToSocket(notification);
      
      case NOTIFICATION_CHANNELS.BROWSER:
        return this.sendToBrowser(notification);
      
      case NOTIFICATION_CHANNELS.EMAIL:
        return this.sendToEmail(notification);
      
      case NOTIFICATION_CHANNELS.WEBHOOK:
        return this.sendToWebhook(notification);
      
      case NOTIFICATION_CHANNELS.WHATSAPP:
        return this.sendToWhatsApp(notification);
      
      default:
        console.warn('Unknown notification channel:', channel);
        return false;
    }
  }

  /**
   * Envía notificación por Socket.IO
   */
  async sendToSocket(notification) {
    try {
      emitNotification({
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        category: notification.category,
        priority: notification.priority,
        timestamp: notification.timestamp,
        data: notification.data || {}
      });
      return true;
    } catch (error) {
      console.error('Error sending socket notification:', error);
      return false;
    }
  }

  /**
   * Envía notificación push al navegador
   */
  async sendToBrowser(notification) {
    try {
      const io = getIO();
      if (!io) return false;

      // Enviar notificación push a todos los clientes conectados
      io.emit('push:notification', {
        title: notification.title,
        body: notification.message,
        icon: this.getIconForType(notification.type),
        badge: this.getBadgeForCategory(notification.category),
        tag: notification.category,
        data: {
          id: notification.id,
          category: notification.category,
          priority: notification.priority,
          url: notification.url || '/notifications'
        },
        actions: notification.actions || []
      });

      return true;
    } catch (error) {
      console.error('Error sending browser notification:', error);
      return false;
    }
  }

  /**
   * Envía notificación por email
   */
  async sendToEmail(notification) {
    try {
      // Importar nodemailer dinámicamente
      const nodemailer = await import('nodemailer').catch(() => null);
      
      if (!nodemailer) {
        console.warn('Nodemailer not available, skipping email notification');
        return false;
      }

      // Configuración del transporter (usar variables de entorno)
      const transportConfig = {
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === 'true' || false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      };

      // Verificar configuración
      if (!transportConfig.auth.user || !transportConfig.auth.pass) {
        console.warn('SMTP credentials not configured, skipping email notification');
        return false;
      }

      const transporter = nodemailer.createTransport(transportConfig);

      // Configurar email
      const toOverrideRaw = notification?.to || notification?.emailTo || notification?.email_to || null;
      const toOverride = Array.isArray(toOverrideRaw)
        ? toOverrideRaw.filter(Boolean).join(',')
        : (toOverrideRaw ? String(toOverrideRaw) : '');

      const mailOptions = {
        from: process.env.SMTP_FROM || transportConfig.auth.user,
        to: toOverride || process.env.NOTIFICATION_EMAIL || process.env.SECURITY_ALERT_EMAIL_TO || process.env.ADMIN_EMAIL || transportConfig.auth.user,
        subject: `[${notification.category.toUpperCase()}] ${notification.title}`,
        html: this.generateEmailTemplate(notification),
        text: `${notification.title}\n\n${notification.message}`
      };

      // Enviar email
      const info = await transporter.sendMail(mailOptions);
      
      console.log('Email notification sent:', info.messageId);
      return true;

    } catch (error) {
      console.error('Error sending email notification:', error);
      return false;
    }
  }

  /**
   * Genera template HTML para email
   */
  generateEmailTemplate(notification) {
    const typeColors = {
      [NOTIFICATION_TYPES.INFO]: '#3B82F6',
      [NOTIFICATION_TYPES.SUCCESS]: '#10B981',
      [NOTIFICATION_TYPES.WARNING]: '#F59E0B',
      [NOTIFICATION_TYPES.ERROR]: '#EF4444',
      [NOTIFICATION_TYPES.CRITICAL]: '#DC2626',
    };

    const color = typeColors[notification.type] || '#6B7280';
    const timestamp = new Date(notification.createdAt).toLocaleString();
    const panelUrl = (process.env.PANEL_URL || '').trim() || 'https://oguricap.ooguy.com';
    const title = String(notification.title || '').trim();
    const category = String(notification.category || '').trim().toUpperCase();
    const type = String(notification.type || '').trim().toUpperCase();
    const message = String(notification.message || '').trim().replace(/\n/g, '<br />');
    const details = notification.data ? JSON.stringify(notification.data, null, 2) : '';

    return `
<!doctype html>
<html>
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
  </head>
  <body style="margin:0;padding:0;background:#0b1020;">
    <span style="display:none;opacity:0;visibility:hidden;height:0;width:0;color:transparent;">
      ${title}
    </span>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0b1020;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="max-width:640px;width:100%;">
            <tr>
              <td style="padding:0 0 16px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#e5e7eb;font-weight:850;font-size:18px;letter-spacing:0.2px;">
                      <span style="display:inline-block;width:10px;height:10px;border-radius:9999px;background:${color};margin-right:10px;vertical-align:middle;"></span>
                      Oguri Bot <span style="color:#94a3b8;font-weight:750;">Panel</span>
                    </td>
                    <td align="right" style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#64748b;font-size:12px;letter-spacing:0.2px;">
                      ${panelUrl}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,0.12);background:#111827;box-shadow:0 22px 70px rgba(0,0,0,0.55);">
                <div style="height:8px;background:linear-gradient(90deg,${color},rgba(255,255,255,0.06));"></div>
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#111827;">
                  <tr>
                    <td style="padding:18px 24px 0 24px;">
                      <div style="display:inline-block;padding:6px 10px;border-radius:9999px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.10);font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#cbd5e1;font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;">
                        ${category} · ${type}
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:14px 24px 10px 24px;">
                      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#ffffff;font-size:24px;font-weight:900;line-height:1.2;letter-spacing:-0.2px;">
                        ${title}
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:0 24px 18px 24px;">
                      <div style="padding:14px;border-radius:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.10);font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#cbd5e1;font-size:14px;line-height:1.7;">
                        ${message}
                      </div>
                    </td>
                  </tr>

                  ${
                    details
                      ? `
                  <tr>
                    <td style="padding:0 24px 18px 24px;">
                      <div style="padding:14px;border-radius:14px;background:rgba(0,0,0,0.22);border:1px solid rgba(255,255,255,0.10);">
                        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#94a3b8;font-size:11px;font-weight:800;letter-spacing:0.16em;text-transform:uppercase;margin-bottom:10px;">
                          Detalles
                        </div>
                        <pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,'Liberation Mono',monospace;font-size:12px;color:#cbd5e1;white-space:pre-wrap;word-wrap:break-word;">${details}</pre>
                      </div>
                    </td>
                  </tr>
                  `
                      : ''
                  }

                  <tr>
                    <td style="padding:0 24px 22px 24px;">
                      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#64748b;font-size:12px;line-height:1.6;">
                        ${timestamp} · Sistema de Notificaciones
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td style="padding:14px 0 0 0;">
                <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#64748b;font-size:12px;line-height:1.6;text-align:center;">
                  © ${new Date().getFullYear()} Oguri Bot · Notificación automática
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
  }

  /**
   * Envía notificación por webhook
   */
  async sendToWebhook(notification) {
    try {
      const webhookPromises = this.webhooks.map(async (webhook) => {
        if (!this.shouldSendToWebhook(webhook, notification)) {
          return true;
        }

        const payload = {
          notification: {
            id: notification.id,
            type: notification.type,
            title: notification.title,
            message: notification.message,
            category: notification.category,
            priority: notification.priority,
            timestamp: notification.timestamp
          },
          data: notification.data || {},
          webhook: {
            name: webhook.name,
            timestamp: new Date().toISOString()
          }
        };

        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Oguri-Bot-Notifications/1.0',
            ...(webhook.headers || {})
          },
          body: JSON.stringify(payload),
          timeout: 10000
        });

        return response.ok;
      });

      const results = await Promise.allSettled(webhookPromises);
      return results.every(r => r.status === 'fulfilled' && r.value);
    } catch (error) {
      console.error('Error sending webhook notification:', error);
      return false;
    }
  }

  /**
   * Envía notificación por WhatsApp
   */
  async sendToWhatsApp(notification) {
    try {
      // Implementar envío por WhatsApp usando el bot
      const override = notification?.whatsappTo || notification?.whatsapp_to || null;
      const adminNumbers = (Array.isArray(override) && override.length) ? override : this.getAdminNumbers();
      if (!adminNumbers.length) return true;

      const message = `🔔 *${notification.title}*\n\n${notification.message}\n\n_${new Date().toLocaleString()}_`;

      for (const number of adminNumbers) {
        if (global.conn && global.conn.user) {
          const cleaned = String(number || '').replace(/[^0-9]/g, '');
          if (!cleaned) continue;
          await global.conn.sendMessage(`${cleaned}@s.whatsapp.net`, { text: message });
        }
      }

      return true;
    } catch (error) {
      console.error('Error sending WhatsApp notification:', error);
      return false;
    }
  }

  /**
   * Suscribe a notificaciones
   */
  subscribe(channel, callback, filters = {}) {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }

    const subscription = {
      callback,
      filters,
      id: Date.now() + Math.random(),
      createdAt: new Date()
    };

    this.subscribers.get(channel).add(subscription);
    return subscription.id;
  }

  /**
   * Desuscribe de notificaciones
   */
  unsubscribe(channel, subscriptionId) {
    const channelSubscribers = this.subscribers.get(channel);
    if (!channelSubscribers) return false;

    for (const subscription of channelSubscribers) {
      if (subscription.id === subscriptionId) {
        channelSubscribers.delete(subscription);
        return true;
      }
    }

    return false;
  }

  /**
   * Configura webhooks
   */
  configureWebhooks(webhooks) {
    this.webhooks = webhooks.map(webhook => ({
      name: webhook.name,
      url: webhook.url,
      headers: webhook.headers || {},
      filters: webhook.filters || {},
      enabled: webhook.enabled !== false
    }));
  }

  /**
   * Funciones de utilidad
   */
  validateNotification(notification) {
    return notification && 
           notification.title && 
           notification.message && 
           notification.type &&
           Object.values(NOTIFICATION_TYPES).includes(notification.type);
  }

  enrichNotification(notification) {
    return {
      id: Date.now() + Math.random(),
      timestamp: new Date().toISOString(),
      channels: notification.channels || [NOTIFICATION_CHANNELS.SOCKET],
      priority: notification.priority || NOTIFICATION_PRIORITIES.NORMAL,
      category: notification.category || NOTIFICATION_CATEGORIES.SYSTEM,
      read: false,
      ...notification
    };
  }

  interpolateMessage(message, data) {
    return message.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
  }

  checkRateLimit(notification) {
    const key = `${notification.type}_${notification.category}`;
    const now = Date.now();
    const limit = this.getRateLimitForType(notification.type);
    
    if (!this.rateLimits.has(key)) {
      this.rateLimits.set(key, { count: 1, resetTime: now + 60000 });
      return true;
    }

    const rateLimit = this.rateLimits.get(key);
    
    if (now > rateLimit.resetTime) {
      rateLimit.count = 1;
      rateLimit.resetTime = now + 60000;
      return true;
    }

    if (rateLimit.count >= limit) {
      return false;
    }

    rateLimit.count++;
    return true;
  }

  getRateLimitForType(type) {
    switch (type) {
      case NOTIFICATION_TYPES.CRITICAL: return 10;
      case NOTIFICATION_TYPES.ERROR: return 20;
      case NOTIFICATION_TYPES.WARNING: return 30;
      default: return 50;
    }
  }

  shouldSendToWebhook(webhook, notification) {
    if (!webhook.enabled) return false;
    
    const filters = webhook.filters;
    if (!filters) return true;

    if (filters.types && !filters.types.includes(notification.type)) return false;
    if (filters.categories && !filters.categories.includes(notification.category)) return false;
    if (filters.minPriority && notification.priority < filters.minPriority) return false;

    return true;
  }

  getIconForType(type) {
    switch (type) {
      case NOTIFICATION_TYPES.SUCCESS: return '/icons/success.png';
      case NOTIFICATION_TYPES.ERROR: return '/icons/error.png';
      case NOTIFICATION_TYPES.WARNING: return '/icons/warning.png';
      case NOTIFICATION_TYPES.CRITICAL: return '/icons/critical.png';
      default: return '/icons/info.png';
    }
  }

  getBadgeForCategory(category) {
    switch (category) {
      case NOTIFICATION_CATEGORIES.SECURITY: return '/icons/security-badge.png';
      case NOTIFICATION_CATEGORIES.BOT: return '/icons/bot-badge.png';
      case NOTIFICATION_CATEGORIES.SYSTEM: return '/icons/system-badge.png';
      default: return '/icons/default-badge.png';
    }
  }

  getAdminNumbers() {
    const numbers = new Set();

    const push = (val) => {
      if (!val) return;
      if (Array.isArray(val)) return val.forEach(push);
      const cleaned = String(val).replace(/[^0-9]/g, '');
      if (cleaned) numbers.add(cleaned);
    };

    // Owners (puede venir como string/array/array-de-arrays)
    push(global.owner || []);

    // Env override
    const envList = String(process.env.SUPPORT_NOTIFY_WHATSAPP_TO || '').split(',');
    envList.forEach(push);

    // Usuarios del panel (legacy)
    const panelUsers = global.db?.data?.panel?.users || {};
    for (const u of Object.values(panelUsers)) {
      const role = String(u?.rol || '').toLowerCase();
      if (!['owner', 'admin', 'administrador'].includes(role)) continue;
      push(u?.whatsapp_number || u?.whatsapp || u?.phone);
    }

    // Usuarios autenticados (JWT)
    const usuarios = global.db?.data?.usuarios || {};
    for (const u of Object.values(usuarios)) {
      const role = String(u?.rol || '').toLowerCase();
      if (!['owner', 'admin', 'administrador'].includes(role)) continue;
      push(u?.whatsapp_number || u?.whatsapp || u?.phone);
    }

    return [...numbers];
  }

  async saveNotification(notification) {
    try {
      if (typeof global.loadDatabase === 'function') await global.loadDatabase();
      
      const panelDb = global.db?.data?.panel;
      if (!panelDb) return notification;

      panelDb.notifications ||= {};
      panelDb.notificationsCounter ||= 0;

      const id = ++panelDb.notificationsCounter;
      const savedNotification = { ...notification, id };
      
      panelDb.notifications[id] = savedNotification;

      // Limpiar notificaciones antiguas (mantener solo las últimas 1000)
      const notifications = Object.values(panelDb.notifications);
      if (notifications.length > 1000) {
        const sorted = notifications.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        const toKeep = sorted.slice(0, 1000);
        panelDb.notifications = {};
        toKeep.forEach(n => panelDb.notifications[n.id] = n);
      }

      return savedNotification;
    } catch (error) {
      console.error('Error saving notification:', error);
      return notification;
    }
  }
}

// Instancia singleton
const notificationSystem = new NotificationSystem();

// Funciones de conveniencia
export const sendNotification = (notification) => notificationSystem.send(notification);
export const sendTemplateNotification = (template, data) => notificationSystem.sendFromTemplate(template, data);
export const subscribeToNotifications = (channel, callback, filters) => notificationSystem.subscribe(channel, callback, filters);
export const unsubscribeFromNotifications = (channel, id) => notificationSystem.unsubscribe(channel, id);
export const configureWebhooks = (webhooks) => notificationSystem.configureWebhooks(webhooks);

export default notificationSystem;
