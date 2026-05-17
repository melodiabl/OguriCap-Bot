import bcrypt from 'bcryptjs'
import crypto, { createHash } from 'node:crypto'
import { createAccessToken, createRefreshToken, hashRefreshToken, verifyAccessToken, ACCESS_TOKEN_SECONDS } from '../../lib/jwt/index.js'
import { json, readJson, getJwtAuth, getBearerToken, signJwt, sanitizeJwtUsuario, safeString, getClientIP, normalizeClientIP, clampInt, isAllowedIP } from '../middleware/core.js'
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

function deviceFingerprint(ip, ua) {
  const normalized = safeString(ua).replace(/\s+/g, ' ').trim().slice(0, 300)
  return createHash('sha256').update(`${ip}|${normalized}`).digest('hex').slice(0, 16)
}

function parseBrowserOS(ua) {
  const s = safeString(ua)
  let browser = 'Navegador'
  let os = 'Sistema operativo'
  if (/Edg\//.test(s)) browser = 'Edge'
  else if (/OPR\/|Opera/.test(s)) browser = 'Opera'
  else if (/Chrome\//.test(s)) browser = 'Chrome'
  else if (/Safari\//.test(s) && !/Chrome/.test(s)) browser = 'Safari'
  else if (/Firefox\//.test(s)) browser = 'Firefox'
  else if (/MSIE|Trident/.test(s)) browser = 'Internet Explorer'
  if (/Windows NT/.test(s)) os = 'Windows'
  else if (/Android/.test(s)) os = 'Android'
  else if (/iPhone|iPad/.test(s)) os = 'iOS'
  else if (/Mac OS X/.test(s)) os = 'macOS'
  else if (/Linux/.test(s)) os = 'Linux'
  return { browser, os }
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
          const { sendSecurityAlertEmail } = await import('../../lib/email/index.js')
          void sendSecurityAlertEmail({ to: alertTo, subject: 'Alerta: login fallido', title, message: title,
            details: [{ label: 'Usuario', value: safeString(username) }, { label: 'IP', value: clientIp }, { label: 'User-Agent', value: userAgent || '-' }, ...extra] }).catch(() => {})
        }
      } catch {}
    }

    if (!user) { await sendFailAlert('Login fallido (usuario inexistente)'); return json(res, 401, { error: 'Credenciales inválidas' }) }
    if (user.activo === false) return json(res, 403, { error: 'Cuenta desactivada' })
    if (!await bcrypt.compare(password, user.password || '')) { await sendFailAlert('Login fallido (contraseña)'); return json(res, 401, { error: 'Credenciales inválidas' }) }
    if (role && user.rol !== role) { await sendFailAlert('Login fallido (rol)', [{ label: 'Rol pedido', value: safeString(role) }]); return json(res, 403, { error: 'No tienes permisos para acceder con este rol' }) }

    const { token, jti, expiresIn } = createAccessToken({ username: user.username, rol: user.rol })
    const { rawToken: refreshRaw, tokenHash: refreshHash } = createRefreshToken()

    // Store refresh token in DB
    const familyId = crypto.randomUUID()
    const refreshExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const deviceHint = crypto.createHash('sha256').update(userAgent || '').digest('hex').slice(0, 16)
    try {
      await db.pool.query(
        `INSERT INTO refresh_tokens (token_hash, user_id, family_id, device_hint, expires_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [refreshHash, user.id, familyId, deviceHint, refreshExpires]
      )
    } catch {}

    user.last_login = new Date().toISOString()
    user.login_ip = clientIp

    // Set both tokens as httpOnly cookies
    const isSecure = process.env.NODE_ENV === 'production'
    res.setHeader('Set-Cookie', [
      `auth_token=${token}; HttpOnly; ${isSecure ? 'Secure; ' : ''}SameSite=Strict; Path=/; Max-Age=${ACCESS_TOKEN_SECONDS}`,
      `refresh_token=${refreshRaw}; HttpOnly; ${isSecure ? 'Secure; ' : ''}SameSite=Strict; Path=/api/auth/refresh; Max-Age=${7 * 24 * 3600}`,
    ])
    json(res, 200, {
      token,
      expiresIn,
      user: { id: user.id, username: user.username, rol: user.rol, email: user.email || user.correo || null,
        last_login: user.last_login, require_password_change: user.require_password_change || false,
        isTemporaryPassword: !user.temp_password_used },
      message: user.require_password_change ? 'Se requiere cambio de contraseña' : undefined,
    })

    setImmediate(async () => {
      try {
        await pgUpdateUserLogin(username, clientIp)
        // Detección de nuevo dispositivo
        try {
          const { pgGetUserMetadata, pgAddKnownDevice } = await import('../lib/pg-usuarios.js')
          const meta = await pgGetUserMetadata(username)
          const devices = meta.known_devices || []
          const notifPrefs = meta.notification_prefs || {}
          const hash = deviceFingerprint(clientIp, userAgent)
          const isNew = !devices.some(d => d.hash === hash)
          const { browser, os } = parseBrowserOS(userAgent)
          const now = new Date().toISOString()
          await pgAddKnownDevice(username, {
            hash, ip: clientIp, browser, os, ua: safeString(userAgent).slice(0, 300),
            ...(isNew ? { first_seen: now } : {}),
            last_seen: now,
          })
          if (isNew && notifPrefs.login_new_device !== false) {
            const userEmail = meta.email || null
            if (userEmail) {
              const { sendLoginNewDeviceEmail } = await import('../../lib/email/index.js')
              void sendLoginNewDeviceEmail({
                to: userEmail,
                username,
                ip: clientIp,
                location: '-',
                device: `${browser} en ${os}`,
                time: new Date().toUTCString(),
              }).catch(() => {})
            }
          }
        } catch {}
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
    try { const { sendRegistrationEmail } = await import('../../lib/email/index.js'); void sendRegistrationEmail({ to: emailStr, username: usernameStr }).catch(() => {}) } catch {}

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
          `UPDATE usuarios SET metadata = COALESCE(metadata,'{}' ::jsonb) || $2::jsonb WHERE id = $1`,
          [user.id, JSON.stringify({ reset_password_token_hash: tokenHash, reset_password_expires: expiresAt })]
        )
      } catch {}
      try {
        const { sendPasswordResetEmail } = await import('../../lib/email/index.js')
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

  // ── POST /api/auth/logout ─────────────────────────────────────────────────
  if (pathname === '/api/auth/logout' && method === 'POST') {
    // Parse cookies
    const logoutCookies = {}
    for (const part of String(req.headers.cookie || '').split(';')) {
      const idx = part.indexOf('=')
      if (idx < 0) continue
      logoutCookies[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim())
    }

    // Revoke refresh token from DB
    const rawRefresh = logoutCookies['refresh_token']
    if (rawRefresh && db?.pool) {
      const hash = hashRefreshToken(rawRefresh)
      await db.pool.query('DELETE FROM refresh_tokens WHERE token_hash = $1', [hash]).catch(() => {})
    }

    // Blacklist access token JTI
    const bearerToken = getBearerToken(req) || logoutCookies['auth_token']
    if (bearerToken && db?.pool) {
      try {
        const payload = verifyAccessToken(bearerToken)
        if (payload?.jti) {
          const expMs = (payload.exp || 0) * 1000
          await db.pool.query(
            'INSERT INTO token_blacklist (jti, expires_at) VALUES ($1, $2) ON CONFLICT DO NOTHING',
            [payload.jti, new Date(expMs)]
          ).catch(() => {})
        }
      } catch {}
    }

    const isSecure = process.env.NODE_ENV === 'production'
    res.setHeader('Set-Cookie', [
      `auth_token=; HttpOnly; ${isSecure ? 'Secure; ' : ''}SameSite=Strict; Path=/; Max-Age=0`,
      `refresh_token=; HttpOnly; ${isSecure ? 'Secure; ' : ''}SameSite=Strict; Path=/api/auth/refresh; Max-Age=0`,
    ])
    return json(res, 200, { success: true })
  }

  // ── POST /api/auth/refresh ─────────────────────────────────────────────────
  if (pathname === '/api/auth/refresh' && method === 'POST') {
    const refreshCookies = {}
    for (const part of String(req.headers.cookie || '').split(';')) {
      const idx = part.indexOf('=')
      if (idx < 0) continue
      refreshCookies[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim())
    }
    const rawRefresh = refreshCookies['refresh_token']
    if (!rawRefresh) return json(res, 401, { error: 'Refresh token requerido' })

    const tokenHash = hashRefreshToken(rawRefresh)

    let row
    try {
      const { rows } = await db.pool.query(
        `SELECT * FROM refresh_tokens WHERE token_hash = $1 AND expires_at > NOW() LIMIT 1`,
        [tokenHash]
      )
      row = rows[0]
    } catch { return json(res, 500, { error: 'Error de base de datos' }) }

    if (!row) return json(res, 401, { error: 'Refresh token inválido o expirado' })

    // Detect token reuse (theft): if already used, revoke entire family
    if (row.used_at) {
      await db.pool.query('DELETE FROM refresh_tokens WHERE family_id = $1', [row.family_id]).catch(() => {})
      return json(res, 401, { error: 'Token reutilizado — sesión revocada por seguridad' })
    }

    // Mark current token as used
    await db.pool.query('UPDATE refresh_tokens SET used_at = NOW() WHERE id = $1', [row.id]).catch(() => {})

    // Find user
    const { pgFindUserById } = await import('../lib/pg-usuarios.js')
    const user = await pgFindUserById(row.user_id)
    if (!user || !user.activo) return json(res, 401, { error: 'Usuario no válido' })

    // Issue new token pair
    const { token, jti, expiresIn } = createAccessToken({ username: user.username, rol: user.rol })
    const { rawToken: newRawRefresh, tokenHash: newRefreshHash } = createRefreshToken()

    const newExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    await db.pool.query(
      `INSERT INTO refresh_tokens (token_hash, user_id, family_id, device_hint, expires_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [newRefreshHash, user.id, row.family_id, row.device_hint, newExpires]
    ).catch(() => {})

    // Lazy cleanup expired blacklist entries
    db.pool.query('DELETE FROM token_blacklist WHERE expires_at < NOW()').catch(() => {})

    const isSecure = process.env.NODE_ENV === 'production'
    res.setHeader('Set-Cookie', [
      `auth_token=${token}; HttpOnly; ${isSecure ? 'Secure; ' : ''}SameSite=Strict; Path=/; Max-Age=${ACCESS_TOKEN_SECONDS}`,
      `refresh_token=${newRawRefresh}; HttpOnly; ${isSecure ? 'Secure; ' : ''}SameSite=Strict; Path=/api/auth/refresh; Max-Age=${7 * 24 * 3600}`,
    ])
    return json(res, 200, { token, expiresIn })
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
    const tempPassword = 'r-' + crypto.randomBytes(6).toString('hex')
    const hashed = await bcrypt.hash(tempPassword, 10)
    await db.pool.query(
      `UPDATE usuarios SET password=$2, temp_password=null, require_password_change=true WHERE id=$1`,
      [rows[0].id, hashed]
    )
    // Send temp password via WhatsApp — never include it in the HTTP response
    try {
      const normalizedNum = normalizeWhatsAppNumber(rows[0].whatsapp_number)
      const jid = normalizedNum + '@s.whatsapp.net'
      global.conn?.sendMessage(jid, {
        text: `🔑 Tu contraseña temporal para *${username}* es:\n\n\`${tempPassword}\`\n\nInicia sesión y cámbiala de inmediato.`
      })
    } catch {}
    return json(res, 200, { success: true, message: 'Contraseña restablecida. Revisa tu WhatsApp.' })
  }

  // ── POST /api/auth/auto-register (desde WhatsApp — solo bot interno) ────────
  if (pathname === '/api/auth/auto-register' && method === 'POST') {
    const botSecret = process.env.INTERNAL_BOT_SECRET
    if (!botSecret || req.headers['x-bot-secret'] !== botSecret) {
      return json(res, 403, { error: 'Acceso denegado' })
    }
    const body = await readJson(req)
    const { whatsapp_number, username, grupo_jid } = body || {}
    if (!whatsapp_number || !username || !grupo_jid) return json(res, 400, { error: 'Número de WhatsApp, username y grupo son requeridos' })
    const users = db?.data?.usuarios || {}
    if (Object.values(users).some(u => u?.username === username)) return json(res, 400, { error: 'El nombre de usuario ya existe' })
    const tempPassword = 't-' + crypto.randomBytes(6).toString('hex')
    const newId = Math.max(0, ...Object.keys(users).map(Number).filter(Number.isFinite)) + 1
    db.data.usuarios[newId] = {
      id: newId, username, password: await bcrypt.hash(tempPassword, 10), rol: 'usuario',
      whatsapp_number, grupo_registro: grupo_jid, fecha_registro: new Date().toISOString(), activo: true,
      temp_password_expires: new Date(Date.now() + 86400000).toISOString(),
      temp_password_used: false, require_password_change: true,
    }
    if (db?.write) await db.write()
    global.sendTemplateNotification?.('user_registered', { username, whatsapp: whatsapp_number })
    return json(res, 200, { success: true, message: 'Usuario registrado', tempPassword, username })
  }

  return json(res, 404, { error: 'Ruta no encontrada' })
}
