import fs from 'fs'
import path from 'path'

const ensureStore = () => {
  if (!global.db.data.aportes) global.db.data.aportes = []
  if (!global.db.data.aportesCounter) {
    const lastId = global.db.data.aportes.reduce((max, item) => Math.max(max, item.id || 0), 0)
    global.db.data.aportesCounter = lastId + 1
  }
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
    `  fecha: ${formatDate(entry.fecha)}`
  ]
  if (showUser) lines.splice(3, 0, `  usuario: ${entry.usuario || '-'}`)
  if (entry.archivo) lines.push(`  archivo: ${entry.archivo}`)
  return lines.join('\n')
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

      const targetDir = path.join(process.cwd(), 'tmp', 'aportes')
      fs.mkdirSync(targetDir, { recursive: true })

      const filename = `aporte_${Date.now()}.png`
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

    const targetDir = path.join(process.cwd(), 'tmp', 'aportes')
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
      filename = `aporte_${Date.now()}.${ext}`
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
        archivo: media?.path || null,
        archivoMime: media?.mimetype || null,
        archivoNombre: media?.filename || null
      }
      data.aportes.push(entry)

      // Emitir evento Socket.IO
      try {
        const { emitAporteCreated } = await import('../lib/socket-io.js')
        emitAporteCreated(entry)
      } catch { }

      let msg = '✅ Aporte registrado exitosamente'
      msg += `\n\n🆔 ID: #${entry.id}`
      msg += `\n📝 Contenido: ${entry.contenido}`
      msg += `\n📂 Tipo: ${entry.tipo}`
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
