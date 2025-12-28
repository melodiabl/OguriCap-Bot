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

    if (!global.db.data.characters) global.db.data.characters = {}

    try {
        const allCharacters = await loadCharacters()
        const flatCharacters = flattenCharacters(allCharacters)

        const charactersWithValue = flatCharacters.map(char => {
            const charData = global.db.data.characters[char.id] || {}
            const value = typeof charData.value === 'number' ? charData.value : Number(char.value || 0)
            return {
                name: char.name,
                value: value
            }
        })

        const page = parseInt(args[0]) || 1
        const itemsPerPage = 10
        const totalPages = Math.ceil(charactersWithValue.length / itemsPerPage)

        if (page < 1 || page > totalPages) {
            return m.reply(`ꕥ Página no válida. Hay un total de *${totalPages}* páginas.`)
        }

        const sortedCharacters = charactersWithValue.sort((a, b) => b.value - a.value)
        const pageData = sortedCharacters.slice((page - 1) * itemsPerPage, page * itemsPerPage)

        let message = '❀ *Personajes con más valor:*\n\n'
        pageData.forEach((char, index) => {
            message += '✰ ' + ((page - 1) * itemsPerPage + index + 1) + ' » *' + char.name + '*\n'
            message += '   → Valor: *' + char.value.toLocaleString() + '*\n'
        })
        message += `\n⌦ Página *${page}* de *${totalPages}*`

        await conn.reply(m.chat, message.trim(), m)
    } catch (error) {
        await conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`, m)
    }
}

handler.help = ['topwaifus']
handler.tags = ['gacha']
handler.command = ['waifusboard', 'waifustop', 'topwaifus', 'wtop']
handler.group = true

export default handler