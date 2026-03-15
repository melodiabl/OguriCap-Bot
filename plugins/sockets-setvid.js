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
  if (!mime || !/video\/(mp4|webm|mkv|mov)/.test(mime)) {
    return conn.reply(m.chat, `❐ Por favor, responde a un video usando *${usedPrefix + command}*`, m)
  }

  try {
    await m.react('🕒')
    const media = await q.download()
    if (!media) throw new Error('No se pudo descargar el video')

    const url = await uploadImage(media)

    const configPath = path.join(sessionDir, 'config.json')
    let config = {}
    if (fs.existsSync(configPath)) {
      try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')) } catch { config = {} }
    }
    config.video = url
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')

    conn.subbotRuntimeConfig = conn.subbotRuntimeConfig || {}
    conn.subbotRuntimeConfig.video = url

    await m.react('✅')
    return conn.reply(m.chat, `✩︎ Video actualizado correctamente:\n${url}`, m)
  } catch (e) {
    await m.react('✖️')
    return conn.reply(m.chat, `❌ No se pudo actualizar el video.\n\n${e?.message || e}`, m)
  }
}

handler.help = ['setvid']
handler.tags = ['serbot']
handler.command = ['setvid']

export default handler
