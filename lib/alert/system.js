import auditLogger, { AUDIT_EVENTS } from '../audit-logger.js';
import notificationSystem, { NOTIFICATION_TYPES, NOTIFICATION_CATEGORIES } from '../notification-system.js';
import { emitNotification } from '../socket-io.js';
import { ALERT_TYPES, ALERT_SEVERITIES, ALERT_STATES, ALERT_CONDITIONS } from './types.js';
import { AnomalyDetector } from './anomaly.js';
import { DEFAULT_RULES } from './rules.js';
import { collectMetrics } from './metrics.js';
import { executeActions, getSeverityLevel } from './executor.js';

class AlertSystem {
  constructor() {
    this.alerts = new Map(); // ID -> Alert
    this.rules = new Map(); // ID -> AlertRule
    this.activeAlerts = new Set(); // IDs de alertas activas
    this.suppressions = new Map(); // Supresiones temporales
    this.escalationPolicies = new Map(); // Políticas de escalamiento
    this.metrics = new Map(); // Métricas para análisis
    this.anomalyDetector = new AnomalyDetector();

    for (const ruleConfig of DEFAULT_RULES) {
      this.createRule(ruleConfig);
    }
    this.startMonitoring();
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
    const currentMetrics = await collectMetrics(this.metrics, this.anomalyDetector);

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
    await executeActions(rule.actions, rule, alert);

    // Log de auditoría
    await auditLogger.log(AUDIT_EVENTS.SECURITY_SUSPICIOUS_ACTIVITY, {
      level: getSeverityLevel(rule.severity),
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
      type: 'warning',
      title: `Alerta: ${rule.name}`,
      message: alert.message,
      category: 'alert',
      data: alert
    });

    return alert;
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

// Instancia singleton
const alertSystem = new AlertSystem();

export default alertSystem;
