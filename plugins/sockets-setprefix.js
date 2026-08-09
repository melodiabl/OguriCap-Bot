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

function normalizePrefixRuntime(prefix) {
  const raw = String(prefix || '').trim()
  if (!raw) return null
  if (raw.toLowerCase() === 'multi') {
    return ['#', '!', '/', '.', '$', '@', '*', '&', '?', '+', '-', '_', ',', ';', ':']
  }
  return raw
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const allowed = [conn.user.jid, ...safeOwnerJids()].includes(m.sender)
  if (!allowed) return m.reply(`❀ El comando *${command}* solo puede ser ejecutado por el Socket.`)
  if (!text) {
    return m.reply(
      `> ✿ Proporciona un prefijo o usa *multi*.` +
      `\n> Ejemplo: ${usedPrefix + command} !` +
      `\n> Ejemplo: ${usedPrefix + command} multi`
    )
  }

  const sessionDir = resolveSessionDir(conn)
  if (!sessionDir) return m.reply('> ✎ Este comando es solo para instancias *Sub-Bot*.')

  const configPath = path.join(sessionDir, 'config.json')
  let config = {}
  if (fs.existsSync(configPath)) {
    try { config = JSON.parse(fs.readFileSync(configPath, 'utf8')) } catch { config = {} }
  }

  config.prefix = String(text).trim().toLowerCase().slice(0, 16)
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8')

  // Aplicar en caliente
  const runtime = normalizePrefixRuntime(config.prefix)
  if (runtime) conn.prefix = runtime

  conn.subbotRuntimeConfig = conn.subbotRuntimeConfig || {}
  conn.subbotRuntimeConfig.prefix = config.prefix

  if (config.prefix === 'multi') {
    return m.reply('> ✿ Prefijo en modo *MULTI* (varios prefijos).')
  }
  return m.reply(`> ✿ El prefijo del Socket ahora es: *${config.prefix}*`)
}

handler.help = ['setprefix']
handler.tags = ['serbot']
handler.command = ['setprefix']

export default handler
