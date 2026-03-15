import fs from 'fs'
import path from 'path'
import uploadImage from '../lib/uploadImage.js'

function safeOwnerJids() {
  const owners = Array.isArray(global.owner) ? global.owner : []
  return owners.map(n => String(n || '').replace(/[^0-9]/g, '') + '@s.whatsapp.net').filter(j => j !== '@s.whatsapp.net')
}

function resolveSessionDir(conn) {
  if (conn?.sessionPath && fs.existsSync(conn.sessionPath)) return conn.sessionPath
  const num = String(conn?.user?.jid || '').split('@')[0]
  const base = global.jadi || 'Sessions/SubBot'
  const p = path.join(base, num)
  return fs.existsSync(p) ? p : null
}

let handler = async (m, { conn, command, usedPrefix }) => {
  const allowed = [conn.user.jid, ...safeOwnerJids()].includes(m.sender)
  if (!allowed) return m.reply(`❀ El comando *${command}* solo puede ser ejecutado por el Socket.`)

  const sessionDir = resolveSessionDir(conn)
  if (!sessionDir) return m.reply('> ✎ Este comando es solo para instancias *Sub-Bot*.')

  const q = m.quoted || m
  const mime = (q.msg || q).mimetype || q.mediaType || ''
  if (!mime || !/image\/(jpe?g|png|webp)/.test(mime)) {
    return conn.reply(m.chat, `❐ Por favor, responde a una imagen (JPG/PNG/WEBP) usando *${usedPrefix + command}*`, m)
  }

  try {
    await m.react('🕒')
    const media = await q.download()
    if (!media) throw new Error('No se pudo descargar la imagen')

    const url = await uploadImage(media)

    const configPath = path.join(sessionDir, 'config.json')
    let config = {}
    if (fs.existsSync(configPath)) {
      try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')) } catch { config = {} }
    }
    config.banner = url
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')

    conn.subbotRuntimeConfig = conn.subbotRuntimeConfig || {}
    conn.subbotRuntimeConfig.banner = url

    await m.react('✅')
    return conn.reply(m.chat, `✩︎ Imagen actualizada correctamente:\n${url}`, m)
  } catch (e) {
    await m.react('✖️')
    return conn.reply(m.chat, `❌ No se pudo actualizar la imagen.\n\n${e?.message || e}`, m)
  }
}

handler.help = ['setimagen']
handler.tags = ['serbot']
handler.command = ['setimagen']

export default handler
