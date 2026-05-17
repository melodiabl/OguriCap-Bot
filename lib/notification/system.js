import { NOTIFICATION_TYPES, NOTIFICATION_CATEGORIES, NOTIFICATION_CHANNELS, NOTIFICATION_PRIORITIES } from './types.js'
import { generateEmailTemplate, sendToEmail } from './channels/email.js'
import { sendToSocket, sendToBrowser } from './channels/socket.js'
import { shouldSendToWebhook, sendToWebhook } from './channels/webhook.js'
import { getAdminNumbers, sendToWhatsApp } from './channels/whatsapp.js'
import { buildTemplates } from './templates.js'

class NotificationSystem {
  constructor() {
    this.subscribers = new Map();
    this.templates = new Map();
    this.rateLimits = new Map();
    this.recentHashes = new Map(); // Para deduplicación por contenido
    this.webhooks = [];
    this.isRunning = false;
    this.initializeTemplates();

    // Limpiar hashes antiguos cada 10 minutos
    setInterval(() => this.cleanupHashes(), 10 * 60 * 1000);
  }

  cleanupHashes() {
    const now = Date.now();
    for (const [hash, timestamp] of this.recentHashes.entries()) {
      if (now - timestamp > 5 * 60 * 1000) { // 5 minutos de ventana
        this.recentHashes.delete(hash);
      }
    }
  }

  generateHash(notification) {
    const content = `${notification.title || ''}|${notification.message || ''}|${notification.category || ''}|${notification.tipo || notification.type || ''}|${JSON.stringify(notification.to || '')}`;
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
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
    this.templates = buildTemplates();
  }

  async send(notification) {
    try {
      if (!this.validateNotification(notification)) return false;

      const enrichedNotification = this.enrichNotification(notification);

      // 1. Deduplicación por Hash en memoria (rápida)
      const hash = this.generateHash(enrichedNotification);
      const now = Date.now();
      if (this.recentHashes.has(hash)) {
        const lastSent = this.recentHashes.get(hash);
        if (now - lastSent < 60 * 1000) { // No repetir exactamente lo mismo en 1 minuto
          console.log(`🚫 Notificación duplicada omitida en memoria (hash: ${hash})`);
          return false;
        }
      }
      this.recentHashes.set(hash, now);

      if (!this.checkRateLimit(enrichedNotification)) return false;

      // 2. Guardar en el estado del panel (persistido en settings/__oguri_extra)
      const savedNotification = await this.saveNotification(enrichedNotification);

      // 3. Enviar por cada canal (Socket, Email, Webhook, WhatsApp)
      await Promise.allSettled(
        enrichedNotification.channels.map(channel =>
          this.sendToChannel(channel, savedNotification)
        )
      );

      return savedNotification;
    } catch (error) {
      console.error('Error sending notification:', error);
      return false;
    }
  }

  async sendToSocket(notification) {
    return sendToSocket(notification);
  }

  async sendToBrowser(notification) {
    return sendToBrowser(notification);
  }

  // ... (Resto de métodos como sendToBrowser, sendToEmail, etc.)
  async sendToChannel(channel, notification) {
    switch (channel) {
      case NOTIFICATION_CHANNELS.SOCKET: return this.sendToSocket(notification);
      case NOTIFICATION_CHANNELS.BROWSER: return this.sendToBrowser(notification);
      case NOTIFICATION_CHANNELS.EMAIL: return this.sendToEmail(notification);
      case NOTIFICATION_CHANNELS.WEBHOOK: return this.sendToWebhook(notification);
      case NOTIFICATION_CHANNELS.WHATSAPP: return this.sendToWhatsApp(notification);
      default: return false;
    }
  }

  async sendToEmail(notification) {
    return sendToEmail(notification);
  }

  generateEmailTemplate(notification) {
    return generateEmailTemplate(notification);
  }

  async sendToWebhook(notification) {
    return sendToWebhook(notification, this.webhooks);
  }

  async sendToWhatsApp(notification) {
    return sendToWhatsApp(notification);
  }

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

  configureWebhooks(webhooks) {
    this.webhooks = webhooks.map(webhook => ({
      name: webhook.name,
      url: webhook.url,
      headers: webhook.headers || {},
      filters: webhook.filters || {},
      enabled: webhook.enabled !== false
    }));
  }

  validateNotification(notification) {
    return notification && (notification.title || notification.titulo) && (notification.message || notification.mensaje);
  }

  enrichNotification(notification) {
    const nowIso = new Date().toISOString();
    const timestamp = notification.timestamp || notification.fecha_creacion || notification.created_at || nowIso;

    const title = notification.title || notification.titulo || 'Notificación';
    const message = notification.message || notification.mensaje || '';
    const type = notification.type || notification.tipo || NOTIFICATION_TYPES.INFO;
    const category = notification.category || notification.categoria || NOTIFICATION_CATEGORIES.SYSTEM;
    const read = Boolean(notification.read || notification.leida || false);

    const parsedId = Number(notification.id);
    const id = Number.isFinite(parsedId)
      ? parsedId
      : Date.now() * 1000 + Math.floor(Math.random() * 1000);

    return {
      ...notification,
      // Avoid decimal IDs (break routes like `/api/notificaciones/:id/...`)
      id,
      timestamp,
      channels: notification.channels || [NOTIFICATION_CHANNELS.SOCKET],
      priority: notification.priority || NOTIFICATION_PRIORITIES.NORMAL,
      title,
      message,
      type,
      category,
      read,
      // Campos para el frontend (español)
      titulo: notification.titulo || title,
      mensaje: notification.mensaje || message,
      tipo: notification.tipo || type,
      categoria: notification.categoria || category,
      fecha_creacion: notification.fecha_creacion || timestamp,
      leida: read,
      createdAt: notification.createdAt || timestamp,
      created_at: notification.created_at || timestamp,
      updated_at: notification.updated_at || timestamp,
    };
  }

  interpolateMessage(message, data) {
    return message.replace(/\{{1,2}(\w+)\}{1,2}/g, (match, key) => {
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
    return shouldSendToWebhook(webhook, notification);
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
    return getAdminNumbers();
  }

  async saveNotification(notification) {
    try {
      if (typeof global.loadDatabase === 'function') await global.loadDatabase();

      const db = global.db?.data;
      if (!db) return notification;

      if (!Array.isArray(db.notifications)) db.notifications = [];

      const nowIso = new Date().toISOString();
      const parsedId = Number(notification.id);
      const id = Number.isFinite(parsedId) && parsedId > 0
        ? parsedId
        : Date.now() * 1000 + Math.floor(Math.random() * 1000);

      const title    = String(notification.title    || notification.titulo   || 'Notificación');
      const message  = String(notification.message  || notification.mensaje  || '');
      const type     = String(notification.type     || notification.tipo     || NOTIFICATION_TYPES.INFO);
      const category = String(notification.category || notification.categoria || NOTIFICATION_CATEGORIES.SYSTEM);
      const read     = Boolean(notification.read    || notification.leida    || false);
      const ts       = String(notification.fecha_creacion || notification.timestamp || notification.created_at || nowIso);

      const savedNotification = {
        ...notification,
        id, title, message, type, category,
        titulo: String(notification.titulo  || title),
        mensaje: String(notification.mensaje || message),
        tipo:    String(notification.tipo    || type),
        categoria: String(notification.categoria || category),
        read, leida: read,
        fecha_creacion: ts,
        timestamp:  String(notification.timestamp  || ts),
        created_at: String(notification.created_at || ts),
        updated_at: String(notification.updated_at || notification.created_at || ts),
      };

      db.notifications.unshift(savedNotification);
      if (db.notifications.length > 1000) db.notifications = db.notifications.slice(0, 1000);

      if (global.db?.write) global.db.write().catch(() => {});

      return savedNotification;
    } catch (error) {
      console.error('Error saving notification:', error);
      return notification;
    }
  }

  async sendTemplateNotification(templateName, data = {}) {
    const template = this.templates.get(templateName);
    if (!template) {
      console.warn(`Template '${templateName}' not found`);
      return false;
    }

    // Interpolate message with data
    const interpolatedTitle = this.interpolateMessage(template.title || template.message, data);
    const interpolatedMessage = this.interpolateMessage(template.message, data);

    // Apply emailCondition: conditionally add/remove EMAIL channel
    let channels = [...template.channels];
    if (typeof template.emailCondition === 'function') {
      const shouldEmail = template.emailCondition(data);
      const hasEmail = channels.includes(NOTIFICATION_CHANNELS.EMAIL);
      if (shouldEmail && !hasEmail) channels.push(NOTIFICATION_CHANNELS.EMAIL);
      else if (!shouldEmail && hasEmail) channels = channels.filter(c => c !== NOTIFICATION_CHANNELS.EMAIL);
    }

    const notification = {
      title: interpolatedTitle,
      message: interpolatedMessage,
      type: template.type,
      category: template.category,
      priority: template.priority,
      channels,
      data: data,
      // Propagate targeting fields from data to notification root for email routing
      ...(data.emailTo  ? { emailTo:  data.emailTo  } : {}),
      ...(data.to       ? { to:       data.to       } : {}),
      ...(data.email_to ? { email_to: data.email_to } : {}),
    };

    return await this.send(notification);
  }
}

const notificationSystem = new NotificationSystem()
export const sendTemplateNotification = (templateName, data) => notificationSystem.sendTemplateNotification(templateName, data)
export default notificationSystem
