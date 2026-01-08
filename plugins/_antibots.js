import { areJidsSameUser } from '@whiskeysockets/baileys'

let handler = async (m, { conn, args, usedPrefix, command, isBotAdmin, isAdmin, isOwner }) => {
    let chat = global.db.data.chats[m.chat]
    if (!args[0]) return conn.reply(m.chat, `*Active o Desactive el Anti-Bots*\n\nUse:\n${usedPrefix + command} on\n${usedPrefix + command} off`, m)
    
    if (args[0] === 'on') {
        if (chat.antiBot) return conn.reply(m.chat, 'El Anti-Bots ya estaba activo.', m)
        chat.antiBot = true
        await conn.reply(m.chat, '✅ *Anti-Bots Activado*\n\nEl bot eliminará automáticamente a otros bots que no sean Sub-Bots verificados de este sistema.', m)
    } else if (args[0] === 'off') {
        if (!chat.antiBot) return conn.reply(m.chat, 'El Anti-Bots ya estaba desactivado.', m)
        chat.antiBot = false
        await conn.reply(m.chat, '❌ *Anti-Bots Desactivado*', m)
    } else {
        await conn.reply(m.chat, `Opción no válida. Use ${usedPrefix + command} on/off`, m)
    }
}

handler.before = async function (m, { conn, isBotAdmin, isOwner, isAdmin }) {
    if (!m.chat.endsWith('@g.us') || m.fromMe) return
    let chat = global.db.data.chats[m.chat]
    if (!chat.antiBot) return

    let isBotMessage = m.id.startsWith('BAE5') || m.id.startsWith('3EB0') || m.id.startsWith('B24E') || m.isBaileys
    
    if (isBotMessage) {
        if (isAdmin || isOwner) return
        
        let isSubBot = global.conns.some(sock => areJidsSameUser(sock.user?.jid, m.sender)) || areJidsSameUser(conn.user?.jid, m.sender)
        
        if (!isSubBot) {
            if (isBotAdmin) {
                await conn.sendMessage(m.chat, { delete: m.key })
                await conn.groupParticipantsUpdate(m.chat, [m.sender], 'remove')
            } else {
                // Si no es admin, no puede eliminar, pero puede avisar o intentar borrar
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
