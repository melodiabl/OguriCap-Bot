import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { json, readJson, getJwtAuth, signJwt, sanitizeJwtUsuario, safeString, getClientIP, normalizeClientIP, clampInt, isAllowedIP } from '../middleware/core.js'
import { encryptPassword } from '../../lib/password-crypto.js'
import {
  pgFindUser, pgFindUserByEmail, pgCreateUser, pgUpdateUserLogin,
  pgUpdateUser
} from '../lib/pg-usuarios.js'

// Rate limiter inline para login (evita circular ESM binding)
const _loginAttempts = new Map()
function checkLoginRateLimit(req, res) {
  const ip = (req.headers['cf-connecting-ip'] || (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown')
  const now = Date.now(), windowMs = 15 * 60_000, max = 20
  let e = _loginAttempts.get(ip)
  if (!e || e.resetAt < now) { e = { count: 0, resetAt: now + windowMs }; _loginAttempts.set(ip, e) }
  e.count++
  if (e.count > max) { res.setHeader('Retry-After', Math.ceil((e.resetAt - now) / 1000)); return false }
  return true
}

function getConfig() { return global.db?.data?.config || {} }
function getPasswordEncryptionSecret() {
  return String(process.env.PANEL_PASSWORD_ENC_KEY || process.env.PASSWORD_ENC_KEY || process.env.JWT_SECRET || '').trim()
}
function normalizeWhatsAppNumber(n) {
  return String(n || '').replace(/\D/g, '').replace(/^0+/, '')
}

/** Busca usuario en PG */
async function findUser(username) {
  return pgFindUser(username)
}

/** Busca usuario por email en PG */
async function findUserByEmail(email) {
  return pgFindUserByEmail(email)
}

export async function handleAuth({ req, res, url, panelDb }) {
  const pathname = url.pathname
  const method = req.method.toUpperCase()
  const db = global.db

  // ── POST /api/auth/login ──────────────────────────────────────────────────
  if (pathname === '/api/auth/login' && method === 'POST') {
    if (!checkLoginRateLimit(req, res)) return json(res, 429, { error: 'Demasiados intentos. Espera 15 minutos.' })

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
    const user = await findUser(username)

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
        await pgUpdateUserLogin(username, clientIp)
        // Sync lowdb si el usuario viene de ahí
        if (user._source !== 'pg') {
          user.last_login = new Date().toISOString()
          user.login_ip = clientIp
          if (db?.write) await db.write()
        }
        if (panelDb?.systemConfig?.autoAddAdminIPOnLogin && ['owner','admin','administrador'].includes(user.rol?.toLowerCase())) {
          const ip = normalizeClientIP(clientIp)
          if (ip && ip !== 'unknown') {
            const ips = panelDb.systemConfig.adminIPs ||= []
            if (!ips.some(a => normalizeClientIP(a) === ip)) ips.push(ip)
          }
        }
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

    const [existByUser, existByEmail] = await Promise.all([pgFindUser(usernameStr), pgFindUserByEmail(emailStr)])
    if (existByUser) return json(res, 409, { error: 'El usuario ya existe' })
    if (existByEmail) return json(res, 409, { error: 'El email ya está en uso' })

    const hashed = await bcrypt.hash(passwordStr, 10)
    const pgUser = await pgCreateUser({ username: usernameStr, password: hashed, rol: 'usuario', whatsapp_number: whatsappClean, email: emailStr, clientIp })

    try { global.sendTemplateNotification?.('user_registered', { username: usernameStr, email: emailStr }) } catch {}
    try { const { sendRegistrationEmail } = await import('../../lib/email-service.js'); void sendRegistrationEmail({ to: emailStr, username: usernameStr }).catch(() => {}) } catch {}

    return json(res, 201, { success: true, user: { id: pgUser.id, username: usernameStr, rol: 'usuario', email: emailStr, whatsapp_number: whatsappClean || null }, message: 'Usuario registrado' })
  }

  // ── POST /api/auth/password-reset/request ────────────────────────────────
  if (pathname === '/api/auth/password-reset/request' && method === 'POST') {
    const body = await readJson(req)
    const identifier = safeString(body?.identifier || body?.email || body?.username || '').trim()
    if (!identifier) return json(res, 400, { error: 'Email o usuario requerido' })

    const isEmail = identifier.includes('@')
    const user = isEmail ? await findUserByEmail(identifier) : await findUser(identifier)
    const to = safeString(user?.email || user?.correo).trim()

    if (user && to) {
      const rawToken = crypto.randomBytes(32).toString('hex')
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
      const expiresMs = clampInt(process.env.PASSWORD_RESET_EXPIRES_MINUTES, { min: 5, max: 180, fallback: 30 }) * 60_000
      const expiresAt = new Date(Date.now() + expiresMs).toISOString()
      try {
        await db.pool.query(
          `UPDATE usuarios SET metadata = COALESCE(metadata,'{}':jsonb) || $2::jsonb WHERE id = $1`,
          [user.id, JSON.stringify({ reset_password_token_hash: tokenHash, reset_password_expires: expiresAt })]
        )
      } catch {}
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
    const { rows } = await db.pool.query(
      `SELECT * FROM usuarios WHERE metadata->>'reset_password_token_hash' = $1 LIMIT 1`, [tokenHash]
    )
    const row = rows[0]
    if (!row) return json(res, 400, { error: 'Token inválido o expirado' })
    const exp = new Date(row.metadata?.reset_password_expires || 0).getTime()
    if (exp < Date.now()) return json(res, 400, { error: 'Token inválido o expirado' })

    const hashed = await bcrypt.hash(newPassword, 10)
    await db.pool.query(
      `UPDATE usuarios SET password=$2, require_password_change=false, temp_password=null,
       metadata = metadata - 'reset_password_token_hash' - 'reset_password_expires' WHERE id=$1`,
      [row.id, hashed]
    )
    return json(res, 200, { success: true, message: 'Contraseña actualizada correctamente' })
  }

  // ── POST /api/auth/register (admin) ──────────────────────────────────────
  if (pathname === '/api/auth/register' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!['admin', 'owner'].includes(auth.user.rol)) return json(res, 403, { error: 'No tienes permisos para crear usuarios' })
    const body = await readJson(req)
    const { username, password, rol, whatsapp_number, email } = body || {}
    if (!username || !password || !rol) return json(res, 400, { error: 'Todos los campos son requeridos' })
    if (!['admin','colaborador','usuario','owner','creador','moderador'].includes(rol)) return json(res, 400, { error: 'Rol no válido' })
    const existing = await pgFindUser(username)
    if (existing) return json(res, 409, { error: 'El usuario ya existe' })
    const hashed = await bcrypt.hash(password, 10)
    const pgUser = await pgCreateUser({ username, password: hashed, rol, whatsapp_number: whatsapp_number || null, email: email || null })
    global.sendTemplateNotification?.('user_registered', { username, email: email || 'N/A' })
    return json(res, 200, { success: true, message: 'Usuario creado correctamente', user: sanitizeJwtUsuario(pgUser) })
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
    const user = await pgFindUser(auth.user.username)
    if (!user || !await bcrypt.compare(currentPassword, user.password || '')) return json(res, 400, { error: 'Contraseña actual incorrecta' })
    if (await bcrypt.compare(newPassword, user.password || '')) return json(res, 400, { error: 'La nueva contraseña debe ser diferente a la actual' })
    const hashed = await bcrypt.hash(newPassword, 10)
    await pgUpdateUser(auth.user.username, { password: hashed, require_password_change: false, temp_password: null })
    global.sendTemplateNotification?.('password_changed', { username: auth.user.username })
    return json(res, 200, { success: true, message: 'Contraseña cambiada correctamente' })
  }

  // ── POST /api/auth/reset-password (via WhatsApp) ──────────────────────────
  if (pathname === '/api/auth/reset-password' && method === 'POST') {
    const body = await readJson(req)
    const { whatsapp_number, username } = body || {}
    if (!whatsapp_number || !username) return json(res, 400, { error: 'Número de WhatsApp y username son requeridos' })
    const { rows } = await db.pool.query(
      'SELECT * FROM usuarios WHERE username=$1 AND whatsapp_number=$2 LIMIT 1', [username, whatsapp_number]
    )
    if (!rows[0]) return json(res, 404, { error: 'Usuario no encontrado o número de WhatsApp no coincide' })
    const tempPassword = 'reset' + Math.random().toString(36).substring(2, 8)
    const hashed = await bcrypt.hash(tempPassword, 10)
    await db.pool.query(
      `UPDATE usuarios SET password=$2, temp_password=$3, require_password_change=true WHERE id=$1`,
      [rows[0].id, hashed, tempPassword]
    )
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
