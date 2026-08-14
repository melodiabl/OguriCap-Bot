/**
 * api/routes/aportes.js — /api/aportes/* + /api/pedidos/*
 */
import { json, readJson, getJwtAuth, safeString, paginate, sseInit } from '../middleware/core.js'

function isAdmin(user) {
  return ['owner', 'admin', 'administrador'].includes(safeString(user?.rol || '').toLowerCase())
}

function isMod(user) {
  return isAdmin(user) || safeString(user?.rol || '').toLowerCase() === 'moderador'
}

function nextId(panelDb, key) {
  panelDb[key] = (panelDb[key] || 0) + 1
  return panelDb[key]
}

function applySearch(items, q) {
  if (!q) return items
  const lq = q.toLowerCase()
  return items.filter(a => safeString(a?.titulo).toLowerCase().includes(lq) || safeString(a?.descripcion).toLowerCase().includes(lq))
}

function save() {
  if (global.db?.savePanel) global.db.savePanel().catch(() => {})
}

// Normaliza un aporte sin importar si vino de WhatsApp o del panel web
function normalizeAporte(a) {
  if (!a) return a
  const createdAt = a.created_at || a.fecha || a.fecha_creacion || null
  return { ...a, created_at: createdAt, updated_at: a.updated_at || createdAt }
}

// Lee aportes como array desde cualquier formato (array de WA u objeto del panel)
function getAportesArray(panelDb) {
  const raw = panelDb?.aportes
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(normalizeAporte)
  return Object.values(raw).map(normalizeAporte)
}

// Busca un aporte por ID en cualquier formato
function findAporte(panelDb, id) {
  const raw = panelDb?.aportes
  if (!raw) return null
  if (Array.isArray(raw)) return raw.find(a => String(a?.id) === String(id)) || null
  return raw[id] || null
}

// Guarda un nuevo aporte respetando el formato existente
function addAporte(panelDb, aporte) {
  if (!panelDb.aportes) { panelDb.aportes = {}; panelDb.aportes[aporte.id] = aporte; return }
  if (Array.isArray(panelDb.aportes)) { panelDb.aportes.push(aporte); return }
  panelDb.aportes[aporte.id] = aporte
}

// Elimina un aporte por ID en cualquier formato
function removeAporte(panelDb, id) {
  const raw = panelDb?.aportes
  if (!raw) return
  if (Array.isArray(raw)) {
    const i = raw.findIndex(a => String(a?.id) === String(id))
    if (i >= 0) raw.splice(i, 1)
    return
  }
  delete raw[id]
}

// Lee pedidos como array desde cualquier formato
function getPedidosArray(panelDb) {
  const raw = panelDb?.pedidos
  if (!raw) return []
  if (Array.isArray(raw)) return raw.map(p => ({ ...p, created_at: p.created_at || p.fecha || null }))
  return Object.values(raw).map(p => ({ ...p, created_at: p.created_at || p.fecha || null }))
}

function findPedido(panelDb, id) {
  const raw = panelDb?.pedidos
  if (!raw) return null
  if (Array.isArray(raw)) return raw.find(p => String(p?.id) === String(id)) || null
  return raw[id] || null
}

function addPedido(panelDb, pedido) {
  if (!panelDb.pedidos) { panelDb.pedidos = {}; panelDb.pedidos[pedido.id] = pedido; return }
  if (Array.isArray(panelDb.pedidos)) { panelDb.pedidos.push(pedido); return }
  panelDb.pedidos[pedido.id] = pedido
}

function removePedido(panelDb, id) {
  const raw = panelDb?.pedidos
  if (!raw) return
  if (Array.isArray(raw)) {
    const i = raw.findIndex(p => String(p?.id) === String(id))
    if (i >= 0) raw.splice(i, 1)
    return
  }
  delete raw[id]
}

export async function handleAportes({ req, res, url, panelDb }) {
  const pathname = url.pathname
  const method = req.method.toUpperCase()

  // ── GET /api/aportes/stream (SSE) ─────────────────────────────────────────
  if (pathname === '/api/aportes/stream' && method === 'GET') {
    return sseInit(req, res, 'aportes')
  }

  // ── GET /api/aportes/stats ────────────────────────────────────────────────
  if (pathname === '/api/aportes/stats' && method === 'GET') {
    const aportes = getAportesArray(panelDb)
    return json(res, 200, {
      total: aportes.length,
      pendientes: aportes.filter(a => a?.estado === 'pendiente').length,
      aprobados: aportes.filter(a => a?.estado === 'aprobado').length,
      rechazados: aportes.filter(a => a?.estado === 'rechazado').length,
    })
  }

  // ── GET /api/aportes ──────────────────────────────────────────────────────
  if (pathname === '/api/aportes' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    let aportes = getAportesArray(panelDb)
    if (!isAdmin(auth.user)) aportes = aportes.filter(a => safeString(a?.usuario) === safeString(auth.user.username))
    const estado = url.searchParams.get('estado')
    const tipo = url.searchParams.get('tipo')
    const search = url.searchParams.get('search') || url.searchParams.get('q') || ''
    if (estado) aportes = aportes.filter(a => a?.estado === estado)
    if (tipo) aportes = aportes.filter(a => a?.tipo === tipo)
    aportes = applySearch(aportes, search)
    aportes = aportes.sort((a, b) => new Date(b?.created_at || 0) - new Date(a?.created_at || 0))
    const { items, pagination } = paginate(aportes, { page: url.searchParams.get('page'), limit: url.searchParams.get('limit') || 20 })
    return json(res, 200, { aportes: items, pagination })
  }

  // ── POST /api/aportes ─────────────────────────────────────────────────────
  if (pathname === '/api/aportes' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    const { titulo, descripcion, tipo, monto, contenido } = body || {}
    if (!titulo) return json(res, 400, { error: 'titulo es requerido' })
    const id = nextId(panelDb, 'aportesCounter')
    const now = new Date().toISOString()
    const aporte = {
      id,
      titulo: safeString(titulo),
      descripcion: safeString(descripcion),
      contenido: safeString(contenido),
      tipo: safeString(tipo || 'general'),
      monto: Number(monto) || 0,
      usuario: safeString(auth.user.username),
      estado: 'pendiente',
      created_at: now,
      updated_at: now,
    }
    addAporte(panelDb, aporte)
    save()
    try { const { emitAporteCreated } = await import('../socket-io.js'); emitAporteCreated(aporte) } catch {}
    global.sendTemplateNotification?.('aporte_created', { titulo, usuario: auth.user.username })
    return json(res, 201, { success: true, aporte })
  }

  // ── PATCH /api/aportes/:id/estado ─────────────────────────────────────────
  const aporteEstadoMatch = pathname.match(/^\/api\/aportes\/(\d+)\/estado$/)
  if (aporteEstadoMatch && method === 'PATCH') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isMod(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const id = aporteEstadoMatch[1]
    const aporte = findAporte(panelDb, id)
    if (!aporte) return json(res, 404, { error: 'Aporte no encontrado' })
    const body = await readJson(req)
    const { estado, motivo_rechazo } = body || {}
    if (!['aprobado', 'rechazado', 'pendiente'].includes(estado)) return json(res, 400, { error: 'estado inválido' })
    aporte.estado = estado
    aporte.motivo_rechazo = motivo_rechazo || null
    aporte.updated_at = new Date().toISOString()
    save()
    try { const { emitAporteUpdated } = await import('../socket-io.js'); emitAporteUpdated(aporte) } catch {}
    return json(res, 200, { success: true, aporte: normalizeAporte(aporte) })
  }

  // ── PATCH/PUT /api/aportes/:id ────────────────────────────────────────────
  const aporteMatch = pathname.match(/^\/api\/aportes\/(\d+)$/)
  if (aporteMatch && (method === 'PATCH' || method === 'PUT')) {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isMod(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const id = aporteMatch[1]
    const aporte = findAporte(panelDb, id)
    if (!aporte) return json(res, 404, { error: 'Aporte no encontrado' })
    const body = await readJson(req)
    Object.assign(aporte, body, { updated_at: new Date().toISOString() })
    save()
    try { const { emitAporteUpdated } = await import('../socket-io.js'); emitAporteUpdated(aporte) } catch {}
    return json(res, 200, { success: true, aporte: normalizeAporte(aporte) })
  }

  // ── DELETE /api/aportes/:id ───────────────────────────────────────────────
  if (aporteMatch && method === 'DELETE') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isMod(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const id = aporteMatch[1]
    if (!findAporte(panelDb, id)) return json(res, 404, { error: 'Aporte no encontrado' })
    removeAporte(panelDb, id)
    if (global.db?.savePanel) await global.db.savePanel().catch(() => {})
    return json(res, 200, { success: true })
  }

  // ── GET /api/pedidos/stats ────────────────────────────────────────────────
  if (pathname === '/api/pedidos/stats' && method === 'GET') {
    const pedidos = getPedidosArray(panelDb)
    return json(res, 200, {
      total: pedidos.length,
      pendientes: pedidos.filter(p => p?.estado === 'pendiente').length,
      en_proceso: pedidos.filter(p => p?.estado === 'en_proceso').length,
      completados: pedidos.filter(p => p?.estado === 'completado').length,
      cancelados: pedidos.filter(p => p?.estado === 'cancelado').length,
    })
  }

  // ── GET /api/pedidos ──────────────────────────────────────────────────────
  if (pathname === '/api/pedidos' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    let pedidos = getPedidosArray(panelDb)
    if (!isAdmin(auth.user)) pedidos = pedidos.filter(p => safeString(p?.usuario) === safeString(auth.user.username))
    const estado = url.searchParams.get('estado')
    const prioridad = url.searchParams.get('prioridad')
    const search = url.searchParams.get('search') || url.searchParams.get('q') || ''
    if (estado) pedidos = pedidos.filter(p => p?.estado === estado)
    if (prioridad) pedidos = pedidos.filter(p => p?.prioridad === prioridad)
    pedidos = applySearch(pedidos, search)
    pedidos = pedidos.sort((a, b) => new Date(b?.created_at || 0) - new Date(a?.created_at || 0))
    const { items, pagination } = paginate(pedidos, { page: url.searchParams.get('page'), limit: url.searchParams.get('limit') || 20 })
    return json(res, 200, { pedidos: items, pagination })
  }

  // ── POST /api/pedidos ─────────────────────────────────────────────────────
  if (pathname === '/api/pedidos' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    const { titulo, descripcion, tipo, prioridad } = body || {}
    if (!titulo) return json(res, 400, { error: 'titulo es requerido' })
    const id = nextId(panelDb, 'pedidosCounter')
    const now = new Date().toISOString()
    const pedido = {
      id,
      titulo: safeString(titulo),
      descripcion: safeString(descripcion),
      tipo: safeString(tipo || 'general'),
      prioridad: safeString(prioridad || 'media'),
      usuario: safeString(auth.user.username),
      estado: 'pendiente',
      votos: 0,
      created_at: now,
      updated_at: now,
    }
    addPedido(panelDb, pedido)
    save()
    try { const { emitPedidoCreated } = await import('../socket-io.js'); emitPedidoCreated(pedido) } catch {}
    return json(res, 201, { success: true, pedido })
  }

  // ── POST /api/pedidos/:id/vote ────────────────────────────────────────────
  const pedidoVoteMatch = pathname.match(/^\/api\/pedidos\/(\d+)\/vote$/)
  if (pedidoVoteMatch && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const id = pedidoVoteMatch[1]
    const pedido = findPedido(panelDb, id)
    if (!pedido) return json(res, 404, { error: 'Pedido no encontrado' })
    pedido.votos = (pedido.votos || 0) + 1
    pedido.updated_at = new Date().toISOString()
    save()
    return json(res, 200, { success: true, votos: pedido.votos })
  }

  // ── PATCH/PUT /api/pedidos/:id ────────────────────────────────────────────
  const pedidoMatch = pathname.match(/^\/api\/pedidos\/(\d+)$/)
  if (pedidoMatch && (method === 'PATCH' || method === 'PUT')) {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isMod(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const id = pedidoMatch[1]
    const pedido = findPedido(panelDb, id)
    if (!pedido) return json(res, 404, { error: 'Pedido no encontrado' })
    const body = await readJson(req)
    Object.assign(pedido, body, { updated_at: new Date().toISOString() })
    save()
    try { const { emitPedidoUpdated } = await import('../socket-io.js'); emitPedidoUpdated(pedido) } catch {}
    return json(res, 200, { success: true, pedido })
  }

  // ── DELETE /api/pedidos/:id ───────────────────────────────────────────────
  if (pedidoMatch && method === 'DELETE') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isMod(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const id = pedidoMatch[1]
    if (!findPedido(panelDb, id)) return json(res, 404, { error: 'Pedido no encontrado' })
    removePedido(panelDb, id)
    if (global.db?.savePanel) await global.db.savePanel().catch(() => {})
    return json(res, 200, { success: true })
  }

  return json(res, 404, { error: 'Ruta no encontrada' })
}
