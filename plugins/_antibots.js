import { areJidsSameUser } from '@whiskeysockets/baileys'

let handler = async (m, { conn, args, usedPrefix, command }) => {
  if (!m.isGroup) return

  const chat = global.db.data.chats[m.chat]

  if (!args[0]) {
    return conn.reply(
      m.chat,
      `🤖 *Anti-Bots*\n\n${usedPrefix + command} on\n${usedPrefix + command} off\n\nEstado: ${chat.antiBot ? '✅ Activado' : '❌ Desactivado'}`,
      m
    )
  }

  if (args[0] === 'on') {
    chat.antiBot = true
    return conn.reply(m.chat, '✅ Anti-Bots activado', m)
  }

  if (args[0] === 'off') {
    chat.antiBot = false
    return conn.reply(m.chat, '❌ Anti-Bots desactivado', m)
  }
}

handler.before = async function (m, { conn, isBotAdmin, isAdmin, isOwner, participants }) {
  if (!m.isGroup) return
  if (m.fromMe) return
  if (!m.chat?.endsWith('@g.us')) return

  const chat = global.db.data.chats[m.chat]
  if (!chat?.antiBot) return

  // ───── NORMALIZAR SENDER (@lid → @s.whatsapp.net)
  const normalizeJid = (jid) => {
    if (!jid?.endsWith('@lid')) return jid
    const p = participants?.find(x => x.lid === jid)
    return p?.jid || jid
  }

  const sender = normalizeJid(m.sender)

  // ───── DETECCIÓN POR ID (TU MÉTODO)
  const id = m.key?.id || m.id || ''
  const isBotMessage =
    id.startsWith('BAE5') ||
    id.startsWith('3EB0') ||
    id.startsWith('B24E') ||
    id.startsWith('WA') ||
    m.isBaileys === true

  if (!isBotMessage) return

  // ───── EXCEPCIONES
  if (isAdmin || isOwner) return

  // Bot principal
  if (areJidsSameUser(conn.user.jid, sender)) return true

  // Subbots conectados
  if (global.conns?.some(sock =>
    sock?.user?.jid && areJidsSameUser(sock.user.jid, sender)
  )) return true

  // Padres de SubBots (subbot creado por WhatsApp desde este sistema)
  if (global.conns?.some(sock =>
    sock?.parentJid && areJidsSameUser(sock.parentJid, sender)
  )) return true

  // Subbots registrados en panel (offline)
  const panelSubs = global?.db?.data?.panel?.subbots
  if (panelSubs) {
    for (const sb of Object.values(panelSubs)) {
      const num = sb?.numero ?? sb?.phoneNumber ?? sb?.phone_number
      if (!num) continue
      const jid = `${String(num).replace(/\D/g, '')}@s.whatsapp.net`
      if (areJidsSameUser(jid, sender)) return true
    }
  }

  // Si no pudimos resolver @lid a JID real, evitamos expulsar por falso positivo
  if (typeof sender === 'string' && sender.endsWith('@lid')) return true

  // ───── ACCIÓN
  if (!isBotAdmin) return true

  try {
    await conn.sendMessage(m.chat, { delete: m.key })
    await new Promise(r => setTimeout(r, 500))
    await conn.groupParticipantsUpdate(m.chat, [sender], 'remove')
  } catch (e) {
    console.log('[ANTIBOT] Error:', e.message)
  }

  // Marcar como procesado para que el handler general no ejecute otros plugins
  return true
}

handler.help = ['antibot']
handler.tags = ['group']
handler.command = ['antibot', 'antibots']
handler.admin = true
handler.botAdmin = true

export default handler


