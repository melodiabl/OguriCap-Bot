import fs from 'fs'
import path from 'path'
import { classifyProviderLibraryContent } from '../lib/provider-content-classifier.js'

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
}

const nextId = () => {
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
  baja: '🟢'
}

const estadoEmoji = {
  pendiente: '⏳',
  en_proceso: '🔄',
  completado: '✅',
  cancelado: '❌'
}

const formatPedido = (pedido, index) => {
  const lines = [
    `${index}. ${pedido.titulo || 'Sin título'}`,
    `   ${prioridadEmoji[pedido.prioridad] || '⚪'} Prioridad: ${pedido.prioridad || 'media'}`,
    `   ${estadoEmoji[pedido.estado] || '⏳'} Estado: ${pedido.estado || 'pendiente'}`,
    `   📝 ${pedido.descripcion || 'Sin descripción'}`,
    `   👤 Usuario: ${pedido.usuario || '-'}`,
    `   📅 Fecha: ${formatDate(pedido.fecha_creacion)}`,
    `   👍 Votos: ${pedido.votos || 0}`
  ]
  return lines.join('\n')
}

const stopwords = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'y', 'o', 'a', 'en', 'por', 'para', 'con', 'sin',
  'un', 'una', 'unos', 'unas', 'que', 'se', 'su', 'sus', 'al', 'lo', 'le', 'les',
  'cap', 'capitulo', 'capítulo', 'chapter', 'ch', 'episodio', 'ep', 'pdf', 'epub',
])

const normalizeText = (s) => String(s || '')
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
  lines.push(`📝 Pedido: *${pedido?.titulo || ''}*`)
  if (query?.title && query.title !== pedido?.titulo) lines.push(`🧠 Interpretado: *${query.title}*`)
  if (query?.category) lines.push(`🏷️ Categoría: *${query.category}*`)
  if (query?.chapter != null) lines.push(`📄 Capítulo: *${query.chapter}*`)
  lines.push('')

  if (!results.length) {
    lines.push('❌ No encontré coincidencias en la biblioteca del proveedor.')
    const panelUrl = getPanelUrl()
    if (panelUrl && proveedorJid) lines.push(`🌐 Proveedor: ${panelUrl}/proveedores/${encodeURIComponent(String(proveedorJid))}`)
    return lines.join('\n')
  }

  lines.push('✅ Coincidencias:')
  results.forEach((r, idx) => {
    const it = r.it || {}
    const title = it.title || it.originalName || `Archivo #${it.id || '?'}`
    const score = Math.round(r.score)
    lines.push(`${idx + 1}. ${title} (score ${score})`)
  })
  lines.push('')
  lines.push(`📥 Para enviar: ${usedPrefix}enviarlib <id>`)
  return lines.join('\n')
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
          `Uso: ${usedPrefix}${command} <título> | <descripción> | <prioridad>\n` +
          `Ejemplo: ${usedPrefix}${command} Solo Leveling | Capítulos 1-50 | alta\n\n` +
          `Prioridades: alta, media, baja`
        )
      }

      const parts = raw.split('|').map(s => s.trim())
      const titulo = parts[0] || ''
      const descripcion = parts[1] || ''
      const prioridad = ['alta', 'media', 'baja'].includes(parts[2]?.toLowerCase()) ? parts[2].toLowerCase() : 'media'

      if (!titulo) return m.reply('❌ Debes especificar un título para el pedido')

      const id = nextId()
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

      // Auto-procesar si este grupo es proveedor y lo tiene activado
      let autoSearchText = ''
      try {
        const proveedor = panel?.proveedores?.[m.chat] || null
        const auto = Boolean(proveedor?.auto_procesar_pedidos)
        if (m.isGroup && auto) {
          const { query, results } = await searchProviderLibrary(panel, m.chat, pedido, 5)
          const hasMatches = results.length > 0
          pedido.estado = hasMatches ? 'en_proceso' : 'pendiente'
          pedido.fecha_actualizacion = new Date().toISOString()
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
          autoSearchText = formatSearchResults(pedido, query, results, usedPrefix, m.chat)
        }
      } catch { }

      let msg =
        `✅ *Pedido creado*\n\n` +
        `🆔 ID: #${id}\n` +
        `📝 Título: ${titulo}\n` +
        `📄 Descripción: ${descripcion || 'Sin descripción'}\n` +
        `${prioridadEmoji[prioridad]} Prioridad: ${prioridad}\n`

      if (autoSearchText) {
        msg += `\n${autoSearchText}`
        return m.reply(msg.trim())
      }

      if (proveedorJid) {
        msg += `\n🔎 Para buscar en la biblioteca: ${usedPrefix}procesarpedido ${id}`
        return m.reply(msg.trim())
      }

      const proveedores = Object.values(panel?.proveedores || {})
      if (!proveedores.length) {
        msg += `\nℹ️ No hay *proveedores* configurados. Un admin debe registrarlo en el panel para poder buscar en biblioteca.`
        msg += `\nUsa ${usedPrefix}verpedido ${id} para ver detalles`
        return m.reply(msg.trim())
      }

      if (proveedores.length === 1 && proveedores[0]?.jid) {
        msg += `\n🔎 Un admin puede procesarlo con: ${usedPrefix}procesarpedido ${id} ${proveedores[0].jid}`
        msg += `\nUsa ${usedPrefix}verpedido ${id} para ver detalles`
        return m.reply(msg.trim())
      }

      const items = proveedores.slice(0, 6).map((p) => `- ${p?.nombre || p?.jid || 'Proveedor'} (id: ${p?.id ?? 'N/A'})`).join('\n')
      msg += `\n🔎 Un admin puede procesarlo con:`
      msg += `\n${usedPrefix}procesarpedido ${id} <idProveedor>`
      msg += `\n\nProveedores:\n${items}`
      msg += `\nUsa ${usedPrefix}verpedido ${id} para ver detalles`
      return m.reply(msg.trim())
    }

    case 'pedidos':
    case 'listpedidos': {
      const pedidos = Object.values(panel.pedidos || {})
        .filter(p => p.estado !== 'cancelado')
        .sort((a, b) => {
          const prioridadOrder = { alta: 0, media: 1, baja: 2 }
          return (prioridadOrder[a.prioridad] || 1) - (prioridadOrder[b.prioridad] || 1)
        })
        .slice(0, 15)

      if (!pedidos.length) return m.reply(`📝 No hay pedidos registrados.\n\nUsa ${usedPrefix}pedido para crear uno.`)
      const msg = pedidos.map((p, i) => formatPedido(p, i + 1)).join('\n\n')
      return m.reply(`📋 *Lista de Pedidos*\n\n${msg}\n\n👍 Usa ${usedPrefix}votarpedido <id> para votar`)
    }

    case 'mispedidos': {
      const pedidos = Object.values(panel.pedidos || {})
        .filter(p => p.usuario === m.sender)
        .sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion))
        .slice(0, 10)

      if (!pedidos.length) return m.reply(`📝 No tienes pedidos registrados.\n\nUsa ${usedPrefix}pedido para crear uno.`)
      const msg = pedidos.map((p, i) => formatPedido(p, i + 1)).join('\n\n')
      return m.reply(`📋 *Mis Pedidos*\n\n${msg}`)
    }

    case 'verpedido': {
      const id = parseInt(args[0])
      if (!id) return m.reply(`Uso: ${usedPrefix}verpedido <id>`)

      const pedido = panel.pedidos[id]
      if (!pedido) return m.reply(`❌ Pedido #${id} no encontrado`)

      const proveedor = pedido?.proveedor_jid ? (panel?.proveedores?.[pedido.proveedor_jid] || null) : null
      const proveedorTxt = proveedor ? (proveedor.nombre || proveedor.jid) : (pedido?.proveedor_jid || '')

      const msg = [
        `🧾 *Pedido #${id}*`,
        ``,
        `📝 *Título:* ${pedido.titulo}`,
        `📄 *Descripción:* ${pedido.descripcion || 'Sin descripción'}`,
        `${prioridadEmoji[pedido.prioridad]} *Prioridad:* ${pedido.prioridad}`,
        `${estadoEmoji[pedido.estado]} *Estado:* ${pedido.estado}`,
        `👤 *Solicitante:* @${pedido.usuario?.split('@')[0] || 'desconocido'}`,
        `📅 *Fecha:* ${formatDate(pedido.fecha_creacion)}`,
        `👍 *Votos:* ${pedido.votos || 0}`,
        pedido.grupo_nombre ? `👥 *Grupo:* ${pedido.grupo_nombre}` : '',
        proveedorTxt ? `🏷️ *Proveedor:* ${proveedorTxt}` : ''
      ].filter(Boolean).join('\n')

      return conn.reply(m.chat, msg, m, { mentions: [pedido.usuario] })
    }

    case 'votarpedido':
    case 'votepedido': {
      const id = parseInt(args[0])
      if (!id) return m.reply(`Uso: ${usedPrefix}votarpedido <id>`)

      const pedido = panel.pedidos[id]
      if (!pedido) return m.reply(`❌ Pedido #${id} no encontrado`)
      if (pedido.estado === 'completado' || pedido.estado === 'cancelado') return m.reply(`❌ No puedes votar por un pedido ${pedido.estado}`)

      pedido.votantes = pedido.votantes || []
      if (pedido.votantes.includes(m.sender)) return m.reply('❌ Ya votaste por este pedido')

      pedido.votantes.push(m.sender)
      pedido.votos = (pedido.votos || 0) + 1
      pedido.fecha_actualizacion = new Date().toISOString()
      if (global.db?.write) await global.db.write().catch(() => { })

      try {
        const { emitPedidoUpdated } = await import('../lib/socket-io.js')
        emitPedidoUpdated(pedido)
      } catch { }

      return m.reply(`✅ ¡Voto registrado!\n\n🧾 Pedido #${id}: ${pedido.titulo}\n👍 Votos totales: ${pedido.votos}`)
    }

    case 'cancelarpedido': {
      const id = parseInt(args[0])
      if (!id) return m.reply(`Uso: ${usedPrefix}cancelarpedido <id>`)

      const pedido = panel.pedidos[id]
      if (!pedido) return m.reply(`❌ Pedido #${id} no encontrado`)

      if (pedido.usuario !== m.sender && !isBotOwner) {
        return m.reply('❌ Solo el creador del pedido o el owner puede cancelarlo')
      }

      pedido.estado = 'cancelado'
      pedido.fecha_actualizacion = new Date().toISOString()
      if (global.db?.write) await global.db.write().catch(() => { })

      try {
        const { emitPedidoUpdated } = await import('../lib/socket-io.js')
        emitPedidoUpdated(pedido)
      } catch { }

      return m.reply(`✅ Pedido #${id} cancelado`)
    }

    case 'estadopedido': {
      const id = parseInt(args[0])
      const nuevoEstado = args[1]?.toLowerCase()
      if (!id || !nuevoEstado) return m.reply(`Uso: ${usedPrefix}estadopedido <id> <estado>\n\nEstados: pendiente, en_proceso, completado, cancelado`)

      const estadosValidos = ['pendiente', 'en_proceso', 'completado', 'cancelado']
      if (!estadosValidos.includes(nuevoEstado)) return m.reply(`❌ Estado inválido. Usa: ${estadosValidos.join(', ')}`)

      const pedido = panel.pedidos[id]
      if (!pedido) return m.reply(`❌ Pedido #${id} no encontrado`)

      const canModerate = isBotOwner || (m.isGroup && isAdmin && String(m.chat) === String(pedido.grupo_id || ''))
      if (!canModerate) return m.reply('❌ Solo el owner o admins del grupo pueden cambiar el estado')

      pedido.estado = nuevoEstado
      pedido.fecha_actualizacion = new Date().toISOString()
      if (global.db?.write) await global.db.write().catch(() => { })

      try {
        const { emitPedidoUpdated } = await import('../lib/socket-io.js')
        emitPedidoUpdated(pedido)
      } catch { }

      return m.reply(`✅ Pedido #${id} actualizado a: ${estadoEmoji[nuevoEstado]} ${nuevoEstado}`)
    }

    case 'procesarpedido':
    case 'buscarpedido': {
      const id = parseInt(args[0])
      if (!id) return m.reply(`Uso: ${usedPrefix}${command} <id> [idProveedor|jidProveedor]`)

      const pedido = panel.pedidos[id]
      if (!pedido) return m.reply(`❌ Pedido #${id} no encontrado`)

      const canProcess = isBotOwner || (m.isGroup && isAdmin)
      if (!canProcess) return m.reply('❌ Solo admins pueden procesar pedidos')

      const providerArg = resolveProveedorJid(panel, args[1])
      let targetProviderJid =
        providerArg ||
        pedido.proveedor_jid ||
        ((m.isGroup && panel?.proveedores?.[m.chat]) ? m.chat : null)

      if (!targetProviderJid) {
        const proveedores = Object.values(panel?.proveedores || {})
        if (!proveedores.length) return m.reply('❌ No hay proveedores configurados. Configura uno en el panel primero.')
        if (proveedores.length === 1 && proveedores[0]?.jid) targetProviderJid = proveedores[0].jid
        else {
          const items = proveedores.slice(0, 10).map((p) => `- ${p?.nombre || p?.jid || 'Proveedor'} (id: ${p?.id ?? 'N/A'})`).join('\n')
          return m.reply(
            `❌ Este pedido no tiene proveedor asignado.\n\n` +
            `Usa:\n${usedPrefix}${command} ${id} <idProveedor>\n\nProveedores:\n${items}`
          )
        }
      }

      const proveedor = panel?.proveedores?.[targetProviderJid] || null
      if (!proveedor) return m.reply('❌ El proveedor indicado no existe o no está configurado en el panel')

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

      return m.reply(formatSearchResults(pedido, query, results, usedPrefix, targetProviderJid))
    }

    case 'enviarlib': {
      const libId = parseInt(args[0])
      if (!libId) return m.reply(`Uso: ${usedPrefix}enviarlib <id>`)
      const item = panel?.contentLibrary?.[libId] || null
      if (!item) return m.reply(`❌ Archivo #${libId} no encontrado en biblioteca`)

      if (m.isGroup && !isBotOwner && String(item?.proveedorJid || '') !== String(m.chat || '')) {
        return m.reply('❌ Este archivo pertenece a otro proveedor')
      }

      const sent = await trySendLibraryItem(m, conn, item)
      if (sent.ok) return null

      const panelUrl = getPanelUrl()
      if (panelUrl && item?.url) {
        return m.reply(`📎 No pude enviar el archivo (${sent.reason}).\n🔗 Descarga: ${panelUrl}${item.url}`)
      }
      return m.reply(`📎 No pude enviar el archivo: ${sent.reason}`)
    }

    default:
      return null
  }
}

handler.help = ['pedido', 'pedidos', 'mispedidos', 'verpedido', 'votarpedido', 'cancelarpedido', 'estadopedido', 'procesarpedido', 'enviarlib']
handler.tags = ['tools']
handler.command = ['pedido', 'pedir', 'pedidos', 'listpedidos', 'mispedidos', 'verpedido', 'votarpedido', 'votepedido', 'cancelarpedido', 'estadopedido', 'procesarpedido', 'buscarpedido', 'enviarlib']

export default handler
