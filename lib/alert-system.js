// Sistema de Alertas Inteligentes

import auditLogger, { AUDIT_EVENTS } from './audit-logger.js';
import notificationSystem, { NOTIFICATION_TYPES, NOTIFICATION_CATEGORIES } from './notification-system.js';
import { emitNotification } from './socket-io.js';

// Tipos de alertas
export const ALERT_TYPES = {
  THRESHOLD: 'threshold',
  ANOMALY: 'anomaly',
  PATTERN: 'pattern',
  SECURITY: 'security',
  PERFORMANCE: 'performance',
  AVAILABILITY: 'availability',
  CUSTOM: 'custom'
};

// Severidades de alertas
export const ALERT_SEVERITIES = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
  EMERGENCY: 5
};

// Estados de alertas
export const ALERT_STATES = {
  ACTIVE: 'active',
  ACKNOWLEDGED: 'acknowledged',
  RESOLVED: 'resolved',
  SUPPRESSED: 'suppressed',
  EXPIRED: 'expired'
};

// Condiciones de alertas
export const ALERT_CONDITIONS = {
  GREATER_THAN: 'gt',
  LESS_THAN: 'lt',
  EQUALS: 'eq',
  NOT_EQUALS: 'ne',
  CONTAINS: 'contains',
  NOT_CONTAINS: 'not_contains',
  REGEX: 'regex',
  CHANGE_RATE: 'change_rate',
  DEVIATION: 'deviation'
};

class AlertSystem {
  constructor() {
    this.alerts = new Map(); // ID -> Alert
    this.rules = new Map(); // ID -> AlertRule
    this.activeAlerts = new Set(); // IDs de alertas activas
    this.suppressions = new Map(); // Supresiones temporales
    this.escalationPolicies = new Map(); // Políticas de escalamiento
    this.metrics = new Map(); // Métricas para análisis
    this.anomalyDetector = new AnomalyDetector();
    
    this.initializeDefaultRules();
    this.startMonitoring();
  }

  /**
   * Inicializa reglas de alerta por defecto
   */
  initializeDefaultRules() {
    // Alerta de uso de memoria alto
    this.createRule({
      name: 'Uso de Memoria Alto',
      description: 'Se activa cuando el uso de memoria supera el 85%',
      type: ALERT_TYPES.THRESHOLD,
      severity: ALERT_SEVERITIES.HIGH,
      metric: 'memory_usage_percent',
      condition: ALERT_CONDITIONS.GREATER_THAN,
      threshold: 85,
      duration: 300, // 5 minutos
      enabled: true,
      actions: ['notification', 'log'],
      tags: ['system', 'memory']
    });

    // Alerta de errores de comandos frecuentes
    this.createRule({
      name: 'Errores de Comandos Frecuentes',
      description: 'Se activa cuando hay más de 10 errores de comandos en 5 minutos',
      type: ALERT_TYPES.THRESHOLD,
      severity: ALERT_SEVERITIES.MEDIUM,
      metric: 'command_errors_rate',
      condition: ALERT_CONDITIONS.GREATER_THAN,
      threshold: 10,
      duration: 300,
      enabled: true,
      actions: ['notification'],
      tags: ['bot', 'commands']
    });

    // Alerta de bot desconectado
    this.createRule({
      name: 'Bot Desconectado',
      description: 'Se activa cuando el bot principal se desconecta',
      type: ALERT_TYPES.AVAILABILITY,
      severity: ALERT_SEVERITIES.CRITICAL,
      metric: 'bot_connected',
      condition: ALERT_CONDITIONS.EQUALS,
      threshold: false,
      duration: 60, // 1 minuto
      enabled: true,
      actions: ['notification', 'webhook', 'whatsapp'],
      tags: ['bot', 'availability']
    });

    // Alerta de intentos de login fallidos
    this.createRule({
      name: 'Intentos de Login Fallidos',
      description: 'Se activa con múltiples intentos de login fallidos',
      type: ALERT_TYPES.SECURITY,
      severity: ALERT_SEVERITIES.HIGH,
      metric: 'failed_login_attempts',
      condition: ALERT_CONDITIONS.GREATER_THAN,
      threshold: 5,
      duration: 600, // 10 minutos
      enabled: true,
      actions: ['notification', 'log', 'block_ip'],
      tags: ['security', 'authentication']
    });

    // Alerta de anomalía en actividad de usuarios
    this.createRule({
      name: 'Anomalía en Actividad de Usuarios',
      description: 'Se activa cuando se detecta actividad anómala de usuarios',
      type: ALERT_TYPES.ANOMALY,
      severity: ALERT_SEVERITIES.MEDIUM,
      metric: 'user_activity_anomaly',
      condition: ALERT_CONDITIONS.DEVIATION,
      threshold: 2.5, // 2.5 desviaciones estándar
      duration: 900, // 15 minutos
      enabled: true,
      actions: ['notification'],
      tags: ['users', 'anomaly']
    });

    // Alerta de espacio en disco bajo
    this.createRule({
      name: 'Espacio en Disco Bajo',
      description: 'Se activa cuando el espacio en disco es menor al 10%',
      type: ALERT_TYPES.THRESHOLD,
      severity: ALERT_SEVERITIES.HIGH,
      metric: 'disk_usage_percent',
      condition: ALERT_CONDITIONS.GREATER_THAN,
      threshold: 90,
      duration: 300,
      enabled: true,
      actions: ['notification', 'cleanup'],
      tags: ['system', 'storage']
    });
  }

  /**
   * Crea una nueva regla de alerta
   */
  createRule(config) {
    const rule = {
      id: this.generateId(),
      name: config.name,
      description: config.description || '',
      type: config.type || ALERT_TYPES.THRESHOLD,
      severity: config.severity || ALERT_SEVERITIES.MEDIUM,
      metric: config.metric,
      condition: config.condition,
      threshold: config.threshold,
      duration: config.duration || 300, // 5 minutos por defecto
      enabled: config.enabled !== false,
      actions: config.actions || ['notification'],
      tags: config.tags || [],
      createdAt: new Date().toISOString(),
      lastTriggered: null,
      triggerCount: 0,
      suppressUntil: null,
      escalationPolicy: config.escalationPolicy || null,
      metadata: config.metadata || {}
    };

    this.rules.set(rule.id, rule);
    return rule;
  }

  /**
   * Evalúa todas las reglas de alerta
   */
  async evaluateRules() {
    const currentMetrics = await this.collectMetrics();
    
    for (const [, rule] of this.rules) {
      if (!rule.enabled) continue;
      if (this.isSuppressed(rule)) continue;

      try {
        const shouldTrigger = await this.evaluateRule(rule, currentMetrics);
        
        if (shouldTrigger) {
          await this.triggerAlert(rule, currentMetrics);
        } else {
          // Verificar si hay una alerta activa que debería resolverse
          await this.checkForResolution(rule);
        }
      } catch (error) {
        console.error(`Error evaluating rule ${rule.name}:`, error);
      }
    }
  }

  /**
   * Evalúa una regla específica
   */
  async evaluateRule(rule, metrics) {
    const metricValue = metrics[rule.metric];
    if (metricValue === undefined) return false;

    let conditionMet = false;

    switch (rule.condition) {
      case ALERT_CONDITIONS.GREATER_THAN:
        conditionMet = metricValue > rule.threshold;
        break;
      case ALERT_CONDITIONS.LESS_THAN:
        conditionMet = metricValue < rule.threshold;
        break;
      case ALERT_CONDITIONS.EQUALS:
        conditionMet = metricValue === rule.threshold;
        break;
      case ALERT_CONDITIONS.NOT_EQUALS:
        conditionMet = metricValue !== rule.threshold;
        break;
      case ALERT_CONDITIONS.CONTAINS:
        conditionMet = String(metricValue).includes(String(rule.threshold));
        break;
      case ALERT_CONDITIONS.NOT_CONTAINS:
        conditionMet = !String(metricValue).includes(String(rule.threshold));
        break;
      case ALERT_CONDITIONS.REGEX:
        conditionMet = new RegExp(rule.threshold).test(String(metricValue));
        break;
      case ALERT_CONDITIONS.CHANGE_RATE:
        conditionMet = await this.evaluateChangeRate(rule, metricValue);
        break;
      case ALERT_CONDITIONS.DEVIATION:
        conditionMet = await this.evaluateDeviation(rule, metricValue);
        break;
    }

    // Verificar duración si la condición se cumple
    if (conditionMet && rule.duration > 0) {
      return await this.checkDuration(rule, metricValue);
    }

    return conditionMet;
  }

  /**
   * Dispara una alerta
   */
  async triggerAlert(rule, metrics) {
    const alertId = this.generateId();
    const alert = {
      id: alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      type: rule.type,
      severity: rule.severity,
      state: ALERT_STATES.ACTIVE,
      message: this.generateAlertMessage(rule, metrics),
      details: {
        metric: rule.metric,
        value: metrics[rule.metric],
        threshold: rule.threshold,
        condition: rule.condition
      },
      triggeredAt: new Date().toISOString(),
      acknowledgedAt: null,
      resolvedAt: null,
      tags: rule.tags,
      metadata: {
        ...rule.metadata,
        triggerMetrics: metrics
      }
    };

    // Guardar alerta
    this.alerts.set(alertId, alert);
    this.activeAlerts.add(alertId);

    // Actualizar estadísticas de la regla
    rule.lastTriggered = alert.triggeredAt;
    rule.triggerCount++;

    // Ejecutar acciones
    await this.executeActions(rule, alert);

    // Log de auditoría
    await auditLogger.log(AUDIT_EVENTS.SECURITY_SUSPICIOUS_ACTIVITY, {
      level: this.getSeverityLevel(rule.severity),
      details: {
        alertId,
        ruleName: rule.name,
        severity: rule.severity,
        metric: rule.metric,
        value: metrics[rule.metric],
        threshold: rule.threshold
      }
    });

    // Emitir evento en tiempo real
    emitNotification({
      type: 'alert',
      title: `Alerta: ${rule.name}`,
      message: alert.message,
      category: 'alert',
      data: alert
    });

    return alert;
  }

  /**
   * Ejecuta las acciones de una alerta
   */
  async executeActions(rule, alert) {
    for (const action of rule.actions) {
      try {
        await this.executeAction(action, rule, alert);
      } catch (error) {
        console.error(`Error executing action ${action}:`, error);
      }
    }
  }

  /**
   * Ejecuta una acción específica
   */
  async executeAction(action, rule, alert) {
    switch (action) {
      case 'notification':
        await notificationSystem.send({
          type: this.getNotificationType(rule.severity),
          title: `🚨 Alerta: ${rule.name}`,
          message: alert.message,
          category: NOTIFICATION_CATEGORIES.SECURITY,
          data: {
            alertId: alert.id,
            ruleId: rule.id,
            severity: rule.severity,
            metric: alert.details.metric,
            value: alert.details.value
          }
        });
        break;

      case 'log':
        console.warn(`[ALERT] ${rule.name}: ${alert.message}`);
        break;

      case 'webhook':
        await this.callWebhook(rule, alert);
        break;

      case 'whatsapp':
        await this.sendWhatsAppAlert(rule, alert);
        break;

      case 'block_ip':
        await this.blockSuspiciousIP(alert);
        break;

      case 'cleanup':
        await this.performCleanup(alert);
        break;

      case 'restart_bot':
        await this.restartBot(alert);
        break;

      default:
        console.warn(`Unknown alert action: ${action}`);
    }
  }

  /**
   * Recopila métricas del sistema
   */
  async collectMetrics() {
    const metrics = {};

    try {
      // Importar dependencias dinámicamente
      const si = await import('systeminformation').catch(() => null);
      
      // Métricas de memoria usando systeminformation si está disponible
      if (si) {
        const mem = await si.mem();
        metrics.memory_usage_percent = ((mem.used / mem.total) * 100);
        metrics.memory_heap_used = mem.used;
        metrics.memory_heap_total = mem.total;
        
        // Métricas de CPU
        const cpu = await si.currentLoad();
        metrics.cpu_usage_percent = cpu.currentLoad;
        
        // Métricas de disco
        const fsSize = await si.fsSize();
        if (fsSize && fsSize.length > 0) {
          const mainDisk = fsSize[0];
          metrics.disk_usage_percent = mainDisk.use;
        }
      } else {
        // Fallback a métricas básicas de Node.js
        const memUsage = process.memoryUsage();
        metrics.memory_usage_percent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
        metrics.memory_heap_used = memUsage.heapUsed;
        metrics.memory_heap_total = memUsage.heapTotal;
        metrics.cpu_usage_percent = 0; // No disponible sin systeminformation
        metrics.disk_usage_percent = 0; // No disponible sin systeminformation
      }

      // Métricas del bot
      metrics.bot_connected = Boolean(global.conn?.user);
      metrics.bot_uptime = process.uptime();

      // Métricas de comandos desde audit logs reales
      if (typeof global.loadDatabase === 'function') await global.loadDatabase();
      const panelDb = global.db?.data?.panel;
      
      if (panelDb?.auditLogs) {
        const now = new Date();
        const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
        
        const recentLogs = panelDb.auditLogs.filter(log => 
          new Date(log.timestamp) >= fiveMinutesAgo
        );
        
        const commandLogs = recentLogs.filter(log => 
          log.event === 'BOT_COMMAND_EXECUTED'
        );
        
        const errorLogs = commandLogs.filter(log => 
          log.metadata && !log.metadata.success
        );
        
        metrics.command_errors_rate = errorLogs.length;
        metrics.command_success_rate = commandLogs.length > 0 
          ? ((commandLogs.length - errorLogs.length) / commandLogs.length) * 100 
          : 100;
      } else {
        metrics.command_errors_rate = 0;
        metrics.command_success_rate = 100;
      }

      // Métricas de usuarios activos
      if (panelDb?.users) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        metrics.active_users_count = Object.values(panelDb.users).filter(user => 
          user.last_login && new Date(user.last_login) >= oneHourAgo
        ).length;
      } else {
        metrics.active_users_count = 0;
      }

      // Métricas de intentos de login fallidos
      if (panelDb?.auditLogs) {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        metrics.failed_login_attempts = panelDb.auditLogs.filter(log => 
          log.event === 'LOGIN_FAILED' &&
          new Date(log.timestamp) >= tenMinutesAgo
        ).length;
      } else {
        metrics.failed_login_attempts = 0;
      }

      // Detección de anomalías en actividad de usuarios
      metrics.user_activity_anomaly = await this.anomalyDetector.detectUserActivityAnomaly();

      // Tiempo de respuesta promedio (desde métricas globales si están disponibles)
      metrics.response_time_avg = global.averageResponseTime || 0;

      // Actualizar historial de métricas
      this.updateMetricsHistory(metrics);

    } catch (error) {
      console.error('Error collecting metrics:', error);
      // Métricas por defecto en caso de error
      const memUsage = process.memoryUsage();
      metrics.memory_usage_percent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
      metrics.memory_heap_used = memUsage.heapUsed;
      metrics.memory_heap_total = memUsage.heapTotal;
      metrics.bot_connected = Boolean(global.conn?.user);
      metrics.bot_uptime = process.uptime();
      metrics.command_errors_rate = 0;
      metrics.command_success_rate = 100;
      metrics.active_users_count = 0;
      metrics.failed_login_attempts = 0;
      metrics.user_activity_anomaly = 0;
      metrics.cpu_usage_percent = 0;
      metrics.disk_usage_percent = 0;
      metrics.response_time_avg = 0;
    }

    return metrics;
  }

  /**
   * Funciones de métricas específicas
   */
  async getCommandErrorRate(seconds) {
    if (typeof global.loadDatabase === 'function') await global.loadDatabase();
    
    const panelDb = global.db?.data?.panel;
    if (!panelDb?.auditLogs) return 0;

    const cutoff = new Date(Date.now() - seconds * 1000);
    const commandLogs = panelDb.auditLogs.filter(log => 
      log.event === AUDIT_EVENTS.BOT_COMMAND_EXECUTED &&
      new Date(log.timestamp) >= cutoff
    );

    const errorLogs = commandLogs.filter(log => 
      log.metadata && !log.metadata.success
    );

    return errorLogs.length;
  }

  async getCommandSuccessRate(seconds) {
    if (typeof global.loadDatabase === 'function') await global.loadDatabase();
    
    const panelDb = global.db?.data?.panel;
    if (!panelDb?.auditLogs) return 0;

    const cutoff = new Date(Date.now() - seconds * 1000);
    const commandLogs = panelDb.auditLogs.filter(log => 
      log.event === AUDIT_EVENTS.BOT_COMMAND_EXECUTED &&
      new Date(log.timestamp) >= cutoff
    );

    const successLogs = commandLogs.filter(log => 
      log.metadata && log.metadata.success
    );

    return commandLogs.length > 0 ? (successLogs.length / commandLogs.length) * 100 : 100;
  }

  async getActiveUsersCount() {
    if (typeof global.loadDatabase === 'function') await global.loadDatabase();
    
    const panelDb = global.db?.data?.panel;
    if (!panelDb?.users) return 0;

    const oneHourAgo = new Date(Date.now() - 3600000);
    return Object.values(panelDb.users).filter(user => 
      user.last_login && new Date(user.last_login) >= oneHourAgo
    ).length;
  }

  async getFailedLoginAttempts(seconds) {
    if (typeof global.loadDatabase === 'function') await global.loadDatabase();
    
    const panelDb = global.db?.data?.panel;
    if (!panelDb?.auditLogs) return 0;

    const cutoff = new Date(Date.now() - seconds * 1000);
    return panelDb.auditLogs.filter(log => 
      log.event === AUDIT_EVENTS.LOGIN_FAILED &&
      new Date(log.timestamp) >= cutoff
    ).length;
  }

  async getDiskUsage() {
    try {
      const si = await import('systeminformation').catch(() => null);
      if (si) {
        const fsSize = await si.fsSize();
        if (fsSize && fsSize.length > 0) {
          const mainDisk = fsSize[0];
          return mainDisk.use;
        }
      }
      
      // Fallback usando fs.statSync (aproximado)
      const fs = await import('fs');
      const stats = fs.statSync(process.cwd());
      // En Windows, no podemos obtener el uso real del disco sin herramientas nativas
      // Retornamos 0 como fallback seguro
      return 0;
    } catch {
      return 0;
    }
  }

  async getCPUUsage() {
    // Implementación básica de uso de CPU
    const startUsage = process.cpuUsage();
    await new Promise(resolve => setTimeout(resolve, 100));
    const endUsage = process.cpuUsage(startUsage);
    
    const totalUsage = endUsage.user + endUsage.system;
    return (totalUsage / 100000) * 100; // Convertir a porcentaje aproximado
  }

  async getAverageResponseTime() {
    // Obtener tiempo de respuesta promedio de los últimos requests
    return global.averageResponseTime || 0;
  }

  /**
   * Funciones de utilidad
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  generateAlertMessage(rule, metrics) {
    const value = metrics[rule.metric];
    const threshold = rule.threshold;
    
    switch (rule.condition) {
      case ALERT_CONDITIONS.GREATER_THAN:
        return `${rule.metric} (${value}) supera el umbral de ${threshold}`;
      case ALERT_CONDITIONS.LESS_THAN:
        return `${rule.metric} (${value}) está por debajo del umbral de ${threshold}`;
      case ALERT_CONDITIONS.EQUALS:
        return `${rule.metric} es igual a ${threshold}`;
      default:
        return `${rule.metric}: ${value} (umbral: ${threshold})`;
    }
  }

  getSeverityLevel(severity) {
    switch (severity) {
      case ALERT_SEVERITIES.EMERGENCY:
      case ALERT_SEVERITIES.CRITICAL:
        return 'critical';
      case ALERT_SEVERITIES.HIGH:
        return 'error';
      case ALERT_SEVERITIES.MEDIUM:
        return 'warning';
      default:
        return 'info';
    }
  }

  getNotificationType(severity) {
    switch (severity) {
      case ALERT_SEVERITIES.EMERGENCY:
      case ALERT_SEVERITIES.CRITICAL:
        return NOTIFICATION_TYPES.CRITICAL;
      case ALERT_SEVERITIES.HIGH:
        return NOTIFICATION_TYPES.ERROR;
      case ALERT_SEVERITIES.MEDIUM:
        return NOTIFICATION_TYPES.WARNING;
      default:
        return NOTIFICATION_TYPES.INFO;
    }
  }

  isSuppressed(rule) {
    if (!rule.suppressUntil) return false;
    return new Date() < new Date(rule.suppressUntil);
  }

  async checkDuration(rule, value) {
    const key = `duration_${rule.id}`;
    const now = Date.now();
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, { startTime: now, value });
      return false;
    }
    
    const durationData = this.metrics.get(key);
    const elapsed = now - durationData.startTime;
    
    if (elapsed >= rule.duration * 1000) {
      this.metrics.delete(key);
      return true;
    }
    
    return false;
  }

  async checkForResolution(rule) {
    const activeAlert = Array.from(this.activeAlerts)
      .map(id => this.alerts.get(id))
      .find(alert => alert.ruleId === rule.id && alert.state === ALERT_STATES.ACTIVE);
    
    if (activeAlert) {
      await this.resolveAlert(activeAlert.id);
    }
  }

  async resolveAlert(alertId) {
    const alert = this.alerts.get(alertId);
    if (!alert) return;

    alert.state = ALERT_STATES.RESOLVED;
    alert.resolvedAt = new Date().toISOString();
    this.activeAlerts.delete(alertId);

    // Notificar resolución
    await notificationSystem.send({
      type: NOTIFICATION_TYPES.SUCCESS,
      title: `✅ Alerta Resuelta: ${alert.ruleName}`,
      message: `La alerta "${alert.ruleName}" se ha resuelto automáticamente`,
      category: NOTIFICATION_CATEGORIES.SYSTEM,
      data: { alertId, resolved: true }
    });
  }

  /**
   * Evaluar tasa de cambio
   */
  async evaluateChangeRate(rule, metricValue) {
    const key = `change_rate_${rule.id}`;
    const now = Date.now();
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, { value: metricValue, timestamp: now });
      return false;
    }
    
    const previous = this.metrics.get(key);
    const timeDiff = now - previous.timestamp;
    const valueDiff = Math.abs(metricValue - previous.value);
    
    // Calcular tasa de cambio por minuto
    const changeRate = (valueDiff / timeDiff) * 60000;
    
    // Actualizar valor anterior
    this.metrics.set(key, { value: metricValue, timestamp: now });
    
    return changeRate > rule.threshold;
  }

  /**
   * Evaluar desviación estadística
   */
  async evaluateDeviation(rule, metricValue) {
    const key = `deviation_${rule.id}`;
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    
    const history = this.metrics.get(key);
    history.push(metricValue);
    
    // Mantener solo los últimos 100 valores
    if (history.length > 100) {
      history.shift();
    }
    
    // Necesitamos al menos 10 valores para calcular desviación
    if (history.length < 10) {
      return false;
    }
    
    // Calcular media y desviación estándar
    const mean = history.reduce((sum, val) => sum + val, 0) / history.length;
    const variance = history.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / history.length;
    const stdDev = Math.sqrt(variance);
    
    // Si no hay variación, no hay desviación
    if (stdDev === 0) return false;
    
    // Calcular z-score
    const zScore = Math.abs((metricValue - mean) / stdDev);
    
    return zScore > rule.threshold;
  }

  /**
   * Llamar webhook
   */
  async callWebhook(rule, alert) {
    try {
      const webhookUrl = process.env.WEBHOOK_URL_ALERTS;
      if (!webhookUrl) {
        console.warn('No webhook URL configured');
        return;
      }

      const payload = {
        alert: {
          id: alert.id,
          ruleName: rule.name,
          type: alert.type,
          severity: alert.severity,
          message: alert.message,
          triggeredAt: alert.triggeredAt
        },
        rule: {
          id: rule.id,
          name: rule.name,
          type: rule.type
        },
        timestamp: new Date().toISOString()
      };

      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'WhatsApp-Bot-Alert-System/1.0'
        },
        body: JSON.stringify(payload),
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
      }

      console.log(`Webhook sent successfully for alert ${alert.id}`);
    } catch (error) {
      console.error('Error calling webhook:', error);
      throw error;
    }
  }

  /**
   * Enviar alerta por WhatsApp
   */
  async sendWhatsAppAlert(rule, alert) {
    try {
      const adminNumbers = this.getAdminNumbers();
      if (!adminNumbers.length) {
        console.warn('No admin numbers configured for WhatsApp alerts');
        return;
      }

      const message = `🚨 *ALERTA DE SEGURIDAD*\n\n` +
                     `📋 *Regla:* ${rule.name}\n` +
                     `⚠️ *Severidad:* ${this.getSeverityLabel(alert.severity)}\n` +
                     `📝 *Mensaje:* ${alert.message}\n` +
                     `🕐 *Hora:* ${new Date(alert.triggeredAt).toLocaleString()}\n\n` +
                     `_Sistema de Alertas WhatsApp Bot_`;

      for (const number of adminNumbers) {
        try {
          if (global.conn && global.conn.user) {
            await global.conn.sendMessage(`${number}@s.whatsapp.net`, { text: message });
            console.log(`WhatsApp alert sent to ${number}`);
          }
        } catch (error) {
          console.error(`Error sending WhatsApp alert to ${number}:`, error);
        }
      }
    } catch (error) {
      console.error('Error sending WhatsApp alert:', error);
      throw error;
    }
  }

  /**
   * Bloquear IP sospechosa
   */
  async blockSuspiciousIP(alert) {
    try {
      const ip = alert.details?.clientIP || alert.metadata?.ip;
      if (!ip) {
        console.warn('No IP found in alert for blocking');
        return;
      }

      // Importar security monitor dinámicamente
      const { default: securityMonitor } = await import('./security-monitor.js');
      await securityMonitor.blockIP(ip, 3600000, `Auto-blocked by alert: ${alert.ruleName}`);
      
      console.log(`IP ${ip} blocked due to alert: ${alert.ruleName}`);
    } catch (error) {
      console.error('Error blocking suspicious IP:', error);
    }
  }

  /**
   * Realizar limpieza del sistema
   */
  async performCleanup(alert) {
    try {
      console.log('Performing system cleanup due to alert:', alert.ruleName);
      
      // Limpiar logs antiguos
      const fs = await import('fs');
      const path = await import('path');
      
      const logsDir = path.join(process.cwd(), 'logs');
      if (fs.existsSync(logsDir)) {
        const files = fs.readdirSync(logsDir);
        const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        
        for (const file of files) {
          const filePath = path.join(logsDir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtime.getTime() < oneWeekAgo) {
            fs.unlinkSync(filePath);
            console.log(`Deleted old log file: ${file}`);
          }
        }
      }
      
      // Limpiar cache de Node.js
      if (global.gc) {
        global.gc();
        console.log('Garbage collection performed');
      }
      
    } catch (error) {
      console.error('Error performing cleanup:', error);
    }
  }

  /**
   * Reiniciar bot
   */
  async restartBot(alert) {
    try {
      console.log('Restarting bot due to critical alert:', alert.ruleName);
      
      // Notificar antes de reiniciar
      await notificationSystem.send({
        type: NOTIFICATION_TYPES.CRITICAL,
        title: '🔄 Reiniciando Bot',
        message: `El bot se reiniciará debido a la alerta: ${alert.ruleName}`,
        category: NOTIFICATION_CATEGORIES.SYSTEM
      });
      
      // Esperar un poco para que se envíe la notificación
      setTimeout(() => {
        process.exit(1); // PM2 o el supervisor reiniciará el proceso
      }, 5000);
      
    } catch (error) {
      console.error('Error restarting bot:', error);
    }
  }

  /**
   * Obtener números de administradores
   */
  getAdminNumbers() {
    // Obtener números de administradores desde la configuración
    const adminNumbers = [];
    
    if (global.owner && Array.isArray(global.owner)) {
      adminNumbers.push(...global.owner);
    }
    
    // También desde variables de entorno
    if (process.env.ADMIN_NUMBERS) {
      const envNumbers = process.env.ADMIN_NUMBERS.split(',').map(n => n.trim());
      adminNumbers.push(...envNumbers);
    }
    
    return [...new Set(adminNumbers)]; // Eliminar duplicados
  }

  /**
   * Obtener etiqueta de severidad
   */
  getSeverityLabel(severity) {
    switch (severity) {
      case ALERT_SEVERITIES.EMERGENCY: return 'EMERGENCIA';
      case ALERT_SEVERITIES.CRITICAL: return 'CRÍTICA';
      case ALERT_SEVERITIES.HIGH: return 'ALTA';
      case ALERT_SEVERITIES.MEDIUM: return 'MEDIA';
      default: return 'BAJA';
    }
  }

  /**
   * Actualizar historial de métricas
   */
  updateMetricsHistory(metrics) {
    const timestamp = Date.now();
    for (const [key, value] of Object.entries(metrics)) {
      if (!this.metrics.has(`history_${key}`)) {
        this.metrics.set(`history_${key}`, []);
      }
      
      const history = this.metrics.get(`history_${key}`);
      history.push({ timestamp, value });
      
      // Mantener solo las últimas 100 entradas
      if (history.length > 100) {
        history.shift();
      }
    }
  }

  /**
   * Inicia el monitoreo continuo
   */
  startMonitoring() {
    // Evaluar reglas cada 30 segundos
    setInterval(() => {
      this.evaluateRules().catch(console.error);
    }, 30000);

    // Limpiar alertas resueltas cada hora
    setInterval(() => {
      this.cleanupResolvedAlerts();
    }, 3600000);

    console.log('[Alert System] Monitoring started');
  }

  cleanupResolvedAlerts() {
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    
    for (const [alertId, alert] of this.alerts) {
      if (alert.state === ALERT_STATES.RESOLVED && 
          new Date(alert.resolvedAt).getTime() < oneWeekAgo) {
        this.alerts.delete(alertId);
      }
    }
  }

  // Métodos públicos para gestión
  getActiveAlerts() {
    return Array.from(this.activeAlerts).map(id => this.alerts.get(id));
  }

  getAllAlerts() {
    return Array.from(this.alerts.values());
  }

  getRules() {
    return Array.from(this.rules.values());
  }

  async acknowledgeAlert(alertId, userId) {
    const alert = this.alerts.get(alertId);
    if (!alert) throw new Error('Alert not found');

    alert.state = ALERT_STATES.ACKNOWLEDGED;
    alert.acknowledgedAt = new Date().toISOString();
    alert.acknowledgedBy = userId;

    return alert;
  }

  suppressRule(ruleId, duration) {
    const rule = this.rules.get(ruleId);
    if (!rule) throw new Error('Rule not found');

    rule.suppressUntil = new Date(Date.now() + duration * 1000).toISOString();
    return rule;
  }
}

// Detector de anomalías usando datos reales
class AnomalyDetector {
  constructor() {
    this.baseline = new Map();
    this.historicalData = new Map();
  }

  async detectUserActivityAnomaly() {
    try {
      if (typeof global.loadDatabase === 'function') await global.loadDatabase();
      const panelDb = global.db?.data?.panel;
      
      if (!panelDb?.auditLogs) return 0;

      const now = new Date();
      const oneHour = 60 * 60 * 1000;
      const oneDay = 24 * oneHour;
      
      // Obtener actividad de la última hora
      const currentHourActivity = panelDb.auditLogs.filter(log => 
        new Date(log.timestamp) >= new Date(now.getTime() - oneHour)
      ).length;
      
      // Obtener actividad histórica de las últimas 24 horas (por horas)
      const historicalActivity = [];
      for (let i = 1; i <= 24; i++) {
        const hourStart = new Date(now.getTime() - (i + 1) * oneHour);
        const hourEnd = new Date(now.getTime() - i * oneHour);
        
        const hourActivity = panelDb.auditLogs.filter(log => {
          const logTime = new Date(log.timestamp);
          return logTime >= hourStart && logTime < hourEnd;
        }).length;
        
        historicalActivity.push(hourActivity);
      }
      
      if (historicalActivity.length === 0) return 0;
      
      // Calcular media y desviación estándar
      const mean = historicalActivity.reduce((sum, val) => sum + val, 0) / historicalActivity.length;
      const variance = historicalActivity.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / historicalActivity.length;
      const stdDev = Math.sqrt(variance);
      
      // Si no hay variación histórica, no hay anomalía
      if (stdDev === 0) return 0;
      
      // Calcular z-score (número de desviaciones estándar)
      const zScore = Math.abs((currentHourActivity - mean) / stdDev);
      
      // Retornar el z-score como medida de anomalía
      // Valores > 2 se consideran anómalos
      return Math.min(zScore, 5); // Limitar a 5 para evitar valores extremos
      
    } catch (error) {
      console.error('Error detecting user activity anomaly:', error);
      return 0;
    }
  }

  async detectCommandAnomaly() {
    try {
      if (typeof global.loadDatabase === 'function') await global.loadDatabase();
      const panelDb = global.db?.data?.panel;
      
      if (!panelDb?.auditLogs) return 0;

      const now = new Date();
      const oneHour = 60 * 60 * 1000;
      
      // Obtener comandos de la última hora
      const recentCommands = panelDb.auditLogs.filter(log => 
        log.event === 'BOT_COMMAND_EXECUTED' &&
        new Date(log.timestamp) >= new Date(now.getTime() - oneHour)
      );
      
      // Analizar patrones de comandos
      const commandCounts = {};
      const userCounts = {};
      
      recentCommands.forEach(log => {
        const command = log.metadata?.command || 'unknown';
        const user = log.metadata?.userId || 'unknown';
        
        commandCounts[command] = (commandCounts[command] || 0) + 1;
        userCounts[user] = (userCounts[user] || 0) + 1;
      });
      
      // Detectar anomalías:
      // 1. Usuario con demasiados comandos
      const maxUserCommands = Math.max(...Object.values(userCounts), 0);
      const avgUserCommands = Object.values(userCounts).reduce((sum, val) => sum + val, 0) / Math.max(Object.keys(userCounts).length, 1);
      
      // 2. Comando específico usado excesivamente
      const maxCommandUsage = Math.max(...Object.values(commandCounts), 0);
      const avgCommandUsage = Object.values(commandCounts).reduce((sum, val) => sum + val, 0) / Math.max(Object.keys(commandCounts).length, 1);
      
      let anomalyScore = 0;
      
      // Anomalía si un usuario ejecuta > 3x la media
      if (maxUserCommands > avgUserCommands * 3) {
        anomalyScore += 2;
      }
      
      // Anomalía si un comando se usa > 5x la media
      if (maxCommandUsage > avgCommandUsage * 5) {
        anomalyScore += 1;
      }
      
      // Anomalía si hay demasiados comandos en general (> 100 por hora)
      if (recentCommands.length > 100) {
        anomalyScore += 1;
      }
      
      return Math.min(anomalyScore, 5);
      
    } catch (error) {
      console.error('Error detecting command anomaly:', error);
      return 0;
    }
  }

  async detectSystemAnomaly() {
    try {
      // Importar systeminformation si está disponible
      const si = await import('systeminformation').catch(() => null);
      
      if (!si) return 0;
      
      const [cpu, mem, load] = await Promise.all([
        si.currentLoad(),
        si.mem(),
        si.currentLoad()
      ]);
      
      let anomalyScore = 0;
      
      // CPU usage > 90%
      if (cpu.currentLoad > 90) anomalyScore += 2;
      else if (cpu.currentLoad > 80) anomalyScore += 1;
      
      // Memory usage > 90%
      const memUsage = (mem.used / mem.total) * 100;
      if (memUsage > 90) anomalyScore += 2;
      else if (memUsage > 80) anomalyScore += 1;
      
      // Load average anomaly (si está disponible)
      if (load.avgLoad && load.avgLoad > 5) anomalyScore += 1;
      
      return Math.min(anomalyScore, 5);
      
    } catch (error) {
      console.error('Error detecting system anomaly:', error);
      return 0;
    }
  }
}

// Instancia singleton
const alertSystem = new AlertSystem();

export default alertSystem;