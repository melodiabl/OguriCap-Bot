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

handler.before = async function (m, { conn, isBotAdmin, isOwner, isAdmin }) {
  // Validaciones iniciales para no gastar recursos
  if (!m.isGroup) return
  if (m.fromMe) return
  if (!m.chat || !m.chat.endsWith('@g.us')) return
  
  // Verificar que exista la estructura de datos
  if (!global.db?.data?.chats) return
  
  let chat = global.db.data.chats[m.chat]
  if (!chat?.antiBot) return
  
  // Si el que envió el mensaje es Admin o Owner, NO hacer nada
  if (isAdmin || isOwner) return
  
  try {
    // Detección de mensajes de Bots
    // BAE5, 3EB0, B24E, WA son prefijos comunes de IDs de bots en Baileys
    let isBotMessage = false
    
    if (m.id) {
      isBotMessage = m.id.startsWith('BAE5') || 
                     m.id.startsWith('3EB0') || 
                     m.id.startsWith('B24E') || 
                     m.id.startsWith('WA')
    }
    
    // También verificar si tiene la propiedad isBaileys
    if (m.isBaileys) isBotMessage = true
    
    if (!isBotMessage) return
    
    // Verificar si es un SubBot oficial conectado a este sistema
    let isSubBot = false
    
    // Verificar contra el bot principal
    if (conn.user?.jid && m.sender) {
      isSubBot = areJidsSameUser(conn.user.jid, m.sender)
    }
    
    // Verificar contra SubBots conectados
    if (!isSubBot && global.conns && Array.isArray(global.conns)) {
      isSubBot = global.conns.some(sock => {
        if (!sock?.user?.jid) return false
        return areJidsSameUser(sock.user.jid, m.sender)
      })
    }
    
    // Si es un bot no autorizado, proceder con la eliminación
    if (!isSubBot) {
      if (isBotAdmin) {
        // Delay para asegurar que Baileys procese correctamente
        await new Promise(resolve => setTimeout(resolve, 1500))
        
        // Intentar eliminar el mensaje
        try {
          await conn.sendMessage(m.chat, { delete: m.key })
        } catch (e) {
          console.log('Error al eliminar mensaje del bot:', e)
        }
        
        // Intentar eliminar al bot del grupo
        try {
          await conn.groupParticipantsUpdate(m.chat, [m.sender], 'remove')
          
          // Notificación opcional de eliminación
          await conn.reply(m.chat, `🤖 *Bot Detectado y Eliminado*\n\n👤 Usuario: @${m.sender.split('@')[0]}\n⚠️ Los bots no autorizados no están permitidos en este grupo.`, null, {
            mentions: [m.sender]
          })
        } catch (e) {
          console.log('Error al eliminar bot del grupo:', e)
          await conn.reply(m.chat, '⚠️ Detecté un bot no autorizado pero no pude eliminarlo. Verifica mis permisos de admin.', m)
        }
      } else {
        // El bot no es admin, solo notificar (opcional, comentado por defecto)
        // await conn.reply(m.chat, '⚠️ Detecté un bot no autorizado pero necesito ser admin para eliminarlo.', m)
      }
    }
  } catch (error) {
    console.error('Error en handler.before de antibot:', error)
    // No hacer nada más para evitar crashes
  }
}

handler.help = ['antibot']
handler.tags = ['group']
handler.command = ['antibot', 'antibots']
handler.admin = true
handler.botAdmin = true

export default handler
