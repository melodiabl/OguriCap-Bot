/**
 * api/lib/pg-usuarios.js
 * Acceso directo a la tabla `usuarios` en PostgreSQL via global.db.pool
 */

import { decryptPII, blindIndex } from '../../lib/crypto/pii.js'

function pool() { return global.db?.pool }

export async function pgFindUser(username) {
  try {
    const { rows } = await pool().query('SELECT * FROM usuarios WHERE username = $1 LIMIT 1', [username])
    return rows[0] ? normalizeUser(rows[0]) : null
  } catch { return null }
}

export async function pgFindUserById(id) {
  try {
    const { rows } = await pool().query('SELECT * FROM usuarios WHERE id = $1 LIMIT 1', [id])
    return rows[0] ? normalizeUser(rows[0]) : null
  } catch { return null }
}

export async function pgFindUserByEmail(email) {
  try {
    const hash = blindIndex(String(email).toLowerCase().trim())
    const { rows } = await pool().query(
      `SELECT * FROM usuarios WHERE email_hash = $1 OR metadata->>'email' = $2 LIMIT 1`,
      [hash, email]
    )
    return rows[0] ? normalizeUser(rows[0]) : null
  } catch { return null }
}

export async function pgFindUserByWhatsapp(whatsappNumber) {
  try {
    const normalized = String(whatsappNumber).replace(/\D/g, '').replace(/^0+/, '')
    const hash = blindIndex(normalized)
    const { rows } = await pool().query(
      `SELECT * FROM usuarios WHERE whatsapp_hash = $1 OR whatsapp_number = $2 LIMIT 1`,
      [hash, normalized]
    )
    return rows[0] ? normalizeUser(rows[0]) : null
  } catch { return null }
}

export async function pgCreateUser({ username, password, rol = 'usuario', whatsapp_number = null, email = null, clientIp = null }) {
  const metadata = email ? JSON.stringify({ email }) : '{}'
  const { rows } = await pool().query(
    `INSERT INTO usuarios (username, password, rol, whatsapp_number, activo, login_ip, metadata)
     VALUES ($1,$2,$3,$4,true,$5,$6::jsonb) RETURNING *`,
    [username, password, rol, whatsapp_number, clientIp, metadata]
  )
  return normalizeUser(rows[0])
}

export async function pgUpdateUserLogin(username, clientIp) {
  try {
    await pool().query('UPDATE usuarios SET last_login=NOW(), login_ip=$2 WHERE username=$1', [username, clientIp])
  } catch {}
}

export async function pgUpdateUser(username, fields) {
  const allowed = [
    'password', 'rol', 'activo', 'whatsapp_number', 'require_password_change',
    'email', 'email_hash', 'whatsapp_hash', 'whatsapp_enc',
  ]
  const sets = [], vals = []
  let i = 1
  for (const [k, v] of Object.entries(fields)) {
    if (!allowed.includes(k)) continue
    sets.push(`${k} = $${i++}`)
    vals.push(v)
  }
  if (!sets.length) return null
  vals.push(username)
  const { rows } = await pool().query(
    `UPDATE usuarios SET ${sets.join(', ')} WHERE username = $${i} RETURNING *`, vals
  )
  return normalizeUser(rows[0])
}

export async function pgListUsers({ limit = 100, offset = 0, rol = null } = {}) {
  const where = rol ? 'WHERE rol = $3' : ''
  const params = rol ? [limit, offset, rol] : [limit, offset]
  const { rows } = await pool().query(
    `SELECT * FROM usuarios ${where} ORDER BY fecha_registro DESC LIMIT $1 OFFSET $2`, params
  )
  return rows.map(normalizeUser)
}

export async function pgDeleteUser(username) {
  await pool().query('UPDATE usuarios SET activo=false WHERE username=$1', [username])
}

export async function pgGetUserMetadata(username) {
  try {
    const { rows } = await pool().query(
      'SELECT metadata FROM usuarios WHERE username = $1 LIMIT 1', [username]
    )
    if (!rows[0]) return {}
    return typeof rows[0].metadata === 'object' ? (rows[0].metadata || {}) : {}
  } catch { return {} }
}

export async function pgUpdateUserMetadata(username, patch) {
  try {
    const current = await pgGetUserMetadata(username)
    const merged = { ...current, ...patch }
    await pool().query(
      `UPDATE usuarios SET metadata = $1::jsonb WHERE username = $2`,
      [JSON.stringify(merged), username]
    )
  } catch {}
}

export async function pgAddKnownDevice(username, device) {
  try {
    const meta = await pgGetUserMetadata(username)
    const devices = Array.isArray(meta.known_devices) ? meta.known_devices : []
    const idx = devices.findIndex(d => d.hash === device.hash)
    if (idx >= 0) {
      devices[idx] = { ...devices[idx], ...device }
    } else {
      devices.push(device)
    }
    if (devices.length > 20) devices.splice(0, devices.length - 20)
    await pgUpdateUserMetadata(username, { known_devices: devices })
  } catch {}
}

export async function pgRevokeDevice(username, hash) {
  try {
    const meta = await pgGetUserMetadata(username)
    const devices = (meta.known_devices || []).filter(d => d.hash !== hash)
    await pgUpdateUserMetadata(username, { known_devices: devices })
  } catch {}
}

export function normalizeUser(row) {
  if (!row) return null
  const { email_hash, whatsapp_hash, ...rest } = row
  return {
    ...rest,
    email: decryptPII(row.email) ?? row.metadata?.email ?? null,
    whatsapp_number: decryptPII(row.whatsapp_enc) ?? row.whatsapp_number ?? null,
  }
}
