import fs from 'fs'
import path from 'path'

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

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const allowed = [conn.user.jid, ...safeOwnerJids()].includes(m.sender)
  if (!allowed) return m.reply(`❀ El comando *${command}* solo puede ser ejecutado por el Socket.`)
  if (!text) return m.reply(`⌗ Usa así: *${usedPrefix + command} nombre*`)

  const sessionDir = resolveSessionDir(conn)
  if (!sessionDir) return m.reply('> ✎ Este comando es solo para instancias *Sub-Bot*.')

  const configPath = path.join(sessionDir, 'config.json')
  let config = {}
  if (fs.existsSync(configPath)) {
    try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')) } catch { config = {} }
  }

  config.name = String(text).trim().slice(0, 32)
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')

  conn.subbotRuntimeConfig = conn.subbotRuntimeConfig || {}
  conn.subbotRuntimeConfig.name = config.name

  return m.reply(`ꕤ︎ Nombre del Socket cambiado a: *${config.name}*`)
}

handler.help = ['setname']
handler.tags = ['serbot']
handler.command = ['setname']

export default handler
