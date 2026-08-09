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
    if (!global.db.data.users) global.db.data.users = {}

    try {
        const allCharacters = await loadCharacters()
        const flatCharacters = flattenCharacters(allCharacters)
        const userData = global.db.data.users[m.sender]

        if (!Array.isArray(userData.characters)) userData.characters = []

        switch (command) {
            case 'setfav':
            case 'wfav': {
                if (!args.length) {
                    return m.reply(`❀ Debes especificar un personaje.\n> Ejemplo » *${usedPrefix + command} Yuki Suou*`)
                }

                const characterName = args.join(' ').toLowerCase().trim()
                const character = flatCharacters.find(char => char.name.toLowerCase() === characterName)

                if (!character) {
                    return m.reply(`ꕥ No se encontró el personaje *${characterName}*.`)
                }

                if (!userData.characters.includes(character.id)) {
                    return m.reply(`ꕥ El personaje *${character.name}* no está reclamado por ti.`)
                }

                const previousFav = userData.favorite
                userData.favorite = character.id

                if (previousFav && previousFav !== character.id) {
                    const prevCharData = global.db.data.characters?.[previousFav]
                    const prevCharName = typeof prevCharData?.name === 'string' ? prevCharData.name : 'personaje anterior'
                    return m.reply(`❀ Se ha reemplazado tu favorito *${prevCharName}* por *${character.name}*!`)
                }

                return m.reply(`❀ Ahora *${character.name}* es tu personaje favorito!`)
            }

            case 'favtop':
            case 'favoritetop':
            case 'favboard': {
                const favoriteCount = {}
                for (const [, user] of Object.entries(global.db.data.users)) {
                    const favId = user.favorite
                    if (favId) favoriteCount[favId] = (favoriteCount[favId] || 0) + 1
                }

                const favoritesData = flatCharacters.map(char => ({
                    name: char.name,
                    favorites: favoriteCount[char.id] || 0
                })).filter(char => char.favorites > 0)

                const page = parseInt(args[0]) || 1
                const itemsPerPage = 10
                const totalPages = Math.max(1, Math.ceil(favoritesData.length / itemsPerPage))

                if (page < 1 || page > totalPages) {
                    return m.reply(`ꕥ Página no válida. Hay un total de *${totalPages}* páginas.`)
                }

                const sortedFavorites = favoritesData.sort((a, b) => b.favorites - a.favorites)
                const pageData = sortedFavorites.slice((page - 1) * itemsPerPage, page * itemsPerPage)

                let message = '✰ Top de personajes favoritos:\n\n'
                pageData.forEach((char, index) => {
                    message += '#' + ((page - 1) * itemsPerPage + index + 1) + ' » *' + char.name + '*\n'
                    message += '   ♡ ' + char.favorites + ' favorito' + (char.favorites !== 1 ? 's' : '') + '.\n'
                })
                message += `\n> Página ${page} de ${totalPages}`

                await conn.reply(m.chat, message.trim(), m)
                break
            }

            case 'deletefav':
            case 'delfav': {
                if (!userData.favorite) {
                    return m.reply('❀ No tienes ningún personaje marcado como favorito.')
                }

                const favId = userData.favorite
                const charData = global.db.data.characters?.[favId] || {}

                let charName = typeof charData.name === 'string' ? charData.name : null
                if (!charName) {
                    const character = flatCharacters.find(char => char.id === favId)
                    charName = character?.name || 'personaje desconocido'
                }

                delete userData.favorite
                m.reply(`✎ *${charName}* ha dejado de ser tu personaje favorito.`)
                break
            }
        }
    } catch (error) {
        await conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`, m)
    }
}

handler.help = ['setfav', 'favtop', 'delfav']
handler.tags = ['gacha']
handler.command = ['setfav', 'wfav', 'favtop', 'favoritetop', 'favboard', 'deletefav', 'delfav']
handler.group = true

export default handler