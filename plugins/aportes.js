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

const saveMedia = async (m) => {
  const q = m.quoted ? m.quoted : m
  const msg = q.msg || q
  const mime = msg.mimetype || q.mediaType || ''
  if (!mime || !/image|video|audio|document/.test(mime)) return null
  if (typeof q.download !== 'function') return null

  const downloaded = await q.download(true)
  const targetDir = path.join(process.cwd(), 'tmp', 'aportes')
  fs.mkdirSync(targetDir, { recursive: true })

  if (typeof downloaded === 'string' && fs.existsSync(downloaded)) {
    const base = path.basename(downloaded)
    const dest = path.join(targetDir, base)
    if (dest !== downloaded) {
      try {
        fs.renameSync(downloaded, dest)
      } catch {
        fs.copyFileSync(downloaded, dest)
      }
    }
    return { path: dest, mimetype: mime }
  }

  if (Buffer.isBuffer(downloaded)) {
    const ext = mime.split('/')[1] || 'bin'
    const dest = path.join(targetDir, `aporte_${Date.now()}.${ext}`)
    fs.writeFileSync(dest, downloaded)
    return { path: dest, mimetype: mime }
  }

  return null
}

let handler = async (m, { args, usedPrefix, command }) => {
  ensureStore()
  const data = global.db.data

  switch (command) {
    case 'addaporte': {
      const raw = (args || []).join(' ').trim()
      const parts = raw.includes('|') ? raw.split('|').map(s => s.trim()) : [raw, 'extra']
      const contenido = parts[0] || ''
      const tipo = parts[1] || 'extra'
      const media = await saveMedia(m)

      if (!contenido && !media) {
        return m.reply(`Uso: ${usedPrefix}addaporte texto | tipo\nTambien puedes responder a un archivo con /addaporte texto | tipo`)
      }

      const entry = {
        id: data.aportesCounter++,
        usuario: m.sender,
        grupo: m.isGroup ? m.chat : null,
        contenido: contenido || '(adjunto)',
        tipo,
        fecha: new Date().toISOString(),
        estado: 'pendiente',
        archivo: media?.path || null
      }
      data.aportes.push(entry)

      let msg = 'Aporte registrado'
      msg += `\ncontenido: ${entry.contenido}`
      msg += `\ntipo: ${entry.tipo}`
      if (entry.archivo) msg += '\narchivo: adjunto guardado'
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
