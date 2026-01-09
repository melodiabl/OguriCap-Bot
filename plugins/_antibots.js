import { areJidsSameUser } from '@whiskeysockets/baileys'

let handler = async (m, { conn, args, usedPrefix, command, isBotAdmin, isAdmin, isOwner }) => {
  if (!m.isGroup) return conn.reply(m.chat, '⚠️ Este comando solo se puede usar en grupos.', m)
  
  let chat = global.db.data.chats[m.chat]
  
  if (!args[0]) {
    return conn.reply(m.chat, `*🤖 Active o Desactive el Anti-Bots*\n\nUse:\n${usedPrefix + command} on\n${usedPrefix + command} off\n\nEstado actual: ${chat.antiBot ? '✅ Activado' : '❌ Desactivado'}`, m)
  }
  
  if (args[0] === 'on') {
    if (chat.antiBot) return conn.reply(m.chat, '✅ El Anti-Bots ya estaba activo.', m)
    chat.antiBot = true
    await conn.reply(m.chat, '✅ *Anti-Bots Activado*\n\nEl bot eliminará automáticamente a otros bots que no sean Sub-Bots verificados de este sistema.\n\n⚠️ *Nota:* El Bot necesita ser Admin para eliminar intrusos.', m)
  } else if (args[0] === 'off') {
    if (!chat.antiBot) return conn.reply(m.chat, '❌ El Anti-Bots ya estaba desactivado.', m)
    chat.antiBot = false
    await conn.reply(m.chat, '❌ *Anti-Bots Desactivado*', m)
  } else {
    await conn.reply(m.chat, `⚠️ Opción no válida. Use: ${usedPrefix + command} on/off`, m)
  }
}

handler.before = async function (m, { conn, isAdmin, isOwner, isBotAdmin, participants }) {
  // Validaciones iniciales
  if (!m.isGroup) return
  if (m.fromMe) return
  if (!m.chat || !m.chat.endsWith('@g.us')) return
  if (!global.db?.data?.chats) return
  
  let chat = global.db.data.chats[m.chat]
  if (!chat?.antiBot) return
  
  // Si el que envió es admin del grupo u owner del bot, permitir
  if (isAdmin || isOwner) return
  
  try {
    // ===== DETECCIÓN MEJORADA DE BOTS =====
    let isBotMessage = false
    const isLikelyBotMessageId = (messageId) => {
      if (typeof messageId !== 'string' || !messageId) return false
      // Algunos forks generan longitudes distintas; confiar en el prefijo.
      if (messageId.startsWith('BAE5')) return true
      if (messageId.startsWith('B24E')) return true
      if (/^SUKI[A-F0-9]+$/.test(messageId)) return true
      if (/^MYSTIC[A-F0-9]+$/.test(messageId)) return true
      return [
        'NJX-',
        'META-',
        'Lyru-',
        'EvoGlobalBot-',
        'FizzxyTheGreat-',
        '8SCO',
      ].some(prefix => messageId.startsWith(prefix))
    }
    
    // 1. Verificar por ID del mensaje
    if (isLikelyBotMessageId(m.id)) isBotMessage = true
    
    // 2. Verificar por la propiedad isBaileys
    if (m.isBaileys === true) isBotMessage = true
    
    // 3. MÉTODO CRÍTICO: Verificar si el sender contiene ":lid@" o termina con "@lid"
    // No considerar "@lid" como bot (es un formato de ID).
    
    // 4. Verificar en el key del mensaje
    if (!isBotMessage && isLikelyBotMessageId(m.key?.id)) isBotMessage = true
    
    // 6. Verificar si el mensaje tiene el tipo que usan los bots
    if (m.key?.fromMe === false && m.key?.id?.startsWith('BAE5')) {
      isBotMessage = true
    }
    
    // Si no detectamos que es un bot, salir
    if (!isBotMessage) return
    
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`[ANTIBOT] 🤖 Bot detectado!`)
    console.log(`[ANTIBOT] 👤 Sender: ${m.sender}`)
    console.log(`[ANTIBOT] 🆔 ID: ${m.id}`)
    console.log(`[ANTIBOT] 🔑 Key ID: ${m.key?.id}`)
    console.log(`[ANTIBOT] 📱 isBaileys: ${m.isBaileys}`)
    console.log(`[ANTIBOT] 💬 Texto: ${m.text?.substring(0, 50) || 'N/A'}`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    
    // ===== VERIFICACIÓN DE SUBBOTS AUTORIZADOS =====
    let isSubBot = false

    const normalizeSender = (jid) => {
      if (typeof jid !== 'string' || !jid) return jid
      if (!jid.endsWith('@lid')) return jid
      try {
        const list = Array.isArray(participants) ? participants : conn?.chats?.[m.chat]?.metadata?.participants
        if (Array.isArray(list)) {
          const match = list.find((p) => p?.lid === jid)
          if (match?.jid) return match.jid
        }
      } catch {}
      return jid
    }

    const senderJid = normalizeSender(m.sender)
    const selfJid = conn?.user?.jid || conn?.decodeJid?.(conn?.user?.id)
    if (selfJid && senderJid && areJidsSameUser(selfJid, senderJid)) return
    
    // Verificar contra el bot principal
    if (conn.user?.jid && senderJid) {
      isSubBot = areJidsSameUser(conn.user.jid, senderJid)
      if (isSubBot) {
        console.log(`[ANTIBOT] ✅ Es el bot principal, permitido`)
        return
      }
    }
    
    // Verificar contra SubBots conectados en global.conns
    if (!isSubBot && global.conns && Array.isArray(global.conns)) {
      for (let sock of global.conns) {
        if (!sock?.user?.jid) continue
        
        if (areJidsSameUser(sock.user.jid, senderJid)) {
          isSubBot = true
          console.log(`[ANTIBOT] ✅ Es un SubBot autorizado (${sock.user.name || 'Sin nombre'})`)
          return
        }
      }
    }
    
    // ===== ELIMINACIÓN DE BOT NO AUTORIZADO =====
    // Verificar contra SubBots registrados en el panel (aunque estén offline)
    if (!isSubBot) {
      try {
        const panelSubbots = global?.db?.data?.panel?.subbots
        if (panelSubbots && typeof panelSubbots === 'object') {
          for (const rec of Object.values(panelSubbots)) {
            const numero = rec?.numero || rec?.phoneNumber || rec?.phone_number || null
            if (!numero) continue
            const jid = `${String(numero).replace(/[^0-9]/g, '')}@s.whatsapp.net`
            if (areJidsSameUser(jid, senderJid)) return
          }
        }
      } catch {}
    }

    // Si no podemos resolver @lid a JID real, evitar expulsiones por falsos positivos
    if (!isSubBot && typeof senderJid === 'string' && senderJid.endsWith('@lid')) return

    if (!isSubBot) {
      console.log(`[ANTIBOT] ⚠️ Bot NO autorizado detectado!`)
      console.log(`[ANTIBOT] 🔍 Bot Admin: ${isBotAdmin}`)
      
      if (isBotAdmin) {
        // Notificar detección
        try {
          await conn.sendMessage(m.chat, {
            text: `🤖 *Bot No Autorizado Detectado*\n\n👤 Usuario: @${String(senderJid || m.sender).split('@')[0]}\n⚠️ Los bots externos no están permitidos en este grupo.\n\n🗑️ Eliminando en 3 segundos...`,
            mentions: [senderJid || m.sender]
          })
        } catch (e) {
          console.log('[ANTIBOT] Error al enviar notificación:', e.message)
        }
        
        // Delay para que se vea la notificación
        await new Promise(resolve => setTimeout(resolve, 3000))
        
        // Intentar eliminar el mensaje del bot
        try {
          await conn.sendMessage(m.chat, { delete: m.key })
          console.log(`[ANTIBOT] ✅ Mensaje eliminado`)
        } catch (e) {
          console.log('[ANTIBOT] ⚠️ No se pudo eliminar el mensaje:', e.message)
        }
        
        // Pequeño delay adicional
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Intentar eliminar al bot del grupo
        try {
          const result = await conn.groupParticipantsUpdate(m.chat, [senderJid || m.sender], 'remove')
          console.log(`[ANTIBOT] ✅ Bot eliminado del grupo`)
          console.log(`[ANTIBOT] Resultado:`, result)
          
          // Confirmar eliminación
          await conn.sendMessage(m.chat, {
            text: `✅ *Bot Eliminado Exitosamente*\n\n👤 Usuario removido: @${String(senderJid || m.sender).split('@')[0]}\n🛡️ El grupo está protegido contra bots no autorizados.`,
            mentions: [senderJid || m.sender]
          })
        } catch (e) {
          console.log('[ANTIBOT] ❌ Error al eliminar bot del grupo:', e.message)
          console.log('[ANTIBOT] Error completo:', e)
          
          await conn.sendMessage(m.chat, {
            text: `⚠️ *Error al Eliminar Bot*\n\n👤 @${String(senderJid || m.sender).split('@')[0]}\n❌ Error: ${e.message}\n\n💡 Verifica que el bot tenga permisos de administrador correctos.`,
            mentions: [senderJid || m.sender]
          })
        }
      } else {
        console.log(`[ANTIBOT] ❌ No tengo permisos de admin para eliminar`)
        
        try {
          await conn.sendMessage(m.chat, {
            text: `⚠️ *Bot No Autorizado Detectado*\n\n👤 @${String(senderJid || m.sender).split('@')[0]}\n\n❌ No puedo eliminarlo porque necesito ser administrador del grupo.\n\n💡 Hazme administrador para que pueda proteger el grupo.`,
            mentions: [senderJid || m.sender]
          })
        } catch (e) {
          console.log('[ANTIBOT] Error al enviar mensaje de falta de permisos:', e.message)
        }
      }
    }
  } catch (error) {
    console.error('[ANTIBOT] ❌ Error crítico en handler.before:', error)
    console.error('[ANTIBOT] Stack:', error.stack)
  }
}

handler.help = ['antibot']
handler.tags = ['group']
handler.command = ['antibot', 'antibots']
handler.admin = true

export default handler
