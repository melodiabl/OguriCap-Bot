import fs from 'fs'
import path from 'path'

const BANNERS_DIR = path.resolve('./Sessions/Banners')

function safeOwnerJids() {
  const owners = Array.isArray(global.owner) ? global.owner : []
  return owners.map(n => String(n || '').replace(/[^0-9]/g, '') + '@s.whatsapp.net').filter(j => j !== '@s.whatsapp.net')
}

function getBotJid(conn) {
  return String(conn?.user?.jid || conn?.user?.id || '').split(':')[0]
}

function getBotSettings(conn) {
  const jid = getBotJid(conn)
  if (!jid) return null
  if (!global.db.data.settings) global.db.data.settings = {}
  if (!global.db.data.settings[jid]) global.db.data.settings[jid] = {}
  return global.db.data.settings[jid]
}

const handler = async (m, { conn, command, usedPrefix }) => {
  const allowed = [conn.user.jid, ...safeOwnerJids()].includes(m.sender)
  if (!allowed) return m.reply(`❀ El comando *${command}* solo puede ser ejecutado por el Socket.`)

  if (command === 'delbanner' || command === 'deletebanner') {
    const settings = getBotSettings(conn)
    if (!settings?.banner) return m.reply('ꕥ No hay banner establecido.')
    const old = settings.banner
    delete settings.banner
    if (conn.subbotRuntimeConfig) conn.subbotRuntimeConfig.banner = ''
    if (fs.existsSync(old)) fs.unlinkSync(old)
    if (global.db?.write) await global.db.write().catch(() => {})
    return m.reply('❀ Se eliminó el banner del menú.')
  }

  const q = m.quoted || m
  const mime = (q.msg || q).mimetype || ''
  if (!/image\/(png|jpe?g)/.test(mime)) return m.reply(`❀ Responde o envía una imagen para cambiar el banner del menú.\n> Ejemplo: envía la imagen y escribe *${usedPrefix + command}*`)

  await m.react('🕒')
  const media = await q.download()
  if (!media) return m.reply('ꕥ No se pudo obtener la imagen.')

  if (!fs.existsSync(BANNERS_DIR)) fs.mkdirSync(BANNERS_DIR, { recursive: true })

  const num = getBotJid(conn).split('@')[0]
  const filePath = path.join(BANNERS_DIR, `${num}.jpg`)
  fs.writeFileSync(filePath, media)

  const settings = getBotSettings(conn)
  if (!settings) return m.reply('ꕥ No se pudo guardar el banner.')
  settings.banner = filePath
  if (conn.subbotRuntimeConfig) conn.subbotRuntimeConfig.banner = filePath
  if (global.db?.write) await global.db.write().catch(() => {})

  await m.react('✔️')
  return m.reply('❀ Se actualizó el banner del menú. Se verá en el próximo *#menu*.')
}

handler.help = ['setbanner', 'delbanner']
handler.tags = ['serbot']
handler.command = ['setbanner', 'setbotbanner', 'delbanner', 'deletebanner']

export default handler
