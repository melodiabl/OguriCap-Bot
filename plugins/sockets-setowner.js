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

function readConfig(configPath) {
  if (!fs.existsSync(configPath)) return {}
  try {
    const raw = fs.readFileSync(configPath, 'utf8')
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeConfig(configPath, cfg) {
  fs.writeFileSync(configPath, JSON.stringify(cfg, null, 2), 'utf8')
}

function parseBooleanInput(value) {
  const raw = String(value || '').trim().toLowerCase()
  if (!raw) return null
  if (['on', 'true', '1', 'si', 's', 'yes', 'ocultar', 'hide'].includes(raw)) return true
  if (['off', 'false', '0', 'no', 'n', 'show', 'mostrar'].includes(raw)) return false
  return null
}

function normalizeOwnerValue(raw) {
  const value = String(raw || '').trim()
  if (!value) return ''

  if (value.includes('@')) {
    const [id] = value.split('@')
    const digits = String(id || '').replace(/[^0-9]/g, '')
    if (digits) return `${digits}@s.whatsapp.net`
    return value.slice(0, 80)
  }

  const digits = value.replace(/[^0-9]/g, '')
  if (digits && /^\+?\d+$/.test(value)) return `${digits}@s.whatsapp.net`

  return value.slice(0, 80)
}

function formatOwnerDisplay(value) {
  const owner = String(value || '').trim()
  if (!owner) return 'Oculto por privacidad'
  if (!owner.includes('@')) return owner

  const digits = owner.split('@')[0].replace(/[^0-9]/g, '')
  if (!digits) return owner
  const jid = `${digits}@s.whatsapp.net`
  const name = global?.db?.data?.users?.[jid]?.name
  return String(name || digits)
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const allowed = [conn.user.jid, ...safeOwnerJids()].includes(m.sender)
  if (!allowed) return m.reply(`❀ El comando *${command}* solo puede ser ejecutado por el Socket.`)

  const sessionDir = resolveSessionDir(conn)
  if (!sessionDir) return m.reply('> ✎ Este comando es solo para instancias *Sub-Bot*.')

  const configPath = path.join(sessionDir, 'config.json')
  const config = readConfig(configPath)

  const rawCommand = String(command || '').toLowerCase()
  const trimmed = String(text || '').trim()
  const firstArg = trimmed.split(/\s+/)[0]?.toLowerCase() || ''
  const currentHidden = Boolean(config.hideOwner === true || config.hideowner === true || config.ownerHidden === true)
  const currentOwner = String(config.owner || '').trim()

  const showState = () => m.reply(
    `ꕤ Developer actual: *${formatOwnerDisplay(currentOwner)}*\n` +
    `ꕤ Modo oculto: *${currentHidden ? 'Activado' : 'Desactivado'}*\n\n` +
    `Uso:\n` +
    `• ${usedPrefix}${command} @usuario|numero|nombre\n` +
    `• ${usedPrefix}${command} oculto on\n` +
    `• ${usedPrefix}${command} oculto off\n` +
    `• ${usedPrefix}${command} reset`
  )

  if (!trimmed && rawCommand !== 'hideowner' && rawCommand !== 'ownerprivacy') return showState()

  if (rawCommand === 'hideowner' || rawCommand === 'ownerprivacy' || firstArg === 'oculto' || firstArg === 'hide' || firstArg === 'hidden' || firstArg === 'privacidad' || firstArg === 'privacy') {
    const toggleValue = rawCommand === 'hideowner' || rawCommand === 'ownerprivacy'
      ? parseBooleanInput(trimmed)
      : parseBooleanInput(trimmed.split(/\s+/).slice(1).join(' '))

    if (toggleValue == null) {
      return m.reply(
        `> ✿ Usa asi:\n` +
        `• ${usedPrefix}${command} oculto on\n` +
        `• ${usedPrefix}${command} oculto off`
      )
    }

    config.hideOwner = toggleValue
    config.hideowner = toggleValue
    config.ownerHidden = toggleValue
    writeConfig(configPath, config)

    conn.subbotRuntimeConfig = conn.subbotRuntimeConfig || {}
    conn.subbotRuntimeConfig.hideOwner = toggleValue
    conn.subbotRuntimeConfig.hideowner = toggleValue
    conn.subbotRuntimeConfig.ownerHidden = toggleValue

    return m.reply(toggleValue
      ? 'ꕤ Developer oculto en el menu.'
      : `ꕤ Developer visible en el menu: *${formatOwnerDisplay(config.owner)}*`)
  }

  if (['reset', 'default', 'clear', 'limpiar'].includes(firstArg)) {
    delete config.owner
    writeConfig(configPath, config)
    conn.subbotRuntimeConfig = conn.subbotRuntimeConfig || {}
    conn.subbotRuntimeConfig.owner = ''
    return m.reply('ꕤ Developer reiniciado. Si no hay owner definido se mostrara como oculto.')
  }

  const mentioned = await m.mentionedJid
  const mention = Array.isArray(mentioned) && mentioned[0] ? mentioned[0] : ''
  const ownerInput = mention || trimmed
  const ownerValue = normalizeOwnerValue(ownerInput)

  if (!ownerValue) return showState()

  config.owner = ownerValue
  writeConfig(configPath, config)

  conn.subbotRuntimeConfig = conn.subbotRuntimeConfig || {}
  conn.subbotRuntimeConfig.owner = ownerValue

  return m.reply(
    `ꕤ Developer actualizado: *${formatOwnerDisplay(ownerValue)}*\n` +
    `ꕤ Modo oculto: *${currentHidden ? 'Activado' : 'Desactivado'}*`
  )
}

handler.help = ['setowner', 'hideowner']
handler.tags = ['serbot']
handler.command = ['setowner', 'setbotowner', 'hideowner', 'ownerprivacy']

export default handler
