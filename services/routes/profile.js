// api/routes/profile.js
import { createHash } from 'crypto'
import { UAParser } from 'ua-parser-js'
import { json, readJson, getJwtAuth, safeString, getClientIP } from '../middleware/core.js'
import { pgGetUserMetadata, pgUpdateUserMetadata, pgRevokeDevice, pgAddKnownDevice } from '../lib/pg-usuarios.js'
import { pgFindUser } from '../lib/pg-usuarios.js'

function parseUA(ua, hints = {}) {
  const result = new UAParser(safeString(ua)).getResult()
  const browser = result.browser.name || 'Navegador'
  const os = result.os.name || 'Desconocido'

  // Client hints give the real model code when Chrome sends reduced UA (e.g. "K")
  const hintModel = hints.model && hints.model.length > 2 ? hints.model : null
  if (hintModel) {
    // Try to identify the code via ua-parser-js using a synthetic UA
    const hintResult = new UAParser(`Mozilla/5.0 (Linux; Android; ${hintModel} Build/X)`).getResult()
    if (hintResult.device.vendor) {
      const name = hintResult.device.model
        ? `${hintResult.device.vendor} ${hintResult.device.model}`
        : hintResult.device.vendor
      return { browser, os, model: name }
    }
    // Not in ua-parser-js DB — show platform + code
    return { browser, os, model: `${hints.platform || os} ${hintModel}` }
  }

  const { vendor, model } = result.device
  const raw = vendor && model ? `${vendor} ${model}` : vendor || model || null
  return { browser, os, model: raw && raw.length > 1 ? raw : null }
}

function deviceFingerprint(ip, ua) {
  const normalized = safeString(ua).replace(/\s+/g, ' ').trim().slice(0, 300)
  return createHash('sha256').update(`${ip}|${normalized}`).digest('hex').slice(0, 16)
}

const DEFAULT_NOTIF_PREFS = {
  login_new_device:  true,
  aporte_received:   true,
  aporte_aceptado:   true,
  aporte_rechazado:  true,
  aporte_pendiente:  true,
  role_changed:      true,
}

export async function handleProfile({ req, res, url }) {
  const method = req.method.toUpperCase()
  const pathname = url.pathname

  const auth = await getJwtAuth(req)
  if (!auth.ok) return json(res, auth.status, { error: auth.error })
  const username = safeString(auth.user?.username)

  // GET /api/profile/me
  if (pathname === '/api/profile/me' && method === 'GET') {
    const user = await pgFindUser(username)
    if (!user) return json(res, 404, { error: 'Usuario no encontrado' })
    return json(res, 200, {
      username: user.username,
      email: user.email || null,
      rol: user.rol,
      last_login: user.last_login || null,
      login_ip: user.login_ip || null,
      fecha_registro: user.fecha_registro || null,
    })
  }

  // POST /api/profile/devices/heartbeat — registers the current request's device
  if (pathname === '/api/profile/devices/heartbeat' && method === 'POST') {
    const clientIp = getClientIP(req)
    const userAgent = safeString(req.headers['user-agent'])
    const hash = deviceFingerprint(clientIp, userAgent)
    const body = await readJson(req).catch(() => ({}))
    const hints = { model: body?.uaHintModel, platform: body?.uaHintPlatform }
    const { browser, os, model } = parseUA(userAgent, hints)
    const now = new Date().toISOString()
    await pgAddKnownDevice(username, {
      hash, ip: clientIp, browser, os, model,
      ua: userAgent.slice(0, 300),
      first_seen: now,
      last_seen: now,
    })
    return json(res, 200, { ok: true, hash })
  }

  // GET /api/profile/devices
  if (pathname === '/api/profile/devices' && method === 'GET') {
    const meta = await pgGetUserMetadata(username)
    const devices = (meta.known_devices || []).map(d => ({
      hash: d.hash,
      ip: d.ip,
      browser: d.browser || 'Desconocido',
      os: d.os || 'Desconocido',
      model: d.model || null,
      first_seen: d.first_seen,
      last_seen: d.last_seen,
    }))
    return json(res, 200, { devices })
  }

  // DELETE /api/profile/devices/:hash
  const deviceDeleteMatch = pathname.match(/^\/api\/profile\/devices\/([a-f0-9]{8,32})$/)
  if (deviceDeleteMatch && method === 'DELETE') {
    const hash = deviceDeleteMatch[1]
    await pgRevokeDevice(username, hash)
    return json(res, 200, { ok: true })
  }

  // GET /api/profile/notifications
  if (pathname === '/api/profile/notifications' && method === 'GET') {
    const meta = await pgGetUserMetadata(username)
    const prefs = { ...DEFAULT_NOTIF_PREFS, ...(meta.notification_prefs || {}) }
    return json(res, 200, { prefs })
  }

  // PUT /api/profile/notifications
  if (pathname === '/api/profile/notifications' && method === 'PUT') {
    const body = await readJson(req)
    if (!body || typeof body !== 'object') return json(res, 400, { error: 'Body inválido' })
    const prefs = {}
    for (const key of Object.keys(DEFAULT_NOTIF_PREFS)) {
      if (key in body && typeof body[key] === 'boolean') prefs[key] = body[key]
    }
    await pgUpdateUserMetadata(username, { notification_prefs: prefs })
    return json(res, 200, { ok: true, prefs: { ...DEFAULT_NOTIF_PREFS, ...prefs } })
  }

  return json(res, 404, { error: 'Ruta no encontrada' })
}
