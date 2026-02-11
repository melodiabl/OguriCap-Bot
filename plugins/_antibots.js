import { areJidsSameUser } from '@whiskeysockets/baileys'

// Global bot hierarchy initializer
function ensureBotHierarchy(parentJid = null) {
  try {
    if (!global.botHierarchy) {
      global.botHierarchy = { parent: null, subbots: [] }
      console.log('[ANTIBOT] Inicializando jerarquía de bots')
    }
    if (parentJid && typeof parentJid === 'string') {
      // No sobreescribir con valores raros: sólo setear una vez o cuando sea el mismo bot
      if (!global.botHierarchy.parent || areJidsSameUser(global.botHierarchy.parent, parentJid)) {
        global.botHierarchy.parent = parentJid
        console.log('[ANTIBOT] Bot padre registrado:', parentJid)
      }
    }
    const h = global.botHierarchy
    if (!Array.isArray(h.subbots)) {
      h.subbots = []
    }
    
    // Sincronizar subbots desde global.conns si existen
    if (Array.isArray(global.conns)) {
      for (const sock of global.conns) {
        const sJid = sock?.user?.jid || sock?.user?.id
        if (sJid && !h.subbots.some(j => areJidsSameUser(j, sJid))) {
          h.subbots.push(sJid)
          console.log('[ANTIBOT] Subbot registrado en jerarquía:', sJid)
        }
      }
    }
    
    // Sincronizar desde panel DB
    const panelSubbots = global.db?.data?.panel?.subbots
    if (panelSubbots && typeof panelSubbots === 'object') {
      for (const sb of Object.values(panelSubbots)) {
        if (!sb) continue
        const rawNumber = sb.numero || sb.jid || sb.id || sb.code
        if (!rawNumber) continue
        const num = String(rawNumber).replace(/\D/g, '')
        if (!num) continue
        const panelJid = `${num}@s.whatsapp.net`
        if (!h.subbots.some(j => areJidsSameUser(j, panelJid))) {
          h.subbots.push(panelJid)
          console.log('[ANTIBOT] Subbot desde panel DB registrado:', panelJid)
        }
      }
    }
    
    return h
  } catch (err) {
    console.error('[ANTIBOT] Error en ensureBotHierarchy:', err)
    global.botHierarchy = { parent: parentJid || null, subbots: [] }
    return global.botHierarchy
  }
}

// Determina si un JID pertenece a este sistema de bots (bot principal o cualquier subbot)
function isSystemBotJid(jid, conn) {
  if (!jid) return false
  try {
    const selfJid = conn?.user?.jid || conn?.user?.id || null
    const selfLid = conn?.user?.lid || null

    // 1) El propio socket actual
    if (selfJid && areJidsSameUser(selfJid, jid)) {
      console.log('[ANTIBOT-DEBUG] Detectado como socket actual:', jid)
      return true
    }
    if (selfLid && jid.endsWith('@lid') && selfLid === jid) {
      console.log('[ANTIBOT-DEBUG] Detectado como LID actual:', jid)
      return true
    }

    // 2) Jerarquía global (bot padre + todos los subbots registrados)
    const h = global.botHierarchy
    if (h?.parent && areJidsSameUser(h.parent, jid)) {
      console.log('[ANTIBOT-DEBUG] Detectado como bot padre en jerarquía:', jid)
      return true
    }
    if (Array.isArray(h?.subbots) && h.subbots.some(j => j && areJidsSameUser(j, jid))) {
      console.log('[ANTIBOT-DEBUG] Detectado como subbot en jerarquía:', jid)
      return true
    }

    // 3) Cualquier socket en global.conns (subbots creados por el sistema)
    if (Array.isArray(global.conns)) {
      for (const sock of global.conns) {
        const sJid = sock?.user?.jid || sock?.user?.id
        const sLid = sock?.user?.lid
        
        if (sJid && areJidsSameUser(sJid, jid)) {
          console.log('[ANTIBOT-DEBUG] Detectado en global.conns:', jid)
          return true
        }
        if (sLid && jid.endsWith('@lid') && sLid === jid) {
          console.log('[ANTIBOT-DEBUG] Detectado LID en global.conns:', jid)
          return true
        }
        
        const parentJid = sock?.parentJid
        if (parentJid && areJidsSameUser(parentJid, jid)) {
          console.log('[ANTIBOT-DEBUG] Detectado como parentJid en global.conns:', jid)
          return true
        }
      }
    }

    // 4) Subbots registrados en la base de datos del panel
    const panelSubbots = global.db?.data?.panel?.subbots
    if (panelSubbots && typeof panelSubbots === 'object') {
      for (const sb of Object.values(panelSubbots)) {
        if (!sb) continue
        const rawNumber = sb.numero || sb.jid || sb.id || sb.code
        if (!rawNumber) continue
        const num = String(rawNumber).replace(/\D/g, '')
        if (!num) continue
        const panelJid = `${num}@s.whatsapp.net`
        if (areJidsSameUser(panelJid, jid)) {
          console.log('[ANTIBOT-DEBUG] Detectado en panel subbots DB:', jid)
          return true
        }
      }
    }

    // 5) Bot principal desde global.conn
    const mainBotJid = global.conn?.user?.jid || global.conn?.user?.id
    if (mainBotJid && areJidsSameUser(mainBotJid, jid)) {
      console.log('[ANTIBOT-DEBUG] Detectado como bot principal (global.conn):', jid)
      return true
    }

    console.log('[ANTIBOT-DEBUG] NO detectado como sistema:', jid)
    return false
  } catch (err) {
    console.error('[ANTIBOT-DEBUG] Error en isSystemBotJid:', err)
    return false
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

// ✅ Nunca actuar contra el bot principal ni contra ningún subbot del sistema
if (isSystemBotJid(senderJid, conn)) return

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
