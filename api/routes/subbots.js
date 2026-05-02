/**
 * api/routes/subbots.js — /api/subbots/* + /api/subbot/*
 * Lógica completa migrada desde lib/panel-api.js
 */
import fs from 'fs'
import path from 'path'
import { json, readJson, getJwtAuth, safeString } from '../middleware/core.js'
import {
  getJadiRoot, nextSubbotId, normalizeSubbotForPanel,
  deleteSubbotByCode, cleanupBrokenSubbotSymlinks, resolveSubbotRecord,
} from '../lib/subbot-helpers.js'

function isAdmin(user) {
  return ['owner', 'admin', 'administrador'].includes(safeString(user?.rol || '').toLowerCase())
}

async function getSubbotsList(panelDb) {
  const { emitSubbotStatus } = await import('../../lib/socket-io.js').catch(() => ({}))
  const conns = Array.isArray(global.conns) ? global.conns : []
  const records = Object.values(panelDb?.subbots || {})

  return records.map(r => {
    const code = r.codigo || r.code || ''
    const sock = conns.find(s => {
      const sc = safeString(s?.subbotCode || '')
      const sb = safeString(path.basename(s?.sessionPath || '') || '')
      const ub = safeString(s?.user?.jid || s?.user?.id || '').split('@')[0]
      return sc === code || sb === code || ub === code || ub.replace(/\D/g,'') === code.replace(/\D/g,'')
    })
    const isOnline = Boolean(sock?.user)
    return normalizeSubbotForPanel(r, { isOnline })
  })
}

export async function handleSubbots({ req, res, url, panelDb }) {
  const pathname = url.pathname
  const method = req.method.toUpperCase()

  // ── GET /api/subbots | /api/subbot/list ───────────────────────────────────
  if ((pathname === '/api/subbots' || pathname === '/api/subbot/list') && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    let list = await getSubbotsList(panelDb)
    if (!isAdmin(auth.user)) list = list.filter(s => safeString(s.usuario) === safeString(auth.user.username))
    else if (url.searchParams.get('usuario')) list = list.filter(s => s.usuario === url.searchParams.get('usuario'))
    return json(res, 200, list)
  }

  // ── GET /api/subbots/status | /api/subbot/status ──────────────────────────
  if ((pathname === '/api/subbots/status' || pathname === '/api/subbot/status') && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    let list = await getSubbotsList(panelDb)
    if (!isAdmin(auth.user)) list = list.filter(s => safeString(s.usuario) === safeString(auth.user.username))
    return json(res, 200, { subbots: list.map(s => ({ subbotId: s.code, isOnline: s.isOnline, status: s.estado, connectionState: s.connectionState })) })
  }

  // ── GET /api/subbot/capacity ──────────────────────────────────────────────
  if (pathname === '/api/subbot/capacity' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    try {
      const { getSubbotCapacityInfo } = await import('../../lib/subbot-capacity.js')
      return json(res, 200, getSubbotCapacityInfo())
    } catch { return json(res, 200, { canCreate: true, current: 0, max: -1 }) }
  }

  // ── POST /api/subbots/reindex | /api/subbot/reindex ───────────────────────
  if ((pathname === '/api/subbots/reindex' || pathname === '/api/subbot/reindex') && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const { removed } = cleanupBrokenSubbotSymlinks()
    const list = await getSubbotsList(panelDb)
    try { const { emitSubbotStatus } = await import('../../lib/socket-io.js'); emitSubbotStatus() } catch {}
    return json(res, 200, { success: true, count: list.length, removed_symlinks: removed })
  }

  // ── POST /api/subbots/normalize | /api/subbot/normalize ───────────────────
  if ((pathname === '/api/subbots/normalize' || pathname === '/api/subbot/normalize') && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    cleanupBrokenSubbotSymlinks()
    try { const { emitSubbotStatus } = await import('../../lib/socket-io.js'); emitSubbotStatus() } catch {}
    return json(res, 200, { success: true })
  }

  // ── POST /api/subbots/qr — crear subbot con QR ────────────────────────────
  if (pathname === '/api/subbots/qr' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!panelDb) return json(res, 500, { error: 'DB no disponible' })

    const body = await readJson(req)
    const usuario = isAdmin(auth.user) && body?.usuario ? safeString(body.usuario) : safeString(auth.user.username)
    const root = getJadiRoot()

    // Generar código único
    let id = nextSubbotId(panelDb)
    let code = String(id)
    while (panelDb.subbots?.[code] || fs.existsSync(path.join(root, code))) {
      id = nextSubbotId(panelDb)
      code = String(id)
    }

    const sessionPath = path.join(root, code)
    fs.mkdirSync(sessionPath, { recursive: true })

    const record = {
      id, code, codigo: code, tipo: 'qr', usuario, owner: usuario,
      created_by: safeString(auth.user.username), created_by_role: safeString(auth.user.rol),
      created_from: 'panel', fecha_creacion: new Date().toISOString(),
      session_dir: code, estado: 'activo',
    }
    panelDb.subbots[code] = record

    try {
      const { yukiJadiBot } = await import('../../plugins/sockets-serbot.js')
      const { emitSubbotQR, emitSubbotConnected, emitSubbotCreated } = await import('../../lib/socket-io.js')

      const qrData = await yukiJadiBot({
        pathYukiJadiBot: sessionPath, m: null, conn: global.conn, args: [], usedPrefix: '/', command: 'qr',
        api: {
          code,
          onUpdate: (patch) => {
            Object.assign(record, patch)
            if (patch.qr_data) emitSubbotQR(code, patch.qr_data)
          },
          onConnected: (phone) => emitSubbotConnected(code, phone),
        },
      })

      if (!qrData?.success) {
        delete panelDb.subbots[code]
        try { fs.rmSync(sessionPath, { recursive: true, force: true }) } catch {}
        return json(res, 400, { error: qrData?.error || 'No se pudo crear el subbot' })
      }

      if (qrData?.qr) { record.qr_data = qrData.qr; emitSubbotQR(code, qrData.qr) }
      emitSubbotCreated(normalizeSubbotForPanel(record, { isOnline: false }))
      global.sendTemplateNotification?.('subbot_created', { subbotCode: code })
      if (global.db?.write) await global.db.write()
      return json(res, 200, normalizeSubbotForPanel(record, { isOnline: false }))
    } catch (err) {
      delete panelDb.subbots[code]
      try { fs.rmSync(sessionPath, { recursive: true, force: true }) } catch {}
      return json(res, 500, { error: err?.message || 'Error interno' })
    }
  }

  // ── POST /api/subbots/code — crear subbot con código de emparejamiento ────
  if (pathname === '/api/subbots/code' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!panelDb) return json(res, 500, { error: 'DB no disponible' })

    const body = await readJson(req)
    const numero = String(body?.numero || '').replace(/[^0-9]/g, '')
    if (!numero) return json(res, 400, { error: 'numero es requerido' })
    if (panelDb.subbots?.[numero]) return json(res, 409, { error: 'Ya existe un subbot con ese numero' })

    const usuario = isAdmin(auth.user) && body?.usuario ? safeString(body.usuario) : safeString(auth.user.username)
    const root = getJadiRoot()
    const sessionPath = path.join(root, numero)

    // Limpiar symlink roto si existe
    try {
      const st = fs.lstatSync(sessionPath)
      if (st.isSymbolicLink() && !fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: false, force: true })
      } else if (!st.isSymbolicLink()) {
        return json(res, 409, { error: 'Ya existe una sesión con ese numero' })
      }
    } catch {}

    fs.mkdirSync(sessionPath, { recursive: true })

    const id = nextSubbotId(panelDb)
    const record = {
      id, code: numero, codigo: numero, tipo: 'code', usuario, owner: usuario,
      created_by: safeString(auth.user.username), created_by_role: safeString(auth.user.rol),
      created_from: 'panel', numero, fecha_creacion: new Date().toISOString(),
      session_dir: numero, estado: 'activo',
    }
    panelDb.subbots[numero] = record

    try {
      const { yukiJadiBot } = await import('../../plugins/sockets-serbot.js')
      const { emitSubbotPairingCode, emitSubbotConnected, emitSubbotCreated } = await import('../../lib/socket-io.js')

      const result = await yukiJadiBot({
        pathYukiJadiBot: sessionPath, m: null, conn: global.conn, args: [], usedPrefix: '/', command: 'code',
        api: {
          code: numero, pairingNumber: numero,
          onUpdate: (patch) => {
            Object.assign(record, patch)
            if (patch.pairingCode) emitSubbotPairingCode(numero, patch.pairingCode, numero)
          },
          onConnected: (phone) => emitSubbotConnected(numero, phone),
        },
      })

      if (!result?.success) {
        delete panelDb.subbots[numero]
        try { fs.rmSync(sessionPath, { recursive: true, force: true }) } catch {}
        return json(res, 400, { error: result?.error || 'No se pudo crear el subbot' })
      }

      if (result?.pairingCode) { record.pairingCode = result.pairingCode; emitSubbotPairingCode(numero, result.pairingCode, numero) }
      emitSubbotCreated(normalizeSubbotForPanel(record, { isOnline: false }))
      global.sendTemplateNotification?.('subbot_created', { subbotCode: numero })
      if (global.db?.write) await global.db.write()
      return json(res, 200, normalizeSubbotForPanel(record, { isOnline: false }))
    } catch (err) {
      delete panelDb.subbots[numero]
      try { fs.rmSync(sessionPath, { recursive: true, force: true }) } catch {}
      return json(res, 500, { error: err?.message || 'Error interno' })
    }
  }

  // ── POST /api/subbot/create (alias) ───────────────────────────────────────
  if (pathname === '/api/subbot/create' && method === 'POST') {
    const body = await readJson(req)
    // Redirigir al endpoint correcto según tipo
    const tipo = safeString(body?.tipo || body?.type || 'qr').toLowerCase()
    url.pathname = tipo === 'code' ? '/api/subbots/code' : '/api/subbots/qr'
    return handleSubbots({ req, res, url, panelDb })
  }

  // ── GET /api/subbots/:code/qr — obtener QR como base64 ───────────────────
  const qrMatch = pathname.match(/^\/api\/subbots\/([^/]+)\/qr$/)
  if (qrMatch && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const code = decodeURIComponent(qrMatch[1])
    const record = resolveSubbotRecord(panelDb, code)
    if (!record?.qr_data) return json(res, 404, { error: 'QR no disponible' })
    try {
      const qrcode = (await import('qrcode')).default
      const buf = await qrcode.toBuffer(record.qr_data, { scale: 8 })
      return json(res, 200, { qr: buf.toString('base64') })
    } catch { return json(res, 200, { qr: record.qr_data }) }
  }

  // ── POST /api/subbot/settings ─────────────────────────────────────────────
  if (pathname === '/api/subbot/settings' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    const code = safeString(body?.code || body?.subbotId || '').trim()
    if (!code) return json(res, 400, { error: 'code es requerido' })
    const subbot = resolveSubbotRecord(panelDb, code)
    if (!subbot) return json(res, 404, { error: 'Subbot no encontrado' })
    if (!isAdmin(auth.user) && safeString(subbot.usuario) !== safeString(auth.user.username)) return json(res, 403, { error: 'Sin permisos' })
    const allowed = ['nombre', 'prefix', 'auto_read', 'auto_typing', 'welcome_enabled', 'welcome_message']
    for (const k of allowed) { if (k in body) subbot[k] = body[k] }
    subbot.updated_at = new Date().toISOString()
    if (global.db?.write) await global.db.write()
    try { const { emitSubbotUpdated } = await import('../../lib/socket-io.js'); emitSubbotUpdated(subbot) } catch {}
    return json(res, 200, { success: true, subbot })
  }

  // ── DELETE /api/subbots/:code | /api/subbot/:code ─────────────────────────
  const delMatch = pathname.match(/^\/api\/subbot(?:s)?\/([^/]+)$/)
  if (delMatch && method === 'DELETE') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const code = decodeURIComponent(delMatch[1])
    const result = await deleteSubbotByCode(code, panelDb)
    if (!result.success) return json(res, 404, result)
    if (global.db?.write) await global.db.write()
    try { const { emitSubbotDeleted } = await import('../../lib/socket-io.js'); emitSubbotDeleted(code) } catch {}
    global.sendTemplateNotification?.('subbot_deleted', { subbotCode: code })
    return json(res, 200, result)
  }

  return json(res, 404, { error: 'Ruta no encontrada' })
}
