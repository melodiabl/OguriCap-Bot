import { areJidsSameUser } from '@whiskeysockets/baileys'

let handler = async (m, { conn, args, usedPrefix, command, isBotAdmin, isAdmin, isOwner }) => {
    if (!m.isGroup) return conn.reply(m.chat, 'Este comando solo se puede usar en grupos.', m)
    
    let chat = global.db.data.chats[m.chat]
    
    if (!args[0]) return conn.reply(m.chat, *Active o Desactive el Anti-Bots*\n\nUse:\n${usedPrefix + command} on\n${usedPrefix + command} off, m)
    
    if (args[0] === 'on') {
        if (chat.antiBot) return conn.reply(m.chat, 'El Anti-Bots ya estaba activo.', m)
        chat.antiBot = true
        await conn.reply(m.chat, '✅ Anti-Bots Activado\n\nEl bot eliminará automáticamente a otros bots que no sean Sub-Bots verificados de este sistema.\n⚠️ Nota: El Bot necesita ser Admin para eliminar intrusos.', m)
    } else if (args[0] === 'off') {
        if (!chat.antiBot) return conn.reply(m.chat, 'El Anti-Bots ya estaba desactivado.', m)
        chat.antiBot = false
        await conn.reply(m.chat, '❌ Anti-Bots Desactivado', m)
    } else {
        await conn.reply(m.chat, Opción no válida. Use ${usedPrefix + command} on/off, m)
    }
}

handler.before = async function (m, { conn, isBotAdmin, isOwner, isAdmin }) {
    // Validaciones iniciales para no gastar recursos
    if (!m.isGroup) return
    if (m.fromMe) return
    if (!m.chat.endsWith('@g.us')) return
    
    let chat = global.db.data.chats[m.chat]
    if (!chat.antiBot) return

    // Detección de mensajes de Bots
    // BAE5, 3EB0, B24E son prefijos comunes de IDs de bots en Baileys
    let isBotMessage = m.id.startsWith('BAE5') || m.id.startsWith('3EB0') || m.id.startsWith('B24E') || m.id.startsWith('WA') || m.isBaileys
    
    if (isBotMessage) {
        // Si el que envió el mensaje es Admin o Owner, NO hacer nada
        if (isAdmin || isOwner) return
        
        // Verificar si es un SubBot oficial conectado a este sistema
        // Usamos ?. para evitar crash si global.conns es undefined
        let isSubBot = global.conns?.some(sock => areJidsSameUser(sock.user?.jid, m.sender)) || areJidsSameUser(conn.user?.jid, m.sender)
        
        if (!isSubBot) {
            // Si detecta un bot extraño y EL BOT ACTUAL es admin, lo elimina
            if (isBotAdmin) {
                // Pequeño delay para asegurar que Baileys procese la llave
                await new Promise(resolve => setTimeout(resolve, 1000)) 
                
                await conn.sendMessage(m.chat, { delete: m.key })
                await conn.groupParticipantsUpdate(m.chat, [m.sender], 'remove')
            } else {
                // Si el bot no es admin, no puede eliminar, pero no crashea
                // Opcional: avisar que necesita admin
                // await conn.reply(m.chat, 'Detecté un Bot pero no soy Admin para eliminarlo.', m) 
            }
        }
    }
}

handler.help = ['antibots']
handler.tags = ['group']
handler.command = ['antibot', 'antibots']
handler.admin = true
handler.botAdmin = true

export default handler
