import { promises as fs } from 'fs'

const charactersFilePath = './lib/characters.json'

async function loadCharacters() {
    const data = await fs.readFile(charactersFilePath, 'utf-8')
    return JSON.parse(data)
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

    try {
        if (!global.db.data.chats?.[m.chat]?.gacha && m.isGroup) {
            return m.reply(`ꕥ Los comandos de *Gacha* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con el comando:\n» *${usedPrefix}gacha on*`)
        }

        const allCharacters = await loadCharacters()

        switch (command) {
            case 'serielist':
            case 'slist':
            case 'animelist': {
                const seriesKeys = Object.keys(allCharacters)
                const totalSeries = seriesKeys.length
                const page = parseInt(args[0]) || 1
                const itemsPerPage = 20
                const totalPages = Math.max(1, Math.ceil(totalSeries / itemsPerPage))

                if (page < 1 || page > totalPages) {
                    return m.reply(`ꕥ Página no válida. Hay un total de *${totalPages}* páginas.`)
                }

                const startIndex = (page - 1) * itemsPerPage
                const endIndex = Math.min(startIndex + itemsPerPage, totalSeries)
                const pageKeys = seriesKeys.slice(startIndex, endIndex)

                let message = `*❏ Lista de series (${totalSeries}):*\n\n`

                for (const seriesKey of pageKeys) {
                    const series = allCharacters[seriesKey]
                    const seriesName = typeof series.name === 'string' ? series.name : seriesKey
                    const characterCount = Array.isArray(series.characters) ? series.characters.length : 0
                    message += `» *${seriesName}* (${characterCount}) *ID* (${seriesKey})\n`
                }

                message += `\n> • _Página ${page}/${totalPages}_`
                await m.reply(message.trim())
                break
            }

            case 'animeinfo':
            case 'serieinfo':
            case 'ainfo': {
                if (!args.length) {
                    return m.reply(`❀ Debes especificar el nombre de un anime\n> Ejemplo » *${usedPrefix + command} Naruto*`)
                }

                const searchName = args.join(' ').toLowerCase().trim()
                const seriesEntries = Object.entries(allCharacters)

                const foundSeries = seriesEntries.find(([, series]) => 
                    typeof series.name === 'string' && series.name.toLowerCase().includes(searchName) ||
                    (Array.isArray(series.tags) && series.tags.some(tag => tag.toLowerCase().includes(searchName)))
                ) || (seriesEntries.filter(([, series]) => 
                    typeof series.name === 'string' && searchName.split(' ').some(word => 
                        series.name.toLowerCase().includes(word)
                    ) || (Array.isArray(series.tags) && series.tags.some(tag => 
                        searchName.split(' ').some(word => tag.toLowerCase().includes(word))
                    ))
                )[0] || [])

                const [seriesId, seriesData] = foundSeries

                if (!seriesId || !seriesData) {
                    return m.reply(`ꕥ No se encontró la serie *${searchName}*\n> Puedes sugerirlo usando el comando *${usedPrefix}suggest sugerencia de serie: ${searchName}*`)
                }

                let characters = Array.isArray(seriesData.characters) ? seriesData.characters : []
                const totalCharacters = characters.length
                const claimedCharacters = characters.filter(char => 
                    Object.values(global.db.data.users).some(user => 
                        Array.isArray(user.characters) && user.characters.includes(char.id)
                    )
                )

                // Sort characters by value
                characters.sort((a, b) => {
                    const aData = global.db.data.characters?.[a.id] || {}
                    const bData = global.db.data.characters?.[b.id] || {}
                    const aValue = typeof aData.value === 'number' ? aData.value : Number(a.value || 0)
                    const bValue = typeof bData.value === 'number' ? bData.value : Number(b.value || 0)
                    return bValue - aValue
                })

                let message = `*❀ Fuente: \`<${seriesData.name || seriesId}>\`*\n\n`
                message += `❏ Personajes » *\`${totalCharacters}\`*\n`
                message += `♡ Reclamados » *\`${claimedCharacters.length}/${totalCharacters} (${(claimedCharacters.length / totalCharacters * 100).toFixed(0)}%)\`*\n`
                message += `❏ Lista de personajes:\n\n`

                for (const character of characters) {
                    const charData = global.db.data.characters?.[character.id] || {}
                    const value = typeof charData.value === 'number' ? charData.value : Number(character.value || 0)
                    
                    const ownerEntry = Object.entries(global.db.data.users).find(([, user]) => 
                        Array.isArray(user.characters) && user.characters.includes(character.id)
                    )

                    let ownerName = await (async () => {
                        return ownerEntry?.[0] ? 
                            global.db.data.users[ownerEntry[0]]?.name?.trim() || 
                            (await conn.getName(ownerEntry[0]))?.trim() || 
                            ownerEntry[0].split('@')[0] : 
                            'desconocido'
                    })()

                    const status = ownerEntry ? `Reclamado por *${ownerName}*` : 'Libre'
                    message += `» *${character.name}* (${value.toLocaleString()}) • ${status}.\n`
                }

                message += '\n> ⌦ _Página *1* de *1*_'
                await conn.reply(m.chat, message.trim(), m)
                break
            }
        }
    } catch (error) {
        await conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`, m)
    }
}

handler.help = ['serielist', 'serieinfo']
handler.tags = ['gacha']
handler.command = ['serielist', 'slist', 'animelist', 'animeinfo', 'serieinfo', 'ainfo']
handler.group = true

export default handler