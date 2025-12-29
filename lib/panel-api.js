import http from 'http'
import crypto from 'crypto'
import os from 'os'
import fs from 'fs'
import path from 'path'
import qrcode from 'qrcode'
import mime from 'mime-types'
import chalk from 'chalk'
import axios from 'axios'
import jwt from 'jsonwebtoken'
import { initSocketIO, emitBotStatus, emitBotQR, emitBotConnected, emitBotDisconnected, emitSubbotCreated, emitSubbotQR, emitSubbotPairingCode, emitSubbotConnected, emitSubbotDisconnected, emitSubbotDeleted, emitAporteCreated, emitAporteUpdated, emitPedidoCreated, emitPedidoUpdated, emitGrupoUpdated, emitNotification, emitLogEntry } from './socket-io.js'
import auditLogger, { AUDIT_EVENTS, logAuth, logUserAction, logBotAction, logSystemAction, logSecurityEvent, logApiAccess } from './audit-logger.js'
import { PERMISSIONS, ROLES, hasPermission, canAccessResource, requirePermissions, validateRoleTransition, canManageUser, getUserPermissions } from './roles-permissions.js'
import realTimeData from './real-time-data.js'

// Helper para parsear JSON (compatibilidad con database.js)
function parseJsonValue(value, fallback = {}) {
  if (value == null) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

// Real system imports - Re-enabling with proper error handling
let notificationSystem, taskScheduler, backupSystem, alertSystem;
let NOTIFICATION_TYPES, NOTIFICATION_CATEGORIES;

// Initialize systems with error handling
async function initializeSystems() {
  try {
    const notifModule = await import('./notification-system.js');
    notificationSystem = notifModule.default;
    global.sendTemplateNotification = notifModule.sendTemplateNotification;
    NOTIFICATION_TYPES = notifModule.NOTIFICATION_TYPES;
    NOTIFICATION_CATEGORIES = notifModule.NOTIFICATION_CATEGORIES;
  } catch (err) {
    console.warn('Notification system not available:', err.message);
    notificationSystem = { send: () => Promise.resolve(), isRunning: false, start: () => {} };
    global.sendTemplateNotification = () => Promise.resolve();
    NOTIFICATION_TYPES = { INFO: 'info', SUCCESS: 'success', WARNING: 'warning', ERROR: 'error', CRITICAL: 'critical' };
    NOTIFICATION_CATEGORIES = { SYSTEM: 'system', BOT: 'bot', USER: 'user', SECURITY: 'security' };
  }

  try {
    const taskModule = await import('./task-scheduler.js');
    taskScheduler = taskModule.default;
  } catch (err) {
    console.warn('Task scheduler not available:', err.message);
    taskScheduler = { getAllTasks: () => [], isRunning: false, createTask: () => Promise.resolve(), executeTask: () => Promise.resolve() };
  }

  try {
    const backupModule = await import('./backup-system.js');
    backupSystem = backupModule.default;
  } catch (err) {
    console.warn('Backup system not available:', err.message);
    backupSystem = { isRunning: false, createBackup: () => Promise.resolve(), getBackups: () => [] };
  }

  try {
    const alertModule = await import('./alert-system.js');
    alertSystem = alertModule.default;
  } catch (err) {
    console.warn('Alert system not available:', err.message);
    alertSystem = { getAllAlerts: () => [], collectMetrics: () => Promise.resolve({}), isRunning: false };
  }
}

// Initialize systems on startup
initializeSystems();

let panelServer = null
const sseClients = {
  aportes: new Set(),
  notificaciones: new Set(),
}

function sseSend(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

function sseBroadcast(channel, payload) {
  const clients = sseClients[channel]
  if (!clients) return
  
  for (const res of [...clients]) {
    try {
      sseSend(res, payload)
    } catch {
      clients.delete(res)
    }
  }
}

function sseInit(req, res, channel) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.write('\n')

  const clients = sseClients[channel]
  clients.add(res)

  const keepAliveMs = clampInt(process.env.PANEL_SSE_KEEPALIVE_MS, { min: 5000, max: 120000, fallback: 25000 })
  const keepAlive = setInterval(() => {
    try {
      res.write(':keep-alive\n\n')
    } catch {}
  }, keepAliveMs)

  req.on('close', () => {
    clearInterval(keepAlive)
    clients.delete(res)
  })
}

	function json(res, statusCode, data) {
	  const body = JSON.stringify(data ?? {})
	  res.statusCode = statusCode
	  res.setHeader('Content-Type', 'application/json; charset=utf-8')
	  res.setHeader('Content-Length', Buffer.byteLength(body))
	  res.end(body)
	}

function withCors(req, res) {
  const origin = req.headers.origin
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'https://oguricap.ooguy.com',
    'http://oguricap.ooguy.com',
  ]
  
  // Verificar si el origin está en la lista permitida o es un túnel de desarrollo
  const isDevelopmentTunnel = origin && (origin.includes('.loca.lt') || origin.includes('.ngrok.io'))
  const isAllowedOrigin = origin && allowedOrigins.includes(origin)
  const isOoguyDomain = origin && origin.includes('ooguy.com')
  
  if (isAllowedOrigin || isOoguyDomain || (process.env.NODE_ENV !== 'production' && isDevelopmentTunnel)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  } else if (!origin) {
    // Para requests sin origin (como Postman, curl, etc.)
    res.setHeader('Access-Control-Allow-Origin', '*')
  } else {
    // Origin no permitido
    res.setHeader('Access-Control-Allow-Origin', 'null')
  }
  
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Max-Age', '86400') // Cache preflight por 24 horas
  
  // Headers de seguridad adicionales
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  
  // Solo en producción, agregar HSTS
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
  }
  
  if (req.method === 'OPTIONS') {
    res.statusCode = 204
    res.end()
    return true
  }
  return false
}

function getBearerToken(req) {
  const auth = req.headers.authorization || ''
  const [, token] = auth.match(/^Bearer\s+(.+)$/i) || []
  return token || ''
}

function isAuthorized(req) {
  const key = process.env.PANEL_API_KEY || ''
  if (!key) return true
  const token = getBearerToken(req)
  if (!token) return false
  if (token === key) return true

  // Aceptar JWT válido aunque exista PANEL_API_KEY (frontend usa JWT)
  try {
    if (token.includes('.')) {
      const jwtSecret = process.env.JWT_SECRET || 'default-secret'
      const decoded = jwt.verify(token, jwtSecret)
      const username = decoded && typeof decoded === 'object' ? decoded.username : null
      if (username) return true
    }
  } catch {
    return false
  }

  return false
}

function getTokenFromRequest(req, url) {
  const headerToken = getBearerToken(req)
  if (headerToken) return headerToken
  const queryToken = url?.searchParams?.get('token') || ''
  return queryToken
}

function getActorFromRequest(req, url, panelDb) {
  const token = getTokenFromRequest(req, url)
  if (!token) return { type: 'anonymous', username: 'anonymous' }

  const hardKey = process.env.PANEL_API_KEY || ''
  if (hardKey && token === hardKey) return { type: 'api_key', username: 'api-admin' }

  if (panelDb?.authToken && token === panelDb.authToken) {
    const users = Object.values(panelDb?.users || {})
    const adminUser = users.find((u) => u && ['owner', 'admin', 'administrador'].includes(u.rol))
    return { type: 'panel_token', username: safeString(adminUser?.username || 'panel-admin') }
  }

  if (token.includes('.')) {
    try {
      const jwtSecret = process.env.JWT_SECRET || 'default-secret'
      const decoded = jwt.verify(token, jwtSecret)
      const username = decoded && typeof decoded === 'object' ? decoded.username : null
      return { type: 'jwt', username: safeString(username || 'jwt-user') }
    } catch {
      return { type: 'jwt', username: 'jwt-user' }
    }
  }

  return { type: 'unknown', username: 'unknown' }
}

function isAuthorizedSoft(req, url, panelDb) {
  const hardKey = process.env.PANEL_API_KEY || ''
  const token = getTokenFromRequest(req, url)

  // Con PANEL_API_KEY configurada: permitir hardKey o JWT válido del frontend
  if (hardKey && token === hardKey) return true
  if (!token) return !hardKey
  if (panelDb?.authToken && token === panelDb.authToken) return true

  // Si el frontend manda JWT (Bearer), permitirlo cuando es válido.
  // Verificar desde PostgreSQL directamente para evitar problemas de sincronización
  try {
    if (token.includes('.')) {
      const jwtSecret = process.env.JWT_SECRET || 'default-secret'
      const decoded = jwt.verify(token, jwtSecret)
      const username = decoded && typeof decoded === 'object' ? decoded.username : null
      if (username) {
        // Verificar desde memoria primero (más rápido)
        const usuarios = global.db?.data?.usuarios || {}
        const exists = Object.values(usuarios).some((u) => u?.username === username && u?.activo !== false)
        if (exists) return true
        
        // Si no está en memoria, verificar en PostgreSQL (async, pero solo si es necesario)
        // Por ahora retornamos true si el JWT es válido para evitar redirecciones constantes
        // El usuario será verificado en endpoints más críticos
        return true
      }
    }
  } catch (error) {
    // Token inválido o expirado - no loguear para evitar spam
    return false
  }
  return false
}

function roleLevelJwt(rol) {
  const role = safeString(rol || 'usuario').toLowerCase()
  const hierarchy = { owner: 4, admin: 3, moderador: 2, creador: 2, usuario: 1 }
  return hierarchy[role] || 1
}

function sanitizeJwtUsuario(user) {
  return {
    id: Number(user?.id || 0),
    username: safeString(user?.username || ''),
    whatsapp_number: safeString(user?.whatsapp_number || ''),
    rol: safeString(user?.rol || 'usuario'),
    fecha_registro: user?.fecha_registro || user?.created_at || new Date().toISOString(),
    created_at: user?.created_at || user?.fecha_registro || new Date().toISOString(),
    activo: user?.activo !== false,
    last_login: user?.last_login || null,
    require_password_change: user?.require_password_change || false,
  }
}

async function getJwtAuth(req) {
  const token = getBearerToken(req)
  if (!token) return { ok: false, status: 401, error: 'Token requerido' }

  try {
    const jwt = (await import('jsonwebtoken')).default
    const jwtSecret = process.env.JWT_SECRET || 'default-secret'
    const decoded = jwt.verify(token, jwtSecret)
    const username = decoded && typeof decoded === 'object' ? decoded.username : null
    if (!username) return { ok: false, status: 403, error: 'Token invalido' }

    // Verificar desde memoria primero (más rápido)
    const usuarios = global.db?.data?.usuarios || {}
    let user = Object.values(usuarios).find((u) => u?.username === username && u?.activo !== false)
    
    // Si no está en memoria o está inactivo, verificar en PostgreSQL
    if (!user && global.db?.pool) {
      try {
        const result = await global.db.pool.query(
          'SELECT * FROM usuarios WHERE username = $1 AND activo = true',
          [username]
        )
        if (result.rows.length > 0) {
          const dbUser = result.rows[0]
          user = {
            id: dbUser.id,
            username: dbUser.username,
            password: dbUser.password,
            rol: dbUser.rol,
            whatsapp_number: dbUser.whatsapp_number,
            fecha_registro: dbUser.fecha_registro,
            activo: dbUser.activo,
            last_login: dbUser.last_login,
            require_password_change: dbUser.require_password_change,
            ...parseJsonValue(dbUser.metadata, {})
          }
          // Actualizar en memoria para próximas consultas
          if (global.db?.data) {
            if (!global.db.data.usuarios) global.db.data.usuarios = {}
            global.db.data.usuarios[user.id] = user
          }
        }
      } catch (dbError) {
        // Si falla la consulta a PostgreSQL, continuar con lo que hay en memoria
        console.warn('Error verificando usuario en PostgreSQL:', dbError.message)
      }
    }
    
    if (!user) return { ok: false, status: 401, error: 'Usuario no encontrado o inactivo' }

    return { ok: true, user, usuarios, decoded }
  } catch (error) {
    // No loguear errores de JWT para evitar spam
    return { ok: false, status: 403, error: 'Token invalido' }
  }
}

async function readJson(req) {
  let raw = ''
  for await (const chunk of req) raw += chunk
  if (!raw) return {}
  return JSON.parse(raw)
}

async function readBodyBuffer(req, { limitBytes = 10 * 1024 * 1024 } = {}) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buf.length
    if (limitBytes && size > limitBytes) {
      const err = new Error('Body too large')
      err.code = 'LIMIT_BODY'
      throw err
    }
    chunks.push(buf)
  }
  return Buffer.concat(chunks)
}

function parseMultipartSingleFile(bodyBuffer, boundary) {
  if (!boundary) return null
  const boundaryBuf = Buffer.from(`--${boundary}`)
  let cursor = bodyBuffer.indexOf(boundaryBuf)
  while (cursor !== -1) {
    cursor += boundaryBuf.length
    if (bodyBuffer.slice(cursor, cursor + 2).toString() === '--') break
    if (bodyBuffer.slice(cursor, cursor + 2).toString() === '\r\n') cursor += 2

    const headerEnd = bodyBuffer.indexOf(Buffer.from('\r\n\r\n'), cursor)
    if (headerEnd === -1) break
    const headerText = bodyBuffer.slice(cursor, headerEnd).toString('utf8')
    const contentStart = headerEnd + 4

    const nextBoundary = bodyBuffer.indexOf(boundaryBuf, contentStart)
    if (nextBoundary === -1) break
    const contentEnd = Math.max(contentStart, nextBoundary - 2)
    const data = bodyBuffer.slice(contentStart, contentEnd)

    const nameMatch = /name="([^"]+)"/i.exec(headerText)
    const filenameMatch = /filename="([^"]*)"/i.exec(headerText)
    const typeMatch = /content-type:\s*([^\r\n]+)/i.exec(headerText)
    const fieldname = nameMatch ? nameMatch[1] : null
    const filename = filenameMatch ? filenameMatch[1] : null
    const mimeType = typeMatch ? typeMatch[1].trim() : null

    if (fieldname === 'file') return { fieldname, filename, mimeType, data }
    cursor = nextBoundary
  }
  return null
}

function sanitizeFilename(name) {
  const base = path.basename(safeString(name || 'file'))
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_')
  return cleaned || 'file'
}

function ensurePanelDb() {
  if (!global.db?.data) return null
  const panel = global.db.data.panel ||= {}

  panel.subbots ||= {}
  panel.subbotsCounter ||= 0

  panel.users ||= {}
  panel.usersCounter ||= 0

  panel.groups ||= {}
  panel.groupsCounter ||= 0

  panel.pedidos ||= {}
  panel.pedidosCounter ||= 0

  panel.proveedores ||= {}
  panel.proveedoresCounter ||= 0

  panel.logs ||= []
  panel.logsCounter ||= 0

  panel.notifications ||= {}
  panel.notificationsCounter ||= 0

  panel.notificationsConfig ||= {
    enableEmail: false,
    enableWebhook: false,
    enableSocket: true,
    alertThresholds: { cpu: 80, memory: 85, disk: 90 },
  }

  panel.configVersions ||= { system: [], bot: [], notifications: [] }

  panel.globalNotifications ||= {}
  panel.globalNotificationsCounter ||= 0

  panel.multimedia ||= {}
  panel.multimediaCounter ||= 0

  panel.botCommands ||= {}
  panel.botCommandsCounter ||= 0

  panel.ai ||= {}
  panel.ai.sessions ||= {}
  panel.ai.sessionsCounter ||= 0

  panel.botConfig ||= {
    autoReconnect: true,
    maxReconnectAttempts: 5,
    reconnectInterval: 30,
    logLevel: 'info',
    qrTimeout: 60,
    sessionTimeout: 3600,
  }

  panel.systemConfig ||= {
    maintenanceMode: false,
    debugMode: false,
    apiRateLimit: 100,
    fileUploadLimit: 10,
    sessionTimeout: 3600,
    adminIPs: [], // IPs permitidas durante mantenimiento
    allowLocalhost: true, // Permitir localhost siempre
  }

  panel.botGlobalState ||= { isOn: true, lastUpdated: null }
  panel.botGlobalOffMessage ||= 'El bot está desactivado globalmente por el administrador.'

  panel.whatsapp ||= {
    authMethod: 'qr',
    pairingPhone: null,
    pairingCode: null,
    pairingUpdatedAt: null,
  }

  if (!Object.keys(panel.users).length) {
    const now = new Date().toISOString()
    panel.usersCounter = Math.max(Number(panel.usersCounter || 0), 1)
    panel.users[1] ||= {
      id: 1,
      username: process.env.PANEL_ADMIN_USER || 'admin',
      email: 'admin@local',
      whatsapp_number: (global.owner?.[0] ? String(global.owner[0]).replace(/[^0-9]/g, '') : '') || '',
      rol: process.env.PANEL_ADMIN_ROLE || 'owner',
      fecha_registro: now,
      activo: true,
    }
  }

  return panel
}

function hashJson(value) {
  try {
    const raw = JSON.stringify(value ?? null)
    return crypto.createHash('sha256').update(raw).digest('hex')
  } catch {
    return ''
  }
}

function pushConfigVersion(panelDb, key, data, actor = 'system') {
  try {
    if (!panelDb) return
    panelDb.configVersions ||= { system: [], bot: [], notifications: [] }
    const list = Array.isArray(panelDb.configVersions[key]) ? panelDb.configVersions[key] : []
    const id = crypto.randomBytes(8).toString('hex')
    const version = {
      id,
      timestamp: new Date().toISOString(),
      userId: safeString(actor || 'system'),
      state: 'active',
      checksum: hashJson(data),
      data,
    }

    list.unshift(version)
    const max = clampInt(process.env.PANEL_CONFIG_VERSIONS_MAX, { min: 1, max: 500, fallback: 50 })
    if (list.length > max) list.splice(max)

    panelDb.configVersions[key] = list
    return version
  } catch {
    return null
  }
}

function pushPanelLog(panelDb, entry) {
  try {
    if (!panelDb) return
    panelDb.logs ||= []
    panelDb.logsCounter ||= 0

    panelDb.logs.push({
      id: panelDb.logsCounter++,
      fecha: new Date().toISOString(),
      nivel: 'info',
      ...entry,
    })

    const maxLogs = parseInt(process.env.PANEL_LOGS_MAX || '2000', 10)
    if (Number.isFinite(maxLogs) && maxLogs > 0 && panelDb.logs.length > maxLogs) {
      panelDb.logs.splice(0, panelDb.logs.length - maxLogs)
    }
  } catch {}
}

function nextId(panelDb, counterKey) {
  panelDb[counterKey] = (panelDb[counterKey] || 0) + 1
  return panelDb[counterKey]
}

function nextSubbotId(panelDb) {
  return nextId(panelDb, 'subbotsCounter')
}

function clampInt(value, { min = 1, max = Number.MAX_SAFE_INTEGER, fallback = 1 } = {}) {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

function normalizePairingCode(raw) {
  const text = safeString(raw || '').trim().toUpperCase()
  if (!text) return null
  const compact = text.replace(/[^A-Z0-9]/g, '')
  if (!compact) return null
  const groups = compact.match(/.{1,4}/g) || []
  return groups.join('-')
}

function isLikelyPairingCode(code) {
  const compact = safeString(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  // WhatsApp suele devolver un código numérico (8 dígitos), pero dejamos margen.
  return compact.length >= 6 && compact.length <= 20
}

function sanitizePairKey(value) {
  const compact = safeString(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!compact) return null
  if (compact.length < 4 || compact.length > 20) return null
  return compact
}

function isFreshTimestamp(ts, maxAgeMs) {
  if (!ts) return false
  const t = new Date(ts).getTime()
  if (!Number.isFinite(t)) return false
  return Date.now() - t <= maxAgeMs
}

function paginateArray(items, { page = 1, limit = 20 } = {}) {
  const safeItems = Array.isArray(items) ? items : []
  const total = safeItems.length
  const safeLimit = clampInt(limit, { min: 1, max: 200, fallback: 20 })
  const totalPages = Math.max(1, Math.ceil(total / safeLimit))
  const safePage = clampInt(page, { min: 1, max: totalPages, fallback: 1 })
  const start = (safePage - 1) * safeLimit
  return {
    items: safeItems.slice(start, start + safeLimit),
    pagination: { page: safePage, limit: safeLimit, total, totalPages },
  }
}

function safeString(value) {
  if (value == null) return ''
  return String(value)
}

function getClientIP(req) {
  // Obtener IP real considerando proxies (nginx) y Cloudflare
  const cfConnectingIP = req.headers['cf-connecting-ip']
  const cfRealIP = req.headers['cf-real-ip'] 
  const forwarded = req.headers['x-forwarded-for']
  const realIP = req.headers['x-real-ip']
  const remoteAddress = req.connection?.remoteAddress || req.socket?.remoteAddress
  
  // Priorizar headers de Cloudflare
  if (cfConnectingIP) return cfConnectingIP
  if (cfRealIP) return cfRealIP
  
  if (forwarded) {
    // x-forwarded-for puede contener múltiples IPs separadas por comas
    const ips = forwarded.split(',').map(ip => ip.trim())
    return ips[0] // La primera IP es la del cliente original
  }
  
  if (realIP) {
    return realIP
  }
  
  // Limpiar IPv6 localhost
  if (remoteAddress === '::1' || remoteAddress === '::ffff:127.0.0.1') {
    return '127.0.0.1'
  }
  
  return remoteAddress || 'unknown'
}

// Rate limiting simple en memoria
const rateLimitStore = new Map()

function isRateLimited(clientIP, endpoint, maxRequests = 10, windowMs = 60000) {
  const key = `${clientIP}:${endpoint}`
  const now = Date.now()
  
  if (!rateLimitStore.has(key)) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs })
    return false
  }
  
  const record = rateLimitStore.get(key)
  
  if (now > record.resetTime) {
    // Reset window
    record.count = 1
    record.resetTime = now + windowMs
    return false
  }
  
  record.count++
  
  if (record.count > maxRequests) {
    return true
  }
  
  return false
}

// Limpiar rate limit store cada 5 minutos
setInterval(() => {
  const now = Date.now()
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

// Detectar patrones de ataque
function detectSuspiciousActivity(req, clientIP) {
  const userAgent = req.headers['user-agent'] || ''
  const referer = req.headers.referer || ''
  const url = req.url || ''
  
  // Detectar bots maliciosos
  const maliciousBots = [
    'sqlmap', 'nikto', 'nmap', 'masscan', 'zap', 'burp',
    'acunetix', 'nessus', 'openvas', 'w3af', 'skipfish'
  ]
  
  if (maliciousBots.some(bot => userAgent.toLowerCase().includes(bot))) {
    console.warn(`🚨 Malicious bot detected: ${clientIP} - ${userAgent}`)
    return true
  }
  
  // Detectar intentos de path traversal
  if (url.includes('../') || url.includes('..\\') || url.includes('%2e%2e')) {
    console.warn(`🚨 Path traversal attempt: ${clientIP} - ${url}`)
    return true
  }
  
  // Detectar intentos de SQL injection básicos
  const sqlPatterns = ['union select', 'drop table', 'insert into', 'delete from', '1=1', '1\'=\'1']
  if (sqlPatterns.some(pattern => url.toLowerCase().includes(pattern))) {
    console.warn(`🚨 SQL injection attempt: ${clientIP} - ${url}`)
    return true
  }
  
  // Detectar intentos de XSS básicos
  if (url.includes('<script') || url.includes('javascript:') || url.includes('onerror=')) {
    console.warn(`🚨 XSS attempt: ${clientIP} - ${url}`)
    return true
  }
  
  return false
}

function isAllowedIP(clientIP, panelDb) {
  const config = panelDb?.systemConfig || {}
  
  // Siempre permitir localhost si está habilitado
  if (config.allowLocalhost !== false) {
    const localhostIPs = ['127.0.0.1', '::1', 'localhost']
    if (localhostIPs.includes(clientIP)) return true
  }
  
  // Verificar IPs de administradores
  const adminIPs = config.adminIPs || []
  return adminIPs.includes(clientIP)
}

function getUserRole(req, url, panelDb) {
  const token = getTokenFromRequest(req, url)
  const user = getUserFromToken(token, panelDb)
  return user?.rol || 'usuario'
}

function getUserFromToken(token, panelDb) {
  if (!token || !panelDb) return null
  
  // Verificar token de API hardcodeado
  const hardKey = process.env.PANEL_API_KEY || ''
  if (hardKey && token === hardKey) {
    return { rol: 'owner', username: 'api-admin', isApiToken: true }
  }
  
  // Verificar token de sesión
  if (panelDb.authToken && token === panelDb.authToken) {
    // Buscar usuario con rol de administrador
    const users = Object.values(panelDb?.users || {})
    const adminUser = users.find(u => u && ['owner', 'admin', 'administrador'].includes(u.rol))
    return adminUser || null
  }
  
  return null
}

// Middleware mejorado de autenticación y autorización
function authenticateAndAuthorize(req, url, panelDb, requiredPermissions = []) {
  const token = getTokenFromRequest(req, url)
  const user = getUserFromToken(token, panelDb)
  
  if (!user) {
    return { authorized: false, error: 'Token de autenticación requerido', status: 401 }
  }
  
  // Verificar permisos si se especifican
  if (requiredPermissions.length > 0) {
    if (!canAccessResource(user.rol, requiredPermissions)) {
      return { 
        authorized: false, 
        error: 'Permisos insuficientes', 
        status: 403,
        required: requiredPermissions,
        userRole: user.rol
      }
    }
  }
  
  // Agregar usuario a la request para uso posterior
  req.user = user
  
  return { authorized: true, user }
}

function isOwnerOrAdmin(req, url, panelDb) {
  const token = getTokenFromRequest(req, url)
  const user = getUserFromToken(token, panelDb)
  return user && ['owner', 'admin', 'administrador'].includes(user.rol)
}

function formatTimeAgo(dateString) {
  if (!dateString) return 'Hace tiempo'
  
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  
  if (diffMinutes < 1) return 'Ahora'
  if (diffMinutes < 60) return `Hace ${diffMinutes}m`
  if (diffHours < 24) return `Hace ${diffHours}h`
  if (diffDays < 7) return `Hace ${diffDays}d`
  return date.toLocaleDateString()
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

function makeSubbotCode() {
  return `sb_${crypto.randomBytes(4).toString('hex')}`
}

function getJadiRoot() {
  const jadiDir = global.jadi || 'Sessions/SubBot'
  return path.join(process.cwd(), jadiDir)
}

function listSessionDirs() {
  const root = getJadiRoot()
  if (!fs.existsSync(root)) return []
  return fs
    .readdirSync(root, { withFileTypes: true })
    // Evitar duplicados: el panel puede crear alias como symlink "Sessions/SubBot/<numero>" -> "<codigo>"
    .filter((d) => d.isDirectory() && !d.isSymbolicLink())
    .map((d) => d.name)
}

async function getParticipatingGroups() {
  const sock = global.conn
  
  if (!sock || typeof sock.groupFetchAllParticipating !== 'function') {
    return []
  }
  
  try {
    const all = await sock.groupFetchAllParticipating()
    const groups = Array.isArray(all) ? all : Object.values(all || {})
    const filtered = groups.filter((g) => g && (g.id || g.jid))
    return filtered
  } catch (error) {
    // Si es rate limit, marcar y no hacer log repetitivo
    if (error?.data === 429 || error?.message?.includes('rate-overlimit')) {
      if (!global.groupsRateLimit) {
        console.warn('getParticipatingGroups - Rate limit detected, will retry later')
      }
      global.groupsRateLimit = Date.now()
    } else {
      console.error('getParticipatingGroups - Error fetching groups:', error)
    }
    
    return []
  }
}

function ensureChatRecord(jid) {
  if (!global.db?.data?.chats) return null
  if (!global.db?.data) return null
  if (!global.db.data.chats) global.db.data.chats = {}
  global.db.data.chats[jid] ||= {}
  const chat = global.db.data.chats[jid]
  if (!('isBanned' in chat)) chat.isBanned = false
  return chat
}

async function syncGroups(panelDb) {
  // Verificar si hay rate limit reciente (no intentar por 5 minutos)
  const rateLimitTime = global.groupsRateLimit || 0
  const fiveMinutesAgo = Date.now() - (5 * 60 * 1000)
  
  if (rateLimitTime > fiveMinutesAgo) {
    return panelDb?.groups || {}
  }
  
  // Si no hay bot conectado, no intentar sync
  if (!global.conn || !global.conn.user) {
    return panelDb?.groups || {}
  }
  
  const groups = await getParticipatingGroups().catch((err) => {
    return []
  })
  
  // Si no hay grupos, marcar que se intentó y no volver a intentar por un tiempo
  if (groups.length === 0) {
    // Solo log la primera vez que no encuentra grupos
    if (!global.noGroupsLogged) {
      console.log('syncGroups - No groups found, bot may not be in any WhatsApp groups')
      global.noGroupsLogged = true
    }
    return panelDb?.groups || {}
  }
  
  // Si encontramos grupos, limpiar el flag
  if (global.noGroupsLogged) {
    delete global.noGroupsLogged
  }
  
  const now = new Date().toISOString()
  let newGroupsCount = 0
  let updatedGroupsCount = 0

  for (const group of groups) {
    const jid = group.id || group.jid
    if (!jid) continue
    const subject = group.subject || group.nombre || jid
    const desc = group.desc || group.descripcion || ''

    ensureChatRecord(jid)

    if (!panelDb.groups) panelDb.groups = {}
    if (!panelDb.groups[jid]) {
      const id = nextId(panelDb, 'groupsCounter')
      panelDb.groups[jid] = {
        id,
        wa_jid: jid,
        nombre: subject,
        descripcion: desc || '',
        es_proveedor: false,
        created_at: now,
        updated_at: now,
        usuario: null,
      }
      newGroupsCount++
    } else {
      // Solo actualizar si hay cambios reales
      const existing = panelDb.groups?.[jid]
      if (existing && (existing.nombre !== subject || existing.descripcion !== desc)) {
        existing.wa_jid = jid
        existing.nombre = subject
        if (typeof desc === 'string') existing.descripcion = desc
        existing.updated_at = now
        updatedGroupsCount++
      }
    }
  }

  // Solo log si hay cambios significativos (más de 1 grupo nuevo o 5 actualizados)
  if (newGroupsCount > 1 || updatedGroupsCount > 5) {
    console.log(`syncGroups - Added ${newGroupsCount} new groups, updated ${updatedGroupsCount} groups`)
  }

  // Limpiar el rate limit si la sincronización fue exitosa
  if (global.groupsRateLimit) {
    delete global.groupsRateLimit
  }

  return panelDb.groups
}

// Función para sincronizar grupos solo cuando es realmente necesario
async function syncGroupsOnDemand(panelDb, force = false) {
  // Si no es forzado, verificar si realmente necesitamos sincronizar
  if (!force) {
    const lastSync = global.lastGroupsSync || 0
    const twentyMinutesAgo = Date.now() - (20 * 60 * 1000) // Aumentar a 20 minutos
    
    // Si ya tenemos grupos y la última sync fue hace menos de 20 minutos, no hacer nada
    if (lastSync > twentyMinutesAgo && panelDb?.groups && Object.keys(panelDb.groups).length > 0) {
      return panelDb.groups
    }
    
    // Si no hay conexión de bot, no intentar sync
    if (!global.conn || !global.conn.user) {
      return panelDb?.groups || {}
    }
    
    // Si hay rate limit activo, no intentar
    const rateLimitTime = global.groupsRateLimit || 0
    const rateLimitExpiry = Date.now() - (10 * 60 * 1000)
    if (rateLimitTime > rateLimitExpiry) {
      return panelDb?.groups || {}
    }
  }
  
  return await syncGroupsSafe(panelDb)
}

// Función wrapper para sincronización con throttling mejorado
async function syncGroupsSafe(panelDb) {
  // Solo sincronizar si han pasado al menos 10 minutos desde la última sincronización
  const lastSync = global.lastGroupsSync || 0
  const tenMinutesAgo = Date.now() - (10 * 60 * 1000)
  
  if (lastSync > tenMinutesAgo) {
    // No hacer log para evitar spam - solo retornar grupos existentes
    return panelDb?.groups || {}
  }
  
  // Verificar si hay rate limit activo
  const rateLimitTime = global.groupsRateLimit || 0
  const rateLimitExpiry = Date.now() - (10 * 60 * 1000) // Esperar 10 minutos en lugar de 5
  
  if (rateLimitTime > rateLimitExpiry) {
    // Rate limit activo, no intentar sync
    return panelDb?.groups || {}
  }
  
  // Si no hay bot conectado, no intentar
  if (!global.conn || !global.conn.user) {
    return panelDb?.groups || {}
  }
  
  // Marcar el tiempo de sincronización
  global.lastGroupsSync = Date.now()
  
  try {
    return await syncGroups(panelDb)
  } catch (error) {
    // Solo log errores críticos, no rate limits
    if (error?.data !== 429 && !error?.message?.includes('rate-overlimit')) {
      console.error('syncGroupsSafe - Critical error:', error)
    }
    return panelDb?.groups || {}
  }
}

function findConnBySubbotCode(code) {
  const conns = Array.isArray(global.conns) ? global.conns : []
  const normalized = String(code || '').trim()
  const phonePart = normalized.split('@')[0]
  return (
    conns.find((sock) => sock?.subbotCode === normalized) ||
    conns.find((sock) => path.basename(sock?.sessionPath || '') === normalized) ||
    conns.find((sock) => safeString(sock?.sessionAliasDir || '') === normalized) ||
    conns.find((sock) => path.basename(safeString(sock?.sessionAliasPath || '')) === normalized) ||
    conns.find((sock) => String(sock?.user?.jid || '').split('@')[0] === phonePart) ||
    conns.find((sock) => String(sock?.authState?.creds?.me?.id || '').split('@')[0] === phonePart) ||
    null
  )
}

function normalizeSubbotForPanel(record, { isOnline }) {
  const codigo = record.codigo || record.code || record.subbotCode || record.id
  const tipo = record.tipo || record.type || 'qr'
  const estado = isOnline ? 'activo' : (record.qr_data || record.pairingCode ? 'activo' : (record.estado || 'inactivo'))
  const fecha = record.fecha_creacion || record.created_at || new Date().toISOString()
  const usuario = record.usuario || record.owner || 'admin'
  const numero = record.numero || record.phoneNumber || record.phone_number || null
  const nombreWhatsapp = record.nombre_whatsapp || record.whatsappName || record.nombreWhatsapp || null
  const aliasDir = record.alias_dir || record.aliasDir || null
  const pairingCode = record.pairingCode || record.pairing_code || null
  const qrData = record.qr_data || record.qrCode || record.qr_code || null

  return {
    id: record.id,
    code: codigo,
    codigo,
    tipo,
    type: tipo,
    estado,
    status: estado,
    usuario,
    fecha_creacion: fecha,
    created_at: fecha,
    numero,
    phoneNumber: numero,
    nombre_whatsapp: nombreWhatsapp,
    whatsappName: nombreWhatsapp,
    alias_dir: aliasDir,
    aliasDir,
    qr_data: qrData,
    qr_code: qrData,
    pairingCode,
    pairing_code: pairingCode,
    isOnline: Boolean(isOnline),
  }
}

function ensureAportesStore() {
  if (!global.db?.data) return null
  if (!Array.isArray(global.db.data.aportes)) global.db.data.aportes = []
  if (!global.db.data.aportesCounter) {
    const lastId = global.db.data.aportes.reduce((max, item) => Math.max(max, item?.id || 0), 0)
    global.db.data.aportesCounter = lastId + 1
  }
  return global.db.data.aportes
}

function mapAporteForPanel(entry, panelDb) {
  const jid = entry?.grupo || null
  const grupoNombre = jid && panelDb?.groups?.[jid]?.nombre ? panelDb.groups[jid].nombre : null
  const contenido = safeString(entry?.contenido || '')
  const titulo = safeString(entry?.titulo || '') || (contenido || '(sin contenido)').slice(0, 48)

  return {
    id: Number(entry?.id || 0),
    titulo,
    descripcion: safeString(entry?.descripcion || ''),
    contenido,
    tipo: safeString(entry?.tipo || 'otro'),
    fuente: safeString(entry?.fuente || (jid ? 'grupo' : 'privado')),
    estado: safeString(entry?.estado || 'pendiente'),
    usuario: safeString(entry?.usuario || ''),
    fecha_creacion: entry?.fecha_creacion || entry?.fecha || entry?.created_at || new Date().toISOString(),
    fecha_actualizacion: entry?.updated_at || entry?.fecha_actualizacion || entry?.fecha || entry?.created_at || null,
    grupo_id: null,
    grupo_nombre: grupoNombre,
    archivo: entry?.archivo || null,
  }
}

function computeBreakdown(items, key) {
  const map = new Map()
  for (const item of items) {
    const k = safeString(item?.[key] || '')
    if (!k) continue
    map.set(k, (map.get(k) || 0) + 1)
  }
  return [...map.entries()].map(([k, count]) => ({ [key]: k, count }))
}

function computeAportesStats(mapped) {
  const total = mapped.length
  const estados = new Map()
  for (const a of mapped) estados.set(a.estado, (estados.get(a.estado) || 0) + 1)
  return {
    total,
    pendientes: estados.get('pendiente') || 0,
    aprobados: estados.get('aprobado') || 0,
    rechazados: estados.get('rechazado') || 0,
    por_tipo: computeBreakdown(mapped, 'tipo'),
    por_estado: computeBreakdown(mapped, 'estado'),
  }
}

function normalizePedidoForPanel(raw, idFallback) {
  const now = new Date().toISOString()
  const id = Number(raw?.id ?? idFallback ?? 0) || 0

  const fechaCreacion = safeString(raw?.fecha_creacion || raw?.created_at || raw?.fecha || now)
  const fechaActualizacion = safeString(raw?.fecha_actualizacion || raw?.updated_at || raw?.fecha_actualizacion || fechaCreacion)

  const estadoRaw = safeString(raw?.estado || raw?.status || 'pendiente')
  const estado = ['pendiente', 'en_proceso', 'completado', 'cancelado'].includes(estadoRaw) ? estadoRaw : 'pendiente'

  const prioridadRaw = safeString(raw?.prioridad || raw?.priority || 'media')
  const prioridad = ['baja', 'media', 'alta'].includes(prioridadRaw) ? prioridadRaw : 'media'

  const tipo = safeString(raw?.tipo || raw?.type || 'otro')
  const titulo = safeString(raw?.titulo || raw?.title || '').trim() || (id ? `Pedido #${id}` : 'Pedido')

  return {
    id,
    titulo,
    descripcion: safeString(raw?.descripcion || raw?.description || ''),
    tipo,
    estado,
    usuario: safeString(raw?.usuario || raw?.user || ''),
    fecha_creacion: fechaCreacion || now,
    fecha_actualizacion: fechaActualizacion || null,
    prioridad,
    votos: Number(raw?.votos || raw?.votes || 0) || 0,
    grupo_id: raw?.grupo_id ?? raw?.grupoId ?? null,
    grupo_nombre: safeString(raw?.grupo_nombre || raw?.grupoNombre || ''),
  }
}

async function getSubbotsList() {
  if (!global.db?.data && typeof global.loadDatabase === 'function') await global.loadDatabase()
  const panelDb = ensurePanelDb()
  if (!panelDb) return []

  const sessionDirs = listSessionDirs()
  if (!panelDb) return []
  if (!panelDb.subbots) panelDb.subbots = {}
  for (const dirName of sessionDirs) {
    if (panelDb.subbots[dirName]) continue
    const fullPath = path.join(getJadiRoot(), dirName)
    const credsPath = path.join(fullPath, 'creds.json')
    if (!fs.existsSync(credsPath)) continue
    const stats = fs.statSync(fullPath)
    panelDb.subbots[dirName] = {
      id: nextSubbotId(panelDb),
      code: dirName,
      codigo: dirName,
      tipo: 'qr',
      usuario: 'auto',
      fecha_creacion: (stats.birthtime || stats.mtime || new Date()).toISOString(),
      session_dir: dirName,
    }
  }

  const result = Object.entries(panelDb?.subbots || {})
    .map(([key, rec]) => {
      const code = rec.codigo || rec.code || rec.subbotCode || rec.id || key
      if (!rec.codigo) rec.codigo = code
      if (!rec.code) rec.code = code

      const sock = code ? findConnBySubbotCode(code) : null
      // En algunos forks `sock.user` puede quedar undefined aunque la conexión esté abierta.
      const isOnline = Boolean(sock && (sock.user || sock.isInit || sock.ws?.readyState === 1))
      if (isOnline) {
        const jid = sock?.user?.jid || sock?.authState?.creds?.me?.id || null
        if (jid) {
          const phone = String(jid).split('@')[0]
          rec.numero = rec.numero || phone
        }
        const name = safeString(sock?.authState?.creds?.me?.name || '').trim()
        if (name) rec.nombre_whatsapp = rec.nombre_whatsapp || name
        rec.estado = rec.estado || 'activo'
      }
      return normalizeSubbotForPanel(rec, { isOnline })
    })
    .sort((a, b) => (b.id || 0) - (a.id || 0))

  return result
}

function resolveSubbotRecordByParam(panelDb, idOrCode) {
  const param = String(idOrCode || '').trim()
  if (!param || !panelDb) return null
  const subbots = panelDb.subbots || {}
  if (subbots[param]) return subbots[param]
  const asNumber = Number(param)
  if (Number.isFinite(asNumber)) {
    const found = Object.values(subbots).find((r) => r && Number(r.id) === asNumber)
    if (found) return found
  }
  const found = Object.values(subbots).find((r) => r && (r.code === param || r.codigo === param))
  return found || null
}

async function deleteSubbotByCode(code) {
  if (!global.db?.data && typeof global.loadDatabase === 'function') await global.loadDatabase()
  const panelDb = ensurePanelDb()
  if (!panelDb) return { success: false, error: 'DB no disponible' }

  const record = resolveSubbotRecordByParam(panelDb, code)
  if (!record) return { success: false, error: 'Subbot no encontrado' }

  const realCode = record.codigo || record.code
  const sock = realCode ? findConnBySubbotCode(realCode) : null
  if (sock) {
    try {
      await sock.logout()
    } catch {}
    const idx = global.conns?.indexOf(sock)
    if (typeof idx === 'number' && idx >= 0) global.conns.splice(idx, 1)
  }

  const sessionDir = record.session_dir || realCode
  if (sessionDir) {
    const sessionPath = path.join(getJadiRoot(), sessionDir)
    try {
      if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true })
    } catch {}
  }

  // Si existe un alias por número (symlink), eliminarlo también
  try {
    const phone = safeString(record.numero).replace(/[^0-9]/g, '')
    if (phone) {
      const aliasPath = path.join(getJadiRoot(), phone)
      if (fs.existsSync(aliasPath) && fs.lstatSync(aliasPath).isSymbolicLink()) {
        fs.rmSync(aliasPath, { recursive: false, force: true })
      }
    }
  } catch {}

  // Si existe un alias por nombre (o custom) guardado, eliminarlo también
  try {
    const aliasDir = safeString(record.alias_dir || record.aliasDir || '').trim()
    if (aliasDir) {
      const aliasPath = path.join(getJadiRoot(), aliasDir)
      if (fs.existsSync(aliasPath) && fs.lstatSync(aliasPath).isSymbolicLink()) {
        fs.rmSync(aliasPath, { recursive: false, force: true })
      }
    }
  } catch {}

  if (realCode && panelDb?.subbots?.[realCode]) {
    if (!panelDb.subbots) panelDb.subbots = {}
    delete panelDb.subbots[realCode]
  }
  return { success: true }
}

async function callAiApi(message, model = 'gpt-3.5-turbo', temperature = 0.7, maxTokens = 1000, conversationHistory = []) {
  try {
    // Usar configuración de APIs desde global.APIs (settings.js)
    const APIs = global.APIs || {
      delirius: { url: "https://api.delirius.store", key: null },
      zenzxz: { url: "https://api.zenzxz.my.id", key: null },
      adonix: { url: "https://api-adonix.ultraplus.click", key: 'Yuki-WaBot' }
    }

    // Mapeo de modelos a APIs
    const modelToApi = {
      'gpt-3.5-turbo': 'delirius',
      'gpt-4': 'delirius', 
      'chatgpt': 'delirius',
      'gemini': 'zenzxz',
      'claude': 'zenzxz',
      'luminai': 'zenzxz',
      'qwen': 'zenzxz'
    }

    const apiProvider = modelToApi[model] || 'delirius'
    const api = APIs[apiProvider]

    if (!api) {
      throw new Error(`API provider ${apiProvider} no configurado`)
    }

    let response
    let tokensUsed = 0

    switch (apiProvider) {
      case 'delirius':
        // Usar API de Delirius para ChatGPT
        const basePrompt = `Eres un asistente de IA inteligente y útil. Responde de manera clara y concisa.`
        const deliriusUrl = `${api.url}/ia/gptprompt?text=${encodeURIComponent(message)}&prompt=${encodeURIComponent(basePrompt)}`
        
        const deliriusRes = await axios.get(deliriusUrl, { timeout: 30000 })
        
        if (!deliriusRes.data?.status || !deliriusRes.data?.data) {
          throw new Error('Respuesta inválida de Delirius API')
        }
        
        response = deliriusRes.data.data
        tokensUsed = Math.ceil(message.length / 4) + Math.ceil(response.length / 4) // Estimación de tokens
        break

      case 'zenzxz':
        // Usar API de ZenzXZ para Gemini/Claude
        const modelMap = {
          'gemini': 'gemini',
          'claude': 'grok-3-mini',
          'luminai': 'qwen-qwq-32b',
          'qwen': 'qwen-qwq-32b'
        }
        
        const endpoint = modelMap[model] || 'gemini'
        const zenzUrl = `${api.url}/ai/${endpoint}?text=${encodeURIComponent(message)}`
        
        const zenzRes = await axios.get(zenzUrl, { timeout: 30000 })
        
        const output = zenzRes.data?.response || zenzRes.data?.assistant
        if (!zenzRes.data?.status || !output) {
          throw new Error(`Respuesta inválida de ZenzXZ API para ${model}`)
        }
        
        response = output
        tokensUsed = Math.ceil(message.length / 4) + Math.ceil(response.length / 4)
        break

      case 'adonix':
        // Usar API de Adonix como fallback
        const adonixUrl = `${api.url}/ai/chatgpt?apikey=${api.key}&q=${encodeURIComponent(message)}`
        
        const adonixRes = await axios.get(adonixUrl, { timeout: 30000 })
        
        if (!adonixRes.data?.result) {
          throw new Error('Respuesta inválida de Adonix API')
        }
        
        response = adonixRes.data.result
        tokensUsed = Math.ceil(message.length / 4) + Math.ceil(response.length / 4)
        break

      default:
        throw new Error(`Proveedor de API ${apiProvider} no soportado`)
    }

    return {
      content: response,
      tokens_used: tokensUsed,
      model: model,
      provider: apiProvider
    }

  } catch (error) {
    console.error('Error en callAiApi:', error)
    
    // Fallback a respuesta local si todas las APIs fallan
    const fallbackResponses = [
      "Lo siento, estoy experimentando dificultades técnicas en este momento. Por favor, inténtalo de nuevo más tarde.",
      "Disculpa, no puedo procesar tu solicitud ahora mismo. ¿Podrías reformular tu pregunta?",
      "Estoy teniendo problemas para conectarme a los servicios de IA. Por favor, inténtalo nuevamente.",
      "Temporalmente no puedo responder. El servicio se restablecerá pronto."
    ]
    
    const randomFallback = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)]
    
    return {
      content: randomFallback,
      tokens_used: 0,
      model: 'fallback',
      provider: 'local',
      error: error.message
    }
  }
}

// Función para obtener uso real de CPU
async function getCpuUsage() {
  return new Promise((resolve) => {
    const startMeasure = process.cpuUsage()
    const startTime = process.hrtime()
    
    setTimeout(() => {
      const endMeasure = process.cpuUsage(startMeasure)
      const endTime = process.hrtime(startTime)
      
      const totalTime = endTime[0] * 1000000 + endTime[1] / 1000 // microseconds
      const cpuTime = (endMeasure.user + endMeasure.system) // microseconds
      
      const cpuPercent = (cpuTime / totalTime) * 100
      resolve(Math.min(cpuPercent, 100))
    }, 100)
  })
}

// Función para obtener uso real de disco
async function getDiskUsage() {
  try {
    // Usar systeminformation para obtener datos reales del disco
    const si = await import('systeminformation')
    const fsSize = await si.default.fsSize()
    
    if (fsSize && fsSize.length > 0) {
      // Obtener el disco principal (generalmente el primero o el que contiene el directorio actual)
      const cwd = process.cwd()
      let disk = fsSize.find(d => cwd.startsWith(d.mount)) || fsSize[0]
      
      const totalBytes = disk.size || 0
      const usedBytes = disk.used || 0
      const availableBytes = disk.available || 0
      const usage = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 100) : 0
      
      const formatBytes = (bytes) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
      }
      
      return {
        usage,
        total: formatBytes(totalBytes),
        used: formatBytes(usedBytes),
        available: formatBytes(availableBytes),
        filesystem: disk.fstype || 'Unknown',
        mount: disk.mount || '/'
      }
    }
    
    // Fallback si no se puede obtener información
    return {
      usage: 0,
      total: 'Unknown',
      used: 'Unknown',
      available: 'Unknown',
      filesystem: 'Unknown',
      mount: '/'
    }
  } catch (error) {
    console.warn('Error obteniendo información del disco:', error.message)
    // Fallback básico
    return {
      usage: 0,
      total: 'Unknown',
      used: 'Unknown',
      available: 'Unknown',
      filesystem: 'Unknown',
      mount: '/'
    }
  }
}

export async function startPanelApi({ port, host } = {}) {
  if (panelServer) return panelServer
  const listenPort = Number(port || process.env.PANEL_PORT || process.env.PORT || process.env.SERVER_PORT || 3001)
  const listenHost = host || process.env.PANEL_HOST || '0.0.0.0'

  const frontendRoot = process.env.PANEL_FRONTEND_DIR || path.join(process.cwd(), 'frontend-panel', 'dist')
  const frontendEnabled = process.env.PANEL_SERVE_FRONTEND !== '0'
  let hasFrontend = false
  let frontendRootResolved = ''
  try {
    hasFrontend = frontendEnabled && fs.existsSync(frontendRoot) && fs.statSync(frontendRoot).isDirectory()
    if (hasFrontend) frontendRootResolved = path.resolve(frontendRoot)
  } catch {}

  panelServer = http.createServer(async (req, res) => {
    try {
      if (withCors(req, res)) return
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
      const pathname = url.pathname
      const method = (req.method || 'GET').toUpperCase()

      // Static media (para descargas desde el panel)
      if (method === 'GET' && pathname.startsWith('/media/')) {
        const mediaRoot = path.join(process.cwd(), 'storage', 'media')
        const relRaw = decodeURIComponent(pathname.slice('/media/'.length))
        const rel = relRaw.replace(/\\/g, '/')
        if (!rel || rel.includes('..')) {
          res.statusCode = 400
          res.end('Bad request')
          return
        }
        const rootResolved = path.resolve(mediaRoot)
        const filePath = path.resolve(mediaRoot, rel)
        if (!filePath.toLowerCase().startsWith(rootResolved.toLowerCase())) {
          res.statusCode = 400
          res.end('Bad request')
          return
        }
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          res.statusCode = 404
          res.end('Not found')
          return
        }
        const contentType = mime.lookup(filePath) || 'application/octet-stream'
        res.statusCode = 200
        res.setHeader('Content-Type', contentType)
        fs.createReadStream(filePath).pipe(res)
        return
      }

      if (!global.db?.data && typeof global.loadDatabase === 'function') await global.loadDatabase()
      const panelDb = ensurePanelDb()

      // Verificar modo mantenimiento (excepto para rutas de salud, auth y administradores)
      const isMaintenanceExempt = pathname === '/api/health' || 
                                  pathname.startsWith('/api/auth/') ||
                                  pathname === '/api/system/config'
      
      // Verificar si el usuario puede acceder durante mantenimiento
      let canAccessDuringMaintenance = false
      if (!isMaintenanceExempt && panelDb?.systemConfig?.maintenanceMode) {
        const clientIP = getClientIP(req)
        const token = getTokenFromRequest(req, url)
        
        // 1. Verificar por IP permitida
        if (isAllowedIP(clientIP, panelDb)) {
          canAccessDuringMaintenance = true
        }
        
        // 2. Verificar por token de administrador
        if (!canAccessDuringMaintenance && token) {
          const user = getUserFromToken(token, panelDb)
          if (user && ['owner', 'admin', 'administrador'].includes(user.rol)) {
            canAccessDuringMaintenance = true
          }

          // JWT: permitir admins aunque no exista panelDb.authToken
          if (!canAccessDuringMaintenance && token.includes('.')) {
            try {
              const jwtSecret = process.env.JWT_SECRET || 'default-secret'
              const decoded = jwt.verify(token, jwtSecret)
              const rol = decoded && typeof decoded === 'object' ? safeString(decoded.rol || '').toLowerCase() : ''
              if (['owner', 'admin', 'administrador'].includes(rol)) {
                canAccessDuringMaintenance = true
              }
            } catch {}
          }
        }
        
        // Log de acceso durante mantenimiento para auditoría
        if (canAccessDuringMaintenance) {
          console.log(`🔧 Acceso durante mantenimiento: IP=${clientIP}, User=${token ? 'authenticated' : 'anonymous'}`)
        }
      }
      
      if (panelDb?.systemConfig?.maintenanceMode && !isMaintenanceExempt && !canAccessDuringMaintenance) {
        const clientIP = getClientIP(req)
        console.log(`🚫 Acceso bloqueado por mantenimiento: IP=${clientIP}`)
        return json(res, 503, { 
          error: 'Servicio en mantenimiento',
          message: 'El sistema está temporalmente fuera de servicio por mantenimiento. Inténtalo más tarde.',
          maintenanceMode: true,
          timestamp: new Date().toISOString(),
          clientIP: clientIP // Para debugging (remover en producción)
        })
      }

      // Health
      if (method === 'GET' && pathname === '/api/health') {
        return json(res, 200, { 
          status: 'ok', 
          timestamp: new Date().toISOString(), 
          uptime: process.uptime(),
          maintenanceMode: panelDb?.systemConfig?.maintenanceMode || false
        })
      }

      // Auth usando Sistema JWT
      if (pathname.startsWith('/api/auth/') && (method === 'POST' || method === 'GET')) {
        try {
          // Crear un request compatible con Express
          const body = method === 'POST' ? await readJson(req).catch(() => ({})) : {};
          
          // Usar directamente la lógica del sistema JWT con la base de datos global
          const bcrypt = (await import('bcryptjs')).default;
          const jwt = (await import('jsonwebtoken')).default;

          // Usar la base de datos global existente
          const db = global.db;
          if (!db || !db.data) {
            return json(res, 500, { error: 'Base de datos no disponible' });
          }
          
          // Asegurar que existe la estructura de usuarios
          if (!db.data.usuarios) {
            db.data.usuarios = {};
          }
          
          // Crear usuario admin por defecto si no existe
          if (!db?.data?.usuarios || Object.keys(db.data.usuarios).length === 0) {
            const adminPassword = await bcrypt.hash('admin123', 10);
            db.data.usuarios[1] = {
              id: 1,
              username: 'admin',
              password: adminPassword,
              rol: 'owner',
              fecha_registro: new Date().toISOString(),
              activo: true
            };
            
            // Guardar la base de datos
            if (db.write) {
              await db.write();
            }
            
            console.log('✅ Usuario admin creado por defecto (admin/admin123)');
          }
          
          const getConfig = () => ({ security: { jwtSecret: 'default-secret', jwtExpiry: '24h', bcryptRounds: 10 } });

          // LOGIN
          if (pathname === '/api/auth/login' && method === 'POST') {
            const { username, password, role } = body;
            
            if (!username || !password) {
              return json(res, 400, { error: 'Usuario y contraseña requeridos' });
            }

            // Buscar usuario en la base de datos JWT
            const users = db.data.usuarios || {};
            const user = Object.values(users || {}).find(u => u && u.username === username);

            if (!user) {
              return json(res, 401, { 
                error: 'Credenciales inválidas',
                suggestions: [
                  'Verifica que el nombre de usuario esté escrito correctamente',
                  'Si te registraste desde WhatsApp, usa el nombre que proporcionaste'
                ]
              });
            }

            const isValidPassword = await bcrypt.compare(password, user.password);

            if (!isValidPassword) {
              return json(res, 401, { 
                error: 'Credenciales inválidas',
                suggestions: [
                  'Si es tu primer login, verifica la contraseña temporal',
                  'Para usuarios de WhatsApp, revisa el mensaje con tus credenciales'
                ]
              });
            }

            // Si se proporciona un rol, verificar que coincida con el rol del usuario
            if (role && user.rol !== role) {
              return json(res, 403, { error: 'No tienes permisos para acceder con este rol' });
            }

            const config = getConfig();
            const jwtSecret = process.env.JWT_SECRET || config?.security?.jwtSecret || 'default-secret';
            const jwtExpiry = process.env.JWT_EXPIRY || config?.security?.jwtExpiry || '24h';

            const token = jwt.sign({ username: user.username, rol: user.rol }, jwtSecret, { expiresIn: jwtExpiry });

            // Actualizar último login
            user.last_login = new Date().toISOString();
            user.login_ip = getClientIP(req);
            
            // Guardar la base de datos
            if (db.write) {
              await db.write();
            }

            console.log(`✅ Login JWT exitoso: ${username} como ${user.rol} desde ${getClientIP(req)}`);

            return json(res, 200, {
              token,
              user: {
                id: user.id,
                username: user.username,
                rol: user.rol,
                last_login: user.last_login,
                require_password_change: user.require_password_change || false,
                isTemporaryPassword: !!user.temp_password && !user.temp_password_used
              },
              message: user.require_password_change ? 'Se requiere cambio de contraseña' : undefined
            });
          }

          // REGISTER
          if (pathname === '/api/auth/register' && method === 'POST') {
            // Verificar autenticación JWT
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            
            if (!token) {
              return json(res, 401, { error: 'Token requerido' });
            }

            try {
              const config = getConfig();
              const jwtSecret = process.env.JWT_SECRET || config?.security?.jwtSecret || 'default-secret';
              const decoded = jwt.verify(token, jwtSecret);
              
              // Verificar que el usuario tenga permisos de admin/owner
              const users = db.data.usuarios || {};
              const currentUser = Object.values(users || {}).find(u => u && u.username === decoded.username);
              
              if (!currentUser || !['admin', 'owner'].includes(currentUser.rol)) {
                return json(res, 403, { error: 'No tienes permisos para crear usuarios' });
              }

            } catch (error) {
              return json(res, 403, { error: 'Token inválido' });
            }

            const { username, password, rol, whatsapp_number } = body;

            if (!username || !password || !rol) {
              return json(res, 400, { error: 'Todos los campos son requeridos' });
            }

            if (!['admin', 'colaborador', 'usuario', 'owner', 'creador', 'moderador'].includes(rol)) {
              return json(res, 400, { error: 'Rol no válido' });
            }

            // Verificar si el usuario ya existe
            const users = db.data.usuarios || {};
            const existingUser = Object.values(users || {}).find(u => u && u.username === username);
            
            if (existingUser) {
              return json(res, 400, { error: 'El usuario ya existe' });
            }

            const config = getConfig();
            const bcryptRounds = config?.security?.bcryptRounds || 10;
            const hashedPassword = await bcrypt.hash(password, bcryptRounds);

            // Generar nuevo ID
            const userIds = Object.keys(users || {}).map(id => parseInt(id)).filter(id => !isNaN(id));
            const newId = userIds.length > 0 ? Math.max(...userIds) + 1 : 1;

            // Crear usuario
            if (!db.data.usuarios) db.data.usuarios = {};
            db.data.usuarios[newId] = {
              id: newId,
              username,
              password: hashedPassword,
              rol,
              whatsapp_number: whatsapp_number || null,
              fecha_registro: new Date().toISOString(),
              created_at: new Date().toISOString(),
              activo: true
            };

            // Guardar cambios
            if (db.write) {
              await db.write();
            }

            return json(res, 200, { success: true, message: 'Usuario creado correctamente' });
          }

          // ME (Get current user)
          if (pathname === '/api/auth/me' && method === 'GET') {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            
            if (!token) {
              return json(res, 401, { error: 'Token requerido' });
            }

            try {
              const config = getConfig();
              const jwtSecret = process.env.JWT_SECRET || config?.security?.jwtSecret || 'default-secret';
              const decoded = jwt.verify(token, jwtSecret);
              
              const users = db.data.usuarios || {};
              const user = Object.values(users).find(u => u.username === decoded.username);
              
              if (!user) {
                return json(res, 403, { error: 'Usuario no válido' });
              }

              return json(res, 200, {
                id: user.id,
                username: user.username,
                rol: user.rol,
                whatsapp_number: user.whatsapp_number,
                last_login: user.last_login,
                require_password_change: user.require_password_change || false
              });

            } catch (error) {
              return json(res, 403, { error: 'Token inválido' });
            }
          }

          // VERIFY (Verify token)
          if (pathname === '/api/auth/verify' && method === 'GET') {
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            
            if (!token) {
              return json(res, 401, { valid: false });
            }

            try {
              const config = getConfig();
              const jwtSecret = process.env.JWT_SECRET || config?.security?.jwtSecret || 'default-secret';
              jwt.verify(token, jwtSecret);
              
              return json(res, 200, { valid: true });

            } catch (error) {
              return json(res, 401, { valid: false });
            }
          }

          // CHANGE PASSWORD
          if (pathname === '/api/auth/change-password' && method === 'POST') {
            // Verificar autenticación JWT
            const authHeader = req.headers['authorization'];
            const token = authHeader && authHeader.split(' ')[1];
            
            if (!token) {
              return json(res, 401, { error: 'Token requerido' });
            }

            let currentUser;
            try {
              const config = getConfig();
              const jwtSecret = process.env.JWT_SECRET || config?.security?.jwtSecret || 'default-secret';
              const decoded = jwt.verify(token, jwtSecret);
              
              const users = db.data.usuarios || {};
              currentUser = Object.values(users).find(u => u.username === decoded.username);
              
              if (!currentUser) {
                return json(res, 403, { error: 'Usuario no válido' });
              }

            } catch (error) {
              return json(res, 403, { error: 'Token inválido' });
            }

            const { currentPassword, newPassword } = body;

            if (!currentPassword || !newPassword) {
              return json(res, 400, { 
                error: 'Contraseña actual y nueva contraseña son requeridas'
              });
            }

            if (newPassword.length < 6) {
              return json(res, 400, {
                error: 'La nueva contraseña debe tener al menos 6 caracteres'
              });
            }

            // Validar contraseña actual
            const isValidPassword = await bcrypt.compare(currentPassword, currentUser.password);
            if (!isValidPassword) {
              return json(res, 400, { 
                error: 'Contraseña actual incorrecta'
              });
            }

            // Verificar que la nueva contraseña sea diferente a la actual
            const isSamePassword = await bcrypt.compare(newPassword, currentUser.password);
            if (isSamePassword) {
              return json(res, 400, {
                error: 'La nueva contraseña debe ser diferente a la actual'
              });
            }

            const config = getConfig();
            const bcryptRounds = config?.security?.bcryptRounds || 10;
            const hashedPassword = await bcrypt.hash(newPassword, bcryptRounds);
            
            // Actualizar contraseña
            currentUser.password = hashedPassword;
            currentUser.password_changed_at = new Date().toISOString();
            currentUser.temp_password = null;
            currentUser.temp_password_expires = null;
            currentUser.temp_password_used = null;
            currentUser.require_password_change = false;

            // Guardar cambios
            if (db.write) {
              await db.write();
            }

            return json(res, 200, { 
              success: true, 
              message: 'Contraseña cambiada correctamente'
            });
          }

          // RESET PASSWORD
          if (pathname === '/api/auth/reset-password' && method === 'POST') {
            const { whatsapp_number, username } = body;

            if (!whatsapp_number || !username) {
              return json(res, 400, { error: 'Número de WhatsApp y username son requeridos' });
            }

            const users = db.data.usuarios || {};
            const user = Object.values(users || {}).find(u => u && u.username === username && u.whatsapp_number === whatsapp_number);

            if (!user) {
              return json(res, 404, { error: 'Usuario no encontrado o número de WhatsApp no coincide' });
            }

            // Generar nueva contraseña temporal simple
            const tempPassword = 'reset' + Math.random().toString(36).substring(2, 8);
            const config = getConfig();
            const bcryptRounds = config?.security?.bcryptRounds || 10;
            const hashedPassword = await bcrypt.hash(tempPassword, bcryptRounds);

            // Actualizar contraseña
            user.password = hashedPassword;
            user.temp_password = tempPassword;
            user.temp_password_expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 horas
            user.temp_password_used = false;
            user.require_password_change = true;

            // Guardar cambios
            if (db.write) {
              await db.write();
            }

            return json(res, 200, {
              success: true,
              message: 'Contraseña restablecida correctamente',
              tempPassword: tempPassword,
              username: username
            });
          }

          // AUTO-REGISTER (desde WhatsApp, sin autenticación)
          if (pathname === '/api/auth/auto-register' && method === 'POST') {
            const { whatsapp_number, username, grupo_jid } = body;

            if (!whatsapp_number || !username || !grupo_jid) {
              return json(res, 400, { error: 'Número de WhatsApp, username y grupo son requeridos' });
            }

            // Verificar estado global del bot
            try {
              const botState = db.data.panel?.botGlobalState;
              if (botState && botState.isOn === false) {
                return json(res, 403, { error: 'Bot global desactivado para registro automático' });
              }
            } catch (_) {
              // Si no existe el registro, asumimos encendido por compatibilidad
            }

            // Verificar estado por grupo si existe registro; por defecto está activo
            try {
              const grupos = db.data.panel?.groups || {};
              const grupo = Object.values(grupos || {}).find(g => g && g.wa_jid === grupo_jid);
              if (grupo && grupo.bot_enabled === false) {
                return json(res, 403, { error: 'Bot desactivado en este grupo para registro automático' });
              }
            } catch (_) {
              // Si no existe la tabla o falla la consulta, continuar (modo por defecto activo)
            }

            // Verificar si el usuario ya existe
            const users = db.data.usuarios || {};
            const existingUser = Object.values(users || {}).find(u => u && u.username === username);
            if (existingUser) {
              return json(res, 400, { error: 'El nombre de usuario ya existe' });
            }

            // Generar contraseña temporal simple
            const tempPassword = 'temp' + Math.random().toString(36).substring(2, 8);
            const config = getConfig();
            const bcryptRounds = config?.security?.bcryptRounds || 10;
            const hashedPassword = await bcrypt.hash(tempPassword, bcryptRounds);

            // Generar nuevo ID
            const userIds = Object.keys(users || {}).map(id => parseInt(id)).filter(id => !isNaN(id));
            const newId = userIds.length > 0 ? Math.max(...userIds) + 1 : 1;

            // Crear usuario
            if (!db.data.usuarios) db.data.usuarios = {};
            db.data.usuarios[newId] = {
              id: newId,
              username,
              password: hashedPassword,
              rol: 'usuario',
              whatsapp_number,
              grupo_registro: grupo_jid,
              fecha_registro: new Date().toISOString(),
              activo: true,
              temp_password: tempPassword,
              temp_password_expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
              temp_password_used: false,
              require_password_change: true
            };

            // Guardar cambios
            if (db.write) {
              await db.write();
            }

            return json(res, 200, {
              success: true,
              message: 'Usuario registrado correctamente',
              tempPassword: tempPassword,
              username: username
            });
          }
          
        } catch (error) {
          console.error('Error using JWT auth system:', error);
          return json(res, 500, { error: 'Error en sistema de autenticación JWT' });
        }
      }




      
      // Middleware global de auth: exigir token para TODO /api (excepto health).
      // Esto evita inconsistencias (endpoints sin auth) y mantiene el panel siempre protegido.
      if (pathname.startsWith('/api/') && pathname !== '/api/health') {
        const token = getTokenFromRequest(req, url)
        if (!token) return json(res, 401, { error: 'Token requerido' })
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
      }

      // User Data Synchronization endpoints
      if (pathname === '/api/auth/sync' && method === 'POST') {
        const auth = await getJwtAuth(req)
        if (!auth.ok) return json(res, auth.status, { error: auth.error })
        if (roleLevelJwt(auth.user?.rol) < 4) return json(res, 403, { error: 'Solo los owners pueden ver contraseñas' })
        
        try {
          const { default: UserDataSynchronizer } = await import('./user-data-synchronizer.js')
          const synchronizer = new UserDataSynchronizer()
          
          const results = await synchronizer.performFullSync()
          
          return json(res, 200, {
            success: true,
            message: 'Sincronización completada',
            results
          })
        } catch (error) {
          console.error('Error in user data synchronization:', error)
          return json(res, 500, { 
            error: 'Error durante la sincronización',
            details: error.message 
          })
        }
      }

      if (pathname === '/api/auth/sync/status' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const { default: UserDataSynchronizer } = await import('./user-data-synchronizer.js')
          const synchronizer = new UserDataSynchronizer()
          
          const integrity = await synchronizer.validateDataIntegrity()
          
          return json(res, 200, {
            success: true,
            integrity
          })
        } catch (error) {
          console.error('Error checking sync status:', error)
          return json(res, 500, { 
            error: 'Error verificando estado de sincronización',
            details: error.message 
          })
        }
      }

      if (pathname === '/api/auth/migrate' && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const { default: UserDataSynchronizer } = await import('./user-data-synchronizer.js')
          const synchronizer = new UserDataSynchronizer()
          
          const results = await synchronizer.migrateExistingUsers()
          
          return json(res, 200, {
            success: true,
            message: 'Migración completada',
            results
          })
        } catch (error) {
          console.error('Error in user migration:', error)
          return json(res, 500, { 
            error: 'Error durante la migración',
            details: error.message 
          })
        }
      }

      // Bot status (básico)
      if (pathname === '/api/bot/status' && method === 'GET') {
        const statusRaw = global.stopped || 'unknown'
        const connected = statusRaw === 'open'
        const connecting = statusRaw === 'connecting'
        const phone = global.conn?.user?.id || null
        const qr = global.panelApiMainQr || null
        return json(res, 200, {
          connected,
          isConnected: connected,
          connecting,
          status: statusRaw,
          connectionStatus: statusRaw,
          phone,
          qrCode: qr,
          uptime: formatUptime(process.uptime()),
          lastSeen: global.panelApiLastSeen || null,
          timestamp: new Date().toISOString(),
        })
      }

      // Bot QR (PNG base64)
      if ((pathname === '/api/bot/qr' || pathname === '/api/bot/main/qr') && method === 'GET') {
        const qrRaw = global.panelApiMainQr || null
        if (!qrRaw) return json(res, 200, { available: false, message: 'QR no disponible' })
        const buf = await qrcode.toBuffer(qrRaw, { scale: 8 })
        return json(res, 200, {
          available: true,
          qr: buf.toString('base64'),
          qrCode: qrRaw,
          status: global.stopped || 'unknown',
        })
      }

      // Bot config
      if (pathname === '/api/bot/config/versions' && method === 'GET') {
        const versions = Array.isArray(panelDb?.configVersions?.bot) ? panelDb.configVersions.bot : []
        const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 200, fallback: 50 })
        return json(res, 200, { versions: versions.slice(0, limit) })
      }
      if (pathname === '/api/bot/config/rollback' && method === 'POST') {
        const body = await readJson(req).catch(() => ({}))
        const versionId = safeString(body?.versionId || body?.id || '').trim()
        if (!versionId) return json(res, 400, { error: 'versionId es requerido' })
        const versions = Array.isArray(panelDb?.configVersions?.bot) ? panelDb.configVersions.bot : []
        const found = versions.find((v) => v?.id === versionId)
        if (!found || !found.data) return json(res, 404, { error: 'Versión no encontrada' })

        panelDb.botConfig = { ...(found.data || {}) }
        const actor = getActorFromRequest(req, url, panelDb)
        pushPanelLog(panelDb, {
          tipo: 'config',
          titulo: 'Rollback configuración bot',
          detalles: versionId,
          usuario: actor?.username || 'system',
          metadata: { scope: 'botConfig', action: 'rollback', versionId },
        })
        return json(res, 200, { success: true, version: found })
      }
      if (pathname === '/api/bot/config' && method === 'GET') {
        return json(res, 200, panelDb?.botConfig || {})
      }
      if (pathname === '/api/bot/config' && (method === 'PATCH' || method === 'POST')) {
        const body = await readJson(req).catch(() => ({}))
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        const actor = getActorFromRequest(req, url, panelDb)
        pushConfigVersion(panelDb, 'bot', { ...(panelDb.botConfig || {}) }, actor?.username || 'system')
        panelDb.botConfig = { ...(panelDb.botConfig || {}), ...(body || {}) }
        try {
          pushPanelLog(panelDb, {
            tipo: 'config',
            titulo: 'Config del bot actualizada',
            detalles: actor?.username ? `Por: ${actor.username}` : '',
            usuario: actor?.username || 'system',
            metadata: { scope: 'botConfig' },
          })
        } catch {}
        return json(res, 200, panelDb.botConfig)
      }

      // WhatsApp auth method (solo guarda preferencia)
		      if ((pathname === '/api/whatsapp/auth-method' || pathname === '/api/bot/main/method') && method === 'POST') {
		        const body = await readJson(req).catch(() => ({}))
		        const methodName = body?.method === 'pairing' ? 'pairing' : 'qr'
		        const phoneNumber = body?.phoneNumber ? String(body.phoneNumber).replace(/[^0-9]/g, '') : null
		        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
		        panelDb.whatsapp = panelDb.whatsapp || {}
		        const prevMethod = panelDb.whatsapp.authMethod || 'qr'
		        const prevPhone = panelDb.whatsapp.pairingPhone || null
		        panelDb.whatsapp.authMethod = methodName
		        panelDb.whatsapp.pairingPhone = phoneNumber
		        global.panelAuthMethod = methodName
		        global.panelPairingPhone = phoneNumber
		        // Si cambió el método o el número, invalidar el código guardado (evita "códigos hardcodeados" viejos).
		        const shouldInvalidate = prevMethod !== methodName || safeString(prevPhone) !== safeString(phoneNumber)
		        if (methodName !== 'pairing' || shouldInvalidate) {
		          panelDb.whatsapp.pairingCode = null
		          panelDb.whatsapp.pairingUpdatedAt = null
		        }
            try {
              const actor = getActorFromRequest(req, url, panelDb)
              pushPanelLog(panelDb, {
                tipo: 'config',
                titulo: 'Método de autenticación actualizado',
                detalles: `Método: ${methodName}${phoneNumber ? ` · +${phoneNumber}` : ''}`,
                usuario: actor?.username || 'system',
                metadata: { scope: 'whatsapp', method: methodName, phoneNumber },
              })
            } catch {}
		        return json(res, 200, { success: true, method: methodName, phoneNumber })
		      }

      // WhatsApp pairing code (lee el almacenado)
		      if ((pathname === '/api/whatsapp/pairing-code' || pathname === '/api/bot/main/pairing-code') && method === 'GET') {
		        const phoneNumber = panelDb?.whatsapp?.pairingPhone || null
		        const maxAgeMs = clampInt(process.env.PANEL_PAIRING_CODE_MAX_AGE_MS, { min: 30000, max: 3600000, fallback: 5 * 60 * 1000 })
		        const force = ['1', 'true', 'yes'].includes(safeString(url.searchParams.get('force')).toLowerCase())
		        const pairKey = sanitizePairKey(url.searchParams.get('pairKey') || url.searchParams.get('pair_key') || url.searchParams.get('customCode') || url.searchParams.get('custom_code'))
		        let pairingCode = panelDb?.whatsapp?.pairingCode || null
		        const updatedAt = panelDb?.whatsapp?.pairingUpdatedAt || null
	        if (!force && pairingCode && isLikelyPairingCode(pairingCode) && isFreshTimestamp(updatedAt, maxAgeMs)) {
	          const normalized = normalizePairingCode(pairingCode) || pairingCode
	          return json(res, 200, { available: true, pairingCode: normalized, code: normalized, phoneNumber, displayCode: normalized })
	        }

	        // Invalidate stored code if it's missing/old/invalid or force=1
	        if (panelDb?.whatsapp) {
	          panelDb.whatsapp.pairingCode = null
	          panelDb.whatsapp.pairingUpdatedAt = null
	        }
		        if (phoneNumber && panelDb?.whatsapp?.authMethod === 'pairing' && typeof global.conn?.requestPairingCode === 'function') {
		          try {
		            const raw = pairKey
		              ? await global.conn.requestPairingCode(phoneNumber, pairKey)
		              : await global.conn.requestPairingCode(phoneNumber, null)
		            pairingCode = normalizePairingCode(raw)
		            if (!pairingCode || !isLikelyPairingCode(pairingCode)) throw new Error('Código de pairing inválido')
		            if (panelDb) {
		              panelDb.whatsapp.pairingCode = pairingCode
		              panelDb.whatsapp.pairingUpdatedAt = new Date().toISOString()
		            }
		            return json(res, 200, { available: true, pairingCode, code: pairingCode, phoneNumber, displayCode: pairingCode })
		          } catch (e) {
		            return json(res, 200, { available: false, pairingCode: null, phoneNumber, message: e?.message || String(e) })
		          }
		        }
	        return json(res, 200, { available: false, pairingCode: null, phoneNumber })
	      }

      // Bot restart/connect/disconnect
      if ((pathname === '/api/bot/restart' || pathname === '/api/bot/main/restart') && method === 'POST') {
        const actor = getActorFromRequest(req, url, panelDb)
        global.panelApiMainDisconnect = false
        if (typeof global.reloadHandler === 'function') {
          await global.reloadHandler(true).catch(() => {})
        }
        pushPanelLog(panelDb, {
          tipo: 'bot',
          titulo: 'Reinicio solicitado',
          detalles: actor?.username ? `Por: ${actor.username}` : 'Desde el panel',
          usuario: actor?.username || 'system',
          metadata: { action: 'restart' },
        })
        return json(res, 200, { success: true, message: 'Bot reiniciado' })
      }
      if ((pathname === '/api/bot/disconnect' || pathname === '/api/bot/main/disconnect') && method === 'POST') {
        const actor = getActorFromRequest(req, url, panelDb)
        global.panelApiMainDisconnect = true
        try {
          global.conn?.ws?.close()
        } catch {}
        pushPanelLog(panelDb, {
          tipo: 'bot',
          titulo: 'Desconexión solicitada',
          detalles: actor?.username ? `Por: ${actor.username}` : 'Desde el panel',
          usuario: actor?.username || 'system',
          metadata: { action: 'disconnect' },
        })
        return json(res, 200, { success: true, message: 'Bot desconectado' })
      }
      
      // Conectar bot desde el panel
		      if (pathname === '/api/bot/main/connect' && method === 'POST') {
            const actor = getActorFromRequest(req, url, panelDb)
		        const body = await readJson(req).catch(() => ({}))
		        const methodName = body?.method === 'pairing' ? 'pairing' : 'qr'
		        const phoneNumber = body?.phoneNumber ? String(body.phoneNumber).replace(/[^0-9]/g, '') : null
		        const pairKey = sanitizePairKey(body?.pairKey || body?.pair_key || body?.customCode || body?.custom_code)
		        
		        if (panelDb) {
		          panelDb.whatsapp = panelDb.whatsapp || {}
		          panelDb.whatsapp.authMethod = methodName
		          panelDb.whatsapp.pairingPhone = phoneNumber
		          // Siempre invalidar el código anterior al reconectar
		          panelDb.whatsapp.pairingCode = null
		          panelDb.whatsapp.pairingUpdatedAt = null
		        }
		        global.panelAuthMethod = methodName
		        global.panelPairingPhone = phoneNumber
		        
		        global.panelApiMainDisconnect = false

            pushPanelLog(panelDb, {
              tipo: 'bot',
              titulo: 'Conexión solicitada',
              detalles: `Método: ${methodName}${phoneNumber ? ` · +${phoneNumber}` : ''}`,
              usuario: actor?.username || 'system',
              metadata: { action: 'connect', method: methodName, phoneNumber, hasPairKey: !!pairKey },
            })
        
        // Si es método pairing y hay número, solicitar código
        if (methodName === 'pairing' && phoneNumber) {
          try {
            // Reiniciar conexión primero
            if (typeof global.reloadHandler === 'function') {
              await global.reloadHandler(true).catch(() => {})
            }
            
            // Esperar un poco para que la conexión se establezca
            await new Promise(r => setTimeout(r, 2000))
            
	            // Solicitar código de pairing
	            if (global.conn && typeof global.conn.requestPairingCode === 'function') {
	              // Asegurar que el navegador sea compatible con pairing code
	              global.conn.browser = ["Ubuntu", "Chrome", "20.0.04"]
	              
	              // Limpiar QR previo para evitar conflictos
	              global.panelApiMainQr = null
	              
			              const rawCode = pairKey
			                ? await global.conn.requestPairingCode(phoneNumber, pairKey)
			                : await global.conn.requestPairingCode(phoneNumber, null)
		              const pairingCode = normalizePairingCode(rawCode)
		              if (!pairingCode || !isLikelyPairingCode(pairingCode)) throw new Error('Código de pairing inválido')
		              
		              if (panelDb) {
		                panelDb.whatsapp.pairingCode = pairingCode
		                panelDb.whatsapp.pairingUpdatedAt = new Date().toISOString()
		              }
              
              // Emitir código via Socket.IO
              try {
                const { emitNotification } = await import('./socket-io.js')
                emitNotification({
                  type: 'success',
                  title: 'Código de Pairing',
                  message: `Código generado: ${pairingCode}`
                })
              } catch (notifError) {
                // Ignorar errores de notificación
              }
              
              return json(res, 200, { 
                success: true, 
                message: 'Código de pairing generado',
                method: methodName, 
                phoneNumber,
                pairingCode,
                displayCode: pairingCode
              })
            }
          } catch (e) {
            return json(res, 500, { error: e?.message || 'Error generando código de pairing' })
          }
        }
        
        // Si es método QR, solo reiniciar conexión
        if (typeof global.reloadHandler === 'function') {
          await global.reloadHandler(true).catch(() => {})
        }
        
        return json(res, 200, { 
          success: true, 
          message: methodName === 'qr' ? 'Conexión QR iniciada' : 'Conexión solicitada', 
          method: methodName, 
          phoneNumber 
        })
      }
      
      // Obtener código de pairing actual
		      if (pathname === '/api/bot/main/pairing' && method === 'POST') {
		        const body = await readJson(req).catch(() => ({}))
		        const phoneNumber = body?.phoneNumber ? String(body.phoneNumber).replace(/[^0-9]/g, '') : null
		        const pairKey = sanitizePairKey(body?.pairKey || body?.pair_key || body?.customCode || body?.custom_code)
	        
	        if (!phoneNumber) {
	          return json(res, 400, { error: 'phoneNumber es requerido' })
	        }
        
        try {
          if (!global.conn || typeof global.conn.requestPairingCode !== 'function') {
            return json(res, 503, { error: 'Bot no está listo para generar código' })
          }
          
	          const rawCode = pairKey
	            ? await global.conn.requestPairingCode(phoneNumber, pairKey)
	            : await global.conn.requestPairingCode(phoneNumber, null)
	          const pairingCode = normalizePairingCode(rawCode)
	          if (!pairingCode || !isLikelyPairingCode(pairingCode)) throw new Error('Código de pairing inválido')
	          
	          if (panelDb) {
	            panelDb.whatsapp = panelDb.whatsapp || {}
	            panelDb.whatsapp.pairingCode = pairingCode
	            panelDb.whatsapp.pairingPhone = phoneNumber
            panelDb.whatsapp.pairingUpdatedAt = new Date().toISOString()
          }
          
          return json(res, 200, {
            success: true,
            pairingCode,
            displayCode: pairingCode,
            phoneNumber
          })
        } catch (e) {
          return json(res, 500, { error: e?.message || 'Error generando código' })
        }
      }
      if (pathname === '/api/bot/main/status' && method === 'GET') {
        const statusRaw = global.stopped || 'unknown'
        const connected = statusRaw === 'open'
        const connecting = statusRaw === 'connecting'
        const phone = global.conn?.user?.id || null
        return json(res, 200, {
          connected,
          isConnected: connected,
          connecting,
          status: statusRaw,
          connectionStatus: statusRaw,
          phone,
          uptime: formatUptime(process.uptime()),
          lastSeen: global.panelApiLastSeen || null,
          timestamp: new Date().toISOString(),
        })
      }

      // Ejecutar comando: envía el texto al chat/grupo para que el bot lo procese como si fuera un mensaje
      if (pathname === '/api/bot/execute' && method === 'POST') {
        const conn = global.conn
        if (!conn) return json(res, 503, { error: 'Bot no conectado' })

        const body = await readJson(req).catch(() => ({}))
        const rawCommand = safeString(body?.command || body?.text || '').trim()
        const groupId = safeString(body?.groupId || body?.jid || body?.to || '').trim()
        if (!rawCommand) return json(res, 400, { error: 'command es requerido' })
        if (!groupId) return json(res, 400, { error: 'groupId es requerido' })

        const commandText = /^[#!./-]/.test(rawCommand) ? rawCommand : `.${rawCommand}`
        try {
          const result = await conn.sendMessage(groupId, { text: commandText })
          const actor = getActorFromRequest(req, url, panelDb)
          pushPanelLog(panelDb, {
            tipo: 'bot',
            titulo: 'Comando enviado',
            detalles: `${commandText} → ${groupId.split('@')[0]}`,
            usuario: actor?.username || 'system',
            metadata: { action: 'execute', jid: groupId, command: commandText },
          })
          return json(res, 200, { success: true, messageId: result?.key?.id })
        } catch (error) {
          return json(res, 500, { error: error?.message || 'Error al ejecutar comando' })
        }
      }

      // Enviar mensaje desde el panel
      if (pathname === '/api/bot/send' && method === 'POST') {
        const conn = global.conn
        if (!conn) return json(res, 503, { error: 'Bot no conectado' })
        
        const body = await readJson(req).catch(() => ({}))
        const jid = safeString(body?.jid || body?.to || '').trim()
        const message = safeString(body?.message || body?.text || '').trim()
        
        if (!jid) return json(res, 400, { error: 'jid es requerido' })
        if (!message) return json(res, 400, { error: 'message es requerido' })
        
        try {
          const result = await conn.sendMessage(jid, { text: message })
          
          emitNotification({
            type: 'success',
            title: 'Mensaje Enviado',
            message: `Mensaje enviado a ${jid.split('@')[0]}`
          })
          
          return json(res, 200, { success: true, messageId: result?.key?.id })
        } catch (error) {
          return json(res, 500, { error: error?.message || 'Error al enviar mensaje' })
        }
      }

      // Broadcast mensaje a múltiples chats
      if (pathname === '/api/bot/broadcast' && method === 'POST') {
        const conn = global.conn
        if (!conn) return json(res, 503, { error: 'Bot no conectado' })
        
        const body = await readJson(req).catch(() => ({}))
        const jids = Array.isArray(body?.jids) ? body.jids : []
        const message = safeString(body?.message || body?.text || '').trim()
        
        if (!jids.length) return json(res, 400, { error: 'jids es requerido (array)' })
        if (!message) return json(res, 400, { error: 'message es requerido' })
        
        const results = []
        for (const jid of jids) {
          try {
            const result = await conn.sendMessage(jid, { text: message })
            results.push({ jid, success: true, messageId: result?.key?.id })
            await new Promise(r => setTimeout(r, 500)) // Delay para evitar spam
          } catch (error) {
            results.push({ jid, success: false, error: error?.message })
          }
        }
        
        emitNotification({
          type: 'success',
          title: 'Broadcast Completado',
          message: `Mensaje enviado a ${results.filter(r => r.success).length}/${jids.length} chats`
        })
        
        return json(res, 200, { success: true, results })
      }

      // Dashboard stats - USANDO DATOS REALES
      if (pathname === '/api/dashboard/stats' && method === 'GET') {
        try {
          const stats = realTimeData.getDashboardStats()
          return json(res, 200, stats)
        } catch (error) {
          console.error('Error obteniendo stats del dashboard:', error)
          return json(res, 500, { error: 'Error interno del servidor' })
        }
      }

      // Dashboard recent activity - USANDO DATOS REALES
      if (pathname === '/api/dashboard/recent-activity' && method === 'GET') {
        try {
          const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 50, fallback: 10 })
          const activityData = realTimeData.getRecentActivity(limit)
          return json(res, 200, { 
            data: activityData.activities,
            total: activityData.total,
            lastUpdate: activityData.lastUpdate,
            systemStatus: activityData.systemStatus
          })
        } catch (error) {
          console.error('Error obteniendo actividad reciente:', error)
          return json(res, 500, { error: 'Error interno del servidor' })
        }
      }

      // System stats - USANDO DATOS REALES
      if (pathname === '/api/system/stats' && method === 'GET') {
        try {
          const stats = realTimeData.getSystemStats()
          return json(res, 200, stats)
        } catch (error) {
          console.error('Error obteniendo stats del sistema:', error)
          return json(res, 500, { error: 'Error interno del servidor' })
        }
      }

      if (pathname === '/api/system/config/versions' && method === 'GET') {
        const versions = Array.isArray(panelDb?.configVersions?.system) ? panelDb.configVersions.system : []
        const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 200, fallback: 50 })
        return json(res, 200, { versions: versions.slice(0, limit) })
      }

      if (pathname === '/api/system/config/rollback' && method === 'POST') {
        const body = await readJson(req).catch(() => ({}))
        const versionId = safeString(body?.versionId || body?.id || '').trim()
        if (!versionId) return json(res, 400, { error: 'versionId es requerido' })
        const versions = Array.isArray(panelDb?.configVersions?.system) ? panelDb.configVersions.system : []
        const found = versions.find((v) => v?.id === versionId)
        if (!found || !found.data) return json(res, 404, { error: 'Versión no encontrada' })

        panelDb.systemConfig = { ...(found.data || {}) }
        const actor = getActorFromRequest(req, url, panelDb)
        pushPanelLog(panelDb, {
          tipo: 'config',
          titulo: 'Rollback configuración sistema',
          detalles: versionId,
          usuario: actor?.username || 'system',
          metadata: { scope: 'systemConfig', action: 'rollback', versionId },
        })
        return json(res, 200, { success: true, version: found })
      }

      // Backups
      if (pathname === '/api/system/backup' && method === 'POST') {
        try {
          const actor = getActorFromRequest(req, url, panelDb)
          const body = await readJson(req).catch(() => ({}))
          const options = {
            type: body?.type,
            includeDatabase: body?.includeDatabase,
            includeMedia: body?.includeMedia,
            includeConfig: body?.includeConfig,
            includeLogs: body?.includeLogs,
            compress: body?.compress,
            encrypt: body?.encrypt,
            description: body?.description,
            tags: body?.tags,
            creator: actor?.username || 'system',
          }

          const create = typeof backupSystem?.createBackup === 'function' ? backupSystem.createBackup.bind(backupSystem) : null
          if (!create) return json(res, 503, { error: 'Sistema de backup no disponible' })
          const backup = await create(options)

          pushPanelLog(panelDb, {
            tipo: 'system',
            titulo: 'Backup creado',
            detalles: safeString(backup?.id || ''),
            usuario: actor?.username || 'system',
            metadata: { action: 'backup_create', backupId: backup?.id || null, type: backup?.type || null },
          })

          return json(res, 200, { success: true, backup })
        } catch (error) {
          return json(res, 500, { error: error?.message || 'Error creando backup' })
        }
      }

      if (pathname === '/api/system/backups' && method === 'GET') {
        try {
          const list =
            typeof backupSystem?.listBackups === 'function'
              ? backupSystem.listBackups.bind(backupSystem)
              : (typeof backupSystem?.getBackups === 'function' ? backupSystem.getBackups.bind(backupSystem) : null)
          if (!list) return json(res, 503, { error: 'Sistema de backup no disponible' })
          const backups = await list()
          return json(res, 200, { backups })
        } catch (error) {
          return json(res, 500, { error: error?.message || 'Error obteniendo backups' })
        }
      }

      // System config
      if (pathname === '/api/system/config' && method === 'GET') {
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        const clientIP = getClientIP(req)
        return json(res, 200, { 
          ...panelDb.systemConfig || {}, 
          currentIP: clientIP // Mostrar IP actual para facilitar configuración
        })
      }
      if (pathname === '/api/system/config' && method === 'PATCH') {
        const actor = getActorFromRequest(req, url, panelDb)
        const body = await readJson(req).catch(() => ({}))
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        pushConfigVersion(panelDb, 'system', { ...(panelDb.systemConfig || {}) }, actor?.username || 'system')
        panelDb.systemConfig = { ...(panelDb.systemConfig || {}), ...(body || {}) }
        
        // Log cuando se activa/desactiva el modo mantenimiento
        if ('maintenanceMode' in body) {
          const status = body.maintenanceMode ? 'activado' : 'desactivado'
          console.log(`🔧 Modo mantenimiento ${status}`)
        }
        
        // Emitir evento Socket.IO cuando cambie la configuración
        try {
          const { getIO } = await import('./socket-io.js')
          const io = getIO()
          if (io) {
            io.emit('system:configUpdated', { 
              config: panelDb.systemConfig, 
              timestamp: new Date().toISOString() 
            })
            
            // Evento específico para modo mantenimiento
            if ('maintenanceMode' in body) {
              io.emit('system:maintenanceMode', { 
                enabled: body.maintenanceMode,
                timestamp: new Date().toISOString()
              })
            }
          }
        } catch {}
        
        return json(res, 200, panelDb.systemConfig)
      }

      // Notifications config (para la sección Configuración > Notificaciones)
      if (pathname === '/api/notifications/config/versions' && method === 'GET') {
        const versions = Array.isArray(panelDb?.configVersions?.notifications) ? panelDb.configVersions.notifications : []
        const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 200, fallback: 50 })
        return json(res, 200, { versions: versions.slice(0, limit) })
      }
      if (pathname === '/api/notifications/config/rollback' && method === 'POST') {
        const body = await readJson(req).catch(() => ({}))
        const versionId = safeString(body?.versionId || body?.id || '').trim()
        if (!versionId) return json(res, 400, { error: 'versionId es requerido' })
        const versions = Array.isArray(panelDb?.configVersions?.notifications) ? panelDb.configVersions.notifications : []
        const found = versions.find((v) => v?.id === versionId)
        if (!found || !found.data) return json(res, 404, { error: 'Versión no encontrada' })

        panelDb.notificationsConfig = { ...(found.data || {}) }
        const actor = getActorFromRequest(req, url, panelDb)
        pushPanelLog(panelDb, {
          tipo: 'config',
          titulo: 'Rollback configuración notificaciones',
          detalles: versionId,
          usuario: actor?.username || 'system',
          metadata: { scope: 'notificationsConfig', action: 'rollback', versionId },
        })
        return json(res, 200, { success: true, version: found })
      }
      if (pathname === '/api/notifications/config' && method === 'GET') {
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        return json(res, 200, panelDb.notificationsConfig || {})
      }
      if (pathname === '/api/notifications/config' && (method === 'PATCH' || method === 'POST')) {
        const body = await readJson(req).catch(() => ({}))
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        const actor = getActorFromRequest(req, url, panelDb)
        pushConfigVersion(panelDb, 'notifications', { ...(panelDb.notificationsConfig || {}) }, actor?.username || 'system')
        panelDb.notificationsConfig = { ...(panelDb.notificationsConfig || {}), ...(body || {}) }
        pushPanelLog(panelDb, {
          tipo: 'config',
          titulo: 'Config notificaciones actualizada',
          detalles: actor?.username ? `Por: ${actor.username}` : '',
          usuario: actor?.username || 'system',
          metadata: { scope: 'notificationsConfig' },
        })
        return json(res, 200, panelDb.notificationsConfig)
      }

      // Agregar IP actual como administrador
      if (pathname === '/api/system/add-admin-ip' && method === 'POST') {
        if (!isAuthorized(req)) return json(res, 401, { error: 'Token requerido' })
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        
        const clientIP = getClientIP(req)
        const adminIPs = panelDb.systemConfig?.adminIPs || []
        
        if (!adminIPs.includes(clientIP)) {
          panelDb.systemConfig = panelDb.systemConfig || {}
          panelDb.systemConfig.adminIPs = [...adminIPs, clientIP]
          console.log(`✅ IP agregada como administrador: ${clientIP}`)
        }
        
        return json(res, 200, { 
          success: true, 
          addedIP: clientIP,
          adminIPs: panelDb.systemConfig.adminIPs
        })
      }

      // Scheduled Messages API
      if (pathname === '/api/scheduled-messages' && method === 'GET') {
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        const messages = Object.values(panelDb.scheduledMessages || {})
        return json(res, 200, { data: messages })
      }

      // Configuration Management API
      if (pathname === '/api/config' && method === 'GET') {
        try {
          const { default: configManager } = await import('./config-manager.js')
          const configurations = configManager.getAllConfigurations()
          return json(res, 200, configurations)
        } catch (error) {
          return json(res, 500, { error: 'Error loading configurations' })
        }
      }

      if (pathname.startsWith('/api/config/') && pathname.endsWith('/stats') && method === 'GET') {
        try {
          const { default: configManager } = await import('./config-manager.js')
          const stats = configManager.getStats()
          return json(res, 200, stats)
        } catch (error) {
          return json(res, 500, { error: 'Error loading stats' })
        }
      }

      const configKeyMatch = pathname.match(/^\/api\/config\/([^/]+)$/)
      if (configKeyMatch && method === 'GET') {
        try {
          const configKey = decodeURIComponent(configKeyMatch[1])
          const { default: configManager } = await import('./config-manager.js')
          const config = configManager.getConfig(configKey)

          if (!config) return json(res, 404, { error: 'Configuration not found' })
          return json(res, 200, config)
        } catch (error) {
          return json(res, 500, { error: 'Error loading configuration' })
        }
      }

      if (configKeyMatch && method === 'PUT') {
        try {
          const configKey = decodeURIComponent(configKeyMatch[1])
          const body = await readJson(req).catch(() => ({}))
          const { default: configManager } = await import('./config-manager.js')
          const actor = getActorFromRequest(req, url, panelDb)

          const version = await configManager.setConfig(configKey, body, {
            userId: actor?.username || 'unknown',
          })

          try {
            const { getIO } = await import('./socket-io.js')
            const io = getIO()
            if (io) io.emit('config:updated', { configKey, timestamp: new Date().toISOString(), version })
          } catch {}

          return json(res, 200, { success: true, version })
        } catch (error) {
          if (error.message && String(error.message).includes('validación')) {
            return json(res, 400, {
              error: 'Validation failed',
              validationErrors: String(error.message).split(': ')[1]?.split(', ') || [],
            })
          }
          return json(res, 500, { error: error.message })
        }
      }

      if (pathname.startsWith('/api/config/') && pathname.endsWith('/versions') && method === 'GET') {
        try {
          const configKey = pathname.split('/')[3]
          const { default: configManager } = await import('./config-manager.js')
          const versions = configManager.getVersionHistory(configKey)
          return json(res, 200, { versions })
        } catch (error) {
          return json(res, 500, { error: 'Error loading version history' })
        }
      }

      if (pathname.startsWith('/api/config/') && pathname.endsWith('/rollback') && method === 'POST') {
        try {
          const configKey = pathname.split('/')[3]
          const body = await readJson(req).catch(() => ({}))
          const { default: configManager } = await import('./config-manager.js')
          const actor = getActorFromRequest(req, url, panelDb)

          const version = await configManager.rollbackToVersion(
            configKey, 
            body.versionId, 
            actor?.username || 'unknown'
          )

          try {
            const { getIO } = await import('./socket-io.js')
            const io = getIO()
            if (io) io.emit('config:updated', { configKey, timestamp: new Date().toISOString(), version })
          } catch {}

          return json(res, 200, { success: true, version })
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      if (pathname.startsWith('/api/config/') && pathname.endsWith('/export') && method === 'GET') {
        try {
          const configKey = pathname.split('/')[3]
          const { default: configManager } = await import('./config-manager.js')
          const configData = await configManager.exportConfiguration(configKey)
          
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Content-Disposition', `attachment; filename="config-${configKey}.json"`)
          return res.end(configData)
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      if (pathname.startsWith('/api/config/') && pathname.endsWith('/import') && method === 'POST') {
        try {
          const configKey = pathname.split('/')[3]
          const body = await readJson(req).catch(() => ({}))
          const { default: configManager } = await import('./config-manager.js')
          const actor = getActorFromRequest(req, url, panelDb)
          
          const version = await configManager.importConfiguration(
            configKey, 
            body.config, 
            'json',
            actor?.username || 'unknown'
          )

          try {
            const { getIO } = await import('./socket-io.js')
            const io = getIO()
            if (io) io.emit('config:updated', { configKey, timestamp: new Date().toISOString(), version })
          } catch {}
          
          return json(res, 200, { success: true, version })
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      if (pathname === '/api/scheduled-messages' && method === 'POST') {
        const body = await readJson(req).catch(() => ({}))
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        
        const messageId = nextId(panelDb, 'scheduledMessagesCounter')
        const now = new Date().toISOString()
        
        // Calculate next send time
        let nextSend = new Date()
        if (body.schedule_type === 'once') {
          nextSend = new Date(`${body.schedule_date}T${body.schedule_time}`)
        } else {
          const [hours, minutes] = body.schedule_time.split(':')
          nextSend.setHours(parseInt(hours), parseInt(minutes), 0, 0)
          if (nextSend <= new Date()) {
            nextSend.setDate(nextSend.getDate() + 1)
          }
        }
        
        panelDb.scheduledMessages ||= {}
        panelDb.scheduledMessages[messageId] = {
          id: messageId,
          title: body.title || '',
          message: body.message || '',
          target_type: body.target_type || 'broadcast',
          target_id: body.target_id || null,
          target_name: body.target_name || null,
          schedule_type: body.schedule_type || 'once',
          schedule_time: body.schedule_time || '',
          schedule_date: body.schedule_date || null,
          repeat_days: body.repeat_days || [],
          enabled: body.enabled !== false,
          next_send: nextSend.toISOString(),
          sent_count: 0,
          created_at: now,
          updated_at: now,
          updated_at: now
        }
        
        return json(res, 201, panelDb.scheduledMessages[messageId])
      }

      if (pathname.startsWith('/api/scheduled-messages/') && method === 'PATCH') {
        const messageId = pathname.split('/')[3]
        const body = await readJson(req).catch(() => ({}))
        if (!panelDb?.scheduledMessages?.[messageId]) return json(res, 404, { error: 'Mensaje no encontrado' })
        
        panelDb.scheduledMessages[messageId] = {
          ...panelDb.scheduledMessages[messageId],
          ...body,
          updated_at: new Date().toISOString()
        }
        
        return json(res, 200, panelDb.scheduledMessages[messageId])
      }

      if (pathname.startsWith('/api/scheduled-messages/') && method === 'DELETE') {
        const messageId = pathname.split('/')[3]
        if (!panelDb?.scheduledMessages?.[messageId]) return json(res, 404, { error: 'Mensaje no encontrado' })
        
        delete panelDb.scheduledMessages[messageId]
        return json(res, 200, { success: true })
      }

      // System Alerts API - USANDO DATOS REALES
      if (pathname === '/api/system/alerts' && method === 'GET') {
        try {
          const alertsData = realTimeData.getSystemAlerts()
          return json(res, 200, alertsData)
        } catch (error) {
          console.error('Error obteniendo alertas del sistema:', error)
          return json(res, 500, { error: 'Error interno del servidor' })
        }
      }

      if (pathname.startsWith('/api/system/alerts/') && method === 'PATCH') {
        const alertId = pathname.split('/')[4]
        if (!panelDb?.alerts?.[alertId]) return json(res, 404, { error: 'Alerta no encontrada' })
        
        if (!panelDb.alerts) panelDb.alerts = {}
        panelDb.alerts[alertId].read = true
        return json(res, 200, panelDb.alerts[alertId])
      }

      // Community Users API
      if (pathname === '/api/community/users' && method === 'GET') {
        const page = clampInt(url.searchParams.get('page'), { min: 1, fallback: 1 })
        const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 100, fallback: 20 })
        const search = url.searchParams.get('search') || ''
        const status = url.searchParams.get('status') || 'all'
        const role = url.searchParams.get('role') || 'all'

        const whatsappUsers = global.db?.data?.users || {}
        const chats = global.db?.data?.chats || {}
        
        // Filtrar solo usuarios individuales (no grupos ni canales)
        const communityUsers = Object.entries(whatsappUsers)
          .filter(([jid]) => {
            // Solo incluir usuarios individuales (terminan en @s.whatsapp.net)
            // Excluir grupos (@g.us) y canales (@newsletter)
            return jid.includes('@s.whatsapp.net')
          })
          .map(([jid, userData]) => {
            const chatData = chats[jid] || {}
            const messageCount = userData?.messageCount || 0
            const commandCount = userData?.commandCount || 0
            const lastSeen = userData?.lastSeen || userData?.updated_at
            const isActive = lastSeen && (Date.now() - new Date(lastSeen).getTime()) < 7 * 24 * 60 * 60 * 1000 // 7 días
            const isBanned = chatData?.isBanned || false
            
            // Determinar rol basado en grupos
            let userRole = 'member'
            if (global.owner && global.owner.includes(jid.split('@')[0])) {
              userRole = 'owner'
            } else if (userData?.isAdmin) {
              userRole = 'admin'
            }

            // Obtener grupos del usuario
            const userGroups = Object.keys(chats).filter(chatJid => {
              const chat = chats[chatJid]
              return chatJid.includes('@g.us') && chat?.participants?.includes(jid)
            }).map(groupJid => {
              const groupData = panelDb?.groups?.[groupJid]
              return groupData?.nombre || groupJid.split('@')[0]
            })

            return {
              jid,
              name: userData?.name || userData?.pushName,
              pushName: userData?.pushName,
              lastSeen,
              messageCount,
              commandCount,
              joinDate: userData?.created_at || userData?.firstSeen,
              isActive: Boolean(isActive),
              isBanned,
              role: userRole,
              groups: userGroups
            }
          })

        // Filtrar usuarios
        let filteredUsers = communityUsers
        if (search) {
          filteredUsers = filteredUsers.filter(user => 
            user.name?.toLowerCase().includes(search.toLowerCase()) ||
            user.pushName?.toLowerCase().includes(search.toLowerCase()) ||
            user.jid.includes(search)
          )
        }
        if (status !== 'all') {
          filteredUsers = filteredUsers.filter(user => {
            if (status === 'active') return user.isActive
            if (status === 'banned') return user.isBanned
            if (status === 'inactive') return !user.isActive && !user.isBanned
            return true
          })
        }
        if (role !== 'all') {
          filteredUsers = filteredUsers.filter(user => user.role === role)
        }

        // Ordenar por actividad
        filteredUsers.sort((a, b) => b.messageCount - a.messageCount)

        const { items, pagination } = paginateArray(filteredUsers, { page, limit })
        return json(res, 200, { data: items, pagination })
      }

      // Community Stats API
      if (pathname === '/api/community/stats' && method === 'GET') {
        const whatsappUsers = global.db?.data?.users || {}
        const chats = global.db?.data?.chats || {}
        const logs = panelDb?.logs || []
        
        // Filtrar solo usuarios individuales (no grupos)
        const realUsers = Object.entries(whatsappUsers).filter(([jid]) => jid.includes('@s.whatsapp.net'))
        
        const totalUsers = realUsers.length
        const activeUsers = realUsers.filter(([jid, user]) => {
          const lastSeen = user?.lastSeen || user?.updated_at
          return lastSeen && (Date.now() - new Date(lastSeen).getTime()) < 7 * 24 * 60 * 60 * 1000
        }).length
        
        // Contar usuarios baneados (solo usuarios individuales)
        const bannedUsers = Object.entries(chats).filter(([jid, chat]) => 
          jid.includes('@s.whatsapp.net') && chat?.isBanned
        ).length
        
        const today = new Date().toISOString().slice(0, 10)
        const newUsersToday = realUsers.filter(([jid, user]) => {
          const joinDate = user?.created_at || user?.firstSeen
          return joinDate && joinDate.slice(0, 10) === today
        }).length

        const messagesTotal = logs.filter(l => l?.tipo === 'mensaje').length
        const commandsTotal = logs.filter(l => l?.tipo === 'comando').length

        // Top usuarios más activos (solo usuarios reales)
        const topUsers = realUsers
          .map(([jid, userData]) => ({
            jid,
            name: userData?.name || userData?.pushName,
            pushName: userData?.pushName,
            messageCount: userData?.messageCount || 0,
            commandCount: userData?.commandCount || 0
          }))
          .sort((a, b) => b.messageCount - a.messageCount)
          .slice(0, 10)

        return json(res, 200, {
          totalUsers,
          activeUsers,
          bannedUsers,
          newUsersToday,
          messagesTotal,
          commandsTotal,
          topUsers
        })
      }

      // Ban/Unban Community User
      if (pathname.startsWith('/api/community/users/') && pathname.endsWith('/ban') && method === 'POST') {
        const jid = decodeURIComponent(pathname.split('/')[4])
        const body = await readJson(req).catch(() => ({}))
        const banned = body?.banned === true

        if (!global.db?.data?.chats) return json(res, 500, { error: 'DB no disponible' })
        
        if (!global.db?.data) return json(res, 500, { error: 'DB no disponible' })
        if (!global.db.data.chats) global.db.data.chats = {}
        global.db.data.chats[jid] ||= {}
        global.db.data.chats[jid].isBanned = banned
        
        return json(res, 200, { success: true, banned })
      }

      // Promote/Demote Community User
      if (pathname.startsWith('/api/community/users/') && pathname.endsWith('/promote') && method === 'POST') {
        const jid = decodeURIComponent(pathname.split('/')[4])
        const body = await readJson(req).catch(() => ({}))
        const role = body?.role || 'member'

        if (!global.db?.data?.users?.[jid]) return json(res, 404, { error: 'Usuario no encontrado' })
        
        if (!global.db?.data) return json(res, 500, { error: 'DB no disponible' })
        if (!global.db.data.users) global.db.data.users = {}
        global.db.data.users[jid] = global.db.data.users[jid] || {}
        global.db.data.users[jid].isAdmin = role === 'admin'
        global.db.data.users[jid].role = role
        
        return json(res, 200, { success: true, role })
      }

      // Recent Activity API
      if (pathname === '/api/dashboard/recent-activity' && method === 'GET') {
        const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 50, fallback: 10 })
        const activities = []

        // Actividad de aportes recientes
        const aportes = ensureAportesStore() || []
        const recentAportes = aportes
          .sort((a, b) => new Date(b.fecha_creacion || b.created_at || 0).getTime() - new Date(a.fecha_creacion || a.created_at || 0).getTime())
          .slice(0, 3)
        
        recentAportes.forEach(aporte => {
          activities.push({
            icon: 'Package',
            title: 'Nuevo aporte',
            desc: aporte.titulo || 'Aporte recibido',
            time: formatTimeAgo(aporte.fecha_creacion || aporte.created_at),
            color: 'success',
            timestamp: new Date(aporte.fecha_creacion || aporte.created_at || 0).getTime()
          })
        })

        // Actividad de pedidos recientes
        const pedidos = panelDb ? Object.values(panelDb.pedidos || {}) : []
        const recentPedidos = pedidos
          .sort((a, b) => new Date(b.fecha_creacion || b.created_at || 0).getTime() - new Date(a.fecha_creacion || a.created_at || 0).getTime())
          .slice(0, 3)
        
        recentPedidos.forEach(pedido => {
          activities.push({
            icon: 'ShoppingCart',
            title: 'Nuevo pedido',
            desc: pedido.titulo || 'Pedido creado',
            time: formatTimeAgo(pedido.fecha_creacion || pedido.created_at),
            color: 'warning',
            timestamp: new Date(pedido.fecha_creacion || pedido.created_at || 0).getTime()
          })
        })

        // Actividad de usuarios nuevos
        const whatsappUsers = global.db?.data?.users || {}
        const recentUsers = Object.entries(whatsappUsers)
          .filter(([jid, userData]) => userData?.created_at || userData?.firstSeen)
          .sort((a, b) => new Date(b[1].created_at || b[1].firstSeen || 0).getTime() - new Date(a[1].created_at || a[1].firstSeen || 0).getTime())
          .slice(0, 2)
        
        recentUsers.forEach(([jid, userData]) => {
          activities.push({
            icon: 'Users',
            title: 'Usuario nuevo',
            desc: `${userData.name || userData.pushName || 'Usuario'} se unió`,
            time: formatTimeAgo(userData.created_at || userData.firstSeen),
            color: 'info',
            timestamp: new Date(userData.created_at || userData.firstSeen || 0).getTime()
          })
        })

        // Actividad de subbots
        const subbots = panelDb ? Object.values(panelDb.subbots || {}) : []
        const recentSubbots = subbots
          .filter(s => s.fecha_creacion || s.created_at)
          .sort((a, b) => new Date(b.fecha_creacion || b.created_at || 0).getTime() - new Date(a.fecha_creacion || a.created_at || 0).getTime())
          .slice(0, 2)
        
        recentSubbots.forEach(subbot => {
          const isOnline = findConnBySubbotCode(subbot.codigo || subbot.code)?.user
          activities.push({
            icon: 'Zap',
            title: isOnline ? 'SubBot conectado' : 'SubBot creado',
            desc: `Instancia ${subbot.codigo || subbot.code}`,
            time: formatTimeAgo(subbot.fecha_creacion || subbot.created_at),
            color: isOnline ? 'success' : 'primary',
            timestamp: new Date(subbot.fecha_creacion || subbot.created_at || 0).getTime()
          })
        })

        // Actividad de logs recientes (mensajes y comandos)
        const logs = panelDb?.logs || []
        const recentLogs = logs
          .filter(log => log?.fecha && (log.tipo === 'mensaje' || log.tipo === 'comando'))
          .sort((a, b) => new Date(b.fecha || 0).getTime() - new Date(a.fecha || 0).getTime())
          .slice(0, 3)
        
        recentLogs.forEach(log => {
          activities.push({
            icon: log.tipo === 'comando' ? 'Settings' : 'MessageSquare',
            title: log.tipo === 'comando' ? 'Comando ejecutado' : 'Mensaje procesado',
            desc: log.mensaje || log.comando || 'Actividad del bot',
            time: formatTimeAgo(log.fecha),
            color: log.tipo === 'comando' ? 'violet' : 'info',
            timestamp: new Date(log.fecha || 0).getTime()
          })
        })

        // Ordenar por timestamp y limitar
        const sortedActivities = activities
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit)
          .map(activity => {
            const { timestamp, ...rest } = activity
            return rest
          })

        return json(res, 200, { data: sortedActivities })
      }

      // Bot global state
      if (pathname === '/api/bot/global-state' && method === 'GET') {
        return json(res, 200, panelDb?.botGlobalState || { isOn: true, lastUpdated: null })
      }
      if (pathname === '/api/bot/global-state' && method === 'POST') {
        const body = await readJson(req).catch(() => ({}))
        const isOn = body?.isOn === false ? false : true
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        panelDb.botGlobalState = { isOn, lastUpdated: new Date().toISOString() }
        
        // Emitir eventos Socket.IO específicos
        try {
          const { emitBotStatus, emitNotification, getIO } = await import('./socket-io.js')
          emitBotStatus()
          
          // Emitir evento específico de cambio de estado global
          const io = getIO()
          if (io) {
            io.emit('bot:globalStateChanged', { isOn })
            if (isOn) {
              io.emit('bot:globalStartup', { timestamp: new Date().toISOString() })
            } else {
              io.emit('bot:globalShutdown', { timestamp: new Date().toISOString() })
            }
          }
          
          emitNotification({
            type: isOn ? 'success' : 'warning',
            title: isOn ? 'Bot Activado' : 'Bot Desactivado',
            message: isOn ? 'El bot está activo globalmente' : 'El bot está desactivado globalmente'
          })
        } catch {}
        
        return json(res, 200, { success: true, ...panelDb.botGlobalState })
      }
      if (pathname === '/api/bot/global-shutdown' && method === 'POST') {
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        const now = new Date().toISOString()
        panelDb.botGlobalState = { isOn: false, lastUpdated: now }
        panelDb.globalNotifications ||= {}
        if (panelDb) await syncGroups(panelDb).catch(() => {})
        const mensaje = panelDb.botGlobalOffMessage || 'El bot está desactivado globalmente por el administrador.'
        
        // Emitir evento Socket.IO
        emitBotStatus()
        emitNotification({
          type: 'warning',
          title: 'Bot Desactivado Globalmente',
          message: mensaje
        })
        
        for (const g of Object.values(panelDb.groups || {})) {
          const jid = g?.wa_jid || g?.jid
          if (!jid) continue
          const id = nextId(panelDb, 'globalNotificationsCounter')
          panelDb.globalNotifications[id] = {
            id,
            grupo_jid: jid,
            grupo_nombre: safeString(g?.nombre || jid),
            tipo: 'global-shutdown',
            mensaje,
            enviado_por: 'panel',
            fecha_envio: now,
            estado: 'enviado',
          }
        }
        return json(res, 200, { success: true, message: 'Bot global OFF' })
      }
      if (pathname === '/api/bot/global-startup' && method === 'POST') {
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        const now = new Date().toISOString()
        panelDb.botGlobalState = { isOn: true, lastUpdated: now }
        return json(res, 200, { success: true, message: 'Bot global ON' })
      }

      // Bot global off message
      if (pathname === '/api/bot/global-off-message' && method === 'GET') {
        const message = panelDb?.botGlobalOffMessage || 'El bot estǭ desactivado globalmente por el administrador.'
        return json(res, 200, { message })
      }
      if (pathname === '/api/bot/global-off-message' && method === 'POST') {
        const body = await readJson(req).catch(() => ({}))
        const message = safeString(body?.message).trim()
        if (!message) return json(res, 400, { error: 'Mensaje invǭlido' })
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        panelDb.botGlobalOffMessage = message
        return json(res, 200, { success: true, message: 'Mensaje actualizado' })
      }

      // Grupos (lista + filtros)
      if (pathname === '/api/grupos' && method === 'GET') {
        // Grupos endpoint necesita datos actualizados pero no en cada request
        if (panelDb) await syncGroupsOnDemand(panelDb).catch(() => {})
        const search = safeString(url.searchParams.get('search')).toLowerCase()
        const botEnabledRaw = safeString(url.searchParams.get('botEnabled')).toLowerCase()
        const proveedorRaw = safeString(url.searchParams.get('proveedor')).toLowerCase()

        const botEnabledFilter =
          botEnabledRaw === 'true' || botEnabledRaw === '1' ? true :
            botEnabledRaw === 'false' || botEnabledRaw === '0' ? false : null
        const proveedorFilter =
          proveedorRaw === 'true' || proveedorRaw === '1' ? true :
            proveedorRaw === 'false' || proveedorRaw === '0' ? false : null

        const groupsMap = panelDb?.groups || {}
        const mapped = Object.values(groupsMap).map((g) => {
          const jid = g?.wa_jid || g?.jid
          const chat = jid ? ensureChatRecord(jid) : null
          const bot_enabled = chat ? !chat.isBanned : true
          return {
            id: Number(g?.id || 0),
            nombre: safeString(g?.nombre || ''),
            descripcion: safeString(g?.descripcion || ''),
            wa_jid: jid,
            bot_enabled,
            es_proveedor: Boolean(g?.es_proveedor),
            created_at: g?.created_at || new Date().toISOString(),
            updated_at: g?.updated_at || g?.created_at || new Date().toISOString(),
            usuario: null,
          }
        })

        const filtered = mapped.filter((g) => {
          if (search) {
            const hay = `${g.nombre} ${g.wa_jid}`.toLowerCase()
            if (!hay.includes(search)) return false
          }
          if (botEnabledFilter !== null && g.bot_enabled !== botEnabledFilter) return false
          if (proveedorFilter !== null && g.es_proveedor !== proveedorFilter) return false
          return true
        })

        filtered.sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''))

        const { items, pagination } = paginateArray(filtered, {
          page: url.searchParams.get('page') || 1,
          limit: url.searchParams.get('limit') || 20,
        })

        return json(res, 200, { grupos: items, pagination })
      }

      // Grupos (crear)
      if (pathname === '/api/grupos' && method === 'POST') {
        const body = await readJson(req).catch(() => ({}))
        const jid = safeString(body?.jid || body?.wa_jid).trim()
        if (!jid) return json(res, 400, { error: 'jid es requerido' })
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })

        const now = new Date().toISOString()
        panelDb.groups ||= {}
        if (!panelDb.groups[jid]) {
          const id = nextId(panelDb, 'groupsCounter')
          panelDb.groups[jid] = {
            id,
            wa_jid: jid,
            nombre: safeString(body?.nombre || jid),
            descripcion: safeString(body?.descripcion || ''),
            es_proveedor: Boolean(body?.es_proveedor),
            created_at: now,
            updated_at: now,
            usuario: null,
          }
        } else {
          if (!panelDb.groups) panelDb.groups = {}
          if (!panelDb.groups[jid]) panelDb.groups[jid] = {}
          panelDb.groups[jid].nombre = safeString(body?.nombre || panelDb.groups[jid]?.nombre || jid)
          if (typeof body?.descripcion !== 'undefined') panelDb.groups[jid].descripcion = safeString(body?.descripcion)
          if (typeof body?.es_proveedor !== 'undefined') panelDb.groups[jid].es_proveedor = Boolean(body?.es_proveedor)
          panelDb.groups[jid].updated_at = now
        }

        const chat = ensureChatRecord(jid)
        const botEnabled = body?.botEnabled
        if (typeof botEnabled === 'boolean' && chat) chat.isBanned = !botEnabled

        const group = panelDb?.groups?.[jid]
        return json(res, 200, {
          id: Number(group?.id || 0),
          nombre: safeString(group?.nombre || ''),
          descripcion: safeString(group?.descripcion || ''),
          wa_jid: jid,
          bot_enabled: chat ? !chat.isBanned : true,
          es_proveedor: Boolean(group?.es_proveedor),
          created_at: group?.created_at || now,
          updated_at: group?.updated_at || now,
          usuario: null,
        })
      }

      // Grupos disponibles
      if (pathname === '/api/grupos/available' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        
        const groups = Object.values(panelDb?.groups || {}).map((g) => ({
          id: g?.id || 0,
          jid: g?.wa_jid || g?.jid,
          wa_jid: g?.wa_jid || g?.jid,
          nombre: safeString(g?.nombre || ''),
          descripcion: safeString(g?.descripcion || ''),
          es_proveedor: Boolean(g?.es_proveedor)
        }))
        
        return json(res, 200, { 
          grupos: groups,
          debug: {
            totalGroups: groups.length,
            hasConnection: !!global.conn,
            connectionStatus: global.stopped || 'unknown'
          }
        })
      }

      // Grupos stats
      if (pathname === '/api/grupos/stats' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })

        // Stats no necesita sync frecuente
        if (panelDb) await syncGroupsOnDemand(panelDb).catch(() => {})

        const groups = Object.values(panelDb?.groups || {})
        let autorizados = 0
        let proveedores = 0
        for (const g of groups) {
          const jid = g?.wa_jid || g?.jid
          const chat = jid ? ensureChatRecord(jid) : null
          if (!chat?.isBanned) autorizados += 1
          if (g?.es_proveedor) proveedores += 1
        }

        // Datos reales (grupos WhatsApp y actividad desde logs) para Analytics
        const now = new Date()
        const todayKey = now.toISOString().slice(0, 10)
        const yesterdayKey = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

        const chats = global.db?.data?.chats || {}
        const totalGroupsReal = Object.keys(chats).filter((jid) => String(jid).endsWith('@g.us')).length || groups.length

        const panel = global.db?.data?.panel || {}
        const logs = Array.isArray(panel.logs) ? panel.logs : []
        const logsToday = logs.filter((l) => String(l?.fecha || '').slice(0, 10) === todayKey)
        const logsYesterday = logs.filter((l) => String(l?.fecha || '').slice(0, 10) === yesterdayKey)

        const groupsToday = new Set(logsToday.map((l) => l?.grupo).filter((g) => typeof g === 'string' && g.includes('@g.us')))
        const groupsYesterday = new Set(logsYesterday.map((l) => l?.grupo).filter((g) => typeof g === 'string' && g.includes('@g.us')))

        const hourlyActivityReal = []
        for (let i = 23; i >= 0; i--) {
          const hour = new Date(now.getTime() - i * 60 * 60 * 1000)
          const hourStart = new Date(hour)
          hourStart.setMinutes(0, 0, 0)
          const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000)
          const active = new Set()
          for (const l of logs) {
            const t = new Date(l?.fecha || 0).getTime()
            if (!Number.isFinite(t) || t < hourStart.getTime() || t >= hourEnd.getTime()) continue
            const g = l?.grupo
            if (typeof g === 'string' && g.includes('@g.us')) active.add(g)
          }
          hourlyActivityReal.push({
            name: hour.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            value: active.size,
            timestamp: hour.toISOString()
          })
        }

        return json(res, 200, {
          // Analytics (lo usa `frontend-next/src/app/(dashboard)/analytics/page.tsx`)
          total: totalGroupsReal,
          activeToday: groupsToday.size,
          activeYesterday: groupsYesterday.size,
          hourlyActivity: hourlyActivityReal,

          // Compat/extra para pรกginas de gestiรณ
          totalGrupos: groups.length,
          gruposAutorizados: autorizados,
          gruposBloqueados: Math.max(0, groups.length - autorizados),
          proveedores,
        })
      }

      // Sincronización forzada de grupos
      if (pathname === '/api/grupos/sync' && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) {
          return json(res, 401, { error: 'No autorizado' })
        }
        
        if (!panelDb) {
          return json(res, 500, { error: 'DB no disponible' })
        }
        
        const body = await readJson(req).catch(() => ({}))
        const clearOld = body?.clearOld === true
        
        try {
          // Si se solicita limpiar grupos antiguos
          if (clearOld) {
            panelDb.groups = {}
            panelDb.groupsCounter = 0
          }
          
          // Sincronizar grupos actuales desde WhatsApp
          await syncGroups(panelDb)
          
          const groups = Object.values(panelDb.groups || {})
          
          // Emitir notificación
          try {
            emitNotification({
              type: 'success',
              title: 'Grupos Sincronizados',
              message: `${groups.length} grupos sincronizados ${clearOld ? '(grupos antiguos eliminados)' : ''}`
            })
          } catch {}
          
          return json(res, 200, { 
            success: true, 
            message: 'Grupos sincronizados exitosamente',
            totalGroups: groups.length,
            clearedOld: clearOld
          })
        } catch (error) {
          console.error('Error sincronizando grupos:', error)
          return json(res, 500, { error: 'Error al sincronizar grupos: ' + (error?.message || String(error)) })
        }
      }

      // Grupos management (para pantalla global)
      if (pathname === '/api/grupos/management' && method === 'GET') {
        if (panelDb) await syncGroupsSafe(panelDb).catch(() => {})
        const globalOn = panelDb?.botGlobalState?.isOn !== false
        const groups = Object.values(panelDb?.groups || {}).map((g) => {
          const jid = g?.wa_jid || g?.jid
          const chat = jid ? ensureChatRecord(jid) : null
          const bot_activo = globalOn && (chat ? !chat.isBanned : true)
          return {
            id: jid,
            jid,
            nombre: safeString(g?.nombre || ''),
            descripcion: safeString(g?.descripcion || ''),
            bot_activo,
            desactivado_por: bot_activo ? null : 'panel',
            fecha_desactivacion: bot_activo ? null : (g?.updated_at || null),
            created_at: g?.created_at || null,
          }
        })
        return json(res, 200, { grupos: groups })
      }

      // Toggle bot en grupo
      const groupToggleMatch = pathname.match(/^\/api\/grupos\/([^/]+)\/toggle$/)
      if (groupToggleMatch && method === 'POST') {
        const groupId = decodeURIComponent(groupToggleMatch[1])
        const body = await readJson(req).catch(() => ({}))
        const action = safeString(body?.action).toLowerCase()
        const enable = action === 'on'
        const chat = ensureChatRecord(groupId)
        if (chat) chat.isBanned = !enable
        if (panelDb?.groups?.[groupId]) {
          if (!panelDb.groups) panelDb.groups = {}
          panelDb.groups[groupId].updated_at = new Date().toISOString()
        }
        
        // Emitir evento Socket.IO
        emitGrupoUpdated({ jid: groupId, isBanned: !enable, botEnabled: enable })
        emitNotification({
          type: enable ? 'success' : 'warning',
          title: enable ? 'Bot Activado en Grupo' : 'Bot Desactivado en Grupo',
          message: `El bot ha sido ${enable ? 'activado' : 'desactivado'} en el grupo`
        })
        
        return json(res, 200, { success: true, jid: groupId, bot_enabled: enable })
      }

      // Configurar opciones de grupo (antilink, welcome, nsfw, etc.)
      const groupConfigMatch = pathname.match(/^\/api\/grupos\/([^/]+)\/config$/)
      if (groupConfigMatch && (method === 'POST' || method === 'PATCH')) {
        const groupId = decodeURIComponent(groupConfigMatch[1])
        const body = await readJson(req).catch(() => ({}))
        const chat = ensureChatRecord(groupId)
        if (!chat) return json(res, 500, { error: 'No se pudo crear registro de chat' })
        
        // Aplicar configuraciones al chat del bot
        if (typeof body?.isBanned === 'boolean') chat.isBanned = body.isBanned
        if (typeof body?.botEnabled === 'boolean') chat.isBanned = !body.botEnabled
        if (typeof body?.modoadmin === 'boolean') chat.modoadmin = body.modoadmin
        if (typeof body?.antiLink === 'boolean') chat.antiLink = body.antiLink
        if (typeof body?.antiSpam === 'boolean') chat.antiSpam = body.antiSpam
        if (typeof body?.welcome === 'boolean') chat.welcome = body.welcome
        if (typeof body?.nsfw === 'boolean') chat.nsfw = body.nsfw
        if (typeof body?.economy === 'boolean') chat.economy = body.economy
        if (typeof body?.gacha === 'boolean') chat.gacha = body.gacha
        if (typeof body?.isMute === 'boolean') chat.isMute = body.isMute
        if (typeof body?.detect === 'boolean') chat.detect = body.detect
        if (typeof body?.sWelcome === 'string') chat.sWelcome = body.sWelcome
        if (typeof body?.sBye === 'string') chat.sBye = body.sBye
        
        if (panelDb?.groups?.[groupId]) {
          if (!panelDb.groups) panelDb.groups = {}
          panelDb.groups[groupId].updated_at = new Date().toISOString()
        }
        
        // Emitir evento Socket.IO
        emitGrupoUpdated({ jid: groupId, ...chat })
        
        return json(res, 200, { success: true, jid: groupId, config: chat })
      }
      
      // Obtener configuración de grupo
      if (groupConfigMatch && method === 'GET') {
        const groupId = decodeURIComponent(groupConfigMatch[1])
        const chat = global.db?.data?.chats?.[groupId] || {}
        const group = panelDb?.groups?.[groupId] || {}
        return json(res, 200, {
          jid: groupId,
          nombre: group.nombre || groupId,
          isBanned: chat.isBanned || false,
          botEnabled: !chat.isBanned,
          modoadmin: chat.modoadmin || false,
          antiLink: chat.antiLink || false,
          antiSpam: chat.antiSpam || false,
          welcome: chat.welcome || false,
          nsfw: chat.nsfw || false,
          economy: chat.economy !== false,
          gacha: chat.gacha !== false,
          isMute: chat.isMute || false,
          detect: chat.detect || false,
          sWelcome: chat.sWelcome || '',
          sBye: chat.sBye || '',
        })
      }

      // Toggle proveedor en grupo
      const groupProvMatch = pathname.match(/^\/api\/grupos\/([^/]+)\/proveedor$/)
      if (groupProvMatch && (method === 'PATCH' || method === 'POST')) {
        const groupId = decodeURIComponent(groupProvMatch[1])
        const body = await readJson(req).catch(() => ({}))
        const es_proveedor = body?.es_proveedor === true
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        panelDb.groups ||= {}
        panelDb.groups[groupId] ||= {
          id: nextId(panelDb, 'groupsCounter'),
          wa_jid: groupId,
          nombre: groupId,
          descripcion: '',
          es_proveedor: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          usuario: null,
        }
        if (!panelDb.groups) panelDb.groups = {}
        if (!panelDb.groups[groupId]) panelDb.groups[groupId] = {}
        panelDb.groups[groupId].es_proveedor = es_proveedor
        panelDb.groups[groupId].updated_at = new Date().toISOString()
        return json(res, 200, { success: true, jid: groupId, es_proveedor })
      }

      // Update/Delete grupo por JID
      const groupIdMatch = pathname.match(/^\/api\/grupos\/([^/]+)$/)
      if (groupIdMatch && (method === 'PUT' || method === 'PATCH')) {
        const groupId = decodeURIComponent(groupIdMatch[1])
        const body = await readJson(req).catch(() => ({}))
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        panelDb.groups ||= {}
        panelDb.groups[groupId] ||= {
          id: nextId(panelDb, 'groupsCounter'),
          wa_jid: groupId,
          nombre: groupId,
          descripcion: '',
          es_proveedor: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          usuario: null,
        }
        if (typeof body?.nombre !== 'undefined') panelDb.groups[groupId].nombre = safeString(body.nombre)
        if (typeof body?.descripcion !== 'undefined') panelDb.groups[groupId].descripcion = safeString(body.descripcion)
        if (typeof body?.es_proveedor !== 'undefined') panelDb.groups[groupId].es_proveedor = Boolean(body.es_proveedor)
        if (typeof body?.botEnabled === 'boolean') {
          const chat = ensureChatRecord(groupId)
          if (chat) chat.isBanned = !body.botEnabled
        }
        panelDb.groups[groupId].updated_at = new Date().toISOString()
        return json(res, 200, { success: true })
      }
      if (groupIdMatch && method === 'DELETE') {
        const groupId = decodeURIComponent(groupIdMatch[1])
        if (panelDb?.groups?.[groupId]) delete panelDb.groups[groupId]
        return json(res, 200, { success: true })
      }

      // Subbots list
      if (pathname === '/api/subbots' && method === 'GET') {
        if (!isAuthorized(req)) return json(res, 401, { error: 'Token requerido' })
        const list = await getSubbotsList()
        return json(res, 200, list)
      }

      // Subbots status
      if (pathname === '/api/subbots/status' && method === 'GET') {
        const list = await getSubbotsList()
        const subbots = list.map((s) => ({ subbotId: s.code, isOnline: s.isOnline, status: s.status }))
        return json(res, 200, { subbots })
      }

      // Create subbot (QR)
      if (pathname === '/api/subbots/qr' && method === 'POST') {
        if (!isAuthorized(req)) return json(res, 401, { error: 'Token requerido' })
        const body = await readJson(req).catch(() => ({}))
        const usuario = body?.usuario || 'admin'
        if (!global.db?.data && typeof global.loadDatabase === 'function') await global.loadDatabase()
        const panelDb = ensurePanelDb()
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })

        const code = makeSubbotCode()
        const sessionPath = path.join(getJadiRoot(), code)
        fs.mkdirSync(sessionPath, { recursive: true })

        const id = nextSubbotId(panelDb)
        const record = {
          id,
          code,
          codigo: code,
          tipo: 'qr',
          usuario,
          fecha_creacion: new Date().toISOString(),
          session_dir: code,
          estado: 'activo',
        }
        panelDb.subbots[code] = record

        const { yukiJadiBot } = await import('../plugins/sockets-serbot.js')
        const qrData = await yukiJadiBot({
          pathYukiJadiBot: sessionPath,
          m: null,
          conn: global.conn,
          args: [],
          usedPrefix: '/',
          command: 'qr',
          api: {
            code,
            onUpdate: (patch) => {
              Object.assign(record, patch)
              // Emitir QR en tiempo real
              if (patch.qr_data) {
                emitSubbotQR(code, patch.qr_data)
              }
            },
            onConnected: (phone) => {
              emitSubbotConnected(code, phone)
            },
          },
        })

        if (!qrData?.success) {
          delete panelDb.subbots[code]
          try { fs.rmSync(sessionPath, { recursive: true, force: true }) } catch {}
          return json(res, 400, { error: qrData?.error || 'No se pudo crear el subbot' })
        }
        
        if (qrData?.qr) {
          record.qr_data = qrData.qr
          // Emitir QR en tiempo real
          emitSubbotQR(code, qrData.qr)
        }
        
        // Emitir evento de subbot creado
        emitSubbotCreated(normalizeSubbotForPanel(record, { isOnline: false }))
        
        return json(res, 200, normalizeSubbotForPanel(record, { isOnline: false }))
      }

      // Create subbot (CODE)
      if (pathname === '/api/subbots/code' && method === 'POST') {
        if (!isAuthorized(req)) return json(res, 401, { error: 'Token requerido' })
        const body = await readJson(req).catch(() => ({}))
        const usuario = body?.usuario || 'admin'
        const numero = String(body?.numero || '').replace(/[^0-9]/g, '')
        if (!numero) return json(res, 400, { error: 'numero es requerido' })
        if (!global.db?.data && typeof global.loadDatabase === 'function') await global.loadDatabase()
        const panelDb = ensurePanelDb()
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })

        const code = makeSubbotCode()
        const sessionPath = path.join(getJadiRoot(), code)
        fs.mkdirSync(sessionPath, { recursive: true })

        const id = nextSubbotId(panelDb)
        const record = {
          id,
          code,
          codigo: code,
          tipo: 'code',
          usuario,
          numero,
          fecha_creacion: new Date().toISOString(),
          session_dir: code,
          estado: 'activo',
        }
        panelDb.subbots[code] = record

        const { yukiJadiBot } = await import('../plugins/sockets-serbot.js')
        const result = await yukiJadiBot({
          pathYukiJadiBot: sessionPath,
          m: null,
          conn: global.conn,
          args: [],
          usedPrefix: '/',
          command: 'code',
          api: {
            code,
            pairingNumber: numero,
            onUpdate: (patch) => {
              Object.assign(record, patch)
              // Emitir código de pairing en tiempo real
              if (patch.pairingCode) {
                emitSubbotPairingCode(code, patch.pairingCode, numero)
              }
            },
            onConnected: (phone) => {
              emitSubbotConnected(code, phone)
            },
          },
        })

        if (!result?.success) {
          delete panelDb.subbots[code]
          try { fs.rmSync(sessionPath, { recursive: true, force: true }) } catch {}
          return json(res, 400, { error: result?.error || 'No se pudo crear el subbot' })
        }
        
        if (result?.pairingCode) {
          record.pairingCode = result.pairingCode
          // Emitir código de pairing en tiempo real
          emitSubbotPairingCode(code, result.pairingCode, numero)
        }
        
        // Emitir evento de subbot creado
        emitSubbotCreated(normalizeSubbotForPanel(record, { isOnline: false }))
        
        return json(res, 200, normalizeSubbotForPanel(record, { isOnline: false }))
        
        return json(res, 200, normalizeSubbotForPanel(record, { isOnline: false }))
      }

      // Get QR image (fallback)
      const subbotQrMatch =
        pathname.match(/^\/api\/subbots\/([^/]+)\/qr$/) ||
        pathname.match(/^\/api\/subbot\/qr\/([^/]+)$/) // compat
      if (subbotQrMatch && method === 'GET') {
        const idOrCode = decodeURIComponent(subbotQrMatch[1])
        if (!global.db?.data && typeof global.loadDatabase === 'function') await global.loadDatabase()
        const panelDb = ensurePanelDb()
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        const record = resolveSubbotRecordByParam(panelDb, idOrCode)
        if (!record?.qr_data) return json(res, 404, { error: 'QR no disponible' })
        const buf = await qrcode.toBuffer(record.qr_data, { scale: 8 })
        return json(res, 200, { qr: buf.toString('base64') })
      }

      // Delete subbot
      const delMatch =
        pathname.match(/^\/api\/subbots\/([^/]+)$/) ||
        pathname.match(/^\/api\/subbot\/([^/]+)$/) // compat
      if (delMatch && method === 'DELETE') {
        if (!isAuthorized(req)) return json(res, 401, { error: 'Token requerido' })
        const idOrCode = decodeURIComponent(delMatch[1])
        const result = await deleteSubbotByCode(idOrCode)
        if (!result.success) return json(res, 404, result)
        // Emitir evento de subbot eliminado
        emitSubbotDeleted(idOrCode)
        return json(res, 200, result)
      }

      // ===== Subbots (compat KONMI) =====
      if (pathname === '/api/subbot/list' && method === 'GET') {
        const list = await getSubbotsList()
        return json(res, 200, { subbots: list })
      }
      if (pathname === '/api/subbot/status' && method === 'GET') {
        const list = await getSubbotsList()
        const subbots = list.map((s) => ({
          subbotId: s.code,
          code: s.code,
          isOnline: s.isOnline,
          connected: s.isOnline,
          isConnected: s.isOnline,
          status: s.status,
        }))
        return json(res, 200, { subbots })
      }
      if (pathname === '/api/subbot/create' && method === 'POST') {
        const body = await readJson(req).catch(() => ({}))
        const type = body?.type === 'code' ? 'code' : 'qr'
        const usuario = body?.usuario || 'admin'
        const phoneNumber = body?.phoneNumber ? String(body.phoneNumber).replace(/[^0-9]/g, '') : null
        if (type === 'code' && !phoneNumber) return json(res, 400, { success: false, error: 'phoneNumber es requerido' })
        if (!panelDb) return json(res, 500, { success: false, error: 'DB no disponible' })

        const code = makeSubbotCode()
        const sessionPath = path.join(getJadiRoot(), code)
        fs.mkdirSync(sessionPath, { recursive: true })

        const id = nextSubbotId(panelDb)
        const record = {
          id,
          code,
          codigo: code,
          tipo: type,
          usuario,
          numero: phoneNumber,
          fecha_creacion: new Date().toISOString(),
          session_dir: code,
          estado: 'activo',
        }
        panelDb.subbots[code] = record

        const { yukiJadiBot } = await import('../plugins/sockets-serbot.js')
        const isOnline = false
        const result = await yukiJadiBot({
          pathYukiJadiBot: sessionPath,
          m: null,
          conn: global.conn,
          args: [],
          usedPrefix: '/',
          command: type === 'code' ? 'code' : 'qr',
          api: {
            code,
            pairingNumber: phoneNumber,
            onUpdate: (patch) => {
              const prevNumero = record.numero
              Object.assign(record, patch)
              try {
                if (patch?.qr_data) emitSubbotQR(code, patch.qr_data)
                if (patch?.pairingCode) emitSubbotPairingCode(code, patch.pairingCode, phoneNumber)
                if (patch?.numero && String(patch.numero) !== String(prevNumero || '')) {
                  emitSubbotConnected(code, String(patch.numero))
                }
              } catch {}
            },
          },
        })

        if (!result?.success) {
          delete panelDb.subbots[code]
          try { fs.rmSync(sessionPath, { recursive: true, force: true }) } catch {}
          return json(res, 400, { success: false, error: result?.error || 'No se pudo crear el subbot' })
        }
        if (result?.qr) record.qr_data = result.qr
        if (result?.pairingCode) record.pairingCode = result.pairingCode

        const payload = normalizeSubbotForPanel(record, { isOnline })
        emitSubbotCreated(payload)

        return json(res, 200, payload)
      }
      const subbotDelCompat = pathname.match(/^\/api\/subbot\/([^/]+)$/)
      if (subbotDelCompat && method === 'DELETE') {
        const idOrCode = decodeURIComponent(subbotDelCompat[1])
        const result = await deleteSubbotByCode(idOrCode)
        if (!result.success) return json(res, 404, result)
        return json(res, 200, { success: true })
      }
      const subbotQrCompat = pathname.match(/^\/api\/subbot\/qr\/([^/]+)$/)
      if (subbotQrCompat && method === 'GET') {
        const idOrCode = decodeURIComponent(subbotQrCompat[1])
        const record = panelDb ? resolveSubbotRecordByParam(panelDb, idOrCode) : null
        if (!record?.qr_data) return json(res, 404, { success: false, error: 'QR no disponible' })
        const buf = await qrcode.toBuffer(record.qr_data, { scale: 8 })
        return json(res, 200, { success: true, qr: buf.toString('base64') })
      }

      // ===== Aportes =====
      if (pathname === '/api/aportes/stats' && method === 'GET') {
        // No necesita sync de grupos para estadísticas de aportes
        const store = ensureAportesStore() || []
        const mapped = store.map((e) => mapAporteForPanel(e, panelDb))
        const stats = computeAportesStats(mapped)
        return json(res, 200, {
          ...stats,
          totalAportes: stats.total,
          aportesPendientes: stats.pendientes,
          aportesAprobados: stats.aprobados,
          aportesRechazados: stats.rechazados,
        })
      }

      if (pathname === '/api/aportes' && method === 'GET') {
        // Solo sync grupos si es necesario para mostrar nombres de grupos
        if (panelDb) await syncGroupsSafe(panelDb).catch(() => {})
        const store = ensureAportesStore() || []
        const mapped = store
          .map((e) => mapAporteForPanel(e, panelDb))
          .sort((a, b) => String(b.fecha_creacion || '').localeCompare(String(a.fecha_creacion || '')))

        const search = safeString(url.searchParams.get('search')).toLowerCase()
        const estado = safeString(url.searchParams.get('estado')).toLowerCase()
        const fuente = safeString(url.searchParams.get('fuente')).toLowerCase()
        const tipo = safeString(url.searchParams.get('tipo')).toLowerCase()

        const filtered = mapped.filter((a) => {
          if (search) {
            const hay = `${a.titulo} ${a.contenido} ${a.usuario} ${a.grupo_nombre || ''}`.toLowerCase()
            if (!hay.includes(search)) return false
          }
          if (estado && a.estado.toLowerCase() !== estado) return false
          if (tipo && a.tipo.toLowerCase() !== tipo) return false
          if (fuente && a.fuente.toLowerCase() !== fuente) return false
          return true
        })

        const wantsPagination = url.searchParams.has('page') || url.searchParams.has('limit')
        if (wantsPagination) {
          const { items, pagination } = paginateArray(filtered, {
            page: url.searchParams.get('page') || 1,
            limit: url.searchParams.get('limit') || 20,
          })
          return json(res, 200, { aportes: items, pagination })
        }
        return json(res, 200, filtered)
      }

      if (pathname === '/api/aportes' && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const store = ensureAportesStore()
        if (!store) return json(res, 500, { error: 'DB no disponible' })
        
        let body = {}
        let files = []
        
        // Verificar si es multipart/form-data (para archivos)
        const contentType = req.headers['content-type'] || ''
        if (contentType.includes('multipart/form-data')) {
          try {
            const bodyBuffer = await readBodyBuffer(req)
            const boundary = contentType.split('boundary=')[1]
            
            if (boundary) {
              // Parsear multipart data manualmente (simplificado)
              const parts = bodyBuffer.toString().split(`--${boundary}`)
              
              for (const part of parts) {
                if (!part.includes('Content-Disposition')) continue
                
                const lines = part.split('\r\n')
                const dispositionLine = lines.find(line => line.includes('Content-Disposition'))
                
                if (dispositionLine?.includes('name="titulo"')) {
                  body.titulo = lines[lines.length - 2]?.trim() || ''
                } else if (dispositionLine?.includes('name="descripcion"')) {
                  body.descripcion = lines[lines.length - 2]?.trim() || ''
                } else if (dispositionLine?.includes('name="tipo"')) {
                  body.tipo = lines[lines.length - 2]?.trim() || ''
                } else if (dispositionLine?.includes('name="contenido"')) {
                  body.contenido = lines[lines.length - 2]?.trim() || ''
                }
              }
            }
          } catch (error) {
            console.error('Error parsing multipart data:', error)
            return json(res, 400, { error: 'Error procesando archivos' })
          }
        } else {
          // JSON normal
          body = await readJson(req).catch(() => ({}))
        }
        
        const titulo = safeString(body?.titulo || '').trim()
        const contenido = safeString(body?.contenido || body?.content || '').trim()
        
        if (!titulo) return json(res, 400, { error: 'Título es requerido' })
        
        const entry = {
          id: global.db.data.aportesCounter++,
          usuario: safeString(body?.usuario || 'Panel Admin'),
          grupo: body?.grupo || null,
          contenido: contenido || titulo,
          descripcion: safeString(body?.descripcion || ''),
          tipo: safeString(body?.tipo || 'otro'),
          fecha: new Date().toISOString(),
          estado: safeString(body?.estado || 'pendiente'),
          archivo: body?.archivo || null,
          // Campos adicionales para el panel
          titulo: titulo,
          fecha_creacion: new Date().toISOString(),
          fuente: 'panel'
        }
        
        store.push(entry)
        sseBroadcast('aportes', { type: 'aporteChanged' })
        
        // Emitir evento Socket.IO
        try {
          emitAporteCreated(panelDb ? mapAporteForPanel(entry, panelDb) : entry)
          emitNotification({
            type: 'success',
            title: 'Nuevo Aporte',
            message: `Aporte "${titulo}" creado exitosamente`
          })
        } catch {}
        
        return json(res, 200, panelDb ? mapAporteForPanel(entry, panelDb) : entry)
      }

      const aporteEstadoMatch = pathname.match(/^\/api\/aportes\/(\d+)\/estado$/)
      if (aporteEstadoMatch && (method === 'PATCH' || method === 'POST')) {
        const id = Number(aporteEstadoMatch[1])
        const body = await readJson(req).catch(() => ({}))
        const store = ensureAportesStore() || []
        const entry = store.find((a) => Number(a?.id) === id)
        if (!entry) return json(res, 404, { error: 'Aporte no encontrado' })
        if (typeof body?.estado === 'string') entry.estado = body.estado
        if (typeof body?.motivo_rechazo === 'string') entry.motivo_rechazo = body.motivo_rechazo
        entry.updated_at = new Date().toISOString()
        entry.fecha_procesado = new Date().toISOString()
        sseBroadcast('aportes', { type: 'aporteChanged' })
        
        // Emitir evento Socket.IO
        emitAporteUpdated(panelDb ? mapAporteForPanel(entry, panelDb) : entry)
        
        return json(res, 200, { success: true })
      }

      const aporteIdMatch = pathname.match(/^\/api\/aportes\/(\d+)$/)
      if (aporteIdMatch && method === 'GET') {
        const id = Number(aporteIdMatch[1])
        const store = ensureAportesStore() || []
        const entry = store.find((a) => Number(a?.id) === id)
        if (!entry) return json(res, 404, { error: 'Aporte no encontrado' })
        return json(res, 200, panelDb ? mapAporteForPanel(entry, panelDb) : entry)
      }
      if (aporteIdMatch && (method === 'PATCH' || method === 'PUT')) {
        const id = Number(aporteIdMatch[1])
        const body = await readJson(req).catch(() => ({}))
        const store = ensureAportesStore() || []
        const entry = store.find((a) => Number(a?.id) === id)
        if (!entry) return json(res, 404, { error: 'Aporte no encontrado' })
        if (typeof body?.contenido === 'string') entry.contenido = body.contenido
        if (typeof body?.descripcion === 'string') entry.descripcion = body.descripcion
        if (typeof body?.tipo === 'string') entry.tipo = body.tipo
        if (typeof body?.estado === 'string') entry.estado = body.estado
        entry.updated_at = new Date().toISOString()
        sseBroadcast('aportes', { type: 'aporteChanged' })
        return json(res, 200, { success: true })
      }
      if (aporteIdMatch && method === 'DELETE') {
        const id = Number(aporteIdMatch[1])
        const store = ensureAportesStore() || []
        const idx = store.findIndex((a) => Number(a?.id) === id)
        if (idx === -1) return json(res, 404, { error: 'Aporte no encontrado' })
        store.splice(idx, 1)
        sseBroadcast('aportes', { type: 'aporteChanged' })
        return json(res, 200, { success: true })
      }

      // ===== Pedidos =====
      if (pathname === '/api/pedidos/stats' && method === 'GET') {
        const list = Object.values(panelDb?.pedidos || {})
        const byEstado = new Map()
        const byTipo = new Map()
        const byPrioridad = new Map()
        const todayKey = new Date().toISOString().slice(0, 10)
        let pedidosHoy = 0

        for (const p of list) {
          const estado = safeString(p?.estado || 'pendiente')
          const tipo = safeString(p?.tipo || 'otro')
          const prioridad = safeString(p?.prioridad || 'media')
          byEstado.set(estado, (byEstado.get(estado) || 0) + 1)
          byTipo.set(tipo, (byTipo.get(tipo) || 0) + 1)
          byPrioridad.set(prioridad, (byPrioridad.get(prioridad) || 0) + 1)
          if (String(p?.fecha_creacion || '').slice(0, 10) === todayKey) pedidosHoy += 1
        }

        const pendientes = byEstado.get('pendiente') || 0
        const en_proceso = byEstado.get('en_proceso') || 0
        const completados = byEstado.get('completado') || 0
        const cancelados = byEstado.get('cancelado') || 0

        return json(res, 200, {
          total: list.length,
          totalPedidos: list.length,
          pendientes,
          en_proceso,
          completados,
          cancelados,
          pedidosHoy,
          pedidosPendientes: pendientes,
          pedidosEnProceso: en_proceso,
          pedidosCompletados: completados,
          pedidosCancelados: cancelados,
          por_tipo: [...byTipo.entries()].map(([tipo, count]) => ({ tipo, count })),
          por_prioridad: [...byPrioridad.entries()].map(([prioridad, count]) => ({ prioridad, count })),
        })
      }

      if (pathname === '/api/pedidos' && method === 'GET') {
        const list = Object.values(panelDb?.pedidos || {}).slice().sort((a, b) =>
          String(b?.fecha_creacion || '').localeCompare(String(a?.fecha_creacion || ''))
        )
        const wantsPagination = url.searchParams.has('page') || url.searchParams.has('limit')
        if (wantsPagination) {
          const { items, pagination } = paginateArray(list, {
            page: url.searchParams.get('page') || 1,
            limit: url.searchParams.get('limit') || 20,
          })
          return json(res, 200, { pedidos: items, pagination })
        }
        return json(res, 200, list)
      }

      if (pathname === '/api/pedidos' && method === 'POST') {
        const body = await readJson(req).catch(() => ({}))
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        panelDb.pedidos ||= {}
        const id = nextId(panelDb, 'pedidosCounter')
        const now = new Date().toISOString()
        const record = {
          id,
          titulo: safeString(body?.titulo || '').trim(),
          descripcion: safeString(body?.descripcion || ''),
          tipo: safeString(body?.tipo || 'otro'),
          estado: safeString(body?.estado || 'pendiente'),
          usuario: safeString(body?.usuario || ''),
          fecha_creacion: now,
          fecha_actualizacion: now,
          prioridad: safeString(body?.prioridad || 'media'),
          votos: Number(body?.votos || 0),
          grupo_nombre: safeString(body?.grupo_nombre || ''),
        }
        if (!panelDb.pedidos) panelDb.pedidos = {}
        panelDb.pedidos[id] = record
        
        // Emitir evento Socket.IO
        emitPedidoCreated(record)
        
        return json(res, 200, record)
      }

      const pedidoResolverMatch = pathname.match(/^\/api\/pedidos\/(\d+)\/resolver$/)
      if (pedidoResolverMatch && (method === 'PATCH' || method === 'POST')) {
        const id = Number(pedidoResolverMatch[1])
        const body = await readJson(req).catch(() => ({}))
        const pedido = panelDb?.pedidos?.[id]
        if (!pedido) return json(res, 404, { error: 'Pedido no encontrado' })
        pedido.estado = 'completado'
        pedido.aporte_id = body?.aporte_id ?? null
        pedido.fecha_actualizacion = new Date().toISOString()
        
        // Emitir evento Socket.IO
        emitPedidoUpdated(pedido)
        
        return json(res, 200, { success: true })
      }

      const pedidoIdMatch = pathname.match(/^\/api\/pedidos\/(\d+)$/)
      if (pedidoIdMatch && method === 'GET') {
        const id = Number(pedidoIdMatch[1])
        const pedido = panelDb?.pedidos?.[id]
        if (!pedido) return json(res, 404, { error: 'Pedido no encontrado' })
        return json(res, 200, pedido)
      }
      if (pedidoIdMatch && (method === 'PATCH' || method === 'PUT')) {
        const id = Number(pedidoIdMatch[1])
        const body = await readJson(req).catch(() => ({}))
        const pedido = panelDb?.pedidos?.[id]
        if (!pedido) return json(res, 404, { error: 'Pedido no encontrado' })
        if (typeof body?.titulo === 'string') pedido.titulo = body.titulo
        if (typeof body?.descripcion === 'string') pedido.descripcion = body.descripcion
        if (typeof body?.tipo === 'string') pedido.tipo = body.tipo
        if (typeof body?.estado === 'string') pedido.estado = body.estado
        if (typeof body?.prioridad === 'string') pedido.prioridad = body.prioridad
        pedido.fecha_actualizacion = new Date().toISOString()
        
        // Emitir evento Socket.IO
        emitPedidoUpdated(pedido)
        
        return json(res, 200, { success: true })
      }
      if (pedidoIdMatch && method === 'DELETE') {
        const id = Number(pedidoIdMatch[1])
        if (panelDb?.pedidos?.[id]) {
          if (!panelDb.pedidos) panelDb.pedidos = {}
          delete panelDb.pedidos[id]
        }
        return json(res, 200, { success: true })
      }

      // Votar pedido
      const pedidoVoteMatch = pathname.match(/^\/api\/pedidos\/(\d+)\/vote$/)
      if (pedidoVoteMatch && method === 'POST') {
        const id = Number(pedidoVoteMatch[1])
        const pedido = panelDb?.pedidos?.[id]
        if (!pedido) return json(res, 404, { error: 'Pedido no encontrado' })
        
        pedido.votos = (pedido.votos || 0) + 1
        pedido.fecha_actualizacion = new Date().toISOString()
        
        // Emitir evento Socket.IO
        emitPedidoUpdated(pedido)
        
        return json(res, 200, { success: true, votos: pedido.votos })
      }

      // Mejorar pedido con IA
      if (pathname === '/api/ai/enhance-pedido' && method === 'POST') {
        const body = await readJson(req).catch(() => ({}))
        const titulo = safeString(body?.titulo || '').trim()
        const descripcionActual = safeString(body?.descripcion || '').trim()
        const tipo = safeString(body?.tipo || 'otro')
        
        if (!titulo) return json(res, 400, { error: 'Título es requerido' })
        
        // Simulación de mejora con IA (en producción conectarías con OpenAI, etc.)
        let descripcionMejorada = descripcionActual
        let tipoDetectado = tipo
        
        // Detectar tipo basado en el título
        const tituloLower = titulo.toLowerCase()
        if (tituloLower.includes('manhwa') || tituloLower.includes('webtoon')) {
          tipoDetectado = 'manhwa'
        } else if (tituloLower.includes('manga')) {
          tipoDetectado = 'manga'
        } else if (tituloLower.includes('novela') || tituloLower.includes('novel')) {
          tipoDetectado = 'novela'
        } else if (tituloLower.includes('anime')) {
          tipoDetectado = 'anime'
        }
        
        // Generar descripción mejorada
        if (!descripcionActual || descripcionActual.length < 20) {
          const templates = {
            manhwa: `Solicitud de manhwa: "${titulo}". Se busca la serie completa en español, preferiblemente en formato digital de alta calidad. Incluir todos los capítulos disponibles hasta la fecha.`,
            manga: `Solicitud de manga: "${titulo}". Se requiere la serie completa en español, formato digital preferido. Incluir todos los volúmenes y capítulos disponibles.`,
            novela: `Solicitud de novela: "${titulo}". Se busca la obra completa en español, formato PDF o EPUB preferido. Incluir todos los volúmenes disponibles.`,
            anime: `Solicitud de anime: "${titulo}". Se requiere la serie completa en español (subtitulado o doblado), calidad HD preferida. Incluir todas las temporadas disponibles.`,
            otro: `Solicitud: "${titulo}". Se busca el contenido completo en español, formato digital de alta calidad. Incluir toda la información y archivos relacionados.`
          }
          
          descripcionMejorada = templates[tipoDetectado] || templates.otro
        }
        
        return json(res, 200, {
          success: true,
          descripcion: descripcionMejorada,
          tipo: tipoDetectado,
          message: 'Descripción mejorada con IA'
        })
      }

      // ===== Proveedores =====
      if (pathname === '/api/proveedores/stats' && method === 'GET') {
        const list = Object.values(panelDb?.proveedores || {})
        let activos = 0
        let inactivos = 0
        let suspendidos = 0
        const byTipo = new Map()
        for (const p of list) {
          const estado = safeString(p?.estado || 'activo')
          if (estado === 'activo') activos += 1
          else if (estado === 'inactivo') inactivos += 1
          else if (estado === 'suspendido') suspendidos += 1
          const tipo = safeString(p?.tipo || 'general')
          byTipo.set(tipo, (byTipo.get(tipo) || 0) + 1)
        }
        return json(res, 200, {
          total: list.length,
          activos,
          inactivos,
          suspendidos,
          por_tipo: [...byTipo.entries()].map(([tipo, count]) => ({ tipo, count })),
          top_proveedores: list
            .slice()
            .sort((a, b) => Number(b?.rating || 0) - Number(a?.rating || 0))
            .slice(0, 5)
            .map((p) => ({ nombre: p?.nombre || p?.jid || 'N/A', aportes: p?.total_aportes || 0, pedidos: p?.total_pedidos || 0 })),
        })
      }

      if (pathname === '/api/proveedores/me' && method === 'GET') {
        return json(res, 200, null)
      }

      if (pathname === '/api/proveedores' && method === 'GET') {
        const list = Object.values(panelDb?.proveedores || {}).slice()
        const wantsPagination = url.searchParams.has('page') || url.searchParams.has('limit')
        if (wantsPagination) {
          const { items, pagination } = paginateArray(list, {
            page: url.searchParams.get('page') || 1,
            limit: url.searchParams.get('limit') || 20,
          })
          return json(res, 200, { proveedores: items, pagination })
        }
        return json(res, 200, list)
      }

      if (pathname === '/api/proveedores' && method === 'POST') {
        const body = await readJson(req).catch(() => ({}))
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        panelDb.proveedores ||= {}
        const jid = safeString(body?.jid || body?.wa_jid).trim()
        if (!jid) return json(res, 400, { error: 'jid es requerido' })
        const now = new Date().toISOString()
        const existing = Object.values(panelDb.proveedores).find((p) => p?.jid === jid) || null
        const id = existing?.id || nextId(panelDb, 'proveedoresCounter')
        const record = {
          id,
          jid,
          nombre: safeString(body?.nombre || jid),
          descripcion: safeString(body?.descripcion || ''),
          tipo: safeString(body?.tipo || 'general'),
          estado: safeString(body?.estado || 'activo'),
          contacto: safeString(body?.contacto || ''),
          telefono: safeString(body?.telefono || ''),
          website: safeString(body?.website || ''),
          fecha_registro: existing?.fecha_registro || now,
          fecha_actualizacion: now,
          total_aportes: Number(existing?.total_aportes || 0),
          total_pedidos: Number(existing?.total_pedidos || 0),
          rating: Number(existing?.rating || 0),
          // Configuración de captura de media
          grupos_monitoreados: Array.isArray(body?.grupos_monitoreados) ? body.grupos_monitoreados : (existing?.grupos_monitoreados || []),
          generos_captura: Array.isArray(body?.generos_captura) ? body.generos_captura : (existing?.generos_captura || []),
          tipos_archivo: Array.isArray(body?.tipos_archivo) ? body.tipos_archivo : (existing?.tipos_archivo || ['PDF', 'EPUB']),
          auto_procesar_pedidos: typeof body?.auto_procesar_pedidos === 'boolean' ? body.auto_procesar_pedidos : (existing?.auto_procesar_pedidos || false),
        }
        panelDb.proveedores[jid] = record
        return json(res, 200, record)
      }

      const proveedorIdMatch = pathname.match(/^\/api\/proveedores\/([^/]+)$/)
      if (proveedorIdMatch && method === 'GET') {
        const idOrJid = decodeURIComponent(proveedorIdMatch[1])
        const byJid = panelDb?.proveedores?.[idOrJid] || null
        if (byJid) return json(res, 200, byJid)
        const asNum = Number(idOrJid)
        if (Number.isFinite(asNum)) {
          const found = Object.values(panelDb?.proveedores || {}).find((p) => Number(p?.id) === asNum) || null
          if (found) return json(res, 200, found)
        }
        return json(res, 404, { error: 'Proveedor no encontrado' })
      }
      if (proveedorIdMatch && (method === 'PATCH' || method === 'PUT')) {
        const idOrJid = decodeURIComponent(proveedorIdMatch[1])
        const body = await readJson(req).catch(() => ({}))
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        const record = panelDb.proveedores?.[idOrJid] || Object.values(panelDb.proveedores || {}).find((p) => String(p?.id) === idOrJid) || null
        if (!record) return json(res, 404, { error: 'Proveedor no encontrado' })
        
        // Campos básicos
        if (typeof body?.estado === 'string') record.estado = body.estado
        if (typeof body?.nombre === 'string') record.nombre = body.nombre
        if (typeof body?.descripcion === 'string') record.descripcion = body.descripcion
        
        // Configuración de captura de media
        if (Array.isArray(body?.grupos_monitoreados)) record.grupos_monitoreados = body.grupos_monitoreados
        if (Array.isArray(body?.generos_captura)) record.generos_captura = body.generos_captura
        if (Array.isArray(body?.tipos_archivo)) record.tipos_archivo = body.tipos_archivo
        if (typeof body?.auto_procesar_pedidos === 'boolean') record.auto_procesar_pedidos = body.auto_procesar_pedidos
        
        record.fecha_actualizacion = new Date().toISOString()
        panelDb.proveedores[record.jid] = record
        
        // Emitir notificación de actualización
        try {
          emitNotification({
            type: 'success',
            title: 'Proveedor Actualizado',
            message: `Configuración de ${record.nombre} actualizada`
          })
        } catch {}
        
        return json(res, 200, { success: true, proveedor: record })
      }
      if (proveedorIdMatch && method === 'DELETE') {
        const idOrJid = decodeURIComponent(proveedorIdMatch[1])
        if (panelDb?.proveedores?.[idOrJid]) {
          delete panelDb.proveedores[idOrJid]
          return json(res, 200, { success: true })
        }
        const found = Object.values(panelDb?.proveedores || {}).find((p) => String(p?.id) === idOrJid) || null
        if (found?.jid && panelDb?.proveedores?.[found.jid]) delete panelDb.proveedores[found.jid]
        return json(res, 200, { success: true })
      }

      // ===== Usuarios (compat /api/users) =====
      if (pathname === '/api/users' && method === 'GET') {
        const users = Object.values(panelDb?.users || {}).map((u) => ({
          id: Number(u?.id || 0),
          username: safeString(u?.username || ''),
          email: safeString(u?.email || ''),
          whatsapp_number: safeString(u?.whatsapp_number || ''),
          rol: safeString(u?.rol || 'usuario'),
          fecha_registro: u?.fecha_registro || new Date().toISOString(),
          activo: u?.activo !== false,
        }))
        return json(res, 200, users)
      }
      const userRoleMatch = pathname.match(/^\/api\/users\/(\d+)\/role$/)
      if (userRoleMatch && (method === 'PUT' || method === 'PATCH')) {
        const id = Number(userRoleMatch[1])
        const body = await readJson(req).catch(() => ({}))
        const rol = safeString(body?.rol || body?.role || 'usuario')
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        if (!panelDb.users?.[id]) return json(res, 404, { error: 'Usuario no encontrado' })
        panelDb.users[id].rol = rol
        return json(res, 200, { success: true })
      }

      // Usuarios CRUD (/api/usuarios)
      if (pathname === '/api/usuarios/stats' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })

        // Stats para Analytics (actividad WhatsApp) + compat para gestiรณ de usuarios del panel
        const now = new Date()
        const todayKey = now.toISOString().slice(0, 10)
        const yesterdayKey = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

        const whatsappUsers = global.db?.data?.users || {}
        const totalUsersReal = Object.keys(whatsappUsers).filter((jid) => String(jid).includes('@s.whatsapp.net')).length

        const panel = global.db?.data?.panel || {}
        const logs = Array.isArray(panel.logs) ? panel.logs : []
        const logsToday = logs.filter((l) => String(l?.fecha || '').slice(0, 10) === todayKey)
        const logsYesterday = logs.filter((l) => String(l?.fecha || '').slice(0, 10) === yesterdayKey)

        const activeTodayReal = new Set(logsToday.map((l) => l?.usuario).filter(Boolean)).size
        const activeYesterdayReal = new Set(logsYesterday.map((l) => l?.usuario).filter(Boolean)).size

        const hourlyActivityReal = []
        for (let i = 23; i >= 0; i--) {
          const hour = new Date(now.getTime() - i * 60 * 60 * 1000)
          const hourStart = new Date(hour)
          hourStart.setMinutes(0, 0, 0)
          const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000)
          const users = new Set()
          for (const l of logs) {
            const t = new Date(l?.fecha || 0).getTime()
            if (!Number.isFinite(t) || t < hourStart.getTime() || t >= hourEnd.getTime()) continue
            if (l?.usuario) users.add(l.usuario)
          }
          hourlyActivityReal.push({
            name: hour.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            value: users.size,
            timestamp: hour.toISOString()
          })
        }

        const panelUsers = Object.values(panelDb?.users || {})
        const activos = panelUsers.filter((u) => u?.activo !== false).length
        const totalAdmins = panelUsers.filter((u) => ['admin', 'owner'].includes(safeString(u?.rol).toLowerCase())).length
        const totalCreadores = panelUsers.filter((u) => safeString(u?.rol).toLowerCase() === 'creador').length
        const totalModeradores = panelUsers.filter((u) => safeString(u?.rol).toLowerCase() === 'moderador').length
        const byRol = new Map()
        for (const u of panelUsers) {
          const rol = safeString(u?.rol || 'usuario')
          byRol.set(rol, (byRol.get(rol) || 0) + 1)
        }
        const usuariosPorRol = [...byRol.entries()].map(([rol, count]) => ({ rol, count }))

        return json(res, 200, {
          // Analytics (lo usa `frontend-next/src/app/(dashboard)/analytics/page.tsx`)
          total: totalUsersReal,
          activeToday: activeTodayReal,
          activeYesterday: activeYesterdayReal,
          hourlyActivity: hourlyActivityReal,

          // Panel users (compat/extra)
          totalUsuarios: panelUsers.length,
          usuariosActivos: activos,
          totalAdmins,
          totalCreadores,
          totalModeradores,
          usuariosPorRol,
          activos,
          inactivos: Math.max(0, panelUsers.length - activos),
          por_rol: usuariosPorRol,
        })
      }

      if (pathname === '/api/usuarios' && method === 'GET') {
        const auth = await getJwtAuth(req)
        if (!auth.ok) return json(res, auth.status, { error: auth.error })
        if (roleLevelJwt(auth.user?.rol) < 3) return json(res, 403, { error: 'Permisos insuficientes' })

        const list = Object.values(auth.usuarios || {})
        const search = safeString(url.searchParams.get('search')).toLowerCase()
        const rolFilter = safeString(url.searchParams.get('rol')).toLowerCase()
        const filtered = list.filter((u) => {
          if (search) {
            const hay = `${u?.username || ''} ${u?.whatsapp_number || ''}`.toLowerCase()
            if (!hay.includes(search)) return false
          }
          if (rolFilter && rolFilter !== 'all' && safeString(u?.rol).toLowerCase() !== rolFilter) return false
          return true
        })
        const mapped = filtered.map(sanitizeJwtUsuario)
        const wantsPagination = url.searchParams.has('page') || url.searchParams.has('limit')
        if (wantsPagination) {
          const { items, pagination } = paginateArray(mapped, {
            page: url.searchParams.get('page') || 1,
            limit: url.searchParams.get('limit') || 20,
          })
          return json(res, 200, { usuarios: items, pagination })
        }
        return json(res, 200, mapped)
      }

      if (pathname === '/api/usuarios' && method === 'POST') {
        const auth = await getJwtAuth(req)
        if (!auth.ok) return json(res, auth.status, { error: auth.error })
        if (roleLevelJwt(auth.user?.rol) < 3) return json(res, 403, { error: 'Permisos insuficientes' })
        
        const body = await readJson(req).catch(() => ({}))

        const username = safeString(body?.username || '').trim()
        const password = safeString(body?.password || '').trim()
        const rol = safeString(body?.rol || '').toLowerCase()
        const whatsapp_number = safeString(body?.whatsapp_number || '').trim()
        
        // Validaciones mejoradas
        if (!username) {
          return json(res, 400, { error: 'El nombre de usuario es requerido' })
        }
        
        if (username.length < 3) {
          return json(res, 400, { error: 'El usuario debe tener al menos 3 caracteres' })
        }
        
        if (!password) {
          return json(res, 400, { error: 'La contraseña es requerida' })
        }
        
        if (password.length < 4) {
          return json(res, 400, { error: 'La contraseña debe tener al menos 4 caracteres' })
        }
        
        if (!rol) {
          return json(res, 400, { error: 'Debes seleccionar un rol para el usuario' })
        }
        
        // Validar rol
        const validRoles = ['owner', 'admin', 'moderador', 'usuario', 'creador']
        if (!validRoles.includes(rol)) {
          return json(res, 400, { error: 'Rol no válido' })
        }
        
        // Verificar permisos del usuario que crea
        const creatorUser = auth.user
        
        if (!creatorUser) {
          return json(res, 401, { error: 'Usuario no autenticado' })
        }
        
        // Verificar jerarquía de roles
        const creatorLevel = roleLevelJwt(creatorUser.rol)
        const newUserLevel = roleLevelJwt(rol)
        
        if (newUserLevel > creatorLevel) {
          return json(res, 403, { error: `No tienes permisos para crear usuarios con rol ${rol}` })
        }
        
        // Verificar que el usuario no exista
        const existingUser = Object.values(auth.usuarios || {}).find(u => u.username === username)
        if (existingUser) {
          return json(res, 400, { error: 'Ya existe un usuario con ese nombre' })
        }
        
        const bcrypt = (await import('bcryptjs')).default
        const bcryptRounds = clampInt(process.env.BCRYPT_ROUNDS, { min: 4, max: 15, fallback: 10 })
        const hashedPassword = await bcrypt.hash(password, bcryptRounds)

        const ids = Object.values(auth.usuarios || {}).map((u) => Number(u?.id)).filter((id) => Number.isFinite(id))
        const keys = Object.keys(auth.usuarios || {}).map((k) => Number.parseInt(k, 10)).filter((id) => Number.isFinite(id))
        const id = Math.max(0, ...ids, ...keys) + 1
        const now = new Date().toISOString()
        auth.usuarios ||= {}
        auth.usuarios[id] = {
          id,
          username,
          whatsapp_number: whatsapp_number || null,
          rol,
          password: hashedPassword,
          fecha_registro: now,
          created_at: now,
          updated_at: now,
          activo: body?.activo !== false,
          require_password_change: false,
          temp_password: null,
          temp_password_expires: null,
          temp_password_used: null,
          created_by: creatorUser.username,
          created_by_ip: getClientIP(req)
        }
        
        console.log(`✅ Usuario creado: ${username} como ${rol} por ${creatorUser.username}`)
        
        // No devolver la contraseña en la respuesta
        if (global.db?.write) await global.db.write()
        return json(res, 200, sanitizeJwtUsuario(auth.usuarios[id]))
      }

      const usuarioIdMatch = pathname.match(/^\/api\/usuarios\/(\d+)$/)
      if (usuarioIdMatch && method === 'GET') {
        const auth = await getJwtAuth(req)
        if (!auth.ok) return json(res, auth.status, { error: auth.error })
        if (roleLevelJwt(auth.user?.rol) < 3) return json(res, 403, { error: 'Permisos insuficientes' })

        const id = Number(usuarioIdMatch[1])
        
        // Buscar usuario por ID en las claves del objeto
        let user = auth.usuarios?.[id]
        
        // Si no se encuentra por clave, buscar por propiedad id
        if (!user) {
          user = Object.values(auth.usuarios || {}).find(u => Number(u?.id) === id)
        }
        
        if (!user) return json(res, 404, { error: 'Usuario no encontrado' })
        return json(res, 200, sanitizeJwtUsuario(user))
      }
      if (usuarioIdMatch && (method === 'PATCH' || method === 'PUT')) {
        const auth = await getJwtAuth(req)
        if (!auth.ok) return json(res, auth.status, { error: auth.error })
        if (roleLevelJwt(auth.user?.rol) < 3) return json(res, 403, { error: 'Permisos insuficientes' })

        const id = Number(usuarioIdMatch[1])
        const body = await readJson(req).catch(() => ({}))
        
        // Buscar usuario por ID en las claves del objeto
        let user = auth.usuarios?.[id]
        let userKey = id
        
        // Si no se encuentra por clave, buscar por propiedad id
        if (!user) {
          const foundEntry = Object.entries(auth.usuarios || {}).find(([key, u]) => Number(u?.id) === id)
          if (foundEntry) {
            userKey = foundEntry[0]
            user = foundEntry[1]
          }
        }
        
        if (!user) return json(res, 404, { error: 'Usuario no encontrado' })
        
        // No permitir cambiar el password directamente aquí
        const { password, ...updateData } = body
        Object.assign(auth.usuarios[userKey], updateData || {})
        auth.usuarios[userKey].updated_at = new Date().toISOString()
        if (global.db?.write) await global.db.write()
        
        // No devolver la contraseña en la respuesta
        return json(res, 200, sanitizeJwtUsuario(auth.usuarios[userKey]))
      }
	      if (usuarioIdMatch && method === 'DELETE') {
	        const auth = await getJwtAuth(req)
	        if (!auth.ok) return json(res, auth.status, { error: auth.error })
	        if (roleLevelJwt(auth.user?.rol) < 3) return json(res, 403, { error: 'Permisos insuficientes' })

        const id = Number(usuarioIdMatch[1])
        
        // Buscar usuario por ID en las claves del objeto
        let userKey = id
        let user = auth.usuarios?.[id]
        
        // Si no se encuentra por clave, buscar por propiedad id
        if (!user) {
          const foundEntry = Object.entries(auth.usuarios || {}).find(([key, u]) => Number(u?.id) === id)
          if (foundEntry) {
            userKey = foundEntry[0]
            user = foundEntry[1]
          }
        }
        
        if (!user) return json(res, 404, { error: 'Usuario no encontrado' })
        if (Number(auth.user?.id) === id) return json(res, 400, { error: 'No puedes eliminar tu propio usuario' })
        if (safeString(user.rol).toLowerCase() === 'owner' && safeString(auth.user?.rol).toLowerCase() !== 'owner') {
          return json(res, 403, { error: 'No puedes eliminar un owner' })
        }

	        if (user && auth.usuarios[userKey]) {
	          delete auth.usuarios[userKey]
	          // Persistir borrado en PostgreSQL si está disponible (evita que reaparezca al reiniciar/recargar)
	          try {
	            if (global.db?.pool?.query) {
	              await global.db.pool.query('DELETE FROM usuarios WHERE id = $1', [id])
	            }
	          } catch {}
	          if (global.db?.write) await global.db.write()
	        }
	        
	        return json(res, 200, { success: true })
	      }

      // Cambiar contraseña de usuario específico
      const usuarioPasswordMatch = pathname.match(/^\/api\/usuarios\/(\d+)\/password$/)
      if (usuarioPasswordMatch && method === 'POST') {
        const auth = await getJwtAuth(req)
        if (!auth.ok) return json(res, auth.status, { error: auth.error })
        if (roleLevelJwt(auth.user?.rol) < 3) return json(res, 403, { error: 'Permisos insuficientes' })
        
        const id = Number(usuarioPasswordMatch[1])
        const body = await readJson(req).catch(() => ({}))
        
        // Buscar usuario por ID en las claves del objeto
        let user = auth.usuarios?.[id]
        let userKey = id
        
        // Si no se encuentra por clave, buscar por propiedad id
        if (!user) {
          const foundEntry = Object.entries(auth.usuarios || {}).find(([key, u]) => Number(u?.id) === id)
          if (foundEntry) {
            userKey = foundEntry[0]
            user = foundEntry[1]
          }
        }
        
        if (!user) {
          return json(res, 404, { error: 'Usuario no encontrado' })
        }
        
        if (safeString(user.rol).toLowerCase() === 'owner' && safeString(auth.user?.rol).toLowerCase() !== 'owner') {
          return json(res, 403, { error: 'No puedes cambiar la contraseña de un owner' })
        }

        const newPassword = safeString(body?.newPassword || '').trim()
        if (!newPassword) return json(res, 400, { error: 'Nueva contraseña es requerida' })
        if (newPassword.length < 4) return json(res, 400, { error: 'La contraseña debe tener al menos 4 caracteres' })
        
        // Actualizar la contraseña
        const bcrypt = (await import('bcryptjs')).default
        const bcryptRounds = clampInt(process.env.BCRYPT_ROUNDS, { min: 4, max: 15, fallback: 10 })
        auth.usuarios[userKey].password = await bcrypt.hash(newPassword, bcryptRounds)
        auth.usuarios[userKey].password_changed_at = new Date().toISOString()
        auth.usuarios[userKey].temp_password = null
        auth.usuarios[userKey].temp_password_expires = null
        auth.usuarios[userKey].temp_password_used = null
        auth.usuarios[userKey].require_password_change = false
        auth.usuarios[userKey].updated_at = new Date().toISOString()
        if (global.db?.write) await global.db.write()
        
        // Emitir notificación
        try {
          emitNotification({
            type: 'success',
            title: 'Contraseña Actualizada',
            message: `Contraseña de ${user.username} actualizada exitosamente`
          })
        } catch {}
        
        return json(res, 200, { success: true, message: 'Contraseña actualizada exitosamente' })
      }

      // Ver contraseña de usuario (solo para owners)
	      const usuarioViewPasswordMatch = pathname.match(/^\/api\/usuarios\/(\d+)\/view-password$/)
	      if (usuarioViewPasswordMatch && method === 'GET') {
	        const auth = await getJwtAuth(req)
	        if (!auth.ok) return json(res, auth.status, { error: auth.error })
	        if (roleLevelJwt(auth.user?.rol) < 4) return json(res, 403, { error: 'Solo los owners pueden ver contraseñas' })
	        
	        const id = Number(usuarioViewPasswordMatch[1])
	        const doReset = ['1', 'true', 'yes'].includes(safeString(url.searchParams.get('reset')).toLowerCase())
	        
	        // Buscar usuario por ID en las claves del objeto
	        let user = auth.usuarios?.[id]
        
        // Si no se encuentra por clave, buscar por propiedad id
        if (!user) {
          user = Object.values(auth.usuarios || {}).find(u => Number(u?.id) === id)
          console.log('User found by property search:', !!user);
        }
        
	        if (!user) {
	          console.log('User not found:', id);
	          console.log('Available user IDs:', Object.values(auth.usuarios || {}).map(u => u?.id));
	          return json(res, 404, { error: 'Usuario no encontrado' })
	        }

	        // No es posible "ver" una contraseña ya guardada (solo tenemos el hash).
	        // Este endpoint puede opcionalmente restablecer/generar una temporal cuando reset=1.
	        if (!doReset) {
	          return json(res, 200, {
	            username: user.username,
	            password: null,
	            hasPassword: !!user.password,
	            isDefault: false,
	            canReset: true,
	            message: 'No se puede ver la contraseña actual. Usa reset=1 para generar una contraseña temporal o cambia la contraseña desde el panel.',
	          })
	        }

	        const tempPassword = `temp${Math.random().toString(36).slice(2, 8)}`
	        const bcrypt = (await import('bcryptjs')).default
	        const bcryptRounds = clampInt(process.env.BCRYPT_ROUNDS, { min: 4, max: 15, fallback: 10 })
	        user.password = await bcrypt.hash(tempPassword, bcryptRounds)
	        user.temp_password = tempPassword
	        user.temp_password_expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
	        user.temp_password_used = false
	        user.require_password_change = true
	        user.updated_at = new Date().toISOString()
	        if (global.db?.write) await global.db.write()
	        return json(res, 200, { username: user.username, password: tempPassword, hasPassword: true, isDefault: false, reset: true })
	      }

      const usuarioEstadoMatch = pathname.match(/^\/api\/usuarios\/(\d+)\/estado$/)
      if (usuarioEstadoMatch && (method === 'PATCH' || method === 'POST')) {
        const auth = await getJwtAuth(req)
        if (!auth.ok) return json(res, auth.status, { error: auth.error })
        if (roleLevelJwt(auth.user?.rol) < 3) return json(res, 403, { error: 'Permisos insuficientes' })

        const id = Number(usuarioEstadoMatch[1])
        const body = await readJson(req).catch(() => ({}))
        const user = auth.usuarios?.[id] || Object.values(auth.usuarios || {}).find(u => Number(u?.id) === id)
        if (!user) return json(res, 404, { error: 'Usuario no encontrado' })
        const estado = safeString(body?.estado || '').toLowerCase()
        user.activo = estado !== 'inactivo' && estado !== 'false' && estado !== '0'
        user.updated_at = new Date().toISOString()
        if (global.db?.write) await global.db.write()
        return json(res, 200, { success: true })
      }

      // Banear/desbanear usuario (afecta al bot)
      const usuarioBanMatch = pathname.match(/^\/api\/usuarios\/([^/]+)\/ban$/)
      if (usuarioBanMatch && method === 'POST') {
        const userParam = decodeURIComponent(usuarioBanMatch[1])
        const body = await readJson(req).catch(() => ({}))
        const banned = body?.banned !== false
        const reason = safeString(body?.reason || '')
        
        // Determinar el JID del usuario
        let jid = userParam
        if (!jid.includes('@')) {
          jid = `${jid.replace(/[^0-9]/g, '')}@s.whatsapp.net`
        }
        
        // Aplicar ban en la base de datos del bot
        if (!global.db?.data?.users) global.db.data.users = {}
        if (!global.db?.data) return json(res, 500, { error: 'DB no disponible' })
        if (!global.db.data.users) global.db.data.users = {}
        global.db.data.users[jid] = global.db.data.users[jid] || {}
        global.db.data.users[jid].banned = banned
        global.db.data.users[jid].bannedReason = reason
        global.db.data.users[jid].bannedAt = banned ? new Date().toISOString() : null
        
        // Emitir notificación
        emitNotification({
          type: banned ? 'warning' : 'success',
          title: banned ? 'Usuario Baneado' : 'Usuario Desbaneado',
          message: `Usuario ${jid.split('@')[0]} ${banned ? 'baneado' : 'desbaneado'}${reason ? `: ${reason}` : ''}`
        })
        
        return json(res, 200, { success: true, jid, banned, reason })
      }

      // Establecer usuario premium (afecta al bot)
      const usuarioPremiumMatch = pathname.match(/^\/api\/usuarios\/([^/]+)\/premium$/)
      if (usuarioPremiumMatch && method === 'POST') {
        const userParam = decodeURIComponent(usuarioPremiumMatch[1])
        const body = await readJson(req).catch(() => ({}))
        const premium = body?.premium !== false
        const days = Number(body?.days || body?.duration || 30) || 30
        
        // Determinar el JID del usuario
        let jid = userParam
        if (!jid.includes('@')) {
          jid = `${jid.replace(/[^0-9]/g, '')}@s.whatsapp.net`
        }
        
        // Aplicar premium en la base de datos del bot
        if (!global.db?.data?.users) global.db.data.users = {}
        if (!global.db?.data) return json(res, 500, { error: 'DB no disponible' })
        if (!global.db.data.users) global.db.data.users = {}
        global.db.data.users[jid] = global.db.data.users[jid] || {}
        global.db.data.users[jid].premium = premium
        if (premium) {
          global.db.data.users[jid].premiumTime = Date.now() + (days * 24 * 60 * 60 * 1000)
        } else {
          global.db.data.users[jid].premiumTime = 0
        }
        
        // Emitir notificación
        emitNotification({
          type: 'success',
          title: premium ? 'Premium Activado' : 'Premium Desactivado',
          message: `Usuario ${jid.split('@')[0]} ${premium ? `ahora es premium por ${days} días` : 'ya no es premium'}`
        })
        
        return json(res, 200, { 
          success: true, 
          jid, 
          premium, 
          premiumTime: global.db.data.users[jid].premiumTime,
          expiresAt: premium ? new Date(global.db.data.users[jid].premiumTime).toISOString() : null
        })
      }

      // Obtener info de usuario del bot
      const usuarioInfoMatch = pathname.match(/^\/api\/usuarios\/([^/]+)\/bot-info$/)
      if (usuarioInfoMatch && method === 'GET') {
        const userParam = decodeURIComponent(usuarioInfoMatch[1])
        let jid = userParam
        if (!jid.includes('@')) {
          jid = `${jid.replace(/[^0-9]/g, '')}@s.whatsapp.net`
        }
        
        const user = global.db?.data?.users?.[jid] || {}
        return json(res, 200, {
          jid,
          phone: jid.split('@')[0],
          banned: user.banned || false,
          bannedReason: user.bannedReason || null,
          premium: user.premium || false,
          premiumTime: user.premiumTime || 0,
          premiumExpired: user.premiumTime ? user.premiumTime < Date.now() : true,
          exp: user.exp || 0,
          limit: user.limit || 0,
          money: user.money || 0,
          registered: user.registered || false,
          name: user.name || null,
        })
      }

      // ===== Logs =====
      if (pathname === '/api/logs/stats' && method === 'GET') {
        const logs = Array.isArray(panelDb?.logs) ? panelDb.logs : []
        const todayKey = new Date().toISOString().slice(0, 10)
        const logsToday = logs.filter((l) => String(l?.fecha || '').slice(0, 10) === todayKey).length
        const topCommands = new Map()
        const topUsers = new Map()
        for (const l of logs) {
          if (l?.tipo === 'comando') {
            const cmd = safeString(l?.comando || '')
            if (cmd) topCommands.set(cmd, (topCommands.get(cmd) || 0) + 1)
          }
          const u = safeString(l?.usuario || '')
          if (u) topUsers.set(u, (topUsers.get(u) || 0) + 1)
        }
        const levels = { error: 0, warn: 0, info: 0, debug: 0, trace: 0 }
        let lastLogTime = null
        for (const l of logs) {
          const raw = safeString(l?.nivel || l?.level || '').toLowerCase()
          const level =
            raw === 'error' || raw === 'warn' || raw === 'info' || raw === 'debug' || raw === 'trace'
              ? raw
              : 'info'
          levels[level]++

          const t = new Date(l?.fecha || l?.timestamp || 0).getTime()
          if (Number.isFinite(t) && t > 0) {
            if (!lastLogTime || t > new Date(lastLogTime).getTime()) lastLogTime = new Date(t).toISOString()
          }
        }

        const computeDirSize = (dir) => {
          try {
            if (!fs.existsSync(dir)) return { totalSize: 0, fileCount: 0 }
            let totalSize = 0
            let fileCount = 0
            const walk = (d) => {
              const entries = fs.readdirSync(d, { withFileTypes: true })
              for (const e of entries) {
                const p = path.join(d, e.name)
                if (e.isDirectory()) walk(p)
                else {
                  const st = fs.statSync(p)
                  totalSize += st.size
                  fileCount++
                }
              }
            }
            walk(dir)
            return { totalSize, fileCount }
          } catch {
            return { totalSize: 0, fileCount: 0 }
          }
        }
        const humanBytes = (bytes) => {
          const n = Number(bytes) || 0
          if (n <= 0) return '0 B'
          const units = ['B', 'KB', 'MB', 'GB', 'TB']
          const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
          return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`
        }
        const { totalSize, fileCount } = computeDirSize(path.join(process.cwd(), 'logs'))

        return json(res, 200, {
          totalLogs: logs.length,
          logsToday,
          errorCount: levels.error,
          warnCount: levels.warn,
          infoCount: levels.info,
          debugCount: levels.debug,
          traceCount: levels.trace,
          filesCreated: 0,
          filesRotated: 0,
          filesCompressed: 0,
          lastLogTime,
          uptime: Math.round(process.uptime() * 1000),
          bufferSize: logs.length,
          activeStreams: 0,
          diskUsage: {
            totalSize,
            fileCount,
            formattedSize: humanBytes(totalSize),
          },
          topCommands: [...topCommands.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([comando, count]) => ({ comando, count })),
          topUsers: [...topUsers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([usuario, count]) => ({ usuario, count })),
        })
      }

      if (pathname === '/api/logs' && method === 'GET') {
        const logs = Array.isArray(panelDb?.logs) ? panelDb.logs : []
        const tipo = safeString(url.searchParams.get('tipo') || url.searchParams.get('category')).toLowerCase()
        const nivel = safeString(url.searchParams.get('level')).toLowerCase()
        const usuario = safeString(url.searchParams.get('usuario')).toLowerCase()
        const grupo = safeString(url.searchParams.get('grupo')).toLowerCase()
        const query = safeString(url.searchParams.get('query')).toLowerCase()
        const startDate = safeString(url.searchParams.get('startDate'))
        const endDate = safeString(url.searchParams.get('endDate'))
        const startTs = startDate ? new Date(startDate).getTime() : null
        const endTs = endDate ? new Date(endDate).getTime() : null
        
        // Normalizar logs para asegurar que tengan la propiedad 'nivel'
        const normalizedLogs = logs.map(log => ({
          ...log,
          nivel: log.nivel || (log.tipo === 'comando' ? 'info' : 'info'),
          mensaje: log.mensaje || log.detalles || log.comando || 'Sin mensaje'
        }))
        
        const filtered = normalizedLogs.filter((l) => {
          if (tipo && safeString(l?.tipo).toLowerCase() !== tipo) return false
          if (nivel && safeString(l?.nivel).toLowerCase() !== nivel) return false
          if (usuario && !safeString(l?.usuario).toLowerCase().includes(usuario)) return false
          if (grupo && !safeString(l?.grupo).toLowerCase().includes(grupo)) return false
          if (query) {
            const hay =
              safeString(l?.mensaje).toLowerCase().includes(query) ||
              safeString(l?.detalles).toLowerCase().includes(query) ||
              safeString(l?.comando).toLowerCase().includes(query) ||
              safeString(l?.usuario).toLowerCase().includes(query) ||
              safeString(l?.grupo).toLowerCase().includes(query) ||
              safeString(l?.metadata?.plugin).toLowerCase().includes(query) ||
              safeString(l?.metadata?.command).toLowerCase().includes(query)
            if (!hay) return false
          }
          if (startTs && Number.isFinite(startTs)) {
            const t = new Date(l?.fecha || l?.timestamp || 0).getTime()
            if (!Number.isFinite(t) || t < startTs) return false
          }
          if (endTs && Number.isFinite(endTs)) {
            const t = new Date(l?.fecha || l?.timestamp || 0).getTime()
            if (!Number.isFinite(t) || t > endTs) return false
          }
          return true
        })
        const { items, pagination } = paginateArray(filtered.slice().reverse(), {
          page: url.searchParams.get('page') || 1,
          limit: url.searchParams.get('limit') || 50,
        })
        return json(res, 200, { logs: items, pagination: { ...pagination, pages: pagination.totalPages } })
      }

      if (pathname === '/api/logs' && method === 'DELETE') {
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        const deletedCount = panelDb.logs?.length || 0
        panelDb.logs = []
        panelDb.logsCounter = 0
        
        // Emitir evento Socket.IO
        try {
          const { getIO } = await import('./socket-io.js')
          const io = getIO()
          if (io) {
            io.emit('logs:cleared', { deletedCount, timestamp: new Date().toISOString() })
            io.emit('stats:updated', { logsCleared: true })
            io.emit('stats:update', { logsCleared: true })
          }
        } catch {}
        
        return json(res, 200, { success: true })
      }

      if (pathname === '/api/logs/export' && method === 'GET') {
        const logs = Array.isArray(panelDb?.logs) ? panelDb.logs : []
        
        // Normalizar logs para asegurar que tengan la propiedad 'nivel'
        const normalizedLogs = logs.map(log => ({
          ...log,
          nivel: log.nivel || (log.tipo === 'comando' ? 'info' : 'info'),
          mensaje: log.mensaje || log.detalles || log.comando || 'Sin mensaje'
        }))
        
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Content-Disposition', 'attachment; filename=\"logs.json\"')
        res.end(JSON.stringify(normalizedLogs, null, 2))
        return
      }

      // ===== Real-time & Advanced Features =====
      
      // Bulk operations
      if (pathname === '/api/grupos/bulk-update' && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const body = await readJson(req).catch(() => ({}))
        const updates = Array.isArray(body?.updates) ? body.updates : []
        
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        
        let updatedCount = 0
        for (const update of updates) {
          const { jid, enabled } = update
          if (jid && panelDb.groups[jid]) {
            const chat = ensureChatRecord(jid)
            if (chat) {
              chat.isBanned = !enabled
              updatedCount++
            }
          }
        }
        
        return json(res, 200, { success: true, updated: updatedCount })
      }

      if (pathname === '/api/notificaciones/bulk-delete' && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const body = await readJson(req).catch(() => ({}))
        const ids = Array.isArray(body?.ids) ? body.ids : []
        
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        
        let deletedCount = 0
        for (const id of ids) {
          if (panelDb?.notifications?.[id]) {
            if (!panelDb.notifications) panelDb.notifications = {}
            delete panelDb.notifications[id]
            deletedCount++
          }
        }
        
        return json(res, 200, { success: true, deleted: deletedCount })
      }

      // Real-time stats
      if (pathname === '/api/stats/realtime' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const now = new Date().toISOString()
        const todayKey = now.slice(0, 10)
        
        const logs = panelDb?.logs || []
        const groups = panelDb ? Object.values(panelDb.groups || {}) : []
        const users = global.db?.data?.users ? Object.keys(global.db.data.users) : []
        
        const realtimeStats = {
          timestamp: now,
          bot: {
            connected: global.stopped === 'open',
            globallyOn: panelDb?.botGlobalState?.isOn !== false,
            uptime: formatUptime(process.uptime())
          },
          activity: {
            messagesLast5Min: logs.filter(l => 
              l?.tipo === 'mensaje' && 
              new Date(l?.fecha || 0).getTime() > Date.now() - 5 * 60 * 1000
            ).length,
            commandsLast5Min: logs.filter(l => 
              l?.tipo === 'comando' && 
              new Date(l?.fecha || 0).getTime() > Date.now() - 5 * 60 * 1000
            ).length,
            activeUsers: new Set(
              logs.filter(l => 
                new Date(l?.fecha || 0).getTime() > Date.now() - 15 * 60 * 1000
              ).map(l => l?.usuario).filter(Boolean)
            ).size
          },
          counts: {
            totalGroups: groups.length,
            activeGroups: groups.filter(g => {
              const jid = g?.wa_jid || g?.jid
              const chat = jid ? global.db?.data?.chats?.[jid] : null
              return jid && chat ? !chat.isBanned : true
            }).length,
            totalUsers: users.length,
            subbots: panelDb ? Object.keys(panelDb.subbots || {}).length : 0
          }
        }
        
        return json(res, 200, realtimeStats)
      }

      // Activity feed
      if (pathname === '/api/activity/feed' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 100, fallback: 20 })
        const logs = panelDb?.logs || []
        
        const activities = logs
          .slice(-limit * 2) // Obtener más logs para filtrar
          .filter(log => log?.tipo && log?.fecha)
          .map(log => ({
	            id: log.id ?? `${log.tipo || 'evento'}_${log.fecha || ''}_${log.usuario || ''}_${log.comando || log.mensaje || ''}`,
            type: log.tipo,
            message: log.mensaje || log.detalles || 'Actividad del sistema',
            user: log.usuario || 'Sistema',
            timestamp: log.fecha,
            timeAgo: formatTimeAgo(log.fecha)
          }))
          .reverse()
          .slice(0, limit)
        
        return json(res, 200, { activities })
      }

      // System Health API - USANDO DATOS REALES
      if (pathname === '/api/system/health' && method === 'GET') {
        try {
          if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })

          const now = new Date().toISOString()
          const botConnected = Boolean(global.conn?.user) || global.stopped === 'open'

          const databaseConnected = Boolean(global.db?.pool || global.db?.data)
          let databaseHealthy = databaseConnected
          if (global.db?.pool?.query) {
            try {
              await Promise.race([
                global.db.pool.query('SELECT 1 as ok'),
                new Promise((_, reject) => setTimeout(() => reject(new Error('db_timeout')), 1000)),
              ])
            } catch {
              databaseHealthy = false
            }
          }

          const websocketAvailable = Boolean(global.io)
          const websocketClients = Number(global.io?.engine?.clientsCount || 0) || 0

          const taskSchedulerAvailable = Boolean(taskScheduler && typeof taskScheduler.getAllTasks === 'function')
          const taskSchedulerHealthy = taskSchedulerAvailable ? true : false

          const backupAvailable = Boolean(backupSystem && typeof backupSystem.createBackup === 'function')
          const backupHealthy = backupAvailable ? (backupSystem?.isRunning ?? true) : false

          const notificationsAvailable = Boolean(notificationSystem && typeof notificationSystem.send === 'function')
          const notificationsHealthy = notificationsAvailable ? (notificationSystem?.isRunning ?? true) : false

          const alertsAvailable = Boolean(alertSystem && typeof alertSystem.collectMetrics === 'function')
          const alertsHealthy = alertsAvailable ? (alertSystem?.isRunning ?? true) : false

          let resourceMonitorHealthy = true
          let resourceMonitorMonitoring = null
          try {
            const { default: resourceMonitor } = await import('./resource-monitor.js')
            resourceMonitorMonitoring = Boolean(resourceMonitor?.isMonitoring)
            resourceMonitorHealthy = true
          } catch {
            resourceMonitorHealthy = false
          }

          const systems = {
            metrics: true,
            alerts: alertsHealthy,
            reporting: true,
            resourceMonitor: resourceMonitorHealthy,
            logManager: true,
            backupSystem: backupHealthy,
            securityMonitor: true,
          }

          const dependencies = {
            bot: { connected: botConnected },
            database: { connected: databaseConnected, healthy: databaseHealthy },
            websocket: { available: websocketAvailable, clients: websocketClients },
            resourceMonitor: { healthy: resourceMonitorHealthy, monitoring: resourceMonitorMonitoring },
            taskScheduler: { available: taskSchedulerAvailable, healthy: taskSchedulerHealthy },
            notifications: { available: notificationsAvailable, healthy: notificationsHealthy },
            backups: { available: backupAvailable, healthy: backupHealthy },
          }

          const isRunning = Boolean(databaseHealthy) && Boolean(systems.metrics)
          const status = isRunning ? 'healthy' : 'degraded'

          return json(res, 200, {
            isRunning,
            status,
            timestamp: now,
            systems,
            dependencies,
          })
        } catch (error) {
          console.error('Error obteniendo salud del sistema:', error)
          return json(res, 500, { error: 'Error interno del servidor' })
        }
      }

      // System ping
      if (pathname === '/api/system/ping' && method === 'GET') {
        return json(res, 200, { 
          pong: true, 
          timestamp: new Date().toISOString(),
          uptime: process.uptime()
        })
      }

      // Cache management
      if (pathname === '/api/system/clear-cache' && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const body = await readJson(req).catch(() => ({}))
        const type = body?.type || 'all'
        
        let cleared = []
        
        if (type === 'all' || type === 'groups') {
          // Limpiar cache de grupos
          global.lastGroupsSync = 0
          global.groupsRateLimit = 0
          cleared.push('groups')
        }
        
        if (type === 'all' || type === 'stats') {
          // Forzar recálculo de estadísticas
          global.lastStatsUpdate = 0
          cleared.push('stats')
        }
        
        return json(res, 200, { success: true, cleared })
      }

      // WebSocket test
      if (pathname === '/api/websocket/test' && method === 'GET') {
        const socketStatus = {
          available: typeof global.io !== 'undefined',
          connected: global.io?.engine?.clientsCount || 0,
          timestamp: new Date().toISOString()
        }
        
        return json(res, 200, socketStatus)
      }

      // ==================== AUDIT LOGS API ====================
      
      // Obtener logs de auditoría
      if (pathname === '/api/audit/logs' && method === 'GET') {
        if (!canAccessResource(getUserRole(req, url, panelDb), [PERMISSIONS.AUDIT_VIEW])) {
          return json(res, 403, { error: 'Permisos insuficientes' })
        }

        const filters = {
          page: parseInt(url.searchParams.get('page') || '1'),
          limit: parseInt(url.searchParams.get('limit') || '50'),
          level: url.searchParams.get('level'),
          category: url.searchParams.get('category'),
          user: url.searchParams.get('user'),
          event: url.searchParams.get('event'),
          dateFrom: url.searchParams.get('dateFrom'),
          dateTo: url.searchParams.get('dateTo'),
          search: url.searchParams.get('search')
        }

        const result = await auditLogger.getLogs(filters)
        
        await logApiAccess('/api/audit/logs', getUserFromToken(getTokenFromRequest(req, url), panelDb), getClientIP(req), true, {
          method: 'GET',
          filters
        })

        return json(res, 200, result)
      }

      // Obtener estadísticas de auditoría
      if (pathname === '/api/audit/stats' && method === 'GET') {
        if (!canAccessResource(getUserRole(req, url, panelDb), [PERMISSIONS.AUDIT_VIEW])) {
          return json(res, 403, { error: 'Permisos insuficientes' })
        }

        const days = parseInt(url.searchParams.get('days') || '30')
        const stats = await auditLogger.getStats(days)
        
        return json(res, 200, stats)
      }

      // ==================== TASKS API ====================
      
      // Obtener todas las tareas
      if (pathname === '/api/tasks' && method === 'GET') {
        if (!canAccessResource(getUserRole(req, url, panelDb), [PERMISSIONS.SYSTEM_VIEW_CONFIG])) {
          return json(res, 403, { error: 'Permisos insuficientes' })
        }

        const tasks = taskScheduler.getAllTasks()
        return json(res, 200, { tasks })
      }

      // Crear nueva tarea
      if (pathname === '/api/tasks' && method === 'POST') {
        if (!canAccessResource(getUserRole(req, url, panelDb), [PERMISSIONS.SYSTEM_EDIT_CONFIG])) {
          return json(res, 403, { error: 'Permisos insuficientes' })
        }

        const body = await readJson(req).catch(() => ({}))
        
        try {
          const task = await taskScheduler.scheduleTask(body)
          
          await logSystemAction(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, getUserFromToken(getTokenFromRequest(req, url), panelDb), {
            action: 'task_created',
            taskId: task.id,
            taskName: task.name
          })

          return json(res, 201, { task })
        } catch (error) {
          return json(res, 400, { error: error.message })
        }
      }

      // ==================== BACKUP API ====================
      
      // Obtener lista de backups
      if (pathname === '/api/backups' && method === 'GET') {
        if (!canAccessResource(getUserRole(req, url, panelDb), [PERMISSIONS.SYSTEM_BACKUP])) {
          return json(res, 403, { error: 'Permisos insuficientes' })
        }

        const backups = await backupSystem.listBackups()
        const stats = await backupSystem.getBackupStats()
        
        return json(res, 200, { backups, stats })
      }

      // Crear backup
      if (pathname === '/api/backups' && method === 'POST') {
        if (!canAccessResource(getUserRole(req, url, panelDb), [PERMISSIONS.SYSTEM_BACKUP])) {
          return json(res, 403, { error: 'Permisos insuficientes' })
        }

        const body = await readJson(req).catch(() => ({}))
        const user = getUserFromToken(getTokenFromRequest(req, url), panelDb)
        
        try {
          const backup = await backupSystem.createBackup({
            ...body,
            creator: user?.username || 'api'
          })
          
          return json(res, 201, { backup })
        } catch (error) {
          return json(res, 400, { error: error.message })
        }
      }

      // ==================== AUDIT LOGS ENDPOINTS ====================
      
      // Obtener logs de auditoría
      if (pathname === '/api/audit/logs' && method === 'GET') {
        const auth = authenticateAndAuthorize(req, url, panelDb, [PERMISSIONS.AUDIT_VIEW])
        if (!auth.authorized) {
          return json(res, auth.status, { error: auth.error })
        }

        try {
          const filters = {
            page: parseInt(url.searchParams.get('page') || '1'),
            limit: parseInt(url.searchParams.get('limit') || '50'),
            level: url.searchParams.get('level'),
            category: url.searchParams.get('category'),
            user: url.searchParams.get('user'),
            event: url.searchParams.get('event'),
            dateFrom: url.searchParams.get('dateFrom'),
            dateTo: url.searchParams.get('dateTo'),
            search: url.searchParams.get('search')
          }

          const result = await auditLogger.getLogs(filters)
          
          // Log del acceso a audit logs
          await logApiAccess('/api/audit/logs', auth.user, getClientIP(req), true, {
            method: 'GET',
            filters
          })

          return json(res, 200, result)
        } catch (error) {
          console.error('Error getting audit logs:', error)
          return json(res, 500, { error: 'Error obteniendo logs de auditoría' })
        }
      }

      // Obtener estadísticas de auditoría
      if (pathname === '/api/audit/stats' && method === 'GET') {
        const auth = authenticateAndAuthorize(req, url, panelDb, [PERMISSIONS.AUDIT_VIEW])
        if (!auth.authorized) {
          return json(res, auth.status, { error: auth.error })
        }

        try {
          const days = parseInt(url.searchParams.get('days') || '30')
          const stats = await auditLogger.getStats(days)
          
          await logApiAccess('/api/audit/stats', auth.user, getClientIP(req), true, {
            method: 'GET',
            days
          })

          return json(res, 200, stats)
        } catch (error) {
          console.error('Error getting audit stats:', error)
          return json(res, 500, { error: 'Error obteniendo estadísticas de auditoría' })
        }
      }

      // ==================== TASK SCHEDULER ENDPOINTS ====================
      
      // Obtener todas las tareas
      if (pathname === '/api/tasks' && method === 'GET') {
        const auth = authenticateAndAuthorize(req, url, panelDb, [PERMISSIONS.SYSTEM_VIEW_CONFIG])
        if (!auth.authorized) {
          return json(res, auth.status, { error: auth.error })
        }

        try {
          const tasks = taskScheduler.getAllTasks()
          const runningTasks = taskScheduler.getRunningTasks()
          
          const enrichedTasks = tasks.map(task => ({
            ...task,
            isRunning: runningTasks.includes(task.id)
          }))

          await logApiAccess('/api/tasks', auth.user, getClientIP(req), true, {
            method: 'GET',
            tasksCount: tasks.length
          })

          return json(res, 200, { tasks: enrichedTasks })
        } catch (error) {
          console.error('Error getting tasks:', error)
          return json(res, 500, { error: 'Error obteniendo tareas' })
        }
      }

      // Crear nueva tarea
      if (pathname === '/api/tasks' && method === 'POST') {
        const auth = authenticateAndAuthorize(req, url, panelDb, [PERMISSIONS.SYSTEM_EDIT_CONFIG])
        if (!auth.authorized) {
          return json(res, auth.status, { error: auth.error })
        }

        try {
          const body = await readJson(req)
          const task = await taskScheduler.scheduleTask({
            ...body,
            creator: auth.user.username
          })

          await logSystemAction(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, auth.user, {
            action: 'task_created',
            taskId: task.id,
            taskName: task.name
          })

          await sendNotification({
            type: NOTIFICATION_TYPES.INFO,
            title: 'Tarea Creada',
            message: `Nueva tarea programada: ${task.name}`,
            category: NOTIFICATION_CATEGORIES.SYSTEM,
            data: { taskId: task.id, taskName: task.name }
          })

          return json(res, 201, { task })
        } catch (error) {
          console.error('Error creating task:', error)
          return json(res, 500, { error: error.message || 'Error creando tarea' })
        }
      }

      // Ejecutar tarea manualmente
      if (pathname.match(/^\/api\/tasks\/[^\/]+\/execute$/) && method === 'POST') {
        const auth = authenticateAndAuthorize(req, url, panelDb, [PERMISSIONS.SYSTEM_EDIT_CONFIG])
        if (!auth.authorized) {
          return json(res, auth.status, { error: auth.error })
        }

        try {
          const taskId = pathname.split('/')[3]
          const execution = await taskScheduler.executeTask(taskId, true)

          await logSystemAction(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, auth.user, {
            action: 'task_executed_manually',
            taskId,
            executionId: execution.id,
            duration: execution.duration
          })

          return json(res, 200, { execution })
        } catch (error) {
          console.error('Error executing task:', error)
          return json(res, 500, { error: error.message || 'Error ejecutando tarea' })
        }
      }

      if (pathname === '/api/tasks/executions' && method === 'GET') {
        const auth = authenticateAndAuthorize(req, url, panelDb, [PERMISSIONS.SYSTEM_VIEW_CONFIG])
        if (!auth.authorized) {
          return json(res, auth.status, { error: auth.error })
        }

        const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 1000, fallback: 100 })
        const executions = taskScheduler.getExecutions(limit)
        return json(res, 200, { executions })
      }

      if (pathname.match(/^\/api\/tasks\/[^\/]+$/) && method === 'PATCH') {
        const auth = authenticateAndAuthorize(req, url, panelDb, [PERMISSIONS.SYSTEM_EDIT_CONFIG])
        if (!auth.authorized) {
          return json(res, auth.status, { error: auth.error })
        }

        try {
          const taskId = pathname.split('/')[3]
          const body = await readJson(req).catch(() => ({}))
          const task = await taskScheduler.updateTask(taskId, body)
          return json(res, 200, { task })
        } catch (error) {
          return json(res, 400, { error: error.message })
        }
      }

      if (pathname.match(/^\/api\/tasks\/[^\/]+$/) && method === 'DELETE') {
        const auth = authenticateAndAuthorize(req, url, panelDb, [PERMISSIONS.SYSTEM_EDIT_CONFIG])
        if (!auth.authorized) {
          return json(res, auth.status, { error: auth.error })
        }

        try {
          const taskId = pathname.split('/')[3]
          const result = await taskScheduler.cancelTask(taskId)
          return json(res, 200, { success: true, result })
        } catch (error) {
          return json(res, 404, { error: error.message })
        }
      }

      // Mark notification as read
      if (pathname.match(/^\/api\/notificaciones\/(\d+)\/read$/) && method === 'PATCH') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const match = pathname.match(/^\/api\/notificaciones\/(\d+)\/read$/)
        const id = match ? parseInt(match[1]) : null
        
        if (!panelDb || !id) return json(res, 400, { error: 'ID inválido' })
        
        if (panelDb?.notifications?.[id]) {
          if (!panelDb.notifications) panelDb.notifications = {}
          panelDb.notifications[id].leida = true
          panelDb.notifications[id].fecha_lectura = new Date().toISOString()
          return json(res, 200, { success: true })
        }
        
        return json(res, 404, { error: 'Notificación no encontrada' })
      }

      // Mark all notifications as read
      if (pathname === '/api/notificaciones/mark-all-read' && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        
        const now = new Date().toISOString()
        let markedCount = 0
        
        if (!panelDb.notifications) panelDb.notifications = {}
        for (const id in panelDb.notifications) {
          const notification = panelDb.notifications[id]
          if (notification && !notification.leida) {
            notification.leida = true
            notification.fecha_lectura = now
            markedCount++
          }
        }
        
        return json(res, 200, { success: true, marked: markedCount })
      }

      // ===== Streams (SSE) =====
      if (pathname === '/api/notificaciones/stream' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) {
          res.statusCode = 401
          res.end('Unauthorized')
          return
        }
        sseInit(req, res, 'notificaciones')
        sseSend(res, { type: 'ready' })
        return
      }
      if (pathname === '/api/aportes/stream' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) {
          res.statusCode = 401
          res.end('Unauthorized')
          return
        }
        sseInit(req, res, 'aportes')
        sseSend(res, { type: 'ready' })
        return
      }

      // ===== Notificaciones =====
      if (pathname === '/api/notificaciones/categories' && method === 'GET') {
        const notifications = Object.values(panelDb?.notifications || {})
        const categories = [...new Set(notifications.map((n) => safeString(n?.category)).filter(Boolean))]
        return json(res, 200, { categories })
      }
      if (pathname === '/api/notificaciones/types' && method === 'GET') {
        const notifications = Object.values(panelDb?.notifications || {})
        const types = [...new Set(notifications.map((n) => safeString(n?.type)).filter(Boolean))]
        return json(res, 200, { types })
      }
      if (pathname === '/api/notificaciones/stats' && method === 'GET') {
        const notifications = Object.values(panelDb?.notifications || {})
        const total = notifications.length
        const no_leidas = notifications.filter((n) => !n?.read).length
        const leidas = total - no_leidas
        const categories = [...new Set(notifications.map((n) => safeString(n?.category)).filter(Boolean))]
        const types = [...new Set(notifications.map((n) => safeString(n?.type)).filter(Boolean))]
        return json(res, 200, {
          total,
          no_leidas,
          leidas,
          categories,
          types,
          totalCategories: categories.length,
          totalTypes: types.length,
        })
      }
      if (pathname === '/api/notificaciones' && method === 'GET') {
        const notifications = Object.values(panelDb?.notifications || {}).slice().sort((a, b) =>
          String(b?.created_at || '').localeCompare(String(a?.created_at || ''))
        )
        const search = safeString(url.searchParams.get('search')).toLowerCase()
        const type = safeString(url.searchParams.get('type')).toLowerCase()
        const category = safeString(url.searchParams.get('category')).toLowerCase()
        const read = safeString(url.searchParams.get('read')).toLowerCase()

        const filtered = notifications.filter((n) => {
          if (search) {
            const hay = `${n?.title || ''} ${n?.message || ''}`.toLowerCase()
            if (!hay.includes(search)) return false
          }
          if (type && type !== 'all' && safeString(n?.type).toLowerCase() !== type) return false
          if (category && category !== 'all' && safeString(n?.category).toLowerCase() !== category) return false
          if (read && read !== 'all') {
            const wantRead = read === 'read'
            if (Boolean(n?.read) !== wantRead) return false
          }
          return true
        })

        const { items, pagination } = paginateArray(filtered, {
          page: url.searchParams.get('page') || 1,
          limit: url.searchParams.get('limit') || 20,
        })

        return json(res, 200, { notifications: items, pagination })
      }
      if (pathname === '/api/notificaciones' && method === 'POST') {
        const body = await readJson(req).catch(() => ({}))
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        panelDb.notifications ||= {}
        const id = nextId(panelDb, 'notificationsCounter')
        const now = new Date().toISOString()
        const record = {
          id,
          title: safeString(body?.title || 'Notificaciǭn'),
          message: safeString(body?.message || ''),
          type: safeString(body?.type || 'info'),
          category: safeString(body?.category || 'general'),
          read: false,
          user_id: body?.user_id ?? null,
          created_at: now,
          updated_at: now,
          metadata: body?.metadata ?? null,
          user_name: safeString(body?.user_name || null) || null,
        }
        if (!panelDb.notifications) panelDb.notifications = {}
        panelDb.notifications[id] = record
        sseBroadcast('notificaciones', { type: 'notificationChanged' })
        return json(res, 200, record)
      }
      if (pathname === '/api/notificaciones/read-all' && method === 'PATCH') {
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        const now = new Date().toISOString()
        for (const n of Object.values(panelDb.notifications || {})) {
          n.read = true
          n.updated_at = now
        }
        sseBroadcast('notificaciones', { type: 'notificationChanged' })
        return json(res, 200, { success: true })
      }
      const notifReadMatch = pathname.match(/^\/api\/notificaciones\/(\d+)\/read$/)
      if (notifReadMatch && method === 'PATCH') {
        const id = Number(notifReadMatch[1])
        const notif = panelDb?.notifications?.[id]
        if (!notif) return json(res, 404, { error: 'Notificaciǭn no encontrada' })
        notif.read = true
        notif.updated_at = new Date().toISOString()
        sseBroadcast('notificaciones', { type: 'notificationChanged' })
        return json(res, 200, { success: true })
      }
      const notifIdMatch = pathname.match(/^\/api\/notificaciones\/(\d+)$/)
      if (notifIdMatch && method === 'DELETE') {
        const id = Number(notifIdMatch[1])
        if (panelDb?.notifications?.[id]) {
          if (!panelDb.notifications) panelDb.notifications = {}
          delete panelDb.notifications[id]
        }
        sseBroadcast('notificaciones', { type: 'notificationChanged' })
        return json(res, 200, { success: true })
      }

      // ===== Notificaciones globales =====
      if (pathname === '/api/notificaciones-globales/stats' && method === 'GET') {
        const list = Object.values(panelDb?.globalNotifications || {})
        const enviados = list.filter((n) => n?.estado === 'enviado').length
        const errores = list.filter((n) => n?.estado === 'error').length
        return json(res, 200, { total: list.length, enviados, errores })
      }
      if (pathname === '/api/notificaciones-globales' && method === 'GET') {
        const list = Object.values(panelDb?.globalNotifications || {}).slice().sort((a, b) =>
          String(b?.fecha_envio || '').localeCompare(String(a?.fecha_envio || ''))
        )
        const { items, pagination } = paginateArray(list, {
          page: url.searchParams.get('page') || 1,
          limit: url.searchParams.get('limit') || 20,
        })
        return json(res, 200, { notificaciones: items, pagination })
      }

      // ===== Multimedia =====
      if (pathname === '/api/multimedia/stats' && method === 'GET') {
        const list = Object.values(panelDb?.multimedia || {})
        const counts = { image: 0, video: 0, audio: 0, document: 0 }
        for (const item of list) {
          const t = safeString(item?.type || 'document')
          if (t in counts) counts[t] += 1
          else counts.document += 1
        }
        return json(res, 200, {
          total: list.length,
          totalFiles: list.length,
          images: counts.image,
          videos: counts.video,
          audio: counts.audio,
          documents: counts.document,
        })
      }

      if (pathname === '/api/multimedia' && method === 'GET') {
        const list = Object.values(panelDb?.multimedia || {}).slice().sort((a, b) =>
          String(b?.uploadedAt || b?.uploaded_at || '').localeCompare(String(a?.uploadedAt || a?.uploaded_at || ''))
        )
        const search = safeString(url.searchParams.get('search')).toLowerCase()
        const type = safeString(url.searchParams.get('type')).toLowerCase()

        const filtered = list.filter((item) => {
          if (search) {
            const hay = `${item?.name || ''} ${item?.description || ''}`.toLowerCase()
            if (!hay.includes(search)) return false
          }
          if (type && type !== 'all' && safeString(item?.type).toLowerCase() !== type) return false
          return true
        })

        const { items, pagination } = paginateArray(filtered, {
          page: url.searchParams.get('page') || 1,
          limit: url.searchParams.get('limit') || 12,
        })

        const publicItems = items.map((it) => {
          const copy = { ...(it || {}) }
          delete copy.file_path
          return copy
        })

        return json(res, 200, { items: publicItems, pagination })
      }

      if (pathname === '/api/multimedia/upload' && method === 'POST') {
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        panelDb.multimedia ||= {}

        const header = safeString(req.headers['content-type'] || '')
        const boundaryMatch = header.match(/boundary=([^;]+)/i)
        const boundary = boundaryMatch ? boundaryMatch[1].replace(/^\"|\"$/g, '') : ''
        if (!boundary) return json(res, 400, { error: 'multipart boundary faltante' })

        const limitMb = clampInt(panelDb?.systemConfig?.fileUploadLimit ?? 10, { min: 1, max: 200, fallback: 10 })
        let bodyBuffer
        try {
          bodyBuffer = await readBodyBuffer(req, { limitBytes: limitMb * 1024 * 1024 })
        } catch (err) {
          if (err?.code === 'LIMIT_BODY') return json(res, 413, { error: `Archivo demasiado grande (límite ${limitMb}MB)` })
          throw err
        }
        const filePart = parseMultipartSingleFile(bodyBuffer, boundary)
        if (!filePart?.data || !filePart.data.length) return json(res, 400, { error: 'Archivo no recibido' })

        const originalName = sanitizeFilename(filePart.filename || 'file')
        const unique = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${originalName}`
        const mediaRoot = path.join(process.cwd(), 'storage', 'media')
        fs.mkdirSync(mediaRoot, { recursive: true })
        const filePath = path.join(mediaRoot, unique)
        fs.writeFileSync(filePath, filePart.data)

        const mimeType = safeString(filePart.mimeType || mime.lookup(originalName) || 'application/octet-stream')
        const type =
          mimeType.startsWith('image/') ? 'image' :
            mimeType.startsWith('video/') ? 'video' :
              mimeType.startsWith('audio/') ? 'audio' : 'document'
        const ext = path.extname(originalName).replace('.', '').toLowerCase()
        const format = ext || safeString(mimeType.split('/')[1] || 'bin')

        const id = nextId(panelDb, 'multimediaCounter')
        const now = new Date().toISOString()
        const record = {
          id,
          name: originalName,
          description: '',
          type,
          format,
          size: filePart.data.length,
          url: `/media/${unique}`,
          tags: [],
          category: 'general',
          uploadedBy: 'panel',
          uploadedAt: now,
          downloads: 0,
          views: 0,
          filename: unique,
          file_path: filePath,
          mimeType,
        }

        if (!panelDb.multimedia) panelDb.multimedia = {}
        panelDb.multimedia[id] = record
        sseBroadcast('aportes', { type: 'aporteChanged' })

        const publicRecord = { ...record }
        delete publicRecord.file_path
        return json(res, 200, publicRecord)
      }

      const multimediaIdMatch = pathname.match(/^\/api\/multimedia\/(\d+)$/)
      if (multimediaIdMatch && method === 'GET') {
        const id = Number(multimediaIdMatch[1])
        const item = panelDb?.multimedia?.[id]
        if (!item) return json(res, 404, { error: 'Archivo no encontrado' })
        const copy = { ...(item || {}) }
        delete copy.file_path
        return json(res, 200, copy)
      }
      if (multimediaIdMatch && method === 'DELETE') {
        const id = Number(multimediaIdMatch[1])
        const item = panelDb?.multimedia?.[id]
        if (!item) return json(res, 404, { error: 'Archivo no encontrado' })
        const filePath = item.file_path
        if (panelDb?.multimedia?.[id]) {
          if (!panelDb.multimedia) panelDb.multimedia = {}
          delete panelDb.multimedia[id]
        }
        if (filePath) {
          try {
            const mediaRoot = path.resolve(path.join(process.cwd(), 'storage', 'media')).toLowerCase()
            const resolved = path.resolve(filePath).toLowerCase()
            if (resolved.startsWith(mediaRoot) && fs.existsSync(filePath)) fs.rmSync(filePath, { force: true })
          } catch {}
        }
        sseBroadcast('aportes', { type: 'aporteChanged' })
        return json(res, 200, { success: true })
      }

      // ===== AI Chat Sessions =====
      if (pathname === '/api/chat/sessions' && method === 'GET') {
        const sessions = Object.values(panelDb?.ai?.sessions || {}).map((s) => {
          const messages = Array.isArray(s?.messages) ? s.messages : []
          const last = messages.length ? messages[messages.length - 1]?.content : ''
          return {
            id: safeString(s?.id),
            title: safeString(s?.title || ''),
            created_at: s?.created_at || null,
            last_message: safeString(s?.last_message || last || ''),
            message_count: messages.length,
          }
        }).sort((a, b) => String(b?.created_at || '').localeCompare(String(a?.created_at || '')))
        return json(res, 200, sessions)
      }
      if (pathname === '/api/chat/sessions' && method === 'POST') {
        const body = await readJson(req).catch(() => ({}))
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        panelDb.ai ||= {}
        panelDb.ai.sessions ||= {}
        panelDb.ai.sessionsCounter ||= 0
        const now = new Date().toISOString()
        const numericId = nextId(panelDb.ai, 'sessionsCounter')
        const id = `session_${numericId}`
        const title = safeString(body?.title || `Chat ${now}`)
        panelDb.ai.sessions[id] = {
          id,
          title,
          created_at: now,
          updated_at: now,
          last_message: '',
          messages: [],
        }
        return json(res, 200, { id, title, created_at: now, last_message: '', message_count: 0 })
      }
      const chatSessionDelete = pathname.match(/^\/api\/chat\/sessions\/([^/]+)$/)
      if (chatSessionDelete && method === 'DELETE') {
        const sessionId = decodeURIComponent(chatSessionDelete[1])
        if (panelDb?.ai?.sessions?.[sessionId]) delete panelDb.ai.sessions[sessionId]
        return json(res, 200, { success: true })
      }
      const chatMessagesMatch = pathname.match(/^\/api\/chat\/sessions\/([^/]+)\/messages$/)
      if (chatMessagesMatch && method === 'GET') {
        const sessionId = decodeURIComponent(chatMessagesMatch[1])
        const messages = panelDb?.ai?.sessions?.[sessionId]?.messages
        return json(res, 200, Array.isArray(messages) ? messages : [])
      }
      if (chatMessagesMatch && method === 'POST') {
        const sessionId = decodeURIComponent(chatMessagesMatch[1])
        const body = await readJson(req).catch(() => ({}))
        const message = safeString(body?.message || '').trim()
        const model = safeString(body?.model || 'gpt-3.5-turbo')
        const temperature = Number(body?.temperature || 0.7)
        const maxTokens = Number(body?.maxTokens || 1000)
        
        if (!message) return json(res, 400, { error: 'message es requerido' })
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        
        panelDb.ai ||= {}
        panelDb.ai.sessions ||= {}
        panelDb.ai.sessions[sessionId] ||= {
          id: sessionId,
          title: `Chat ${sessionId}`,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          last_message: '',
          messages: [],
        }
        
        const session = panelDb.ai.sessions[sessionId]
        session.messages ||= []
        const now = new Date().toISOString()
        
        // Agregar mensaje del usuario
        const userMessage = {
          id: crypto.randomBytes(8).toString('hex'),
          role: 'user',
          content: message,
          timestamp: now,
        }
        session.messages.push(userMessage)
        
        try {
          // Intentar llamada real a la API de IA
          const aiResponse = await callAiApi(message, model, temperature, maxTokens, session.messages)
          
          const assistantMessage = {
            id: crypto.randomBytes(8).toString('hex'),
            role: 'assistant',
            content: aiResponse.content,
            timestamp: new Date().toISOString(),
            tokens_used: aiResponse.tokens_used,
            model: model,
          }
          
          session.messages.push(assistantMessage)
          session.last_message = aiResponse.content
          session.updated_at = new Date().toISOString()
          
          return json(res, 200, { success: true, response: aiResponse.content, tokens_used: aiResponse.tokens_used })
          
        } catch (error) {
          console.error('Error calling AI API:', error)
          
          // Fallback a respuesta demo si falla la API real
          const fallbackReply = `Lo siento, no puedo procesar tu mensaje en este momento. Error: ${error.message}`
          
          const assistantMessage = {
            id: crypto.randomBytes(8).toString('hex'),
            role: 'assistant',
            content: fallbackReply,
            timestamp: new Date().toISOString(),
            tokens_used: 0,
            model: 'fallback',
          }
          
          session.messages.push(assistantMessage)
          session.last_message = fallbackReply
          session.updated_at = new Date().toISOString()
          
          return json(res, 200, { success: true, response: fallbackReply, error: error.message })
        }
      }

      if (pathname === '/api/ai/stats' && method === 'GET') {
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        const sessions = Object.values(panelDb?.ai?.sessions || {})
        const totalSessions = sessions.length
        const totalMessages = sessions.reduce((sum, s) => sum + (Array.isArray(s?.messages) ? s.messages.length : 0), 0)
        const totalTokens = sessions.reduce((sum, s) => {
          if (!Array.isArray(s?.messages)) return sum
          return sum + s.messages.reduce((msgSum, msg) => msgSum + (Number(msg?.tokens_used) || 0), 0)
        }, 0)
        return json(res, 200, { 
          totalSessions, 
          totalMessages, 
          totalTokens,
          activeSessions: sessions.filter(s => Array.isArray(s?.messages) && s.messages.length > 0).length
        })
      }

      // AI endpoints legacy - REMOVIDOS (usar /api/chat/sessions/{id}/messages)
      // Los endpoints legacy han sido eliminados para forzar el uso de la API real
      if (pathname === '/api/ai/test-command' && method === 'POST') {
        return json(res, 200, { success: true })
      }

      // ===== Custom Commands (CRUD) =====
      if (pathname === '/api/custom-commands' && method === 'GET') {
        panelDb.customCommands ||= {}
        const commands = Object.values(panelDb.customCommands).sort((a, b) =>
          String(b?.created_at || '').localeCompare(String(a?.created_at || ''))
        )
        return json(res, 200, { commands })
      }
      if (pathname === '/api/custom-commands' && method === 'POST') {
        const body = await readJson(req).catch(() => ({}))
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        panelDb.customCommands ||= {}
        panelDb.customCommandsCounter ||= 0
        const id = nextId(panelDb, 'customCommandsCounter')
        const now = new Date().toISOString()
        const cmd = {
          id,
          trigger: safeString(body?.trigger || body?.command || '').trim(),
          description: safeString(body?.description || ''),
          response: safeString(body?.response || body?.reply || ''),
          enabled: body?.enabled !== false,
          usage_count: 0,
          last_used: null,
          created_at: now,
          updated_at: now,
        }
        if (!cmd.trigger) return json(res, 400, { error: 'trigger es requerido' })
        panelDb.customCommands[id] = cmd
        try {
          const actor = getActorFromRequest(req, url, panelDb)
          pushPanelLog(panelDb, {
            tipo: 'config',
            titulo: 'Comando personalizado creado',
            detalles: cmd.trigger,
            usuario: actor?.username || 'system',
            metadata: { scope: 'customCommands', action: 'create', id },
          })
        } catch {}
        return json(res, 200, cmd)
      }
      const customCmdIdMatch = pathname.match(/^\/api\/custom-commands\/([^/]+)$/)
      if (customCmdIdMatch && method === 'PATCH') {
        const id = parseInt(decodeURIComponent(customCmdIdMatch[1]), 10)
        const body = await readJson(req).catch(() => ({}))
        panelDb.customCommands ||= {}
        const cmd = panelDb.customCommands[id]
        if (!cmd) return json(res, 404, { error: 'Comando no encontrado' })
        if (body?.trigger != null) cmd.trigger = safeString(body.trigger).trim()
        if (body?.description != null) cmd.description = safeString(body.description)
        if (body?.response != null || body?.reply != null) cmd.response = safeString(body?.response || body?.reply || '')
        if (body?.enabled != null) cmd.enabled = body.enabled !== false
        cmd.updated_at = new Date().toISOString()
        try {
          const actor = getActorFromRequest(req, url, panelDb)
          pushPanelLog(panelDb, {
            tipo: 'config',
            titulo: 'Comando personalizado actualizado',
            detalles: cmd.trigger,
            usuario: actor?.username || 'system',
            metadata: { scope: 'customCommands', action: 'update', id },
          })
        } catch {}
        return json(res, 200, { success: true })
      }
      if (customCmdIdMatch && method === 'DELETE') {
        const id = parseInt(decodeURIComponent(customCmdIdMatch[1]), 10)
        panelDb.customCommands ||= {}
        const cmd = panelDb.customCommands[id]
        if (cmd) delete panelDb.customCommands[id]
        try {
          const actor = getActorFromRequest(req, url, panelDb)
          pushPanelLog(panelDb, {
            tipo: 'config',
            titulo: 'Comando personalizado eliminado',
            detalles: cmd?.trigger || String(id),
            usuario: actor?.username || 'system',
            metadata: { scope: 'customCommands', action: 'delete', id },
          })
        } catch {}
        return json(res, 200, { success: true })
      }
      if (pathname === '/api/custom-commands/test' && method === 'POST') {
        const body = await readJson(req).catch(() => ({}))
        const trigger = safeString(body?.trigger || body?.command || '').trim()
        const msg = safeString(body?.message || body?.text || body?.testMessage || '').trim()
        panelDb.customCommands ||= {}
        const cmd = Object.values(panelDb.customCommands).find((c) => safeString(c?.trigger) === trigger) || null
        if (!cmd) return json(res, 200, { found: false, response: `Comando no encontrado: ${trigger}` })
        if (cmd.enabled === false) return json(res, 200, { found: true, response: `Comando deshabilitado: ${trigger}` })
        cmd.usage_count = Number(cmd.usage_count || 0) + 1
        cmd.last_used = new Date().toISOString()
        cmd.updated_at = cmd.last_used
        const responseText = safeString(cmd.response || '').replace(/\{\{message\}\}/g, msg)
        return json(res, 200, { found: true, response: responseText })
      }

      // ===== Bot Commands =====
      if (pathname === '/api/bot/help' && method === 'GET') {
        const category = safeString(url.searchParams.get('category')).toLowerCase()
        const commandsRaw = Object.values(panelDb?.botCommands || {})
        const commands = commandsRaw
          .filter((c) => {
            if (!category || category === 'all') return true
            return safeString(c?.category).toLowerCase() === category
          })
          .map((c) => ({
            command: safeString(c?.command || ''),
            description: safeString(c?.description || ''),
            category: safeString(c?.category || 'general'),
            enabled: c?.enabled !== false,
            usage_count: Number(c?.usage_count || 0),
            aliases: Array.isArray(c?.aliases) ? c.aliases : [],
            permissions: Array.isArray(c?.permissions) ? c.permissions : [],
          }))
          .filter((c) => c.command)

        const categories = [...new Set(commandsRaw.map((c) => safeString(c?.category || 'general')))]
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b))

        const help = commands
          .map((c) => `${c.command}${c.description ? ` — ${c.description}` : ''}`)
          .join('\n')

        return json(res, 200, { category: category || null, categories, commands, help })
      }
      if (pathname === '/api/bot/commands/categories' && method === 'GET') {
        const commands = Object.values(panelDb?.botCommands || {})
        const byCategory = new Map()
        for (const cmd of commands) {
          const cat = safeString(cmd?.category || 'general')
          byCategory.set(cat, (byCategory.get(cat) || 0) + 1)
        }
        const colors = {
          general: 'blue',
          admin: 'red',
          fun: 'purple',
          utility: 'green',
          info: 'yellow',
          subbot: 'indigo',
          media: 'pink',
        }
        const categories = [...byCategory.entries()].map(([id, count]) => ({
          id,
          name: id,
          description: '',
          color: colors[id] || 'gray',
          command_count: count,
        }))
        return json(res, 200, { categories })
      }
      if (pathname === '/api/bot/commands/stats' && method === 'GET') {
        const commands = Object.values(panelDb?.botCommands || {})
        const enabled = commands.filter((c) => c?.enabled !== false).length
        const totalUsage = commands.reduce((sum, c) => sum + Number(c?.usage_count || 0), 0)
        return json(res, 200, {
          total: commands.length,
          enabled,
          disabled: Math.max(0, commands.length - enabled),
          totalUsage,
        })
      }
      if (pathname === '/api/bot/commands' && method === 'GET') {
        const search = safeString(url.searchParams.get('search')).toLowerCase()
        const category = safeString(url.searchParams.get('category')).toLowerCase()
        const commands = Object.values(panelDb?.botCommands || {}).filter((c) => {
          if (search) {
            const hay = `${c?.command || ''} ${c?.description || ''}`.toLowerCase()
            if (!hay.includes(search)) return false
          }
          if (category && category !== 'all' && safeString(c?.category).toLowerCase() !== category) return false
          return true
        }).sort((a, b) => String(b?.created_at || '').localeCompare(String(a?.created_at || '')))
        return json(res, 200, { commands })
      }
      if (pathname === '/api/bot/commands' && method === 'POST') {
        const body = await readJson(req).catch(() => ({}))
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        panelDb.botCommands ||= {}
        const id = `cmd_${nextId(panelDb, 'botCommandsCounter')}`
        const now = new Date().toISOString()
        panelDb.botCommands[id] = {
          id,
          command: safeString(body?.command || '').trim(),
          description: safeString(body?.description || ''),
          response: safeString(body?.response || ''),
          category: safeString(body?.category || 'general'),
          enabled: body?.enabled !== false,
          usage_count: 0,
          last_used: null,
          created_at: now,
          updated_at: now,
          permissions: Array.isArray(body?.permissions) ? body.permissions : [],
          aliases: Array.isArray(body?.aliases) ? body.aliases : [],
        }
        return json(res, 200, panelDb.botCommands[id])
      }
      const botCmdIdMatch = pathname.match(/^\/api\/bot\/commands\/([^/]+)$/)
      if (botCmdIdMatch && method === 'PUT') {
        const id = decodeURIComponent(botCmdIdMatch[1])
        const body = await readJson(req).catch(() => ({}))
        const cmd = panelDb?.botCommands?.[id]
        if (!cmd) return json(res, 404, { error: 'Comando no encontrado' })
        Object.assign(cmd, body || {})
        cmd.updated_at = new Date().toISOString()
        return json(res, 200, { success: true })
      }
      if (botCmdIdMatch && method === 'DELETE') {
        const id = decodeURIComponent(botCmdIdMatch[1])
        if (panelDb?.botCommands?.[id]) delete panelDb.botCommands[id]
        return json(res, 200, { success: true })
      }
      const botCmdToggleMatch = pathname.match(/^\/api\/bot\/commands\/([^/]+)\/toggle$/)
      if (botCmdToggleMatch && method === 'PATCH') {
        const id = decodeURIComponent(botCmdToggleMatch[1])
        const body = await readJson(req).catch(() => ({}))
        const cmd = panelDb?.botCommands?.[id]
        if (!cmd) return json(res, 404, { error: 'Comando no encontrado' })
        cmd.enabled = body?.enabled !== false
        cmd.updated_at = new Date().toISOString()
        return json(res, 200, { success: true })
      }
      if (pathname === '/api/bot/commands/test' && method === 'POST') {
        const body = await readJson(req).catch(() => ({}))
        const commandName = safeString(body?.command || '').trim()
        const msg = safeString(body?.message || body?.testMessage || '').trim()
        const cmd = Object.values(panelDb?.botCommands || {}).find((c) => safeString(c?.command) === commandName) || null
        if (!cmd) return json(res, 200, { response: `Comando no encontrado: ${commandName}` })
        if (cmd.enabled === false) return json(res, 200, { response: `Comando deshabilitado: ${commandName}` })
        cmd.usage_count = Number(cmd.usage_count || 0) + 1
        cmd.last_used = new Date().toISOString()
        cmd.updated_at = cmd.last_used
        const responseText = safeString(cmd.response || '').replace(/\{\{message\}\}/g, msg)
        return json(res, 200, { response: responseText })
      }

      // ===== Analytics =====
      if (pathname === '/api/analytics' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })

        // Analytics basado en datos reales (logs + dailyMetrics)
        const usersCount = global.db?.data?.users ? Object.keys(global.db.data.users).length : 0
        const groupsCount = panelDb ? Object.keys(panelDb.groups || {}).length : 0
        const aportesCount = (ensureAportesStore() || []).length
        const pedidosCount = panelDb ? Object.keys(panelDb.pedidos || {}).length : 0

        const panel = global.db?.data?.panel || {}
        const logs = Array.isArray(panel.logs) ? panel.logs : []
        const dailyMetrics = panel?.dailyMetrics && typeof panel.dailyMetrics === 'object' ? panel.dailyMetrics : {}

        const toTs = (iso) => {
          const t = new Date(iso || 0).getTime()
          return Number.isFinite(t) ? t : 0
        }

        const now = Date.now()
        const dayAgo = now - 24 * 60 * 60 * 1000
        const weekAgo = now - 7 * 24 * 60 * 60 * 1000
        const monthAgo = now - 30 * 24 * 60 * 60 * 1000
        const minuteAgo = now - 60 * 1000

        const activeUsers = (since) =>
          new Set(
            logs
              .filter((l) => toTs(l?.fecha) >= since)
              .map((l) => l?.usuario)
              .filter(Boolean)
              .map(String)
          ).size

        const cmdLogs24h = logs.filter((l) => l?.tipo === 'comando' && toTs(l?.fecha) >= dayAgo)
        const cmdLogs1m = logs.filter((l) => l?.tipo === 'comando' && toTs(l?.fecha) >= minuteAgo)
        const errorCmdLogs24h = cmdLogs24h.filter((l) => l?.nivel === 'error' || l?.metadata?.success === false)

        const responseTimes = cmdLogs24h
          .map((l) => Number(l?.metadata?.responseTime))
          .filter((n) => Number.isFinite(n) && n >= 0)
        const avgResponseTime = responseTimes.length
          ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
          : 0

        const throughput = cmdLogs1m.length
        const errorRate = cmdLogs24h.length ? (errorCmdLogs24h.length / cmdLogs24h.length) * 100 : 0

        const topCommandsMap = new Map()
        for (const l of cmdLogs24h) {
          const cmd = safeString(l?.metadata?.command || l?.comando || '').trim()
          if (!cmd) continue
          topCommandsMap.set(cmd, (topCommandsMap.get(cmd) || 0) + 1)
        }
        const topContent = [...topCommandsMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([name, count]) => ({ name, count }))

        const todayKey = new Date().toISOString().slice(0, 10)
        const mensajesPorHora = dailyMetrics?.[todayKey]?.mensajesPorHora || {}
        const comandosPorHora = dailyMetrics?.[todayKey]?.comandosPorHora || {}
        const userActivity = Array.from({ length: 24 }, (_, h) => {
          const hh = String(h).padStart(2, '0')
          return {
            hour: `${hh}:00`,
            mensajes: Number(mensajesPorHora?.[hh]) || 0,
            comandos: Number(comandosPorHora?.[hh]) || 0,
          }
        })

        return json(res, 200, {
          overview: {
            totalUsers: usersCount,
            totalGroups: groupsCount,
            totalAportes: aportesCount,
            totalPedidos: pedidosCount,
            activeUsers: activeUsers(dayAgo),
            botUptime: formatUptime(process.uptime()),
          },
          trends: { usersGrowth: 0, groupsGrowth: 0, aportesGrowth: 0, pedidosGrowth: 0 },
          engagement: {
            dailyActiveUsers: activeUsers(dayAgo),
            weeklyActiveUsers: activeUsers(weekAgo),
            monthlyActiveUsers: activeUsers(monthAgo),
            averageSessionTime: '0m',
            bounceRate: 0,
          },
          performance: {
            responseTime: avgResponseTime,
            uptime: 100,
            errorRate: Math.round(errorRate * 100) / 100,
            throughput,
          },
          topContent,
          userActivity,
        })
      }

      // Alert Rules API
      if (pathname === '/api/alerts/rules' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const rules = alertSystem.getRules()
        return json(res, 200, { rules })
      }

      // Resources Stats API - USANDO DATOS REALES
      if (pathname === '/api/resources/stats' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const { default: resourceMonitor } = await import('./resource-monitor.js')
          const stats = resourceMonitor.getStats()
          return json(res, 200, stats)
        } catch (error) {
          console.error('Error obteniendo métricas de recursos:', error)
          return json(res, 500, { error: 'Error interno del servidor' })
        }
      }

      // Resources History API - USANDO DATOS REALES
      if (pathname === '/api/resources/history' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 5000, fallback: null })
          const { default: resourceMonitor } = await import('./resource-monitor.js')
          const history = resourceMonitor.getHistoricalData(limit)
          return json(res, 200, { history })
        } catch (error) {
          console.error('Error obteniendo historial de recursos:', error)
          return json(res, 500, { error: 'Error interno del servidor' })
        }
      }

      // Resources Start Monitoring API
      if (pathname === '/api/resources/start' && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const body = await readJson(req).catch(() => ({}))
          const interval = clampInt(body?.interval, { min: 1000, max: 600000, fallback: 5000 })
          const { default: resourceMonitor } = await import('./resource-monitor.js')
          resourceMonitor.startMonitoring(interval)
          return json(res, 200, { success: true, message: 'Monitoreo iniciado', interval })
        } catch (error) {
          console.error('Error iniciando monitoreo de recursos:', error)
          return json(res, 500, { error: 'Error interno del servidor' })
        }
      }

      // Task Executions API
      if (pathname === '/api/tasks/executions' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 1000, fallback: 100 })
        const executions = taskScheduler.getExecutions(limit)
        return json(res, 200, { executions })
      }

      // System Metrics API - Enhanced with comprehensive real data
      if (pathname === '/api/system/metrics' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const mem = process.memoryUsage()
        const totalMem = os.totalmem()
        const freeMem = os.freemem()
        const cpus = os.cpus()
        const loadAvg = os.loadavg()
        
        // Get real CPU usage
        let cpuUsage = 0
        try {
          cpuUsage = Math.min(100, (loadAvg[0] / cpus.length) * 100)
        } catch (err) {
          cpuUsage = 0 // Fallback sin simulaciÛn
        }
        
        // Get disk usage (real; sin "default" ficticio)
        let diskUsage = 0
        try {
          if (typeof fs.statfsSync === 'function') {
            const st = fs.statfsSync(process.cwd())
            const total = Number(st.bsize) * Number(st.blocks)
            const free = Number(st.bsize) * Number(st.bfree)
            if (Number.isFinite(total) && total > 0 && Number.isFinite(free)) {
              diskUsage = Math.round(((total - free) / total) * 100)
            }
          } else {
            const { execSync } = await import('child_process')
            if (process.platform === 'win32') {
              const output = execSync('wmic logicaldisk get size,freespace,caption', { encoding: 'utf8', timeout: 5000 })
              const lines = output.split('\n').filter(line => line.trim() && !line.includes('Caption'))
              if (lines.length > 0) {
                const parts = lines[0].trim().split(/\s+/)
                if (parts.length >= 2) {
                  const free = parseInt(parts[0]) || 0
                  const total = parseInt(parts[1]) || 0
                  if (total > 0) diskUsage = Math.round(((total - free) / total) * 100)
                }
              }
            } else {
              const output = execSync('df -k /', { encoding: 'utf8', timeout: 5000 })
              const lines = output.split('\n')
              if (lines.length > 1) {
                const parts = lines[1].trim().split(/\s+/)
                if (parts.length >= 5) {
                  const pct = parseInt(String(parts[4]).replace('%', ''))
                  if (Number.isFinite(pct)) diskUsage = clampInt(pct, { min: 0, max: 100, fallback: 0 })
                }
              }
            }
          }
        } catch (err) {
          console.warn('Could not get disk usage:', err.message)
        }
        
        const metrics = {
          cpu: cpuUsage,
          memory: ((totalMem - freeMem) / totalMem) * 100,
          disk: diskUsage,
          network: { 
            rx: 0,
            tx: 0
          },
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
          detailed: {
            cpu: {
              cores: cpus.length,
              model: cpus[0]?.model || 'Unknown',
              speed: cpus[0]?.speed || 0,
              loadAverage: loadAvg
            },
            memory: {
              total: totalMem,
              free: freeMem,
              used: totalMem - freeMem,
              process: mem
            },
            system: {
              platform: os.platform(),
              arch: os.arch(),
              hostname: os.hostname(),
              release: os.release()
            }
          }
        }
        
        // Store metrics history
        if (!panelDb.metricsHistory) panelDb.metricsHistory = []
        panelDb.metricsHistory.push({
          timestamp: Date.now(),
          cpu: metrics.cpu,
          memory: metrics.memory,
          disk: metrics.disk
        })
        
        // Keep only last 1000 entries (about 83 hours at 5min intervals)
        if (panelDb.metricsHistory.length > 1000) {
          panelDb.metricsHistory = panelDb.metricsHistory.slice(-1000)
        }
        
        return json(res, 200, metrics)
      }

      // System Status API - Enhanced with real system status
      if (pathname === '/api/system/status' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const status = {
          isRunning: true,
          status: 'healthy',
          uptime: process.uptime(),
          version: '1.0.0',
          systems: {
            metrics: true,
            alerts: alertSystem?.isRunning || false,
            reporting: true,
            resourceMonitor: true,
            logManager: true,
            backupSystem: backupSystem?.isRunning || false,
            securityMonitor: true,
            database: !!global.db?.data,
            bot: global.conn?.user ? true : false,
            notifications: notificationSystem?.isRunning || false,
            taskScheduler: taskScheduler?.isRunning || false
          },
          services: {
            database: global.db?.data ? 'healthy' : 'disconnected',
            bot: global.conn?.user ? 'connected' : 'disconnected',
            websocket: 'connected',
            api: 'healthy'
          },
          stats: {
            totalUsers: Object.keys(global.db?.data?.users || {}).length,
            totalGroups: Object.keys(global.db?.data?.chats || {}).filter(id => id.endsWith('@g.us')).length,
            totalChats: Object.keys(global.db?.data?.chats || {}).length,
            activeConnections: panelDb?.activeConnections || 0,
            requestsToday: panelDb?.requestsToday || 0
          }
        }
        return json(res, 200, status)
      }

      // System Reports API
      if (pathname === '/api/system/reports' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })

        const panel = global.db?.data?.panel || {}
        const dailyMetrics = panel?.dailyMetrics && typeof panel.dailyMetrics === 'object' ? panel.dailyMetrics : {}
        const logs = Array.isArray(panel?.logs) ? panel.logs : []

        const dayKey = (d) => new Date(d).toISOString().slice(0, 10)
        const parseTs = (iso) => {
          const t = new Date(iso || 0).getTime()
          return Number.isFinite(t) ? t : 0
        }

        const aggregate = (days) => {
          let messages = 0
          let errors = 0
          const since = Date.now() - days * 24 * 60 * 60 * 1000
          const users = new Set()

          for (let i = 0; i < days; i++) {
            const key = dayKey(Date.now() - i * 24 * 60 * 60 * 1000)
            const dm = dailyMetrics?.[key] || {}
            messages += Number(dm?.mensajes) || 0
            errors += Number(dm?.erroresComandos) || 0
          }

          for (const l of logs) {
            const ts = parseTs(l?.fecha)
            if (!ts || ts < since) continue
            if (l?.usuario) users.add(String(l.usuario))
          }

          return { messages, users: users.size, errors }
        }

        return json(res, 200, {
          daily: aggregate(1),
          weekly: aggregate(7),
          monthly: aggregate(30),
        })
      }

      // System Metrics History API
      if (pathname === '/api/system/metrics/history' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 5000, fallback: null })
          const { default: resourceMonitor } = await import('./resource-monitor.js')
          const history = resourceMonitor.getHistoricalData(limit)
          return json(res, 200, { history })
        } catch (error) {
          console.error('Error obteniendo historial de métricas:', error)
          return json(res, 500, { error: 'Error interno del servidor' })
        }
      }

      // Logs Search API - USANDO DATOS REALES
      if (pathname === '/api/logs/search' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 200, fallback: 50 })
          const page = clampInt(url.searchParams.get('page'), { min: 1, fallback: 1 })
          const level = safeString(url.searchParams.get('level')).toLowerCase()
          const category = safeString(url.searchParams.get('category')).toLowerCase()
          const query = safeString(url.searchParams.get('query')).toLowerCase()

          const src = Array.isArray(panelDb?.logs) ? panelDb.logs : []
          const normalized = src.map((log) => ({
            ...log,
            nivel: safeString(log?.nivel || (log?.tipo === 'comando' ? 'info' : 'info')).toLowerCase(),
            categoria: safeString(log?.categoria || log?.category || log?.tipo || 'system').toLowerCase(),
            mensaje: safeString(log?.mensaje || log?.message || log?.detalles || log?.comando || 'Evento'),
            timestamp: safeString(log?.fecha || log?.timestamp || new Date().toISOString()),
          }))

          const filtered = normalized.filter((l) => {
            if (level && l.nivel !== level) return false
            if (category && l.categoria !== category) return false
            if (query) {
              const hay =
                l.mensaje.toLowerCase().includes(query) ||
                safeString(l?.usuario).toLowerCase().includes(query) ||
                safeString(l?.grupo).toLowerCase().includes(query) ||
                safeString(l?.metadata?.plugin).toLowerCase().includes(query) ||
                safeString(l?.metadata?.command).toLowerCase().includes(query)
              if (!hay) return false
            }
            return true
          })

          const ordered = filtered
            .slice()
            .sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime())

          const { items, pagination } = paginateArray(ordered, { page, limit })

          const counts = { error: 0, warn: 0, info: 0, debug: 0, trace: 0 }
          for (const l of normalized) {
            const lvl = String(l.nivel || '').toLowerCase()
            if (counts[lvl] != null) counts[lvl] += 1
          }

          return json(res, 200, {
            logs: items.map((l) => ({
              timestamp: l.timestamp,
              level: l.nivel,
              category: l.categoria,
              message: l.mensaje,
              data: l.metadata || l.data || {},
              pid: process.pid,
              hostname: os.hostname(),
            })),
            total: filtered.length,
            pagination,
            stats: {
              totalLogs: normalized.length,
              errorCount: counts.error,
              warnCount: counts.warn,
              infoCount: counts.info,
              debugCount: counts.debug,
              traceCount: counts.trace,
              lastLogTime: normalized.length ? normalized[normalized.length - 1].timestamp : null,
            },
          })
        } catch (error) {
          console.error('Error obteniendo logs:', error)
          return json(res, 500, { error: 'Error interno del servidor' })
        }
      }

      // Logs Stats API - USANDO DATOS REALES
      if (pathname === '/api/logs/stats' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const logs = Array.isArray(panelDb?.logs) ? panelDb.logs : []
          const todayKey = new Date().toISOString().slice(0, 10)
          const logsToday = logs.filter((l) => String(l?.fecha || l?.timestamp || '').slice(0, 10) === todayKey).length

          const levels = { error: 0, warn: 0, info: 0, debug: 0, trace: 0 }
          let lastLogTime = null
          for (const l of logs) {
            const raw = safeString(l?.nivel || l?.level || '').toLowerCase()
            const lvl = Object.prototype.hasOwnProperty.call(levels, raw) ? raw : 'info'
            levels[lvl]++

            const t = new Date(l?.fecha || l?.timestamp || 0).getTime()
            if (Number.isFinite(t) && t > 0) {
              if (!lastLogTime || t > new Date(lastLogTime).getTime()) lastLogTime = new Date(t).toISOString()
            }
          }

          const computeDirSize = (dir) => {
            try {
              if (!fs.existsSync(dir)) return { totalSize: 0, fileCount: 0 }
              let totalSize = 0
              let fileCount = 0
              const walk = (d) => {
                const entries = fs.readdirSync(d, { withFileTypes: true })
                for (const e of entries) {
                  const p = path.join(d, e.name)
                  if (e.isDirectory()) walk(p)
                  else {
                    const st = fs.statSync(p)
                    totalSize += st.size
                    fileCount++
                  }
                }
              }
              walk(dir)
              return { totalSize, fileCount }
            } catch {
              return { totalSize: 0, fileCount: 0 }
            }
          }

          const humanBytes = (bytes) => {
            const n = Number(bytes) || 0
            if (n <= 0) return '0 B'
            const units = ['B', 'KB', 'MB', 'GB', 'TB']
            const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
            return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`
          }

          const { totalSize, fileCount } = computeDirSize(path.join(process.cwd(), 'logs'))

          return json(res, 200, {
            totalLogs: logs.length,
            logsToday,
            errorCount: levels.error,
            warnCount: levels.warn,
            infoCount: levels.info,
            debugCount: levels.debug,
            traceCount: levels.trace,
            filesCreated: 0,
            filesRotated: 0,
            filesCompressed: 0,
            lastLogTime: lastLogTime || null,
            uptime: Math.round(process.uptime() * 1000),
            bufferSize: logs.length,
            activeStreams: 0,
            diskUsage: {
              totalSize,
              fileCount,
              formattedSize: humanBytes(totalSize),
            },
          })
        } catch (error) {
          console.error('Error obteniendo stats de logs:', error)
          return json(res, 500, { error: 'Error interno del servidor' })
        }
      }

      // Logs Export API
      if (pathname === '/api/logs/export' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const format = url.searchParams.get('format') || 'json'
        const category = url.searchParams.get('category') || ''
        const startDate = url.searchParams.get('startDate') || ''
        const endDate = url.searchParams.get('endDate') || ''
        
        let logs = Array.isArray(panelDb?.logs) ? [...panelDb.logs] : []
        
        // Aplicar filtros
        if (category) {
          logs = logs.filter(log => log.category === category || log.fuente === category)
        }
        
        if (startDate) {
          const start = new Date(startDate)
          logs = logs.filter(log => new Date(log.timestamp || log.fecha || 0) >= start)
        }
        
        if (endDate) {
          const end = new Date(endDate)
          logs = logs.filter(log => new Date(log.timestamp || log.fecha || 0) <= end)
        }
        
        const exportData = {
          exportedAt: new Date().toISOString(),
          totalLogs: logs.length,
          filters: { category, startDate, endDate },
          logs: logs.map(log => ({
            timestamp: log.timestamp || log.fecha,
            level: log.level,
            category: log.category || log.fuente,
            message: log.message || log.mensaje,
            data: log.data || log.metadata,
            source: log.source || log.fuente
          }))
        }
        
        if (format === 'json') {
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Content-Disposition', `attachment; filename="logs-${new Date().toISOString().split('T')[0]}.json"`)
          return res.end(JSON.stringify(exportData, null, 2))
        }
        
        if (format === 'csv') {
          const csv = [
            'timestamp,level,category,message,source',
            ...exportData.logs.map(log => 
              `"${log.timestamp}","${log.level}","${log.category}","${log.message?.replace(/"/g, '""')}","${log.source}"`
            )
          ].join('\n')
          
          res.setHeader('Content-Type', 'text/csv')
          res.setHeader('Content-Disposition', `attachment; filename="logs-${new Date().toISOString().split('T')[0]}.csv"`)
          return res.end(csv)
        }
        
        return json(res, 400, { error: 'Formato no soportado' })
      }

      // Logs Clear API
      if (pathname === '/api/logs/clear' && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const deletedCount = panelDb?.logs?.length || 0
        if (panelDb) {
          panelDb.logs = []
        }
        
        return json(res, 200, { 
          success: true, 
          message: `${deletedCount} logs eliminados`,
          deletedCount 
        })
      }

      // Bot Popular Commands (datos reales desde panel.logs)
      if (pathname === '/api/bot/popular' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })

        const days = clampInt(url.searchParams.get('days'), { min: 1, max: 365, fallback: 30 })
        const since = Date.now() - (days * 24 * 60 * 60 * 1000)

        const logs = Array.isArray(panelDb?.logs) ? panelDb.logs : []
        const counts = new Map()
        let total = 0
        for (const l of logs) {
          if (l?.tipo !== 'comando') continue
          const t = new Date(l?.fecha || 0).getTime()
          if (!Number.isFinite(t) || t < since) continue

          const cmd = safeString(l?.metadata?.command || l?.comando || '').trim()
          if (!cmd) continue
          counts.set(cmd, (counts.get(cmd) || 0) + 1)
          total += 1
        }

        const data = [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 20)
          .map(([command, count]) => ({ command, count }))

        return json(res, 200, { rangeDays: days, total, data })
      }

      // Bot Command Categories (datos reales por plugin desde panel.logs)
      if (pathname === '/api/bot/categories' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })

        const days = clampInt(url.searchParams.get('days'), { min: 1, max: 365, fallback: 30 })
        const since = Date.now() - (days * 24 * 60 * 60 * 1000)

        const logs = Array.isArray(panelDb?.logs) ? panelDb.logs : []
        const counts = new Map()
        let total = 0
        for (const l of logs) {
          if (l?.tipo !== 'comando') continue
          const t = new Date(l?.fecha || 0).getTime()
          if (!Number.isFinite(t) || t < since) continue

          const plugin = safeString(l?.metadata?.plugin || 'unknown').trim() || 'unknown'
          counts.set(plugin, (counts.get(plugin) || 0) + 1)
          total += 1
        }

        const data = [...counts.entries()]
          .sort((a, b) => b[1] - a[1])
          .map(([category, count]) => ({ category, count }))

        return json(res, 200, { rangeDays: days, total, data })
      }

      // Analytics API - Bot Command Stats
      if (pathname === '/api/bot/stats' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        // Obtener datos reales del bot desde logs y métricas
        const now = new Date()
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)

        // Datos reales desde DB (sin simulaciones)
        const todayKey = now.toISOString().slice(0, 10)
        const yesterdayKey = yesterday.toISOString().slice(0, 10)
        const panel = global.db?.data?.panel || {}
        const logs = Array.isArray(panel.logs) ? panel.logs : []
        const dmToday = panel?.dailyMetrics?.[todayKey] || {}
        const dmYesterday = panel?.dailyMetrics?.[yesterdayKey] || {}

        const totalTodayReal = Number(dmToday?.comandos) || 0
        const totalYesterdayReal = Number(dmYesterday?.comandos) || 0

        const isCmd = (l) => l?.tipo === 'comando'
        const isToday = (l) => String(l?.fecha || '').slice(0, 10) === todayKey
        const isYesterday = (l) => String(l?.fecha || '').slice(0, 10) === yesterdayKey
        const isError = (l) => l?.nivel === 'error' || l?.metadata?.success === false

        const todayCmdLogs = logs.filter((l) => isCmd(l) && isToday(l))
        const yesterdayCmdLogs = logs.filter((l) => isCmd(l) && isYesterday(l))

        const errorCountToday = todayCmdLogs.filter(isError).length
        const errorCountYesterday = yesterdayCmdLogs.filter(isError).length

        const errorRateReal = totalTodayReal > 0 ? (errorCountToday / totalTodayReal) * 100 : 0
        const errorRateYesterdayReal = totalYesterdayReal > 0 ? (errorCountYesterday / totalYesterdayReal) * 100 : 0

        // Series (24h) por hora
        const hourlyDataReal = []
        const hourlyErrorsReal = []
        const responseTimeDataReal = []

        for (let i = 23; i >= 0; i--) {
          const hour = new Date(now.getTime() - i * 60 * 60 * 1000)
          const hourStart = new Date(hour)
          hourStart.setMinutes(0, 0, 0)
          const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000)

          const key = hour.toISOString().slice(0, 10)
          const hKey = String(hour.getHours()).padStart(2, '0')
          const dm = panel?.dailyMetrics?.[key] || {}
          const perHour = dm?.comandosPorHora || {}
          const count = Number(perHour?.[hKey]) || 0

          const logsHour = logs.filter((l) => {
            if (!isCmd(l)) return false
            const t = new Date(l?.fecha || 0).getTime()
            return Number.isFinite(t) && t >= hourStart.getTime() && t < hourEnd.getTime()
          })
          const err = logsHour.filter(isError).length
          const rts = logsHour.map((l) => Number(l?.metadata?.responseTime)).filter((n) => Number.isFinite(n) && n >= 0)
          const avgRt = rts.length ? Math.round(rts.reduce((a, b) => a + b, 0) / rts.length) : 0

          const name = hour.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
          hourlyDataReal.push({ name, value: count, timestamp: hour.toISOString() })
          hourlyErrorsReal.push({ name, value: err, timestamp: hour.toISOString() })
          responseTimeDataReal.push({ name, value: avgRt, timestamp: hour.toISOString() })
        }

        // Top comandos (hoy)
        const cmdCounts = new Map()
        for (const l of todayCmdLogs) {
          const cmd = safeString(l?.metadata?.command || l?.comando || '').trim()
          if (!cmd) continue
          cmdCounts.set(cmd, (cmdCounts.get(cmd) || 0) + 1)
        }
        const topCommandsReal = [...cmdCounts.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([name, value]) => ({ name, value }))

        return json(res, 200, {
          totalToday: totalTodayReal,
          totalYesterday: totalYesterdayReal,
          errorRate: Math.round(errorRateReal * 100) / 100,
          errorRateYesterday: Math.round(errorRateYesterdayReal * 100) / 100,
          hourlyData: hourlyDataReal,
          hourlyErrors: hourlyErrorsReal,
          responseTimeData: responseTimeDataReal,
          topCommands: topCommandsReal,
        })
      }

      // Analytics API - Usuario Stats
      if (pathname === '/api/usuarios/stats' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const totalUsers = Object.keys(panelDb?.users || {}).length

        // Datos reales (usuarios WhatsApp y actividad desde logs)
        const now = new Date()
        const todayKey = now.toISOString().slice(0, 10)
        const yesterdayKey = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        const whatsappUsers = global.db?.data?.users || {}
        const totalUsersReal = Object.keys(whatsappUsers).filter((jid) => String(jid).includes('@s.whatsapp.net')).length

        const panel = global.db?.data?.panel || {}
        const logs = Array.isArray(panel.logs) ? panel.logs : []
        const logsToday = logs.filter((l) => String(l?.fecha || '').slice(0, 10) === todayKey)
        const logsYesterday = logs.filter((l) => String(l?.fecha || '').slice(0, 10) === yesterdayKey)

        const activeTodayReal = new Set(logsToday.map((l) => l?.usuario).filter(Boolean)).size
        const activeYesterdayReal = new Set(logsYesterday.map((l) => l?.usuario).filter(Boolean)).size

        const hourlyActivityReal = []
        for (let i = 23; i >= 0; i--) {
          const hour = new Date(now.getTime() - i * 60 * 60 * 1000)
          const hourStart = new Date(hour)
          hourStart.setMinutes(0, 0, 0)
          const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000)
          const users = new Set()
          for (const l of logs) {
            const t = new Date(l?.fecha || 0).getTime()
            if (!Number.isFinite(t) || t < hourStart.getTime() || t >= hourEnd.getTime()) continue
            if (l?.usuario) users.add(l.usuario)
          }
          hourlyActivityReal.push({
            name: hour.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            value: users.size,
            timestamp: hour.toISOString()
          })
        }

        return json(res, 200, {
          total: totalUsersReal,
          activeToday: activeTodayReal,
          activeYesterday: activeYesterdayReal,
          hourlyActivity: hourlyActivityReal
        })
      }

      // Analytics API - Group Stats
      if (pathname === '/api/grupos/stats' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const totalGroups = Object.keys(panelDb?.groups || {}).length

        // Datos reales (grupos WhatsApp y actividad desde logs)
        const now = new Date()
        const todayKey = now.toISOString().slice(0, 10)
        const yesterdayKey = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
        const chats = global.db?.data?.chats || {}
        const totalGroupsReal = Object.keys(chats).filter((jid) => String(jid).endsWith('@g.us')).length

        const panel = global.db?.data?.panel || {}
        const logs = Array.isArray(panel.logs) ? panel.logs : []
        const logsToday = logs.filter((l) => String(l?.fecha || '').slice(0, 10) === todayKey)
        const logsYesterday = logs.filter((l) => String(l?.fecha || '').slice(0, 10) === yesterdayKey)

        const groupsToday = new Set(logsToday.map((l) => l?.grupo).filter((g) => typeof g === 'string' && g.includes('@g.us')))
        const groupsYesterday = new Set(logsYesterday.map((l) => l?.grupo).filter((g) => typeof g === 'string' && g.includes('@g.us')))

        const hourlyActivityReal = []
        for (let i = 23; i >= 0; i--) {
          const hour = new Date(now.getTime() - i * 60 * 60 * 1000)
          const hourStart = new Date(hour)
          hourStart.setMinutes(0, 0, 0)
          const hourEnd = new Date(hourStart.getTime() + 60 * 60 * 1000)
          const groups = new Set()
          for (const l of logs) {
            const t = new Date(l?.fecha || 0).getTime()
            if (!Number.isFinite(t) || t < hourStart.getTime() || t >= hourEnd.getTime()) continue
            const g = l?.grupo
            if (typeof g === 'string' && g.includes('@g.us')) groups.add(g)
          }
          hourlyActivityReal.push({
            name: hour.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
            value: groups.size,
            timestamp: hour.toISOString()
          })
        }

        return json(res, 200, {
          total: totalGroupsReal,
          activeToday: groupsToday.size,
          activeYesterday: groupsYesterday.size,
          hourlyActivity: hourlyActivityReal
        })
      }

      // Configuration API
      if (pathname === '/api/config' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const config = {
          main: {
            system: {
              maintenanceMode: panelDb?.systemConfig?.maintenanceMode || false,
              debugMode: panelDb?.systemConfig?.debugMode || false,
              apiRateLimit: panelDb?.systemConfig?.apiRateLimit || 100,
              fileUploadLimit: panelDb?.systemConfig?.fileUploadLimit || 10,
              sessionTimeout: panelDb?.systemConfig?.sessionTimeout || 3600,
              allowLocalhost: panelDb?.systemConfig?.allowLocalhost !== false
            },
            bot: {
              autoReconnect: panelDb?.botConfig?.autoReconnect !== false,
              maxReconnectAttempts: panelDb?.botConfig?.maxReconnectAttempts || 5,
              reconnectInterval: panelDb?.botConfig?.reconnectInterval || 30,
              logLevel: panelDb?.botConfig?.logLevel || 'info',
              qrTimeout: panelDb?.botConfig?.qrTimeout || 60,
              sessionTimeout: panelDb?.botConfig?.sessionTimeout || 3600
            },
            security: {
              adminIPs: panelDb?.systemConfig?.adminIPs || [],
              requireAuth: !!process.env.PANEL_API_KEY,
              rateLimitEnabled: true,
              maxLoginAttempts: 5
            },
            notifications: {
              enableEmail: false,
              enableWebhook: false,
              enableSocket: true,
              alertThresholds: {
                cpu: 80,
                memory: 85,
                disk: 90
              }
            }
          }
        }
        
        return json(res, 200, config)
      }

      // Configuration by key API
      if (pathname.startsWith('/api/config/') && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const configKey = pathname.split('/api/config/')[1]
        
        if (configKey === 'main') {
          return json(res, 200, {
            system: {
              maintenanceMode: panelDb?.systemConfig?.maintenanceMode || false,
              debugMode: panelDb?.systemConfig?.debugMode || false,
              apiRateLimit: panelDb?.systemConfig?.apiRateLimit || 100,
              fileUploadLimit: panelDb?.systemConfig?.fileUploadLimit || 10,
              sessionTimeout: panelDb?.systemConfig?.sessionTimeout || 3600,
              allowLocalhost: panelDb?.systemConfig?.allowLocalhost !== false
            },
            bot: panelDb?.botConfig || {},
            security: {
              adminIPs: panelDb?.systemConfig?.adminIPs || [],
              requireAuth: !!process.env.PANEL_API_KEY
            }
          })
        }
        
        if (configKey === 'system') {
          return json(res, 200, panelDb?.systemConfig || {})
        }
        
        if (configKey === 'bot') {
          return json(res, 200, panelDb?.botConfig || {})
        }
        
        return json(res, 200, {})
      }

      // Configuration Stats API
      if (pathname === '/api/config/stats' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })

        const countFiles = (dir) => {
          try {
            if (!dir || !fs.existsSync(dir)) return 0
            return fs.readdirSync(dir).filter((n) => n && n !== '.' && n !== '..').length
          } catch {
            return 0
          }
        }

        const getMtime = (p) => {
          try {
            if (!p || !fs.existsSync(p)) return null
            const st = fs.statSync(p)
            return st?.mtime ? new Date(st.mtime).toISOString() : null
          } catch {
            return null
          }
        }

        const configDir = path.join(process.cwd(), '.config')
        const backupDir = path.join(configDir, 'backups')
        const versionsDir = path.join(configDir, 'versions')
        const mainConfigPath = path.join(configDir, 'main.json')

        const totalBackups = countFiles(backupDir)
        const totalVersions = countFiles(versionsDir)
        const lastUpdate = getMtime(mainConfigPath) || new Date().toISOString()

        const countKeys = (obj) => (obj && typeof obj === 'object' ? Object.keys(obj).length : 0)
        const totalConfigurations =
          countKeys(panelDb?.systemConfig) +
          countKeys(panelDb?.botConfig) +
          countKeys(panelDb?.botGlobalState) +
          countKeys(panelDb?.whatsapp)

        return json(res, 200, {
          totalConfigurations,
          currentEnvironment: process.env.NODE_ENV || 'development',
          totalVersions,
          totalBackups,
          lastUpdate,
        })
      }

      // Dependencies API - Datos reales desde package.json
      if (pathname === '/api/dependencies' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const packageJsonPath = path.join(process.cwd(), 'package.json')
          const frontendPackageJsonPath = path.join(process.cwd(), 'frontend-next', 'package.json')
          
          let packageData = null
          let frontendPackageData = null
          
          // Leer package.json principal
          if (fs.existsSync(packageJsonPath)) {
            const packageContent = fs.readFileSync(packageJsonPath, 'utf-8')
            packageData = JSON.parse(packageContent)
          }
          
          // Leer package.json del frontend
          if (fs.existsSync(frontendPackageJsonPath)) {
            const frontendContent = fs.readFileSync(frontendPackageJsonPath, 'utf-8')
            frontendPackageData = JSON.parse(frontendContent)
          }
          
          // Función para obtener versión instalada desde node_modules
          const getInstalledVersion = (packageName, basePath = process.cwd()) => {
            try {
              const packageJsonPath = path.join(basePath, 'node_modules', packageName, 'package.json')
              if (fs.existsSync(packageJsonPath)) {
                const content = fs.readFileSync(packageJsonPath, 'utf-8')
                const pkg = JSON.parse(content)
                return pkg.version || null
              }
            } catch (error) {
              // Ignorar errores
            }
            return null
          }
          
          // Procesar dependencias del backend
          const backendDependencies = []
          if (packageData?.dependencies) {
            for (const [name, version] of Object.entries(packageData.dependencies)) {
              const installedVersion = getInstalledVersion(name)
              backendDependencies.push({
                name,
                version: version || 'N/A',
                installedVersion: installedVersion || version || 'N/A',
                type: 'dependency',
                source: 'backend'
              })
            }
          }
          
          // Procesar devDependencies del backend
          const backendDevDependencies = []
          if (packageData?.devDependencies) {
            for (const [name, version] of Object.entries(packageData.devDependencies)) {
              const installedVersion = getInstalledVersion(name)
              backendDevDependencies.push({
                name,
                version: version || 'N/A',
                installedVersion: installedVersion || version || 'N/A',
                type: 'devDependency',
                source: 'backend'
              })
            }
          }
          
          // Procesar optionalDependencies del backend
          const backendOptionalDependencies = []
          if (packageData?.optionalDependencies) {
            for (const [name, version] of Object.entries(packageData.optionalDependencies)) {
              const installedVersion = getInstalledVersion(name)
              backendOptionalDependencies.push({
                name,
                version: version || 'N/A',
                installedVersion: installedVersion || version || 'N/A',
                type: 'optionalDependency',
                source: 'backend'
              })
            }
          }
          
          // Procesar dependencias del frontend
          const frontendDependencies = []
          if (frontendPackageData?.dependencies) {
            for (const [name, version] of Object.entries(frontendPackageData.dependencies)) {
              const installedVersion = getInstalledVersion(name, path.join(process.cwd(), 'frontend-next'))
              frontendDependencies.push({
                name,
                version: version || 'N/A',
                installedVersion: installedVersion || version || 'N/A',
                type: 'dependency',
                source: 'frontend'
              })
            }
          }
          
          // Procesar devDependencies del frontend
          const frontendDevDependencies = []
          if (frontendPackageData?.devDependencies) {
            for (const [name, version] of Object.entries(frontendPackageData.devDependencies)) {
              const installedVersion = getInstalledVersion(name, path.join(process.cwd(), 'frontend-next'))
              frontendDevDependencies.push({
                name,
                version: version || 'N/A',
                installedVersion: installedVersion || version || 'N/A',
                type: 'devDependency',
                source: 'frontend'
              })
            }
          }
          
          // Información del proyecto
          const projectInfo = {
            name: packageData?.name || 'N/A',
            version: packageData?.version || 'N/A',
            description: packageData?.description || 'N/A',
            author: packageData?.author || 'N/A',
            license: packageData?.license || 'N/A',
            nodeVersion: process.version,
            npmVersion: null, // Se puede obtener con execSync si es necesario
            engines: packageData?.engines || {},
            repository: packageData?.repository || null
          }
          
          // Estadísticas
          const stats = {
            backend: {
              total: backendDependencies.length + backendDevDependencies.length + backendOptionalDependencies.length,
              dependencies: backendDependencies.length,
              devDependencies: backendDevDependencies.length,
              optionalDependencies: backendOptionalDependencies.length
            },
            frontend: {
              total: frontendDependencies.length + frontendDevDependencies.length,
              dependencies: frontendDependencies.length,
              devDependencies: frontendDevDependencies.length
            },
            total: backendDependencies.length + backendDevDependencies.length + backendOptionalDependencies.length + 
                   frontendDependencies.length + frontendDevDependencies.length
          }
          
          return json(res, 200, {
            project: projectInfo,
            stats,
            dependencies: {
              backend: {
                dependencies: backendDependencies,
                devDependencies: backendDevDependencies,
                optionalDependencies: backendOptionalDependencies
              },
              frontend: {
                dependencies: frontendDependencies,
                devDependencies: frontendDevDependencies
              }
            },
            lastUpdated: new Date().toISOString()
          })
        } catch (error) {
          console.error('Error obteniendo dependencias:', error)
          return json(res, 500, { 
            error: 'Error al obtener dependencias',
            message: error.message 
          })
        }
      }

      // Configuration Versions API
      if (pathname.includes('/versions') && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        return json(res, 200, {
          versions: [{
            id: '1',
            timestamp: new Date().toISOString(),
            userId: 'admin',
            state: 'active',
            checksum: 'abc123'
          }]
        })
      }

      // Resources Thresholds API
      if (pathname === '/api/resources/thresholds' && method === 'PUT') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const body = await readJson(req).catch(() => ({}))
        // En una implementación real, guardarías estos umbrales en la base de datos
        try {
          const { default: resourceMonitor } = await import('./resource-monitor.js')
          resourceMonitor.setThresholds(body)
          return json(res, 200, { success: true, message: 'Umbrales actualizados' })
        } catch (error) {
          console.error('Error actualizando umbrales de recursos:', error)
          return json(res, 500, { error: 'Error interno del servidor' })
        }
      }

      // Resources Export API
      if (pathname === '/api/resources/export' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const format = url.searchParams.get('format') || 'json'
        
        // Obtener datos reales del sistema
        const cpuUsage = await getCpuUsage()
        const memUsage = process.memoryUsage()
        const totalMem = os.totalmem()
        const freeMem = os.freemem()
        const usedMem = totalMem - freeMem
        const diskInfo = await getDiskUsage()
        
        const data = {
          timestamp: new Date().toISOString(),
          system: {
            hostname: os.hostname(),
            platform: os.platform(),
            arch: os.arch(),
            uptime: os.uptime(),
            loadavg: os.loadavg()
          },
          metrics: {
            cpu: {
              usage: cpuUsage,
              cores: os.cpus().length,
              model: os.cpus()[0]?.model || 'Unknown'
            },
            memory: {
              usage: (usedMem / totalMem) * 100,
              total: totalMem,
              used: usedMem,
              free: freeMem,
              process: memUsage
            },
            disk: diskInfo
          },
          process: {
            pid: process.pid,
            version: process.version,
            uptime: process.uptime(),
            cwd: process.cwd()
          }
        }
        
        if (format === 'json') {
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Content-Disposition', `attachment; filename="system-metrics-${new Date().toISOString().split('T')[0]}.json"`)
          return res.end(JSON.stringify(data, null, 2))
        }
        
        return json(res, 400, { error: 'Formato no soportado' })
      }

      // Resources Stop Monitoring API
      if (pathname === '/api/resources/stop' && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const { default: resourceMonitor } = await import('./resource-monitor.js')
          resourceMonitor.stopMonitoring()
          return json(res, 200, { success: true, message: 'Monitoreo detenido' })
        } catch (error) {
          console.error('Error deteniendo monitoreo de recursos:', error)
          return json(res, 500, { error: 'Error interno del servidor' })
        }
      }

      // Frontend (SPA) - servir dist si existe
      if (
        hasFrontend &&
        (method === 'GET' || method === 'HEAD') &&
        !pathname.startsWith('/api/') &&
        pathname !== '/api' &&
        !pathname.startsWith('/media/')
      ) {
        let relPath = pathname === '/' ? '/index.html' : pathname
        try {
          relPath = decodeURIComponent(relPath)
        } catch {}
        const rel = relPath.replace(/\\/g, '/')
        if (!rel || rel.includes('..') || rel.includes('\0')) {
          res.statusCode = 400
          res.end('Bad request')
          return
        }

        const relNoSlash = rel.replace(/^\/+/, '')
        const fileResolved = path.resolve(frontendRoot, relNoSlash)
        if (!fileResolved.toLowerCase().startsWith(frontendRootResolved.toLowerCase())) {
          res.statusCode = 400
          res.end('Bad request')
          return
        }

        let filePath = fileResolved
        if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html')
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) filePath = path.join(frontendRoot, 'index.html')
        if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
          res.statusCode = 404
          res.end('Not found')
          return
        }

        const contentType = mime.lookup(filePath) || 'application/octet-stream'
        res.statusCode = 200
        res.setHeader('Content-Type', String(contentType).startsWith('text/') ? `${contentType}; charset=utf-8` : contentType)
        res.setHeader('Cache-Control', path.basename(filePath) === 'index.html' ? 'no-cache' : 'public, max-age=31536000, immutable')
        if (method === 'HEAD') {
          res.end()
          return
        }
        fs.createReadStream(filePath).pipe(res)
        return
      }

      // ==========================================
      // ENDPOINTS PARA SISTEMAS INTEGRADOS
      // ==========================================

      // Alert System API - USANDO DATOS REALES
      if (pathname === '/api/alerts' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const alerts = alertSystem.getAllAlerts()
          const rules = alertSystem.getRules()
          return json(res, 200, { alerts, rules })
        } catch (error) {
          console.error('Error obteniendo alertas de monitoreo:', error)
          return json(res, 500, { error: 'Error interno del servidor' })
        }
      }

      if (pathname === '/api/alerts/rules' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const rules = alertSystem.getRules()
        return json(res, 200, { rules })
      }

      if (pathname === '/api/alerts/rules' && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const body = await readJson(req).catch(() => ({}))
        
        try {
          const rule = alertSystem.createRule(body)
          
          // Log de auditoría
          await logUserAction(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, req.user?.username || 'admin', {
            action: 'create_alert_rule',
            ruleName: rule.name,
            ruleType: rule.type,
            severity: rule.severity
          })
          
          return json(res, 201, { success: true, rule })
        } catch (error) {
          return json(res, 400, { error: error.message })
        }
      }

      if (pathname.startsWith('/api/alerts/') && pathname.endsWith('/acknowledge') && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })

        const alertId = decodeURIComponent(pathname.split('/')[3] || '')
        const userId = req.user?.username || 'admin'
        
        try {
          const alert = await alertSystem.acknowledgeAlert(alertId, userId)
          
          // Log de auditoría
          await logUserAction(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, userId, {
            action: 'acknowledge_alert',
            alertId,
            alertName: alert.ruleName
          })
          
          return json(res, 200, { success: true, alert })
        } catch (error) {
          return json(res, 404, { error: error.message })
        }
      }

      if (pathname.startsWith('/api/alerts/') && pathname.endsWith('/resolve') && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })

        const alertId = decodeURIComponent(pathname.split('/')[3] || '')
        const userId = req.user?.username || 'admin'

        try {
          await alertSystem.resolveAlert(alertId)
          const alert = alertSystem.getAllAlerts().find((a) => a?.id === alertId) || null

          try {
            const { emit } = await import('./socket-io.js')
            emit('alert:resolved', { alertId })
          } catch {}

          await logUserAction(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, userId, {
            action: 'resolve_alert',
            alertId,
          })

          return json(res, 200, { success: true, alert })
        } catch (error) {
          return json(res, 404, { error: error.message })
        }
      }

      if (pathname.startsWith('/api/alerts/rules/') && !pathname.endsWith('/suppress') && method === 'PATCH') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })

        const ruleId = pathname.split('/')[4]
        const body = await readJson(req).catch(() => ({}))

        try {
          const rules = alertSystem.getRules()
          const rule = rules.find((r) => r?.id === ruleId)
          if (!rule) return json(res, 404, { error: 'Rule not found' })

          if (typeof body.enabled === 'boolean') rule.enabled = body.enabled
          if (body.name) rule.name = body.name
          if (body.description) rule.description = body.description
          if (body.type) rule.type = body.type
          if (typeof body.severity === 'number') rule.severity = body.severity
          if (body.metric) rule.metric = body.metric
          if (body.condition) rule.condition = body.condition
          if (body.threshold !== undefined) rule.threshold = body.threshold
          if (typeof body.duration === 'number') rule.duration = body.duration
          if (Array.isArray(body.actions)) rule.actions = body.actions
          if (Array.isArray(body.tags)) rule.tags = body.tags

          await logUserAction(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, req.user?.username || 'admin', {
            action: 'update_alert_rule',
            ruleId,
          })

          return json(res, 200, { success: true, rule })
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      if (pathname.startsWith('/api/alerts/rules/') && pathname.endsWith('/suppress') && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const ruleId = pathname.split('/')[4]
        const body = await readJson(req).catch(() => ({}))
        const duration = Number(body.duration) || 3600 // 1 hora por defecto
        
        try {
          const rule = alertSystem.suppressRule(ruleId, duration)
          
          // Log de auditoría
          await logUserAction(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, req.user?.username || 'admin', {
            action: 'suppress_alert_rule',
            ruleId,
            ruleName: rule.name,
            duration
          })
          
          return json(res, 200, { success: true, rule })
        } catch (error) {
          return json(res, 404, { error: error.message })
        }
      }

      // Task Scheduler API
      if (pathname === '/api/tasks' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const tasks = taskScheduler.getAllTasks()
        const runningIds = typeof taskScheduler.getRunningTasks === 'function' ? taskScheduler.getRunningTasks() : []
        const runningSet = new Set((Array.isArray(runningIds) ? runningIds : []).map((id) => String(id)))
        const activeTasks = tasks.filter((t) => runningSet.has(String(t?.id)))
        
        return json(res, 200, {
          tasks,
          active: activeTasks,
          count: {
            total: tasks.length,
            active: activeTasks.length
          }
        })
      }

      if (pathname === '/api/tasks' && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const body = await readJson(req).catch(() => ({}))
        
        try {
          const task = await taskScheduler.scheduleTask(body)
          
          // Log de auditoría
          await logUserAction(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, req.user?.username || 'admin', {
            action: 'create_scheduled_task',
            taskName: task.name,
            taskType: task.type,
            schedule: task.schedule
          })
          
          return json(res, 201, { success: true, task })
        } catch (error) {
          return json(res, 400, { error: error.message })
        }
      }

      if (pathname.startsWith('/api/tasks/') && method === 'DELETE') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const taskId = pathname.split('/')[3]
        
        try {
          const result = await taskScheduler.cancelTask(taskId)
          
          // Log de auditoría
          await logUserAction(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, req.user?.username || 'admin', {
            action: 'cancel_scheduled_task',
            taskId
          })
          
          return json(res, 200, { success: true, result })
        } catch (error) {
          return json(res, 404, { error: error.message })
        }
      }

      if (pathname.startsWith('/api/tasks/') && pathname.endsWith('/execute') && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const taskId = pathname.split('/')[3]
        
        if (!panelDb.tasks || !panelDb.tasks[taskId]) {
          return json(res, 404, { error: 'Tarea no encontrada' })
        }
        
        const task = panelDb.tasks[taskId]
        
        // Create execution record
        const execution = {
          id: `exec-${Date.now()}`,
          taskId,
          taskName: task.name,
          startTime: new Date().toISOString(),
          status: 'running',
          duration: 0,
          manual: true
        }
        
        // Initialize executions if not exists
        if (!panelDb.taskExecutions) panelDb.taskExecutions = []
        panelDb.taskExecutions.unshift(execution)
        
        // Update task status
        task.status = 'running'
        task.lastExecution = execution
        
        // Ejecutar tarea real usando el task scheduler
        try {
          const result = await taskScheduler.executeTask(taskId)
          const endTime = new Date().toISOString()
          const duration = Date.now() - new Date(execution.startTime).getTime()
          
          execution.endTime = endTime
          execution.status = result?.success !== false ? 'completed' : 'failed'
          execution.duration = duration
          execution.result = result
          
          if (result?.success === false || result?.error) {
            execution.error = result?.error || result?.message || 'Error en la ejecución de la tarea'
            task.errorCount = (task.errorCount || 0) + 1
          } else {
            task.successCount = (task.successCount || 0) + 1
          }
          
          task.status = execution.status
          task.lastExecution = execution
          
          // Emit real-time update
          try {
            const { emitNotification } = await import('./socket-io.js')
            emitNotification({
              type: execution.status === 'completed' ? 'success' : 'error',
              title: `Tarea ${execution.status === 'completed' ? 'Completada' : 'Fallida'}`,
              message: `${task.name} ${execution.status === 'completed' ? 'se ejecutó correctamente' : 'falló durante la ejecución'}`,
              data: { taskId, execution }
            })
          } catch (err) {
            console.warn('Could not emit notification:', err.message)
          }
        } catch (error) {
          const endTime = new Date().toISOString()
          const duration = Date.now() - new Date(execution.startTime).getTime()
          
          execution.endTime = endTime
          execution.status = 'failed'
          execution.duration = duration
          execution.error = error.message || 'Error ejecutando la tarea'
          
          task.errorCount = (task.errorCount || 0) + 1
          task.status = 'failed'
          task.lastExecution = execution
          
          console.error('Error ejecutando tarea:', error)
        }
        
        // Log de auditoría
        try {
          await logUserAction(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, 'admin', {
            action: 'execute_task_manually',
            taskId,
            taskName: task.name
          })
        } catch (err) {
          console.warn('Could not log audit:', err.message)
        }
        
        return json(res, 200, { 
          success: true, 
          message: 'Tarea iniciada correctamente',
          execution: {
            id: execution.id,
            status: 'running',
            startTime: execution.startTime
          }
        })
      }

      // Update task (enable/disable, modify settings)
      if (pathname.startsWith('/api/tasks/') && !pathname.includes('/execute') && method === 'PATCH') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const taskId = pathname.split('/')[3]
        const body = await readJson(req).catch(() => ({}))
        
        if (!panelDb.tasks || !panelDb.tasks[taskId]) {
          return json(res, 404, { error: 'Tarea no encontrada' })
        }
        
        const task = panelDb.tasks[taskId]
        
        // Update task properties
        if (typeof body.enabled === 'boolean') {
          task.enabled = body.enabled
          task.status = body.enabled ? 'pending' : 'paused'
        }
        
        if (body.name) task.name = body.name
        if (body.description) task.description = body.description
        if (body.schedule) task.schedule = body.schedule
        if (typeof body.priority === 'number') task.priority = body.priority
        
        // Log de auditoría
        try {
          await logUserAction(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, 'admin', {
            action: 'update_task',
            taskId,
            taskName: task.name,
            changes: body
          })
        } catch (err) {
          console.warn('Could not log audit:', err.message)
        }
        
        // Emit real-time update
        try {
          const { emitNotification } = await import('./socket-io.js')
          emitNotification({
            type: 'info',
            title: 'Tarea Actualizada',
            message: `${task.name} ha sido ${task.enabled ? 'habilitada' : 'pausada'}`,
            data: { taskId, task }
          })
        } catch (err) {
          console.warn('Could not emit notification:', err.message)
        }
        
        return json(res, 200, { 
          success: true, 
          message: 'Tarea actualizada correctamente',
          task 
        })
      }

      // Backup System API
      if (pathname === '/api/backups' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const backups = await backupSystem.listBackups()
        const config = backupSystem.getConfig()
        
        return json(res, 200, {
          backups,
          config,
          count: backups.length
        })
      }

      if (pathname === '/api/backups' && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const body = await readJson(req).catch(() => ({}))
        const type = body.type || 'manual'
        const description = body.description || 'Backup manual desde panel'
        
        try {
          const backup = await backupSystem.createBackup(type, { description })
          
          // Log de auditoría
          await logUserAction(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, req.user?.username || 'admin', {
            action: 'create_backup',
            backupType: type,
            backupId: backup.id
          })
          
          return json(res, 201, { success: true, backup })
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      if (pathname.startsWith('/api/backups/') && pathname.endsWith('/restore') && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const backupId = pathname.split('/')[3]
        
        try {
          const result = await backupSystem.restoreBackup(backupId)
          
          // Log de auditoría crítica
          await logUserAction(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, req.user?.username || 'admin', {
            action: 'restore_backup',
            backupId,
            critical: true
          })
          
          return json(res, 200, { success: true, result })
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      if (pathname.startsWith('/api/backups/') && method === 'DELETE') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const backupId = pathname.split('/')[3]
        
        try {
          const result = await backupSystem.deleteBackup(backupId)
          
          // Log de auditoría
          await logUserAction(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, req.user?.username || 'admin', {
            action: 'delete_backup',
            backupId
          })
          
          return json(res, 200, { success: true, result })
        } catch (error) {
          return json(res, 404, { error: error.message })
        }
      }

      // Notification System API - Datos reales desde panelDb
      if (pathname === '/api/notifications' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const page = clampInt(url.searchParams.get('page'), { min: 1, fallback: 1 })
        const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 100, fallback: 20 })
        const category = url.searchParams.get('category') || null
        const search = url.searchParams.get('search') || null
        const type = url.searchParams.get('type') || null
        const read = url.searchParams.get('read') || null
        
        // Obtener notificaciones reales del panel
        const allNotifications = Object.values(panelDb?.notifications || {})
        
        // Filtrar por categoría
        let filtered = allNotifications
        if (category && category !== 'all') {
          filtered = filtered.filter(n => n?.categoria === category)
        }
        
        // Filtrar por tipo
        if (type && type !== 'all') {
          filtered = filtered.filter(n => n?.tipo === type)
        }
        
        // Filtrar por estado de lectura
        if (read && read !== 'all') {
          const isRead = read === 'true' || read === '1'
          filtered = filtered.filter(n => {
            const leida = n?.leida === true || n?.read === true
            return isRead ? leida : !leida
          })
        }
        
        // Filtrar por búsqueda
        if (search) {
          const searchLower = search.toLowerCase()
          filtered = filtered.filter(n => 
            (n?.titulo || '').toLowerCase().includes(searchLower) ||
            (n?.mensaje || '').toLowerCase().includes(searchLower) ||
            (n?.title || '').toLowerCase().includes(searchLower) ||
            (n?.message || '').toLowerCase().includes(searchLower)
          )
        }
        
        // Ordenar por fecha (más recientes primero)
        filtered.sort((a, b) => {
          const dateA = new Date(a?.fecha || a?.created_at || a?.timestamp || 0).getTime()
          const dateB = new Date(b?.fecha || b?.created_at || b?.timestamp || 0).getTime()
          return dateB - dateA
        })
        
        // Paginación
        const total = filtered.length
        const totalPages = Math.ceil(total / limit)
        const start = (page - 1) * limit
        const end = start + limit
        const paginated = filtered.slice(start, end)
        
        return json(res, 200, {
          notifications: paginated,
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages
        })
      }

      if (pathname === '/api/notifications' && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const body = await readJson(req).catch(() => ({}))
        
        try {
          const notification = await notificationSystem.send(body)
          
          // Log de auditoría
          await logUserAction(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, req.user?.username || 'admin', {
            action: 'send_notification',
            notificationType: body.type,
            category: body.category
          })
          
          return json(res, 201, { success: true, notification })
        } catch (error) {
          return json(res, 400, { error: error.message })
        }
      }

      if (pathname.startsWith('/api/notifications/') && pathname.endsWith('/read') && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const notificationId = pathname.split('/')[3]
        
        try {
          // Marcar como leída usando datos reales del panel
          if (panelDb?.notifications?.[notificationId]) {
            panelDb.notifications[notificationId].leida = true
            panelDb.notifications[notificationId].read = true
            panelDb.notifications[notificationId].fecha_lectura = new Date().toISOString()
            panelDb.notifications[notificationId].read_at = new Date().toISOString()
            
            return json(res, 200, { 
              success: true, 
              notification: panelDb.notifications[notificationId]
            })
          } else {
            return json(res, 404, { error: 'Notificación no encontrada' })
          }
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      if (pathname === '/api/notifications/templates' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          // Obtener templates reales del sistema de notificaciones
          const templates = []
          
          if (notificationSystem && notificationSystem.templates) {
            for (const [id, template] of notificationSystem.templates.entries()) {
              templates.push({
                id,
                name: template.title || id,
                description: template.message || '',
                type: template.type || 'info',
                category: template.category || 'system',
                priority: template.priority || 2,
                channels: template.channels || []
              })
            }
          } else {
            // Fallback: templates básicos si el sistema no está disponible
            templates.push(
              { id: 'bot_connected', name: 'Bot Conectado', description: 'Notificación cuando el bot se conecta', type: 'success', category: 'bot' },
              { id: 'bot_disconnected', name: 'Bot Desconectado', description: 'Notificación cuando el bot se desconecta', type: 'error', category: 'bot' },
              { id: 'system_error', name: 'Error del Sistema', description: 'Notificación de errores críticos', type: 'critical', category: 'system' },
              { id: 'command_error', name: 'Error en Comando', description: 'Error ejecutando un comando', type: 'warning', category: 'command' },
              { id: 'security_alert', name: 'Alerta de Seguridad', description: 'Actividad sospechosa detectada', type: 'critical', category: 'security' }
            )
          }
          
          return json(res, 200, { templates })
        } catch (error) {
          console.error('Error obteniendo templates:', error)
          return json(res, 500, { error: 'Error al obtener templates' })
        }
      }

      // Analytics API (para el dashboard de analytics)
      if (pathname === '/api/analytics/stats' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const timeRange = url.searchParams.get('range') || '24h'
        
        try {
          // Recopilar métricas del sistema de alertas
          const alertMetrics = await alertSystem.collectMetrics()
          
          // Estadísticas de comandos
          const commandStats = {
            totalToday: alertMetrics.command_success_rate || 0,
            totalYesterday: 0, // Implementar historial
            errorRate: alertMetrics.command_errors_rate || 0,
            errorRateYesterday: 0,
            hourlyData: [], // Implementar datos por hora
            hourlyErrors: [],
            topCommands: [],
            responseTimeData: []
          }
          
          // Estadísticas de usuarios
          const userStats = {
            activeToday: alertMetrics.active_users_count || 0,
            activeYesterday: 0,
            hourlyActivity: []
          }
          
          // Estadísticas de grupos
          const groupStats = {
            activeToday: Object.keys(panelDb?.groups || {}).length,
            activeYesterday: 0,
            hourlyActivity: []
          }
          
          return json(res, 200, {
            commandStats,
            userStats,
            groupStats,
            systemMetrics: alertMetrics,
            timeRange
          })
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      // Bot Stats API (para analytics)
      if (pathname === '/api/bot/stats' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const metrics = await alertSystem.collectMetrics()
          
          // Obtener datos reales de comandos desde audit logs
          const auditLogs = panelDb?.auditLogs || []
          const now = new Date()
          const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)
          
          // Comandos de hoy y ayer
          const commandsToday = auditLogs.filter(log => 
            log.event === AUDIT_EVENTS.BOT_COMMAND_EXECUTED &&
            new Date(log.timestamp) >= oneDayAgo
          )
          
          const commandsYesterday = auditLogs.filter(log => 
            log.event === AUDIT_EVENTS.BOT_COMMAND_EXECUTED &&
            new Date(log.timestamp) >= twoDaysAgo &&
            new Date(log.timestamp) < oneDayAgo
          )
          
          // Errores de comandos
          const errorsToday = commandsToday.filter(log => 
            log.metadata && !log.metadata.success
          )
          
          const errorsYesterday = commandsYesterday.filter(log => 
            log.metadata && !log.metadata.success
          )
          
          // Generar datos por hora de las últimas 24 horas
          const hourlyData = []
          const hourlyErrors = []
          const responseTimeData = []
          
          for (let i = 23; i >= 0; i--) {
            const hour = new Date(now.getTime() - i * 60 * 60 * 1000)
            const nextHour = new Date(hour.getTime() + 60 * 60 * 1000)
            const hourLabel = hour.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
            
            const hourCommands = commandsToday.filter(log => {
              const logTime = new Date(log.timestamp)
              return logTime >= hour && logTime < nextHour
            })
            
            const hourErrors = errorsToday.filter(log => {
              const logTime = new Date(log.timestamp)
              return logTime >= hour && logTime < nextHour
            })
            
            hourlyData.push({
              hour: hourLabel,
              count: hourCommands.length,
              timestamp: hour.toISOString()
            })
            
            hourlyErrors.push({
              hour: hourLabel,
              count: hourErrors.length,
              timestamp: hour.toISOString()
            })
            
            // Tiempo de respuesta promedio para esta hora
            const responseTimes = hourCommands
              .filter(log => log.metadata?.responseTime)
              .map(log => log.metadata.responseTime)
            
            const avgResponseTime = responseTimes.length > 0 
              ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
              : 0
            
            responseTimeData.push({
              hour: hourLabel,
              value: Math.round(avgResponseTime),
              timestamp: hour.toISOString()
            })
          }
          
          // Top comandos más usados
          const commandCounts = {}
          commandsToday.forEach(log => {
            const command = log.metadata?.command || 'unknown'
            commandCounts[command] = (commandCounts[command] || 0) + 1
          })
          
          const topCommands = Object.entries(commandCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([command, count]) => ({ command, count }))
          
          const errorRate = commandsToday.length > 0 
            ? (errorsToday.length / commandsToday.length) * 100 
            : 0
          
          const errorRateYesterday = commandsYesterday.length > 0 
            ? (errorsYesterday.length / commandsYesterday.length) * 100 
            : 0
          
          return json(res, 200, {
            totalToday: commandsToday.length,
            totalYesterday: commandsYesterday.length,
            errorRate: Math.round(errorRate * 100) / 100,
            errorRateYesterday: Math.round(errorRateYesterday * 100) / 100,
            successRate: Math.round((100 - errorRate) * 100) / 100,
            hourlyData,
            hourlyErrors,
            topCommands,
            responseTimeData,
            averageResponseTime: metrics.response_time_avg || 0
          })
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      // Usuario Stats API (para analytics)
      if (pathname === '/api/usuarios/stats' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const metrics = await alertSystem.collectMetrics()
          const usuarios = Object.values(panelDb?.users || {})
          const auditLogs = panelDb?.auditLogs || []
          
          const now = new Date()
          const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)
          
          // Usuarios activos (con login en las últimas 24 horas)
          const activeToday = usuarios.filter(u => 
            u.last_login && new Date(u.last_login) >= oneDayAgo
          ).length
          
          const activeYesterday = usuarios.filter(u => 
            u.last_login && 
            new Date(u.last_login) >= twoDaysAgo && 
            new Date(u.last_login) < oneDayAgo
          ).length
          
          // Nuevos usuarios
          const newToday = usuarios.filter(u => 
            u.fecha_registro && new Date(u.fecha_registro) >= oneDayAgo
          ).length
          
          const newYesterday = usuarios.filter(u => 
            u.fecha_registro && 
            new Date(u.fecha_registro) >= twoDaysAgo && 
            new Date(u.fecha_registro) < oneDayAgo
          ).length
          
          // Actividad por hora basada en logs de login
          const hourlyActivity = []
          for (let i = 23; i >= 0; i--) {
            const hour = new Date(now.getTime() - i * 60 * 60 * 1000)
            const nextHour = new Date(hour.getTime() + 60 * 60 * 1000)
            const hourLabel = hour.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
            
            const hourLogins = auditLogs.filter(log => 
              log.event === AUDIT_EVENTS.LOGIN_SUCCESS &&
              new Date(log.timestamp) >= hour &&
              new Date(log.timestamp) < nextHour
            )
            
            hourlyActivity.push({
              hour: hourLabel,
              count: hourLogins.length,
              timestamp: hour.toISOString()
            })
          }
          
          return json(res, 200, {
            total: usuarios.length,
            activeToday,
            activeYesterday,
            newToday,
            newYesterday,
            hourlyActivity,
            byRole: {
              owner: usuarios.filter(u => u.rol === 'owner').length,
              admin: usuarios.filter(u => u.rol === 'admin' || u.rol === 'administrador').length,
              moderador: usuarios.filter(u => u.rol === 'moderador').length,
              usuario: usuarios.filter(u => u.rol === 'usuario').length
            }
          })
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      // Group Stats API (para analytics)
      if (pathname === '/api/grupos/stats' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          await syncGroupsOnDemand(panelDb).catch(() => {})
          const grupos = Object.values(panelDb?.groups || {})
          const auditLogs = panelDb?.auditLogs || []
          
          const now = new Date()
          const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
          const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)
          
          // Grupos activos (con actividad reciente)
          const activeToday = auditLogs.filter(log => 
            log.event === AUDIT_EVENTS.BOT_COMMAND_EXECUTED &&
            log.metadata?.groupId &&
            new Date(log.timestamp) >= oneDayAgo
          ).map(log => log.metadata.groupId)
          
          const uniqueActiveToday = [...new Set(activeToday)].length
          
          const activeYesterday = auditLogs.filter(log => 
            log.event === AUDIT_EVENTS.BOT_COMMAND_EXECUTED &&
            log.metadata?.groupId &&
            new Date(log.timestamp) >= twoDaysAgo &&
            new Date(log.timestamp) < oneDayAgo
          ).map(log => log.metadata.groupId)
          
          const uniqueActiveYesterday = [...new Set(activeYesterday)].length
          
          // Actividad por hora
          const hourlyActivity = []
          for (let i = 23; i >= 0; i--) {
            const hour = new Date(now.getTime() - i * 60 * 60 * 1000)
            const nextHour = new Date(hour.getTime() + 60 * 60 * 1000)
            const hourLabel = hour.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
            
            const hourGroups = auditLogs.filter(log => 
              log.event === AUDIT_EVENTS.BOT_COMMAND_EXECUTED &&
              log.metadata?.groupId &&
              new Date(log.timestamp) >= hour &&
              new Date(log.timestamp) < nextHour
            ).map(log => log.metadata.groupId)
            
            const uniqueHourGroups = [...new Set(hourGroups)].length
            
            hourlyActivity.push({
              hour: hourLabel,
              count: uniqueHourGroups,
              timestamp: hour.toISOString()
            })
          }
          
          const activeGroups = grupos.filter(g => g.bot_enabled !== false)
          const providerGroups = grupos.filter(g => g.es_proveedor === true)
          
          return json(res, 200, {
            total: grupos.length,
            activeToday: uniqueActiveToday,
            activeYesterday: uniqueActiveYesterday,
            botEnabled: activeGroups.length,
            botDisabled: grupos.length - activeGroups.length,
            providers: providerGroups.length,
            hourlyActivity,
            byType: {
              normal: grupos.length - providerGroups.length,
              proveedor: providerGroups.length
            }
          })
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      if (pathname === '/api/analytics/export' && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const body = await readJson(req).catch(() => ({}))
        const format = body.format || 'json'
        const timeRange = body.timeRange || '24h'
        
        try {
          // Generar datos de exportación
          const exportData = {
            timestamp: new Date().toISOString(),
            timeRange,
            format,
            data: {
              alerts: alertSystem.getAllAlerts(),
              tasks: taskScheduler.getAllTasks(),
              notifications: Object.values(panelDb?.notifications || {}).slice(0, 10), // Últimas 10 notificaciones reales
              systemMetrics: await alertSystem.collectMetrics()
            }
          }
          
          // Log de auditoría
          await logUserAction(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, req.user?.username || 'admin', {
            action: 'export_analytics_data',
            format,
            timeRange
          })
          
          return json(res, 200, { success: true, data: exportData })
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      // Audit Logs API
      if (pathname === '/api/audit/logs' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const page = clampInt(url.searchParams.get('page'), { min: 1, fallback: 1 })
        const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 100, fallback: 50 })
        const level = url.searchParams.get('level') || null
        const event = url.searchParams.get('event') || null
        
        const logs = await auditLogger.getLogs({ page, limit, level, event })
        
        return json(res, 200, logs)
      }

      if (pathname === '/api/audit/stats' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const stats = await auditLogger.getStats()
        return json(res, 200, stats)
      }

      // System Health API
      if (pathname === '/api/system/health' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const metrics = await alertSystem.collectMetrics()
          const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            memory: {
              usage: metrics.memory_usage_percent || 0,
              heapUsed: metrics.memory_heap_used || 0,
              heapTotal: metrics.memory_heap_total || 0
            },
            bot: {
              connected: metrics.bot_connected || false,
              uptime: metrics.bot_uptime || 0
            },
            system: {
              cpu: metrics.cpu_usage_percent || 0,
              disk: metrics.disk_usage_percent || 0,
              responseTime: metrics.response_time_avg || 0
            },
            alerts: {
              active: alertSystem.getActiveAlerts().length,
              total: alertSystem.getAllAlerts().length
            },
            tasks: {
              active: (typeof taskScheduler.getRunningTasks === 'function' ? taskScheduler.getRunningTasks() : []).length,
              total: taskScheduler.getAllTasks().length
            }
          }
          
          // Determinar estado general
          if (metrics.memory_usage_percent > 90 || metrics.disk_usage_percent > 95) {
            health.status = 'critical'
          } else if (metrics.memory_usage_percent > 80 || metrics.disk_usage_percent > 85) {
            health.status = 'warning'
          }
          
          return json(res, 200, health)
        } catch (error) {
          return json(res, 500, { 
            status: 'error',
            error: error.message,
            timestamp: new Date().toISOString()
          })
        }
      }

      // Log Management API
      if (pathname === '/api/logs/stats' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const logs = Array.isArray(panelDb?.logs) ? panelDb.logs : []
          const todayKey = new Date().toISOString().slice(0, 10)
          const logsToday = logs.filter((l) => String(l?.fecha || l?.timestamp || '').slice(0, 10) === todayKey).length

          const levels = { error: 0, warn: 0, info: 0, debug: 0, trace: 0 }
          let lastLogTime = null
          for (const l of logs) {
            const raw = safeString(l?.nivel || l?.level || '').toLowerCase()
            const lvl = Object.prototype.hasOwnProperty.call(levels, raw) ? raw : 'info'
            levels[lvl]++

            const t = new Date(l?.fecha || l?.timestamp || 0).getTime()
            if (Number.isFinite(t) && t > 0) {
              if (!lastLogTime || t > new Date(lastLogTime).getTime()) lastLogTime = new Date(t).toISOString()
            }
          }

          const computeDirSize = (dir) => {
            try {
              if (!fs.existsSync(dir)) return { totalSize: 0, fileCount: 0 }
              let totalSize = 0
              let fileCount = 0
              const walk = (d) => {
                const entries = fs.readdirSync(d, { withFileTypes: true })
                for (const e of entries) {
                  const p = path.join(d, e.name)
                  if (e.isDirectory()) walk(p)
                  else {
                    const st = fs.statSync(p)
                    totalSize += st.size
                    fileCount++
                  }
                }
              }
              walk(dir)
              return { totalSize, fileCount }
            } catch {
              return { totalSize: 0, fileCount: 0 }
            }
          }

          const humanBytes = (bytes) => {
            const n = Number(bytes) || 0
            if (n <= 0) return '0 B'
            const units = ['B', 'KB', 'MB', 'GB', 'TB']
            const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)))
            return `${(n / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`
          }

          const { totalSize, fileCount } = computeDirSize(path.join(process.cwd(), 'logs'))

          return json(res, 200, {
            totalLogs: logs.length,
            logsToday,
            errorCount: levels.error,
            warnCount: levels.warn,
            infoCount: levels.info,
            debugCount: levels.debug,
            traceCount: levels.trace,
            filesCreated: 0,
            filesRotated: 0,
            filesCompressed: 0,
            lastLogTime: lastLogTime || null,
            uptime: Math.round(process.uptime() * 1000),
            bufferSize: logs.length,
            activeStreams: 0,
            diskUsage: {
              totalSize,
              fileCount,
              formattedSize: humanBytes(totalSize),
            },
          })
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      if (pathname === '/api/logs/search' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const query = url.searchParams.get('query') || ''
          const level = url.searchParams.get('level') || null
          const category = url.searchParams.get('category') || null
          const startDate = url.searchParams.get('startDate') || null
          const endDate = url.searchParams.get('endDate') || null
          const limit = parseInt(url.searchParams.get('limit') || '50')
          const page = parseInt(url.searchParams.get('page') || '1')
          
          const { default: logManager } = await import('./log-manager.js')
          const logs = await logManager.searchLogs(query, {
            level,
            category,
            startDate,
            endDate,
            limit: limit * page, // Cargar hasta la página solicitada
            includeArchived: true
          })
          
          // Paginar resultados
          const startIndex = (page - 1) * limit
          const paginatedLogs = logs.slice(startIndex, startIndex + limit)
          
          return json(res, 200, {
            logs: paginatedLogs,
            total: logs.length,
            page,
            limit,
            totalPages: Math.ceil(logs.length / limit)
          })
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      if (pathname === '/api/logs/export' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const format = url.searchParams.get('format') || 'json'
          const category = url.searchParams.get('category') || null
          const startDate = url.searchParams.get('startDate') || null
          const endDate = url.searchParams.get('endDate') || null
          
          const { default: logManager } = await import('./log-manager.js')
          const data = await logManager.exportLogs({
            format,
            category,
            startDate,
            endDate,
            includeArchived: true
          })
          
          const contentType = format === 'csv' ? 'text/csv' : 
                            format === 'txt' ? 'text/plain' : 'application/json'
          const filename = `logs-${new Date().toISOString().split('T')[0]}.${format}`
          
          res.setHeader('Content-Type', contentType)
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
          return res.end(data)
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      if (pathname === '/api/logs/clear' && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const { default: logManager } = await import('./log-manager.js')
          
          // Limpiar logs (esto requiere implementar el método en LogManager)
          await logManager.clearAllLogs()
          
          // Log de auditoría
          await logUserAction(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, req.user?.username || 'admin', {
            action: 'clear_logs',
            timestamp: new Date().toISOString()
          })
          
          return json(res, 200, { success: true, message: 'Logs limpiados correctamente' })
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      if (pathname === '/api/logs/config' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const { default: logManager } = await import('./log-manager.js')
          const config = logManager.config
          return json(res, 200, { config })
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      if (pathname === '/api/logs/config' && method === 'PUT') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const body = await readJson(req).catch(() => ({}))
          const { default: logManager } = await import('./log-manager.js')
          
          logManager.configure(body)
          
          // Log de auditoría
          await logUserAction(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, req.user?.username || 'admin', {
            action: 'update_log_config',
            config: body
          })
          
          return json(res, 200, { success: true, message: 'Configuración actualizada' })
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      // Resource Monitoring API
      if (pathname === '/api/resources/stats' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const { default: resourceMonitor } = await import('./resource-monitor.js')
          const stats = resourceMonitor.getStats()
          return json(res, 200, stats)
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      if (pathname === '/api/resources/start' && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const body = await readJson(req).catch(() => ({}))
          const { interval = 5000 } = body
          
          const { default: resourceMonitor } = await import('./resource-monitor.js')
          resourceMonitor.startMonitoring(interval)
          
          return json(res, 200, { success: true, message: 'Monitoreo iniciado' })
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      if (pathname === '/api/resources/stop' && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const { default: resourceMonitor } = await import('./resource-monitor.js')
          resourceMonitor.stopMonitoring()
          
          return json(res, 200, { success: true, message: 'Monitoreo detenido' })
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      if (pathname === '/api/resources/history' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const limit = url.searchParams.get('limit')
          const { default: resourceMonitor } = await import('./resource-monitor.js')
          const history = resourceMonitor.getHistoricalData(limit ? parseInt(limit) : null)
          
          return json(res, 200, { history })
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      if (pathname === '/api/resources/thresholds' && method === 'PUT') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const body = await readJson(req).catch(() => ({}))
          const { default: resourceMonitor } = await import('./resource-monitor.js')
          resourceMonitor.setThresholds(body)
          
          return json(res, 200, { success: true, message: 'Umbrales actualizados' })
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      if (pathname === '/api/resources/export' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const format = url.searchParams.get('format') || 'json'
          const { default: resourceMonitor } = await import('./resource-monitor.js')
          const data = resourceMonitor.exportMetrics(format)
          
          const contentType = format === 'csv' ? 'text/csv' : 'application/json'
          const filename = `resource-metrics-${new Date().toISOString().split('T')[0]}.${format}`
          
          res.setHeader('Content-Type', contentType)
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
          return res.end(data)
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      if (pathname === '/api/resources/clear-history' && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const { default: resourceMonitor } = await import('./resource-monitor.js')
          resourceMonitor.clearHistory()
          
          return json(res, 200, { success: true, message: 'Historial limpiado' })
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      // System Reports Generate API
      if (pathname === '/api/system/reports/generate' && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const body = await readJson(req).catch(() => ({}))
          const { type = 'daily' } = body
          
          // Generar reporte basado en el tipo
          const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
          const timestamp = new Date().toISOString()
          
          let reportData = {}
          let title = 'Reporte del Sistema'
          
          switch (type) {
            case 'daily':
              title = 'Reporte Diario del Sistema'
              reportData = {
                date: new Date().toISOString().split('T')[0],
                systemMetrics: {
                  cpu: process.cpuUsage(),
                  memory: process.memoryUsage(),
                  uptime: process.uptime()
                },
                logs: (panelDb?.logs || []).filter(log => 
                  log.fecha && log.fecha.startsWith(new Date().toISOString().split('T')[0])
                ).length,
                alerts: Object.values(panelDb?.alerts || {}).filter(alert => !alert.resolved).length
              }
              break
              
            case 'performance':
              title = 'Reporte de Rendimiento'
              try {
                const { default: resourceMonitor } = await import('./resource-monitor.js')
                const history = resourceMonitor.getHistoricalData(1440) || []
                const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)
                const max = (arr) => (arr.length ? Math.max(...arr) : 0)

                const cpuVals = history.map((h) => Number(h?.cpu) || 0)
                const memVals = history.map((h) => Number(h?.memory) || 0)
                const avgCpu = avg(cpuVals)
                const avgMem = avg(memVals)
                const peakMem = max(memVals)

                const panelLogs = Array.isArray(panelDb?.logs) ? panelDb.logs : []
                const since = Date.now() - 24 * 60 * 60 * 1000
                const recentCmds = panelLogs.filter((l) => l?.tipo === 'comando' && new Date(l?.fecha || 0).getTime() >= since)
                const responseTimes = recentCmds.map((l) => Number(l?.metadata?.responseTime)).filter((n) => Number.isFinite(n) && n >= 0)
                const avgResponse = responseTimes.length ? Math.round(avg(responseTimes)) : 0
                const throughput = recentCmds.length

                reportData = {
                  period: '24h',
                  avgCpuUsage: Math.round(avgCpu * 100) / 100,
                  avgMemoryUsage: Math.round(avgMem * 100) / 100,
                  peakMemory: Math.round(peakMem * 100) / 100,
                  responseTime: avgResponse,
                  throughput,
                }
              } catch {
                reportData = {
                  period: '24h',
                  avgCpuUsage: 0,
                  avgMemoryUsage: 0,
                  peakMemory: 0,
                  responseTime: 0,
                  throughput: 0,
                }
              }
              break
              
            case 'security':
              title = 'Reporte de Seguridad'
              {
                const auditLogs = Array.isArray(panelDb?.auditLogs) ? panelDb.auditLogs : []
                const since = Date.now() - 24 * 60 * 60 * 1000
                const failedLogins = auditLogs.filter((l) => {
                  const t = new Date(l?.timestamp || 0).getTime()
                  if (!Number.isFinite(t) || t < since) return false
                  const ev = String(l?.event || l?.action || '').toLowerCase()
                  return ev.includes('login') && (ev.includes('fail') || ev.includes('failed') || String(l?.success) === 'false')
                }).length

                const securityAlerts = Array.isArray(alertSystem?.getActiveAlerts?.()) ? alertSystem.getActiveAlerts().length : 0

                reportData = {
                  period: '24h',
                  failedLogins,
                  blockedIPs: 0,
                  securityAlerts,
                  lastSecurityScan: timestamp,
                }
              }
              break
              
            default:
              reportData = { message: 'Tipo de reporte no soportado' }
          }
          
          // Guardar el reporte generado
          panelDb.systemReports ||= {}
          panelDb.systemReports[reportId] = {
            id: reportId,
            type,
            title,
            generatedAt: timestamp,
            size: JSON.stringify(reportData).length,
            status: 'completed',
            data: reportData
          }
          
          // Log de auditoría
          await logUserAction(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, req.user?.username || 'admin', {
            action: 'generate_system_report',
            reportType: type,
            reportId
          })
          
          return json(res, 200, { 
            success: true, 
            message: 'Reporte generado exitosamente',
            reportId,
            report: panelDb.systemReports[reportId]
          })
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      // System Restart APIs
      if (pathname.startsWith('/api/system/') && pathname.endsWith('/restart') && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const systemName = pathname.split('/')[3] // Extract system name from path
          
          // Log de auditoría
          await logUserAction(AUDIT_EVENTS.SYSTEM_CONFIG_CHANGED, req.user?.username || 'admin', {
            action: 'restart_system',
            systemName,
            timestamp: new Date().toISOString()
          })
          
          // Reinicio del sistema específico
          let supported = true
          let restarted = false
          let details = null

          switch (systemName) {
            case 'metrics':
              // Reiniciar sistema de métricas
              try {
                const { default: resourceMonitor } = await import('./resource-monitor.js')
                const interval = Number(resourceMonitor?.updateInterval) || 5000
                if (typeof resourceMonitor?.stopMonitoring === 'function') resourceMonitor.stopMonitoring()
                if (typeof resourceMonitor?.incrementRestarts === 'function') resourceMonitor.incrementRestarts()
                if (typeof resourceMonitor?.startMonitoring === 'function') resourceMonitor.startMonitoring(interval)
                restarted = true
              } catch (err) {
                supported = false
                details = err?.message || String(err)
              }
              break
              
            case 'alerts':
              // Reiniciar sistema de alertas
              try {
                const { default: alertSystem } = await import('./alert-system.js')
                if (typeof alertSystem?.restart === 'function') {
                  alertSystem.restart()
                  restarted = true
                } else {
                  supported = false
                  details = 'Alert system no expone un método de restart'
                }
              } catch (err) {
                supported = false
                details = err?.message || String(err)
              }
              break
              
            case 'logManager':
              // Reiniciar sistema de logs
              try {
                const { default: logManager } = await import('./log-manager.js')
                if (typeof logManager?.restart === 'function') {
                  logManager.restart()
                  restarted = true
                } else {
                  supported = false
                  details = 'Log manager está deshabilitado/no soporta restart'
                }
              } catch (err) {
                supported = false
                details = err?.message || String(err)
              }
              break
              
            case 'backupSystem':
              // Reiniciar sistema de backups
              try {
                const { default: backupSystem } = await import('./backup-system.js')
                if (typeof backupSystem?.restart === 'function') {
                  backupSystem.restart()
                  restarted = true
                } else {
                  supported = false
                  details = 'Backup system no expone un método de restart'
                }
              } catch (err) {
                supported = false
                details = err?.message || String(err)
              }
              break
              
            default:
              return json(res, 400, { error: 'Sistema no reconocido' })
          }
          
          if (!supported) {
            return json(res, 501, {
              success: false,
              error: 'Restart no soportado para este sistema',
              systemName,
              details,
            })
          }

          if (!restarted) {
            return json(res, 500, {
              success: false,
              error: 'No se pudo reiniciar el sistema',
              systemName,
              details,
            })
          }

          return json(res, 200, {
            success: true,
            message: `Sistema ${systemName} reiniciado exitosamente`
          })
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      // Tasks API (for scheduler page) - USANDO DATOS REALES
      if (pathname === '/api/tasks' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const tasks = taskScheduler.getAllTasks()
          const runningIds = typeof taskScheduler.getRunningTasks === 'function' ? taskScheduler.getRunningTasks() : []
          const runningSet = new Set((Array.isArray(runningIds) ? runningIds : []).map((id) => String(id)))
          const enriched = tasks.map((t) => ({ ...t, isRunning: runningSet.has(String(t?.id)) }))
          return json(res, 200, { tasks: enriched })
        } catch (error) {
          console.error('Error obteniendo tareas programadas:', error)
          return json(res, 500, { error: 'Error interno del servidor' })
        }
      }

      // Tasks Executions API - USANDO DATOS REALES
      if (pathname === '/api/tasks/executions' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 1000, fallback: 100 })
          const executions = taskScheduler.getExecutions(limit)
          return json(res, 200, { executions })
        } catch (error) {
          console.error('Error obteniendo ejecuciones de tareas:', error)
          return json(res, 500, { error: 'Error interno del servidor' })
        }
      }

      // Logs Export API
      if (pathname === '/api/logs/export' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        try {
          const format = url.searchParams.get('format') || 'json'
          const category = url.searchParams.get('category')
          const startDate = url.searchParams.get('startDate')
          const endDate = url.searchParams.get('endDate')
          
          let logs = panelDb?.logs || []
          
          // Filtrar por categoría si se especifica
          if (category) {
            logs = logs.filter(log => log.category === category)
          }
          
          // Filtrar por fechas si se especifican
          if (startDate) {
            logs = logs.filter(log => log.timestamp >= startDate)
          }
          if (endDate) {
            logs = logs.filter(log => log.timestamp <= endDate)
          }
          
          let exportData
          let contentType
          let fileExtension
          
          if (format === 'csv') {
            // Convertir a CSV
            const headers = ['timestamp', 'level', 'category', 'message']
            const csvRows = [headers.join(',')]
            
            logs.forEach(log => {
              const row = [
                log.timestamp || '',
                log.level || '',
                log.category || '',
                `"${(log.message || '').replace(/"/g, '""')}"`
              ]
              csvRows.push(row.join(','))
            })
            
            exportData = csvRows.join('\n')
            contentType = 'text/csv'
            fileExtension = 'csv'
          } else {
            // JSON por defecto
            exportData = JSON.stringify(logs, null, 2)
            contentType = 'application/json'
            fileExtension = 'json'
          }
          
          const filename = `logs-${new Date().toISOString().split('T')[0]}.${fileExtension}`
          
          res.setHeader('Content-Type', contentType)
          res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
          return res.end(exportData)
        } catch (error) {
          return json(res, 500, { error: error.message })
        }
      }

      return json(res, 404, { error: 'Not found', path: pathname })
    } catch (err) {
      console.error('panel-api error:', err)
      return json(res, 500, { error: 'Internal server error', message: err?.message || String(err) })
    }
  })

  // Inicializar Socket.IO
  initSocketIO(panelServer)

  // Inicializar sistema de monitoreo de recursos
  try {
    const { default: resourceMonitor } = await import('./resource-monitor.js')
    const { getIO } = await import('./socket-io.js')
    
    // Configurar eventos del monitor de recursos
    resourceMonitor.on('metricsUpdated', (metrics) => {
      const io = getIO()
      if (io) {
        io.emit('resource:metrics', metrics)
      }
    })
    
    resourceMonitor.on('alertStateChanged', (alertData) => {
      const io = getIO()
      if (io) {
        io.emit('resource:alert', alertData)
      }
    })
    
    // Iniciar monitoreo automático
    resourceMonitor.startMonitoring(10000) // Cada 10 segundos
    
    console.log('[Resource Monitor] Initialized and started')
  } catch (error) {
    console.error('[Resource Monitor] Failed to initialize:', error)
  }

  // Inicializar sistema de logs
  try {
    const { default: logManager } = await import('./log-manager.js')
    const { getIO } = await import('./socket-io.js')
    
    // Configurar eventos del log manager
    logManager.on('log', (logEntry) => {
      const io = getIO()
      if (io) {
        io.emit('log:new', logEntry)
      }
    })
    
    logManager.on('fileRotated', (data) => {
      const io = getIO()
      if (io) {
        io.emit('log:fileRotated', data)
      }
    })
    
    console.log('[Log Manager] Initialized and integrated with Socket.IO')
  } catch (error) {
    console.error('[Log Manager] Failed to initialize:', error)
  }

  await new Promise((resolve, reject) => {
    panelServer.once('error', reject)
    panelServer.listen(listenPort, listenHost, resolve)
  })

  console.log(`[PANEL-API] listening on http://${listenHost}:${listenPort}`)
  console.log(`[PANEL-API] Socket.IO habilitado para actualizaciones en tiempo real`)
  if (listenHost === '0.0.0.0') console.log(`[PANEL-API] abre: http://localhost:${listenPort}`)
  
  // Sistema de emisión periódica de estadísticas via Socket.IO
  const startPeriodicStatsEmission = async () => {
    try {
      const { getIO } = await import('./socket-io.js')
      
      // Emitir estadísticas cada 30 segundos
      setInterval(async () => {
        const io = getIO()
        if (!io || io.engine.clientsCount === 0) return // No emitir si no hay clientes
        
        try {
          const panelDb = ensurePanelDb()
          if (!panelDb) return
          
          // Estadísticas básicas para el dashboard
          const logs = panelDb.logs || []
          const todayKey = new Date().toISOString().slice(0, 10)
          const logsToday = logs.filter((l) => String(l?.fecha || '').slice(0, 10) === todayKey)
          
          const quickStats = {
            timestamp: new Date().toISOString(),
            totalLogs: logs.length,
            logsToday: logsToday.length,
            mensajesHoy: logsToday.filter((l) => l?.tipo === 'mensaje').length,
            comandosHoy: logsToday.filter((l) => l?.tipo === 'comando').length,
            usuariosActivos: new Set(logsToday.map((l) => l?.usuario).filter(Boolean)).size,
            botGlobalState: panelDb.botGlobalState?.isOn !== false,
            botConnected: global.stopped === 'open',
            totalGroups: Object.keys(panelDb.groups || {}).length,
            totalSubbots: Object.keys(panelDb.subbots || {}).length,
          }
          
          // Emitir solo si hay cambios significativos o cada 5 minutos
          const shouldEmit = !global.lastStatsEmission || 
                           Date.now() - global.lastStatsEmission > 300000 || // 5 minutos
                           JSON.stringify(quickStats) !== JSON.stringify(global.lastEmittedStats)
          
          if (shouldEmit) {
            io.emit('stats:updated', quickStats)
            io.emit('stats:update', quickStats)
            global.lastStatsEmission = Date.now()
            global.lastEmittedStats = quickStats
            if (process.env.DEBUG_SOCKETIO === 'true') {
              console.log('📊 Stats emitted via Socket.IO to', io.engine.clientsCount, 'clients')
            }
          }
        } catch (error) {
          // Silenciar errores para no spamear logs
        }
      }, 30000) // Cada 30 segundos
      
      if (process.env.DEBUG_SOCKETIO === 'true') {
        console.log('📊 Periodic stats emission started (every 30s)')
      }
    } catch (error) {
      console.log('⚠️ Could not start periodic stats emission:', error.message)
    }
  }
  
  // Iniciar emisión periódica después de un pequeño delay
  setTimeout(startPeriodicStatsEmission, 5000)
  
  return panelServer
}

// Exportar funciones de Socket.IO para uso externo
export {
  emitBotStatus,
  emitBotQR,
  emitBotConnected,
  emitBotDisconnected,
  emitSubbotCreated,
  emitSubbotQR,
  emitSubbotPairingCode,
  emitSubbotConnected,
  emitSubbotDisconnected,
  emitSubbotDeleted,
  emitAporteCreated,
  emitAporteUpdated,
  emitPedidoCreated,
  emitPedidoUpdated,
  emitGrupoUpdated,
  emitNotification,
  emitLogEntry
}
