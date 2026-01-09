import fs from 'fs'
import path from 'path'
import { classifyProviderLibraryContent } from '../lib/provider-content-classifier.js'

const safeString = (v) => (v == null ? '' : typeof v === 'string' ? v : String(v))

const waSafeInline = (v) => safeString(v).replace(/\s+/g, ' ').replace(/[*_~`]/g, '').trim()

const clampInt = (value, { min, max, fallback }) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(Math.floor(n), min), max)
}

const truncateText = (v, max = 140) => {
  const s = waSafeInline(v)
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

const shouldSkipDuplicateCommand = (m, command) => {
  try {
    const msgId = m?.key?.id || m?.id || m?.message?.key?.id || null
    if (!msgId) return false

    global.__panelPedidoCommandSeen ||= new Map()
    const seen = global.__panelPedidoCommandSeen
    const now = Date.now()
    const key = `${String(command || '')}|${String(m?.chat || '')}|${String(m?.sender || '')}|${String(msgId)}`

    const prev = seen.get(key)
    if (prev && now - prev < 2 * 60 * 1000) return true
    seen.set(key, now)

    if (seen.size > 2000) {
      const minTs = now - 6 * 60 * 60 * 1000
      for (const [k, ts] of seen.entries()) {
        if (ts < minTs) seen.delete(k)
      }
      if (seen.size > 3000) {
        for (const k of seen.keys()) {
          seen.delete(k)
          if (seen.size <= 1500) break
        }
      }
    }

    return false
  } catch {
    return false
  }
}

const ensureStore = () => {
  if (!global.db.data.panel) global.db.data.panel = {}
  if (!global.db.data.panel.pedidos) global.db.data.panel.pedidos = {}
  if (!global.db.data.panel.pedidosCounter) global.db.data.panel.pedidosCounter = 0
  if (!global.db.data.panel.proveedores) global.db.data.panel.proveedores = {}
  if (!global.db.data.panel.contentLibrary) global.db.data.panel.contentLibrary = {}
  if (!Array.isArray(global.db.data.aportes)) global.db.data.aportes = []
  if (!global.db.data.aportesCounter) global.db.data.aportesCounter = 1
}

const nextPedidoId = () => {
  global.db.data.panel.pedidosCounter = (global.db.data.panel.pedidosCounter || 0) + 1
  return global.db.data.panel.pedidosCounter
}

const formatDate = (value) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toISOString().slice(0, 10)
}

const prioridadEmoji = {
  alta: '🔴',
  media: '🟡',
  baja: '🟢',
}

const estadoEmoji = {
  pendiente: '⏳',
  en_proceso: '🔄',
  completado: '✅',
  cancelado: '❌',
}

const formatPedido = (pedido, index) => {
  const lines = [
    `${index}. ${waSafeInline(pedido?.titulo || 'Sin título')}`,
    `   ${prioridadEmoji[pedido?.prioridad] || '⚪'} Prioridad: ${waSafeInline(pedido?.prioridad || 'media')}`,
    `   ${estadoEmoji[pedido?.estado] || '⏳'} Estado: ${waSafeInline(pedido?.estado || 'pendiente')}`,
    `   📝 ${truncateText(pedido?.descripcion || 'Sin descripción', 90)}`,
    `   👤 Usuario: ${waSafeInline(pedido?.usuario || '-')}`,
    `   📅 Fecha: ${formatDate(pedido?.fecha_creacion)}`,
    `   👍 Votos: ${Number(pedido?.votos || 0) || 0}`,
  ]
  return lines.join('\n')
}

const stopwords = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'y', 'o', 'a', 'en', 'por', 'para', 'con', 'sin',
  'un', 'una', 'unos', 'unas', 'que', 'se', 'su', 'sus', 'al', 'lo', 'le', 'les',
  'cap', 'capitulo', 'capítulo', 'chapter', 'ch', 'episodio', 'ep', 'pdf', 'epub',
])

const normalizeText = (s) => safeString(s || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const tokenize = (s) => {
  const parts = normalizeText(s).split(' ').filter(Boolean)
  const out = []
  for (const p of parts) {
    if (p.length < 3) continue
    if (stopwords.has(p)) continue
    out.push(p)
    if (out.length >= 24) break
  }
  return out
}

const getPanelUrl = () => {
  const raw = process.env.PANEL_PUBLIC_URL || process.env.PUBLIC_URL || process.env.PANEL_URL || ''
  return String(raw || '').trim().replace(/\/+$/, '')
}

const resolveProveedorJid = (panel, raw) => {
  const v = String(raw || '').trim()
  if (!v) return null
  const asNum = Number(v)
  if (Number.isFinite(asNum)) {
    const found = Object.values(panel?.proveedores || {}).find((p) => Number(p?.id) === asNum) || null
    return found?.jid || null
  }
  const byJid = panel?.proveedores?.[v] || null
  return byJid?.jid || v
}

const scoreLibraryItem = (item, query) => {
  const itemTitle = normalizeText(item?.title || '')
  const queryTitle = normalizeText(query?.title || '')
  const itemText = `${item?.title || ''} ${item?.originalName || ''} ${(item?.tags || []).join(' ')}`
  const qTokens = new Set(tokenize(`${query?.title || ''} ${query?.descripcion || ''} ${(query?.tags || []).join(' ')}`))
  const iTokens = new Set(tokenize(itemText))

  let overlap = 0
  for (const t of qTokens) if (iTokens.has(t)) overlap += 1
  const overlapRatio = qTokens.size ? overlap / qTokens.size : 0

  let score = overlapRatio * 70
  if (queryTitle && itemTitle) {
    if (itemTitle === queryTitle) score += 28
    else if (itemTitle.includes(queryTitle) || queryTitle.includes(itemTitle)) score += 18
  }

  const qChapter = query?.chapter ? String(query.chapter) : null
  const iChapter = item?.chapter ? String(item.chapter) : null
  if (qChapter && iChapter && qChapter === iChapter) score += 30

  const qCat = query?.category ? String(query.category).toLowerCase() : null
  const iCat = item?.category ? String(item.category).toLowerCase() : null
  if (qCat && iCat && qCat === iCat) score += 10

  return score
}

const searchProviderLibrary = async (panel, proveedorJid, pedido, limit = 5) => {
  const list = Object.values(panel.contentLibrary || {}).filter((it) => String(it?.proveedorJid || '') === String(proveedorJid || ''))
  const proveedor = panel?.proveedores?.[proveedorJid] || { jid: proveedorJid }

  const classified = await classifyProviderLibraryContent({
    filename: String(pedido?.titulo || ''),
    caption: String(pedido?.descripcion || pedido?.contenido_solicitado || ''),
    provider: { jid: proveedorJid, tipo: proveedor?.tipo || '' },
  }).catch(() => null)

  const query = {
    title: String(classified?.title || pedido?.titulo || '').trim(),
    descripcion: String(pedido?.descripcion || pedido?.contenido_solicitado || '').trim(),
    category: String(classified?.category || '').trim(),
    chapter: typeof classified?.chapter !== 'undefined' ? classified.chapter : null,
    tags: Array.isArray(classified?.tags) ? classified.tags : [],
    provider: { jid: proveedorJid, nombre: proveedor?.nombre || '', tipo: proveedor?.tipo || '' },
  }

  const scored = list
    .map((it) => ({ it, score: scoreLibraryItem(it, query) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return { query, results: scored }
}

const formatSearchResults = (pedido, query, results, usedPrefix, proveedorJid) => {
  const lines = []
  lines.push('🔎 *Búsqueda en biblioteca*')
  lines.push(`> *Pedido:* ${waSafeInline(pedido?.titulo || '')}`)
  if (query?.title && query.title !== pedido?.titulo) lines.push(`> *Interpretado:* _${waSafeInline(query.title)}_`)
  if (query?.category) lines.push(`> *Categoría:* _${waSafeInline(query.category)}_`)
  if (query?.chapter != null) lines.push(`> *Capítulo:* _${waSafeInline(query.chapter)}_`)

  if (!results.length) {
    lines.push('')
    lines.push('❌ _No encontré coincidencias en la biblioteca._')
    const panelUrl = getPanelUrl()
    if (panelUrl && proveedorJid) lines.push(`> *Proveedor:* ${panelUrl}/proveedores/${encodeURIComponent(String(proveedorJid))}`)
    return lines.join('\n')
  }

  lines.push('')
  lines.push('✅ *Coincidencias*')
  for (const r of results) {
    const it = r.it || {}
    const title = waSafeInline(it.title || it.originalName || `Archivo #${it.id || '?'}`)
    const score = Math.round(r.score)
    lines.push(`> \`\`\`#${it.id}\`\`\` ${title} (_${score}_)`)
  }
  lines.push('')
  lines.push(`📥 *Enviar:* \`\`\`${usedPrefix}enviarlib <id>\`\`\``)
  return lines.join('\n')
}

const isAporteApproved = (aporte) => {
  const estado = safeString(aporte?.estado || '').toLowerCase().trim()
  return estado === 'aprobado' || estado === 'approved'
}

const scoreAporte = (aporte, queryTokensSet) => {
  const title = safeString(aporte?.titulo || '')
  const body = safeString(aporte?.contenido || '')
  const tags = Array.isArray(aporte?.tags) ? aporte.tags.join(' ') : ''
  const tipo = safeString(aporte?.tipo || '')
  const combined = `${title} ${body} ${tags} ${tipo}`
  const aTokens = new Set(tokenize(combined))

  let overlap = 0
  for (const t of queryTokensSet) if (aTokens.has(t)) overlap += 1
  const overlapRatio = queryTokensSet.size ? overlap / queryTokensSet.size : 0

  let score = overlapRatio * 100
  const qt = [...queryTokensSet].join(' ')
  const nt = normalizeText(title)
  if (qt && nt && (nt.includes(qt) || qt.includes(nt))) score += 12

  if (isAporteApproved(aporte)) score += 8
  if (aporte?.archivoPath || aporte?.archivo) score += 6

  return score
}

const searchAportesForPedido = (pedido, { limit = 5, includePending = false } = {}) => {
  const aportes = Array.isArray(global.db?.data?.aportes) ? global.db.data.aportes : []
  const queryText = `${pedido?.titulo || ''} ${pedido?.descripcion || ''} ${(pedido?.tags || []).join(' ')}`
  const qTokens = new Set(tokenize(queryText))
  if (!qTokens.size) return []

  const scored = []
  for (const aporte of aportes) {
    if (!aporte) continue
    if (!includePending && !isAporteApproved(aporte)) continue
    const score = scoreAporte(aporte, qTokens)
    if (score <= 0) continue
    scored.push({ aporte, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}

const formatAportesMatches = (pedido, matches, usedPrefix) => {
  const lines = []
  lines.push('📌 *Aportes sugeridos*')
  lines.push(`> *Pedido:* ${waSafeInline(pedido?.titulo || '')}`)

  if (!matches.length) {
    lines.push('')
    lines.push('🛡️ _No hay aportes que coincidan (o no están aprobados)._')
    return lines.join('\n')
  }

  lines.push('')
  for (const m of matches) {
    const a = m.aporte || {}
    const score = Math.round(m.score)
    const titulo = truncateText(a.titulo || a.contenido || `Aporte #${a.id}`, 44)
    const tipo = waSafeInline(a.tipo || 'extra')
    const estado = waSafeInline(a.estado || 'pendiente')
    const fecha = formatDate(a.fecha || a.fecha_creacion || a.created_at)
    lines.push(`> \`\`\`#${safeString(a.id)}\`\`\` ${titulo} (_${score}_)`)
    lines.push(`> *Tipo:* _${tipo}_ | *Estado:* _${estado}_ | *Fecha:* _${fecha}_`)
  }
  lines.push('')
  lines.push(`📎 *Enviar aporte:* \`\`\`${usedPrefix}enviaraporte <idAporte>\`\`\``)
  return lines.join('\n')
}

const resolveAporteFilePath = (aporte) => {
  const rel = safeString(aporte?.archivoPath || '').trim()
  if (!rel) return null
  if (rel.includes('..')) return null

  const root = path.resolve(process.cwd(), 'storage', 'media')
  const filePath = path.resolve(process.cwd(), rel)
  if (!filePath.toLowerCase().startsWith(root.toLowerCase())) return null
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null
  return filePath
}

const trySendLocalFile = async (m, conn, filePath, filename, caption) => {
  try {
    const stat = fs.statSync(filePath)
    const maxBytes = Number(process.env.WA_SEND_MAX_BYTES || 45 * 1024 * 1024)
    if (Number.isFinite(maxBytes) && stat.size > maxBytes) {
      return { ok: false, reason: `Archivo muy grande (${Math.round(stat.size / 1024 / 1024)}MB)` }
    }
    await conn.sendFile(m.chat, filePath, filename, caption, m, null, { asDocument: true })
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: err?.message || 'Error enviando archivo' }
  }
}

const trySendLibraryItem = async (m, conn, item) => {
  try {
    const filePath = item?.file_path
    if (!filePath || !fs.existsSync(filePath)) return { ok: false, reason: 'Archivo no encontrado en disco' }
    const stat = fs.statSync(filePath)
    if (!stat.isFile()) return { ok: false, reason: 'No es un archivo' }

    const maxBytes = Number(process.env.WA_SEND_MAX_BYTES || 45 * 1024 * 1024)
    if (Number.isFinite(maxBytes) && stat.size > maxBytes) {
      return { ok: false, reason: `Archivo muy grande (${Math.round(stat.size / 1024 / 1024)}MB)` }
    }

    const filename = item?.originalName || item?.filename || path.basename(filePath)
    const caption = `${item?.title || filename}`.trim()
    await conn.sendFile(m.chat, filePath, filename, caption, m, null, { asDocument: true })
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: err?.message || 'Error enviando archivo' }
  }
}

let handler = async (m, { args, usedPrefix, command, conn, isAdmin, isOwner }) => {
  ensureStore()
  const panel = global.db.data.panel

  if (shouldSkipDuplicateCommand(m, command)) return null

  const isBotOwner = Boolean(isOwner) || global.owner.map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net').includes(m.sender)

  switch (command) {
    case 'pedido':
    case 'pedir': {
      const raw = (args || []).join(' ').trim()
      if (!raw) {
        return m.reply(
          `📝 *Crear un pedido*\n\n` +
          `> *Uso:* \`\`\`${usedPrefix}${command} <título> | <descripción> | <prioridad>\`\`\`\n` +
          `> *Ejemplo:* \`\`\`${usedPrefix}${command} Solo Leveling | Capítulos 1-50 | alta\`\`\`\n\n` +
          `🛡️ _Prioridades: alta, media, baja_`
        )
      }

      const parts = raw.split('|').map(s => s.trim())
      const titulo = parts[0] || ''
      const descripcion = parts[1] || ''
      const prioridad = ['alta', 'media', 'baja'].includes(parts[2]?.toLowerCase()) ? parts[2].toLowerCase() : 'media'

      if (!titulo) return m.reply('❌ *Error*\n\n> _Debes especificar un título._')

      const id = nextPedidoId()
      const now = new Date().toISOString()
      const proveedorJid = (m.isGroup && panel?.proveedores?.[m.chat]) ? m.chat : null

      const pedido = {
        id,
        titulo,
        descripcion,
        tipo: 'general',
        estado: 'pendiente',
        prioridad,
        usuario: m.sender,
        grupo_id: m.isGroup ? m.chat : null,
        grupo_nombre: m.isGroup ? (await conn.groupMetadata(m.chat).catch(() => ({}))).subject || '' : '',
        proveedor_jid: proveedorJid,
        votos: 0,
        votantes: [],
        fecha_creacion: now,
        fecha_actualizacion: now,
      }

      panel.pedidos[id] = pedido
      if (global.db?.write) await global.db.write().catch(() => { })

      try {
        const { emitPedidoCreated } = await import('../lib/socket-io.js')
        emitPedidoCreated(pedido)
      } catch { }

      const lines = []
      lines.push('✅ *Pedido creado*')
      lines.push('')
      lines.push(`> *ID:* \`\`\`#${id}\`\`\``)
      lines.push(`> *Título:* ${waSafeInline(titulo)}`)
      lines.push(`> *Prioridad:* ${prioridadEmoji[prioridad]} _${waSafeInline(prioridad)}_`)
      lines.push(`> *Estado:* ${estadoEmoji.pendiente} _pendiente_`)
      if (descripcion) lines.push(`> *Descripción:* ${truncateText(descripcion, 120)}`)

      if (proveedorJid) {
        lines.push('')
        lines.push(`🔎 *Buscar en biblioteca:* \`\`\`${usedPrefix}procesarpedido ${id}\`\`\``)
      } else {
        lines.push('')
        lines.push('🛡️ _Este pedido no está asociado a un proveedor._')
        lines.push(`> *Admin:* \`\`\`${usedPrefix}procesarpedido ${id} <idProveedor|jidProveedor>\`\`\``)
      }

      return m.reply(lines.join('\n'))
    }

    case 'pedidos':
    case 'listpedidos': {
      const pedidos = Object.values(panel.pedidos || {})
        .filter(p => p.estado !== 'cancelado')
        .sort((a, b) => {
          const prioridadOrder = { alta: 0, media: 1, baja: 2 }
          return (prioridadOrder[a.prioridad] ?? 1) - (prioridadOrder[b.prioridad] ?? 1)
        })
        .slice(0, 15)

      if (!pedidos.length) return m.reply(`📋 *Pedidos*\n\n🛡️ _No hay pedidos registrados._`)
      const msg = pedidos.map((p, i) => formatPedido(p, i + 1)).join('\n\n')
      return m.reply(`📋 *Lista de pedidos*\n\n${msg}\n\n👍 *Votar:* \`\`\`${usedPrefix}votarpedido <id>\`\`\``)
    }

    case 'mispedidos': {
      const pedidos = Object.values(panel.pedidos || {})
        .filter(p => p.usuario === m.sender)
        .sort((a, b) => String(b.fecha_creacion || '').localeCompare(String(a.fecha_creacion || '')))
        .slice(0, 10)

      if (!pedidos.length) return m.reply(`📋 *Mis pedidos*\n\n🛡️ _No tienes pedidos registrados._`)
      const msg = pedidos.map((p, i) => formatPedido(p, i + 1)).join('\n\n')
      return m.reply(`📋 *Mis pedidos*\n\n${msg}`)
    }

    case 'verpedido': {
      const id = parseInt(args[0])
      if (!id) return m.reply(`🧾 *Ver pedido*\n\n> \`\`\`${usedPrefix}verpedido <id>\`\`\``)

      const pedido = panel.pedidos[id]
      if (!pedido) return m.reply(`❌ *Error*\n\n> _Pedido #${id} no encontrado._`)

      const proveedor = pedido?.proveedor_jid ? (panel?.proveedores?.[pedido.proveedor_jid] || null) : null
      const proveedorTxt = proveedor ? (proveedor.nombre || proveedor.jid) : (pedido?.proveedor_jid || '')

      const lines = []
      lines.push(`🧾 *Pedido* \`\`\`#${id}\`\`\``)
      lines.push('')
      lines.push(`> *Título:* ${waSafeInline(pedido.titulo)}`)
      lines.push(`> *Descripción:* ${truncateText(pedido.descripcion || 'Sin descripción', 220)}`)
      lines.push(`> *Prioridad:* ${prioridadEmoji[pedido.prioridad] || '⚪'} _${waSafeInline(pedido.prioridad || 'media')}_`)
      lines.push(`> *Estado:* ${estadoEmoji[pedido.estado] || '⏳'} _${waSafeInline(pedido.estado || 'pendiente')}_`)
      lines.push(`> *Solicitante:* @${safeString(pedido.usuario || '').split('@')[0] || 'desconocido'}`)
      lines.push(`> *Fecha:* _${formatDate(pedido.fecha_creacion)}_`)
      lines.push(`> *Votos:* _${Number(pedido.votos || 0) || 0}_`)
      if (pedido.grupo_nombre) lines.push(`> *Grupo:* _${waSafeInline(pedido.grupo_nombre)}_`)
      if (proveedorTxt) lines.push(`> *Proveedor:* _${waSafeInline(proveedorTxt)}_`)

      return conn.reply(m.chat, lines.join('\n'), m, { mentions: [pedido.usuario] })
    }

    case 'votarpedido':
    case 'votepedido': {
      const id = parseInt(args[0])
      if (!id) return m.reply(`👍 *Votar pedido*\n\n> \`\`\`${usedPrefix}votarpedido <id>\`\`\``)

      const pedido = panel.pedidos[id]
      if (!pedido) return m.reply(`❌ *Error*\n\n> _Pedido #${id} no encontrado._`)
      if (pedido.estado === 'completado' || pedido.estado === 'cancelado') return m.reply(`❌ *No permitido*\n\n> _No puedes votar por un pedido ${pedido.estado}._`)

      pedido.votantes = pedido.votantes || []
      if (pedido.votantes.includes(m.sender)) return m.reply('❌ *No permitido*\n\n> _Ya votaste por este pedido._')

      pedido.votantes.push(m.sender)
      pedido.votos = (pedido.votos || 0) + 1
      pedido.fecha_actualizacion = new Date().toISOString()
      if (global.db?.write) await global.db.write().catch(() => { })

      try {
        const { emitPedidoUpdated } = await import('../lib/socket-io.js')
        emitPedidoUpdated(pedido)
      } catch { }

      return m.reply(`✅ *Voto registrado*\n\n> *Pedido:* \`\`\`#${id}\`\`\` ${waSafeInline(pedido.titulo)}\n> *Votos:* _${pedido.votos}_`)
    }

    case 'cancelarpedido': {
      const id = parseInt(args[0])
      if (!id) return m.reply(`❌ *Cancelar pedido*\n\n> \`\`\`${usedPrefix}cancelarpedido <id>\`\`\``)

      const pedido = panel.pedidos[id]
      if (!pedido) return m.reply(`❌ *Error*\n\n> _Pedido #${id} no encontrado._`)

      if (pedido.usuario !== m.sender && !isBotOwner) {
        return m.reply('❌ *No permitido*\n\n> _Solo el creador del pedido o el owner puede cancelarlo._')
      }

      pedido.estado = 'cancelado'
      pedido.fecha_actualizacion = new Date().toISOString()
      if (global.db?.write) await global.db.write().catch(() => { })

      try {
        const { emitPedidoUpdated } = await import('../lib/socket-io.js')
        emitPedidoUpdated(pedido)
      } catch { }

      return m.reply(`✅ *Pedido cancelado*\n\n> \`\`\`#${id}\`\`\` ${waSafeInline(pedido.titulo)}`)
    }

    case 'estadopedido': {
      const id = parseInt(args[0])
      const nuevoEstado = safeString(args[1]).toLowerCase().trim()
      if (!id || !nuevoEstado) return m.reply(`🔄 *Cambiar estado*\n\n> \`\`\`${usedPrefix}estadopedido <id> <estado>\`\`\`\n> _Estados: pendiente, en_proceso, completado, cancelado_`)

      const estadosValidos = ['pendiente', 'en_proceso', 'completado', 'cancelado']
      if (!estadosValidos.includes(nuevoEstado)) return m.reply(`❌ *Error*\n\n> _Estado inválido: ${waSafeInline(nuevoEstado)}_`)

      const pedido = panel.pedidos[id]
      if (!pedido) return m.reply(`❌ *Error*\n\n> _Pedido #${id} no encontrado._`)

      const canModerate = isBotOwner || (m.isGroup && isAdmin && String(m.chat) === String(pedido.grupo_id || ''))
      if (!canModerate) return m.reply('❌ *No permitido*\n\n> _Solo el owner o admins del grupo pueden cambiar el estado._')

      pedido.estado = nuevoEstado
      pedido.fecha_actualizacion = new Date().toISOString()
      if (global.db?.write) await global.db.write().catch(() => { })

      try {
        const { emitPedidoUpdated } = await import('../lib/socket-io.js')
        emitPedidoUpdated(pedido)
      } catch { }

      return m.reply(`✅ *Estado actualizado*\n\n> \`\`\`#${id}\`\`\` ${waSafeInline(pedido.titulo)}\n> *Estado:* ${estadoEmoji[nuevoEstado]} _${waSafeInline(nuevoEstado)}_`)
    }

    case 'buscaraporte': {
      const pedidoId = parseInt(args[0])
      if (!pedidoId) return m.reply(`📌 *Buscar aportes*\n\n> \`\`\`${usedPrefix}buscaraporte <idPedido>\`\`\``)

      const pedido = panel.pedidos[pedidoId]
      if (!pedido) return m.reply(`❌ *Error*\n\n> _Pedido #${pedidoId} no encontrado._`)

      const canSeeAll = isBotOwner || (m.isGroup && isAdmin)
      const matches = searchAportesForPedido(pedido, { limit: 5, includePending: canSeeAll })
      return m.reply(formatAportesMatches(pedido, matches, usedPrefix))
    }

    case 'enviaraporte': {
      const aporteId = parseInt(args[0])
      if (!aporteId) return m.reply(`📎 *Enviar aporte*\n\n> \`\`\`${usedPrefix}enviaraporte <idAporte>\`\`\``)

      const aportes = Array.isArray(global.db?.data?.aportes) ? global.db.data.aportes : []
      const aporte = aportes.find((a) => Number(a?.id) === aporteId) || null
      if (!aporte) return m.reply(`❌ *Error*\n\n> _Aporte #${aporteId} no encontrado._`)

      const isCreator = String(aporte?.usuario || '') === String(m.sender || '')
      const isApproved = isAporteApproved(aporte)
      const canSend =
        isBotOwner ||
        isCreator ||
        (m.isGroup && isAdmin && isApproved)

      if (!canSend) {
        return m.reply('❌ *No permitido*\n\n> _Solo el owner, el creador, o un admin (si está aprobado) puede enviarlo._')
      }

      const filePath = resolveAporteFilePath(aporte)
      const filename = safeString(aporte?.archivoNombre || `aporte_${aporteId}`)
      const caption =
        `📎 *Aporte* \`\`\`#${aporteId}\`\`\`\n` +
        `> *Título:* ${waSafeInline(aporte?.titulo || '')}\n` +
        `> *Tipo:* _${waSafeInline(aporte?.tipo || 'extra')}_\n` +
        `> *Estado:* _${waSafeInline(aporte?.estado || 'pendiente')}_`

      if (filePath) {
        const sent = await trySendLocalFile(m, conn, filePath, filename, caption)
        if (sent.ok) return null
        const panelUrl = getPanelUrl()
        const url = panelUrl && String(aporte?.archivo || '').startsWith('/media/') ? `${panelUrl}${aporte.archivo}` : safeString(aporte?.archivo || '')
        if (url) return m.reply(`📎 *No pude enviar el archivo*\n\n> *Motivo:* _${waSafeInline(sent.reason)}_\n> *Link:* ${url}`)
        return m.reply(`📎 *No pude enviar el archivo*\n\n> *Motivo:* _${waSafeInline(sent.reason)}_`)
      }

      const panelUrl = getPanelUrl()
      const url = panelUrl && String(aporte?.archivo || '').startsWith('/media/') ? `${panelUrl}${aporte.archivo}` : safeString(aporte?.archivo || '')
      if (url) return m.reply(`${caption}\n\n> *Link:* ${url}`)
      return m.reply('📎 *Error*\n\n> _Este aporte no tiene archivo adjunto._')
    }

    case 'procesarpedido':
    case 'buscarpedido': {
      const id = parseInt(args[0])
      if (!id) return m.reply(`🔎 *Procesar pedido*\n\n> \`\`\`${usedPrefix}${command} <id> [idProveedor|jidProveedor]\`\`\``)

      const pedido = panel.pedidos[id]
      if (!pedido) return m.reply(`❌ *Error*\n\n> _Pedido #${id} no encontrado._`)

      const canProcess = isBotOwner || (m.isGroup && isAdmin)
      if (!canProcess) return m.reply('❌ *No permitido*\n\n> _Solo admins pueden procesar pedidos._')

      const providerArg = resolveProveedorJid(panel, args[1])
      let targetProviderJid =
        providerArg ||
        pedido.proveedor_jid ||
        ((m.isGroup && panel?.proveedores?.[m.chat]) ? m.chat : null)

      if (!targetProviderJid) {
        const proveedores = Object.values(panel?.proveedores || {})
        if (!proveedores.length) return m.reply('❌ *Error*\n\n> _No hay proveedores configurados._')
        if (proveedores.length === 1 && proveedores[0]?.jid) targetProviderJid = proveedores[0].jid
        else {
          const items = proveedores.slice(0, 10).map((p) => `> \`\`\`${p?.id ?? 'N/A'}\`\`\` ${waSafeInline(p?.nombre || p?.jid || 'Proveedor')}`).join('\n')
          return m.reply(
            `❌ *Pedido sin proveedor*\n\n` +
            `> \`\`\`${usedPrefix}${command} ${id} <idProveedor>\`\`\`\n\n` +
            `📦 *Proveedores*\n${items}`
          )
        }
      }

      const proveedor = panel?.proveedores?.[targetProviderJid] || null
      if (!proveedor) return m.reply('❌ *Error*\n\n> _El proveedor indicado no existe o no está configurado en el panel._')

      const { query, results } = await searchProviderLibrary(panel, targetProviderJid, pedido, 5)
      const hasMatches = results.length > 0
      pedido.estado = hasMatches ? 'en_proceso' : 'pendiente'
      pedido.fecha_actualizacion = new Date().toISOString()
      pedido.proveedor_jid = targetProviderJid
      pedido.bot = {
        processedAt: new Date().toISOString(),
        query,
        matches: results.map((r) => ({ id: r.it?.id, score: r.score })),
        note: hasMatches ? 'matches_found' : 'no_matches',
      }
      panel.pedidos[id] = pedido
      if (global.db?.write) await global.db.write().catch(() => { })

      try {
        const { emitPedidoUpdated } = await import('../lib/socket-io.js')
        emitPedidoUpdated(pedido)
      } catch { }

      let msg = formatSearchResults(pedido, query, results, usedPrefix, targetProviderJid)

      if (!results.length) {
        const matches = searchAportesForPedido(pedido, { limit: 5, includePending: isBotOwner || (m.isGroup && isAdmin) })
        msg = `${msg}\n\n${formatAportesMatches(pedido, matches, usedPrefix)}`
      }

      return m.reply(msg)
    }

    case 'enviarlib': {
      const libId = parseInt(args[0])
      if (!libId) return m.reply(`📥 *Enviar archivo de biblioteca*\n\n> \`\`\`${usedPrefix}enviarlib <id>\`\`\``)
      const item = panel?.contentLibrary?.[libId] || null
      if (!item) return m.reply(`❌ *Error*\n\n> _Archivo #${libId} no encontrado en biblioteca._`)

      if (m.isGroup && !isBotOwner && String(item?.proveedorJid || '') !== String(m.chat || '')) {
        return m.reply('❌ *No permitido*\n\n> _Este archivo pertenece a otro proveedor._')
      }

      const sent = await trySendLibraryItem(m, conn, item)
      if (sent.ok) return null

      const panelUrl = getPanelUrl()
      if (panelUrl && item?.url) {
        return m.reply(`📎 *No pude enviar el archivo*\n\n> *Motivo:* _${waSafeInline(sent.reason)}_\n> *Link:* ${panelUrl}${item.url}`)
      }
      return m.reply(`📎 *No pude enviar el archivo*\n\n> *Motivo:* _${waSafeInline(sent.reason)}_`)
    }

    default:
      return null
  }
}

handler.help = ['pedido', 'pedidos', 'mispedidos', 'verpedido', 'votarpedido', 'cancelarpedido', 'estadopedido', 'procesarpedido', 'enviarlib', 'buscaraporte', 'enviaraporte']
handler.tags = ['tools']
handler.command = [
  'pedido',
  'pedir',
  'pedidos',
  'listpedidos',
  'mispedidos',
  'verpedido',
  'votarpedido',
  'votepedido',
  'cancelarpedido',
  'estadopedido',
  'procesarpedido',
  'buscarpedido',
  'enviarlib',
  'buscaraporte',
  'enviaraporte',
]

export default handler
