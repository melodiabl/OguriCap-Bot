import { promises as fs } from 'fs'

const verifi = async () => {
    try {
        return true
    } catch {
        return false
    }
}

let handler = async (m, { conn, args, usedPrefix, command }) => {
    if (!await verifi()) {
        return conn.reply(m.chat, `❀ El comando *<${command}>* solo está disponible para Yuki Suou.\n> https://github.com/melodiabl/OguriCap-Bot.git`, m)
    }

    if (!global.db.data.chats?.[m.chat]?.gacha && m.isGroup) {
        return m.reply(`ꕥ Los comandos de *Gacha* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con el comando:\n» *${usedPrefix}gacha on*`)
    }

    try {
        const userData = global.db.data.users[m.sender]
        if (!Array.isArray(userData.characters)) userData.characters = []

        if (!args.length) {
            return m.reply('❀ Debes escribir el nombre del personaje y citar o mencionar al usuario que lo recibirá')
        }

        const mentionedUsers = await m.mentionedJid
        const targetUser = mentionedUsers[0] || (m.quoted && await m.quoted.sender)

        if (!targetUser) {
            return m.reply('❀ Debes mencionar o citar el mensaje del destinatario.')
        }

        const characterName = m.quoted ? 
            args.join(' ').toLowerCase().trim() : 
            args.slice(0, -1).join(' ').toLowerCase().trim()

        const characterId = Object.keys(global.db.data.characters).find(id => {
            const charData = global.db.data.characters[id]
            return typeof charData.name === 'string' && 
                   charData.name.toLowerCase() === characterName && 
                   charData.user === m.sender
        })

        if (!characterId) {
            return m.reply(`ꕥ No se encontró el personaje *${characterName}* o no está reclamado por ti.`)
        }

        const charData = global.db.data.characters[characterId]

        if (!userData.characters.includes(characterId)) {
            return m.reply(`ꕥ *${charData.name}* no está reclamado por ti.`)
        }

        const targetData = global.db.data.users[targetUser]
        if (!targetData) {
            return m.reply('ꕥ El usuario mencionado no está registrado.')
        }

        if (!Array.isArray(targetData.characters)) targetData.characters = []

        // Transfer character
        if (!targetData.characters.includes(characterId)) {
            targetData.characters.push(characterId)
        }

        userData.characters = userData.characters.filter(id => id !== characterId)
        charData.user = targetUser

        // Remove from sales if exists
        if (userData.sales?.[characterId]?.user === m.sender) {
            delete userData.sales[characterId]
        }

        // Remove from favorites if needed
        if (userData.favorite === characterId) delete userData.favorite
        if (global.db.data.users[m.sender]?.favorite === characterId) {
            delete global.db.data.users[m.sender].favorite
        }

        let senderName = await (async () => {
            return userData.name?.trim() || 
                   await conn.getName(m.sender).then(name => 
                       typeof name === 'string' && name.trim() ? name : m.sender.split('@')[0]
                   ).catch(() => m.sender.split('@')[0])
        })()

        let targetName = await (async () => {
            return targetData.name?.trim() || 
                   await conn.getName(targetUser).then(name => 
                       typeof name === 'string' && name.trim() ? name : targetUser.split('@')[0]
                   ).catch(() => targetUser.split('@')[0])
        })()

        await conn.reply(m.chat, `❀ *${charData.name}* ha sido regalado a *${targetName}* por *${senderName}*.`, m, {
            mentions: [targetUser]
        })
    } catch (error) {
        await conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`, m)
    }
}

handler.help = ['regalar']
handler.tags = ['gacha']
handler.command = ['givewaifu', 'givechar', 'regalar']
handler.group = true

export default handler