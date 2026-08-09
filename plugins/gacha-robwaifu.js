import { promises as fs } from 'fs'

const charactersFilePath = './lib/characters.json'

async function loadCharacters() {
    const data = await fs.readFile(charactersFilePath, 'utf-8')
    return JSON.parse(data)
}

function flattenCharacters(characters) {
    return Object.values(characters).flatMap(series => 
        Array.isArray(series.characters) ? series.characters : []
    )
}

const verifi = async () => {
    try {
        return true
    } catch {
        return false
    }
}

let handler = async (m, { conn, usedPrefix, command }) => {
    if (!await verifi()) {
        return conn.reply(m.chat, `❀ El comando *<${command}>* solo está disponible para Yuki Suou.\n> https://github.com/melodiabl/OguriCap-Bot.git`, m)
    }

    if (!global.db.data.chats?.[m.chat]?.gacha && m.isGroup) {
        return m.reply(`ꕥ Los comandos de *Gacha* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con el comando:\n» *${usedPrefix}gacha on*`)
    }

    const userData = global.db.data.users[m.sender]
    if (!Array.isArray(userData.characters)) userData.characters = []
    if (userData.robCooldown == null) userData.robCooldown = 0
    if (!userData.robVictims) userData.robVictims = {}

    const now = Date.now()
    const cooldownTime = 8 * 60 * 60 * 1000 // 8 hours
    const nextRob = userData.robCooldown + cooldownTime

    if (userData.robCooldown > 0 && now < nextRob) {
        const remaining = Math.ceil((nextRob - now) / 1000)
        const hours = Math.floor(remaining / 3600)
        const minutes = Math.floor((remaining % 3600) / 60)
        const seconds = remaining % 60

        let timeString = ''
        if (hours > 0) timeString += hours + ' hora' + (hours !== 1 ? 's' : '') + ' '
        if (minutes > 0) timeString += minutes + ' minuto' + (minutes !== 1 ? 's' : '') + ' '
        if (seconds > 0 || timeString === '') timeString += seconds + ' segundo' + (seconds !== 1 ? 's' : '')

        return m.reply(`ꕥ Debes esperar *${timeString.trim()}* para usar *${usedPrefix + command}* de nuevo.`)
    }

    const mentionedUsers = await m.mentionedJid
    const targetUser = mentionedUsers[0] || (m.quoted && await m.quoted.sender)

    if (!targetUser || typeof targetUser !== 'string' || !targetUser.includes('@')) {
        return m.reply('❀ Por favor, cita o menciona al usuario a quien quieras robarle una waifu.')
    }

    if (targetUser === m.sender) {
        let senderName = await (async () => {
            return userData.name?.trim() || 
                   await conn.getName(m.sender).then(name => 
                       typeof name === 'string' && name.trim() ? name : m.sender.split('@')[0]
                   ).catch(() => m.sender.split('@')[0])
        })()

        return m.reply(`ꕥ No puedes robarte a ti mismo, *${senderName}*.`)
    }

    const lastRobbed = userData.robVictims[targetUser]
    if (lastRobbed && now - lastRobbed < 24 * 60 * 60 * 1000) {
        let targetName = await (async () => {
            return global.db.data.users[targetUser]?.name?.trim() || 
                   await conn.getName(targetUser).then(name => 
                       typeof name === 'string' && name.trim() ? name : targetUser.split('@')[0]
                   ).catch(() => targetUser.split('@')[0])
        })()

        return m.reply(`ꕥ Ya robaste a *${targetName}* hoy. Solo puedes robarle a alguien *una vez cada 24 horas*.`)
    }

    const targetData = global.db.data.users[targetUser]
    if (!targetData || !Array.isArray(targetData.characters) || targetData.characters.length === 0) {
        let targetName = await (async () => {
            return global.db.data.users[targetUser]?.name?.trim() || 
                   await conn.getName(targetUser).then(name => 
                       typeof name === 'string' && name.trim() ? name : targetUser.split('@')[0]
                   ).catch(() => targetUser.split('@')[0])
        })()

        return m.reply(`ꕥ *${targetName}* no tiene waifus que puedas robar.`)
    }

    const success = Math.random() < 0.9 // 90% success rate
    userData.robCooldown = now
    userData.robVictims[targetUser] = now

    if (!success) {
        let targetName = await (async () => {
            return global.db.data.users[targetUser]?.name?.trim() || 
                   await conn.getName(targetUser).then(name => 
                       typeof name === 'string' && name.trim() ? name : targetUser.split('@')[0]
                   ).catch(() => targetUser.split('@')[0])
        })()

        return m.reply(`ꕥ El intento de robo ha fallado. *${targetName}* defendió a su waifu heroicamente.`)
    }

    const randomCharId = targetData.characters[Math.floor(Math.random() * targetData.characters.length)]
    const charData = global.db.data.characters?.[randomCharId] || {}
    const charName = typeof charData.name === 'string' ? charData.name : 'ID:' + randomCharId

    // Transfer character
    charData.user = m.sender
    targetData.characters = targetData.characters.filter(id => id !== randomCharId)

    if (!userData.characters.includes(randomCharId)) {
        userData.characters.push(randomCharId)
    }

    // Remove from sales if exists
    if (userData.sales?.[randomCharId]?.user === targetUser) {
        delete userData.sales[randomCharId]
    }

    // Remove from favorites if needed
    if (userData.favorite === randomCharId) delete userData.favorite
    if (global.db.data.users[targetUser]?.favorite === randomCharId) {
        delete global.db.data.users[targetUser].favorite
    }

    let senderName = await (async () => {
        return userData.name?.trim() || 
               await conn.getName(m.sender).then(name => 
                   typeof name === 'string' && name.trim() ? name : m.sender.split('@')[0]
               ).catch(() => m.sender.split('@')[0])
    })()

    let targetName = await (async () => {
        return global.db.data.users[targetUser]?.name?.trim() || 
               await conn.getName(targetUser).then(name => 
                   typeof name === 'string' && name.trim() ? name : targetUser.split('@')[0]
               ).catch(() => targetUser.split('@')[0])
    })()

    await m.reply(`❀ *${senderName}* ha robado a *${charName}* del harem de *${targetName}*.`)
}

handler.help = ['robwaifu']
handler.tags = ['gacha']
handler.command = ['robwaifu', 'robarwaifu']
handler.group = true

export default handler