/**
 * api/lib/subbot-helpers.js
 * Lógica de subbots extraída de lib/panel-api.js
 */
import fs from 'fs'
import path from 'path'

export function getJadiRoot() {
  return path.join(process.cwd(), global.jadi || 'Sessions/SubBot')
}

export function safeString(v) { return v == null ? '' : String(v) }

export function nextSubbotId(panelDb) {
  panelDb.subbotsCounter = (panelDb.subbotsCounter || 0) + 1
  return panelDb.subbotsCounter
}

export function findConnBySubbotCode(code, record = null) {
  const conns = Array.isArray(global.conns) ? global.conns : []
  const norm = String(code || '').trim()
  const normBase = norm.split('@')[0]
  const normDigits = normBase.replace(/[^0-9]/g, '')

  // Extra aliases to match against (alias_dir, session_dir from the DB record)
  const aliases = new Set([norm, normBase])
  if (record) {
    const aliasDir = safeString(record.alias_dir || record.aliasDir || '')
    const sessionDir = safeString(record.session_dir || '')
    if (aliasDir) aliases.add(aliasDir)
    if (sessionDir) aliases.add(sessionDir)
  }

  return conns.find(sock => {
    const subbotCode = safeString(sock?.subbotCode || '')
    const sessionBase = safeString(path.basename(sock?.sessionPath || '') || '')
    const userBase = safeString(sock?.user?.jid || sock?.user?.id || '').split('@')[0]
    const authBase = safeString(sock?.authState?.creds?.me?.id || '').split('@')[0]
    const candidates = [subbotCode, sessionBase, userBase, authBase].filter(Boolean)

    // Direct match against all known aliases
    for (const alias of aliases) {
      if (candidates.includes(alias)) return true
    }

    if (!normDigits) return false
    return candidates.map(v => String(v).replace(/[^0-9]/g, '')).some(d => d === normDigits)
  }) || null
}

export function resolveSubbotRecord(panelDb, idOrCode) {
  const param = String(idOrCode || '').trim()
  if (!param) return null
  if (panelDb.subbots[param]) return panelDb.subbots[param]
  const asNum = Number(param)
  if (Number.isFinite(asNum)) {
    const found = Object.values(panelDb.subbots).find(r => Number(r.id) === asNum)
    if (found) return found
  }
  return Object.values(panelDb.subbots).find(r =>
    r.code === param || r.codigo === param ||
    r.session_dir === param || r.alias_dir === param
  ) || null
}

export function normalizeSubbotForPanel(record, { isOnline = false } = {}) {
  const code = record.codigo || record.code || record.subbotCode || ''
  const tipo = record.tipo || record.type || (record.numero ? 'code' : 'qr')
  const rawEstado = safeString(record.estado || record.status || '').toLowerCase()
  const estado = isOnline ? 'activo' : (rawEstado === 'error' ? 'error' : 'inactivo')
  const hasPendingAuth = !isOnline && (record.qr_data || record.pairingCode)
  const connectionState = isOnline ? 'connected' : (hasPendingAuth ? 'needs_auth' : 'disconnected')
  return {
    id: record.id,
    code,
    codigo: code,
    tipo,
    estado,
    isOnline,
    connectionState,
    usuario: record.usuario || record.owner || 'admin',
    numero: record.numero || record.phoneNumber || null,
    nombre_whatsapp: record.nombre_whatsapp || record.whatsappName || null,
    qr_data: record.qr_data || null,
    pairingCode: record.pairingCode || null,
    session_dir: record.session_dir || code,
    fecha_creacion: record.fecha_creacion || record.created_at || new Date().toISOString(),
    created_by: record.created_by || null,
    created_from: record.created_from || 'panel',
    custom_name: record.custom_name || record.customName || null,
    custom_prefix: record.custom_prefix || record.customPrefix || null,
    custom_banner: record.custom_banner || record.customBanner || null,
    custom_video: record.custom_video || record.customVideo || null,
    display_name: record.display_name || record.displayName || null,
    whatsapp_status: record.whatsapp_status || record.bio || null,
    alias_dir: record.alias_dir || record.aliasDir || null,
  }
}

export async function deleteSubbotByCode(code, panelDb) {
  const record = resolveSubbotRecord(panelDb, code)

  if (!record) {
    // Intentar eliminar huérfano del disco
    const root = getJadiRoot()
    const sessionPath = path.join(root, String(code).trim())
    try {
      if (fs.existsSync(sessionPath) && fs.statSync(sessionPath).isDirectory()) {
        fs.rmSync(sessionPath, { recursive: true, force: true })
        return { success: true, message: 'Subbot huérfano eliminado del disco' }
      }
    } catch {}
    return { success: false, error: 'Subbot no encontrado' }
  }

  const realCode = record.codigo || record.code
  // Desconectar socket si está activo
  const sock = realCode ? findConnBySubbotCode(realCode) : null
  if (sock) {
    try { await sock.logout() } catch {}
    const idx = global.conns?.indexOf(sock)
    if (typeof idx === 'number' && idx >= 0) global.conns.splice(idx, 1)
  }

  // Eliminar carpeta de sesión
  const sessionDir = record.session_dir || realCode
  if (sessionDir) {
    const sessionPath = path.join(getJadiRoot(), sessionDir)
    try {
      if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true })
    } catch {}
  }

  // Eliminar alias/symlinks
  for (const aliasKey of ['numero', 'alias_dir', 'aliasDir']) {
    try {
      const alias = safeString(record[aliasKey] || '').replace(/[^0-9]/g, '') || safeString(record[aliasKey] || '').trim()
      if (!alias) continue
      const aliasPath = path.join(getJadiRoot(), alias)
      if (fs.lstatSync(aliasPath).isSymbolicLink()) fs.rmSync(aliasPath, { recursive: false, force: true })
    } catch {}
  }

  if (realCode && panelDb.subbots[realCode]) delete panelDb.subbots[realCode]
  return { success: true }
}

export function cleanupDisconnectedSubbots(panelDb) {
  const root = getJadiRoot()
  const removed = []
  const subbots = panelDb?.subbots || {}

  // 1. Remove DB records with no valid session on disk
  for (const [key, record] of Object.entries(subbots)) {
    const code = record.codigo || record.code || key
    const sock = findConnBySubbotCode(code, record)
    if (sock?.user) continue // connected, skip

    // Check all possible session paths
    const candidates = [record.session_dir, record.alias_dir, record.aliasDir, code]
      .filter(Boolean).map(d => path.join(root, String(d).trim()))
    const hasValidSession = candidates.some(p => {
      try { return fs.existsSync(path.join(p, 'creds.json')) } catch { return false }
    })

    if (!hasValidSession) {
      // Delete all candidate dirs
      for (const p of candidates) {
        try { if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true }) } catch {}
      }
      delete subbots[key]
      removed.push(code)
    }
  }

  // 2. Remove orphan disk folders (no creds, not in DB)
  try {
    const knownDirs = new Set(
      Object.values(subbots).flatMap(r =>
        [r.session_dir, r.alias_dir, r.aliasDir, r.code, r.codigo].filter(Boolean).map(String)
      )
    )
    for (const ent of fs.readdirSync(root, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue
      const hasCreds = fs.existsSync(path.join(root, ent.name, 'creds.json'))
      if (!hasCreds && !knownDirs.has(ent.name)) {
        try { fs.rmSync(path.join(root, ent.name), { recursive: true, force: true }) } catch {}
        removed.push(ent.name)
      }
    }
  } catch {}

  return { removed }
}

export function cleanupBrokenSubbotSymlinks() {
  const root = getJadiRoot()
  let removed = 0
  try {
    if (!fs.existsSync(root)) return { removed }
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
      if (!entry.isSymbolicLink()) continue
      const full = path.join(root, entry.name)
      try {
        fs.accessSync(full)
      } catch {
        fs.rmSync(full, { recursive: false, force: true })
        removed++
      }
    }
  } catch {}
  return { removed }
}
