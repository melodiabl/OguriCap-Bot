import { areJidsSameUser } from '@whiskeysockets/baileys'

let handler = async (m, { conn, args, usedPrefix, command, isAdmin, isOwner }) => {
  if (!m.isGroup) {
    return conn.reply(m.chat, '⚠️ Este comando solo se puede usar en grupos.', m)
  }

  let chat = global.db.data.chats[m.chat]
  if (!chat) return

  if (!args[0]) {
    return conn.reply(
      m.chat,
      `🤖 *Anti-Bots*\n\n` +
      `Uso:\n` +
      `${usedPrefix + command} on\n` +
      `${usedPrefix + command} off\n\n` +
      `Estado actual: ${chat.antiBot ? '✅ Activado' : '❌ Desactivado'}`,
      m
    )
  }

  if (args[0] === 'on') {
    if (chat.antiBot) return conn.reply(m.chat, '✅ El Anti-Bots ya estaba activado.', m)
    chat.antiBot = true
    return conn.reply(
      m.chat,
      '🛡️ *Anti-Bots activado*\n\n' +
      '• Se permitirán sub-bots del sistema\n' +
      '• Se bloquearán bots externos\n\n' +
      '⚠️ El bot debe ser admin.',
      m
    )
  }

  if (args[0] === 'off') {
    if (!chat.antiBot) return conn.reply(m.chat, '❌ El Anti-Bots ya estaba desactivado.', m)
    chat.antiBot = false
    return conn.reply(m.chat, '❌ *Anti-Bots desactivado*', m)
  }

  return conn.reply(m.chat, `Uso correcto: ${usedPrefix + command} on | off`, m)
}

handler.before = async function (m, { conn, isAdmin, isOwner, isBotAdmin, participants }) {
  try {
    // ───────── VALIDACIONES BÁSICAS ─────────
    if (!m.isGroup) return
    if (m.fromMe) return
    if (!m.chat.endsWith('@g.us')) return

    let chat = global.db.data.chats[m.chat]
    if (!chat?.antiBot) return

    // Admin / owner no se tocan
    if (isAdmin || isOwner) return

    // ───────── DETECCIÓN DE MENSAJE BOT ─────────
    let isBotMessage = false

    if (m.isBaileys) isBotMessage = true
    if (typeof m.id === 'string' && (
      m.id.startsWith('BAE5') ||
      m.id.startsWith('B24E') ||
      m.id.startsWith('3EB0') ||
      m.id.startsWith('WA')
    )) {
      isBotMessage = true
    }

    if (!isBotMessage) return

    // ───────── NORMALIZAR JID (LID → JID) ─────────
    const normalizeJid = (jid) => {
      if (!jid || typeof jid !== 'string') return jid
      if (!jid.endsWith('@lid')) return jid
      try {
        const list = participants || conn?.chats?.[m.chat]?.metadata?.participants
        const found = list?.find(p => p?.lid === jid)
        return found?.jid || jid
      } catch {
        return jid
      }
    }

    const senderJid = normalizeJid(m.sender)
    const selfJid = conn?.user?.jid

    // ───────── PERMITIR BOT PADRE ─────────
    if (selfJid && areJidsSameUser(selfJid, senderJid)) return

    // ───────── PERMITIR SUBBOTS CONECTADOS ─────────
    if (Array.isArray(global.conns)) {
      for (const sock of global.conns) {
        if (!sock?.user?.jid) continue

        // subbot directo
        if (areJidsSameUser(sock.user.jid, senderJid)) return

        // relación padre → hijo
        if (sock.isSubBot && sock.parentJid) {
          if (areJidsSameUser(sock.parentJid, senderJid)) return
        }
      }
    }

    // ───────── PERMITIR SUBBOTS REGISTRADOS EN PANEL ─────────
    try {
      const panelSubbots = global.db?.data?.panel?.subbots
      if (panelSubbots && typeof panelSubbots === 'object') {
        for (const sb of Object.values(panelSubbots)) {
          if (!sb?.numero) continue
          const jid = `${String(sb.numero).replace(/\D/g, '')}@s.whatsapp.net`
          if (areJidsSameUser(jid, senderJid)) return
        }
      }
    } catch { }

    // ───────── SI LLEGA ACÁ = BOT EXTERNO ─────────
    if (!isBotAdmin) {
      await conn.sendMessage(m.chat, {
        text:
          `⚠️ *Bot externo detectado*\n\n` +
          `👤 @${senderJid.split('@')[0]}\n\n` +
          `❌ No puedo eliminarlo porque no soy administrador.`,
        mentions: [senderJid]
      })
      return
    }

    // Aviso
    await conn.sendMessage(m.chat, {
      text:
        `🤖 *Bot NO autorizado detectado*\n\n` +
        `👤 @${senderJid.split('@')[0]}\n` +
        `🛡️ Eliminando...`,
      mentions: [senderJid]
    })

    // Pequeño delay
    await new Promise(r => setTimeout(r, 2000))

    // Borrar mensaje
    try {
      await conn.sendMessage(m.chat, {
        delete: {
          remoteJid: m.chat,
          fromMe: false,
          id: m.key.id,
          participant: senderJid
        }
      })
    } catch { }

    // Sacar del grupo
    await conn.groupParticipantsUpdate(m.chat, [senderJid], 'remove')

  } catch (err) {
    console.error('[ANTIBOT] Error:', err)
  }
}

handler.help = ['antibot']
handler.tags = ['group']
handler.command = ['antibot', 'antibots']
handler.admin = true

export default handler



