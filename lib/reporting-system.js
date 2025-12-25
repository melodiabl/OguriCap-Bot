/**
 * Sistema de Reportes Automáticos Avanzado
 * Genera reportes detallados del sistema, bot y usuarios
 */

import fs from 'fs'
import path from 'path'
import os from 'os'
import { execSync } from 'child_process'
import resourceMonitor from './resource-monitor.js'
import auditLogger from './audit-logger.js'
import notificationSystem from './notification-system.js'

class ReportingSystem {
  constructor() {
    this.reportsDir = path.join(process.cwd(), '.monitoring', 'reports')
    this.templatesDir = path.join(process.cwd(), '.monitoring', 'templates')
    this.ensureDirectories()
    
    this.reportTypes = {
      daily: { interval: 24 * 60 * 60 * 1000, enabled: true },
      weekly: { interval: 7 * 24 * 60 * 60 * 1000, enabled: true },
      monthly: { interval: 30 * 24 * 60 * 60 * 1000, enabled: false }, // Deshabilitado según config
      performance: { interval: 60 * 60 * 1000, enabled: true }, // Cada hora
      security: { interval: 6 * 60 * 60 * 1000, enabled: true }, // Cada 6 horas
      custom: { interval: null, enabled: true }
    }
    
    this.scheduledReports = new Map()
    this.isRunning = false
  }

  ensureDirectories() {
    const dirs = [this.reportsDir, this.templatesDir]
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    })
  }

  start() {
    if (this.isRunning) return
    this.isRunning = true
    
    console.log('📊 Sistema de Reportes iniciado')
    
    // Programar reportes automáticos
    this.scheduleReports()
    
    // Generar reporte inicial
    this.generateDailyReport().catch(console.error)
  }

  stop() {
    this.isRunning = false
    
    // Limpiar timers
    for (const [type, timer] of this.scheduledReports) {
      clearInterval(timer)
    }
    this.scheduledReports.clear()
    
    console.log('📊 Sistema de Reportes detenido')
  }

  scheduleReports() {
    Object.entries(this.reportTypes).forEach(([type, config]) => {
      if (!config.enabled || !config.interval) return
      
      const timer = setInterval(() => {
        this.generateReport(type).catch(console.error)
      }, config.interval)
      
      this.scheduledReports.set(type, timer)
    })
  }

  async generateReport(type = 'daily', options = {}) {
    try {
      const reportData = await this.collectReportData(type, options)
      const report = await this.formatReport(type, reportData, options)
      const filePath = await this.saveReport(type, report, options)
      
      // Enviar notificación si es necesario
      if (options.notify !== false) {
        await this.notifyReportGenerated(type, report, filePath)
      }
      
      return { success: true, filePath, report }
    } catch (error) {
      console.error(`Error generando reporte ${type}:`, error)
      return { success: false, error: error.message }
    }
  }

  async collectReportData(type, options = {}) {
    const now = new Date()
    const data = {
      metadata: {
        type,
        generatedAt: now.toISOString(),
        generatedBy: 'ReportingSystem',
        version: '1.0.0',
        hostname: os.hostname(),
        platform: os.platform(),
        nodeVersion: process.version
      }
    }

    // Datos del sistema
    data.system = await this.collectSystemData(type, options)
    
    // Datos del bot
    data.bot = await this.collectBotData(type, options)
    
    // Datos de usuarios
    data.users = await this.collectUserData(type, options)
    
    // Datos de grupos
    data.groups = await this.collectGroupData(type, options)
    
    // Datos de rendimiento
    data.performance = await this.collectPerformanceData(type, options)
    
    // Datos de seguridad
    data.security = await this.collectSecurityData(type, options)
    
    // Datos de errores
    data.errors = await this.collectErrorData(type, options)

    return data
  }

  async collectSystemData(type, options) {
    const stats = resourceMonitor.getStats()
    const history = resourceMonitor.getHistoricalData()
    
    // Calcular período según tipo de reporte
    const periods = {
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000,
      monthly: 30 * 24 * 60 * 60 * 1000,
      performance: 60 * 60 * 1000,
      security: 6 * 60 * 60 * 1000
    }
    
    const period = periods[type] || periods.daily
    const cutoff = Date.now() - period
    const periodData = history.filter(d => d.timestamp > cutoff)

    return {
      current: stats,
      period: {
        duration: period,
        dataPoints: periodData.length,
        cpu: this.calculateStats(periodData.map(d => d.cpu)),
        memory: this.calculateStats(periodData.map(d => d.memory)),
        disk: this.calculateStats(periodData.map(d => d.disk)),
        network: this.calculateStats(periodData.map(d => d.network || 0))
      },
      uptime: process.uptime(),
      loadAverage: os.loadavg(),
      freeMemory: os.freemem(),
      totalMemory: os.totalmem(),
      cpuCount: os.cpus().length
    }
  }

  async collectBotData(type, options) {
    const db = global.db?.data
    if (!db) return { available: false }

    const botData = {
      status: global.stopped || 'unknown',
      connected: global.stopped === 'open',
      phone: global.conn?.user?.id || null,
      uptime: process.uptime(),
      
      // Estadísticas de mensajes
      messages: {
        total: 0, // Se podría implementar contador
        today: 0,
        errors: 0
      },
      
      // Subbots
      subbots: {
        total: Object.keys(db.panel?.subbots || {}).length,
        online: (global.conns || []).filter(c => c?.user).length,
        offline: 0
      },
      
      // Comandos más usados (se podría implementar)
      commands: {
        total: 0,
        mostUsed: []
      }
    }

    botData.subbots.offline = botData.subbots.total - botData.subbots.online

    return botData
  }

  async collectUserData(type, options) {
    const db = global.db?.data
    if (!db) return { available: false }

    const users = db.users || {}
    const totalUsers = Object.keys(users).length
    
    const userData = {
      total: totalUsers,
      active: Object.values(users).filter(u => !u.banned).length,
      banned: Object.values(users).filter(u => u.banned).length,
      premium: Object.values(users).filter(u => u.premium).length,
      registered: Object.values(users).filter(u => u.registered).length,
      
      // Estadísticas por período
      newUsers: 0, // Se podría calcular por fecha de registro
      activeUsers: 0, // Se podría calcular por última actividad
      
      // Top usuarios por actividad (se podría implementar)
      topUsers: []
    }

    return userData
  }

  async collectGroupData(type, options) {
    const db = global.db?.data
    if (!db) return { available: false }

    const chats = db.chats || {}
    const groups = Object.entries(chats).filter(([jid]) => jid.endsWith('@g.us'))
    
    const groupData = {
      total: groups.length,
      active: groups.filter(([, config]) => !config.isBanned).length,
      banned: groups.filter(([, config]) => config.isBanned).length,
      
      // Configuraciones
      withAntilink: groups.filter(([, config]) => config.antiLink).length,
      withWelcome: groups.filter(([, config]) => config.welcome).length,
      withAntispam: groups.filter(([, config]) => config.antiSpam).length,
      
      // Estadísticas de actividad
      mostActive: [], // Se podría implementar
      newGroups: 0 // Se podría calcular
    }

    return groupData
  }

  async collectPerformanceData(type, options) {
    const memUsage = process.memoryUsage()
    
    return {
      memory: {
        rss: memUsage.rss,
        heapTotal: memUsage.heapTotal,
        heapUsed: memUsage.heapUsed,
        external: memUsage.external,
        arrayBuffers: memUsage.arrayBuffers
      },
      
      cpu: {
        usage: process.cpuUsage(),
        loadAverage: os.loadavg()
      },
      
      eventLoop: {
        // Se podría implementar medición del event loop
        lag: 0
      },
      
      gc: {
        // Se podría implementar estadísticas de garbage collection
        collections: 0
      }
    }
  }

  async collectSecurityData(type, options) {
    try {
      // Obtener logs de auditoría recientes usando el método de conveniencia
      const auditLogs = await auditLogger.getRecentLogs(1000, 30) // Últimos 30 días
      
      const securityData = {
        auditLogs: auditLogs.length,
        
        events: {
          logins: auditLogs.filter(log => log.event?.includes('LOGIN')).length,
          failures: auditLogs.filter(log => log.event?.includes('FAILED')).length,
          unauthorized: auditLogs.filter(log => log.event?.includes('UNAUTHORIZED')).length,
          suspicious: auditLogs.filter(log => log.event?.includes('SUSPICIOUS')).length
        },
        
        // IPs más activas
        topIPs: this.getTopIPs(auditLogs),
      
        // Intentos de acceso fallidos
        failedAttempts: auditLogs.filter(log => 
          log.event?.includes('FAILED') || log.event?.includes('UNAUTHORIZED')
        ).length,
        
        // Alertas de seguridad
        alerts: auditLogs.filter(log => log.level === 'error').length
      }

      return securityData
    } catch (error) {
      console.error('Error collecting security data:', error)
      // Retornar datos por defecto en caso de error
      return {
        auditLogs: 0,
        events: {
          logins: 0,
          failures: 0,
          unauthorized: 0,
          suspicious: 0
        },
        topIPs: [],
        failedAttempts: 0,
        alerts: 0
      }
    }
  }

  async collectErrorData(type, options) {
    // Se podría implementar un sistema de tracking de errores
    return {
      total: 0,
      byType: {},
      recent: [],
      critical: 0
    }
  }

  calculateStats(values) {
    if (!values.length) return { min: 0, max: 0, avg: 0, median: 0 }
    
    const sorted = [...values].sort((a, b) => a - b)
    const sum = values.reduce((a, b) => a + b, 0)
    
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: sum / values.length,
      median: sorted[Math.floor(sorted.length / 2)],
      count: values.length
    }
  }

  getTopIPs(logs, limit = 10) {
    const ipCounts = new Map()
    
    logs.forEach(log => {
      if (log.ip) {
        ipCounts.set(log.ip, (ipCounts.get(log.ip) || 0) + 1)
      }
    })
    
    return Array.from(ipCounts.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, limit)
      .map(([ip, count]) => ({ ip, count }))
  }

  async formatReport(type, data, options = {}) {
    const template = options.template || type
    
    // Formatear según el tipo de reporte
    switch (type) {
      case 'daily':
        return this.formatDailyReport(data, options)
      case 'weekly':
        return this.formatWeeklyReport(data, options)
      case 'monthly':
        return this.formatMonthlyReport(data, options)
      case 'performance':
        return this.formatPerformanceReport(data, options)
      case 'security':
        return this.formatSecurityReport(data, options)
      default:
        return this.formatGenericReport(data, options)
    }
  }

  formatDailyReport(data, options) {
    return {
      ...data,
      
      summary: {
        title: `Reporte Diario - ${new Date().toLocaleDateString()}`,
        period: '24 horas',
        
        highlights: [
          `Sistema activo por ${Math.floor(data.system.uptime / 3600)}h`,
          `${data.users.total} usuarios totales`,
          `${data.groups.total} grupos activos`,
          `CPU promedio: ${data.system.period.cpu.avg?.toFixed(1)}%`,
          `Memoria promedio: ${data.system.period.memory.avg?.toFixed(1)}%`
        ],
        
        alerts: this.generateAlerts(data),
        recommendations: this.generateRecommendations(data)
      }
    }
  }

  formatWeeklyReport(data, options) {
    return {
      ...data,
      
      summary: {
        title: `Reporte Semanal - Semana del ${new Date().toLocaleDateString()}`,
        period: '7 días',
        
        highlights: [
          `Promedio de uptime: ${Math.floor(data.system.uptime / 3600)}h`,
          `Usuarios nuevos: ${data.users.newUsers}`,
          `Grupos nuevos: ${data.groups.newGroups}`,
          `Eventos de seguridad: ${data.security.events.failures}`
        ],
        
        trends: this.analyzeTrends(data),
        recommendations: this.generateRecommendations(data)
      }
    }
  }

  formatMonthlyReport(data, options) {
    return {
      ...data,
      
      summary: {
        title: `Reporte Mensual - ${new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`,
        period: '30 días',
        
        highlights: [
          `Crecimiento de usuarios: ${data.users.newUsers}`,
          `Rendimiento promedio del sistema`,
          `Estadísticas de uso del bot`,
          `Resumen de seguridad`
        ],
        
        analysis: this.generateMonthlyAnalysis(data),
        recommendations: this.generateRecommendations(data)
      }
    }
  }

  formatPerformanceReport(data, options) {
    return {
      ...data,
      
      summary: {
        title: `Reporte de Rendimiento - ${new Date().toLocaleTimeString()}`,
        period: '1 hora',
        
        metrics: {
          cpu: data.system.period.cpu,
          memory: data.system.period.memory,
          disk: data.system.period.disk,
          network: data.system.period.network
        },
        
        performance: {
          responseTime: 0, // Se podría implementar
          throughput: 0, // Se podría implementar
          errorRate: 0 // Se podría implementar
        }
      }
    }
  }

  formatSecurityReport(data, options) {
    return {
      ...data,
      
      summary: {
        title: `Reporte de Seguridad - ${new Date().toLocaleString()}`,
        period: '6 horas',
        
        security: {
          totalEvents: data.security.auditLogs,
          failedLogins: data.security.events.failures,
          suspiciousActivity: data.security.events.suspicious,
          topThreats: data.security.topIPs.slice(0, 5)
        },
        
        recommendations: this.generateSecurityRecommendations(data)
      }
    }
  }

  formatGenericReport(data, options) {
    return {
      ...data,
      
      summary: {
        title: `Reporte del Sistema - ${new Date().toLocaleString()}`,
        generatedAt: data.metadata.generatedAt,
        type: data.metadata.type
      }
    }
  }

  generateAlerts(data) {
    const alerts = []
    
    if (data.system.period.cpu.max > 90) {
      alerts.push({
        level: 'critical',
        message: `CPU alcanzó ${data.system.period.cpu.max.toFixed(1)}%`,
        recommendation: 'Revisar procesos con alto consumo de CPU'
      })
    }
    
    if (data.system.period.memory.max > 85) {
      alerts.push({
        level: 'warning',
        message: `Memoria alcanzó ${data.system.period.memory.max.toFixed(1)}%`,
        recommendation: 'Considerar aumentar memoria o optimizar uso'
      })
    }
    
    if (data.security.events.failures > 10) {
      alerts.push({
        level: 'warning',
        message: `${data.security.events.failures} intentos de acceso fallidos`,
        recommendation: 'Revisar logs de seguridad'
      })
    }
    
    return alerts
  }

  generateRecommendations(data) {
    const recommendations = []
    
    // Recomendaciones de rendimiento
    if (data.system.period.cpu.avg > 70) {
      recommendations.push('Optimizar procesos para reducir uso de CPU')
    }
    
    if (data.system.period.memory.avg > 80) {
      recommendations.push('Considerar aumentar la memoria RAM disponible')
    }
    
    // Recomendaciones de seguridad
    if (data.security.events.failures > 5) {
      recommendations.push('Implementar rate limiting más estricto')
    }
    
    // Recomendaciones de usuarios
    if (data.users.banned > data.users.total * 0.1) {
      recommendations.push('Revisar políticas de moderación de usuarios')
    }
    
    return recommendations
  }

  generateSecurityRecommendations(data) {
    const recommendations = []
    
    if (data.security.events.failures > 20) {
      recommendations.push('Implementar bloqueo temporal de IPs con múltiples fallos')
    }
    
    if (data.security.events.unauthorized > 10) {
      recommendations.push('Revisar permisos y tokens de acceso')
    }
    
    if (data.security.topIPs.length > 0) {
      recommendations.push('Monitorear IPs con alta actividad')
    }
    
    return recommendations
  }

  analyzeTrends(data) {
    // Se podría implementar análisis de tendencias más sofisticado
    return {
      cpu: 'stable',
      memory: 'increasing',
      users: 'growing',
      groups: 'stable'
    }
  }

  generateMonthlyAnalysis(data) {
    return {
      growth: {
        users: data.users.newUsers,
        groups: data.groups.newGroups
      },
      
      performance: {
        avgCpu: data.system.period.cpu.avg,
        avgMemory: data.system.period.memory.avg,
        uptime: data.system.uptime
      },
      
      security: {
        incidents: data.security.events.failures,
        alerts: data.security.alerts
      }
    }
  }

  async saveReport(type, report, options = {}) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = options.filename || `${type}-report-${timestamp}.json`
    const filePath = path.join(this.reportsDir, filename)
    
    // Guardar reporte en JSON
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2))
    
    // Generar versión HTML si se solicita
    if (options.html !== false) {
      const htmlPath = filePath.replace('.json', '.html')
      const html = this.generateHTML(report, type)
      fs.writeFileSync(htmlPath, html)
    }
    
    // Limpiar reportes antiguos
    this.cleanOldReports(type)
    
    return filePath
  }

  generateHTML(report, type) {
    const title = report.summary?.title || `Reporte ${type}`
    
    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { border-bottom: 2px solid #007bff; padding-bottom: 10px; margin-bottom: 20px; }
        .section { margin: 20px 0; padding: 15px; border-left: 4px solid #007bff; background: #f8f9fa; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: #e9ecef; border-radius: 4px; }
        .alert { padding: 10px; margin: 10px 0; border-radius: 4px; }
        .alert.critical { background: #f8d7da; border: 1px solid #f5c6cb; }
        .alert.warning { background: #fff3cd; border: 1px solid #ffeaa7; }
        .alert.info { background: #d1ecf1; border: 1px solid #bee5eb; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background-color: #f2f2f2; }
        .json-data { background: #f8f9fa; padding: 15px; border-radius: 4px; font-family: monospace; font-size: 12px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${title}</h1>
            <p>Generado el: ${new Date(report.metadata.generatedAt).toLocaleString()}</p>
        </div>
        
        ${this.generateHTMLSummary(report)}
        ${this.generateHTMLMetrics(report)}
        ${this.generateHTMLAlerts(report)}
        
        <div class="section">
            <h3>Datos Completos (JSON)</h3>
            <div class="json-data">
                <pre>${JSON.stringify(report, null, 2)}</pre>
            </div>
        </div>
    </div>
</body>
</html>
    `
  }

  generateHTMLSummary(report) {
    if (!report.summary) return ''
    
    const highlights = report.summary.highlights || []
    const recommendations = report.summary.recommendations || []
    
    return `
        <div class="section">
            <h3>Resumen</h3>
            ${highlights.length ? `
                <h4>Puntos Destacados:</h4>
                <ul>
                    ${highlights.map(h => `<li>${h}</li>`).join('')}
                </ul>
            ` : ''}
            
            ${recommendations.length ? `
                <h4>Recomendaciones:</h4>
                <ul>
                    ${recommendations.map(r => `<li>${r}</li>`).join('')}
                </ul>
            ` : ''}
        </div>
    `
  }

  generateHTMLMetrics(report) {
    if (!report.system) return ''
    
    return `
        <div class="section">
            <h3>Métricas del Sistema</h3>
            <div class="metric">
                <strong>CPU:</strong> ${report.system.period?.cpu?.avg?.toFixed(1) || 'N/A'}% promedio
            </div>
            <div class="metric">
                <strong>Memoria:</strong> ${report.system.period?.memory?.avg?.toFixed(1) || 'N/A'}% promedio
            </div>
            <div class="metric">
                <strong>Disco:</strong> ${report.system.period?.disk?.avg?.toFixed(1) || 'N/A'}% promedio
            </div>
            <div class="metric">
                <strong>Uptime:</strong> ${Math.floor((report.system.uptime || 0) / 3600)}h
            </div>
        </div>
    `
  }

  generateHTMLAlerts(report) {
    const alerts = report.summary?.alerts || []
    if (!alerts.length) return ''
    
    return `
        <div class="section">
            <h3>Alertas</h3>
            ${alerts.map(alert => `
                <div class="alert ${alert.level}">
                    <strong>${alert.level.toUpperCase()}:</strong> ${alert.message}
                    ${alert.recommendation ? `<br><em>Recomendación: ${alert.recommendation}</em>` : ''}
                </div>
            `).join('')}
        </div>
    `
  }

  cleanOldReports(type, maxAge = 30 * 24 * 60 * 60 * 1000) { // 30 días por defecto
    try {
      const files = fs.readdirSync(this.reportsDir)
      const now = Date.now()
      
      files.forEach(file => {
        if (file.startsWith(`${type}-report-`)) {
          const filePath = path.join(this.reportsDir, file)
          const stats = fs.statSync(filePath)
          
          if (now - stats.mtime.getTime() > maxAge) {
            fs.unlinkSync(filePath)
            console.log(`🗑️ Reporte antiguo eliminado: ${file}`)
          }
        }
      })
    } catch (error) {
      console.error('Error limpiando reportes antiguos:', error)
    }
  }

  async notifyReportGenerated(type, report, filePath) {
    try {
      const summary = report.summary || {}
      const alerts = summary.alerts || []
      const criticalAlerts = alerts.filter(a => a.level === 'critical')
      
      // Solo notificar si hay alertas críticas o es un reporte importante
      if (criticalAlerts.length > 0 || ['daily', 'weekly', 'monthly'].includes(type)) {
        await notificationSystem.send({
          type: criticalAlerts.length > 0 ? 'warning' : 'info',
          title: `Reporte ${type} generado`,
          message: `${summary.title || 'Reporte del sistema'}\n${criticalAlerts.length ? `⚠️ ${criticalAlerts.length} alertas críticas` : '✅ Sistema funcionando normalmente'}`,
          category: 'system',
          data: {
            reportType: type,
            filePath,
            alertsCount: alerts.length,
            criticalAlertsCount: criticalAlerts.length
          }
        })
      }
    } catch (error) {
      console.error('Error enviando notificación de reporte:', error)
    }
  }

  // Métodos públicos para generar reportes específicos
  async generateDailyReport(options = {}) {
    return this.generateReport('daily', options)
  }

  async generateWeeklyReport(options = {}) {
    return this.generateReport('weekly', options)
  }

  async generateMonthlyReport(options = {}) {
    return this.generateReport('monthly', options)
  }

  async generatePerformanceReport(options = {}) {
    return this.generateReport('performance', options)
  }

  async generateSecurityReport(options = {}) {
    return this.generateReport('security', options)
  }

  async generateCustomReport(options = {}) {
    return this.generateReport('custom', options)
  }

  // Obtener lista de reportes
  getReportsList(type = null) {
    try {
      const files = fs.readdirSync(this.reportsDir)
      let reports = files
        .filter(file => file.endsWith('.json'))
        .map(file => {
          const filePath = path.join(this.reportsDir, file)
          const stats = fs.statSync(filePath)
          return {
            filename: file,
            path: filePath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime,
            type: file.split('-')[0]
          }
        })
        .sort((a, b) => b.modified - a.modified)
      
      if (type) {
        reports = reports.filter(r => r.type === type)
      }
      
      return reports
    } catch (error) {
      console.error('Error obteniendo lista de reportes:', error)
      return []
    }
  }

  // Obtener reporte específico
  getReport(filename) {
    try {
      const filePath = path.join(this.reportsDir, filename)
      if (!fs.existsSync(filePath)) {
        throw new Error('Reporte no encontrado')
      }
      
      const content = fs.readFileSync(filePath, 'utf8')
      return JSON.parse(content)
    } catch (error) {
      console.error('Error leyendo reporte:', error)
      return null
    }
  }

  // Configurar tipos de reportes
  configureReportType(type, config) {
    if (this.reportTypes[type]) {
      this.reportTypes[type] = { ...this.reportTypes[type], ...config }
      
      // Reprogramar si está corriendo
      if (this.isRunning) {
        this.stop()
        this.start()
      }
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      reportTypes: this.reportTypes,
      scheduledReports: Array.from(this.scheduledReports.keys()),
      reportsDirectory: this.reportsDir,
      totalReports: this.getReportsList().length
    }
  }
}

// Instancia singleton
const reportingSystem = new ReportingSystem()

export default reportingSystem