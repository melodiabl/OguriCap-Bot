/**
 * Sistema de Alertas Inteligentes
 * Detecta anomalías y patrones en las métricas del sistema
 */

import EventEmitter from 'events'
import fs from 'fs'
import path from 'path'
import metricsSystem from './metrics-system.js'
import notificationSystem from './notification-system.js'
import auditLogger, { AUDIT_EVENTS, logSystemAction } from './audit-logger.js'

class IntelligentAlerts extends EventEmitter {
  constructor() {
    super()
    
    this.alertsDir = path.join(process.cwd(), '.monitoring', 'alerts')
    this.ensureDirectories()
    
    this.rules = new Map()
    this.history = new Map()
    this.suppressions = new Map()
    this.escalations = new Map()
    
    this.isRunning = false
    this.checkInterval = 30000 // 30 segundos
    
    this.setupDefaultRules()
    this.setupDefaultEscalations()
  }

  ensureDirectories() {
    if (!fs.existsSync(this.alertsDir)) {
      fs.mkdirSync(this.alertsDir, { recursive: true })
    }
  }

  setupDefaultRules() {
    // Alertas de sistema críticas
    this.addRule('system.cpu.critical', {
      metric: 'system.cpu',
      condition: 'threshold',
      threshold: 95,
      operator: 'gte',
      duration: 2 * 60 * 1000, // 2 minutos
      severity: 'critical',
      description: 'Uso crítico de CPU',
      actions: ['notify', 'log', 'escalate']
    })

    this.addRule('system.memory.critical', {
      metric: 'system.memory',
      condition: 'threshold',
      threshold: 90,
      operator: 'gte',
      duration: 5 * 60 * 1000, // 5 minutos
      severity: 'critical',
      description: 'Uso crítico de memoria',
      actions: ['notify', 'log', 'escalate']
    })

    this.addRule('system.disk.critical', {
      metric: 'system.disk',
      condition: 'threshold',
      threshold: 95,
      operator: 'gte',
      duration: 10 * 60 * 1000, // 10 minutos
      severity: 'critical',
      description: 'Espacio en disco crítico',
      actions: ['notify', 'log', 'escalate']
    })

    // Alertas de advertencia
    this.addRule('system.cpu.warning', {
      metric: 'system.cpu',
      condition: 'threshold',
      threshold: 80,
      operator: 'gte',
      duration: 5 * 60 * 1000,
      severity: 'warning',
      description: 'Uso alto de CPU',
      actions: ['notify', 'log']
    })

    this.addRule('system.memory.warning', {
      metric: 'system.memory',
      condition: 'threshold',
      threshold: 75,
      operator: 'gte',
      duration: 10 * 60 * 1000,
      severity: 'warning',
      description: 'Uso alto de memoria',
      actions: ['notify', 'log']
    })

    // Alertas del bot
    this.addRule('bot.disconnected', {
      metric: 'bot.connections',
      condition: 'custom',
      customCheck: (value) => value.mainBot === 0,
      duration: 30 * 1000, // 30 segundos
      severity: 'critical',
      description: 'Bot principal desconectado',
      actions: ['notify', 'log', 'escalate']
    })

    this.addRule('bot.subbots.low', {
      metric: 'bot.connections',
      condition: 'custom',
      customCheck: (value) => value.subbots < value.total * 0.5,
      duration: 2 * 60 * 1000,
      severity: 'warning',
      description: 'Muchos subbots desconectados',
      actions: ['notify', 'log']
    })

    // Alertas de rendimiento
    this.addRule('process.memory.leak', {
      metric: 'process.memory',
      condition: 'trend',
      trendType: 'increasing',
      trendThreshold: 0.1, // 10% de incremento
      duration: 30 * 60 * 1000, // 30 minutos
      severity: 'warning',
      description: 'Posible memory leak detectado',
      actions: ['notify', 'log']
    })

    this.addRule('process.eventloop.lag', {
      metric: 'process.eventloop',
      condition: 'threshold',
      threshold: 100, // 100ms de lag
      operator: 'gte',
      duration: 60 * 1000,
      severity: 'warning',
      description: 'Event loop lag alto',
      actions: ['notify', 'log']
    })

    // Alertas de seguridad
    this.addRule('security.failed.logins', {
      metric: 'app.requests',
      condition: 'rate',
      rateThreshold: 10, // 10 fallos por minuto
      timeWindow: 60 * 1000,
      severity: 'warning',
      description: 'Múltiples intentos de login fallidos',
      actions: ['notify', 'log', 'block']
    })

    // Alertas de anomalías
    this.addRule('system.anomaly.detection', {
      metric: '*',
      condition: 'anomaly',
      anomalyType: 'statistical',
      sensitivity: 0.95, // 95% de confianza
      duration: 5 * 60 * 1000,
      severity: 'info',
      description: 'Anomalía detectada en métricas',
      actions: ['log']
    })
  }

  setupDefaultEscalations() {
    // Escalación para alertas críticas
    this.addEscalation('critical', {
      levels: [
        { delay: 0, actions: ['notify.admin', 'log'] },
        { delay: 5 * 60 * 1000, actions: ['notify.admin', 'notify.email'] }, // 5 min
        { delay: 15 * 60 * 1000, actions: ['notify.admin', 'notify.email', 'notify.sms'] }, // 15 min
        { delay: 60 * 60 * 1000, actions: ['notify.all', 'create.incident'] } // 1 hora
      ],
      maxEscalations: 4,
      cooldown: 30 * 60 * 1000 // 30 minutos entre escalaciones
    })

    // Escalación para advertencias
    this.addEscalation('warning', {
      levels: [
        { delay: 0, actions: ['notify.admin', 'log'] },
        { delay: 30 * 60 * 1000, actions: ['notify.admin', 'notify.email'] } // 30 min
      ],
      maxEscalations: 2,
      cooldown: 60 * 60 * 1000 // 1 hora
    })
  }

  start() {
    if (this.isRunning) return
    
    this.isRunning = true
    console.log('🚨 Sistema de Alertas Inteligentes iniciado')
    
    // Suscribirse a métricas
    metricsSystem.on('metricStored', (metric) => {
      this.checkMetric(metric)
    })
    
    // Iniciar verificación periódica
    this.checkTimer = setInterval(() => {
      this.periodicCheck()
    }, this.checkInterval)
    
    // Cargar historial de alertas
    this.loadAlertHistory()
    
    this.emit('started')
  }

  stop() {
    if (!this.isRunning) return
    
    this.isRunning = false
    
    if (this.checkTimer) {
      clearInterval(this.checkTimer)
    }
    
    // Guardar historial
    this.saveAlertHistory()
    
    console.log('🚨 Sistema de Alertas Inteligentes detenido')
    this.emit('stopped')
  }

  async checkMetric(metric) {
    for (const [ruleName, rule] of this.rules) {
      if (this.matchesRule(metric, rule)) {
        await this.evaluateRule(ruleName, rule, metric)
      }
    }
  }

  matchesRule(metric, rule) {
    if (rule.metric === '*') return true
    if (rule.metric === metric.name) return true
    
    // Soporte para wildcards
    if (rule.metric.includes('*')) {
      const pattern = rule.metric.replace(/\*/g, '.*')
      const regex = new RegExp(`^${pattern}$`)
      return regex.test(metric.name)
    }
    
    return false
  }

  async evaluateRule(ruleName, rule, metric) {
    try {
      const shouldAlert = await this.checkCondition(rule, metric)
      
      if (shouldAlert) {
        await this.handleAlert(ruleName, rule, metric)
      } else {
        await this.handleResolution(ruleName, rule, metric)
      }
    } catch (error) {
      console.error(`Error evaluando regla ${ruleName}:`, error)
    }
  }

  async checkCondition(rule, metric) {
    switch (rule.condition) {
      case 'threshold':
        return this.checkThreshold(rule, metric)
      case 'trend':
        return this.checkTrend(rule, metric)
      case 'rate':
        return this.checkRate(rule, metric)
      case 'anomaly':
        return this.checkAnomaly(rule, metric)
      case 'custom':
        return this.checkCustom(rule, metric)
      default:
        return false
    }
  }

  checkThreshold(rule, metric) {
    const value = this.extractValue(metric.value, rule.valueKey)
    
    switch (rule.operator) {
      case 'gt': return value > rule.threshold
      case 'gte': return value >= rule.threshold
      case 'lt': return value < rule.threshold
      case 'lte': return value <= rule.threshold
      case 'eq': return value === rule.threshold
      case 'ne': return value !== rule.threshold
      default: return false
    }
  }

  checkTrend(rule, metric) {
    const history = metricsSystem.getMetrics(metric.name, rule.duration || 30 * 60 * 1000)
    if (history.length < 2) return false
    
    const values = history.map(m => this.extractValue(m.value, rule.valueKey))
    const trend = this.calculateTrend(values)
    
    switch (rule.trendType) {
      case 'increasing':
        return trend > (rule.trendThreshold || 0.05)
      case 'decreasing':
        return trend < -(rule.trendThreshold || 0.05)
      case 'stable':
        return Math.abs(trend) < (rule.trendThreshold || 0.02)
      default:
        return false
    }
  }

  checkRate(rule, metric) {
    const timeWindow = rule.timeWindow || 60 * 1000
    const history = metricsSystem.getMetrics(metric.name, timeWindow)
    
    const rate = history.length / (timeWindow / 1000) // eventos por segundo
    return rate > (rule.rateThreshold || 1)
  }

  checkAnomaly(rule, metric) {
    const history = metricsSystem.getMetrics(metric.name, 24 * 60 * 60 * 1000) // 24 horas
    if (history.length < 10) return false
    
    const values = history.map(m => this.extractValue(m.value, rule.valueKey))
    const currentValue = this.extractValue(metric.value, rule.valueKey)
    
    return this.detectAnomaly(values, currentValue, rule.sensitivity || 0.95)
  }

  checkCustom(rule, metric) {
    if (typeof rule.customCheck === 'function') {
      return rule.customCheck(metric.value, metric)
    }
    return false
  }

  extractValue(value, key = null) {
    if (typeof value === 'number') return value
    if (typeof value === 'object' && value !== null) {
      if (key && value[key] !== undefined) return value[key]
      
      // Buscar el primer valor numérico
      for (const v of Object.values(value)) {
        if (typeof v === 'number') return v
      }
    }
    return 0
  }

  calculateTrend(values) {
    if (values.length < 2) return 0
    
    const n = values.length
    const sumX = (n * (n - 1)) / 2
    const sumY = values.reduce((a, b) => a + b, 0)
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0)
    const sumX2 = values.reduce((sum, _, x) => sum + x * x, 0)
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX)
    return slope / (sumY / n) // Normalizar por el valor promedio
  }

  detectAnomaly(values, currentValue, sensitivity = 0.95) {
    if (values.length < 5) return false
    
    // Método estadístico simple: Z-score
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length
    const stdDev = Math.sqrt(variance)
    
    if (stdDev === 0) return false
    
    const zScore = Math.abs((currentValue - mean) / stdDev)
    const threshold = this.getZScoreThreshold(sensitivity)
    
    return zScore > threshold
  }

  getZScoreThreshold(sensitivity) {
    // Aproximación de thresholds para diferentes niveles de confianza
    const thresholds = {
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576,
      0.999: 3.291
    }
    
    return thresholds[sensitivity] || 2.0
  }

  async handleAlert(ruleName, rule, metric) {
    const alertKey = `${ruleName}:${metric.name}`
    const now = Date.now()
    
    // Verificar si ya está en estado de alerta
    const existing = this.history.get(alertKey)
    if (existing && existing.state === 'active') {
      // Actualizar última ocurrencia
      existing.lastOccurrence = now
      existing.occurrences++
      return
    }
    
    // Verificar duración si es requerida
    if (rule.duration) {
      if (!existing || existing.state !== 'pending') {
        // Iniciar período de espera
        this.history.set(alertKey, {
          ruleName,
          metric: metric.name,
          state: 'pending',
          firstOccurrence: now,
          lastOccurrence: now,
          occurrences: 1,
          rule
        })
        return
      }
      
      // Verificar si ha pasado suficiente tiempo
      if (now - existing.firstOccurrence < rule.duration) {
        existing.lastOccurrence = now
        existing.occurrences++
        return
      }
    }
    
    // Crear nueva alerta
    const alert = {
      id: this.generateAlertId(),
      ruleName,
      metric: metric.name,
      state: 'active',
      severity: rule.severity || 'warning',
      description: rule.description || 'Alerta del sistema',
      value: metric.value,
      threshold: rule.threshold,
      firstOccurrence: existing?.firstOccurrence || now,
      lastOccurrence: now,
      occurrences: existing?.occurrences || 1,
      rule,
      escalationLevel: 0,
      lastEscalation: 0
    }
    
    this.history.set(alertKey, alert)
    
    // Ejecutar acciones
    await this.executeActions(alert, rule.actions || [])
    
    // Iniciar escalación si es necesaria
    if (rule.actions?.includes('escalate')) {
      this.startEscalation(alert)
    }
    
    this.emit('alertTriggered', alert)
    
    // Log de auditoría
    await logSystemAction(AUDIT_EVENTS.SYSTEM_ALERT_TRIGGERED, {
      alertId: alert.id,
      ruleName,
      metric: metric.name,
      severity: alert.severity,
      value: metric.value
    })
  }

  async handleResolution(ruleName, rule, metric) {
    const alertKey = `${ruleName}:${metric.name}`
    const existing = this.history.get(alertKey)
    
    if (existing && existing.state === 'active') {
      existing.state = 'resolved'
      existing.resolvedAt = Date.now()
      existing.duration = existing.resolvedAt - existing.firstOccurrence
      
      // Ejecutar acciones de resolución
      await this.executeActions(existing, ['notify.resolution', 'log.resolution'])
      
      this.emit('alertResolved', existing)
      
      // Log de auditoría
      await logSystemAction(AUDIT_EVENTS.SYSTEM_ALERT_RESOLVED, {
        alertId: existing.id,
        ruleName,
        metric: metric.name,
        duration: existing.duration
      })
    }
  }

  async executeActions(alert, actions) {
    for (const action of actions) {
      try {
        await this.executeAction(alert, action)
      } catch (error) {
        console.error(`Error ejecutando acción ${action}:`, error)
      }
    }
  }

  async executeAction(alert, action) {
    switch (action) {
      case 'notify':
      case 'notify.admin':
        await this.sendNotification(alert, 'admin')
        break
        
      case 'notify.email':
        await this.sendEmailNotification(alert)
        break
        
      case 'notify.sms':
        await this.sendSMSNotification(alert)
        break
        
      case 'notify.all':
        await this.sendNotification(alert, 'all')
        break
        
      case 'notify.resolution':
        await this.sendResolutionNotification(alert)
        break
        
      case 'log':
        this.logAlert(alert)
        break
        
      case 'log.resolution':
        this.logResolution(alert)
        break
        
      case 'escalate':
        // La escalación se maneja por separado
        break
        
      case 'block':
        await this.executeBlockAction(alert)
        break
        
      case 'create.incident':
        await this.createIncident(alert)
        break
        
      default:
        console.warn(`Acción desconocida: ${action}`)
    }
  }

  async sendNotification(alert, target = 'admin') {
    const message = this.formatAlertMessage(alert)
    
    await notificationSystem.send({
      type: 'critical',
      severity: alert.severity,
      title: `🚨 ${alert.severity.toUpperCase()}: ${alert.description}`,
      message,
      data: {
        alertId: alert.id,
        ruleName: alert.ruleName,
        metric: alert.metric,
        value: alert.value,
        target
      }
    })
  }

  async sendEmailNotification(alert) {
    // Se podría implementar envío de email específico para alertas
    console.log(`📧 Email notification for alert ${alert.id}`)
  }

  async sendSMSNotification(alert) {
    // Se podría implementar envío de SMS para alertas críticas
    console.log(`📱 SMS notification for alert ${alert.id}`)
  }

  async sendResolutionNotification(alert) {
    const message = `✅ Alerta resuelta: ${alert.description}\nDuración: ${Math.floor(alert.duration / 1000)}s`
    
    await notificationSystem.send({
      type: 'resolution',
      severity: 'info',
      title: '✅ Alerta Resuelta',
      message,
      data: {
        alertId: alert.id,
        duration: alert.duration
      }
    })
  }

  logAlert(alert) {
    console.log(`🚨 ALERT [${alert.severity.toUpperCase()}] ${alert.description} - ${alert.metric}: ${JSON.stringify(alert.value)}`)
  }

  logResolution(alert) {
    console.log(`✅ RESOLVED [${alert.id}] ${alert.description} - Duration: ${Math.floor(alert.duration / 1000)}s`)
  }

  async executeBlockAction(alert) {
    // Se podría implementar bloqueo automático de IPs sospechosas
    console.log(`🚫 Block action for alert ${alert.id}`)
  }

  async createIncident(alert) {
    // Se podría implementar creación de incidentes en sistemas externos
    console.log(`📋 Incident created for alert ${alert.id}`)
  }

  formatAlertMessage(alert) {
    const lines = [
      `📊 Métrica: ${alert.metric}`,
      `📈 Valor: ${JSON.stringify(alert.value)}`,
      `⏰ Tiempo: ${new Date(alert.lastOccurrence).toLocaleString()}`,
      `🔢 Ocurrencias: ${alert.occurrences}`
    ]
    
    if (alert.threshold !== undefined) {
      lines.push(`🎯 Umbral: ${alert.threshold}`)
    }
    
    return lines.join('\n')
  }

  startEscalation(alert) {
    const escalation = this.escalations.get(alert.severity)
    if (!escalation) return
    
    alert.escalationTimer = setTimeout(() => {
      this.processEscalation(alert, escalation)
    }, escalation.levels[0]?.delay || 0)
  }

  async processEscalation(alert, escalation) {
    if (alert.state !== 'active') return
    if (alert.escalationLevel >= escalation.maxEscalations) return
    
    const level = escalation.levels[alert.escalationLevel]
    if (!level) return
    
    // Verificar cooldown
    const now = Date.now()
    if (now - alert.lastEscalation < escalation.cooldown) return
    
    // Ejecutar acciones de escalación
    await this.executeActions(alert, level.actions)
    
    alert.escalationLevel++
    alert.lastEscalation = now
    
    this.emit('alertEscalated', alert)
    
    // Programar siguiente escalación
    const nextLevel = escalation.levels[alert.escalationLevel]
    if (nextLevel && alert.escalationLevel < escalation.maxEscalations) {
      alert.escalationTimer = setTimeout(() => {
        this.processEscalation(alert, escalation)
      }, nextLevel.delay)
    }
  }

  periodicCheck() {
    // Verificar alertas que necesitan escalación
    for (const alert of this.history.values()) {
      if (alert.state === 'active' && alert.escalationTimer) {
        // Las escalaciones se manejan con timers
      }
    }
    
    // Limpiar alertas resueltas antiguas
    this.cleanupOldAlerts()
  }

  cleanupOldAlerts() {
    const cutoff = Date.now() - (7 * 24 * 60 * 60 * 1000) // 7 días
    
    for (const [key, alert] of this.history) {
      if (alert.state === 'resolved' && alert.resolvedAt < cutoff) {
        this.history.delete(key)
      }
    }
  }

  // Gestión de reglas
  addRule(name, rule) {
    this.rules.set(name, {
      ...rule,
      createdAt: Date.now(),
      enabled: true
    })
  }

  removeRule(name) {
    this.rules.delete(name)
  }

  updateRule(name, updates) {
    const existing = this.rules.get(name)
    if (existing) {
      this.rules.set(name, { ...existing, ...updates })
    }
  }

  enableRule(name) {
    const rule = this.rules.get(name)
    if (rule) {
      rule.enabled = true
    }
  }

  disableRule(name) {
    const rule = this.rules.get(name)
    if (rule) {
      rule.enabled = false
    }
  }

  // Gestión de escalaciones
  addEscalation(severity, config) {
    this.escalations.set(severity, config)
  }

  // Gestión de supresiones
  suppressAlert(ruleName, duration = 60 * 60 * 1000) {
    this.suppressions.set(ruleName, {
      until: Date.now() + duration,
      reason: 'Manual suppression'
    })
  }

  unsuppressAlert(ruleName) {
    this.suppressions.delete(ruleName)
  }

  isAlertSuppressed(ruleName) {
    const suppression = this.suppressions.get(ruleName)
    if (!suppression) return false
    
    if (Date.now() > suppression.until) {
      this.suppressions.delete(ruleName)
      return false
    }
    
    return true
  }

  // Utilidades
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  // Persistencia
  saveAlertHistory() {
    try {
      const data = {
        history: Array.from(this.history.entries()),
        suppressions: Array.from(this.suppressions.entries()),
        timestamp: Date.now()
      }
      
      const filepath = path.join(this.alertsDir, 'alert-history.json')
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
    } catch (error) {
      console.error('Error guardando historial de alertas:', error)
    }
  }

  loadAlertHistory() {
    try {
      const filepath = path.join(this.alertsDir, 'alert-history.json')
      if (!fs.existsSync(filepath)) return
      
      const data = JSON.parse(fs.readFileSync(filepath, 'utf8'))
      
      if (data.history) {
        this.history = new Map(data.history)
      }
      
      if (data.suppressions) {
        this.suppressions = new Map(data.suppressions)
      }
    } catch (error) {
      console.error('Error cargando historial de alertas:', error)
    }
  }

  // Consultas
  getActiveAlerts() {
    return Array.from(this.history.values()).filter(alert => alert.state === 'active')
  }

  getAlertHistory(limit = 100) {
    return Array.from(this.history.values())
      .sort((a, b) => b.lastOccurrence - a.lastOccurrence)
      .slice(0, limit)
  }

  getAlertsByMetric(metricName) {
    return Array.from(this.history.values()).filter(alert => alert.metric === metricName)
  }

  getAlertsBySeverity(severity) {
    return Array.from(this.history.values()).filter(alert => alert.severity === severity)
  }

  getRules() {
    return Array.from(this.rules.entries()).map(([name, rule]) => ({ name, ...rule }))
  }

  getRule(name) {
    return this.rules.get(name)
  }

  // Estado del sistema
  getStatus() {
    const activeAlerts = this.getActiveAlerts()
    
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      totalRules: this.rules.size,
      enabledRules: Array.from(this.rules.values()).filter(r => r.enabled).length,
      totalAlerts: this.history.size,
      activeAlerts: activeAlerts.length,
      criticalAlerts: activeAlerts.filter(a => a.severity === 'critical').length,
      warningAlerts: activeAlerts.filter(a => a.severity === 'warning').length,
      suppressions: this.suppressions.size,
      escalations: this.escalations.size
    }
  }

  // Estadísticas
  getStatistics(timeRange = 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - timeRange
    const recentAlerts = Array.from(this.history.values())
      .filter(alert => alert.firstOccurrence > cutoff)
    
    const stats = {
      totalAlerts: recentAlerts.length,
      bySeverity: {},
      byMetric: {},
      byRule: {},
      avgDuration: 0,
      resolutionRate: 0
    }
    
    // Estadísticas por severidad
    recentAlerts.forEach(alert => {
      stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] || 0) + 1
      stats.byMetric[alert.metric] = (stats.byMetric[alert.metric] || 0) + 1
      stats.byRule[alert.ruleName] = (stats.byRule[alert.ruleName] || 0) + 1
    })
    
    // Duración promedio y tasa de resolución
    const resolvedAlerts = recentAlerts.filter(a => a.state === 'resolved')
    if (resolvedAlerts.length > 0) {
      stats.avgDuration = resolvedAlerts.reduce((sum, a) => sum + (a.duration || 0), 0) / resolvedAlerts.length
      stats.resolutionRate = (resolvedAlerts.length / recentAlerts.length) * 100
    }
    
    return stats
  }
}

// Instancia singleton
const intelligentAlerts = new IntelligentAlerts()

export default intelligentAlerts