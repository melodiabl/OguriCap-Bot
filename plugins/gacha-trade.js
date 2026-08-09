import { promises as fs } from 'fs'

let pendingTrade = {}

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

        if (!args.length || !m.text.includes('/')) {
            return m.reply(`❀ Debes especificar dos personajes para intercambiarlos.\n> ✐ Ejemplo: *${usedPrefix + command} Personaje1 / Personaje2*\n> Donde "Personaje1" es el personaje que quieres intercambiar y "Personaje2" es el personaje que quieres recibir.`)
        }

        const tradeText = m.text.slice(m.text.indexOf(' ') + 1).trim()
        const [giveName, getName] = tradeText.split('/').map(name => name.trim().toLowerCase())

        const giveCharId = Object.keys(global.db.data.characters).find(id => 
            (global.db.data.characters[id]?.name || '').toLowerCase() === giveName && 
            global.db.data.characters[id]?.user === m.sender
        )

        const getCharId = Object.keys(global.db.data.characters).find(id => 
            (global.db.data.characters[id]?.name || '').toLowerCase() === getName
        )

        if (!giveCharId || !getCharId) {
            const missingChar = !giveCharId ? giveName : getName
            return m.reply(`ꕥ No se ha encontrado al personaje *${missingChar}*.`)
        }

        const giveChar = global.db.data.characters[giveCharId]
        const getChar = global.db.data.characters[getCharId]
        const giveValue = typeof giveChar.value === 'number' ? giveChar.value : 0
        const getValue = typeof getChar.value === 'number' ? getChar.value : 0

        if (getChar.user === m.sender) {
            return m.reply(`ꕥ El personaje *${getChar.name}* ya está reclamado por ti.`)
        }

        if (!getChar.user) {
            return m.reply(`ꕥ El personaje *${getChar.name}* no está reclamado por nadie.`)
        }

        if (!giveChar.user || giveChar.user !== m.sender) {
            return m.reply(`ꕥ *${giveChar.name}* no está reclamado por ti.`)
        }

        const targetUser = getChar.user

        let senderName = await (async () => {
            return global.db.data.users[m.sender]?.name?.trim() || 
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

        pendingTrade[targetUser] = {
            from: m.sender,
            to: targetUser,
            chat: m.chat,
            give: giveCharId,
            get: getCharId,
            timeout: setTimeout(() => delete pendingTrade[targetUser], 60000)
        }

        await conn.reply(m.chat, `「✿」 *${targetName}* te ha enviado una solicitud de intercambio.\n\n✦ [${targetName}] » *${getChar.name}* (${getValue})\n✦ [${senderName}] » *${giveChar.name}* (*${giveValue}*)\n\n✐ Para aceptar el intercambio responde a este mensaje con "aceptar", la solicitud expira en 60 segundos.`, m, {
            mentions: [targetUser]
        })
    } catch (error) {
        await conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`, m)
    }
}

handler.before = async (m, { conn }) => {
    try {
        if (m.text.trim().toLowerCase() !== 'aceptar') return

        const tradeEntry = Object.entries(pendingTrade).find(([userId, trade]) => trade.chat === m.chat)
        if (!tradeEntry) return

        const [userId, trade] = tradeEntry

        if (m.sender !== trade.to) {
            let targetName = await (async () => {
                return global.db.data.users[trade.to]?.name?.trim() || 
                       await conn.getName(trade.to).then(name => 
                           typeof name === 'string' && name.trim() ? name : trade.to.split('@')[0]
                       ).catch(() => trade.to.split('@')[0])
            })()

            return m.reply(`ꕥ Solo *${targetName}* puede aceptar la solicitud de intercambio.`)
        }

        const giveChar = global.db.data.characters[trade.give]
        const getChar = global.db.data.characters[trade.get]

        if (!giveChar || !getChar || giveChar.user !== trade.from || getChar.user !== trade.to) {
            delete pendingTrade[userId]
            return m.reply('⚠︎ Uno de los personajes ya no está disponible para el intercambio.')
        }

        // Transfer characters
        giveChar.user = trade.to
        getChar.user = trade.from

        const senderData = global.db.data.users[trade.from]
        const targetData = global.db.data.users[trade.to]

        // Update character arrays
        if (!targetData.characters.includes(trade.give)) {
            targetData.characters.push(trade.give)
        }
        if (!senderData.characters.includes(trade.get)) {
            senderData.characters.push(trade.get)
        }

        senderData.characters = senderData.characters.filter(id => id !== trade.give)
        targetData.characters = targetData.characters.filter(id => id !== trade.get)

        // Remove from favorites if needed
        if (senderData.favorite === trade.give) delete senderData.favorite
        if (targetData.favorite === trade.get) delete targetData.favorite

        clearTimeout(trade.timeout)
        delete pendingTrade[userId]

        let senderName = await (async () => {
            return senderData?.name?.trim() || 
                   await conn.getName(trade.from).then(name => 
                       typeof name === 'string' && name.trim() ? name : trade.from.split('@')[0]
                   ).catch(() => trade.from.split('@')[0])
        })()

        let targetName = await (async () => {
            return targetData?.name?.trim() || 
                   await conn.getName(trade.to).then(name => 
                       typeof name === 'string' && name.trim() ? name : trade.to.split('@')[0]
                   ).catch(() => trade.to.split('@')[0])
        })()

        const giveName = giveChar.name || 'PersonajeA'
        const getName = getChar.name || 'PersonajeB'

        return await m.reply(`「✿」Intercambio aceptado!\n\n✦ ${targetName} » *${giveName}*\n✦ ${senderName} » *${getName}*`)

    } catch (error) {
        await conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *report* para informarlo.\n\n${error.message}`, m)
    }
}

handler.help = ['trade']
handler.tags = ['gacha']
handler.command = ['trade', 'intercambiar']
handler.group = true

export default handler