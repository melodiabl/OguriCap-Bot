import fs from 'fs'
import path from 'path'

const MEDIA_TYPE_MAP = {
  imageMessage: 'image',
  videoMessage: 'video',
  audioMessage: 'audio',
  documentMessage: 'document',
  stickerMessage: 'sticker',
}

const sanitizeFilename = (input) =>
  String(input || '')
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 140)

const ensureStore = () => {
  if (!global.db.data.aportes) global.db.data.aportes = []
  if (!global.db.data.aportesCounter) {
    const lastId = global.db.data.aportes.reduce((max, item) => Math.max(max, item.id || 0), 0)
    global.db.data.aportesCounter = lastId + 1
  }
}

const ensureMediaDir = () => {
  const dir = path.join(process.cwd(), 'storage', 'media', 'aportes')
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

const formatDate = (value) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toISOString().slice(0, 10)
}

const formatEntry = (entry, index, showUser) => {
  const lines = [
    `${index}. ${entry.contenido || '-'}`,
    `  tipo: ${entry.tipo || 'extra'}`,
    `  estado: ${entry.estado || 'pendiente'}`,
    `  fecha: ${formatDate(entry.fecha)}`,
  ]
  if (showUser) lines.splice(3, 0, `  usuario: ${entry.usuario || '-'}`)
  if (entry.archivo) lines.push(`  archivo: ${entry.archivo}`)
  return lines.join('\n')
}

const detectMedia = (m) => {
  try {
    const q = m?.quoted ? m.quoted : m
    const mediaMessage = q?.mediaMessage && typeof q.mediaMessage === 'object' ? q.mediaMessage : null
    if (!mediaMessage) return null

    const key = Object.keys(mediaMessage)[0]
    const kind = MEDIA_TYPE_MAP[key]
    const content = mediaMessage[key]
    if (!kind || !content) return null

    const mimetype = content?.mimetype || ''
    const fileName = content?.fileName || content?.file_name || null

    return { kind, key, content, mimetype, fileName }
  } catch {
    return null
  }
}

const saveMedia = async (m, conn) => {
  const media = detectMedia(m)
  if (!media) return null

  try {
    const rawBuffer = await conn.downloadM(media.content, media.kind)
    if (!rawBuffer || !Buffer.isBuffer(rawBuffer) || rawBuffer.length === 0) return null

    let buffer = rawBuffer
    let mimetype = media.mimetype
    let filenameBase = sanitizeFilename(media.fileName) || `aporte_${Date.now()}`
    let ext =
      mimetype?.split('/')[1]?.split(';')[0] ||
      (media.fileName ? String(media.fileName).split('.').pop() : null) ||
      (media.kind === 'image' ? 'jpg' : media.kind === 'video' ? 'mp4' : media.kind === 'audio' ? 'mp3' : 'bin')

    if (media.kind === 'sticker') {
      const { toImage } = await import('../lib/sticker.js')
      buffer = await toImage(rawBuffer)
      mimetype = 'image/png'
      ext = 'png'
      filenameBase = filenameBase.replace(/\.(webp|png|jpg|jpeg)$/i, '') || `aporte_${Date.now()}`
    }

    ext = String(ext || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin'
    const filename = `${filenameBase}.${ext}`

    const targetDir = ensureMediaDir()
    const dest = path.join(targetDir, filename)
    fs.writeFileSync(dest, buffer)

    return {
      path: path.relative(process.cwd(), dest),
      url: `/media/aportes/${encodeURIComponent(filename)}`,
      mimetype,
      filename,
      size: buffer.length,
    }
  } catch (error) {
    console.error('Error guardando multimedia:', error)
    return null
  }
}

let handler = async (m, { args, usedPrefix, command, conn }) => {
  ensureStore()
  const data = global.db.data

  switch (command) {
    case 'addaporte': {
      const raw = (args || []).join(' ').trim()
      const parts = raw.includes('|') ? raw.split('|').map(s => s.trim()) : [raw, 'extra']
      const contenido = parts[0] || ''
      const tipo = parts[1] || 'extra'
      const media = await saveMedia(m, conn)

      if (!contenido && !media) {
        return m.reply(`Uso: ${usedPrefix}addaporte texto | tipo\nTambien puedes enviar una imagen/video/documento con el comando\nO responder a un archivo con /addaporte texto | tipo`)
      }

      const entry = {
        id: data.aportesCounter++,
        usuario: m.sender,
        grupo: m.isGroup ? m.chat : null,
        contenido: contenido || '(adjunto)',
        tipo,
        fecha: new Date().toISOString(),
        estado: 'pendiente',
        archivo: media?.url || null,
        archivoPath: media?.path || null,
        archivoMime: media?.mimetype || null,
        archivoNombre: media?.filename || null
      }
      data.aportes.push(entry)
      if (global.db?.write) await global.db.write().catch(() => { })

      // Emitir evento Socket.IO
      try {
        const { emitAporteCreated } = await import('../lib/socket-io.js')
        emitAporteCreated(entry)
      } catch { }

      let msg = '✅ Aporte registrado exitosamente'
      msg += `\n\n🆔 ID: #${entry.id}`
      msg += `\n📝 Contenido: ${entry.contenido}`
      msg += `\n🏷️ Tipo: ${entry.tipo}`
      if (entry.archivo) msg += `\n📎 Archivo: ${entry.archivoNombre || 'adjunto guardado'}`
      return m.reply(msg)
    }
    case 'aportes': {
      const list = data.aportes
        .filter(item => !m.isGroup || item.grupo === m.chat)
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .slice(0, 20)

      if (!list.length) return m.reply('No hay aportes registrados.')
      const msg = list.map((entry, i) => formatEntry(entry, i + 1, !m.isGroup)).join('\n\n')
      return m.reply(`Lista de aportes\n\n${msg}`)
    }
    case 'myaportes': {
      const list = data.aportes
        .filter(item => item.usuario === m.sender)
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .slice(0, 10)

      if (!list.length) return m.reply('No tienes aportes registrados.')
      const msg = list.map((entry, i) => formatEntry(entry, i + 1, false)).join('\n\n')
      return m.reply(`Mis aportes\n\n${msg}`)
    }
    default:
      return null
  }
}

handler.help = ['addaporte', 'aportes', 'myaportes']
handler.tags = ['tools']
handler.command = ['addaporte', 'aportes', 'myaportes']

export default handler
