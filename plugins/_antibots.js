import { areJidsSameUser } from '@whiskeysockets/baileys'

let handler = async (m, { conn, args, usedPrefix, command, isBotAdmin, isAdmin, isOwner }) => {
  if (!m.isGroup) return conn.reply(m.chat, '⚠️ Este comando solo se puede usar en grupos.', m)
  
  let chat = global.db.data.chats[m.chat]
  
  if (!args[0]) {
    return conn.reply(m.chat, `*🤖 Active o Desactive el Anti-Bots*\n\nUse:\n${usedPrefix + command} on\n${usedPrefix + command} off`, m)
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

// Este handler.all se ejecuta ANTES que el handler.js principal
handler.all = async function (m, { conn }) {
  // Validaciones iniciales
  if (!m.isGroup) return
  if (m.fromMe) return
  if (!m.chat || !m.chat.endsWith('@g.us')) return
  if (!global.db?.data?.chats) return
  
  let chat = global.db.data.chats[m.chat]
  if (!chat?.antiBot) return
  
  try {
    // ===== DETECCIÓN MEJORADA DE BOTS =====
    let isBotMessage = false
    
    // 1. Verificar por ID del mensaje (método más confiable)
    if (m.id) {
      const botPrefixes = ['BAE5', '3EB0', 'B24E', 'WA', 'BAES', '3BE0', 'EA']
      isBotMessage = botPrefixes.some(prefix => m.id.startsWith(prefix))
    }
    
    // 2. Verificar por la propiedad isBaileys
    if (m.isBaileys === true) isBotMessage = true
    
    // 3. MÉTODO CRÍTICO: Verificar si el sender termina con "@lid" o contiene ":lid@"
    if (m.sender) {
      if (m.sender.includes(':lid@') || m.sender.endsWith('@lid')) {
        isBotMessage = true
      }
    }
    
    // 4. Verificar en el key del mensaje
    if (m.key?.id) {
      const botPrefixes = ['BAE5', '3EB0', 'B24E', 'WA', 'BAES']
      if (botPrefixes.some(prefix => m.key.id.startsWith(prefix))) {
        isBotMessage = true
      }
    }
    
    // 5. Verificar si el remoteJid del key contiene indicadores de bot
    if (m.key?.remoteJid && m.key.remoteJid.includes(':lid@')) {
      isBotMessage = true
    }
    
    // Si no detectamos que es un bot, salir
    if (!isBotMessage) return
    
    console.log(`[ANTIBOT] Bot detectado: ${m.sender}`)
    console.log(`[ANTIBOT] ID del mensaje: ${m.id}`)
    console.log(`[ANTIBOT] isBaileys: ${m.isBaileys}`)
    
    // ===== VERIFICACIÓN DE ADMINS Y OWNERS =====
    // Obtener metadata del grupo solo si es necesario
    let isAdmin = false
    let isOwner = false
    let isBotAdmin = false
    
    try {
      const groupMetadata = await conn.groupMetadata(m.chat).catch(() => null)
      if (groupMetadata?.participants) {
        const userInGroup = groupMetadata.participants.find(p => p.id === m.sender || p.jid === m.sender)
        const botInGroup = groupMetadata.participants.find(p => p.id === conn.user.jid || p.jid === conn.user.jid)
        
        isAdmin = userInGroup?.admin === 'admin' || userInGroup?.admin === 'superadmin'
        isBotAdmin = botInGroup?.admin === 'admin' || botInGroup?.admin === 'superadmin'
      }
    } catch (e) {
      console.log('[ANTIBOT] Error al obtener metadata del grupo:', e.message)
    }
    
    // Verificar si es owner del bot
    const owners = [...global.owner.map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net')]
    isOwner = owners.includes(m.sender) || m.sender === conn.user.jid
    
    // Si el que envió el mensaje es Admin del grupo u Owner del bot, NO hacer nada
    if (isAdmin || isOwner) {
      console.log(`[ANTIBOT] Es admin/owner, permitido`)
      return
    }
    
    // ===== VERIFICACIÓN DE SUBBOTS AUTORIZADOS =====
    let isSubBot = false
    
    // Verificar contra el bot principal
    if (conn.user?.jid && m.sender) {
      isSubBot = areJidsSameUser(conn.user.jid, m.sender)
      if (isSubBot) {
        console.log(`[ANTIBOT] Es el bot principal, permitido`)
        return
      }
    }
    
    // Verificar contra SubBots conectados
    if (!isSubBot && global.conns && Array.isArray(global.conns)) {
      for (let sock of global.conns) {
        if (!sock?.user?.jid) continue
        
        if (areJidsSameUser(sock.user.jid, m.sender)) {
          isSubBot = true
          console.log(`[ANTIBOT] Es un SubBot autorizado, permitido`)
          break
        }
      }
    }
    
    // ===== ELIMINACIÓN DE BOT NO AUTORIZADO =====
    if (!isSubBot) {
      console.log(`[ANTIBOT] Bot NO autorizado, procediendo a eliminar`)
      
      if (isBotAdmin) {
        // Primero notificar
        await conn.reply(m.chat, `🤖 *Bot No Autorizado Detectado*\n\n👤 Usuario: @${m.sender.split('@')[0]}\n⚠️ Los bots externos no están permitidos.\n🗑️ Procediendo a eliminar...`, null, {
          mentions: [m.sender]
        })
        
        // Delay para asegurar que Baileys procese correctamente
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Eliminar el mensaje
        try {
          await conn.sendMessage(m.chat, { delete: m.key })
          console.log(`[ANTIBOT] Mensaje eliminado`)
        } catch (e) {
          console.log('[ANTIBOT] Error al eliminar mensaje:', e.message)
        }
        
        // Pequeño delay adicional
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Eliminar al bot del grupo
        try {
          await conn.groupParticipantsUpdate(m.chat, [m.sender], 'remove')
          console.log(`[ANTIBOT] Bot eliminado del grupo exitosamente`)
          
          await conn.reply(m.chat, `✅ *Bot Eliminado*\n\n👤 @${m.sender.split('@')[0]} fue removido del grupo.`, null, {
            mentions: [m.sender]
          })
        } catch (e) {
          console.log('[ANTIBOT] Error al eliminar bot del grupo:', e.message)
          await conn.reply(m.chat, `⚠️ No pude eliminar al bot. Error: ${e.message}`, m)
        }
      } else {
        console.log(`[ANTIBOT] Bot detectado pero no tengo permisos de admin`)
        await conn.reply(m.chat, `⚠️ *Bot No Autorizado Detectado*\n\n👤 @${m.sender.split('@')[0]}\n\n❌ Necesito permisos de administrador para eliminarlo.`, null, {
          mentions: [m.sender]
        })
      }
    }
  } catch (error) {
    console.error('[ANTIBOT] Error en handler.all:', error)
  }
}

handler.help = ['antibot']
handler.tags = ['group']
handler.command = ['antibot', 'antibots']
handler.admin = true
handler.botAdmin = true

export default handler
