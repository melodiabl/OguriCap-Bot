/**
 * api/routes/auth.js — /api/auth/*
 * Extraído de lib/panel-api.js
 */
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { json, readJson, getJwtAuth, signJwt, sanitizeJwtUsuario, safeString, getClientIP, normalizeClientIP, clampInt, isAllowedIP } from '../middleware/core.js'
import { authLimiter } from '../middleware/rate-limit.js'
import { encryptPassword } from '../../lib/password-crypto.js'

function getConfig() { return global.db?.data?.config || {} }
function getPasswordEncryptionSecret() {
  return String(process.env.PANEL_PASSWORD_ENC_KEY || process.env.PASSWORD_ENC_KEY || process.env.JWT_SECRET || '').trim()
}
function setEncryptedPassword(user, plain) {
  try {
    const enc = encryptPassword(plain, getPasswordEncryptionSecret())
    if (enc) user.password_enc = enc
  } catch {}
}
function normalizeWhatsAppNumber(n) {
  return String(n || '').replace(/\D/g, '').replace(/^0+/, '')
}

export async function handleAuth({ req, res, url, panelDb }) {
  const pathname = url.pathname
  const method = req.method.toUpperCase()
  const db = global.db

  // ── POST /api/auth/login ──────────────────────────────────────────────────
  if (pathname === '/api/auth/login' && method === 'POST') {
    if (!authLimiter(req, res)) return json(res, 429, { error: 'Demasiados intentos. Espera 15 minutos.' })

    const body = await readJson(req)
    const { username, password, role, turnstileToken } = body || {}
    const clientIp = getClientIP(req)
    const userAgent = safeString(req.headers['user-agent'])

    if (!username || !password) return json(res, 400, { error: 'Usuario y contraseña requeridos' })

    // Turnstile
    const turnstileEnabled = process.env.TURNSTILE_DISABLED !== '1'
    const bypass = !turnstileEnabled || (process.env.TURNSTILE_BYPASS_ALLOWED_IPS === '1' && isAllowedIP(clientIp, panelDb))
    if (turnstileEnabled && !bypass) {
      if (!turnstileToken) return json(res, 400, { error: 'Token de verificación Turnstile requerido' })
      const secret = safeString(process.env.TURNSTILE_SECRET_KEY).trim()
      if (!secret) return json(res, 500, { error: 'TURNSTILE_SECRET_KEY no configurada' })
      try {
        const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret, response: turnstileToken }),
        })
        const d = await r.json()
        if (!d.success) return json(res, 401, { error: 'Verificación Turnstile fallida', errorCodes: d['error-codes'] || null })
      } catch { return json(res, 500, { error: 'Error al validar verificación de seguridad' }) }
    }

    const users = db?.data?.usuarios || {}
    const user = Object.values(users).find(u => u?.username === username)

    const alertTo = safeString(process.env.SECURITY_ALERT_EMAIL_TO || process.env.ADMIN_EMAIL || process.env.SMTP_USER || '').trim()
    global.__securityEmailThrottle ||= new Map()
    const canAlert = (key) => {
      const last = global.__securityEmailThrottle.get(key) || 0
      if (Date.now() - last < 120_000) return false
      global.__securityEmailThrottle.set(key, Date.now()); return true
    }
    const sendFailAlert = async (title, extra = []) => {
      try {
        global.sendTemplateNotification?.('login_failed', { username: username || 'unknown', ip: clientIp })
        if (alertTo && canAlert(`login_fail:${username}:${clientIp}`)) {
          const { sendSecurityAlertEmail } = await import('../../lib/email-service.js')
          void sendSecurityAlertEmail({ to: alertTo, subject: 'Alerta: login fallido', title, message: title,
            details: [{ label: 'Usuario', value: safeString(username) }, { label: 'IP', value: clientIp }, { label: 'User-Agent', value: userAgent || '-' }, ...extra] }).catch(() => {})
        }
      } catch {}
    }

    if (!user) { await sendFailAlert('Login fallido (usuario inexistente)'); return json(res, 401, { error: 'Credenciales inválidas' }) }
    if (user.activo === false) return json(res, 403, { error: 'Cuenta desactivada' })
    if (!await bcrypt.compare(password, user.password || '')) { await sendFailAlert('Login fallido (contraseña)'); return json(res, 401, { error: 'Credenciales inválidas' }) }
    if (role && user.rol !== role) { await sendFailAlert('Login fallido (rol)', [{ label: 'Rol pedido', value: safeString(role) }]); return json(res, 403, { error: 'No tienes permisos para acceder con este rol' }) }

    const config = getConfig()
    const jwtSecret = safeString(process.env.JWT_SECRET || config?.security?.jwtSecret || '').trim()
    if (!jwtSecret) throw new Error('JWT_SECRET no configurado')
    const token = jwt.sign({ username: user.username, rol: user.rol }, jwtSecret, { expiresIn: process.env.JWT_EXPIRY || config?.security?.jwtExpiry || '24h' })

    user.last_login = new Date().toISOString()
    user.login_ip = clientIp

    json(res, 200, {
      token,
      user: { id: user.id, username: user.username, rol: user.rol, email: user.email || user.correo || null,
        last_login: user.last_login, require_password_change: user.require_password_change || false,
        isTemporaryPassword: !!user.temp_password && !user.temp_password_used },
      message: user.require_password_change ? 'Se requiere cambio de contraseña' : undefined,
    })

    setImmediate(async () => {
      try {
        // Auto-add admin IP
        if (panelDb?.systemConfig?.autoAddAdminIPOnLogin && ['owner','admin','administrador'].includes(user.rol?.toLowerCase())) {
          const ip = normalizeClientIP(clientIp)
          if (ip && ip !== 'unknown') {
            const ips = panelDb.systemConfig.adminIPs ||= []
            if (!ips.some(a => normalizeClientIP(a) === ip)) ips.push(ip)
          }
        }
        if (db?.write) await db.write()
        global.sendTemplateNotification?.('user_login', { username: user.username })
      } catch {}
    })
    return
  }

  // ── POST /api/auth/register-public ───────────────────────────────────────
  if (pathname === '/api/auth/register-public' && method === 'POST') {
    const body = await readJson(req)
    const { email, username, password, whatsapp_number } = body || {}
    const clientIp = getClientIP(req)
    const emailStr = safeString(email).trim()
    const usernameStr = safeString(username).trim()
    const passwordStr = safeString(password)
    const whatsappClean = whatsapp_number ? normalizeWhatsAppNumber(safeString(whatsapp_number).trim()) : null

    if (!emailStr || !emailStr.includes('@')) return json(res, 400, { error: 'Email inválido' })
    if (!usernameStr || usernameStr.length < 3) return json(res, 400, { error: 'El usuario debe tener al menos 3 caracteres' })
    if (!passwordStr || passwordStr.length < 6) return json(res, 400, { error: 'La contraseña debe tener al menos 6 caracteres' })
    if (whatsapp_number && (!whatsappClean || whatsappClean.length < 8 || whatsappClean.length > 16)) return json(res, 400, { error: 'Número de WhatsApp inválido' })

    try {
      const emailValidator = (await import('deep-email-validator')).default
      const r = await emailValidator(emailStr)
      if (!r.valid && r.reason !== 'smtp') return json(res, 400, { error: 'El correo proporcionado no es un correo real o activo' })
    } catch {}

    const users = db?.data?.usuarios || {}
    if (Object.values(users).some(u => u?.username === usernameStr)) return json(res, 409, { error: 'El usuario ya existe' })
    if (Object.values(users).some(u => safeString(u?.email || u?.correo).trim().toLowerCase() === emailStr.toLowerCase())) return json(res, 409, { error: 'El email ya está en uso' })

    const hashed = await bcrypt.hash(passwordStr, 10)
    let createdId = null, fechaRegistro = new Date().toISOString()

    if (db?.pool?.query) {
      try {
        const r = await db.pool.query(
          `INSERT INTO usuarios (username, password, rol, whatsapp_number, activo, login_ip, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb) RETURNING id, fecha_registro`,
          [usernameStr, hashed, 'usuario', whatsappClean || null, true, clientIp || null, JSON.stringify({ email: emailStr, registered_via: 'public' })]
        )
        createdId = r?.rows?.[0]?.id ?? null
        if (r?.rows?.[0]?.fecha_registro) fechaRegistro = new Date(r.rows[0].fecha_registro).toISOString()
      } catch (err) {
        if (/duplicate key|unique constraint/i.test(err?.message || '')) return json(res, 409, { error: 'El usuario ya existe' })
        return json(res, 500, { error: 'No se pudo registrar el usuario' })
      }
    }

    if (!createdId) {
      createdId = Math.max(0, ...Object.keys(users).map(Number).filter(Number.isFinite)) + 1
    }

    db.data.usuarios[createdId] = {
      id: createdId, username: usernameStr, email: emailStr, whatsapp_number: whatsappClean || null,
      password: hashed, rol: 'usuario', fecha_registro: fechaRegistro, created_at: fechaRegistro,
      updated_at: fechaRegistro, activo: true, login_ip: clientIp || null,
    }

    if (!db?.pool?.query && db?.write) {
      try { await db.write() } catch (err) { delete db.data.usuarios[createdId]; return json(res, 500, { error: 'No se pudo registrar el usuario' }) }
    }

    try { global.sendTemplateNotification?.('user_registered', { username: usernameStr, email: emailStr }) } catch {}
    try { const { sendRegistrationEmail } = await import('../../lib/email-service.js'); void sendRegistrationEmail({ to: emailStr, username: usernameStr }).catch(() => {}) } catch {}

    return json(res, 201, { success: true, user: { id: createdId, username: usernameStr, rol: 'usuario', email: emailStr, whatsapp_number: whatsappClean || null }, message: 'Usuario registrado' })
  }

  // ── POST /api/auth/password-reset/request ────────────────────────────────
  if (pathname === '/api/auth/password-reset/request' && method === 'POST') {
    const body = await readJson(req)
    const identifier = safeString(body?.identifier || body?.email || body?.username || '').trim()
    if (!identifier) return json(res, 400, { error: 'Email o usuario requerido' })

    const users = db?.data?.usuarios || {}
    const isEmail = identifier.includes('@')
    const user = Object.values(users).find(u => {
      if (!u) return false
      return isEmail ? safeString(u.email || u.correo).trim().toLowerCase() === identifier.toLowerCase()
        : safeString(u.username).toLowerCase() === identifier.toLowerCase()
    })
    const to = safeString(user?.email || user?.correo).trim()

    if (user && to) {
      const rawToken = crypto.randomBytes(32).toString('hex')
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
      const expiresMs = clampInt(process.env.PASSWORD_RESET_EXPIRES_MINUTES, { min: 5, max: 180, fallback: 30 }) * 60_000
      const expiresAt = new Date(Date.now() + expiresMs).toISOString()
      user.reset_password_token_hash = tokenHash
      user.reset_password_expires = expiresAt
      if (db?.pool?.query && Number.isFinite(Number(user.id))) {
        try { await db.pool.query(`UPDATE usuarios SET metadata = COALESCE(metadata,'{}':jsonb)||$2::jsonb, updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [Number(user.id), JSON.stringify({ reset_password_token_hash: tokenHash, reset_password_expires: expiresAt })]) } catch {}
      } else if (db?.write) { await db.write().catch(() => {}) }
      try {
        const { sendPasswordResetEmail } = await import('../../lib/email-service.js')
        void sendPasswordResetEmail({ to, username: user.username, token: rawToken, expiresMinutes: Math.round(expiresMs / 60_000) }).catch(() => {})
      } catch {}
    }
    return json(res, 200, { success: true, message: 'Si el usuario existe, recibirás un email con instrucciones.' })
  }

  // ── POST /api/auth/password-reset/confirm ────────────────────────────────
  if (pathname === '/api/auth/password-reset/confirm' && method === 'POST') {
    const body = await readJson(req)
    const token = safeString(body?.token || '').trim()
    const newPassword = safeString(body?.newPassword || '').trim()
    if (!token) return json(res, 400, { error: 'Token requerido' })
    if (!newPassword || newPassword.length < 6) return json(res, 400, { error: 'La contraseña debe tener al menos 6 caracteres' })

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const users = db?.data?.usuarios || {}
    const matched = Object.values(users).find(u => {
      if (!u) return false
      const h = safeString(u.reset_password_token_hash || '').trim()
      const exp = new Date(safeString(u.reset_password_expires || '')).getTime()
      return h === tokenHash && Number.isFinite(exp) && exp > Date.now()
    })
    if (!matched) return json(res, 400, { error: 'Token inválido o expirado' })

    matched.password = await bcrypt.hash(newPassword, getConfig()?.security?.bcryptRounds || 10)
    Object.assign(matched, { password_changed_at: new Date().toISOString(), reset_password_token_hash: null, reset_password_expires: null, temp_password: null, require_password_change: false })
    if (db?.write) await db.write().catch(() => {})
    return json(res, 200, { success: true, message: 'Contraseña actualizada correctamente' })
  }

  // ── POST /api/auth/register (admin) ──────────────────────────────────────
  if (pathname === '/api/auth/register' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!['admin', 'owner'].includes(auth.user.rol)) return json(res, 403, { error: 'No tienes permisos para crear usuarios' })

    const body = await readJson(req)
    const { username, password, rol, whatsapp_number } = body || {}
    if (!username || !password || !rol) return json(res, 400, { error: 'Todos los campos son requeridos' })
    if (!['admin','colaborador','usuario','owner','creador','moderador'].includes(rol)) return json(res, 400, { error: 'Rol no válido' })

    const users = db?.data?.usuarios || {}
    if (Object.values(users).some(u => u?.username === username)) return json(res, 409, { error: 'El usuario ya existe' })

    const newId = Math.max(0, ...Object.keys(users).map(Number).filter(Number.isFinite)) + 1
    const hashed = await bcrypt.hash(password, getConfig()?.security?.bcryptRounds || 10)
    db.data.usuarios[newId] = { id: newId, username, password: hashed, rol, whatsapp_number: whatsapp_number || null, fecha_registro: new Date().toISOString(), created_at: new Date().toISOString(), activo: true }
    if (db?.write) await db.write()
    global.sendTemplateNotification?.('user_registered', { username, email: body.email || 'N/A' })
    return json(res, 200, { success: true, message: 'Usuario creado correctamente' })
  }

  // ── GET /api/auth/me ──────────────────────────────────────────────────────
  if (pathname === '/api/auth/me' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    return json(res, 200, sanitizeJwtUsuario(auth.user))
  }

  // ── GET /api/auth/verify ──────────────────────────────────────────────────
  if (pathname === '/api/auth/verify' && method === 'GET') {
    const auth = await getJwtAuth(req)
    return json(res, auth.ok ? 200 : auth.status, auth.ok ? { valid: true, user: sanitizeJwtUsuario(auth.user) } : { valid: false })
  }

  // ── POST /api/auth/change-password ────────────────────────────────────────
  if (pathname === '/api/auth/change-password' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    const { currentPassword, newPassword } = body || {}
    if (!currentPassword || !newPassword) return json(res, 400, { error: 'Contraseña actual y nueva son requeridas' })
    if (newPassword.length < 6) return json(res, 400, { error: 'La nueva contraseña debe tener al menos 6 caracteres' })
    if (!await bcrypt.compare(currentPassword, auth.user.password || '')) return json(res, 400, { error: 'Contraseña actual incorrecta' })
    if (await bcrypt.compare(newPassword, auth.user.password || '')) return json(res, 400, { error: 'La nueva contraseña debe ser diferente a la actual' })
    auth.user.password = await bcrypt.hash(newPassword, getConfig()?.security?.bcryptRounds || 10)
    Object.assign(auth.user, { password_changed_at: new Date().toISOString(), temp_password: null, require_password_change: false })
    if (db?.write) await db.write()
    global.sendTemplateNotification?.('password_changed', { username: auth.user.username })
    return json(res, 200, { success: true, message: 'Contraseña cambiada correctamente' })
  }

  // ── POST /api/auth/reset-password (via WhatsApp) ──────────────────────────
  if (pathname === '/api/auth/reset-password' && method === 'POST') {
    const body = await readJson(req)
    const { whatsapp_number, username } = body || {}
    if (!whatsapp_number || !username) return json(res, 400, { error: 'Número de WhatsApp y username son requeridos' })
    const users = db?.data?.usuarios || {}
    const user = Object.values(users).find(u => u?.username === username && u?.whatsapp_number === whatsapp_number)
    if (!user) return json(res, 404, { error: 'Usuario no encontrado o número de WhatsApp no coincide' })
    const tempPassword = 'reset' + Math.random().toString(36).substring(2, 8)
    user.password = await bcrypt.hash(tempPassword, getConfig()?.security?.bcryptRounds || 10)
    Object.assign(user, { temp_password: tempPassword, temp_password_expires: new Date(Date.now() + 86400000).toISOString(), temp_password_used: false, require_password_change: true })
    if (db?.write) await db.write()
    return json(res, 200, { success: true, message: 'Contraseña restablecida', tempPassword, username })
  }

  // ── POST /api/auth/auto-register (desde WhatsApp) ─────────────────────────
  if (pathname === '/api/auth/auto-register' && method === 'POST') {
    const body = await readJson(req)
    const { whatsapp_number, username, grupo_jid } = body || {}
    if (!whatsapp_number || !username || !grupo_jid) return json(res, 400, { error: 'Número de WhatsApp, username y grupo son requeridos' })
    const users = db?.data?.usuarios || {}
    if (Object.values(users).some(u => u?.username === username)) return json(res, 400, { error: 'El nombre de usuario ya existe' })
    const tempPassword = 'temp' + Math.random().toString(36).substring(2, 8)
    const newId = Math.max(0, ...Object.keys(users).map(Number).filter(Number.isFinite)) + 1
    db.data.usuarios[newId] = {
      id: newId, username, password: await bcrypt.hash(tempPassword, 10), rol: 'usuario',
      whatsapp_number, grupo_registro: grupo_jid, fecha_registro: new Date().toISOString(), activo: true,
      temp_password: tempPassword, temp_password_expires: new Date(Date.now() + 86400000).toISOString(),
      temp_password_used: false, require_password_change: true,
    }
    if (db?.write) await db.write()
    global.sendTemplateNotification?.('user_registered', { username, whatsapp: whatsapp_number })
    return json(res, 200, { success: true, message: 'Usuario registrado', tempPassword, username })
  }

  return json(res, 404, { error: 'Ruta no encontrada' })
}
