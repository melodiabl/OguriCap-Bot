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
        const userData = global.db.data.users[m.sender]
        if (!Array.isArray(userData.characters)) userData.characters = []

        if (!args.length) {
            return m.reply(`❀ Debes especificar un personaje para eliminar.\n> Ejemplo » *${usedPrefix + command} Yuki Suou*`)
        }

        const characterName = args.join(' ').toLowerCase().trim()
        const allCharacters = await loadCharacters()
        const flatCharacters = flattenCharacters(allCharacters)
        const character = flatCharacters.find(char => char.name.toLowerCase() === characterName)

        if (!character) {
            return m.reply(`ꕥ No se ha encontrado ningún personaje con el nombre *${characterName}*\n> Puedes sugerirlo usando *${usedPrefix}suggest personaje ${characterName}*`)
        }

        if (!global.db.data.characters?.[character.id]) {
            return m.reply(`ꕥ *${character.name}* no está reclamado por ti.`)
        }

        const charData = global.db.data.characters[character.id]

        if (charData.user !== m.sender || !userData.characters.includes(character.id)) {
            return m.reply(`ꕥ *${character.name}* no está reclamado por ti.`)
        }

        // Delete character data
        delete global.db.data.characters[character.id]

        // Remove from user's character list
        userData.characters = userData.characters.filter(id => id !== character.id)

        // Remove from sales if exists
        if (userData.sales?.[character.id]?.user === m.sender) {
            delete userData.sales[character.id]
        }

        // Remove from favorites if needed
        if (userData.favorite === character.id) {
            delete userData.favorite
        }

        await m.reply(`❀ *${character.name}* ha sido eliminado de tu lista de reclamados.`)
    } catch (error) {
        await conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`, m)
    }
}

handler.help = ['delchar']
handler.tags = ['gacha']
handler.command = ['delchar', 'deletewaifu', 'delwaifu']
handler.group = true

export default handler