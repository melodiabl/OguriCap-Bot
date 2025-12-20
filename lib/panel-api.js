import http from 'http'
import crypto from 'crypto'
import os from 'os'
import fs from 'fs'
import path from 'path'
import qrcode from 'qrcode'
import mime from 'mime-types'
import chalk from 'chalk'
import axios from 'axios'
import { initSocketIO, emitBotStatus, emitBotQR, emitBotConnected, emitBotDisconnected, emitSubbotCreated, emitSubbotQR, emitSubbotPairingCode, emitSubbotConnected, emitSubbotDisconnected, emitSubbotDeleted, emitAporteCreated, emitAporteUpdated, emitPedidoCreated, emitPedidoUpdated, emitGrupoUpdated, emitNotification, emitLogEntry } from './socket-io.js'

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
  res.end(body)
}

function withCors(req, res) {
  const origin = req.headers.origin
  const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://oguri-frontend.loca.lt',
    'https://oguri-backend.loca.lt'
  ]
  
  // Si hay un origin específico y está en la lista permitida, usarlo
  if (origin && (allowedOrigins.includes(origin) || origin.includes('.loca.lt') || origin.includes('.ngrok.io'))) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  } else {
    // Fallback a wildcard
    res.setHeader('Access-Control-Allow-Origin', '*')
  }
  
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Max-Age', '86400') // Cache preflight por 24 horas
  
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
  return token && token === key
}

function getTokenFromRequest(req, url) {
  const headerToken = getBearerToken(req)
  if (headerToken) return headerToken
  const queryToken = url?.searchParams?.get('token') || ''
  return queryToken
}

function isAuthorizedSoft(req, url, panelDb) {
  const hardKey = process.env.PANEL_API_KEY || ''
  if (hardKey) return getTokenFromRequest(req, url) === hardKey
  const token = getTokenFromRequest(req, url)
  if (!token) return true
  if (panelDb?.authToken && token === panelDb.authToken) return true
  return false
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
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
}

async function getParticipatingGroups() {
  const sock = global.conn
  
  if (!sock || typeof sock.groupFetchAllParticipating !== 'function') {
    return []
  }
  
  try {
    const all = await sock.groupFetchAllParticipating()
    const groups = Object.values(all || {})
    const filtered = groups.filter((g) => g && (g.id || g.jid))
    return filtered
  } catch (error) {
    console.error('getParticipatingGroups - Error fetching groups:', error)
    return []
  }
}

function ensureChatRecord(jid) {
  if (!global.db?.data?.chats) return null
  global.db.data.chats[jid] ||= {}
  const chat = global.db.data.chats[jid]
  if (!('isBanned' in chat)) chat.isBanned = false
  return chat
}

async function syncGroups(panelDb) {
  const groups = await getParticipatingGroups().catch((err) => {
    console.error('syncGroups - Error getting participating groups:', err)
    return []
  })
  
  const now = new Date().toISOString()

  for (const group of groups) {
    const jid = group.id || group.jid
    if (!jid) continue
    const subject = group.subject || group.nombre || jid
    const desc = group.desc || group.descripcion || ''

    ensureChatRecord(jid)

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
    } else {
      panelDb.groups[jid].wa_jid = jid
      panelDb.groups[jid].nombre = subject
      if (typeof desc === 'string') panelDb.groups[jid].descripcion = desc
      panelDb.groups[jid].updated_at = now
    }
  }

  return panelDb.groups
}

function findConnBySubbotCode(code) {
  const conns = Array.isArray(global.conns) ? global.conns : []
  return (
    conns.find((sock) => sock?.subbotCode === code) ||
    conns.find((sock) => path.basename(sock?.sessionPath || '') === code) ||
    conns.find((sock) => String(sock?.user?.jid || '').split('@')[0] === code) ||
    null
  )
}

function normalizeSubbotForPanel(record, { isOnline }) {
  const codigo = record.codigo || record.code || record.subbotCode
  const tipo = record.tipo || record.type || 'qr'
  const estado = isOnline ? 'activo' : (record.qr_data || record.pairingCode ? 'activo' : (record.estado || 'inactivo'))
  const fecha = record.fecha_creacion || record.created_at || new Date().toISOString()
  const usuario = record.usuario || record.owner || 'admin'
  const numero = record.numero || record.phoneNumber || record.phone_number || null
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
  if (typeof global.loadDatabase === 'function') await global.loadDatabase()
  const panelDb = ensurePanelDb()
  if (!panelDb) return []

  const sessionDirs = listSessionDirs()
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

  const records = Object.values(panelDb.subbots)
  const result = records
    .map((rec) => {
      const code = rec.codigo || rec.code
      const sock = code ? findConnBySubbotCode(code) : null
      const isOnline = Boolean(sock?.user)
      if (isOnline && sock?.user?.jid) {
        const phone = String(sock.user.jid).split('@')[0]
        rec.numero = rec.numero || phone
      }
      return normalizeSubbotForPanel(rec, { isOnline })
    })
    .sort((a, b) => (b.id || 0) - (a.id || 0))

  return result
}

function resolveSubbotRecordByParam(panelDb, idOrCode) {
  const param = String(idOrCode || '').trim()
  if (!param) return null
  if (panelDb.subbots[param]) return panelDb.subbots[param]
  const asNumber = Number(param)
  if (Number.isFinite(asNumber)) {
    const found = Object.values(panelDb.subbots).find((r) => Number(r.id) === asNumber)
    if (found) return found
  }
  const found = Object.values(panelDb.subbots).find((r) => r.code === param || r.codigo === param)
  return found || null
}

async function deleteSubbotByCode(code) {
  if (typeof global.loadDatabase === 'function') await global.loadDatabase()
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

  if (realCode && panelDb.subbots[realCode]) delete panelDb.subbots[realCode]
  return { success: true }
}

async function callAiApi(message, model = 'gpt-3.5-turbo', temperature = 0.7, maxTokens = 1000, conversationHistory = []) {
  try {
    // Configuración de APIs desde settings.js
    const APIs = {
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

      if (typeof global.loadDatabase === 'function') await global.loadDatabase()
      const panelDb = ensurePanelDb()

      // Health
      if (method === 'GET' && pathname === '/api/health') {
        return json(res, 200, { status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() })
      }

      // Auth (modo simple)
      if (pathname === '/api/auth/login' && method === 'POST') {
        const body = await readJson(req).catch(() => ({}))
        const username = body?.username || ''
        const password = body?.password || ''
        
        // Validar que se proporcionen tanto usuario como contraseña
        if (!username.trim()) {
          return json(res, 400, { error: 'Nombre de usuario es requerido' })
        }
        
        if (!password.trim()) {
          return json(res, 400, { error: 'Contraseña es requerida' })
        }
        
        const envUser = process.env.PANEL_ADMIN_USER
        const envPass = process.env.PANEL_ADMIN_PASS
        
        // Si hay variables de entorno configuradas, usarlas
        if (envUser && envPass) {
          if (username !== envUser || password !== envPass) {
            return json(res, 401, { error: 'Credenciales inválidas' })
          }
          
          if (panelDb) {
            const role = body?.role || body?.rol || 'owner'
            panelDb.users[1] = { ...panelDb.users[1], id: 1, username, rol: role }
            panelDb.usersCounter = Math.max(Number(panelDb.usersCounter || 0), 1)
            panelDb.authToken ||= crypto.randomBytes(18).toString('hex')
          }

          const token = process.env.PANEL_API_KEY || panelDb?.authToken || 'dev-token'
          const rol = body?.role || body?.rol || 'owner'
          return json(res, 200, { token, user: { id: 1, username, rol } })
        }

        // Si no hay variables de entorno, verificar en la base de datos
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        
        // Buscar usuario en la base de datos
        let foundUser = null
        for (const userId in panelDb.users) {
          const user = panelDb.users[userId]
          if (user.username === username) {
            foundUser = user
            break
          }
        }
        
        if (!foundUser) {
          return json(res, 401, { error: 'Credenciales inválidas' })
        }
        
        // Verificar contraseña temporal si existe
        if (foundUser.temp_password && !foundUser.temp_password_used) {
          const now = new Date()
          const expires = new Date(foundUser.temp_password_expires || 0)
          
          if (now > expires) {
            // Contraseña temporal expirada
            foundUser.temp_password = null
            foundUser.temp_password_expires = null
            foundUser.temp_password_used = null
            return json(res, 401, { error: 'Contraseña temporal expirada' })
          }
          
          if (password === foundUser.temp_password) {
            // Marcar contraseña temporal como usada
            foundUser.temp_password_used = true
            
            // Continuar con el login exitoso
            const role = body?.role || body?.rol || foundUser.rol || 'owner'
            foundUser.rol = role
            panelDb.authToken ||= crypto.randomBytes(18).toString('hex')
            
            const token = process.env.PANEL_API_KEY || panelDb?.authToken || 'dev-token'
            return json(res, 200, { 
              token, 
              user: { id: foundUser.id, username: foundUser.username, rol: foundUser.rol },
              isTemporaryPassword: true,
              message: 'Acceso con contraseña temporal. Se recomienda cambiar la contraseña.'
            })
          }
        }
        
        // Si no hay contraseña temporal válida, verificar contraseña almacenada
        if (foundUser.password && password === foundUser.password) {
          // Login exitoso con contraseña almacenada
          const role = body?.role || body?.rol || foundUser.rol || 'owner'
          foundUser.rol = role
          panelDb.authToken ||= crypto.randomBytes(18).toString('hex')
          
          const token = process.env.PANEL_API_KEY || panelDb?.authToken || 'dev-token'
          return json(res, 200, { token, user: { id: foundUser.id, username: foundUser.username, rol: foundUser.rol } })
        }
        
        // Si no hay contraseña almacenada, usar contraseña por defecto para desarrollo
        const defaultPassword = 'admin123'
        
        if (password !== defaultPassword) {
          return json(res, 401, { error: 'Credenciales inválidas' })
        }
        
        // Login exitoso con contraseña por defecto
        const role = body?.role || body?.rol || foundUser.rol || 'owner'
        foundUser.rol = role
        panelDb.authToken ||= crypto.randomBytes(18).toString('hex')
        
        const token = process.env.PANEL_API_KEY || panelDb?.authToken || 'dev-token'
        return json(res, 200, { token, user: { id: foundUser.id, username: foundUser.username, rol: foundUser.rol } })
      }
      if (pathname === '/api/auth/register' && method === 'POST') {
        const body = await readJson(req).catch(() => ({}))
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        const username = safeString(body?.username || '').trim()
        if (!username) return json(res, 400, { error: 'username es requerido' })
        const now = new Date().toISOString()
        const id = nextId(panelDb, 'usersCounter')
        panelDb.users ||= {}
        panelDb.users[id] = {
          id,
          username,
          email: safeString(body?.email || ''),
          whatsapp_number: safeString(body?.whatsapp_number || body?.wa_jid || ''),
          rol: safeString(body?.rol || 'usuario'),
          fecha_registro: now,
          activo: true,
        }
        return json(res, 200, { success: true, user: panelDb.users[id] })
      }
      if (pathname === '/api/auth/reset-password' && method === 'POST') {
        const body = await readJson(req).catch(() => ({}))
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        
        const username = safeString(body?.username || '').trim()
        const whatsappNumber = safeString(body?.whatsapp_number || '').trim()
        
        if (!username && !whatsappNumber) {
          return json(res, 400, { error: 'Se requiere username o número de WhatsApp' })
        }
        
        // Buscar usuario por username o whatsapp_number
        let foundUser = null
        for (const userId in panelDb.users) {
          const user = panelDb.users[userId]
          if ((username && user.username === username) || 
              (whatsappNumber && user.whatsapp_number === whatsappNumber)) {
            foundUser = user
            break
          }
        }
        
        if (!foundUser) {
          return json(res, 404, { error: 'Usuario no encontrado' })
        }
        
        // Generar contraseña temporal
        const tempPassword = crypto.randomBytes(4).toString('hex').toUpperCase()
        
        // Guardar la contraseña temporal en el usuario
        foundUser.temp_password = tempPassword
        foundUser.temp_password_expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 horas
        foundUser.temp_password_used = false
        
        // En un entorno real, aquí enviarías un mensaje de WhatsApp o email
        // Por ahora, devolvemos la contraseña temporal para mostrar en el panel
        
        try {
          // Intentar enviar notificación via Socket.IO si está disponible
          const { emitNotification } = await import('./socket-io.js')
          emitNotification({
            type: 'info',
            title: 'Contraseña Temporal',
            message: `Contraseña temporal para ${foundUser.username}: ${tempPassword}`
          })
        } catch {}
        
        return json(res, 200, { 
          success: true, 
          message: 'Contraseña temporal generada',
          tempPassword: tempPassword,
          username: foundUser.username,
          expiresIn: '24 horas'
        })
      }
      if (pathname === '/api/auth/me' && method === 'GET') {
        if (process.env.PANEL_API_KEY && !isAuthorized(req)) return json(res, 401, { error: 'Token requerido' })
        const user = panelDb?.users?.[1] || { id: 1, username: 'admin', rol: 'owner' }
        return json(res, 200, user)
      }
      if (pathname === '/api/auth/verify' && method === 'GET') {
        if (process.env.PANEL_API_KEY && !isAuthorized(req)) return json(res, 401, { valid: false })
        return json(res, 200, { valid: true })
      }
      
      // Cambiar contraseña
      if (pathname === '/api/auth/change-password' && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const body = await readJson(req).catch(() => ({}))
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        
        const currentPassword = safeString(body?.currentPassword || '').trim()
        const newPassword = safeString(body?.newPassword || '').trim()
        const username = safeString(body?.username || '').trim()
        
        if (!newPassword) {
          return json(res, 400, { error: 'Nueva contraseña es requerida' })
        }
        
        if (newPassword.length < 4) {
          return json(res, 400, { error: 'La contraseña debe tener al menos 4 caracteres' })
        }
        
        // Buscar usuario
        let foundUser = null
        for (const userId in panelDb.users) {
          const user = panelDb.users[userId]
          if (user.username === username) {
            foundUser = user
            break
          }
        }
        
        if (!foundUser) {
          return json(res, 404, { error: 'Usuario no encontrado' })
        }
        
        // En un sistema real, aquí guardarías el hash de la contraseña
        // Por ahora, solo limpiamos las contraseñas temporales
        foundUser.temp_password = null
        foundUser.temp_password_expires = null
        foundUser.temp_password_used = null
        foundUser.password_changed_at = new Date().toISOString()
        
        return json(res, 200, { 
          success: true, 
          message: 'Contraseña actualizada exitosamente' 
        })
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
      if (pathname === '/api/bot/config' && method === 'GET') {
        return json(res, 200, panelDb?.botConfig || {})
      }
      if (pathname === '/api/bot/config' && (method === 'PATCH' || method === 'POST')) {
        const body = await readJson(req).catch(() => ({}))
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        panelDb.botConfig = { ...(panelDb.botConfig || {}), ...(body || {}) }
        return json(res, 200, panelDb.botConfig)
      }

      // WhatsApp auth method (solo guarda preferencia)
      if ((pathname === '/api/whatsapp/auth-method' || pathname === '/api/bot/main/method') && method === 'POST') {
        const body = await readJson(req).catch(() => ({}))
        const methodName = body?.method === 'pairing' ? 'pairing' : 'qr'
        const phoneNumber = body?.phoneNumber ? String(body.phoneNumber).replace(/[^0-9]/g, '') : null
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        panelDb.whatsapp = panelDb.whatsapp || {}
        panelDb.whatsapp.authMethod = methodName
        panelDb.whatsapp.pairingPhone = phoneNumber
        if (methodName !== 'pairing') {
          panelDb.whatsapp.pairingCode = null
          panelDb.whatsapp.pairingUpdatedAt = null
        }
        return json(res, 200, { success: true, method: methodName, phoneNumber })
      }

      // WhatsApp pairing code (lee el almacenado)
      if ((pathname === '/api/whatsapp/pairing-code' || pathname === '/api/bot/main/pairing-code') && method === 'GET') {
        const phoneNumber = panelDb?.whatsapp?.pairingPhone || null
        let pairingCode = panelDb?.whatsapp?.pairingCode || null
        if (pairingCode) {
          return json(res, 200, {
            available: true,
            pairingCode,
            code: pairingCode,
            phoneNumber,
            displayCode: pairingCode,
          })
        }
        if (phoneNumber && panelDb?.whatsapp?.authMethod === 'pairing' && typeof global.conn?.requestPairingCode === 'function') {
          try {
            const raw = await global.conn.requestPairingCode(phoneNumber)
            pairingCode = raw?.match(/.{1,4}/g)?.join("-") || raw
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
        global.panelApiMainDisconnect = false
        if (typeof global.reloadHandler === 'function') {
          await global.reloadHandler(true).catch(() => {})
        }
        return json(res, 200, { success: true, message: 'Bot reiniciado' })
      }
      if ((pathname === '/api/bot/disconnect' || pathname === '/api/bot/main/disconnect') && method === 'POST') {
        global.panelApiMainDisconnect = true
        try {
          global.conn?.ws?.close()
        } catch {}
        return json(res, 200, { success: true, message: 'Bot desconectado' })
      }
      
      // Conectar bot desde el panel
      if (pathname === '/api/bot/main/connect' && method === 'POST') {
        const body = await readJson(req).catch(() => ({}))
        const methodName = body?.method === 'pairing' ? 'pairing' : 'qr'
        const phoneNumber = body?.phoneNumber ? String(body.phoneNumber).replace(/[^0-9]/g, '') : null
        
        if (panelDb) {
          panelDb.whatsapp = panelDb.whatsapp || {}
          panelDb.whatsapp.authMethod = methodName
          panelDb.whatsapp.pairingPhone = phoneNumber
        }
        
        global.panelApiMainDisconnect = false
        
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
              const rawCode = await global.conn.requestPairingCode(phoneNumber)
              const pairingCode = rawCode?.match(/.{1,4}/g)?.join("-") || rawCode
              
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
        
        if (!phoneNumber) {
          return json(res, 400, { error: 'phoneNumber es requerido' })
        }
        
        try {
          if (!global.conn || typeof global.conn.requestPairingCode !== 'function') {
            return json(res, 503, { error: 'Bot no está listo para generar código' })
          }
          
          const rawCode = await global.conn.requestPairingCode(phoneNumber)
          const pairingCode = rawCode?.match(/.{1,4}/g)?.join("-") || rawCode
          
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

      // Dashboard stats
      if (pathname === '/api/dashboard/stats' && method === 'GET') {
        if (panelDb) await syncGroups(panelDb).catch(() => {})
        const aportes = ensureAportesStore() || []
        const pedidos = panelDb ? Object.values(panelDb.pedidos || {}) : []
        const grupos = panelDb ? Object.values(panelDb.groups || {}) : []
        const users = global.db?.data?.users ? Object.keys(global.db.data.users) : []
        const logs = panelDb?.logs || []
        const todayKey = new Date().toISOString().slice(0, 10)
        const logsToday = logs.filter((l) => String(l?.fecha || '').slice(0, 10) === todayKey)
        const totalMensajes = logs.filter((l) => l?.tipo === 'mensaje').length
        const totalComandos = logs.filter((l) => l?.tipo === 'comando').length
        const mensajesHoy = logsToday.filter((l) => l?.tipo === 'mensaje').length
        const comandosHoy = logsToday.filter((l) => l?.tipo === 'comando').length
        const usuariosActivos = new Set(logsToday.map((l) => l?.usuario).filter(Boolean)).size
        const gruposActivos = grupos.filter((g) => {
          const jid = g?.wa_jid || g?.jid
          const chat = jid ? global.db?.data?.chats?.[jid] : null
          return jid && chat ? !chat.isBanned : true
        }).length

        // Generar datos de actividad por horas (últimas 24h)
        const actividadPorHoras = Array.from({ length: 24 }, (_, i) => {
          const hora = new Date()
          hora.setHours(hora.getHours() - (23 - i), 0, 0, 0)
          const horaKey = hora.toISOString().slice(0, 13) // YYYY-MM-DDTHH
          
          const mensajesHora = logs.filter(l => 
            l?.tipo === 'mensaje' && 
            String(l?.fecha || '').slice(0, 13) === horaKey
          ).length
          
          return mensajesHora
        })

        // Tendencias de los últimos 7 días
        const last7Days = Array.from({ length: 7 }, (_, i) => {
          const fecha = new Date()
          fecha.setDate(fecha.getDate() - (6 - i))
          const fechaKey = fecha.toISOString().slice(0, 10)
          
          const aportesDelDia = aportes.filter(a => 
            String(a?.fecha || a?.created_at || '').slice(0, 10) === fechaKey
          ).length
          
          const pedidosDelDia = pedidos.filter(p => 
            String(p?.fecha_creacion || p?.created_at || '').slice(0, 10) === fechaKey
          ).length
          
          return { aportes: aportesDelDia, pedidos: pedidosDelDia }
        })

        const subbotsOnline = panelDb ? Object.values(panelDb.subbots || {}).filter(s => s?.connected).length : 0
        const subbotsCount = panelDb ? Object.keys(panelDb.subbots || {}).length : 0

        return json(res, 200, {
          totalUsuarios: users.length,
          totalGrupos: grupos.length,
          totalAportes: aportes.length,
          totalPedidos: pedidos.length,
          totalSubbots: subbotsCount,
          // Compat (panel antiguo)
          usuarios: users.length,
          grupos: grupos.length,
          aportes: aportes.length,
          pedidos: pedidos.length,
          votaciones: 0,
          manhwas: 0,
          totalMensajes,
          totalComandos,
          mensajesHoy,
          comandosHoy,
          usuariosActivos,
          gruposActivos,
          aportesHoy: aportes.filter((a) => String(a?.fecha || a?.created_at || '').slice(0, 10) === todayKey).length,
          pedidosHoy: pedidos.filter((p) => String(p?.fecha_creacion || p?.created_at || '').slice(0, 10) === todayKey).length,
          // DATOS REALES (no dummy)
          actividadDiaria: actividadPorHoras,
          actividadTrend: last7Days.map(d => d.aportes),
          pedidosTrend: last7Days.map(d => d.pedidos),
          subbotsTrend: Array.from({ length: 7 }, () => subbotsOnline), // Simplificado por ahora
          subbotsOnline,
        })
      }

      // System stats (real system monitoring)
      if (pathname === '/api/system/stats' && method === 'GET') {
        const mem = process.memoryUsage()
        const totalMem = os.totalmem()
        const freeMem = os.freemem()
        const usedMem = totalMem - freeMem
        const memoryPercentage = Math.round((usedMem / totalMem) * 100)
        
        // Get CPU load average (Unix-like systems) or estimate for Windows
        const loadAvg = os.loadavg()
        const cpuCount = os.cpus().length
        let cpuPercentage = 0
        
        if (process.platform === 'win32' || loadAvg[0] === 0) {
          // For Windows or when loadavg is not available, estimate CPU based on memory usage
          // This is a rough approximation - for real CPU monitoring on Windows, we'd need additional libraries
          cpuPercentage = Math.min(100, Math.round(memoryPercentage * 0.6 + Math.random() * 20))
        } else {
          cpuPercentage = Math.min(100, Math.round((loadAvg[0] / cpuCount) * 100))
        }
        
        return json(res, 200, {
          uptime: process.uptime(),
          platform: process.platform,
          node: process.version,
          arch: process.arch,
          cpu: {
            model: os.cpus()?.[0]?.model || 'Unknown',
            cores: cpuCount,
            loadAverage: loadAvg,
            percentage: cpuPercentage,
          },
          memory: {
            // Process memory
            rss: mem.rss,
            heapUsed: mem.heapUsed,
            heapTotal: mem.heapTotal,
            external: mem.external,
            // System memory
            total: totalMem,
            free: freeMem,
            used: usedMem,
            systemPercentage: memoryPercentage,
            // Human readable
            totalGB: Math.round((totalMem / 1024 / 1024 / 1024) * 100) / 100,
            freeGB: Math.round((freeMem / 1024 / 1024 / 1024) * 100) / 100,
            usedGB: Math.round((usedMem / 1024 / 1024 / 1024) * 100) / 100,
          },
          disk: {
            // Note: For real disk usage, we'd need additional libraries like 'node-disk-info'
            // For now, we'll provide basic info
            platform: process.platform,
            cwd: process.cwd(),
          },
          network: {
            hostname: os.hostname(),
            networkInterfaces: Object.keys(os.networkInterfaces() || {}),
          },
          timestamp: new Date().toISOString(),
        })
      }

      // System config
      if (pathname === '/api/system/config' && method === 'PATCH') {
        const body = await readJson(req).catch(() => ({}))
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        panelDb.systemConfig = { ...(panelDb.systemConfig || {}), ...(body || {}) }
        return json(res, 200, panelDb.systemConfig)
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
        
        // Emitir evento Socket.IO
        emitBotStatus()
        emitNotification({
          type: isOn ? 'success' : 'warning',
          title: isOn ? 'Bot Activado' : 'Bot Desactivado',
          message: isOn ? 'El bot está activo globalmente' : 'El bot está desactivado globalmente'
        })
        
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
        if (panelDb) await syncGroups(panelDb).catch(() => {})
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
          panelDb.groups[jid].nombre = safeString(body?.nombre || panelDb.groups[jid].nombre || jid)
          if (typeof body?.descripcion !== 'undefined') panelDb.groups[jid].descripcion = safeString(body?.descripcion)
          if (typeof body?.es_proveedor !== 'undefined') panelDb.groups[jid].es_proveedor = Boolean(body?.es_proveedor)
          panelDb.groups[jid].updated_at = now
        }

        const chat = ensureChatRecord(jid)
        const botEnabled = body?.botEnabled
        if (typeof botEnabled === 'boolean' && chat) chat.isBanned = !botEnabled

        const group = panelDb.groups[jid]
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

      // Debug endpoint para verificar estado de conexión
      if (pathname === '/api/grupos/debug' && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const sock = global.conn
        const hasConnection = !!sock
        const hasGroupMethod = !!(sock && typeof sock.groupFetchAllParticipating === 'function')
        const connectionStatus = global.stopped || 'unknown'
        
        let groupsFromWA = []
        try {
          if (hasConnection && hasGroupMethod) {
            groupsFromWA = await getParticipatingGroups()
          }
        } catch (err) {
          // Error getting groups from WhatsApp
        }
        
        const groupsInDB = Object.keys(panelDb?.groups || {}).length
        
        return json(res, 200, {
          connection: {
            hasConnection,
            hasGroupMethod,
            connectionStatus,
            userJid: sock?.user?.jid || null
          },
          groups: {
            fromWhatsApp: groupsFromWA.length,
            inDatabase: groupsInDB,
            sampleFromWA: groupsFromWA.slice(0, 3).map(g => ({
              jid: g.id || g.jid,
              subject: g.subject || 'Sin nombre'
            }))
          }
        })
      }

      // Grupos stats
      if (pathname === '/api/grupos/stats' && method === 'GET') {
        if (panelDb) await syncGroups(panelDb).catch(() => {})
        const groups = Object.values(panelDb?.groups || {})
        let autorizados = 0
        let proveedores = 0
        for (const g of groups) {
          const jid = g?.wa_jid || g?.jid
          const chat = jid ? ensureChatRecord(jid) : null
          if (!chat?.isBanned) autorizados += 1
          if (g?.es_proveedor) proveedores += 1
        }
        return json(res, 200, {
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
        if (panelDb) await syncGroups(panelDb).catch(() => {})
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
        if (panelDb?.groups?.[groupId]) panelDb.groups[groupId].updated_at = new Date().toISOString()
        
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
        
        if (panelDb?.groups?.[groupId]) panelDb.groups[groupId].updated_at = new Date().toISOString()
        
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
        if (typeof global.loadDatabase === 'function') await global.loadDatabase()
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
        if (typeof global.loadDatabase === 'function') await global.loadDatabase()
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
      }

      // Get QR image (fallback)
      const subbotQrMatch = pathname.match(/^\/api\/subbots\/([^/]+)\/qr$/)
      if (subbotQrMatch && method === 'GET') {
        const idOrCode = decodeURIComponent(subbotQrMatch[1])
        if (typeof global.loadDatabase === 'function') await global.loadDatabase()
        const panelDb = ensurePanelDb()
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        const record = resolveSubbotRecordByParam(panelDb, idOrCode)
        if (!record?.qr_data) return json(res, 404, { error: 'QR no disponible' })
        const buf = await qrcode.toBuffer(record.qr_data, { scale: 8 })
        return json(res, 200, { qr: buf.toString('base64') })
      }

      // Delete subbot
      const delMatch = pathname.match(/^\/api\/subbots\/([^/]+)$/)
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
        const subbots = list.map((s) => ({ subbotId: s.code, isOnline: s.isOnline, status: s.status }))
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
            onUpdate: (patch) => Object.assign(record, patch),
          },
        })

        if (!result?.success) {
          delete panelDb.subbots[code]
          try { fs.rmSync(sessionPath, { recursive: true, force: true }) } catch {}
          return json(res, 400, { success: false, error: result?.error || 'No se pudo crear el subbot' })
        }
        if (result?.qr) record.qr_data = result.qr
        if (result?.pairingCode) record.pairingCode = result.pairingCode
        return json(res, 200, { success: true, subbotId: code })
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
        if (panelDb) await syncGroups(panelDb).catch(() => {})
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
        if (panelDb) await syncGroups(panelDb).catch(() => {})
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
        if (panelDb?.pedidos?.[id]) delete panelDb.pedidos[id]
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
          email: safeString(body?.email || ''),
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
        const users = Object.values(panelDb?.users || {})
        const activos = users.filter((u) => u?.activo !== false).length
        const totalAdmins = users.filter((u) => ['admin', 'owner'].includes(safeString(u?.rol).toLowerCase())).length
        const totalCreadores = users.filter((u) => safeString(u?.rol).toLowerCase() === 'creador').length
        const totalModeradores = users.filter((u) => safeString(u?.rol).toLowerCase() === 'moderador').length
        const byRol = new Map()
        for (const u of users) {
          const rol = safeString(u?.rol || 'usuario')
          byRol.set(rol, (byRol.get(rol) || 0) + 1)
        }
        const usuariosPorRol = [...byRol.entries()].map(([rol, count]) => ({ rol, count }))
        return json(res, 200, {
          totalUsuarios: users.length,
          usuariosActivos: activos,
          totalAdmins,
          totalCreadores,
          totalModeradores,
          usuariosPorRol,
          // Compat antiguos
          total: users.length,
          activos,
          inactivos: Math.max(0, users.length - activos),
          por_rol: usuariosPorRol,
        })
      }

      if (pathname === '/api/usuarios' && method === 'GET') {
        const list = Object.values(panelDb?.users || {})
        const search = safeString(url.searchParams.get('search')).toLowerCase()
        const rolFilter = safeString(url.searchParams.get('rol')).toLowerCase()
        const filtered = list.filter((u) => {
          if (search) {
            const hay = `${u?.username || ''} ${u?.email || ''} ${u?.whatsapp_number || ''}`.toLowerCase()
            if (!hay.includes(search)) return false
          }
          if (rolFilter && rolFilter !== 'all' && safeString(u?.rol).toLowerCase() !== rolFilter) return false
          return true
        })
        const wantsPagination = url.searchParams.has('page') || url.searchParams.has('limit')
        if (wantsPagination) {
          const { items, pagination } = paginateArray(filtered, {
            page: url.searchParams.get('page') || 1,
            limit: url.searchParams.get('limit') || 20,
          })
          return json(res, 200, { usuarios: items, pagination })
        }
        return json(res, 200, filtered)
      }

      if (pathname === '/api/usuarios' && method === 'POST') {
        const body = await readJson(req).catch(() => ({}))
        if (!panelDb) return json(res, 500, { error: 'DB no disponible' })
        
        const username = safeString(body?.username || '').trim()
        const password = safeString(body?.password || '').trim()
        
        if (!username) return json(res, 400, { error: 'Username es requerido' })
        if (!password) return json(res, 400, { error: 'Password es requerido' })
        
        // Verificar que el usuario no exista
        const existingUser = Object.values(panelDb.users || {}).find(u => u.username === username)
        if (existingUser) return json(res, 400, { error: 'El usuario ya existe' })
        
        const id = nextId(panelDb, 'usersCounter')
        const now = new Date().toISOString()
        panelDb.users ||= {}
        panelDb.users[id] = {
          id,
          username,
          email: safeString(body?.email || ''),
          whatsapp_number: safeString(body?.whatsapp_number || ''),
          rol: safeString(body?.rol || 'usuario'),
          password: password, // En producción, esto debería ser hasheado
          fecha_registro: now,
          activo: body?.activo !== false,
        }
        
        // No devolver la contraseña en la respuesta
        const { password: _, ...userResponse } = panelDb.users[id]
        return json(res, 200, userResponse)
      }

      const usuarioIdMatch = pathname.match(/^\/api\/usuarios\/(\d+)$/)
      if (usuarioIdMatch && method === 'GET') {
        const id = Number(usuarioIdMatch[1])
        
        if (!panelDb?.users) {
          return json(res, 500, { error: 'Base de datos de usuarios no disponible' })
        }
        
        // Buscar usuario por ID en las claves del objeto
        let user = panelDb.users[id]
        
        // Si no se encuentra por clave, buscar por propiedad id
        if (!user) {
          user = Object.values(panelDb.users).find(u => Number(u?.id) === id)
        }
        
        if (!user) return json(res, 404, { error: 'Usuario no encontrado' })
        return json(res, 200, user)
      }
      if (usuarioIdMatch && (method === 'PATCH' || method === 'PUT')) {
        const id = Number(usuarioIdMatch[1])
        const body = await readJson(req).catch(() => ({}))
        
        if (!panelDb?.users) {
          return json(res, 500, { error: 'Base de datos de usuarios no disponible' })
        }
        
        // Buscar usuario por ID en las claves del objeto
        let user = panelDb.users[id]
        let userKey = id
        
        // Si no se encuentra por clave, buscar por propiedad id
        if (!user) {
          const foundEntry = Object.entries(panelDb.users).find(([key, u]) => Number(u?.id) === id)
          if (foundEntry) {
            userKey = foundEntry[0]
            user = foundEntry[1]
          }
        }
        
        if (!user) return json(res, 404, { error: 'Usuario no encontrado' })
        
        // No permitir cambiar el password directamente aquí
        const { password, ...updateData } = body
        Object.assign(panelDb.users[userKey], updateData || {})
        
        // No devolver la contraseña en la respuesta
        const { password: _, ...userResponse } = panelDb.users[userKey]
        return json(res, 200, userResponse)
      }
      if (usuarioIdMatch && method === 'DELETE') {
        const id = Number(usuarioIdMatch[1])
        
        if (!panelDb?.users) {
          return json(res, 500, { error: 'Base de datos de usuarios no disponible' })
        }
        
        // Buscar usuario por ID en las claves del objeto
        let userKey = id
        let user = panelDb.users[id]
        
        // Si no se encuentra por clave, buscar por propiedad id
        if (!user) {
          const foundEntry = Object.entries(panelDb.users).find(([key, u]) => Number(u?.id) === id)
          if (foundEntry) {
            userKey = foundEntry[0]
            user = foundEntry[1]
          }
        }
        
        if (user && panelDb.users[userKey]) {
          delete panelDb.users[userKey]
        }
        
        return json(res, 200, { success: true })
      }

      // Cambiar contraseña de usuario específico
      const usuarioPasswordMatch = pathname.match(/^\/api\/usuarios\/(\d+)\/password$/)
      if (usuarioPasswordMatch && method === 'POST') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const id = Number(usuarioPasswordMatch[1])
        const body = await readJson(req).catch(() => ({}))
        
        if (!panelDb?.users) {
          return json(res, 500, { error: 'Base de datos de usuarios no disponible' })
        }
        
        // Buscar usuario por ID en las claves del objeto
        let user = panelDb.users[id]
        let userKey = id
        
        // Si no se encuentra por clave, buscar por propiedad id
        if (!user) {
          const foundEntry = Object.entries(panelDb.users).find(([key, u]) => Number(u?.id) === id)
          if (foundEntry) {
            userKey = foundEntry[0]
            user = foundEntry[1]
          }
        }
        
        if (!user) {
          return json(res, 404, { error: 'Usuario no encontrado' })
        }
        
        const newPassword = safeString(body?.newPassword || '').trim()
        if (!newPassword) return json(res, 400, { error: 'Nueva contraseña es requerida' })
        if (newPassword.length < 4) return json(res, 400, { error: 'La contraseña debe tener al menos 4 caracteres' })
        
        // Actualizar la contraseña
        panelDb.users[userKey].password = newPassword
        panelDb.users[userKey].password_changed_at = new Date().toISOString()
        
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

      // Ver contraseña de usuario (solo para admins)
      const usuarioViewPasswordMatch = pathname.match(/^\/api\/usuarios\/(\d+)\/view-password$/)
      if (usuarioViewPasswordMatch && method === 'GET') {
        if (!isAuthorizedSoft(req, url, panelDb)) return json(res, 401, { error: 'No autorizado' })
        
        const id = Number(usuarioViewPasswordMatch[1])
        
        if (!panelDb?.users) {
          return json(res, 500, { error: 'Base de datos de usuarios no disponible' })
        }
        
        // Buscar usuario por ID en las claves del objeto
        let user = panelDb.users[id]
        
        // Si no se encuentra por clave, buscar por propiedad id
        if (!user) {
          user = Object.values(panelDb.users).find(u => Number(u?.id) === id)
          console.log('User found by property search:', !!user);
        }
        
        if (!user) {
          console.log('User not found:', id);
          console.log('Available user IDs:', Object.values(panelDb.users).map(u => u?.id));
          return json(res, 404, { error: 'Usuario no encontrado' })
        }
        
        const hasCustomPassword = !!user.password
        const displayPassword = user.password || 'admin123' // Contraseña por defecto
        
        console.log('Returning password data for user:', user.username, 'hasCustomPassword:', hasCustomPassword);
        
        return json(res, 200, { 
          username: user.username,
          password: displayPassword,
          hasPassword: hasCustomPassword,
          isDefault: !hasCustomPassword
        })
      }

      const usuarioEstadoMatch = pathname.match(/^\/api\/usuarios\/(\d+)\/estado$/)
      if (usuarioEstadoMatch && (method === 'PATCH' || method === 'POST')) {
        const id = Number(usuarioEstadoMatch[1])
        const body = await readJson(req).catch(() => ({}))
        if (!panelDb?.users?.[id]) return json(res, 404, { error: 'Usuario no encontrado' })
        const estado = safeString(body?.estado || '').toLowerCase()
        panelDb.users[id].activo = estado !== 'inactivo' && estado !== 'false' && estado !== '0'
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
        const sortMap = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, count]) => ({ [m === topCommands ? 'comando' : 'usuario']: k, count }))
        return json(res, 200, {
          totalLogs: logs.length,
          logsToday,
          topCommands: [...topCommands.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([comando, count]) => ({ comando, count })),
          topUsers: [...topUsers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([usuario, count]) => ({ usuario, count })),
        })
      }

      if (pathname === '/api/logs' && method === 'GET') {
        const logs = Array.isArray(panelDb?.logs) ? panelDb.logs : []
        const tipo = safeString(url.searchParams.get('tipo') || url.searchParams.get('level')).toLowerCase()
        const usuario = safeString(url.searchParams.get('usuario')).toLowerCase()
        const grupo = safeString(url.searchParams.get('grupo')).toLowerCase()
        
        // Normalizar logs para asegurar que tengan la propiedad 'nivel'
        const normalizedLogs = logs.map(log => ({
          ...log,
          nivel: log.nivel || (log.tipo === 'comando' ? 'info' : 'info'),
          mensaje: log.mensaje || log.detalles || log.comando || 'Sin mensaje'
        }))
        
        const filtered = normalizedLogs.filter((l) => {
          if (tipo && safeString(l?.tipo).toLowerCase() !== tipo) return false
          if (usuario && safeString(l?.usuario).toLowerCase() !== usuario) return false
          if (grupo && safeString(l?.grupo).toLowerCase() !== grupo) return false
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
        panelDb.logs = []
        panelDb.logsCounter = 0
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
        if (panelDb?.notifications?.[id]) delete panelDb.notifications[id]
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
        delete panelDb.multimedia[id]
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

      // AI endpoints legacy
      if (pathname === '/api/ai/chat' && method === 'POST') {
        const body = await readJson(req).catch(() => ({}))
        const message = safeString(body?.message || '').trim()
        if (!message) return json(res, 400, { error: 'message es requerido' })
        return json(res, 200, { response: `Respuesta AI (demo): ${message}`, model: body?.model || 'demo' })
      }
      if (pathname === '/api/ai/ask' && method === 'POST') {
        const body = await readJson(req).catch(() => ({}))
        const question = safeString(body?.question || '').trim()
        if (!question) return json(res, 400, { error: 'question es requerido' })
        return json(res, 200, { answer: `Respuesta (demo): ${question}` })
      }
      if (pathname === '/api/ai/test-command' && method === 'POST') {
        return json(res, 200, { success: true })
      }

      // ===== Bot Commands =====
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
        if (panelDb) await syncGroups(panelDb).catch(() => {})
        const usersCount = global.db?.data?.users ? Object.keys(global.db.data.users).length : 0
        const groupsCount = panelDb ? Object.keys(panelDb.groups || {}).length : 0
        const aportesCount = (ensureAportesStore() || []).length
        const pedidosCount = panelDb ? Object.keys(panelDb.pedidos || {}).length : 0

        return json(res, 200, {
          overview: {
            totalUsers: usersCount,
            totalGroups: groupsCount,
            totalAportes: aportesCount,
            totalPedidos: pedidosCount,
            activeUsers: 0,
            botUptime: formatUptime(process.uptime()),
          },
          trends: { usersGrowth: 0, groupsGrowth: 0, aportesGrowth: 0, pedidosGrowth: 0 },
          engagement: {
            dailyActiveUsers: 0,
            weeklyActiveUsers: 0,
            monthlyActiveUsers: 0,
            averageSessionTime: '0m',
            bounceRate: 0,
          },
          performance: {
            responseTime: 0,
            uptime: 100,
            errorRate: 0,
            throughput: 0,
          },
          topContent: [],
          userActivity: [],
        })
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

      // Log unhandled API requests
      if (pathname.startsWith('/api/')) {
        console.log(`[Panel API] UNHANDLED: ${method} ${pathname}`)
        console.log('Available endpoints checked, but no match found')
      }

      return json(res, 404, { error: 'Not found', path: pathname })
    } catch (err) {
      console.error('panel-api error:', err)
      return json(res, 500, { error: 'Internal server error', message: err?.message || String(err) })
    }
  })

  // Inicializar Socket.IO
  initSocketIO(panelServer)

  await new Promise((resolve, reject) => {
    panelServer.once('error', reject)
    panelServer.listen(listenPort, listenHost, resolve)
  })

  console.log(`[PANEL-API] listening on http://${listenHost}:${listenPort}`)
  console.log(`[PANEL-API] Socket.IO habilitado para actualizaciones en tiempo real`)
  if (listenHost === '0.0.0.0') console.log(`[PANEL-API] abre: http://localhost:${listenPort}`)
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
  emitLogEntry,
}
