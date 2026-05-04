/**
 * api/routes/usuarios.js — /api/usuarios/* + /api/users
 * Usa PostgreSQL como fuente primaria, lowdb como fallback.
 */
import bcrypt from 'bcryptjs'
import { json, readJson, getJwtAuth, safeString, paginate, sanitizeJwtUsuario } from '../middleware/core.js'
import { pgFindUser, pgFindUserById, pgCreateUser, pgUpdateUser, pgListUsers, pgDeleteUser, normalizeUser } from '../lib/pg-usuarios.js'

function isAdmin(user) {
  return ['owner', 'admin', 'administrador'].includes(safeString(user?.rol || '').toLowerCase())
}

async function getAllUsers() {
  const pgUsers = await pgListUsers({ limit: 1000 })
  if (pgUsers.length > 0) return pgUsers.map(normalizeUser)
  return Object.values(global.db?.data?.usuarios || {})
}

export async function handleUsuarios({ req, res, url, panelDb }) {
  const pathname = url.pathname
  const method = req.method.toUpperCase()
  const db = global.db

  // ── GET /api/users (alias) ────────────────────────────────────────────────
  if (pathname === '/api/users' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const users = (await getAllUsers()).map(sanitizeJwtUsuario)
    return json(res, 200, { users, total: users.length })
  }

  // ── GET /api/usuarios/stats ───────────────────────────────────────────────
  if (pathname === '/api/usuarios/stats' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const users = await getAllUsers()
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
    const search = safeString(url.searchParams.get('search') || '').toLowerCase()
    const rol = safeString(url.searchParams.get('rol') || '').toLowerCase()
    let users = await getAllUsers()
    if (search) users = users.filter(u => safeString(u?.username).toLowerCase().includes(search) || safeString(u?.email || u?.correo).toLowerCase().includes(search))
    if (rol) users = users.filter(u => safeString(u?.rol || '').toLowerCase() === rol)
    const { items, pagination } = paginate(users.map(sanitizeJwtUsuario), { page: url.searchParams.get('page'), limit: url.searchParams.get('limit') })
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
    const existing = await pgFindUser(username)
    if (existing || Object.values(db?.data?.usuarios || {}).some(u => u?.username === username)) return json(res, 409, { error: 'El usuario ya existe' })
    const hashed = await bcrypt.hash(password, 10)
    const pgUser = await pgCreateUser({ username, password: hashed, rol: rol || 'usuario', whatsapp_number: whatsapp_number || null, email: email || null })
    if (pgUser) {
      global.sendTemplateNotification?.('user_registered', { username, email: email || 'N/A' })
      return json(res, 201, { success: true, user: sanitizeJwtUsuario(normalizeUser(pgUser)) })
    }
    // Fallback lowdb
    const users = db?.data?.usuarios || {}
    const newId = Math.max(0, ...Object.keys(users).map(Number).filter(Number.isFinite)) + 1
    db.data.usuarios[newId] = { id: newId, username, password: hashed, rol: rol || 'usuario', email: email || null, whatsapp_number: whatsapp_number || null, fecha_registro: new Date().toISOString(), activo: true }
    if (db?.write) await db.write()
    return json(res, 201, { success: true, user: sanitizeJwtUsuario(db.data.usuarios[newId]) })
  }

  // ── GET|PATCH|DELETE /api/usuarios/:id ────────────────────────────────────
  const idMatch = pathname.match(/^\/api\/usuarios\/(\w+)$/)
  if (idMatch) {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const idOrUsername = idMatch[1]
    const isNumeric = /^\d+$/.test(idOrUsername)

    // Buscar en PG primero
    let user = isNumeric
      ? normalizeUser(await pgFindUserById(Number(idOrUsername)))
      : normalizeUser(await pgFindUser(idOrUsername))
    // Fallback lowdb
    if (!user) user = db?.data?.usuarios?.[idOrUsername] || Object.values(db?.data?.usuarios || {}).find(u => u?.username === idOrUsername || String(u?.id) === idOrUsername)
    if (!user) return json(res, 404, { error: 'Usuario no encontrado' })

    if (!isAdmin(auth.user) && String(auth.user.id) !== String(user.id) && auth.user.username !== user.username) return json(res, 403, { error: 'Sin permisos' })

    if (method === 'GET') return json(res, 200, sanitizeJwtUsuario(user))

    if (method === 'PATCH' || method === 'PUT') {
      if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
      const body = await readJson(req)
      const fields = {}
      for (const k of ['email', 'whatsapp_number', 'rol', 'activo']) { if (k in body) fields[k] = body[k] }
      if (body.password) fields.password = await bcrypt.hash(body.password, 10)
      if (user._source === 'pg') {
        const updated = await pgUpdateUser(user.username, fields)
        return json(res, 200, { success: true, user: sanitizeJwtUsuario(normalizeUser(updated) || user) })
      }
      // lowdb fallback
      const lUser = db?.data?.usuarios?.[user.id]
      if (lUser) { Object.assign(lUser, fields, { updated_at: new Date().toISOString() }); if (db?.write) await db.write() }
      return json(res, 200, { success: true, user: sanitizeJwtUsuario(lUser || user) })
    }

    if (method === 'DELETE') {
      if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
      if (auth.user.username === user.username) return json(res, 400, { error: 'No puedes eliminarte a ti mismo' })
      if (user._source === 'pg') {
        await pgUpdateUser(user.username, { activo: false })
      } else {
        delete db.data.usuarios[user.id]
        if (db?.write) await db.write()
      }
      return json(res, 200, { success: true, message: 'Usuario eliminado' })
    }
  }

  return json(res, 404, { error: 'Ruta no encontrada' })
}
