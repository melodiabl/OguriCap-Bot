// Sistema de Notificaciones Avanzado con Persistencia en PostgreSQL
import { emitNotification, getIO } from './socket-io.js';
import auditLogger, { AUDIT_EVENTS } from './audit-logger.js';
import { sendMail } from './email-service.js';

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
    this.templates.set('bot_connected', {
      title: '🤖 Bot Principal En Línea',
      message: 'La conexión con WhatsApp se ha establecido correctamente. El bot ya está procesando mensajes.',
      type: NOTIFICATION_TYPES.SUCCESS,
      category: NOTIFICATION_CATEGORIES.BOT,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER]
    });

    this.templates.set('bot_disconnected', {
      title: '⚠️ Bot Principal Desconectado',
      message: 'Se ha perdido la conexión con WhatsApp. Razón: {reason}. El sistema intentará reconectar automáticamente.',
      type: NOTIFICATION_TYPES.ERROR,
      category: NOTIFICATION_CATEGORIES.BOT,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
    });

    this.templates.set('command_error', {
      title: '❌ Error de Ejecución',
      message: 'No se pudo completar el comando "{command}". Error: {error}',
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
      title: '🔑 Acceso al Panel',
      message: 'El usuario @{username} ha iniciado sesión correctamente desde {ip}.',
      type: NOTIFICATION_TYPES.INFO,
      category: NOTIFICATION_CATEGORIES.USER,
      priority: NOTIFICATION_PRIORITIES.LOW,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.EMAIL]
    });

    this.templates.set('user_registered', {
      title: '👤 Nuevo Registro',
      message: 'Se ha registrado un nuevo usuario: @{username} ({email}).',
      type: NOTIFICATION_TYPES.SUCCESS,
      category: NOTIFICATION_CATEGORIES.USER,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
    });

    this.templates.set('user_updated', {
      title: 'Usuario Actualizado',
      message: 'Se han actualizado los datos del usuario: {username}',
      type: NOTIFICATION_TYPES.INFO,
      category: NOTIFICATION_CATEGORIES.USER,
      priority: NOTIFICATION_PRIORITIES.LOW,
      channels: [NOTIFICATION_CHANNELS.SOCKET]
    });

    this.templates.set('user_deleted', {
      title: 'Usuario Eliminado',
      message: 'Se ha eliminado la cuenta del usuario: {username}',
      type: NOTIFICATION_TYPES.WARNING,
      category: NOTIFICATION_CATEGORIES.USER,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
    });

    this.templates.set('system_restart', {
      title: 'Sistema Reiniciado',
      message: 'El sistema de Oguri Bot se ha reiniciado correctamente',
      type: NOTIFICATION_TYPES.SUCCESS,
      category: NOTIFICATION_CATEGORIES.SYSTEM,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
    });

    this.templates.set('system_error', {
      title: '🚨 Error Crítico del Sistema',
      message: 'Se ha detectado un fallo grave: {error}. Por favor, revisa los logs del terminal.',
      type: NOTIFICATION_TYPES.CRITICAL,
      category: NOTIFICATION_CATEGORIES.SYSTEM,
      priority: NOTIFICATION_PRIORITIES.CRITICAL,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL, NOTIFICATION_CHANNELS.WEBHOOK]
    });

    // --- SUBBOT TEMPLATES ---
    this.templates.set('subbot_created', {
      title: 'Subbot Creado',
      message: 'Se ha creado una nueva instancia de subbot: {subbotCode}',
      type: NOTIFICATION_TYPES.SUCCESS,
      category: NOTIFICATION_CATEGORIES.BOT,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER]
    });

    this.templates.set('subbot_connected', {
      title: '🤖 Subbot En Línea',
      message: 'El subbot {subbotCode} se ha conectado correctamente y está listo.',
      type: NOTIFICATION_TYPES.SUCCESS,
      category: NOTIFICATION_CATEGORIES.BOT,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
    });

    this.templates.set('subbot_disconnected', {
      title: 'Subbot Desconectado',
      message: 'El subbot {subbotCode} se ha desconectado',
      type: NOTIFICATION_TYPES.WARNING,
      category: NOTIFICATION_CATEGORIES.BOT,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
    });

    this.templates.set('subbot_deleted', {
      title: 'Subbot Eliminado',
      message: 'Se ha eliminado la instancia de subbot: {subbotCode}',
      type: NOTIFICATION_TYPES.INFO,
      category: NOTIFICATION_CATEGORIES.BOT,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      channels: [NOTIFICATION_CHANNELS.SOCKET]
    });

    this.templates.set('subbot_error', {
      title: 'Error en Subbot',
      message: 'Error en subbot {subbotCode}: {error}',
      type: NOTIFICATION_TYPES.ERROR,
      category: NOTIFICATION_CATEGORIES.BOT,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
    });

    this.templates.set('subbot_updated', {
      title: 'Subbot Actualizado',
      message: 'Se han actualizado los ajustes del subbot {subbotCode}',
      type: NOTIFICATION_TYPES.INFO,
      category: NOTIFICATION_CATEGORIES.BOT,
      priority: NOTIFICATION_PRIORITIES.LOW,
      channels: [NOTIFICATION_CHANNELS.SOCKET]
    });

    this.templates.set('login_failed', {
      title: 'Intento de Login Fallido',
      message: 'Intento de acceso fallido para el usuario {username} desde {ip}',
      type: NOTIFICATION_TYPES.WARNING,
      category: NOTIFICATION_CATEGORIES.SECURITY,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
    });

    this.templates.set('backup_completed', {
      title: 'Backup Completado',
      message: 'El respaldo del sistema se ha realizado exitosamente',
      type: NOTIFICATION_TYPES.SUCCESS,
      category: NOTIFICATION_CATEGORIES.SYSTEM,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.EMAIL]
    });

    this.templates.set('backup_failed', {
      title: 'Error en Backup',
      message: 'Ha fallado el proceso de respaldo del sistema: {error}',
      type: NOTIFICATION_TYPES.CRITICAL,
      category: NOTIFICATION_CATEGORIES.SYSTEM,
      priority: NOTIFICATION_PRIORITIES.CRITICAL,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
    });

    this.templates.set('subbot_qr_generated', {
      title: 'QR Generado',
      message: 'Nuevo código QR disponible para el subbot {subbotCode}',
      type: NOTIFICATION_TYPES.INFO,
      category: NOTIFICATION_CATEGORIES.BOT,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      channels: [NOTIFICATION_CHANNELS.SOCKET]
    });

    this.templates.set('subbot_pairing_code_generated', {
      title: 'Código de Vinculación',
      message: 'Nuevo código de vinculación ({pairingCode}) generado para el subbot {subbotCode}',
      type: NOTIFICATION_TYPES.INFO,
      category: NOTIFICATION_CATEGORIES.BOT,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      channels: [NOTIFICATION_CHANNELS.SOCKET]
    });

    // --- TASK SCHEDULER TEMPLATES ---
    this.templates.set('task_started', {
      title: 'Tarea Iniciada',
      message: 'La tarea "{taskName}" ha comenzado su ejecución',
      type: NOTIFICATION_TYPES.INFO,
      category: NOTIFICATION_CATEGORIES.SYSTEM,
      priority: NOTIFICATION_PRIORITIES.LOW,
      channels: [NOTIFICATION_CHANNELS.SOCKET]
    });

    this.templates.set('task_completed', {
      title: 'Tarea Completada',
      message: 'La tarea "{taskName}" finalizó exitosamente en {duration}ms',
      type: NOTIFICATION_TYPES.SUCCESS,
      category: NOTIFICATION_CATEGORIES.SYSTEM,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      channels: [NOTIFICATION_CHANNELS.SOCKET]
    });

    this.templates.set('task_failed', {
      title: 'Error en Tarea',
      message: 'La tarea "{taskName}" falló: {error}',
      type: NOTIFICATION_TYPES.ERROR,
      category: NOTIFICATION_CATEGORIES.SYSTEM,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
    });

    // --- SYSTEM HEALTH TEMPLATES ---
    this.templates.set('high_memory_usage', {
      title: 'Uso de Memoria Alto',
      message: 'El uso de memoria del sistema está en {usage}% (Heap: {used}MB/{total}MB)',
      type: NOTIFICATION_TYPES.WARNING,
      category: NOTIFICATION_CATEGORIES.SYSTEM,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
    });

    // --- RESTORE TEMPLATES ---
    this.templates.set('restore_started', {
      title: 'Restauración Iniciada',
      message: 'Se ha iniciado la restauración del backup: {backupId}',
      type: NOTIFICATION_TYPES.WARNING,
      category: NOTIFICATION_CATEGORIES.SYSTEM,
      priority: NOTIFICATION_PRIORITIES.URGENT,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
    });

    this.templates.set('restore_completed', {
      title: 'Restauración Completada',
      message: 'El backup {backupId} se restauró exitosamente ({restoredFiles} archivos)',
      type: NOTIFICATION_TYPES.SUCCESS,
      category: NOTIFICATION_CATEGORIES.SYSTEM,
      priority: NOTIFICATION_PRIORITIES.CRITICAL,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
    });

    this.templates.set('restore_failed', {
      title: 'Error en Restauración',
      message: 'Falló la restauración del backup {backupId}: {error}',
      type: NOTIFICATION_TYPES.CRITICAL,
      category: NOTIFICATION_CATEGORIES.SYSTEM,
      priority: NOTIFICATION_PRIORITIES.CRITICAL,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
    });

    // --- AUTH & SECURITY TEMPLATES ---
    this.templates.set('password_changed', {
      title: 'Contraseña Cambiada',
      message: 'La contraseña del usuario {username} ha sido actualizada',
      type: NOTIFICATION_TYPES.SUCCESS,
      category: NOTIFICATION_CATEGORIES.SECURITY,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.EMAIL]
    });

    this.templates.set('password_reset_requested', {
      title: 'Restablecimiento de Contraseña',
      message: 'Se ha solicitado un restablecimiento de contraseña para {username}',
      type: NOTIFICATION_TYPES.WARNING,
      category: NOTIFICATION_CATEGORIES.SECURITY,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.EMAIL]
    });

    this.templates.set('role_updated', {
      title: 'Rol de Usuario Actualizado',
      message: 'El rol de {username} ha cambiado: {oldRole} -> {newRole}',
      type: NOTIFICATION_TYPES.INFO,
      category: NOTIFICATION_CATEGORIES.USER,
      priority: NOTIFICATION_PRIORITIES.NORMAL,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
    });

    // --- SYSTEM MONITORING TEMPLATES ---
    this.templates.set('high_cpu_usage', {
      title: 'Uso de CPU Alto',
      message: 'La carga del sistema es inusualmente alta: {load}%',
      type: NOTIFICATION_TYPES.WARNING,
      category: NOTIFICATION_CATEGORIES.SYSTEM,
      priority: NOTIFICATION_PRIORITIES.HIGH,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
    });

    this.templates.set('low_disk_space', {
      title: 'Espacio en Disco Bajo',
      message: 'Queda poco espacio en el disco: {available}GB disponibles ({percent}%)',
      type: NOTIFICATION_TYPES.CRITICAL,
      category: NOTIFICATION_CATEGORIES.SYSTEM,
      priority: NOTIFICATION_PRIORITIES.CRITICAL,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
    });

    this.templates.set('unauthorized_access', {
      title: 'Intento de Acceso No Autorizado',
      message: 'Se ha bloqueado un intento de acceso desde la IP {ip} al recurso {resource}',
      type: NOTIFICATION_TYPES.CRITICAL,
      category: NOTIFICATION_CATEGORIES.SECURITY,
      priority: NOTIFICATION_PRIORITIES.CRITICAL,
      channels: [NOTIFICATION_CHANNELS.SOCKET, NOTIFICATION_CHANNELS.BROWSER, NOTIFICATION_CHANNELS.EMAIL]
    });
  }

  async send(notification) {
    try {
      if (!this.validateNotification(notification)) return false;

      // 1. Deduplicación por Hash en memoria (rápida)
      const hash = this.generateHash(notification);
      const now = Date.now();
      if (this.recentHashes.has(hash)) {
        const lastSent = this.recentHashes.get(hash);
        if (now - lastSent < 60 * 1000) { // No repetir exactamente lo mismo en 1 minuto
          console.log(`🚫 Notificación duplicada omitida en memoria (hash: ${hash})`);
          return false;
        }
      }
      this.recentHashes.set(hash, now);

      if (!this.checkRateLimit(notification)) return false;

      const enrichedNotification = this.enrichNotification(notification);

      // 2. Guardar en PostgreSQL (con verificación de duplicados en DB)
      const savedNotification = await this.saveNotification(enrichedNotification);
      
      // Si es un duplicado detectado en DB, no la enviamos de nuevo por los canales (Socket, Email, etc)
      if (savedNotification.isDuplicate) {
        return savedNotification;
      }

      enrichedNotification.id = savedNotification.id;

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

  async saveNotification(notif) {
    try {
      if (!global.db?.pool) {
        // Fallback a LowDB si no hay Pool de PostgreSQL
        return { id: Date.now() };
      }

      const titulo = notif.title || notif.titulo;
      const mensaje = notif.message || notif.mensaje;
      const tipo = notif.type || notif.tipo || 'info';
      const categoria = notif.category || notif.categoria || 'general';
      const userId = notif.user_id || null;
      const dataStr = JSON.stringify(notif.data || {});

      // Verificar si ya existe una notificación idéntica en los últimos 30 segundos
      // Esto evita duplicados en la base de datos desde el código raíz
      const checkDuplicate = await global.db.pool.query(
        `SELECT id FROM notifications 
         WHERE titulo = $1 AND mensaje = $2 AND user_id IS NOT DISTINCT FROM $3
         AND fecha_creacion > NOW() - INTERVAL '30 seconds'
         LIMIT 1`,
        [titulo, mensaje, userId]
      );

      if (checkDuplicate.rows.length > 0) {
        console.log(`♻️ Notificación duplicada detectada en DB, omitiendo guardado (ID: ${checkDuplicate.rows[0].id})`);
        return { ...checkDuplicate.rows[0], isDuplicate: true };
      }

      const result = await global.db.pool.query(
        `INSERT INTO notifications (titulo, mensaje, tipo, categoria, leida, user_id, data, fecha_creacion)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
         RETURNING *`,
        [titulo, mensaje, tipo, categoria, false, userId, dataStr]
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
        type: notification.type,
        title: notification.title,
        message: notification.message,
        category: notification.category,
        priority: notification.priority,
        timestamp: notification.timestamp,
        // Campos para el frontend (español)
        titulo: notification.titulo,
        mensaje: notification.mensaje,
        tipo: notification.tipo,
        categoria: notification.categoria,
        fecha_creacion: notification.fecha_creacion,
        leida: notification.leida,
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

  /**
   * Envía notificación por email
   */
  async sendToEmail(notification) {
    try {
      // Configurar email
      const toOverrideRaw = notification?.to || notification?.emailTo || notification?.email_to || null;
      const toOverride = Array.isArray(toOverrideRaw)
        ? toOverrideRaw.filter(Boolean).join(',')
        : (toOverrideRaw ? String(toOverrideRaw) : '');

      const fallbackTo =
        process.env.NOTIFICATION_EMAIL ||
        process.env.SECURITY_ALERT_EMAIL_TO ||
        process.env.ADMIN_EMAIL ||
        process.env.SMTP_USER ||
        '';

      const mailOptions = {
        to: toOverride || fallbackTo,
        subject: `[${String(notification.category || '').toUpperCase()}] ${String(notification.title || '')}`,
        html: this.generateEmailTemplate(notification),
        text: `${notification.title}\n\n${notification.message}`
      };

      const result = await sendMail(mailOptions);
      if (result?.ok) {
        const messageId = result?.info?.messageId || null;
        console.log('Email notification sent:', messageId || '(no messageId)');
        return true;
      }

      if (result?.skipped) {
        console.warn('Email notification skipped:', result.reason);
        return false;
      }

      console.error('Email notification failed:', result?.reason || 'unknown');
      return false;

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
    const panelUrl =
      (process.env.PANEL_URL || process.env.NEXT_PUBLIC_API_URL || '').trim() ||
      'http://localhost:3000';
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
    <style>
      @media only screen and (max-width: 620px) {
        .container { width: 100% !important; padding: 10px !important; }
        .card { border-radius: 12px !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#0b1020;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;">
    <span style="display:none;opacity:0;visibility:hidden;height:0;width:0;color:transparent;">
      ${title} - ${message.substring(0, 50)}...
    </span>

    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#0b1020;padding:40px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="max-width:600px;width:100%;">
            <!-- Header -->
            <tr>
              <td style="padding:0 0 20px 0;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                  <tr>
                    <td>
                      <div style="display:flex;align-items:center;">
                        <div style="width:12px;height:12px;border-radius:50%;background:${color};margin-right:12px;box-shadow:0 0 10px ${color}80;"></div>
                        <span style="color:#ffffff;font-weight:900;font-size:20px;letter-spacing:-0.5px;">Oguri<span style="color:${color};">Cap</span></span>
                      </div>
                    </td>
                    <td align="right">
                      <a href="${panelUrl}" style="color:#64748b;font-size:12px;text-decoration:none;font-weight:600;">Ir al Panel →</a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Main Card -->
            <tr>
              <td class="card" style="border-radius:24px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);background:#111827;box-shadow:0 30px 60px rgba(0,0,0,0.6);">
                <!-- Accent Bar -->
                <div style="height:6px;background:linear-gradient(90deg,${color},${color}40);"></div>
                
                <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-image:radial-gradient(circle at top right, rgba(255,255,255,0.03), transparent);">
                  <!-- Badge -->
                  <tr>
                    <td style="padding:24px 32px 0 32px;">
                      <div style="display:inline-block;padding:6px 12px;border-radius:8px;background:${color}15;border:1px solid ${color}30;color:${color};font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;">
                        ${category} · ${type}
                      </div>
                    </td>
                  </tr>

                  <!-- Title -->
                  <tr>
                    <td style="padding:16px 32px 8px 32px;">
                      <h1 style="margin:0;color:#ffffff;font-size:28px;font-weight:900;line-height:1.2;letter-spacing:-0.5px;">
                        ${title}
                      </h1>
                    </td>
                  </tr>

                  <!-- Message -->
                  <tr>
                    <td style="padding:0 32px 24px 32px;">
                      <div style="padding:20px;border-radius:16px;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.05);color:#cbd5e1;font-size:15px;line-height:1.6;">
                        ${message}
                      </div>
                    </td>
                  </tr>

                  <!-- Details -->
                  ${details ? `
                  <tr>
                    <td style="padding:0 32px 24px 32px;">
                      <div style="padding:16px;border-radius:12px;background:rgba(0,0,0,0.3);border:1px solid rgba(255,255,255,0.05);">
                        <div style="color:#64748b;font-size:11px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;margin-bottom:12px;">Detalles Técnicos</div>
                        <pre style="margin:0;font-family:'JetBrains Mono',monospace;font-size:12px;color:${color};white-space:pre-wrap;word-wrap:break-word;">${details}</pre>
                      </div>
                    </td>
                  </tr>
                  ` : ''}

                  <!-- CTA -->
                  <tr>
                    <td style="padding:0 32px 32px 32px;">
                      <a href="${panelUrl}" style="display:inline-block;padding:14px 28px;border-radius:12px;background:${color};color:#ffffff;text-decoration:none;font-weight:800;font-size:14px;box-shadow:0 10px 20px ${color}40;">
                        Ver en el Panel
                      </a>
                    </td>
                  </tr>

                  <!-- Footer Info -->
                  <tr>
                    <td style="padding:0 32px 24px 32px;border-top:1px solid rgba(255,255,255,0.05);">
                      <div style="padding-top:20px;color:#64748b;font-size:12px;line-height:1.5;">
                        Enviado el ${timestamp}<br/>
                        Este es un mensaje automático de tu sistema Oguri Bot.
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="padding:24px 0 0 0;text-align:center;">
                <div style="color:#475569;font-size:12px;font-weight:500;">
                  © ${new Date().getFullYear()} Oguri Bot · Todos los derechos reservados
                </div>
                <div style="margin-top:8px;">
                  <a href="#" style="color:#64748b;text-decoration:none;font-size:11px;margin:0 8px;">Preferencias</a>
                  <a href="#" style="color:#64748b;text-decoration:none;font-size:11px;margin:0 8px;">Soporte</a>
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

      const message = `🔔 *${notification.title}*

${notification.message}

_${new Date().toLocaleString()}_`;

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
    return notification && (notification.title || notification.titulo) && (notification.message || notification.mensaje);
  }

  enrichNotification(notification) {
    const timestamp = notification.timestamp || new Date().toISOString();
    return {
      // Avoid decimal IDs (break routes like `/api/notificaciones/:id/...`)
      id: Date.now() * 1000 + Math.floor(Math.random() * 1000),
      timestamp,
      channels: notification.channels || [NOTIFICATION_CHANNELS.SOCKET],
      priority: notification.priority || NOTIFICATION_PRIORITIES.NORMAL,
      category: notification.category || NOTIFICATION_CATEGORIES.SYSTEM,
      read: false,
      // Campos para el frontend (español)
      titulo: notification.title || notification.titulo,
      mensaje: notification.message || notification.mensaje,
      tipo: notification.type || notification.tipo,
      categoria: notification.category || notification.categoria,
      fecha_creacion: timestamp,
      leida: notification.read || notification.leida || false,
      ...notification
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

  /**
   * Sends a templated notification by name with dynamic data
   */
  async sendTemplateNotification(templateName, data = {}) {
    const template = this.templates.get(templateName);
    if (!template) {
      console.warn(`Template '${templateName}' not found`);
      return false;
    }

    // Interpolate message with data
    const interpolatedTitle = this.interpolateMessage(template.title || template.message, data);
    const interpolatedMessage = this.interpolateMessage(template.message, data);

    const notification = {
      title: interpolatedTitle,
      message: interpolatedMessage,
      type: template.type,
      category: template.category,
      priority: template.priority,
      channels: template.channels,
      data: data
    };

    return await this.send(notification);
  }
}

const notificationSystem = new NotificationSystem();

// Exportar tanto la instancia por defecto como la función de conveniencia
export const sendTemplateNotification = (templateName, data) => notificationSystem.sendTemplateNotification(templateName, data);
export default notificationSystem;
