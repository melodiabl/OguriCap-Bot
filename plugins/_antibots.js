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
    let detectionMethod = ''
    
    const isLikelyBotMessageId = (messageId) => {
      if (typeof messageId !== 'string' || !messageId) return false
      
      // Prefijos conocidos de bots basados en Baileys
      const botPrefixes = [
        'BAE5',      // Baileys estándar
        'B24E',      // Variante de Baileys
        'SUKI',      // Bot Suki
        'MYSTIC',    // Bot Mystic
        'NJX-',      // Bot NJX
        'META-',     // Meta bots
        'Lyru-',     // Bot Lyru
        'EvoGlobalBot-',
        'FizzxyTheGreat-',
        '8SCO',
        'QUEEN',     // Queen bots
        'GOKU',      // Goku bot
        'GURU',      // Guru bot
      ]
      
      // Verificar si empieza con algún prefijo conocido
      if (botPrefixes.some(prefix => messageId.startsWith(prefix))) return true
      
      // Patrón de IDs de bots (NOMBRE + caracteres hexadecimales)
      if (/^[A-Z]{3,}[A-F0-9]{10,}$/.test(messageId)) return true
      
      return false
    }
    
    // 1. Verificar por ID del mensaje
    if (isLikelyBotMessageId(m.id)) {
      isBotMessage = true
      detectionMethod = 'Message ID'
    }
    
    // 2. Verificar por la propiedad isBaileys
    if (!isBotMessage && m.isBaileys === true) {
      isBotMessage = true
      detectionMethod = 'isBaileys property'
    }
    
    // 3. Verificar en el key del mensaje
    if (!isBotMessage && m.key?.id && isLikelyBotMessageId(m.key.id)) {
      isBotMessage = true
      detectionMethod = 'Message key.id'
    }
    
    // 4. Verificar si fromMe es false pero el ID sugiere bot
    if (!isBotMessage && m.key?.fromMe === false && m.key?.id?.startsWith('BAE5')) {
      isBotMessage = true
      detectionMethod = 'fromMe false + BAE5 ID'
    }
    
    // 5. Verificar deviceListMetadata (nuevo método Baileys)
    if (!isBotMessage && m.message?.messageContextInfo?.deviceListMetadata) {
      isBotMessage = true
      detectionMethod = 'deviceListMetadata'
    }
    
    // 6. Verificar si el mensaje tiene protocolMessage (usado por algunos bots)
    if (!isBotMessage && m.message?.protocolMessage) {
      isBotMessage = true
      detectionMethod = 'protocolMessage'
    }
    
    // 7. Verificar push name vacío o genérico (común en bots)
    if (!isBotMessage && m.pushName) {
      const genericBotNames = ['bot', 'whatsapp', 'api', 'baileys', 'autoresponder']
      const pushNameLower = m.pushName.toLowerCase()
      if (genericBotNames.some(name => pushNameLower.includes(name))) {
        isBotMessage = true
        detectionMethod = 'Generic bot pushName'
      }
    }
    
    // 8. Verificar si tiene viewOnce con interactive message (técnica de algunos bots)
    if (!isBotMessage && m.message?.viewOnceMessage?.message?.interactiveMessage) {
      isBotMessage = true
      detectionMethod = 'viewOnce interactive'
    }
    
    // Si no detectamos que es un bot, salir
    if (!isBotMessage) return
    
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`[ANTIBOT] 🤖 Bot detectado!`)
    console.log(`[ANTIBOT] 📍 Método: ${detectionMethod}`)
    console.log(`[ANTIBOT] 👤 Sender: ${m.sender}`)
    console.log(`[ANTIBOT] 🆔 ID: ${m.id}`)
    console.log(`[ANTIBOT] 🔑 Key ID: ${m.key?.id}`)
    console.log(`[ANTIBOT] 📱 isBaileys: ${m.isBaileys}`)
    console.log(`[ANTIBOT] 👨 pushName: ${m.pushName || 'N/A'}`)
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

    // ===== ELIMINACIÓN DE BOT NO AUTORIZADO =====
    if (!isSubBot) {
      console.log(`[ANTIBOT] ⚠️ Bot NO autorizado detectado!`)
      console.log(`[ANTIBOT] 🔍 Bot Admin: ${isBotAdmin}`)
      
      if (isBotAdmin) {
        // Notificar detección
        try {
          await conn.sendMessage(m.chat, {
            text: `🤖 *Bot No Autorizado Detectado*\n\n👤 Usuario: @${String(senderJid || m.sender).split('@')[0]}\n🔍 Método de detección: ${detectionMethod}\n⚠️ Los bots externos no están permitidos en este grupo.\n\n🗑️ Eliminando en 3 segundos...`,
            mentions: [senderJid || m.sender]
          })
        } catch (e) {
          console.log('[ANTIBOT] Error al enviar notificación:', e.message)
        }
        
        // Delay para que se vea la notificación
        await new Promise(resolve => setTimeout(resolve, 3000))
        
        // Intentar eliminar el mensaje del bot
        try {
          const deleteKey = m.key || {}
          const participant = deleteKey.participant || (m.isGroup ? (m.participant || m.sender) : undefined) || m.sender
          await conn.sendMessage(m.chat, {
            delete: {
              remoteJid: m.chat,
              fromMe: false,
              id: deleteKey.id,
              participant,
            }
          })
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
            text: `✅ *Bot Eliminado Exitosamente*\n\n👤 Usuario removido: @${String(senderJid || m.sender).split('@')[0]}\n🔍 Detectado por: ${detectionMethod}\n🛡️ El grupo está protegido contra bots no autorizados.`,
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
            text: `⚠️ *Bot No Autorizado Detectado*\n\n👤 @${String(senderJid || m.sender).split('@')[0]}\n🔍 Detectado por: ${detectionMethod}\n\n❌ No puedo eliminarlo porque necesito ser administrador del grupo.\n\n💡 Hazme administrador para que pueda proteger el grupo.`,
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
