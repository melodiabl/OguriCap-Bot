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

function ensureAntiBotGlobalAllow(conn) {
  try {
    if (!global.db?.data?.settings) return { jids: [], prefixes: [] }
    const botJid = conn?.user?.jid || conn?.user?.id
    if (!botJid) return { jids: [], prefixes: [] }
    global.db.data.settings[botJid] ||= {}
    const s = global.db.data.settings[botJid]
    if (!Array.isArray(s.antiBotGlobalAllowJids)) s.antiBotGlobalAllowJids = []
    if (!Array.isArray(s.antiBotGlobalAllowPrefixes)) s.antiBotGlobalAllowPrefixes = []
    return { jids: s.antiBotGlobalAllowJids, prefixes: s.antiBotGlobalAllowPrefixes }
  } catch {
    return { jids: [], prefixes: [] }
  }
}

function isGloballyAllowedBot({ senderJid, messageId, conn }) {
  try {
    const allow = ensureAntiBotGlobalAllow(conn)
    if (senderJid && allow.jids.some(j => j && areJidsSameUser(j, senderJid))) return true
    if (messageId) {
      const id = String(messageId)
      if (allow.prefixes.some(p => typeof p === 'string' && p && id.startsWith(p))) return true
    }
    return false
  } catch {
    return false
  }
}

function extractSignature(messageId) {
  const id = String(messageId || '').trim()
  if (!id) return ''
  if (/^MYSTIC[A-F0-9]+$/i.test(id)) return 'MYSTIC'
  if (/^SUKI[A-F0-9]+$/i.test(id)) return 'SUKI'
  if (id.startsWith('BAE5')) return 'BAE5'
  if (id.startsWith('B24E')) return 'B24E'
  if (id.includes('-')) {
    const p = id.split('-')[0]
    if (p && p.length <= 18) return `${p}-`
  }
  const m = id.match(/^[A-Z]{3,18}/i)
  return m && m[0] ? m[0].toUpperCase() : ''
}

function recordDetectedBot(conn, { senderJid, messageId, chatId }) {
  try {
    const botJid = conn?.user?.jid || conn?.user?.id
    if (!botJid) return
    const s = global.db?.data?.settings?.[botJid]
    if (!s) return
    if (typeof s.antiBotDetected !== 'object' || s.antiBotDetected == null) s.antiBotDetected = {}

    const base = String(senderJid || '').split('@')[0]
    if (!base) return
    const key = `${base}@s.whatsapp.net`
    const now = Date.now()
    const sig = extractSignature(messageId)

    const rec = s.antiBotDetected[key] || {
      jid: key,
      count: 0,
      signatures: [],
      samples: [],
      lastSeenAt: 0,
      lastGroup: null,
    }

    rec.count = (Number(rec.count) || 0) + 1
    rec.lastSeenAt = now
    rec.lastGroup = chatId || rec.lastGroup
    if (sig && !rec.signatures.includes(sig)) rec.signatures = [...rec.signatures, sig].slice(0, 8)
    if (messageId) {
      const id = String(messageId)
      if (!rec.samples.includes(id)) rec.samples = [...rec.samples, id].slice(-5)
    }

    s.antiBotDetected[key] = rec

    // Limpiar si crece demasiado (max 200)
    const entries = Object.entries(s.antiBotDetected)
    if (entries.length > 200) {
      entries
        .sort((a, b) => (Number(a[1]?.lastSeenAt || 0) - Number(b[1]?.lastSeenAt || 0)))
        .slice(0, entries.length - 200)
        .forEach(([k]) => { delete s.antiBotDetected[k] })
    }

    if (global.db?.write) void global.db.write().catch(() => {})
  } catch { }
}


let handler = async (m, { conn, args, usedPrefix, command }) => {
  if (!m.isGroup) {
    return conn.reply(m.chat, '⚠️ Este comando solo se puede usar en *grupos*.', m)
  }

  let chat = global.db.data.chats[m.chat]
  if (!chat) return

  chat.antiBotAllowlist ||= []

  const pickJidFromArgs = async () => {
    const mentioned = await m.mentionedJid
    const jid = Array.isArray(mentioned) && mentioned[0] ? mentioned[0] : null
    if (jid) return jid
    const raw = String(args[1] || args[0] || '').trim()
    const num = raw.replace(/[^0-9]/g, '')
    if (!num) return null
    return `${num}@s.whatsapp.net`
  }

  if (!args[0]) {
    return conn.reply(
      m.chat,
      `🤖 *Anti-Bots*\n\n` +
      `Uso:\n` +
      `➤ *${usedPrefix + command} on*\n` +
      `➤ *${usedPrefix + command} off*\n\n` +
      `Permitir bots (whitelist):\n` +
      `➤ *${usedPrefix + command} allow @usuario*\n` +
      `➤ *${usedPrefix + command} del @usuario*\n` +
      `➤ *${usedPrefix + command} list*\n\n` +
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

  if (['allow', 'permitir', 'add', 'agregar'].includes(String(args[0]).toLowerCase())) {
    const jid = await pickJidFromArgs()
    if (!jid) return conn.reply(m.chat, `Uso: *${usedPrefix + command} allow @usuario*`, m)
    if (chat.antiBotAllowlist.some(j => areJidsSameUser(j, jid))) {
      return conn.reply(m.chat, `✅ Ya está permitido: @${jid.split('@')[0]}`, m, { mentions: [jid] })
    }
    chat.antiBotAllowlist.push(jid)
    if (global.db?.write) await global.db.write().catch(() => {})
    return conn.sendMessage(m.chat, { text: `✅ Bot permitido: @${jid.split('@')[0]}`, mentions: [jid] }, { quoted: m })
  }

  if (['del', 'delete', 'remove', 'quitar', 'rm'].includes(String(args[0]).toLowerCase())) {
    const jid = await pickJidFromArgs()
    if (!jid) return conn.reply(m.chat, `Uso: *${usedPrefix + command} del @usuario*`, m)
    const before = chat.antiBotAllowlist.length
    chat.antiBotAllowlist = chat.antiBotAllowlist.filter(j => !areJidsSameUser(j, jid))
    const removed = before - chat.antiBotAllowlist.length
    if (removed > 0 && global.db?.write) await global.db.write().catch(() => {})
    return conn.sendMessage(m.chat, { text: removed > 0 ? `🗑️ Quitado de permitidos: @${jid.split('@')[0]}` : `⚠️ No estaba en permitidos: @${jid.split('@')[0]}`, mentions: [jid] }, { quoted: m })
  }

  if (['list', 'lista'].includes(String(args[0]).toLowerCase())) {
    const list = Array.isArray(chat.antiBotAllowlist) ? chat.antiBotAllowlist : []
    if (!list.length) return conn.reply(m.chat, '📃 Lista vacía. No hay bots permitidos.', m)
    const text = list
      .slice(0, 50)
      .map((j, i) => `${i + 1}. @${String(j).split('@')[0]}`)
      .join('\n')
    return conn.sendMessage(m.chat, { text: `📃 *Bots permitidos*\n\n${text}`, mentions: list }, { quoted: m })
  }

  return conn.reply(m.chat, `Uso correcto: *${usedPrefix + command} on* | *off*`, m)
}

handler.before = async function (m, { conn, isAdmin, isOwner, isBotAdmin, participants }) {
  try {
    if (!m.isGroup) return
    if (m.fromMe) return
    if (!m.chat.endsWith('@g.us')) return

    let chat = global.db.data.chats[m.chat]
    if (!chat) return
    if (isAdmin || isOwner) return

    const selfJid0 = conn?.user?.jid || null
    const parentJidForHierarchy = conn?.isSubBot && conn.parentJid ? conn.parentJid : selfJid0
    const hierarchy = ensureBotHierarchy(parentJidForHierarchy)

    const messageId = String(m?.id || '')
    const hasCustomPrefix = [
      'NJX-',
      'Lyru-',
      'META-',
      'EvoGlobalBot-',
      'FizzxyTheGreat-',
      '8SCO',
    ].some((p) => messageId.startsWith(p))
    const isSukiPattern = /^SUKI[A-F0-9]+$/.test(messageId)
    const isMysticPattern = /^MYSTIC[A-F0-9]+$/.test(messageId)

    const isBotMessage =
      Boolean(m.isBaileys) ||
      messageId.startsWith('BAE5') ||
      messageId.startsWith('B24E') ||
      hasCustomPrefix ||
      isSukiPattern ||
      isMysticPattern

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

  // Guardar deteccion SIEMPRE que sea bot-like (aunque antiBot este apagado)
  try { recordDetectedBot(conn, { senderJid, messageId, chatId: m.chat }) } catch { }



  // ✅ Permitir bots confiables globalmente (por JID o por prefijo de messageId)
  if (isGloballyAllowedBot({ senderJid, messageId, conn })) return

  // Si antiBot no esta activo, solo registramos y salimos.
  if (!chat.antiBot) return

  // ✅ Permitir bots agregados por admins (whitelist)
  try {
   chat.antiBotAllowlist ||= []
   if (Array.isArray(chat.antiBotAllowlist) && chat.antiBotAllowlist.some(j => j && areJidsSameUser(j, senderJid))) return
 } catch { }

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
