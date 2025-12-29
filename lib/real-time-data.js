/**
 * Sistema de Datos en Tiempo Real (100% real)
 * - Dashboard: DB + logs reales (handler.js)
 * - Sistema: métricas reales del host (CPU/RAM/Disk) + resource-monitor si está activo
 * - Actividad: panel.logs reales (sin aleatoriedad)
 */

import os from 'os'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'
import { emitBotStatus, emitSystemStats } from './socket-io.js'
import taskScheduler from './task-scheduler.js'
import resourceMonitor from './resource-monitor.js'

const safeString = (v) => (v == null ? '' : String(v))
const safeNumber = (v, fallback = 0) => {
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}
const roundTo = (v, decimals = 2) => {
  const n = safeNumber(v, 0)
  const d = Math.max(0, Math.min(6, safeNumber(decimals, 2)))
  const factor = 10 ** d
  return Math.round(n * factor) / factor
}
const clamp = (n, min, max) => Math.max(min, Math.min(max, n))
const toGB = (bytes) => Math.round((safeNumber(bytes) / 1024 / 1024 / 1024) * 100) / 100

function getDiskFromStatfs(cwd = process.cwd()) {
  if (typeof fs.statfsSync !== 'function') return null
  try {
    const s = fs.statfsSync(cwd)
    const total = safeNumber(s.bsize) * safeNumber(s.blocks)
    const free = safeNumber(s.bsize) * safeNumber(s.bfree)
    const used = Math.max(0, total - free)
    const usage = total > 0 ? Math.round((used / total) * 100) : 0
    return { totalBytes: total, freeBytes: free, usedBytes: used, usage }
  } catch {
    return null
  }
}

function getDiskFallbackPercent() {
  try {
    if (process.platform === 'win32') {
      const output = execSync('wmic logicaldisk get size,freespace,caption', { encoding: 'utf8', timeout: 5000 })
      const lines = output.split('\n').filter((line) => line.trim() && !line.includes('Caption'))
      if (lines.length > 0) {
        const parts = lines[0].trim().split(/\s+/)
        if (parts.length >= 2) {
          const free = parseInt(parts[0]) || 0
          const total = parseInt(parts[1]) || 0
          if (total > 0) return Math.round(((total - free) / total) * 100)
        }
      }
    } else {
      const output = execSync('df -k /', { encoding: 'utf8', timeout: 5000 })
      const lines = output.split('\n')
      if (lines.length > 1) {
        const parts = lines[1].trim().split(/\s+/)
        if (parts.length >= 5) {
          const pct = parseInt(parts[4].replace('%', ''))
          if (Number.isFinite(pct)) return clamp(pct, 0, 100)
        }
      }
    }
  } catch {}
  return null
}

function formatBytes(bytes) {
  const n = safeNumber(bytes, 0)
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let v = n / 1024
  let i = 0
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024
    i += 1
  }
  return `${v.toFixed(2)} ${units[i]}`
}

function getPanel() {
  return global.db?.data?.panel || {}
}

function getDayKey(d = new Date()) {
  return d.toISOString().slice(0, 10)
}

function toAgo(iso) {
  const t = new Date(iso || 0).getTime()
  if (!Number.isFinite(t) || t <= 0) return 'N/A'
  const diff = Date.now() - t
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Ahora'
  if (mins < 60) return `Hace ${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Hace ${hours}h`
  const days = Math.floor(hours / 24)
  return `Hace ${days}d`
}

function walkDirStats(dir) {
  let totalSize = 0
  let fileCount = 0
  let compressedCount = 0
  if (!dir || !fs.existsSync(dir)) return { totalSize, fileCount, compressedCount }
  const stack = [dir]
  while (stack.length) {
    const current = stack.pop()
    let entries = []
    try {
      entries = fs.readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const ent of entries) {
      const p = path.join(current, ent.name)
      if (ent.isDirectory()) {
        stack.push(p)
        continue
      }
      fileCount += 1
      if (p.toLowerCase().endsWith('.gz')) compressedCount += 1
      try {
        const st = fs.statSync(p)
        totalSize += safeNumber(st.size, 0)
      } catch {}
    }
  }
  return { totalSize, fileCount, compressedCount }
}

class RealTimeDataManager {
  constructor() {
    this.cache = new Map()
    this.cacheTimeout = 5000
    this.isRunning = false
    this.updateInterval = null
    this._lastCpuSnapshot = null

    const cpu0 = os.cpus()[0] || {}

    this.systemMetrics = {
      cpu: { usage: 0, percentage: 0, cores: os.cpus().length, model: cpu0.model || 'Unknown', speed: cpu0.speed || 0 },
      memory: { usage: 0, systemPercentage: 0, total: os.totalmem(), free: os.freemem(), used: 0, totalGB: 0, freeGB: 0, usedGB: 0 },
      disk: { usage: 0, percentage: 0, total: '0GB', used: '0GB', available: '0GB', totalGB: 0, freeGB: 0, usedGB: 0 },
      network: { interfaces: [], hostname: os.hostname() },
      uptime: 0,
      platform: os.platform(),
      arch: os.arch(),
      node: process.version,
    }

    this.botMetrics = {
      status: 'disconnected',
      phoneNumber: null,
      qrCode: null,
      connectionTime: null,
      messagesCount: 0,
      commandsCount: 0,
      errorsCount: 0,
      subbots: { total: 0, connected: 0 },
    }

    this.databaseStats = {
      users: 0,
      groups: 0,
      chats: 0,
      aportes: 0,
      pedidos: 0,
      multimedia: 0,
    }
  }

  start() {
    if (this.isRunning) return
    this.isRunning = true
    this.updateSystemMetrics()
    this.updateBotMetrics()
    this.updateDatabaseStats()
    this.updateInterval = setInterval(() => {
      this.updateSystemMetrics()
      this.updateBotMetrics()
      this.updateDatabaseStats()
      this.broadcastUpdates()
    }, 5000)
    console.log('[RealTimeData] started')
  }

  stop() {
    if (!this.isRunning) return
    this.isRunning = false
    if (this.updateInterval) clearInterval(this.updateInterval)
    this.updateInterval = null
    console.log('[RealTimeData] stopped')
  }

  broadcastUpdates() {
    try {
      emitBotStatus({
        status: this.botMetrics.status,
        phoneNumber: this.botMetrics.phoneNumber,
        messagesCount: this.botMetrics.messagesCount,
        commandsCount: this.botMetrics.commandsCount,
      })

      emitSystemStats({
        cpu: roundTo(this.systemMetrics.cpu.usage, 2),
        memory: roundTo(this.systemMetrics.memory.usage, 2),
        uptime: this.systemMetrics.uptime,
        botStatus: this.botMetrics.status,
      })
    } catch {}
  }

  getCachedData(key, generator, timeout = this.cacheTimeout) {
    const cached = this.cache.get(key)
    if (cached && (Date.now() - cached.timestamp) < timeout) return cached.data
    const data = generator()
    this.cache.set(key, { data, timestamp: Date.now() })
    return data
  }

  clearCache() {
    this.cache.clear()
  }

  updateSystemMetrics() {
    try {
      const cpus = os.cpus()
      let totalIdle = 0
      let totalTick = 0
      for (const cpu of cpus) {
        for (const type in cpu.times) totalTick += cpu.times[type]
        totalIdle += cpu.times.idle
      }

      const idle = totalIdle
      const total = totalTick
      let usage = 0
      if (this._lastCpuSnapshot) {
        const idleDiff = idle - this._lastCpuSnapshot.idle
        const totalDiff = total - this._lastCpuSnapshot.total
        if (totalDiff > 0) usage = 100 - (idleDiff / totalDiff) * 100
      }
      this._lastCpuSnapshot = { idle, total }
      usage = clamp(usage, 0, 100)

      const cpu0 = cpus[0] || {}
      this.systemMetrics.cpu = {
        usage,
        percentage: usage,
        cores: cpus.length,
        model: cpu0.model || 'Unknown',
        speed: cpu0.speed || 0,
        loadAverage: os.loadavg(),
      }

      const totalMem = os.totalmem()
      const freeMem = os.freemem()
      const usedMem = Math.max(0, totalMem - freeMem)
      const memUsage = totalMem > 0 ? (usedMem / totalMem) * 100 : 0
      this.systemMetrics.memory = {
        usage: memUsage,
        systemPercentage: memUsage,
        total: totalMem,
        free: freeMem,
        used: usedMem,
        totalGB: toGB(totalMem),
        freeGB: toGB(freeMem),
        usedGB: toGB(usedMem),
      }

      const statfs = getDiskFromStatfs(process.cwd())
      if (statfs) {
        const totalGB = toGB(statfs.totalBytes)
        const freeGB = toGB(statfs.freeBytes)
        const usedGB = toGB(statfs.usedBytes)
        this.systemMetrics.disk = {
          usage: statfs.usage,
          percentage: statfs.usage,
          total: `${totalGB}GB`,
          used: `${usedGB}GB`,
          available: `${freeGB}GB`,
          totalGB,
          freeGB,
          usedGB,
        }
      } else {
        const pct = getDiskFallbackPercent()
        const usagePct = pct == null ? 0 : clamp(pct, 0, 100)
        this.systemMetrics.disk = {
          usage: usagePct,
          percentage: usagePct,
          total: 'N/A',
          used: 'N/A',
          available: 'N/A',
          totalGB: 0,
          freeGB: 0,
          usedGB: 0,
        }
      }

      this.systemMetrics.uptime = os.uptime()
      this.systemMetrics.platform = os.platform()
      this.systemMetrics.arch = os.arch()
      this.systemMetrics.node = process.version
      this.systemMetrics.network.hostname = os.hostname()
    } catch (error) {
      console.error('[RealTimeData] updateSystemMetrics error:', error?.message || String(error))
    }
  }

  updateBotMetrics() {
    try {
      const panel = getPanel()
      const isConnected = Boolean(global.conn?.user) || global.stopped === 'open'
      const jid = global.conn?.user?.id || global.conn?.user?.jid || global.conn?.user?.uid || null
      const phoneNumber = jid ? safeString(jid).split(':')[0] : null

      const subbots = panel.subbots && typeof panel.subbots === 'object' ? panel.subbots : {}
      const subbotEntries = Object.values(subbots)
      const subbotsTotal = subbotEntries.length
      const subbotsConnected = subbotEntries.filter((s) => s?.connected || s?.isConnected || s?.status === 'connected' || s?.isOnline).length

      const dailyMetrics = panel.dailyMetrics || {}
      const totalMsgs = Object.values(dailyMetrics).reduce((sum, d) => sum + safeNumber(d?.mensajes, 0), 0)
      const totalCmds = Object.values(dailyMetrics).reduce((sum, d) => sum + safeNumber(d?.comandos, 0), 0)
      const totalErrs = Object.values(dailyMetrics).reduce((sum, d) => sum + safeNumber(d?.erroresComandos, 0), 0)

      this.botMetrics.status = isConnected ? 'connected' : 'disconnected'
      this.botMetrics.phoneNumber = phoneNumber
      this.botMetrics.messagesCount = totalMsgs
      this.botMetrics.commandsCount = totalCmds
      this.botMetrics.errorsCount = totalErrs
      this.botMetrics.subbots = { total: subbotsTotal, connected: subbotsConnected }
    } catch {}
  }

  updateDatabaseStats() {
    try {
      const data = global.db?.data || {}
      const panel = getPanel()

      this.databaseStats.users = Object.keys(data.users || {}).length
      this.databaseStats.chats = Object.keys(data.chats || {}).length
      this.databaseStats.groups = Object.keys(panel.groups || {}).length
      this.databaseStats.aportes = Array.isArray(data.aportes) ? data.aportes.length : Object.keys(panel.aportes || {}).length
      this.databaseStats.pedidos = Object.keys(panel.pedidos || {}).length
      this.databaseStats.multimedia = Object.keys(panel.multimedia || {}).length
    } catch (error) {
      console.error('[RealTimeData] updateDatabaseStats error:', error?.message || String(error))
    }
  }

  getSystemStats() {
    const heap = process.memoryUsage()
    const cpuUsage = roundTo(this.systemMetrics.cpu?.usage, 2)
    const memUsage = roundTo(this.systemMetrics.memory?.usage, 2)
    const diskUsage = roundTo(this.systemMetrics.disk?.usage, 2)
    const loadAverage = Array.isArray(this.systemMetrics.cpu?.loadAverage)
      ? this.systemMetrics.cpu.loadAverage.map((v) => roundTo(v, 2))
      : []

    const cpu = {
      model: this.systemMetrics.cpu?.model,
      cores: this.systemMetrics.cpu?.cores,
      usage: cpuUsage,
      percentage: cpuUsage,
      loadAverage,
    }
    const memory = {
      ...this.systemMetrics.memory,
      heapUsed: heap.heapUsed,
      heapTotal: heap.heapTotal,
      usage: memUsage,
      systemPercentage: memUsage,
    }
    const disk = {
      ...this.systemMetrics.disk,
      usage: diskUsage,
      percentage: diskUsage,
    }

    return {
      ...this.systemMetrics,
      cpu,
      memory,
      disk,
      process: {
        uptime: process.uptime(),
        pid: process.pid,
        version: process.version,
        platform: process.platform,
        arch: process.arch,
      },
    }
  }

  getBotStatus() {
    return {
      status: this.botMetrics.status,
      phoneNumber: this.botMetrics.phoneNumber,
      connectionTime: this.botMetrics.connectionTime,
      messagesCount: this.botMetrics.messagesCount,
      commandsCount: this.botMetrics.commandsCount,
      errorsCount: this.botMetrics.errorsCount,
      subbots: this.botMetrics.subbots,
      qrCode: this.botMetrics.qrCode,
    }
  }

  getSystemAlerts() {
    const alerts = []
    if (safeNumber(this.systemMetrics.cpu.usage) > 80) {
      alerts.push({
        id: 'cpu-high',
        severity: 'critical',
        title: 'CPU Alto',
        message: `El uso de CPU es ${safeNumber(this.systemMetrics.cpu.usage).toFixed(1)}%`,
        timestamp: new Date().toISOString(),
        resolved: false,
      })
    }

    if (safeNumber(this.systemMetrics.memory.usage) > 85) {
      alerts.push({
        id: 'memory-high',
        severity: 'warning',
        title: 'Memoria Alta',
        message: `El uso de memoria es ${safeNumber(this.systemMetrics.memory.usage).toFixed(1)}%`,
        timestamp: new Date().toISOString(),
        resolved: false,
      })
    }

    if (this.botMetrics.status !== 'connected') {
      alerts.push({
        id: 'bot-disconnected',
        severity: 'critical',
        title: 'Bot Desconectado',
        message: 'El bot principal no está conectado',
        timestamp: new Date().toISOString(),
        resolved: false,
      })
    }

    return { alerts }
  }

  getRecentActivity(limit = 10) {
    const panel = getPanel()
    const logs = Array.isArray(panel.logs) ? panel.logs : []

    const ordered = logs
      .slice()
      .sort((a, b) => new Date(b?.fecha || 0).getTime() - new Date(a?.fecha || 0).getTime())
      .slice(0, limit)

    const activities = ordered.map((l) => {
      const tipo = safeString(l?.tipo || 'evento')
      const success = l?.metadata?.success !== false && l?.nivel !== 'error'
      const titulo = safeString(l?.titulo || '')
      const detalles = safeString(l?.detalles || '')
      const icon =
        tipo === 'comando' ? 'Zap' :
        tipo === 'mensaje' ? 'MessageSquare' :
        tipo === 'bot' || tipo.includes('bot') ? 'Bot' :
        tipo.includes('aporte') ? 'Package' :
        tipo.includes('pedido') ? 'ShoppingCart' :
        tipo.includes('usuario') ? 'Users' :
        tipo.includes('config') ? 'Settings' :
        'Activity'

      const color =
        tipo === 'comando' ? (success ? 'primary' : 'danger') :
        tipo === 'mensaje' ? 'success' :
        tipo === 'bot' || tipo.includes('bot') ? 'info' :
        tipo.includes('pedido') ? 'warning' :
        tipo.includes('aporte') ? 'violet' :
        'info'

      const usuario = safeString(l?.usuario || '')
      const usuarioShort = usuario ? usuario.split('@')[0] : 'N/A'
      const comando = safeString(l?.comando || '').trim()
      const grupo = safeString(l?.grupo || '').trim()
      const grupoShort = grupo ? grupo.split('@')[0] : null

      return {
        id: l?.id ?? `${tipo}_${l?.fecha || Date.now()}`,
        type: tipo,
        icon,
        color,
        title: tipo === 'comando'
          ? `Comando ${comando || ''}`.trim()
          : (titulo || tipo),
        desc: tipo === 'comando'
          ? `${usuarioShort}${grupoShort ? ` en ${grupoShort}` : ''}`
          : `${usuarioShort}${grupoShort ? ` en ${grupoShort}` : ''}${detalles ? ` · ${detalles}` : ''}`.trim(),
        time: toAgo(l?.fecha),
        timestamp: l?.fecha || new Date().toISOString(),
      }
    })

    return {
      activities,
      total: logs.length,
      lastUpdate: new Date().toISOString(),
      systemStatus: {
        botConnected: this.botMetrics.status === 'connected',
        systemHealthy: safeNumber(this.systemMetrics.cpu.usage) < 80 && safeNumber(this.systemMetrics.memory.usage) < 85,
        activeUsers: new Set(ordered.map((l) => l?.usuario).filter(Boolean)).size,
      },
    }
  }

  getDashboardStats() {
    const now = new Date()
    const todayKey = getDayKey(now)
    const yesterdayKey = getDayKey(new Date(now.getTime() - 24 * 60 * 60 * 1000))

    const panel = getPanel()
    const logs = Array.isArray(panel.logs) ? panel.logs : []
    const logsToday = logs.filter((l) => safeString(l?.fecha).slice(0, 10) === todayKey)
    const logsYesterday = logs.filter((l) => safeString(l?.fecha).slice(0, 10) === yesterdayKey)

    const daily = panel?.dailyMetrics?.[todayKey] || null
    const dailyYesterday = panel?.dailyMetrics?.[yesterdayKey] || null

    const safePct = (current, previous) => {
      const c = safeNumber(current, 0)
      const p = safeNumber(previous, 0)
      if (p <= 0) return c > 0 ? 100 : 0
      return Math.round(((c - p) / p) * 100)
    }

    const panelUsers = Object.values(panel.users || {})
    const panelUsersCount = panelUsers.length
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const panelUsersActive = panelUsers.filter((u) => u?.last_login && new Date(u.last_login) >= oneDayAgo).length

    const db = global.db?.data || {}
    const whatsappUsers = Object.keys(db.users || {}).filter((jid) => safeString(jid).includes('@s.whatsapp.net')).length
    const chats = db.chats || {}
    const groupJids = Object.keys(chats).filter((jid) => safeString(jid).endsWith('@g.us'))
    const totalGrupos = panel?.groups ? Object.keys(panel.groups).length : groupJids.length
    const gruposActivos = groupJids.filter((jid) => chats?.[jid]?.isBanned !== true).length

    const aportes = Array.isArray(db.aportes) ? db.aportes : []
    const aportesHoy = aportes.filter((a) => safeString(a?.fecha_creacion || a?.created_at || a?.fecha || '').slice(0, 10) === todayKey).length
    const totalAportes = aportes.length

    const pedidosMap = panel?.pedidos && typeof panel.pedidos === 'object' ? panel.pedidos : {}
    const pedidos = Object.values(pedidosMap)
    const pedidosHoy = pedidos.filter((p) => safeString(p?.fecha_creacion || p?.created_at || p?.fecha || '').slice(0, 10) === todayKey).length
    const totalPedidos = pedidos.length

    const mensajesHoy = safeNumber(daily?.mensajes, logsToday.filter((l) => l?.tipo === 'mensaje').length)
    const comandosHoy = safeNumber(daily?.comandos, logsToday.filter((l) => l?.tipo === 'comando').length)

    const totalMensajes = panel?.dailyMetrics
      ? Object.values(panel.dailyMetrics).reduce((sum, d) => sum + safeNumber(d?.mensajes, 0), 0)
      : 0
    const totalComandos = panel?.dailyMetrics
      ? Object.values(panel.dailyMetrics).reduce((sum, d) => sum + safeNumber(d?.comandos, 0), 0)
      : 0

    const comunidadUsuarios = whatsappUsers
    const comunidadActivosHoy = new Set(logsToday.map((l) => l?.usuario).filter(Boolean)).size
    const comunidadActivosAyer = new Set(logsYesterday.map((l) => l?.usuario).filter(Boolean)).size

    const commandsTodayLogs = logsToday.filter((l) => l?.tipo === 'comando')
    const errorTodayLogs = commandsTodayLogs.filter((l) => l?.metadata?.success === false || l?.nivel === 'error')
    const errorRate = commandsTodayLogs.length > 0 ? (errorTodayLogs.length / commandsTodayLogs.length) * 100 : 0

    const since = Date.now() - 60 * 1000
    const throughput = commandsTodayLogs.filter((l) => {
      const t = new Date(l?.fecha || 0).getTime()
      return Number.isFinite(t) && t >= since
    }).length

    const responseTimes = commandsTodayLogs
      .map((l) => safeNumber(l?.metadata?.responseTime, NaN))
      .filter((n) => Number.isFinite(n) && n >= 0)
    const avgResponse = responseTimes.length ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0

    const disponibilidad = (global.stopped === 'open' || (global.conn && global.conn.user)) ? 100 : 0

    const mensajesPorHora = daily?.mensajesPorHora || {}
    const actividadPorHora = Array.from({ length: 12 }, (_, i) => {
      const h0 = String(i * 2).padStart(2, '0')
      const h1 = String(i * 2 + 1).padStart(2, '0')
      const value = safeNumber(mensajesPorHora[h0], 0) + safeNumber(mensajesPorHora[h1], 0)
      return { label: `${h0}:00`, value, color: '#6366f1' }
    })

    return {
      // Compat antiguos
      usuarios: panelUsersCount,
      grupos: totalGrupos,
      aportes: totalAportes,
      pedidos: totalPedidos,
      subbots: this.botMetrics.subbots.total,

      totalUsuarios: panelUsersCount,
      usuariosActivos: panelUsersActive,
      totalGrupos,
      totalAportes,
      totalPedidos,
      totalSubbots: this.botMetrics.subbots.total,
      gruposActivos,
      aportesHoy,
      pedidosHoy,
      mensajesHoy,
      comandosHoy,
      totalMensajes,
      totalComandos,
      actividadPorHora,

      comunidad: {
        usuariosWhatsApp: comunidadUsuarios,
        usuariosActivos: comunidadActivosHoy,
        mensajesHoy,
        comandosHoy,
        totalMensajes,
        totalComandos,

        // Compat UI actual
        gruposConBot: gruposActivos,
        mensajesRecibidos: mensajesHoy,
        comandosEjecutados: comandosHoy,
      },

      rendimiento: {
        tiempoRespuesta: avgResponse,
        disponibilidad,
        errorRate: Math.round(errorRate * 100) / 100,
        throughput,
      },

      tendencias: {
        usuarios: safePct(comunidadActivosHoy, comunidadActivosAyer),
        grupos: safePct(gruposActivos, gruposActivos),
        aportes: safePct(aportesHoy, 0),
        pedidos: safePct(pedidosHoy, 0),
        mensajes: safePct(mensajesHoy, safeNumber(dailyYesterday?.mensajes, 0)),
        comandos: safePct(comandosHoy, safeNumber(dailyYesterday?.comandos, 0)),
      },
    }
  }

  getSystemLogs(limit = 50, level = null) {
    const panel = getPanel()
    const src = Array.isArray(panel.logs) ? panel.logs : []

    const normalizeLevel = (v) => {
      const s = safeString(v).toLowerCase()
      if (s === 'warning') return 'warn'
      if (s === 'err') return 'error'
      return s || 'info'
    }

    const wanted = level ? normalizeLevel(level) : null

    const mappedAll = src
      .map((l) => {
        const timestamp = l?.timestamp || l?.fecha || new Date().toISOString()
        const lvl = normalizeLevel(l?.level || l?.nivel)
        if (wanted && lvl !== wanted) return null

        const tipo = safeString(l?.tipo || l?.category || l?.fuente || 'system')
        const category =
          tipo === 'comando' ? 'command' :
          tipo === 'mensaje' ? 'message' :
          tipo

        const comando = safeString(l?.comando || l?.metadata?.command || '').trim()
        const usuario = safeString(l?.usuario || '').trim()
        const usuarioShort = usuario ? usuario.split('@')[0] : ''

        const message =
          l?.message ||
          l?.mensaje ||
          (tipo === 'comando'
            ? `Comando ${comando || ''}${usuarioShort ? ` por ${usuarioShort}` : ''}`.trim()
            : (tipo === 'mensaje'
              ? `Mensaje${usuarioShort ? ` de ${usuarioShort}` : ''}`.trim()
              : safeString(l?.detalles || l?.details || tipo)))

        return {
          timestamp: new Date(timestamp).toISOString(),
          level: lvl || 'info',
          category,
          message,
          data: l?.data || l?.metadata || {},
          pid: l?.pid || process.pid,
          hostname: l?.hostname || os.hostname(),
          stack: Array.isArray(l?.stack) ? l.stack : undefined,
        }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

    const logs = mappedAll.slice(0, limit)
    const countByLevel = (lvl) => mappedAll.filter((l) => l.level === lvl).length
    const lastLogTime = mappedAll[0]?.timestamp || null

    const logsDir = path.join(process.cwd(), 'logs')
    const archivedDir = path.join(logsDir, 'archived')
    const logsDirStats = walkDirStats(logsDir)
    const archivedStats = walkDirStats(archivedDir)

    return {
      logs,
      total: mappedAll.length,
      stats: {
        totalLogs: mappedAll.length,
        errorCount: countByLevel('error'),
        warnCount: countByLevel('warn'),
        infoCount: countByLevel('info'),
        debugCount: countByLevel('debug'),
        traceCount: countByLevel('trace'),
        filesCreated: logsDirStats.fileCount,
        filesRotated: archivedStats.fileCount,
        filesCompressed: logsDirStats.compressedCount,
        lastLogTime: lastLogTime || new Date().toISOString(),
        uptime: Math.round(process.uptime() * 1000),
        bufferSize: 0,
        activeStreams: 0,
        diskUsage: {
          totalSize: logsDirStats.totalSize,
          fileCount: logsDirStats.fileCount,
          formattedSize: formatBytes(logsDirStats.totalSize),
        },
      },
    }
  }

  getScheduledTasks() {
    try {
      const tasks = typeof taskScheduler?.getAllTasks === 'function' ? taskScheduler.getAllTasks() : []
      const executions = typeof taskScheduler?.getExecutions === 'function' ? taskScheduler.getExecutions(100) : []
      return { tasks, executions }
    } catch {
      return { tasks: [], executions: [] }
    }
  }

  getMonitoringAlerts() {
    const states = resourceMonitor?.alertStates || {}
    const thresholds = resourceMonitor?.thresholds || {
      cpu: { warning: 60, critical: 80 },
      memory: { warning: 70, critical: 85 },
      disk: { warning: 75, critical: 90 },
    }
    const lastAlertTimes = resourceMonitor?.lastAlertTimes || {}
    const nowIso = new Date().toISOString()

    const rules = Object.entries(thresholds).map(([resource, th]) => ({
      id: `threshold_${resource}`,
      name: `${resource.toUpperCase()} threshold`,
      description: `Alerta por umbrales de ${resource}`,
      type: 'threshold',
      severity: 3,
      metric: `${resource}.usage`,
      condition: '>',
      threshold: th?.warning,
      duration: 0,
      enabled: true,
      actions: [],
      tags: [resource, 'performance'],
      triggerCount: 0,
      lastTriggered: lastAlertTimes?.[resource] ? new Date(lastAlertTimes[resource]).toISOString() : null,
    }))

    const metricValues = {
      cpu: safeNumber(this.systemMetrics.cpu.usage),
      memory: safeNumber(this.systemMetrics.memory.usage),
      disk: safeNumber(this.systemMetrics.disk.usage),
    }

    const toSeverity = (state) => (state === 'critical' ? 4 : state === 'warning' ? 2 : 1)

    const alerts = Object.entries(states)
      .filter(([, state]) => state && state !== 'normal')
      .map(([resource, state]) => ({
        id: `${resource}_${state}`,
        ruleId: `threshold_${resource}`,
        ruleName: `${resource.toUpperCase()} threshold`,
        type: 'threshold',
        severity: toSeverity(state),
        state: state === 'warning' || state === 'critical' ? 'active' : 'resolved',
        message: `El uso de ${resource} es ${metricValues[resource].toFixed(1)}% (${state})`,
        details: {
          metric: `${resource}.usage`,
          value: metricValues[resource],
          threshold: thresholds?.[resource]?.[state === 'critical' ? 'critical' : 'warning'],
          condition: '>',
        },
        triggeredAt: lastAlertTimes?.[resource] ? new Date(lastAlertTimes[resource]).toISOString() : nowIso,
        tags: [resource, 'performance'],
      }))

    return { alerts, rules }
  }

  generateMetricsHistory() {
    try {
      const hist = typeof resourceMonitor?.getHistoricalData === 'function'
        ? resourceMonitor.getHistoricalData(60)
        : (Array.isArray(resourceMonitor?.historicalData) ? resourceMonitor.historicalData.slice(-60) : [])

      if (Array.isArray(hist) && hist.length) {
        return hist.map((h) => ({ timestamp: h?.timestamp, cpu: h?.cpu, memory: h?.memory, disk: h?.disk }))
      }

      const panel = getPanel()
      const fromDb = Array.isArray(panel.metricsHistory) ? panel.metricsHistory.slice(-60) : []
      return fromDb.map((h) => ({ timestamp: h?.timestamp, cpu: h?.cpu, memory: h?.memory, disk: h?.disk }))
    } catch {
      return []
    }
  }

  getResourceMetrics() {
    const cpu0 = os.cpus()[0] || {}
    return {
      current: {
        timestamp: Date.now(),
        cpu: {
          usage: safeNumber(this.systemMetrics.cpu.usage),
          cores: safeNumber(this.systemMetrics.cpu.cores),
          model: this.systemMetrics.cpu.model,
          speed: safeNumber(cpu0.speed, 0),
          loadAverage: os.loadavg(),
        },
        memory: {
          total: safeNumber(this.systemMetrics.memory.total),
          free: safeNumber(this.systemMetrics.memory.free),
          used: safeNumber(this.systemMetrics.memory.used),
          usage: safeNumber(this.systemMetrics.memory.usage),
          process: {
            rss: process.memoryUsage().rss,
            heapTotal: process.memoryUsage().heapTotal,
            heapUsed: process.memoryUsage().heapUsed,
            external: process.memoryUsage().external,
            arrayBuffers: process.memoryUsage().arrayBuffers || 0,
          },
        },
        disk: this.systemMetrics.disk,
        network: this.systemMetrics.network,
        process: {
          uptime: process.uptime(),
          pid: process.pid,
          version: process.version,
          platform: process.platform,
          arch: process.arch,
          cwd: process.cwd(),
          startTime: Date.now() - (process.uptime() * 1000),
          restarts: safeNumber(resourceMonitor?.processMetrics?.restarts, 0),
          errors: safeNumber(resourceMonitor?.processMetrics?.errors, 0),
          connections: safeNumber(resourceMonitor?.processMetrics?.connections, 0),
        },
        bot: {
          connection: {
            status: this.botMetrics.status,
            phoneNumber: this.botMetrics.phoneNumber,
            qrStatus: null,
          },
          database: {
            users: this.databaseStats.users,
            groups: this.databaseStats.groups,
            chats: this.databaseStats.chats,
          },
          subbots: this.botMetrics.subbots,
        },
        system: {
          uptime: this.systemMetrics.uptime,
          loadavg: os.loadavg(),
          platform: this.systemMetrics.platform,
          arch: this.systemMetrics.arch,
          hostname: this.systemMetrics.network.hostname,
        },
      },
      alerts: resourceMonitor?.alertStates || {},
      thresholds: resourceMonitor?.thresholds || {},
      isMonitoring: Boolean(resourceMonitor?.isMonitoring),
      updateInterval: safeNumber(resourceMonitor?.updateInterval, 0),
      history: this.generateMetricsHistory(),
    }
  }
}

const realTimeData = new RealTimeDataManager()
realTimeData.start()

process.on('SIGINT', () => {
  realTimeData.stop()
  process.exit(0)
})

process.on('SIGTERM', () => {
  realTimeData.stop()
  process.exit(0)
})

export default realTimeData
