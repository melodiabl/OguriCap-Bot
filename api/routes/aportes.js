/**
 * api/routes/aportes.js — /api/aportes/* + /api/pedidos/*
 * Extraído de lib/panel-api.js
 */
import { json, readJson, getJwtAuth, safeString, paginate, sseInit } from '../middleware/core.js'

function isAdmin(user) {
  return ['owner', 'admin', 'administrador'].includes(safeString(user?.rol || '').toLowerCase())
}

function nextId(panelDb, key) {
  panelDb[key] = (panelDb[key] || 0) + 1
  return panelDb[key]
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
    const aportes = Object.values(panelDb?.aportes || {})
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
    const aportes = Object.values(panelDb?.aportes || {})
    const filtered = isAdmin(auth.user) ? aportes : aportes.filter(a => safeString(a?.usuario) === safeString(auth.user.username))
    const { items, pagination } = paginate(filtered, { page: url.searchParams.get('page'), limit: url.searchParams.get('limit') })
    return json(res, 200, { aportes: items, pagination })
  }

  // ── POST /api/aportes ─────────────────────────────────────────────────────
  if (pathname === '/api/aportes' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    const { titulo, descripcion, tipo, monto } = body || {}
    if (!titulo) return json(res, 400, { error: 'titulo es requerido' })
    const id = nextId(panelDb, 'aportesCounter')
    const aporte = {
      id, titulo: safeString(titulo), descripcion: safeString(descripcion),
      tipo: safeString(tipo || 'general'), monto: Number(monto) || 0,
      usuario: safeString(auth.user.username), estado: 'pendiente',
      fecha_creacion: new Date().toISOString(),
    }
    panelDb.aportes ||= {}
    panelDb.aportes[id] = aporte
    if (global.db?.write) await global.db.write()
    try { const { emitAporteCreated } = await import('../../lib/socket-io.js'); emitAporteCreated(aporte) } catch {}
    global.sendTemplateNotification?.('aporte_created', { titulo, usuario: auth.user.username })
    return json(res, 201, { success: true, aporte })
  }

  // ── PATCH /api/aportes/:id ────────────────────────────────────────────────
  const aporteMatch = pathname.match(/^\/api\/aportes\/(\d+)$/)
  if (aporteMatch && (method === 'PATCH' || method === 'PUT')) {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const id = aporteMatch[1]
    const aporte = panelDb?.aportes?.[id]
    if (!aporte) return json(res, 404, { error: 'Aporte no encontrado' })
    const body = await readJson(req)
    Object.assign(aporte, body, { updated_at: new Date().toISOString() })
    if (global.db?.write) await global.db.write()
    try { const { emitAporteUpdated } = await import('../../lib/socket-io.js'); emitAporteUpdated(aporte) } catch {}
    return json(res, 200, { success: true, aporte })
  }

  // ── GET /api/pedidos/stats ────────────────────────────────────────────────
  if (pathname === '/api/pedidos/stats' && method === 'GET') {
    const pedidos = Object.values(panelDb?.pedidos || {})
    return json(res, 200, {
      total: pedidos.length,
      pendientes: pedidos.filter(p => p?.estado === 'pendiente').length,
      completados: pedidos.filter(p => p?.estado === 'completado').length,
      cancelados: pedidos.filter(p => p?.estado === 'cancelado').length,
    })
  }

  // ── GET /api/pedidos ──────────────────────────────────────────────────────
  if (pathname === '/api/pedidos' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const pedidos = Object.values(panelDb?.pedidos || {})
    const filtered = isAdmin(auth.user) ? pedidos : pedidos.filter(p => safeString(p?.usuario) === safeString(auth.user.username))
    const { items, pagination } = paginate(filtered, { page: url.searchParams.get('page'), limit: url.searchParams.get('limit') })
    return json(res, 200, { pedidos: items, pagination })
  }

  // ── POST /api/pedidos ─────────────────────────────────────────────────────
  if (pathname === '/api/pedidos' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    const { titulo, descripcion, tipo } = body || {}
    if (!titulo) return json(res, 400, { error: 'titulo es requerido' })
    const id = nextId(panelDb, 'pedidosCounter')
    const pedido = {
      id, titulo: safeString(titulo), descripcion: safeString(descripcion),
      tipo: safeString(tipo || 'general'), usuario: safeString(auth.user.username),
      estado: 'pendiente', fecha_creacion: new Date().toISOString(),
    }
    panelDb.pedidos ||= {}
    panelDb.pedidos[id] = pedido
    if (global.db?.write) await global.db.write()
    try { const { emitPedidoCreated } = await import('../../lib/socket-io.js'); emitPedidoCreated(pedido) } catch {}
    return json(res, 201, { success: true, pedido })
  }

  // ── PATCH /api/pedidos/:id ────────────────────────────────────────────────
  const pedidoMatch = pathname.match(/^\/api\/pedidos\/(\d+)$/)
  if (pedidoMatch && (method === 'PATCH' || method === 'PUT')) {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const id = pedidoMatch[1]
    const pedido = panelDb?.pedidos?.[id]
    if (!pedido) return json(res, 404, { error: 'Pedido no encontrado' })
    const body = await readJson(req)
    Object.assign(pedido, body, { updated_at: new Date().toISOString() })
    if (global.db?.write) await global.db.write()
    try { const { emitPedidoUpdated } = await import('../../lib/socket-io.js'); emitPedidoUpdated(pedido) } catch {}
    return json(res, 200, { success: true, pedido })
  }

  return json(res, 404, { error: 'Ruta no encontrada' })
}
