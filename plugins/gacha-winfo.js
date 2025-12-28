import { promises as fs } from 'fs'
import fetch from 'node-fetch'

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

function getSeriesNameByCharacter(characters, characterId) {
    const seriesEntry = Object.entries(characters).find(([, series]) => 
        Array.isArray(series.characters) && 
        series.characters.some(char => char.id === characterId)
    )
    return seriesEntry?.[1]?.name || 'Desconocido'
}

function formatElapsed(milliseconds) {
    if (!milliseconds || milliseconds <= 0) return '—'
    
    const seconds = Math.floor(milliseconds / 1000)
    const weeks = Math.floor(seconds / 604800)
    const days = Math.floor((seconds % 604800) / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60
    
    const parts = []
    if (weeks > 0) parts.push(weeks + 'w')
    if (days > 0) parts.push(days + 'd')
    if (hours > 0) parts.push(hours + 'h')
    if (minutes > 0) parts.push(minutes + 'm')
    if (remainingSeconds > 0) parts.push(remainingSeconds + 's')
    
    return parts.join(' ')
}

function formatTag(tag) {
    return String(tag).toLowerCase().trim().replace(/\s+/g, '_')
}

async function buscarImagenDelirius(characterName) {
    const formattedTag = formatTag(characterName)
    const apis = [
        `https://danbooru.donmai.us/posts.json?tags=${formattedTag}`,
        `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=${formattedTag}`,
        global.APIs.delirius.url + `/search/gelbooru?query=${formattedTag}`
    ]

    for (const apiUrl of apis) {
        try {
            const response = await fetch(apiUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'application/json'
                }
            })

            const contentType = response.headers.get('content-type') || ''
            if (!response.ok || !contentType.includes('application/json')) continue

            const data = await response.json()
            const posts = Array.isArray(data) ? data : data?.post || data?.data || []
            const imageUrls = posts.map(post => 
                post?.file_url || post?.large_file_url || post?.image || 
                post?.media_asset?.variants?.[0]?.url
            ).filter(url => typeof url === 'string' && /\.(jpe?g|png)$/.test(url))

            if (imageUrls.length) return imageUrls
        } catch {
            // Continue to next API
        }
    }
    return []
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

        if (!args.length) {
            return m.reply(`❀ Por favor, proporciona el nombre de un personaje.\n> Ejemplo » *${usedPrefix + command} Yuki Suou*`)
        }

        const allCharacters = await loadCharacters()
        const flatCharacters = flattenCharacters(allCharacters)
        const searchName = args.join(' ').toLowerCase().trim()

        const character = flatCharacters.find(char => 
            String(char.name).toLowerCase() === searchName
        ) || flatCharacters.find(char => 
            String(char.name).toLowerCase().includes(searchName) || 
            (Array.isArray(char.tags) && char.tags.some(tag => tag.toLowerCase().includes(searchName)))
        ) || flatCharacters.find(char => 
            searchName.split(' ').some(word => 
                String(char.name).toLowerCase().includes(word) || 
                (Array.isArray(char.tags) && char.tags.some(tag => tag.toLowerCase().includes(word)))
            )
        )

        if (!character) {
            return m.reply(`ꕥ No se ha encontrado al personaje *${searchName}*`)
        }

        const dbData = global.db.data

        switch (command) {
            case 'charinfo':
            case 'winfo':
            case 'waifuinfo': {
                if (!dbData.characters) dbData.characters = {}
                if (!dbData.characters[character.id]) dbData.characters[character.id] = {}

                const charData = dbData.characters[character.id]
                charData.name ??= character.name
                charData.value = typeof charData.value === 'number' ? charData.value : Number(character.value || 100)
                charData.votes = typeof charData.votes === 'number' ? charData.votes : 0

                const seriesName = getSeriesNameByCharacter(allCharacters, character.id)
                const ownerEntry = Object.entries(dbData.users).find(([, userData]) => 
                    Array.isArray(userData.characters) && userData.characters.includes(character.id)
                )

                let ownerName = await (async () => {
                    return ownerEntry?.[0] ? 
                        dbData.users[ownerEntry[0]]?.name?.trim() || 
                        (await conn.getName(ownerEntry[0]))?.trim() || 
                        ownerEntry[0].split('@')[0] : 
                        'Desconocido'
                })()

                const claimedDate = charData.user && charData.claimedAt ? 
                    `\nⴵ Fecha de reclamo » *${new Date(charData.claimedAt).toLocaleDateString('es-VE', {
                        weekday: 'long',
                        day: 'numeric', 
                        month: 'long',
                        year: 'numeric'
                    })}*` : ''

                const lastVote = typeof charData.lastVotedAt === 'number' ? 
                    `hace *${formatElapsed(Date.now() - charData.lastVotedAt)}*` : 
                    '*Nunca*'

                const allCharsByValue = Object.values(dbData.characters)
                    .filter(char => typeof char.value === 'number')
                    .sort((a, b) => b.value - a.value)

                const ranking = allCharsByValue.findIndex(char => char.name === character.name) + 1 || '—'

                const message = `❀ Nombre » *${charData.name}*
⚥ Género » *${character.gender || 'Desconocido'}*
✰ Valor » *${charData.value.toLocaleString()}*
♡ Estado » ${ownerEntry ? `Reclamado por *${ownerName}*` : '*Libre*'}${claimedDate}
❖ Fuente » *${seriesName}*
❏ Puesto » *#${ranking}*
ⴵ Último voto » ${lastVote}`

                await conn.reply(m.chat, message.trim(), m)
                break
            }

            case 'charimage':
            case 'waifuimage':
            case 'cimage':
            case 'wimage': {
                const tag = Array.isArray(character.tags) ? character.tags[0] : null
                if (!tag) {
                    return m.reply(`ꕥ El personaje *${character.name}* no tiene un tag válido para buscar imágenes.`)
                }

                const images = await buscarImagenDelirius(tag)
                const randomImage = images[Math.floor(Math.random() * images.length)]

                if (!randomImage) {
                    return m.reply(`ꕥ No se encontraron imágenes para *${character.name}* con el tag *${tag}*.`)
                }

                const seriesName = getSeriesNameByCharacter(allCharacters, character.id)
                const caption = `❀ Nombre » *${character.name}*\n⚥ Género » *${character.gender || 'Desconocido'}*\n❖ Fuente » *${seriesName}*`

                await conn.sendFile(m.chat, randomImage, character.name + '.jpg', caption, m)
                break
            }

            case 'charvideo':
            case 'waifuvideo':
            case 'cvideo':
            case 'wvideo': {
                const tag = Array.isArray(character.tags) ? character.tags[0] : null
                if (!tag) {
                    return m.reply(`ꕥ El personaje *${character.name}* no tiene un tag válido para buscar videos.`)
                }

                const formattedTag = formatTag(tag)
                const apis = [
                    global.APIs.delirius.url + `/search/gelbooru?query=${formattedTag}`,
                    `https://danbooru.donmai.us/posts.json?tags=${formattedTag}`,
                    `https://safebooru.org/index.php?page=dapi&s=post&q=index&json=1&tags=${formattedTag}`
                ]

                let videos = []
                for (const apiUrl of apis) {
                    try {
                        const response = await fetch(apiUrl, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0',
                                'Accept': 'application/json'
                            }
                        })

                        const contentType = response.headers.get('content-type') || ''
                        if (!response.ok || !contentType.includes('application/json')) continue

                        const data = await response.json()
                        const posts = Array.isArray(data) ? data : data?.post || data?.data || []
                        
                        videos = posts.map(post => 
                            post?.file_url || post?.large_file_url || post?.image || 
                            post?.media_asset?.variants?.[0]?.url
                        ).filter(url => typeof url === 'string' && /\.(gif|mp4)$/.test(url))

                        if (videos.length) break
                    } catch {
                        // Continue to next API
                    }
                }

                if (!videos.length) {
                    return m.reply(`ꕥ No se encontraron videos para ${character.name}.`)
                }

                const randomVideo = videos[Math.floor(Math.random() * videos.length)]
                const seriesName = getSeriesNameByCharacter(allCharacters, character.id)
                const caption = `❀ Nombre » *${character.name}*\n⚥ Género » *${character.gender || 'Desconocido'}*\n❖ Fuente » *${seriesName}*`

                await conn.sendFile(m.chat, randomVideo, character.name + '.' + (randomVideo.endsWith('.mp4') ? 'mp4' : 'gif'), caption, m)
                break
            }
        }
    } catch (error) {
        await conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`, m)
    }
}

handler.help = ['winfo', 'wimage', 'wvideo']
handler.tags = ['gacha']
handler.command = ['charinfo', 'winfo', 'waifuinfo', 'charimage', 'waifuimage', 'cimage', 'wimage', 'charvideo', 'waifuvideo', 'cvideo', 'wvideo']
handler.group = true

export default handler