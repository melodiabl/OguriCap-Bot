import { areJidsSameUser } from '@whiskeysockets/baileys'

// Global bot hierarchy initializer
function ensureBotHierarchy(parentJid = null) {
  try {
    if (!global.botHierarchy) {
      global.botHierarchy = { parent: null, subbots: [] }
    }
    if (parentJid && typeof parentJid === 'string') {
      global.botHierarchy.parent = parentJid
    }
    const h = global.botHierarchy
    if (!Array.isArray(h.subbots)) {
      h.subbots = []
    }
    return h
  } catch {
    global.botHierarchy = { parent: parentJid || null, subbots: [] }
    return global.botHierarchy
  }
}

let handler = async (m, { conn, args, usedPrefix, command }) => {
  if (!m.isGroup) {
    return conn.reply(m.chat, '⚠️ Este comando solo se puede usar en *grupos*.', m)
  }

  let chat = global.db.data.chats[m.chat]
  if (!chat) return

  if (!args[0]) {
    return conn.reply(
      m.chat,
      `🤖 *Anti-Bots*\n\n` +
      `Uso:\n` +
      `➤ *${usedPrefix + command} on*\n` +
      `➤ *${usedPrefix + command} off*\n\n` +
      `Estado actual: ${chat.antiBot ? '🟢 *Activado*' : '🔴 *Desactivado*'}`,
      m
    )
  }

  if (args[0] === 'on') {
    if (chat.antiBot) {
      return conn.reply(m.chat, '🟢 *Anti-Bots ya está activado.*', m)
    }
    chat.antiBot = true
    return conn.reply(
      m.chat,
      `🛡️ *Anti-Bots activado*\n\n` +
      `• Sub-bots del sistema permitidos\n` +
      `• Bots externos bloqueados\n\n` +
      `_Protección automática habilitada en este grupo._`,
      m
    )
  }

  if (args[0] === 'off') {
    if (!chat.antiBot) {
      return conn.reply(m.chat, '🔴 *Anti-Bots ya estaba desactivado.*', m)
    }
    chat.antiBot = false
    return conn.reply(m.chat, `🔓 *Anti-Bots desactivado*`, m)
  }

  return conn.reply(m.chat, `Uso correcto: *${usedPrefix + command} on* | *off*`, m)
}

handler.before = async function (m, { conn, isAdmin, isOwner, isBotAdmin, participants }) {
  try {
    if (!m.isGroup) return
    if (m.fromMe) return
    if (!m.chat.endsWith('@g.us')) return

    let chat = global.db.data.chats[m.chat]
    if (!chat || !chat.antiBot) return
    if (isAdmin || isOwner) return

    const selfJid0 = conn?.user?.jid || null
    const parentJidForHierarchy = conn?.isSubBot && conn.parentJid ? conn.parentJid : selfJid0
    const hierarchy = ensureBotHierarchy(parentJidForHierarchy)

    let isBotMessage = false
    if (m.isBaileys) isBotMessage = true
    if (typeof m.id === 'string' && (
      m.id.startsWith('BAE5') ||
      m.id.startsWith('B24E') ||
      m.id.startsWith('3EB0') ||
      m.id.startsWith('WA')
    )) isBotMessage = true
    if (!isBotMessage) return

    const normalizeJid = (jid) => {
      if (!jid || typeof jid !== 'string') return jid
      if (!jid.endsWith('@lid')) return jid
      const list = participants || conn?.chats?.[m.chat]?.metadata?.participants
      const found = list?.find(p => p?.lid === jid)
      return found?.jid || jid
    }

    const senderJid = normalizeJid(m.sender)
    const selfJid = conn?.user?.jid || null

    if (selfJid && areJidsSameUser(selfJid, senderJid)) return
    if (conn?.isSubBot && conn.parentJid && areJidsSameUser(conn.parentJid, senderJid)) return

    const isParent = hierarchy.parent && areJidsSameUser(hierarchy.parent, senderJid)
    const isSubbot = hierarchy.subbots?.some(j => areJidsSameUser(j, senderJid))
    if (isParent || isSubbot) return

    if (Array.isArray(global.conns)) {
      for (const sock of global.conns) {
        if (sock?.user?.jid && areJidsSameUser(sock.user.jid, senderJid)) return
      }
    }

    const panelSubbots = global.db?.data?.panel?.subbots
    if (panelSubbots) {
      for (const sb of Object.values(panelSubbots)) {
        const jid = `${String(sb.numero).replace(/\D/g, '')}@s.whatsapp.net`
        if (areJidsSameUser(jid, senderJid)) return
      }
    }

    if (!isBotAdmin) {
      await conn.sendMessage(m.chat, {
        text:
          `🤖 *Bot externo detectado*\n\n` +
          `> Usuario: @${senderJid.split('@')[0]}\n` +
          `> Estado: _No tengo permisos para eliminarlo_`,
        mentions: [senderJid]
      })
      return
    }

    await conn.sendMessage(m.chat, {
      text:
        `🤖 *Bot externo detectado*\n\n` +
        `> Usuario: @${senderJid.split('@')[0]}\n` +
        `> Acción: *Eliminado automáticamente*`,
      mentions: [senderJid]
    })

    await new Promise(r => setTimeout(r, 1500))

    await conn.groupParticipantsUpdate(m.chat, [senderJid], 'remove')

  } catch (err) {
    console.error('[ANTIBOT] Error:', err)
  }
}

handler.help = ['antibots']
handler.tags = ['group']
handler.command = ['antibot', 'antibots']
handler.admin = true

export default handler
