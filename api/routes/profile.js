// api/routes/profile.js
import { json, readJson, getJwtAuth, safeString } from '../middleware/core.js'
import { pgGetUserMetadata, pgUpdateUserMetadata, pgRevokeDevice } from '../lib/pg-usuarios.js'
import { pgFindUser } from '../lib/pg-usuarios.js'

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

  // GET /api/profile/devices
  if (pathname === '/api/profile/devices' && method === 'GET') {
    const meta = await pgGetUserMetadata(username)
    const devices = (meta.known_devices || []).map(d => ({
      hash: d.hash,
      ip: d.ip,
      browser: d.browser || 'Desconocido',
      os: d.os || 'Desconocido',
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
