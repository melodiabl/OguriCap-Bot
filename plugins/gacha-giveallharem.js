import { promises as fs } from 'fs'

const file = './lib/characters.json'

async function load() {
    const data = await fs.readFile(file, 'utf-8')
    return JSON.parse(data)
}

function get(characters) {
    return Object.values(characters).flatMap(series => 
        Array.isArray(series.characters) ? series.characters : []
    )
}

let pending = {}

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

        const mentionedUsers = await m.mentionedJid
        const targetUser = mentionedUsers[0] || (m.quoted && await m.quoted.sender)

        if (!targetUser || typeof targetUser !== 'string' || !targetUser.includes('@')) {
            return m.reply('❀ Debes mencionar a quien quieras regalarle tus personajes.')
        }

        const targetData = global.db.data.users[targetUser]
        if (!targetData) {
            return m.reply('ꕥ El usuario mencionado no está registrado.')
        }

        if (!Array.isArray(targetData.characters)) targetData.characters = []

        const allCharacters = await load()
        const flatCharacters = get(allCharacters)
        const userCharacterIds = userData.characters

        const charactersData = userCharacterIds.map(charId => {
            const charData = global.db.data.characters?.[charId] || {}
            const character = flatCharacters.find(char => char.id === charId)
            const value = typeof charData.value === 'number' ? charData.value : 
                         typeof character?.value === 'number' ? character.value : 0

            return {
                id: charId,
                name: charData.name || character?.name || 'ID:' + charId,
                value: value
            }
        })

        if (charactersData.length === 0) {
            return m.reply('ꕥ No tienes personajes para regalar.')
        }

        const totalValue = charactersData.reduce((sum, char) => sum + char.value, 0)

        let targetName = await (async () => {
            return global.db.data.users[targetUser].name.trim() || 
                   await conn.getName(targetUser).then(name => 
                       typeof name === 'string' && name.trim() ? name : targetUser.split('@')[0]
                   ).catch(() => targetUser.split('@')[0])
        })()

        let senderName = await (async () => {
            return global.db.data.users[m.sender].name.trim() || 
                   await conn.getName(m.sender).then(name => 
                       typeof name === 'string' && name.trim() ? name : m.sender.split('@')[0]
                   ).catch(() => m.sender.split('@')[0])
        })()

        pending[m.sender] = {
            sender: m.sender,
            to: targetUser,
            value: totalValue,
            count: charactersData.length,
            ids: charactersData.map(char => char.id),
            chat: m.chat,
            timeout: setTimeout(() => delete pending[m.sender], 60000)
        }

        await conn.reply(m.chat, `「✿」 *${senderName}*, ¿confirmas regalar todo tu harem a *${targetUser}*?\n\n❏ Personajes a transferir: *${charactersData.length}*\n> ⴵ Valor total: *${totalValue.toLocaleString()}*\n\n✐ Para confirmar responde a este mensaje con "Aceptar".\n> Esta acción no se puede deshacer, revisa bien los datos antes de confirmar.`, m, {
            mentions: [targetUser]
        })
    } catch (error) {
        await conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`, m)
    }
}

handler.before = async (m, { conn }) => {
    try {
        const pendingTransfer = pending[m.sender]
        if (!pendingTransfer || m.text?.trim().toLowerCase() !== 'aceptar') return

        if (m.sender !== pendingTransfer.sender || pendingTransfer.chat !== m.chat) return

        if (typeof pendingTransfer.to !== 'string' || !pendingTransfer.to.includes('@')) return

        const senderData = global.db.data.users[m.sender]
        const targetData = global.db.data.users[pendingTransfer.to]

        for (const charId of pendingTransfer.ids) {
            const charData = global.db.data.characters?.[charId]
            if (!charData || charData.user !== m.sender) continue

            charData.user = pendingTransfer.to

            if (!targetData.characters.includes(charId)) {
                targetData.characters.push(charId)
            }

            senderData.characters = senderData.characters.filter(id => id !== charId)

            // Remove from sales if exists
            if (senderData.sales?.[charId]?.user === m.sender) {
                delete senderData.sales[charId]
            }

            // Remove from favorites if needed
            if (senderData.favorite === charId) delete senderData.favorite
            if (global.db.data.users[m.sender]?.favorite === charId) {
                delete global.db.data.users[m.sender].favorite
            }
        }

        clearTimeout(pendingTransfer.timeout)
        delete pending[m.sender]

        let targetName = await (async () => {
            return global.db.data.users[pendingTransfer.to].name.trim() || 
                   await conn.getName(pendingTransfer.to).then(name => 
                       typeof name === 'string' && name.trim() ? name : pendingTransfer.to.split('@')[0]
                   ).catch(() => pendingTransfer.to.split('@')[0])
        })()

        return await m.reply(`「✿」 Has regalado con éxito todos tus personajes a *${targetName}*!\n\n> ❏ Personajes regalados: *${pendingTransfer.count}*\n> ⴵ Valor total: *${pendingTransfer.value.toLocaleString()}*`), true
    } catch (error) {
        await conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`, m)
    }
}

handler.help = ['giveallharem']
handler.tags = ['gacha']
handler.command = ['giveallharem']
handler.group = true

export default handler