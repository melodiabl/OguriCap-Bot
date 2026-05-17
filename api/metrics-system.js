/**
 * Sistema de Métricas Avanzado
 * Recolecta, procesa y analiza métricas del sistema en tiempo real
 */

import EventEmitter from 'events'
import os from 'os'
import fs from 'fs'
import path from 'path'
import { performance } from 'perf_hooks'

class MetricsSystem extends EventEmitter {
  constructor() {
    super()
    
    this.metricsDir = path.join(process.cwd(), '.monitoring', 'metrics')
    this.ensureDirectories()
    
    this.collectors = new Map()
    this.metrics = new Map()
    this.aggregations = new Map()
    this.alerts = new Map()
    
    this.isRunning = false
    this.collectInterval = 5000 // 5 segundos por defecto
    this.retentionPeriod = 7 * 24 * 60 * 60 * 1000 // 7 días
    
    this.setupDefaultCollectors()
    this.setupDefaultAggregations()
  }

  ensureDirectories() {
    if (!fs.existsSync(this.metricsDir)) {
      fs.mkdirSync(this.metricsDir, { recursive: true })
    }
  }

  setupDefaultCollectors() {
    // Métricas del sistema
    this.addCollector('system.cpu', () => this.collectCPUMetrics())
    this.addCollector('system.memory', () => this.collectMemoryMetrics())
    this.addCollector('system.disk', () => this.collectDiskMetrics())
    this.addCollector('system.network', () => this.collectNetworkMetrics())
    this.addCollector('system.load', () => this.collectLoadMetrics())
    
    // Métricas del proceso Node.js
    this.addCollector('process.memory', () => this.collectProcessMemory())
    this.addCollector('process.cpu', () => this.collectProcessCPU())
    this.addCollector('process.handles', () => this.collectProcessHandles())
    this.addCollector('process.eventloop', () => this.collectEventLoopMetrics())
    
    // Métricas del bot
    this.addCollector('bot.connections', () => this.collectBotConnections())
    this.addCollector('bot.messages', () => this.collectBotMessages())
    this.addCollector('bot.commands', () => this.collectBotCommands())
    this.addCollector('bot.errors', () => this.collectBotErrors())
    
    // Métricas de la aplicación
    this.addCollector('app.requests', () => this.collectAppRequests())
    this.addCollector('app.responses', () => this.collectAppResponses())
    this.addCollector('app.database', () => this.collectDatabaseMetrics())
  }

  setupDefaultAggregations() {
    // Agregaciones por minuto
    this.addAggregation('1m', 60 * 1000, ['avg', 'min', 'max', 'sum', 'count'])
    
    // Agregaciones por hora
    this.addAggregation('1h', 60 * 60 * 1000, ['avg', 'min', 'max', 'sum', 'count'])
    
    // Agregaciones por día
    this.addAggregation('1d', 24 * 60 * 60 * 1000, ['avg', 'min', 'max', 'sum', 'count'])
  }

  start() {
    if (this.isRunning) return
    
    this.isRunning = true
    console.log('📊 Sistema de Métricas iniciado')
    
    // Iniciar recolección
    this.startCollection()
    
    // Iniciar agregaciones
    this.startAggregations()
    
    // Limpiar métricas antiguas
    this.startCleanup()
    
    this.emit('started')
  }

  stop() {
    if (!this.isRunning) return
    
    this.isRunning = false
    
    if (this.collectionTimer) {
      clearInterval(this.collectionTimer)
    }
    
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer)
    }
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
    }
    
    console.log('📊 Sistema de Métricas detenido')
    this.emit('stopped')
  }

  startCollection() {
    this.collectionTimer = setInterval(async () => {
      await this.collectAllMetrics()
    }, this.collectInterval)
  }

  startAggregations() {
    this.aggregationTimer = setInterval(() => {
      this.processAggregations()
    }, 60 * 1000) // Cada minuto
  }

  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      this.cleanupOldMetrics()
    }, 60 * 60 * 1000) // Cada hora
  }

  async collectAllMetrics() {
    const timestamp = Date.now()
    const promises = []
    
    for (const [name, collector] of this.collectors) {
      promises.push(
        this.collectMetric(name, collector, timestamp).catch(error => {
          console.error(`Error recolectando métrica ${name}:`, error)
        })
      )
    }
    
    await Promise.all(promises)
    this.emit('metricsCollected', timestamp)
  }

  async collectMetric(name, collector, timestamp) {
    try {
      const startTime = performance.now()
      const value = await collector()
      const duration = performance.now() - startTime
      
      const metric = {
        name,
        value,
        timestamp,
        collectionDuration: duration
      }
      
      this.storeMetric(metric)
      this.checkAlerts(metric)
      
      return metric
    } catch (error) {
      console.error(`Error en collector ${name}:`, error)
      return null
    }
  }

  storeMetric(metric) {
    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, [])
    }
    
    const series = this.metrics.get(metric.name)
    series.push(metric)
    
    // Mantener solo los datos recientes en memoria
    const cutoff = Date.now() - (60 * 60 * 1000) // 1 hora
    const filtered = series.filter(m => m.timestamp > cutoff)
    this.metrics.set(metric.name, filtered)
    
    this.emit('metricStored', metric)
  }

  // Collectors del sistema
  async collectCPUMetrics() {
    const cpus = os.cpus()
    let totalIdle = 0
    let totalTick = 0
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type]
      }
      totalIdle += cpu.times.idle
    })
    
    const idle = totalIdle / cpus.length
    const total = totalTick / cpus.length
    const usage = 100 - ~~(100 * idle / total)
    
    return {
      usage,
      cores: cpus.length,
      loadAverage: os.loadavg(),
      model: cpus[0]?.model || 'Unknown'
    }
  }

  async collectMemoryMetrics() {
    const total = os.totalmem()
    const free = os.freemem()
    const used = total - free
    const usage = (used / total) * 100
    
    return {
      total,
      free,
      used,
      usage,
      available: free
    }
  }

  async collectDiskMetrics() {
    try {
      // En sistemas Unix, usar df para obtener uso del disco
      if (process.platform !== 'win32') {
        const { execSync } = await import('child_process')
        const output = execSync('df -h /', { encoding: 'utf8' })
        const lines = output.trim().split('\n')
        
        if (lines.length > 1) {
          const parts = lines[1].split(/\s+/)
          const usage = parseInt(parts[4]) || 0
          
          return {
            usage,
            total: parts[1],
            used: parts[2],
            available: parts[3],
            filesystem: parts[0]
          }
        }
      }
      
      // Fallback básico
      return {
        usage: 0,
        total: 'N/A',
        used: 'N/A',
        available: 'N/A',
        filesystem: 'N/A'
      }
    } catch (error) {
      return {
        usage: 0,
        error: error.message
      }
    }
  }

  async collectNetworkMetrics() {
    const interfaces = os.networkInterfaces()
    const stats = {
      interfaces: 0,
      active: 0,
      ipv4: 0,
      ipv6: 0
    }
    
    Object.values(interfaces).forEach(iface => {
      if (Array.isArray(iface)) {
        stats.interfaces++
        iface.forEach(addr => {
          if (!addr.internal) {
            stats.active++
            if (addr.family === 'IPv4') stats.ipv4++
            if (addr.family === 'IPv6') stats.ipv6++
          }
        })
      }
    })
    
    return stats
  }

  async collectLoadMetrics() {
    const load = os.loadavg()
    return {
      load1: load[0],
      load5: load[1],
      load15: load[2],
      uptime: os.uptime()
    }
  }

  async collectProcessMemory() {
    const usage = process.memoryUsage()
    return {
      rss: usage.rss,
      heapTotal: usage.heapTotal,
      heapUsed: usage.heapUsed,
      external: usage.external,
      arrayBuffers: usage.arrayBuffers,
      heapUsage: (usage.heapUsed / usage.heapTotal) * 100
    }
  }

  async collectProcessCPU() {
    const usage = process.cpuUsage()
    return {
      user: usage.user,
      system: usage.system,
      total: usage.user + usage.system,
      uptime: process.uptime()
    }
  }

  async collectProcessHandles() {
    return {
      handles: process._getActiveHandles?.()?.length || 0,
      requests: process._getActiveRequests?.()?.length || 0
    }
  }

  async collectEventLoopMetrics() {
    return new Promise((resolve) => {
      const start = performance.now()
      setImmediate(() => {
        const lag = performance.now() - start
        resolve({
          lag,
          utilization: process.env.NODE_ENV === 'production' ? 0 : lag // Simplificado
        })
      })
    })
  }

  async collectBotConnections() {
    const mainBot = global.conn?.user ? 1 : 0
    const subbots = (global.conns || []).filter(c => c?.user).length
    
    return {
      mainBot,
      subbots,
      total: mainBot + subbots,
      status: global.stopped || 'unknown'
    }
  }

  async collectBotMessages() {
    // Se podría implementar un contador de mensajes
    return {
      total: 0,
      perMinute: 0,
      errors: 0
    }
  }

  async collectBotCommands() {
    // Se podría implementar un contador de comandos
    return {
      total: 0,
      perMinute: 0,
      mostUsed: []
    }
  }

  async collectBotErrors() {
    // Se podría implementar un contador de errores
    return {
      total: 0,
      perMinute: 0,
      types: {}
    }
  }

  async collectAppRequests() {
    // Se podría implementar un contador de requests HTTP
    return {
      total: 0,
      perMinute: 0,
      byStatus: {}
    }
  }

  async collectAppResponses() {
    // Se podría implementar métricas de respuesta
    return {
      averageTime: 0,
      p95: 0,
      p99: 0
    }
  }

  async collectDatabaseMetrics() {
    const db = global.db?.data
    if (!db) return { available: false }
    
    return {
      available: true,
      users: Object.keys(db.users || {}).length,
      chats: Object.keys(db.chats || {}).length,
      aportes: (db.aportes || []).length,
      size: JSON.stringify(db).length
    }
  }

  // Gestión de collectors
  addCollector(name, collector) {
    this.collectors.set(name, collector)
  }

  removeCollector(name) {
    this.collectors.delete(name)
  }

  // Gestión de agregaciones
  addAggregation(name, interval, functions) {
    this.aggregations.set(name, {
      interval,
      functions: Array.isArray(functions) ? functions : [functions],
      lastRun: 0
    })
  }

  processAggregations() {
    const now = Date.now()
    
    for (const [name, config] of this.aggregations) {
      if (now - config.lastRun >= config.interval) {
        this.processAggregation(name, config, now)
        config.lastRun = now
      }
    }
  }

  processAggregation(name, config, timestamp) {
    const cutoff = timestamp - config.interval
    
    for (const [metricName, series] of this.metrics) {
      const periodData = series.filter(m => m.timestamp > cutoff)
      
      if (periodData.length === 0) continue
      
      const aggregated = {
        metric: metricName,
        aggregation: name,
        timestamp,
        period: config.interval,
        count: periodData.length
      }
      
      // Calcular funciones de agregación
      config.functions.forEach(func => {
        aggregated[func] = this.calculateAggregation(func, periodData)
      })
      
      this.storeAggregation(aggregated)
    }
  }

  calculateAggregation(func, data) {
    const values = data.map(d => {
      if (typeof d.value === 'object') {
        // Para objetos, usar una propiedad específica o el primer valor numérico
        const numericValues = Object.values(d.value).filter(v => typeof v === 'number')
        return numericValues.length > 0 ? numericValues[0] : 0
      }
      return typeof d.value === 'number' ? d.value : 0
    }).filter(v => !isNaN(v))
    
    if (values.length === 0) return 0
    
    switch (func) {
      case 'avg':
        return values.reduce((a, b) => a + b, 0) / values.length
      case 'min':
        return Math.min(...values)
      case 'max':
        return Math.max(...values)
      case 'sum':
        return values.reduce((a, b) => a + b, 0)
      case 'count':
        return values.length
      case 'median':
        const sorted = values.sort((a, b) => a - b)
        const mid = Math.floor(sorted.length / 2)
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
      case 'p95':
        const sorted95 = values.sort((a, b) => a - b)
        const index95 = Math.floor(sorted95.length * 0.95)
        return sorted95[index95] || 0
      case 'p99':
        const sorted99 = values.sort((a, b) => a - b)
        const index99 = Math.floor(sorted99.length * 0.99)
        return sorted99[index99] || 0
      default:
        return 0
    }
  }

  storeAggregation(aggregated) {
    // Guardar agregación en archivo
    const filename = `${aggregated.metric.replace(/\./g, '_')}_${aggregated.aggregation}.json`
    const filepath = path.join(this.metricsDir, filename)
    
    let data = []
    if (fs.existsSync(filepath)) {
      try {
        data = JSON.parse(fs.readFileSync(filepath, 'utf8'))
      } catch (error) {
        console.error(`Error leyendo agregación ${filename}:`, error)
      }
    }
    
    data.push(aggregated)
    
    // Mantener solo datos recientes
    const cutoff = Date.now() - this.retentionPeriod
    data = data.filter(d => d.timestamp > cutoff)
    
    try {
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2))
    } catch (error) {
      console.error(`Error guardando agregación ${filename}:`, error)
    }
  }

  // Gestión de alertas
  addAlert(name, metricName, condition, threshold, callback) {
    this.alerts.set(name, {
      metricName,
      condition, // 'gt', 'lt', 'eq', 'gte', 'lte'
      threshold,
      callback,
      triggered: false,
      lastTriggered: 0
    })
  }

  checkAlerts(metric) {
    for (const [name, alert] of this.alerts) {
      if (alert.metricName === metric.name) {
        const shouldTrigger = this.evaluateAlert(alert, metric)
        
        if (shouldTrigger && !alert.triggered) {
          alert.triggered = true
          alert.lastTriggered = Date.now()
          
          try {
            alert.callback(metric, alert)
          } catch (error) {
            console.error(`Error en callback de alerta ${name}:`, error)
          }
          
          this.emit('alertTriggered', { name, metric, alert })
        } else if (!shouldTrigger && alert.triggered) {
          alert.triggered = false
          this.emit('alertResolved', { name, metric, alert })
        }
      }
    }
  }

  evaluateAlert(alert, metric) {
    const value = typeof metric.value === 'object' 
      ? Object.values(metric.value).find(v => typeof v === 'number') || 0
      : metric.value
    
    switch (alert.condition) {
      case 'gt': return value > alert.threshold
      case 'gte': return value >= alert.threshold
      case 'lt': return value < alert.threshold
      case 'lte': return value <= alert.threshold
      case 'eq': return value === alert.threshold
      default: return false
    }
  }

  // Métodos de consulta
  getMetrics(name, timeRange = 60 * 60 * 1000) {
    const series = this.metrics.get(name) || []
    const cutoff = Date.now() - timeRange
    return series.filter(m => m.timestamp > cutoff)
  }

  getAggregatedMetrics(metricName, aggregation = '1m', timeRange = 24 * 60 * 60 * 1000) {
    const filename = `${metricName.replace(/\./g, '_')}_${aggregation}.json`
    const filepath = path.join(this.metricsDir, filename)
    
    if (!fs.existsSync(filepath)) return []
    
    try {
      const data = JSON.parse(fs.readFileSync(filepath, 'utf8'))
      const cutoff = Date.now() - timeRange
      return data.filter(d => d.timestamp > cutoff)
    } catch (error) {
      console.error(`Error leyendo métricas agregadas ${filename}:`, error)
      return []
    }
  }

  getAllMetrics() {
    const result = {}
    for (const [name, series] of this.metrics) {
      result[name] = series
    }
    return result
  }

  getMetricNames() {
    return Array.from(this.metrics.keys())
  }

  getLatestMetrics() {
    const result = {}
    for (const [name, series] of this.metrics) {
      if (series.length > 0) {
        result[name] = series[series.length - 1]
      }
    }
    return result
  }

  // Limpieza
  cleanupOldMetrics() {
    const cutoff = Date.now() - this.retentionPeriod
    
    // Limpiar métricas en memoria
    for (const [name, series] of this.metrics) {
      const filtered = series.filter(m => m.timestamp > cutoff)
      this.metrics.set(name, filtered)
    }
    
    // Limpiar archivos de agregaciones
    try {
      const files = fs.readdirSync(this.metricsDir)
      files.forEach(file => {
        if (file.endsWith('.json')) {
          const filepath = path.join(this.metricsDir, file)
          try {
            const data = JSON.parse(fs.readFileSync(filepath, 'utf8'))
            const filtered = data.filter(d => d.timestamp > cutoff)
            
            if (filtered.length !== data.length) {
              fs.writeFileSync(filepath, JSON.stringify(filtered, null, 2))
            }
          } catch (error) {
            console.error(`Error limpiando archivo ${file}:`, error)
          }
        }
      })
    } catch (error) {
      console.error('Error limpiando métricas:', error)
    }
  }

  // Configuración
  setCollectInterval(interval) {
    this.collectInterval = interval
    if (this.isRunning) {
      this.stop()
      this.start()
    }
  }

  setRetentionPeriod(period) {
    this.retentionPeriod = period
  }

  // Estado del sistema
  getStatus() {
    return {
      isRunning: this.isRunning,
      collectInterval: this.collectInterval,
      retentionPeriod: this.retentionPeriod,
      collectors: Array.from(this.collectors.keys()),
      aggregations: Array.from(this.aggregations.keys()),
      alerts: Array.from(this.alerts.keys()),
      metricsCount: this.metrics.size,
      totalDataPoints: Array.from(this.metrics.values()).reduce((sum, series) => sum + series.length, 0)
    }
  }

  // Exportar métricas
  exportMetrics(format = 'json') {
    const data = {
      timestamp: Date.now(),
      metrics: this.getAllMetrics(),
      status: this.getStatus()
    }
    
    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2)
      case 'csv':
        return this.exportToCSV(data)
      default:
        return data
    }
  }

  exportToCSV(data) {
    const lines = ['timestamp,metric,value']
    
    for (const [name, series] of Object.entries(data.metrics)) {
      series.forEach(point => {
        const value = typeof point.value === 'object' 
          ? JSON.stringify(point.value).replace(/,/g, ';')
          : point.value
        lines.push(`${point.timestamp},${name},${value}`)
      })
    }
    
    return lines.join('\n')
  }
}

// Instancia singleton
const metricsSystem = new MetricsSystem()

export default metricsSystem