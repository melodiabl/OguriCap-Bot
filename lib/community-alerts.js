import { emitNotification } from './socket-io.js'

// Thresholds for alerts
const ALERT_THRESHOLDS = {
  memory: 85,    // Alert when memory > 85%
  cpu: 90,       // Alert when CPU > 90%
  disk: 90,      // Alert when disk > 90%
  uptime: 86400  // Alert if uptime < 24 hours (unexpected restart)
}

let lastAlerts = {
  memory: 0,
  cpu: 0,
  disk: 0,
  restart: 0
}

// Cooldown period (5 minutes) to avoid spam
const ALERT_COOLDOWN = 5 * 60 * 1000

export function checkSystemAlerts(systemStats, panelDb) {
  const now = Date.now()
  const alerts = []

  // Memory alert
  if (systemStats.memory?.systemPercentage > ALERT_THRESHOLDS.memory) {
    if (now - lastAlerts.memory > ALERT_COOLDOWN) {
      alerts.push({
        type: 'warning',
        category: 'system',
        title: '⚠️ Memoria Alta',
        message: `Uso de memoria: ${systemStats.memory.systemPercentage}% (${systemStats.memory.usedGB}GB/${systemStats.memory.totalGB}GB)`,
        priority: 'high'
      })
      lastAlerts.memory = now
    }
  }

  // CPU alert
  if (systemStats.cpu?.percentage > ALERT_THRESHOLDS.cpu) {
    if (now - lastAlerts.cpu > ALERT_COOLDOWN) {
      alerts.push({
        type: 'warning',
        category: 'system',
        title: '🔥 CPU Sobrecargado',
        message: `Uso de CPU: ${systemStats.cpu.percentage}% en ${systemStats.cpu.cores} núcleos`,
        priority: 'high'
      })
      lastAlerts.cpu = now
    }
  }

  // Disk alert
  if (systemStats.disk?.percentage > ALERT_THRESHOLDS.disk) {
    if (now - lastAlerts.disk > ALERT_COOLDOWN) {
      alerts.push({
        type: 'error',
        category: 'system',
        title: '💾 Disco Lleno',
        message: `Espacio en disco: ${systemStats.disk.percentage}% (${systemStats.disk.freeGB}GB libres)`,
        priority: 'critical'
      })
      lastAlerts.disk = now
    }
  }

  // Unexpected restart alert
  if (systemStats.uptime < ALERT_THRESHOLDS.uptime) {
    if (now - lastAlerts.restart > ALERT_COOLDOWN) {
      alerts.push({
        type: 'info',
        category: 'system',
        title: '🔄 Bot Reiniciado',
        message: `El bot se reinició recientemente. Uptime: ${formatUptime(systemStats.uptime)}`,
        priority: 'medium'
      })
      lastAlerts.restart = now
    }
  }

  // Save alerts to database and emit notifications
  alerts.forEach(alert => {
    saveAlert(alert, panelDb)
    emitNotification(alert)
  })

  return alerts
}

function saveAlert(alert, panelDb) {
  if (!panelDb) return

  const alertId = (panelDb.alertsCounter || 0) + 1
  panelDb.alertsCounter = alertId

  panelDb.alerts ||= {}
  panelDb.alerts[alertId] = {
    id: alertId,
    ...alert,
    timestamp: new Date().toISOString(),
    read: false
  }

  // Keep only last 100 alerts
  const alertIds = Object.keys(panelDb.alerts).map(Number).sort((a, b) => b - a)
  if (alertIds.length > 100) {
    alertIds.slice(100).forEach(id => delete panelDb.alerts[id])
  }
}

function formatUptime(seconds) {
  const total = Math.max(0, Math.floor(Number(seconds) || 0))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

// Community-specific alerts
export function checkCommunityAlerts(panelDb) {
  const alerts = []
  const now = Date.now()

  // Check for inactive bot (no messages in last hour)
  const lastActivity = panelDb.stats?.lastMessageTime
  if (lastActivity && (now - new Date(lastActivity).getTime()) > 60 * 60 * 1000) {
    alerts.push({
      type: 'warning',
      category: 'community',
      title: '😴 Bot Inactivo',
      message: 'No se han procesado mensajes en la última hora',
      priority: 'medium'
    })
  }

  // Check for high error rate
  const errorRate = panelDb.stats?.errorRate || 0
  if (errorRate > 10) {
    alerts.push({
      type: 'error',
      category: 'community',
      title: '❌ Alta Tasa de Errores',
      message: `${errorRate}% de comandos fallaron en la última hora`,
      priority: 'high'
    })
  }

  return alerts
}