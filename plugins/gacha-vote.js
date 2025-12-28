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

function getSeriesNameByCharacter(characters, characterId) {
    return Object.values(characters).find(series => 
        Array.isArray(series.characters) && 
        series.characters.some(char => char.id === characterId)
    )?.name || 'Desconocido'
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

        if (!global.db.data.characters) global.db.data.characters = {}

        const userData = global.db.data.users[m.sender]
        const now = Date.now()
        const cooldownTime = 2 * 60 * 60 * 1000 // 2 hours

        if (userData.lastVote && now < userData.lastVote) {
            const remaining = Math.ceil((userData.lastVote - now) / 1000)
            const hours = Math.floor(remaining / 3600)
            const minutes = Math.floor((remaining % 3600) / 60)
            const seconds = remaining % 60

            let timeString = ''
            if (hours > 0) timeString += hours + ' hora' + (hours !== 1 ? 's' : '') + ' '
            if (minutes > 0) timeString += minutes + ' minuto' + (minutes !== 1 ? 's' : '') + ' '
            if (seconds > 0 || timeString === '') timeString += seconds + ' segundo' + (seconds !== 1 ? 's' : '')

            return m.reply(`ꕥ Debes esperar *${timeString.trim()}* para usar *${usedPrefix + command}* de nuevo.`)
        }

        const characterName = args.join(' ').trim()
        if (!characterName) {
            return m.reply('❀ Debes especificar un personaje para votarlo.')
        }

        const allCharacters = await loadCharacters()
        const flatCharacters = flattenCharacters(allCharacters)
        const character = flatCharacters.find(char => char.name.toLowerCase() === characterName.toLowerCase())

        if (!character) {
            return m.reply('ꕥ Personaje no encontrado. Asegúrate de que el nombre esté correcto.')
        }

        if (!global.db.data.characters[character.id]) {
            global.db.data.characters[character.id] = {}
        }

        const charData = global.db.data.characters[character.id]

        if (typeof charData.value !== 'number') charData.value = Number(character.value || 0)
        if (typeof charData.votes !== 'number') charData.votes = 0
        if (!charData.name) charData.name = character.name

        if (charData.lastVotedAt && now < charData.lastVotedAt + cooldownTime) {
            const timeLeft = charData.lastVotedAt + cooldownTime - now
            const remaining = Math.ceil(timeLeft / 1000)
            const hours = Math.floor(remaining / 3600)
            const minutes = Math.floor((remaining % 3600) / 60)
            const seconds = remaining % 60

            let timeString = ''
            if (hours > 0) timeString += hours + ' hora' + (hours !== 1 ? 's' : '') + ' '
            if (minutes > 0) timeString += minutes + ' minuto' + (minutes !== 1 ? 's' : '') + ' '
            if (seconds > 0 || timeString === '') timeString += seconds + ' segundo' + (seconds !== 1 ? 's' : '')

            return m.reply(`ꕥ *${charData.name}* ha sido votada recientemente.\n> Debes esperar *${timeString.trim()}* para votarla de nuevo.`)
        }

        if (!charData.dailyIncrement) charData.dailyIncrement = {}

        const today = new Date().toISOString().slice(0, 10)
        const todayVotes = charData.dailyIncrement[today] || 0

        if (todayVotes >= 900) {
            return m.reply(`ꕥ El personaje *${charData.name}* ya tiene el valor máximo.`)
        }

        const voteIncrease = Math.min(900 - todayVotes, Math.floor(Math.random() * 201) + 50)
        
        charData.value += voteIncrease
        charData.votes += 1
        charData.lastVotedAt = now
        charData.dailyIncrement[today] = todayVotes + voteIncrease
        userData.lastVote = now + cooldownTime

        const seriesName = getSeriesNameByCharacter(allCharacters, character.id)

        await conn.reply(m.chat, `❀ Votaste por *${charData.name}* (*${seriesName}*)\n> Su nuevo valor es *${charData.value.toLocaleString()}*`, m)
    } catch (error) {
        await conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`, m)
    }
}

handler.help = ['votar']
handler.tags = ['gacha']
handler.command = ['votar', 'vote']
handler.group = true

export default handler