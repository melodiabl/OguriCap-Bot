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

let handler = async (m, { conn, args, usedPrefix, command }) => {
    if (!await verifi()) {
        return conn.reply(m.chat, `❀ El comando *<${command}>* solo está disponible para Yuki Suou.\n> https://github.com/melodiabl/OguriCap-Bot.git`, m)
    }

    if (!global.db.data.chats?.[m.chat]?.gacha && m.isGroup) {
        return m.reply(`ꕥ Los comandos de *Gacha* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con el comando:\n» *${usedPrefix}gacha on*`)
    }

    try {
        if (!global.db.data.users) global.db.data.users = {}
        if (!global.db.data.characters) global.db.data.characters = {}

        let mentionedUsers = await m.mentionedJid
        let targetUser = mentionedUsers && mentionedUsers.length ? 
            mentionedUsers[0] : 
            (m.quoted && await m.quoted.sender ? await m.quoted.sender : m.sender)

        let userName = await (async () => {
            return global.db.data.users[targetUser]?.name?.trim() || 
                   await conn.getName(targetUser).then(name => 
                       typeof name === 'string' && name.trim() ? name : targetUser.split('@')[0]
                   ).catch(() => targetUser.split('@')[0])
        })()

        const allCharacters = await loadCharacters()
        const flatCharacters = flattenCharacters(allCharacters)

        const userCharacterIds = Object.entries(global.db.data.characters)
            .filter(([, charData]) => (charData.user || '').replace(/[^0-9]/g, '') === targetUser.replace(/[^0-9]/g, ''))
            .map(([charId]) => charId)

        if (userCharacterIds.length === 0) {
            const message = targetUser === m.sender ? 
                'ꕥ No tienes personajes reclamados.' : 
                `ꕥ *${userName}* no tiene personajes reclamados.`
            return conn.reply(m.chat, message, m, { mentions: [targetUser] })
        }

        // Sort characters by value
        userCharacterIds.sort((a, b) => {
            const aData = global.db.data.characters[a] || {}
            const bData = global.db.data.characters[b] || {}
            const aChar = flatCharacters.find(char => char.id === a)
            const bChar = flatCharacters.find(char => char.id === b)
            const aValue = typeof aData.value === 'number' ? aData.value : Number(aChar?.value || 0)
            const bValue = typeof bData.value === 'number' ? bData.value : Number(bChar?.value || 0)
            return bValue - aValue
        })

        const page = parseInt(args[1]) || 1
        const itemsPerPage = 50
        const totalPages = Math.ceil(userCharacterIds.length / itemsPerPage)

        if (page < 1 || page > totalPages) {
            return conn.reply(m.chat, `❀ Página no válida. Hay un total de *${totalPages}* páginas.`, m)
        }

        const startIndex = (page - 1) * itemsPerPage
        const endIndex = Math.min(startIndex + itemsPerPage, userCharacterIds.length)

        let message = '✿ Personajes reclamados ✿\n'
        message += `⌦ Usuario: *${userName}*\n`
        message += `♡ Personajes: *(${userCharacterIds.length})*\n\n`

        for (let i = startIndex; i < endIndex; i++) {
            const charId = userCharacterIds[i]
            const charData = global.db.data.characters[charId] || {}
            const character = flatCharacters.find(char => char.id === charId)
            const charName = character?.name || charData.name || 'ID:' + charId
            const value = typeof charData.value === 'number' ? charData.value : Number(character?.value || 0)

            message += `» *${charName}* (*${value.toLocaleString()}*)\n`
        }

        message += `\n⌦ _Página *${page}* de *${totalPages}*_`

        await conn.reply(m.chat, message.trim(), m, { mentions: [targetUser] })
    } catch (error) {
        await conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`, m)
    }
}

handler.help = ['harem']
handler.tags = ['anime']
handler.command = ['harem', 'waifus', 'claims']
handler.group = true

export default handler