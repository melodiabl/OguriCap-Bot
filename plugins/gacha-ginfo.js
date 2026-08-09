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

function formatTime(milliseconds) {
    if (milliseconds <= 0) return 'Ahora'
    
    const seconds = Math.ceil(milliseconds / 1000)
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const remainingSeconds = seconds % 60
    
    const parts = []
    if (hours > 0) parts.push(hours + ' hora' + (hours !== 1 ? 's' : ''))
    if (minutes > 0 || hours > 0) parts.push(minutes + ' minuto' + (minutes !== 1 ? 's' : ''))
    parts.push(remainingSeconds + ' segundo' + (remainingSeconds !== 1 ? 's' : ''))
    
    return parts.join(' ')
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

    try {
        const userData = global.db.data.users[m.sender]
        if (!Array.isArray(userData.characters)) userData.characters = []

        const now = Date.now()
        const claimCooldown = userData.lastClaim && now < userData.lastClaim ? userData.lastClaim - now : 0
        const rollCooldown = userData.lastRoll && now < userData.lastRoll ? userData.lastRoll - now : 0
        const voteCooldown = userData.lastVote && now < userData.lastVote ? userData.lastVote - now : 0

        const allCharacters = await loadCharacters()
        const flatCharacters = flattenCharacters(allCharacters)
        const totalCharacters = flatCharacters.length
        const totalSeries = Object.keys(allCharacters).length

        const userCharacterIds = Object.entries(global.db.data.characters || {})
            .filter(([, charData]) => charData.user === m.sender)
            .map(([charId]) => charId)

        const totalValue = userCharacterIds.reduce((sum, charId) => {
            const charValue = global.db.data.characters?.[charId]?.value
            const defaultValue = flatCharacters.find(char => char.id === charId)?.value || 0
            const value = typeof charValue === 'number' ? charValue : defaultValue
            return sum + value
        }, 0)

        let userName = await (async () => {
            return userData.name || (async () => {
                try {
                    const name = await conn.getName(m.sender)
                    return typeof name === 'string' && name.trim() ? name : m.sender.split('@')[0]
                } catch {
                    return m.sender.split('@')[0]
                }
            })()
        })()

        const message = `*❀ Usuario \`<${userName}>\`*

ⴵ Claim » *${formatTime(claimCooldown)}*
ⴵ RollWaifu » *${formatTime(rollCooldown)}*
ⴵ Vote » *${formatTime(voteCooldown)}*

♡ Personajes reclamados » *${userCharacterIds.length}*
✰ Valor total » *${totalValue.toLocaleString()}*
❏ Personajes totales » *${totalCharacters}*
❏ Series totales » *${totalSeries}*`

        await m.reply(message.trim())
    } catch (error) {
        await conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`, m)
    }
}

handler.help = ['gachainfo']
handler.tags = ['gacha']
handler.command = ['ginfo', 'gachainfo', 'infogacha']
handler.group = true

export default handler