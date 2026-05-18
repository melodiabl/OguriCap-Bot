// Sistema de Audit Logs Avanzado

import { emitLogEntry, emitNotification } from './socket-io.js';

// Tipos de eventos de auditoría
export const AUDIT_EVENTS = {
  // Autenticación
  LOGIN_SUCCESS: 'auth.login.success',
  LOGIN_FAILED: 'auth.login.failed',
  LOGOUT: 'auth.logout',
  PASSWORD_CHANGED: 'auth.password.changed',
  PASSWORD_RESET: 'auth.password.reset',
  
  // Usuarios
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_ROLE_CHANGED: 'user.role.changed',
  USER_STATUS_CHANGED: 'user.status.changed',
  
  // Grupos
  GROUP_CREATED: 'group.created',
  GROUP_UPDATED: 'group.updated',
  GROUP_DELETED: 'group.deleted',
  GROUP_BOT_TOGGLED: 'group.bot.toggled',
  GROUP_PROVIDER_CHANGED: 'group.provider.changed',
  
  // Bot
  BOT_STARTED: 'bot.started',
  BOT_STOPPED: 'bot.stopped',
  BOT_RESTARTED: 'bot.restarted',
  BOT_CONNECTED: 'bot.connected',
  BOT_DISCONNECTED: 'bot.disconnected',
  BOT_GLOBAL_STATE_CHANGED: 'bot.global_state.changed',
  BOT_COMMAND_EXECUTED: 'bot.command.executed',
  
  // SubBots
  SUBBOT_CREATED: 'subbot.created',
  SUBBOT_DELETED: 'subbot.deleted',
  SUBBOT_CONNECTED: 'subbot.connected',
  SUBBOT_DISCONNECTED: 'subbot.disconnected',
  
  // Contenido
  APORTE_CREATED: 'aporte.created',
  APORTE_UPDATED: 'aporte.updated',
  APORTE_DELETED: 'aporte.deleted',
  APORTE_APPROVED: 'aporte.approved',
  APORTE_REJECTED: 'aporte.rejected',
  
  PEDIDO_CREATED: 'pedido.created',
  PEDIDO_UPDATED: 'pedido.updated',
  PEDIDO_DELETED: 'pedido.deleted',
  PEDIDO_RESOLVED: 'pedido.resolved',
  
  // Sistema
  SYSTEM_CONFIG_CHANGED: 'system.config.changed',
  SYSTEM_MAINTENANCE_ENABLED: 'system.maintenance.enabled',
  SYSTEM_MAINTENANCE_DISABLED: 'system.maintenance.disabled',
  SYSTEM_BACKUP_CREATED: 'system.backup.created',
  SYSTEM_BACKUP_RESTORED: 'system.backup.restored',
  
  // Seguridad
  SECURITY_SUSPICIOUS_ACTIVITY: 'security.suspicious_activity',
  SECURITY_RATE_LIMIT_EXCEEDED: 'security.rate_limit.exceeded',
  SECURITY_IP_BLOCKED: 'security.ip.blocked',
  SECURITY_UNAUTHORIZED_ACCESS: 'security.unauthorized_access',
  
  // API
  API_KEY_CREATED: 'api.key.created',
  API_KEY_DELETED: 'api.key.deleted',
  API_ENDPOINT_ACCESSED: 'api.endpoint.accessed',
  
  // Multimedia
  MEDIA_UPLOADED: 'media.uploaded',
  MEDIA_DELETED: 'media.deleted',
  
  // Notificaciones
  NOTIFICATION_SENT: 'notification.sent',
  NOTIFICATION_DELETED: 'notification.deleted',
};

// Niveles de severidad
export const AUDIT_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  CRITICAL: 'critical',
  SUCCESS: 'success'
};

// Categorías de eventos
export const AUDIT_CATEGORIES = {
  AUTH: 'authentication',
  USER: 'user_management',
  GROUP: 'group_management',
  BOT: 'bot_management',
  CONTENT: 'content_management',
  SYSTEM: 'system',
  SECURITY: 'security',
  API: 'api',
  MEDIA: 'multimedia'
};

class AuditLogger {
  constructor() {
    this.maxLogs = parseInt(process.env.AUDIT_LOGS_MAX || '10000', 10);
    this.retentionDays = parseInt(process.env.AUDIT_RETENTION_DAYS || '90', 10);
  }

  /**
   * Registra un evento de auditoría
   */
  async log(event, data = {}) {
    try {
      if (typeof global.loadDatabase === 'function') await global.loadDatabase();
      
      const panelDb = this.ensureAuditDb();
      if (!panelDb) return;

      const auditEntry = {
        id: this.nextAuditId(panelDb),
        event,
        timestamp: new Date().toISOString(),
        level: data.level || AUDIT_LEVELS.INFO,
        category: this.getCategoryFromEvent(event),
        user: data.user || null,
        userRole: data.userRole || null,
        ip: data.ip || null,
        userAgent: data.userAgent || null,
        resource: data.resource || null,
        resourceId: data.resourceId || null,
        action: data.action || null,
        details: data.details || {},
        metadata: {
          sessionId: data.sessionId || null,
          requestId: data.requestId || null,
          duration: data.duration || null,
          success: data.success !== false, // Por defecto true
          errorMessage: data.errorMessage || null,
        }
      };

      // Agregar a la base de datos
      panelDb.auditLogs.push(auditEntry);

      // Limpiar logs antiguos si es necesario
      this.cleanupOldLogs(panelDb);

      // Emitir evento en tiempo real
      emitLogEntry({
        type: 'audit',
        level: auditEntry.level,
        message: this.formatLogMessage(auditEntry),
        timestamp: auditEntry.timestamp,
        category: auditEntry.category,
        user: auditEntry.user,
        details: auditEntry
      });

      // Emitir notificación para eventos críticos
      if (auditEntry.level === AUDIT_LEVELS.CRITICAL || auditEntry.level === AUDIT_LEVELS.ERROR) {
        emitNotification({
          type: auditEntry.level,
          title: 'Evento de Auditoría',
          message: this.formatLogMessage(auditEntry),
          category: 'security',
          data: auditEntry
        });
      }

      return auditEntry;
    } catch (error) {
      console.error('Error logging audit event:', error);
      return null;
    }
  }

  /**
   * Métodos de conveniencia para diferentes tipos de eventos
   */
  async logAuth(event, user, ip, details = {}) {
    return this.log(event, {
      level: event.includes('failed') ? AUDIT_LEVELS.WARNING : AUDIT_LEVELS.SUCCESS,
      user: user?.username || user,
      userRole: user?.rol,
      ip,
      category: AUDIT_CATEGORIES.AUTH,
      details
    });
  }

  async logUserAction(event, actor, targetUser, details = {}) {
    return this.log(event, {
      level: AUDIT_LEVELS.INFO,
      user: actor?.username || actor,
      userRole: actor?.rol,
      resource: 'user',
      resourceId: targetUser?.id || targetUser,
      details: {
        targetUser: targetUser?.username || targetUser,
        ...details
      }
    });
  }

  async logBotAction(event, user, details = {}) {
    return this.log(event, {
      level: event.includes('error') ? AUDIT_LEVELS.ERROR : AUDIT_LEVELS.INFO,
      user: user?.username || user,
      userRole: user?.rol,
      resource: 'bot',
      details
    });
  }

  async logSystemAction(event, user, details = {}) {
    return this.log(event, {
      level: AUDIT_LEVELS.WARNING,
      user: user?.username || user,
      userRole: user?.rol,
      resource: 'system',
      details
    });
  }

  async logSecurityEvent(event, ip, details = {}) {
    return this.log(event, {
      level: AUDIT_LEVELS.CRITICAL,
      ip,
      category: AUDIT_CATEGORIES.SECURITY,
      details
    });
  }

  async logApiAccess(endpoint, user, ip, success = true, details = {}) {
    return this.log(AUDIT_EVENTS.API_ENDPOINT_ACCESSED, {
      level: success ? AUDIT_LEVELS.INFO : AUDIT_LEVELS.WARNING,
      user: user?.username || user,
      userRole: user?.rol,
      ip,
      resource: 'api',
      action: 'access',
      details: {
        endpoint,
        method: details.method,
        statusCode: details.statusCode,
        responseTime: details.responseTime,
        ...details
      },
      metadata: {
        success,
        duration: details.responseTime
      }
    });
  }

  /**
   * Obtiene logs recientes (método de conveniencia)
   */
  async getRecentLogs(limit = 100, days = 7) {
    const filters = {
      limit,
      dateFrom: new Date(Date.now() - (days * 24 * 60 * 60 * 1000)).toISOString()
    }
    
    const result = await this.getLogs(filters)
    return result.logs || []
  }

  /**
   * Obtiene logs de auditoría con filtros
   */
  async getLogs(filters = {}) {
    try {
      if (typeof global.loadDatabase === 'function') await global.loadDatabase();
      
      const panelDb = this.ensureAuditDb();
      if (!panelDb) return { logs: [], total: 0 };

      let logs = [...panelDb.auditLogs];

      // Aplicar filtros
      if (filters.level) {
        logs = logs.filter(log => log.level === filters.level);
      }

      if (filters.category) {
        logs = logs.filter(log => log.category === filters.category);
      }

      if (filters.user) {
        logs = logs.filter(log => log.user && log.user.toLowerCase().includes(filters.user.toLowerCase()));
      }

      if (filters.event) {
        logs = logs.filter(log => log.event.includes(filters.event));
      }

      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom);
        logs = logs.filter(log => new Date(log.timestamp) >= fromDate);
      }

      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo);
        logs = logs.filter(log => new Date(log.timestamp) <= toDate);
      }

      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        logs = logs.filter(log => 
          log.event.toLowerCase().includes(searchLower) ||
          (log.user && log.user.toLowerCase().includes(searchLower)) ||
          (log.details && JSON.stringify(log.details).toLowerCase().includes(searchLower))
        );
      }

      // Ordenar por timestamp descendente
      logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      // Paginación
      const page = parseInt(filters.page || '1', 10);
      const limit = parseInt(filters.limit || '50', 10);
      const offset = (page - 1) * limit;
      const paginatedLogs = logs.slice(offset, offset + limit);

      return {
        logs: paginatedLogs,
        total: logs.length,
        page,
        limit,
        totalPages: Math.ceil(logs.length / limit)
      };
    } catch (error) {
      console.error('Error getting audit logs:', error);
      return { logs: [], total: 0 };
    }
  }

  /**
   * Obtiene estadísticas de auditoría
   */
  async getStats(days = 30) {
    try {
      if (typeof global.loadDatabase === 'function') await global.loadDatabase();
      
      const panelDb = this.ensureAuditDb();
      if (!panelDb) return {};

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const recentLogs = panelDb.auditLogs.filter(log => 
        new Date(log.timestamp) >= cutoffDate
      );

      const stats = {
        total: recentLogs.length,
        byLevel: {},
        byCategory: {},
        byUser: {},
        byDay: {},
        topEvents: {},
        securityEvents: 0,
        failedLogins: 0,
        successfulLogins: 0
      };

      // Contar por nivel
      Object.values(AUDIT_LEVELS).forEach(level => {
        stats.byLevel[level] = recentLogs.filter(log => log.level === level).length;
      });

      // Contar por categoría
      Object.values(AUDIT_CATEGORIES).forEach(category => {
        stats.byCategory[category] = recentLogs.filter(log => log.category === category).length;
      });

      // Contar por usuario (top 10)
      const userCounts = {};
      recentLogs.forEach(log => {
        if (log.user) {
          userCounts[log.user] = (userCounts[log.user] || 0) + 1;
        }
      });
      stats.byUser = Object.entries(userCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .reduce((obj, [user, count]) => ({ ...obj, [user]: count }), {});

      // Contar por día
      recentLogs.forEach(log => {
        const day = new Date(log.timestamp).toISOString().split('T')[0];
        stats.byDay[day] = (stats.byDay[day] || 0) + 1;
      });

      // Top eventos
      const eventCounts = {};
      recentLogs.forEach(log => {
        eventCounts[log.event] = (eventCounts[log.event] || 0) + 1;
      });
      stats.topEvents = Object.entries(eventCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .reduce((obj, [event, count]) => ({ ...obj, [event]: count }), {});

      // Eventos específicos
      stats.securityEvents = recentLogs.filter(log => log.category === AUDIT_CATEGORIES.SECURITY).length;
      stats.failedLogins = recentLogs.filter(log => log.event === AUDIT_EVENTS.LOGIN_FAILED).length;
      stats.successfulLogins = recentLogs.filter(log => log.event === AUDIT_EVENTS.LOGIN_SUCCESS).length;

      return stats;
    } catch (error) {
      console.error('Error getting audit stats:', error);
      return {};
    }
  }

  /**
   * Limpia logs antiguos
   */
  cleanupOldLogs(panelDb) {
    if (!panelDb.auditLogs) return;

    // Limpiar por cantidad máxima
    if (panelDb.auditLogs.length > this.maxLogs) {
      panelDb.auditLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      panelDb.auditLogs = panelDb.auditLogs.slice(0, this.maxLogs);
    }

    // Limpiar por antigüedad
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
    
    panelDb.auditLogs = panelDb.auditLogs.filter(log => 
      new Date(log.timestamp) >= cutoffDate
    );
  }

  /**
   * Funciones de utilidad
   */
  ensureAuditDb() {
    if (!global.db?.data) return null;
    
    const panel = global.db.data.panel ||= {};
    panel.auditLogs ||= [];
    panel.auditLogsCounter ||= 0;
    
    return panel;
  }

  nextAuditId(panelDb) {
    panelDb.auditLogsCounter = (panelDb.auditLogsCounter || 0) + 1;
    return panelDb.auditLogsCounter;
  }

  getCategoryFromEvent(event) {
    if (!event || typeof event !== 'string') return 'general';
    if (event.startsWith('auth.')) return AUDIT_CATEGORIES.AUTH;
    if (event.startsWith('user.')) return AUDIT_CATEGORIES.USER;
    if (event.startsWith('group.')) return AUDIT_CATEGORIES.GROUP;
    if (event.startsWith('bot.') || event.startsWith('subbot.')) return AUDIT_CATEGORIES.BOT;
    if (event.startsWith('aporte.') || event.startsWith('pedido.')) return AUDIT_CATEGORIES.CONTENT;
    if (event.startsWith('system.')) return AUDIT_CATEGORIES.SYSTEM;
    if (event.startsWith('security.')) return AUDIT_CATEGORIES.SECURITY;
    if (event.startsWith('api.')) return AUDIT_CATEGORIES.API;
    if (event.startsWith('media.')) return AUDIT_CATEGORIES.MEDIA;
    return 'general';
  }

  formatLogMessage(entry) {
    if (!entry || !entry.event || typeof entry.event !== 'string') {
      return 'Unknown event';
    }
    
    const eventParts = entry.event.split('.');
    const action = eventParts[eventParts.length - 1];
    const resource = eventParts[0];
    
    let message = `${resource.toUpperCase()}: ${action.replace('_', ' ')}`;
    
    if (entry.user) {
      message += ` por ${entry.user}`;
    }
    
    if (entry.details?.targetUser) {
      message += ` (usuario: ${entry.details.targetUser})`;
    }
    
    if (entry.resource && entry.resourceId) {
      message += ` (${entry.resource}: ${entry.resourceId})`;
    }
    
    return message;
  }
}

// Instancia singleton
const auditLogger = new AuditLogger();

// Funciones de conveniencia exportadas
export const logAuth = (event, user, ip, details) => auditLogger.logAuth(event, user, ip, details);
export const logUserAction = (event, actor, targetUser, details) => auditLogger.logUserAction(event, actor, targetUser, details);
export const logBotAction = (event, user, details) => auditLogger.logBotAction(event, user, details);
export const logSystemAction = (event, user, details) => auditLogger.logSystemAction(event, user, details);
export const logSecurityEvent = (event, ip, details) => auditLogger.logSecurityEvent(event, ip, details);
export const logApiAccess = (endpoint, user, ip, success, details) => auditLogger.logApiAccess(endpoint, user, ip, success, details);

export default auditLogger;