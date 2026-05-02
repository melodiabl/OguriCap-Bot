/**
 * api/routes/usuarios.js — /api/usuarios/* + /api/users
 * Extraído de lib/panel-api.js
 */
import bcrypt from 'bcryptjs'
import { json, readJson, getJwtAuth, safeString, paginate, sanitizeJwtUsuario } from '../middleware/core.js'

function isAdmin(user) {
  return ['owner', 'admin', 'administrador'].includes(safeString(user?.rol || '').toLowerCase())
}

export async function handleUsuarios({ req, res, url, panelDb }) {
  const pathname = url.pathname
  const method = req.method.toUpperCase()
  const db = global.db

  // ── GET /api/users (alias simple) ────────────────────────────────────────
  if (pathname === '/api/users' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const users = Object.values(db?.data?.usuarios || {}).map(sanitizeJwtUsuario)
    return json(res, 200, { users, total: users.length })
  }

  // ── GET /api/usuarios/stats ───────────────────────────────────────────────
  if (pathname === '/api/usuarios/stats' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const users = Object.values(db?.data?.usuarios || {})
    return json(res, 200, {
      total: users.length,
      activos: users.filter(u => u?.activo !== false).length,
      inactivos: users.filter(u => u?.activo === false).length,
      porRol: users.reduce((acc, u) => { const r = safeString(u?.rol || 'usuario'); acc[r] = (acc[r] || 0) + 1; return acc }, {}),
    })
  }

  // ── GET /api/usuarios ─────────────────────────────────────────────────────
  if (pathname === '/api/usuarios' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const users = Object.values(db?.data?.usuarios || {})
    const search = safeString(url.searchParams.get('search') || '').toLowerCase()
    const rol = safeString(url.searchParams.get('rol') || '').toLowerCase()
    let filtered = users
    if (search) filtered = filtered.filter(u => safeString(u?.username).toLowerCase().includes(search) || safeString(u?.email || u?.correo).toLowerCase().includes(search))
    if (rol) filtered = filtered.filter(u => safeString(u?.rol || '').toLowerCase() === rol)
    const { items, pagination } = paginate(filtered.map(sanitizeJwtUsuario), { page: url.searchParams.get('page'), limit: url.searchParams.get('limit') })
    return json(res, 200, { usuarios: items, pagination })
  }

  // ── POST /api/usuarios ────────────────────────────────────────────────────
  if (pathname === '/api/usuarios' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const body = await readJson(req)
    const { username, password, rol, email, whatsapp_number } = body || {}
    if (!username || !password) return json(res, 400, { error: 'username y password son requeridos' })
    if (!['admin','colaborador','usuario','owner','creador','moderador'].includes(rol || 'usuario')) return json(res, 400, { error: 'Rol no válido' })
    const users = db?.data?.usuarios || {}
    if (Object.values(users).some(u => u?.username === username)) return json(res, 409, { error: 'El usuario ya existe' })
    const newId = Math.max(0, ...Object.keys(users).map(Number).filter(Number.isFinite)) + 1
    const hashed = await bcrypt.hash(password, 10)
    db.data.usuarios[newId] = { id: newId, username, password: hashed, rol: rol || 'usuario', email: email || null, whatsapp_number: whatsapp_number || null, fecha_registro: new Date().toISOString(), created_at: new Date().toISOString(), activo: true }
    if (db?.write) await db.write()
    global.sendTemplateNotification?.('user_registered', { username, email: email || 'N/A' })
    return json(res, 201, { success: true, user: sanitizeJwtUsuario(db.data.usuarios[newId]) })
  }

  // ── GET /api/usuarios/:id ─────────────────────────────────────────────────
  const idMatch = pathname.match(/^\/api\/usuarios\/(\d+)$/)
  if (idMatch) {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const id = idMatch[1]
    const user = db?.data?.usuarios?.[id]
    if (!user) return json(res, 404, { error: 'Usuario no encontrado' })
    if (!isAdmin(auth.user) && String(auth.user.id) !== String(id)) return json(res, 403, { error: 'Sin permisos' })

    if (method === 'GET') return json(res, 200, sanitizeJwtUsuario(user))

    if (method === 'PATCH' || method === 'PUT') {
      if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
      const body = await readJson(req)
      const allowed = ['email', 'whatsapp_number', 'rol', 'activo', 'nombre']
      for (const k of allowed) { if (k in body) user[k] = body[k] }
      if (body.password) user.password = await bcrypt.hash(body.password, 10)
      user.updated_at = new Date().toISOString()
      if (db?.write) await db.write()
      return json(res, 200, { success: true, user: sanitizeJwtUsuario(user) })
    }

    if (method === 'DELETE') {
      if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
      if (String(auth.user.id) === String(id)) return json(res, 400, { error: 'No puedes eliminarte a ti mismo' })
      delete db.data.usuarios[id]
      if (db?.write) await db.write()
      return json(res, 200, { success: true, message: 'Usuario eliminado' })
    }
  }

  return json(res, 404, { error: 'Ruta no encontrada' })
}
