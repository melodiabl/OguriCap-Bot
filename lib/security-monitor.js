// Sistema de Monitoreo de Seguridad Avanzado

import { EventEmitter } from 'events'
import crypto from 'crypto'
import auditLogger, { AUDIT_EVENTS } from './audit-logger.js'
import alertSystem from './alert-system.js'
import notificationSystem, { NOTIFICATION_TYPES, NOTIFICATION_CATEGORIES } from './notification-system.js'

// Tipos de amenazas
export const THREAT_TYPES = {
  BRUTE_FORCE: 'brute_force',
  SQL_INJECTION: 'sql_injection',
  XSS_ATTEMPT: 'xss_attempt',
  PATH_TRAVERSAL: 'path_traversal',
  MALICIOUS_BOT: 'malicious_bot',
  SUSPICIOUS_ACTIVITY: 'suspicious_activity',
  RATE_LIMIT_EXCEEDED: 'rate_limit_exceeded',
  UNAUTHORIZED_ACCESS: 'unauthorized_access',
  DATA_EXFILTRATION: 'data_exfiltration',
  PRIVILEGE_ESCALATION: 'privilege_escalation'
}

// Niveles de riesgo
export const RISK_LEVELS = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
  EMERGENCY: 5
}

// Estados de incidentes
export const INCIDENT_STATES = {
  DETECTED: 'detected',
  INVESTIGATING: 'investigating',
  CONFIRMED: 'confirmed',
  MITIGATED: 'mitigated',
  RESOLVED: 'resolved',
  FALSE_POSITIVE: 'false_positive'
}

class SecurityMonitor extends EventEmitter {
  constructor() {
    super()
    this.threats = new Map() // ID -> Threat
    this.incidents = new Map() // ID -> Incident
    this.blockedIPs = new Set()
    this.suspiciousIPs = new Map() // IP -> SuspiciousActivity
    this.securityRules = new Map() // ID -> SecurityRule
    this.whitelist = new Set()
    this.blacklist = new Set()
    this.geoBlocking = new Map() // Country -> blocked
    this.honeypots = new Map() // Path -> HoneyPot
    
    this.metrics = {
      threatsDetected: 0,
      incidentsCreated: 0,
      ipsBlocked: 0,
      attacksBlocked: 0,
      falsePositives: 0
    }
    
    this.initializeSecurityRules()
    this.startMonitoring()
  }

  /**
   * Inicializar reglas de seguridad por defecto
   */
  initializeSecurityRules() {
    // Regla: Detección de fuerza bruta
    this.createSecurityRule({
      name: 'Detección de Fuerza Bruta',
      description: 'Detecta intentos de fuerza bruta en login',
      type: THREAT_TYPES.BRUTE_FORCE,
      pattern: /login.*failed/i,
      threshold: 5,
      timeWindow: 300000, // 5 minutos
      riskLevel: RISK_LEVELS.HIGH,
      autoBlock: true,
      blockDuration: 3600000, // 1 hora
      enabled: true
    })

    // Regla: Detección de SQL Injection
    this.createSecurityRule({
      name: 'Detección de SQL Injection',
      description: 'Detecta intentos de inyección SQL',
      type: THREAT_TYPES.SQL_INJECTION,
      pattern: /(union\s+select|drop\s+table|insert\s+into|delete\s+from|'.*or.*'|1=1)/i,
      threshold: 1,
      timeWindow: 60000,
      riskLevel: RISK_LEVELS.CRITICAL,
      autoBlock: true,
      blockDuration: 7200000, // 2 horas
      enabled: true
    })

    // Regla: Detección de XSS
    this.createSecurityRule({
      name: 'Detección de XSS',
      description: 'Detecta intentos de Cross-Site Scripting',
      type: THREAT_TYPES.XSS_ATTEMPT,
      pattern: /(<script|javascript:|onerror=|onload=|<iframe)/i,
      threshold: 1,
      timeWindow: 60000,
      riskLevel: RISK_LEVELS.HIGH,
      autoBlock: true,
      blockDuration: 1800000, // 30 minutos
      enabled: true
    })

    // Regla: Detección de Path Traversal
    this.createSecurityRule({
      name: 'Detección de Path Traversal',
      description: 'Detecta intentos de traversal de directorios',
      type: THREAT_TYPES.PATH_TRAVERSAL,
      pattern: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c)/i,
      threshold: 1,
      timeWindow: 60000,
      riskLevel: RISK_LEVELS.HIGH,
      autoBlock: true,
      blockDuration: 3600000,
      enabled: true
    })

    // Regla: Detección de bots maliciosos
    this.createSecurityRule({
      name: 'Detección de Bots Maliciosos',
      description: 'Detecta user agents de herramientas de hacking',
      type: THREAT_TYPES.MALICIOUS_BOT,
      pattern: /(sqlmap|nikto|nmap|masscan|zap|burp|acunetix|nessus|openvas|w3af|skipfish)/i,
      threshold: 1,
      timeWindow: 60000,
      riskLevel: RISK_LEVELS.CRITICAL,
      autoBlock: true,
      blockDuration: 86400000, // 24 horas
      enabled: true
    })

    // Regla: Actividad sospechosa general
    this.createSecurityRule({
      name: 'Actividad Sospechosa',
      description: 'Detecta patrones de actividad sospechosa',
      type: THREAT_TYPES.SUSPICIOUS_ACTIVITY,
      pattern: null, // Se evalúa por comportamiento
      threshold: 10,
      timeWindow: 600000, // 10 minutos
      riskLevel: RISK_LEVELS.MEDIUM,
      autoBlock: false,
      blockDuration: 0,
      enabled: true
    })
  }

  /**
   * Crear regla de seguridad
   */
  createSecurityRule(config) {
    const rule = {
      id: this.generateId(),
      name: config.name,
      description: config.description,
      type: config.type,
      pattern: config.pattern,
      threshold: config.threshold || 1,
      timeWindow: config.timeWindow || 300000,
      riskLevel: config.riskLevel || RISK_LEVELS.MEDIUM,
      autoBlock: config.autoBlock || false,
      blockDuration: config.blockDuration || 3600000,
      enabled: config.enabled !== false,
      createdAt: new Date().toISOString(),
      lastTriggered: null,
      triggerCount: 0,
      falsePositiveCount: 0
    }

    this.securityRules.set(rule.id, rule)
    return rule
  }

  /**
   * Analizar request para amenazas
   */
  async analyzeRequest(req, url, additionalData = {}) {
    const clientIP = this.getClientIP(req)
    const userAgent = req.headers['user-agent'] || ''
    const referer = req.headers.referer || ''
    const requestPath = url?.pathname || req.url || ''
    const method = req.method || 'GET'
    
    // Verificar si la IP está en blacklist
    if (this.blacklist.has(clientIP)) {
      await this.createThreat({
        type: THREAT_TYPES.UNAUTHORIZED_ACCESS,
        clientIP,
        riskLevel: RISK_LEVELS.HIGH,
        description: 'Acceso desde IP en blacklist',
        details: { userAgent, referer, requestPath, method }
      })
      return { blocked: true, reason: 'IP in blacklist' }
    }

    // Verificar si la IP está bloqueada
    if (this.blockedIPs.has(clientIP)) {
      return { blocked: true, reason: 'IP blocked' }
    }

    // Verificar whitelist
    if (this.whitelist.has(clientIP)) {
      return { blocked: false, whitelisted: true }
    }

    const requestData = {
      clientIP,
      userAgent,
      referer,
      requestPath,
      method,
      timestamp: new Date().toISOString(),
      ...additionalData
    }

    // Evaluar reglas de seguridad
    for (const [ruleId, rule] of this.securityRules) {
      if (!rule.enabled) continue

      try {
        const threatDetected = await this.evaluateSecurityRule(rule, requestData)
        if (threatDetected) {
          const threat = await this.createThreat({
            type: rule.type,
            clientIP,
            riskLevel: rule.riskLevel,
            description: `${rule.name}: ${rule.description}`,
            ruleId,
            details: requestData
          })

          // Auto-bloqueo si está configurado
          if (rule.autoBlock) {
            await this.blockIP(clientIP, rule.blockDuration, `Auto-blocked by rule: ${rule.name}`)
            return { blocked: true, reason: 'Auto-blocked by security rule', threatId: threat.id }
          }

          return { blocked: false, threatDetected: true, threatId: threat.id }
        }
      } catch (error) {
        console.error(`Error evaluating security rule ${rule.name}:`, error)
      }
    }

    // Actualizar actividad sospechosa
    await this.updateSuspiciousActivity(clientIP, requestData)

    return { blocked: false }
  }

  /**
   * Evaluar regla de seguridad
   */
  async evaluateSecurityRule(rule, requestData) {
    const { clientIP, userAgent, requestPath, method } = requestData

    // Evaluación por patrón
    if (rule.pattern) {
      const testStrings = [userAgent, requestPath, method].filter(Boolean)
      for (const testString of testStrings) {
        if (rule.pattern.test(testString)) {
          return await this.checkThreshold(rule, clientIP)
        }
      }
    }

    // Evaluación por comportamiento (para actividad sospechosa)
    if (rule.type === THREAT_TYPES.SUSPICIOUS_ACTIVITY) {
      return await this.evaluateSuspiciousBehavior(rule, clientIP)
    }

    return false
  }

  /**
   * Verificar umbral de la regla
   */
  async checkThreshold(rule, clientIP) {
    const key = `${rule.id}:${clientIP}`
    const now = Date.now()
    
    // Obtener historial de activaciones
    if (!this.ruleActivations) {
      this.ruleActivations = new Map()
    }
    
    if (!this.ruleActivations.has(key)) {
      this.ruleActivations.set(key, [])
    }
    
    const activations = this.ruleActivations.get(key)
    
    // Limpiar activaciones fuera de la ventana de tiempo
    const cutoff = now - rule.timeWindow
    const recentActivations = activations.filter(time => time > cutoff)
    
    // Añadir activación actual
    recentActivations.push(now)
    this.ruleActivations.set(key, recentActivations)
    
    // Verificar si se supera el umbral
    if (recentActivations.length >= rule.threshold) {
      rule.lastTriggered = new Date().toISOString()
      rule.triggerCount++
      return true
    }
    
    return false
  }

  /**
   * Evaluar comportamiento sospechoso
   */
  async evaluateSuspiciousBehavior(rule, clientIP) {
    const suspicious = this.suspiciousIPs.get(clientIP)
    if (!suspicious) return false

    const now = Date.now()
    const recentActivity = suspicious.activities.filter(
      activity => now - activity.timestamp < rule.timeWindow
    )

    // Criterios de sospecha:
    // - Muchas requests en poco tiempo
    // - Múltiples user agents diferentes
    // - Acceso a rutas sensibles
    // - Patrones de escaneo

    const requestCount = recentActivity.length
    const uniqueUserAgents = new Set(recentActivity.map(a => a.userAgent)).size
    const sensitiveRoutes = recentActivity.filter(a => 
      a.requestPath.includes('admin') || 
      a.requestPath.includes('api') ||
      a.requestPath.includes('config')
    ).length

    const suspicionScore = requestCount + (uniqueUserAgents * 2) + (sensitiveRoutes * 3)

    return suspicionScore >= rule.threshold
  }

  /**
   * Crear amenaza
   */
  async createThreat(config) {
    const threat = {
      id: this.generateId(),
      type: config.type,
      clientIP: config.clientIP,
      riskLevel: config.riskLevel,
      description: config.description,
      ruleId: config.ruleId || null,
      details: config.details || {},
      detectedAt: new Date().toISOString(),
      status: 'active',
      mitigated: false,
      falsePositive: false
    }

    this.threats.set(threat.id, threat)
    this.metrics.threatsDetected++

    // Crear incidente si el riesgo es alto
    if (threat.riskLevel >= RISK_LEVELS.HIGH) {
      await this.createIncident(threat)
    }

    // Log de auditoría
    await auditLogger.log(AUDIT_EVENTS.SECURITY_THREAT_DETECTED, {
      level: this.getRiskLevelString(threat.riskLevel),
      details: {
        threatId: threat.id,
        type: threat.type,
        clientIP: threat.clientIP,
        riskLevel: threat.riskLevel,
        description: threat.description
      }
    })

    // Crear alerta
    await alertSystem.triggerAlert({
      name: `Amenaza de Seguridad: ${threat.type}`,
      type: 'security',
      severity: threat.riskLevel,
      message: `${threat.description} desde IP ${threat.clientIP}`,
      details: threat
    })

    // Emitir evento
    this.emit('threatDetected', threat)

    return threat
  }

  /**
   * Crear incidente de seguridad
   */
  async createIncident(threat) {
    const incident = {
      id: this.generateId(),
      threatId: threat.id,
      title: `${threat.type} desde ${threat.clientIP}`,
      description: threat.description,
      riskLevel: threat.riskLevel,
      state: INCIDENT_STATES.DETECTED,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      assignedTo: null,
      timeline: [
        {
          timestamp: new Date().toISOString(),
          action: 'incident_created',
          description: 'Incidente creado automáticamente',
          user: 'system'
        }
      ],
      evidence: [threat.details],
      mitigation: null,
      resolution: null
    }

    this.incidents.set(incident.id, incident)
    this.metrics.incidentsCreated++

    // Notificación crítica
    if (incident.riskLevel >= RISK_LEVELS.CRITICAL) {
      await notificationSystem.send({
        type: NOTIFICATION_TYPES.CRITICAL,
        title: '🚨 Incidente de Seguridad Crítico',
        message: `${incident.title} - Requiere atención inmediata`,
        category: NOTIFICATION_CATEGORIES.SECURITY,
        data: incident
      })
    }

    // Log de auditoría
    await auditLogger.log(AUDIT_EVENTS.SECURITY_INCIDENT_CREATED, {
      level: 'critical',
      details: {
        incidentId: incident.id,
        threatId: threat.id,
        riskLevel: incident.riskLevel,
        title: incident.title
      }
    })

    return incident
  }

  /**
   * Bloquear IP
   */
  async blockIP(ip, duration = 3600000, reason = 'Security violation') {
    this.blockedIPs.add(ip)
    this.metrics.ipsBlocked++

    // Programar desbloqueo
    if (duration > 0) {
      setTimeout(() => {
        this.blockedIPs.delete(ip)
        console.log(`[Security Monitor] IP ${ip} unblocked after ${duration}ms`)
      }, duration)
    }

    // Log de auditoría
    await auditLogger.log(AUDIT_EVENTS.SECURITY_IP_BLOCKED, {
      level: 'warning',
      details: {
        ip,
        reason,
        duration,
        permanent: duration === 0
      }
    })

    console.log(`[Security Monitor] Blocked IP: ${ip} for ${duration}ms - Reason: ${reason}`)
  }

  /**
   * Actualizar actividad sospechosa
   */
  async updateSuspiciousActivity(clientIP, requestData) {
    if (!this.suspiciousIPs.has(clientIP)) {
      this.suspiciousIPs.set(clientIP, {
        ip: clientIP,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        requestCount: 0,
        activities: [],
        riskScore: 0
      })
    }

    const suspicious = this.suspiciousIPs.get(clientIP)
    suspicious.lastSeen = new Date().toISOString()
    suspicious.requestCount++
    suspicious.activities.push({
      timestamp: Date.now(),
      ...requestData
    })

    // Mantener solo las últimas 100 actividades
    if (suspicious.activities.length > 100) {
      suspicious.activities = suspicious.activities.slice(-100)
    }

    // Calcular score de riesgo
    suspicious.riskScore = this.calculateRiskScore(suspicious)
  }

  /**
   * Calcular score de riesgo
   */
  calculateRiskScore(suspicious) {
    const now = Date.now()
    const oneHour = 60 * 60 * 1000
    
    const recentActivities = suspicious.activities.filter(
      activity => now - activity.timestamp < oneHour
    )

    let score = 0
    
    // Frecuencia de requests
    score += Math.min(recentActivities.length / 10, 5)
    
    // Diversidad de user agents
    const uniqueUserAgents = new Set(recentActivities.map(a => a.userAgent)).size
    if (uniqueUserAgents > 3) score += 2
    
    // Acceso a rutas sensibles
    const sensitiveAccess = recentActivities.filter(a => 
      a.requestPath.includes('admin') || 
      a.requestPath.includes('api') ||
      a.requestPath.includes('config') ||
      a.requestPath.includes('login')
    ).length
    score += sensitiveAccess * 0.5
    
    // Métodos HTTP sospechosos
    const suspiciousMethods = recentActivities.filter(a => 
      ['PUT', 'DELETE', 'PATCH'].includes(a.method)
    ).length
    score += suspiciousMethods * 0.3

    return Math.min(score, 10) // Máximo 10
  }

  /**
   * Obtener estadísticas de seguridad
   */
  getSecurityStats() {
    const now = Date.now()
    const oneHour = 60 * 60 * 1000
    const oneDay = 24 * oneHour

    const recentThreats = Array.from(this.threats.values()).filter(
      threat => now - new Date(threat.detectedAt).getTime() < oneDay
    )

    const activeIncidents = Array.from(this.incidents.values()).filter(
      incident => ![INCIDENT_STATES.RESOLVED, INCIDENT_STATES.FALSE_POSITIVE].includes(incident.state)
    )

    return {
      ...this.metrics,
      blockedIPsCount: this.blockedIPs.size,
      suspiciousIPsCount: this.suspiciousIPs.size,
      activeIncidents: activeIncidents.length,
      recentThreats: recentThreats.length,
      threatsByType: this.getThreatsByType(recentThreats),
      riskDistribution: this.getRiskDistribution(recentThreats),
      topThreateningIPs: this.getTopThreateningIPs(),
      securityRulesCount: this.securityRules.size,
      whitelistCount: this.whitelist.size,
      blacklistCount: this.blacklist.size
    }
  }

  /**
   * Obtener amenazas por tipo
   */
  getThreatsByType(threats) {
    const byType = {}
    for (const threat of threats) {
      byType[threat.type] = (byType[threat.type] || 0) + 1
    }
    return byType
  }

  /**
   * Obtener distribución de riesgo
   */
  getRiskDistribution(threats) {
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
    for (const threat of threats) {
      distribution[threat.riskLevel]++
    }
    return distribution
  }

  /**
   * Obtener IPs más amenazantes
   */
  getTopThreateningIPs() {
    const ipCounts = {}
    
    for (const threat of this.threats.values()) {
      const ip = threat.clientIP
      if (!ipCounts[ip]) {
        ipCounts[ip] = { ip, count: 0, maxRisk: 0, types: new Set() }
      }
      ipCounts[ip].count++
      ipCounts[ip].maxRisk = Math.max(ipCounts[ip].maxRisk, threat.riskLevel)
      ipCounts[ip].types.add(threat.type)
    }

    return Object.values(ipCounts)
      .map(item => ({
        ...item,
        types: Array.from(item.types)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }

  /**
   * Utilidades
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2)
  }

  getClientIP(req) {
    return req.headers['cf-connecting-ip'] ||
           req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.headers['x-real-ip'] ||
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           'unknown'
  }

  getRiskLevelString(level) {
    const levels = {
      [RISK_LEVELS.LOW]: 'low',
      [RISK_LEVELS.MEDIUM]: 'medium', 
      [RISK_LEVELS.HIGH]: 'high',
      [RISK_LEVELS.CRITICAL]: 'critical',
      [RISK_LEVELS.EMERGENCY]: 'emergency'
    }
    return levels[level] || 'unknown'
  }

  /**
   * Iniciar monitoreo
   */
  startMonitoring() {
    // Limpiar amenazas antiguas cada hora
    setInterval(() => {
      this.cleanupOldThreats()
    }, 60 * 60 * 1000)

    // Limpiar actividades sospechosas cada 6 horas
    setInterval(() => {
      this.cleanupSuspiciousActivities()
    }, 6 * 60 * 60 * 1000)

    console.log('[Security Monitor] Monitoring started')
  }

  cleanupOldThreats() {
    const oneWeek = 7 * 24 * 60 * 60 * 1000
    const cutoff = Date.now() - oneWeek

    for (const [id, threat] of this.threats) {
      if (new Date(threat.detectedAt).getTime() < cutoff) {
        this.threats.delete(id)
      }
    }
  }

  cleanupSuspiciousActivities() {
    const oneDay = 24 * 60 * 60 * 1000
    const cutoff = Date.now() - oneDay

    for (const [ip, suspicious] of this.suspiciousIPs) {
      suspicious.activities = suspicious.activities.filter(
        activity => activity.timestamp > cutoff
      )
      
      if (suspicious.activities.length === 0) {
        this.suspiciousIPs.delete(ip)
      }
    }
  }

  // Métodos públicos para gestión
  getAllThreats() {
    return Array.from(this.threats.values())
  }

  getAllIncidents() {
    return Array.from(this.incidents.values())
  }

  getSecurityRules() {
    return Array.from(this.securityRules.values())
  }

  getSuspiciousIPs() {
    return Array.from(this.suspiciousIPs.values())
  }

  getBlockedIPs() {
    return Array.from(this.blockedIPs)
  }
}

// Instancia singleton
const securityMonitor = new SecurityMonitor()

export default securityMonitor