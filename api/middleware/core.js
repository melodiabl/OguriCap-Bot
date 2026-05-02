/**
 * api/middleware/core.js
 * Helpers compartidos: json, cors, auth JWT, body parsing, SSE, IP utils
 */
import jwt from 'jsonwebtoken'

// ─── Response ────────────────────────────────────────────────────────────────
export function json(res, status, data) {
  const body = JSON.stringify(data ?? {})
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Length', Buffer.byteLength(body))
  res.end(body)
}

// ─── CORS ─────────────────────────────────────────────────────────────────────
export function withCors(req, res) {
  const origin = req.headers.origin
  const csv = v => String(v || '').split(',').map(s => s.trim()).filter(Boolean)

  const allowed = new Set([
    'http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000',
    ...csv(process.env.CORS_ORIGIN || ''),
    ...csv(process.env.PANEL_CORS_ORIGIN || ''),
    ...csv(process.env.SOCKET_IO_CORS_ORIGIN || ''),
  ])
  for (const u of [process.env.PANEL_URL, process.env.NEXT_PUBLIC_API_URL]) {
    try { if (u) allowed.add(new URL(u).origin) } catch {}
  }
  const suffixes = csv(process.env.CORS_ALLOW_DOMAIN_SUFFIXES || '').map(s => s.replace(/^\./, '').toLowerCase())
  const isDev = process.env.NODE_ENV !== 'production'

  const ok = origin && (
    allowed.has(origin) ||
    (suffixes.length && (() => {
      try { const h = new URL(origin).hostname.toLowerCase(); return suffixes.some(s => h === s || h.endsWith('.' + s)) }
      catch { return false }
    })()) ||
    (isDev && (origin.includes('.loca.lt') || origin.includes('.ngrok.io')))
  )

  res.setHeader('Access-Control-Allow-Origin', ok ? origin : (!origin ? '*' : 'null'))
  if (ok) res.setHeader('Access-Control-Allow-Credentials', 'true')
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, X-CSRF-Token')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Max-Age', '86400')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'SAMEORIGIN')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
  if (!isDev) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')

  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return true }
  return false
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export function getBearerToken(req) {
  const [, t] = (req.headers.authorization || '').match(/^Bearer\s+(.+)$/i) || []
  return t || ''
}

export function getTokenFromRequest(req, url) {
  return getBearerToken(req) || url?.searchParams?.get('token') || ''
}

export function verifyJwt(token) {
  const secret = String(process.env.JWT_SECRET || '').trim()
  if (!secret) throw new Error('JWT_SECRET no configurado')
  return jwt.verify(token, secret)
}

export function signJwt(payload, expiresIn = '7d') {
  const secret = String(process.env.JWT_SECRET || '').trim()
  if (!secret) throw new Error('JWT_SECRET no configurado')
  return jwt.sign(payload, secret, { expiresIn })
}

export async function getJwtAuth(req) {
  const token = getBearerToken(req)
  if (!token) return { ok: false, status: 401, error: 'Token requerido' }
  try {
    const decoded = verifyJwt(token)
    const username = decoded?.username
    if (!username) return { ok: false, status: 403, error: 'Token inválido' }
    const usuarios = global.db?.data?.usuarios || {}
    const user = Object.values(usuarios).find(u => u?.username === username)
    if (!user) return { ok: false, status: 401, error: 'Usuario no autenticado' }
    return { ok: true, user, decoded, usuarios }
  } catch {
    return { ok: false, status: 403, error: 'Token inválido' }
  }
}

export function getUserFromToken(token) {
  try {
    const decoded = verifyJwt(token)
    const username = decoded?.username
    if (!username) return null
    const usuarios = global.db?.data?.usuarios || {}
    return Object.values(usuarios).find(u => u?.username === username) || null
  } catch { return null }
}

// ─── Body ─────────────────────────────────────────────────────────────────────
export async function readJson(req) {
  let raw = ''
  for await (const c of req) raw += c
  return raw ? JSON.parse(raw) : {}
}

export async function readBodyBuffer(req, { limitBytes = 10 * 1024 * 1024 } = {}) {
  const chunks = []; let size = 0
  for await (const c of req) {
    const buf = Buffer.isBuffer(c) ? c : Buffer.from(c)
    size += buf.length
    if (size > limitBytes) { const e = new Error('Body too large'); e.code = 'LIMIT_BODY'; throw e }
    chunks.push(buf)
  }
  return Buffer.concat(chunks)
}

// ─── SSE ──────────────────────────────────────────────────────────────────────
export const sseClients = { aportes: new Set(), notificaciones: new Set() }

export function sseSend(res, payload) { res.write(`data: ${JSON.stringify(payload)}\n\n`) }

export function sseBroadcast(channel, payload) {
  for (const res of [...(sseClients[channel] || [])]) {
    try { sseSend(res, payload) } catch { sseClients[channel]?.delete(res) }
  }
}

export function sseInit(req, res, channel) {
  res.statusCode = 200
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  res.write('\n')
  sseClients[channel]?.add(res)
  const ms = Math.min(Math.max(Number(process.env.PANEL_SSE_KEEPALIVE_MS) || 25000, 5000), 120000)
  const ka = setInterval(() => { try { res.write(':keep-alive\n\n') } catch {} }, ms)
  req.on('close', () => { clearInterval(ka); sseClients[channel]?.delete(res) })
}

// ─── IP ───────────────────────────────────────────────────────────────────────
export function normalizeClientIP(ip) {
  let s = String(ip || '').trim()
  if (!s) return ''
  if (s.includes(',')) s = s.split(',')[0].trim()
  if (s.toLowerCase().startsWith('::ffff:')) s = s.slice(7)
  if (/^\d+\.\d+\.\d+\.\d+:\d+$/.test(s)) s = s.split(':')[0]
  if (s.startsWith('[') && s.includes(']')) s = s.slice(1, s.indexOf(']'))
  return s.trim()
}

export function getClientIP(req) {
  return normalizeClientIP(
    req.headers['cf-connecting-ip'] ||
    req.headers['cf-real-ip'] ||
    (req.headers['x-forwarded-for'] || '').split(',')[0] ||
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    req.socket?.remoteAddress || ''
  )
}

export function isAllowedIP(ip, panelDb) {
  const norm = normalizeClientIP(ip)
  return (panelDb?.systemConfig?.adminIPs || []).some(a => normalizeClientIP(a) === norm)
}

// ─── Utils ────────────────────────────────────────────────────────────────────
export const safeString = v => v == null ? '' : String(v)

export const clampInt = (v, { min, max, fallback }) => {
  const n = parseInt(v, 10)
  return Number.isFinite(n) ? Math.min(Math.max(n, min), max) : fallback
}

export function sanitizeJwtUsuario(u) {
  return {
    id: Number(u?.id || 0),
    username: safeString(u?.username),
    email: safeString(u?.email || u?.correo),
    whatsapp_number: safeString(u?.whatsapp_number),
    rol: safeString(u?.rol || 'usuario'),
    fecha_registro: u?.fecha_registro || u?.created_at || new Date().toISOString(),
    created_at: u?.created_at || u?.fecha_registro || new Date().toISOString(),
    activo: u?.activo !== false,
    last_login: u?.last_login || null,
    login_ip: u?.login_ip || null,
    require_password_change: u?.require_password_change || false,
  }
}

export function paginate(items, { page = 1, limit = 20 } = {}) {
  const arr = Array.isArray(items) ? items : []
  const p = Math.max(1, parseInt(page, 10) || 1)
  const l = Math.min(Math.max(1, parseInt(limit, 10) || 20), 200)
  const total = arr.length
  return { items: arr.slice((p - 1) * l, p * l), pagination: { page: p, limit: l, total, totalPages: Math.ceil(total / l) } }
}
