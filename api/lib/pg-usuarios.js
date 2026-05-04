/**
 * api/lib/pg-usuarios.js
 * Acceso directo a la tabla `usuarios` en PostgreSQL via global.db.pool
 */

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
    const { rows } = await pool().query(`SELECT * FROM usuarios WHERE metadata->>'email' = $1 LIMIT 1`, [email])
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
  const allowed = ['password', 'rol', 'activo', 'whatsapp_number', 'require_password_change', 'temp_password', 'temp_password_expires']
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

export function normalizeUser(row) {
  if (!row) return null
  const meta = typeof row.metadata === 'object' ? (row.metadata || {}) : {}
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    rol: row.rol,
    email: meta.email || null,
    correo: meta.email || null,
    whatsapp_number: row.whatsapp_number,
    activo: row.activo !== false,
    last_login: row.last_login,
    login_ip: row.login_ip,
    fecha_registro: row.fecha_registro || row.created_at,
    require_password_change: row.require_password_change || false,
    temp_password: row.temp_password || null,
    temp_password_expires: row.temp_password_expires || null,
    metadata: meta,
    _source: 'pg',
  }
}
