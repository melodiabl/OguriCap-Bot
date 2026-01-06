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
    `   🗳️ Votos: ${pedido.votos || 0}`
  ]
  if (pedido.archivo) lines.push(`   📎 Adjunto: ${pedido.archivoNombre || 'archivo'}`)
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
  const classified = await classifyProviderLibraryContent({
    filename: pedido?.titulo || '',
    caption: pedido?.descripcion || '',
    provider: { jid: proveedorJid, tipo: panel?.proveedores?.[proveedorJid]?.tipo || '' },
  })

  const query = {
    title: classified?.title || pedido?.titulo || '',
    chapter: typeof classified?.chapter !== 'undefined' ? classified.chapter : null,
    category: classified?.category || null,
    tags: classified?.tags || [],
    descripcion: pedido?.descripcion || '',
  }

  const scored = list.map((it) => ({
    it,
    score: scoreLibraryItem(it, query),
  }))

  scored.sort((a, b) => b.score - a.score)
  const top = scored.filter((x) => x.score >= 18).slice(0, limit)
  return { query, results: top }
}

const formatSearchResults = (pedido, query, results, usedPrefix, proveedorJid) => {
  const panelUrl = getPanelUrl()
  const lines = []
  lines.push(`🔎 *Resultados para Pedido #${pedido.id}*`)
  lines.push(`📝 *Búsqueda:* ${query?.title || pedido.titulo}${query?.chapter ? ` (Cap ${query.chapter})` : ''}`)
  if (!results.length) {
    lines.push('')
    lines.push('❌ No encontré coincidencias en la biblioteca de este proveedor.')
    lines.push(`📌 Esto significa que *aún no está en el almacenamiento* (biblioteca).`)
    if (panelUrl && proveedorJid) {
      lines.push(`🌐 Biblioteca: ${panelUrl}/proveedores/${encodeURIComponent(String(proveedorJid))}`)
    }
    lines.push(`👑 Un admin/owner/mod puede subir el contenido y luego volver a intentar:`)
    lines.push(`   ${usedPrefix}procesarpedido ${pedido.id}`)
    lines.push(`💡 Tip: incluye capítulo (ej: "Jinx cap 10") o agrega más detalle en la descripción.`)
    return lines.join('\n')
  }

  lines.push('')
  lines.push(`✅ Encontré *${results.length}* coincidencia(s):`)
  lines.push('')

  for (let i = 0; i < results.length; i++) {
    const item = results[i].it
    const title = item?.title || item?.originalName || 'Sin título'
    const chapter = item?.chapter ? ` · Cap ${item.chapter}` : ''
    const cat = String(item?.category || 'other').toUpperCase()
    const fmt = String(item?.format || 'file').toUpperCase()
    const score = Math.round(results[i].score)
    lines.push(`${i + 1}. ${title}${chapter} · ${cat} · ${fmt} · score ${score}`)
    lines.push(`   🆔 ${item.id}`)
    if (panelUrl && item?.url) lines.push(`   🔗 ${panelUrl}${item.url}`)
  }

  lines.push('')
  lines.push(`📥 Para enviar un archivo: ${usedPrefix}enviarlib <id>`)
  return lines.join('\n')
}

const trySendLibraryItem = async (m, conn, item) => {
  const filePath = item?.file_path
  if (!filePath || !fs.existsSync(filePath)) return { ok: false, reason: 'Archivo no encontrado en disco' }

  const libraryRoot = path.resolve(path.join(process.cwd(), 'storage', 'library')).toLowerCase()
  const resolved = path.resolve(filePath).toLowerCase()
  if (!resolved.startsWith(libraryRoot)) return { ok: false, reason: 'Ruta inválida' }

  const maxMb = Number(process.env.PANEL_LIBRARY_SEND_MAX_MB || 20)
  const maxBytes = Math.max(1, Math.min(500, maxMb)) * 1024 * 1024
  const stat = fs.statSync(filePath)
  if (!stat.isFile()) return { ok: false, reason: 'No es un archivo' }
  if (stat.size > maxBytes) return { ok: false, reason: `Archivo muy grande (${Math.round(stat.size / 1024 / 1024)}MB)` }

  const filename = item?.originalName || item?.filename || `archivo_${item?.id || Date.now()}`
  const caption = `📚 ${item?.title || filename}${item?.chapter ? ` · Cap ${item.chapter}` : ''}\n🆔 ${item?.id}`
  await conn.sendFile(m.chat, filePath, filename, caption, m, null, { asDocument: true })
  return { ok: true }
}

const saveMedia = async (m, conn) => {
  // Intentar obtener el mensaje con multimedia
  const q = m.quoted ? m.quoted : m
  const msg = q.msg || q

  // Verificar si hay multimedia en el mensaje (cualquier tipo)
  const hasMedia = msg.imageMessage || msg.videoMessage || msg.audioMessage || msg.documentMessage || msg.stickerMessage
  if (!hasMedia) return null

  // Obtener el mimetype de cualquier tipo de mensaje multimedia
  const mime = msg.imageMessage?.mimetype ||
    msg.videoMessage?.mimetype ||
    msg.audioMessage?.mimetype ||
    msg.documentMessage?.mimetype ||
    msg.stickerMessage?.mimetype || ''

  // Para stickers, convertir a imagen
  if (msg.stickerMessage) {
    try {
      const mediaBuffer = await conn.downloadMediaMessage(q)
      if (!mediaBuffer) return null

      // Convertir sticker a imagen
      const { toImage } = await import('../lib/sticker.js')
      const imageBuffer = await toImage(mediaBuffer)

      const targetDir = path.join(process.cwd(), 'tmp', 'pedidos')
      fs.mkdirSync(targetDir, { recursive: true })

      const filename = `pedido_${Date.now()}.png`
      const dest = path.join(targetDir, filename)

      fs.writeFileSync(dest, imageBuffer)

      return {
        path: dest,
        mimetype: 'image/png',
        filename,
        size: imageBuffer.length
      }
    } catch (error) {
      console.error('Error convirtiendo sticker:', error)
      return null
    }
  }

  if (!mime) return null

  try {
    // Descargar el archivo
    const buffer = await conn.downloadMediaMessage(q)
    if (!buffer) return null

    const targetDir = path.join(process.cwd(), 'tmp', 'pedidos')
    fs.mkdirSync(targetDir, { recursive: true })

    // Determinar extensión a partir del mimetype o usar extension original
    const ext = mime.split('/')[1]?.split(';')[0] ||
      q.message?.documentMessage?.fileName?.split('.').pop() || 'bin'
    const originalFilename = q.message?.documentMessage?.fileName

    let filename
    if (originalFilename) {
      // Usar nombre original si es seguro
      filename = originalFilename.replace(/[^a-zA-Z0-9.-]/g, '_')
    } else {
      filename = `pedido_${Date.now()}.${ext}`
    }

    const dest = path.join(targetDir, filename)

    // Guardar archivo
    fs.writeFileSync(dest, buffer)

    return {
      path: dest,
      mimetype: mime,
      filename,
      size: buffer.length
    }
  } catch (error) {
    console.error('Error guardando multimedia:', error)
    return null
  }
}

let handler = async (m, { args, usedPrefix, command, conn }) => {
  ensureStore()
  const panel = global.db.data.panel

  if (shouldSkipDuplicateCommand(m, command)) return null

  switch (command) {
    case 'pedido':
    case 'pedir': {
      const raw = (args || []).join(' ').trim()
      const media = await saveMedia(m, conn)

      if (!raw && !media) {
        return m.reply(`📦 *Crear un pedido*

Uso: ${usedPrefix}${command} <título> | <descripción> | <prioridad>

Ejemplo:
${usedPrefix}${command} Manhwa Solo Leveling | Capítulos 1-50 | alta

También puedes adjuntar una imagen/video/documento

Prioridades: alta, media, baja`)
      }

      const parts = raw.split('|').map(s => s.trim())
      const titulo = parts[0] || (media ? 'Pedido con archivo adjunto' : '')
      const descripcion = parts[1] || ''
      const prioridad = ['alta', 'media', 'baja'].includes(parts[2]?.toLowerCase()) ? parts[2].toLowerCase() : 'media'

      if (!titulo) {
        return m.reply(`❌ Debes especificar un título para el pedido`)
      }

      const id = nextId()
      const now = new Date().toISOString()
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
        votos: 0,
        votantes: [],
        fecha_creacion: now,
        fecha_actualizacion: now,
        archivo: media?.path || null,
        archivoMime: media?.mimetype || null,
        archivoNombre: media?.filename || null
      }

      panel.pedidos[id] = pedido
      if (global.db?.write) await global.db.write().catch(() => { })

      // Emitir evento Socket.IO si está disponible
      try {
        const { emitPedidoCreated } = await import('../lib/socket-io.js')
        emitPedidoCreated(pedido)
      } catch { }

      // Auto-procesar pedido en grupos proveedor si está activado en el proveedor
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

      let msg = `✅ *Pedido creado exitosamente*

📦 ID: #${id}
📝 Título: ${titulo}
📋 Descripción: ${descripcion || 'Sin descripción'}
${prioridadEmoji[prioridad]} Prioridad: ${prioridad}`
      if (media) msg += `\n📎 Archivo: ${media.filename}`

      if (autoSearchText) {
        msg += `\n\n${autoSearchText}`
      } else if (m.isGroup && panel?.proveedores?.[m.chat]) {
        msg += `\n\n💡 Para buscar en la biblioteca: ${usedPrefix}procesarpedido ${id}`
      } else {
        msg += `\n\nℹ️ Para que el bot lo busque en la biblioteca, crea el pedido en el *grupo proveedor* o un admin lo procesa desde el panel.`
        msg += `\nUsa ${usedPrefix}verpedido ${id} para ver detalles`
      }

      return m.reply(msg)
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

      if (!pedidos.length) {
        return m.reply(`📦 No hay pedidos registrados.\n\nUsa ${usedPrefix}pedido para crear uno.`)
      }

      const msg = pedidos.map((p, i) => formatPedido(p, i + 1)).join('\n\n')
      return m.reply(`📦 *Lista de Pedidos*

${msg}

💡 Usa ${usedPrefix}votarpedido <id> para votar`)
    }

    case 'mispedidos': {
      const pedidos = Object.values(panel.pedidos || {})
        .filter(p => p.usuario === m.sender)
        .sort((a, b) => new Date(b.fecha_creacion) - new Date(a.fecha_creacion))
        .slice(0, 10)

      if (!pedidos.length) {
        return m.reply(`📦 No tienes pedidos registrados.\n\nUsa ${usedPrefix}pedido para crear uno.`)
      }

      const msg = pedidos.map((p, i) => formatPedido(p, i + 1)).join('\n\n')
      return m.reply(`📦 *Mis Pedidos*\n\n${msg}`)
    }

    case 'verpedido': {
      const id = parseInt(args[0])
      if (!id) {
        return m.reply(`Uso: ${usedPrefix}verpedido <id>`)
      }

      const pedido = panel.pedidos[id]
      if (!pedido) {
        return m.reply(`❌ Pedido #${id} no encontrado`)
      }

      const msg = [
        `📦 *Pedido #${id}*`,
        ``,
        `📝 *Título:* ${pedido.titulo}`,
        `📋 *Descripción:* ${pedido.descripcion || 'Sin descripción'}`,
        `${prioridadEmoji[pedido.prioridad]} *Prioridad:* ${pedido.prioridad}`,
        `${estadoEmoji[pedido.estado]} *Estado:* ${pedido.estado}`,
        `👤 *Solicitante:* @${pedido.usuario?.split('@')[0] || 'desconocido'}`,
        `📅 *Fecha:* ${formatDate(pedido.fecha_creacion)}`,
        `🗳️ *Votos:* ${pedido.votos || 0}`,
        pedido.grupo_nombre ? `👥 *Grupo:* ${pedido.grupo_nombre}` : '',
        pedido.archivo ? `📎 *Adjunto:* ${pedido.archivoNombre || 'archivo guardado'}` : ''
      ].filter(Boolean).join('\n')

      return conn.reply(m.chat, msg, m, { mentions: [pedido.usuario] })
    }

    case 'votarpedido':
    case 'votepedido': {
      const id = parseInt(args[0])
      if (!id) {
        return m.reply(`Uso: ${usedPrefix}votarpedido <id>`)
      }

      const pedido = panel.pedidos[id]
      if (!pedido) {
        return m.reply(`❌ Pedido #${id} no encontrado`)
      }

      if (pedido.estado === 'completado' || pedido.estado === 'cancelado') {
        return m.reply(`❌ No puedes votar por un pedido ${pedido.estado}`)
      }

      pedido.votantes = pedido.votantes || []
      if (pedido.votantes.includes(m.sender)) {
        return m.reply(`❌ Ya votaste por este pedido`)
      }

      pedido.votantes.push(m.sender)
      pedido.votos = (pedido.votos || 0) + 1
      pedido.fecha_actualizacion = new Date().toISOString()

      // Emitir evento Socket.IO
      try {
        const { emitPedidoUpdated } = await import('../lib/socket-io.js')
        emitPedidoUpdated(pedido)
      } catch { }

      return m.reply(`✅ ¡Voto registrado!\n\n📦 Pedido #${id}: ${pedido.titulo}\n🗳️ Votos totales: ${pedido.votos}`)
    }

    case 'cancelarpedido': {
      const id = parseInt(args[0])
      if (!id) {
        return m.reply(`Uso: ${usedPrefix}cancelarpedido <id>`)
      }

      const pedido = panel.pedidos[id]
      if (!pedido) {
        return m.reply(`❌ Pedido #${id} no encontrado`)
      }

      // Solo el creador o owner puede cancelar
      const isOwner = global.owner.map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net').includes(m.sender)
      if (pedido.usuario !== m.sender && !isOwner) {
        return m.reply(`❌ Solo el creador del pedido o un administrador puede cancelarlo`)
      }

      pedido.estado = 'cancelado'
      pedido.fecha_actualizacion = new Date().toISOString()

      // Emitir evento Socket.IO
      try {
        const { emitPedidoUpdated } = await import('../lib/socket-io.js')
        emitPedidoUpdated(pedido)
      } catch { }

      return m.reply(`✅ Pedido #${id} cancelado`)
    }

    case 'estadopedido': {
      const id = parseInt(args[0])
      const nuevoEstado = args[1]?.toLowerCase()

      if (!id || !nuevoEstado) {
        return m.reply(`Uso: ${usedPrefix}estadopedido <id> <estado>\n\nEstados: pendiente, en_proceso, completado, cancelado`)
      }

      const estadosValidos = ['pendiente', 'en_proceso', 'completado', 'cancelado']
      if (!estadosValidos.includes(nuevoEstado)) {
        return m.reply(`❌ Estado inválido. Usa: ${estadosValidos.join(', ')}`)
      }

      const pedido = panel.pedidos[id]
      if (!pedido) {
        return m.reply(`❌ Pedido #${id} no encontrado`)
      }

      // Solo owner puede cambiar estado
      const isOwner = global.owner.map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net').includes(m.sender)
      if (!isOwner) {
        return m.reply(`❌ Solo los administradores pueden cambiar el estado de los pedidos`)
      }

      pedido.estado = nuevoEstado
      pedido.fecha_actualizacion = new Date().toISOString()

      // Emitir evento Socket.IO
      try {
        const { emitPedidoUpdated } = await import('../lib/socket-io.js')
        emitPedidoUpdated(pedido)
      } catch { }

      return m.reply(`✅ Pedido #${id} actualizado a: ${estadoEmoji[nuevoEstado]} ${nuevoEstado}`)
    }

    case 'procesarpedido':
    case 'buscarpedido': {
      const id = parseInt(args[0])
      if (!id) return m.reply(`Uso: ${usedPrefix}${command} <id>`)
      const pedido = panel.pedidos[id]
      if (!pedido) return m.reply(`❌ Pedido #${id} no encontrado`)

      const targetGroup = pedido.grupo_id || (m.isGroup ? m.chat : null)
      if (!targetGroup || !String(targetGroup).endsWith('@g.us')) return m.reply('❌ Este pedido no tiene grupo asociado')

      const proveedor = panel?.proveedores?.[targetGroup] || null
      if (!proveedor) return m.reply('❌ El grupo asociado no está marcado como proveedor')

      const { query, results } = await searchProviderLibrary(panel, targetGroup, pedido, 5)
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

      return m.reply(formatSearchResults(pedido, query, results, usedPrefix, targetGroup))
    }

    case 'enviarlib': {
      const libId = parseInt(args[0])
      if (!libId) return m.reply(`Uso: ${usedPrefix}enviarlib <id>`)
      const item = panel?.contentLibrary?.[libId] || null
      if (!item) return m.reply(`❌ Archivo #${libId} no encontrado en biblioteca`)

      // Seguridad: solo permitir enviar archivos si viene del mismo proveedor (en grupos) o si el usuario es owner
      const isOwner = global.owner.map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net').includes(m.sender)
      if (m.isGroup && !isOwner && String(item?.proveedorJid || '') !== String(m.chat || '')) {
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
