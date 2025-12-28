import { promises as fs } from 'fs'

const verifi = async () => {
    try {
        return true
    } catch {
        return false
    }
}

let handler = async (m, { conn, args, command, usedPrefix }) => {
    if (!await verifi()) {
        return conn.reply(m.chat, `❀ El comando *<${command}>* solo está disponible para Yuki Suou.\n> https://github.com/melodiabl/OguriCap-Bot.git`, m)
    }

    const chatData = global.db.data.chats[m.chat]
    if (!chatData.sales) chatData.sales = {}
    if (!global.db.data.characters) global.db.data.characters = {}
    if (!global.db.data.users[m.sender]) {
        global.db.data.users[m.sender] = { coin: 0, characters: [] }
    }

    if (!chatData.gacha && m.isGroup) {
        return m.reply(`ꕥ Los comandos de *Gacha* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con el comando:\n» *${usedPrefix}gacha on*`)
    }

    try {
        switch (command) {
            case 'sell':
            case 'vender': {
                if (args.length < 2) {
                    return m.reply(`❀ Debes especificar un precio para subastar el personaje.\n> Ejemplo » *${usedPrefix + command} 5000 Yuki Suou*`)
                }

                const price = parseInt(args[0])
                if (isNaN(price) || price < 2000) {
                    return m.reply(`ꕥ El precio mínimo para subastar un personaje es de *¥2,000*`)
                }

                const characterName = args.slice(1).join(' ').toLowerCase()
                const characterId = Object.keys(global.db.data.characters).find(id => 
                    (global.db.data.characters[id]?.name || '').toLowerCase() === characterName && 
                    global.db.data.characters[id]?.user === m.sender
                )

                if (!characterId) {
                    return m.reply(`ꕥ No se ha encontrado al personaje *${args.slice(1).join(' ')}*`)
                }

                const character = global.db.data.characters[characterId]
                chatData.sales[characterId] = {
                    name: character.name,
                    user: m.sender,
                    price: price,
                    time: Date.now()
                }

                let userName = await (async () => {
                    return global.db.data.users[m.sender].name?.trim() || 
                           await conn.getName(m.sender).then(name => 
                               typeof name === 'string' && name.trim() ? name : m.sender.split('@')[0]
                           ).catch(() => m.sender.split('@')[0])
                })()

                m.reply(`❀ *${character.name}* ha sido puesto a la venta!\n❀ Vendedor » *${userName}*\n⛁ Precio » *¥${price.toLocaleString()}*\n\n> Puedes ver los personajes en venta usando *${usedPrefix}wshop*`)
                break
            }

            case 'removesale':
            case 'removerventa': {
                if (!args.length) {
                    return m.reply(`❀ Debes especificar un personaje para eliminar.\n> Ejemplo » *${usedPrefix + command} Yuki Suou*`)
                }

                const characterName = args.join(' ').toLowerCase()
                const characterId = Object.keys(chatData.sales).find(id => 
                    (chatData.sales[id]?.name || '').toLowerCase() === characterName
                )

                if (!characterId || chatData.sales[characterId].user !== m.sender) {
                    return m.reply(`ꕥ El personaje *${args.join(' ')}* no está a la venta por ti.`)
                }

                delete chatData.sales[characterId]
                m.reply(`❀ *${args.join(' ')}* ha sido eliminado de la lista de ventas.`)
                break
            }

            case 'wshop':
            case 'haremshop':
            case 'tiendawaifus': {
                const salesEntries = Object.entries(chatData.sales || {})
                if (!salesEntries.length) {
                    const groupMetadata = await conn.groupMetadata(m.chat)
                    return m.reply(`ꕥ No hay personajes en venta en *${groupMetadata.subject || 'este grupo'}*`)
                }

                const page = parseInt(args[0]) || 1
                const itemsPerPage = 10
                const totalPages = Math.ceil(salesEntries.length / itemsPerPage)

                if (page < 1 || page > totalPages) {
                    return m.reply(`ꕥ Página inválida. Solo hay *${totalPages}* página${totalPages > 1 ? 's' : ''}.`)
                }

                const salesList = []
                for (const [characterId, saleData] of salesEntries.slice((page - 1) * itemsPerPage, page * itemsPerPage)) {
                    const timeLeft = 3 * 86400000 - (Date.now() - saleData.time)
                    const days = Math.floor(timeLeft / 86400000)
                    const hours = Math.floor((timeLeft % 86400000) / 3600000)
                    const minutes = Math.floor((timeLeft % 3600000) / 60000)
                    const seconds = Math.floor((timeLeft % 60000) / 1000)

                    let sellerName = await (async () => {
                        return global.db.data.users[saleData.user]?.name?.trim() || 
                               await conn.getName(saleData.user).then(name => 
                                   typeof name === 'string' && name.trim() ? name : saleData.user.split('@')[0]
                               ).catch(() => saleData.user.split('@')[0])
                    })()

                    const characterValue = typeof global.db.data.characters[characterId]?.value === 'number' 
                        ? global.db.data.characters[characterId].value : 0

                    salesList.push(`❀ *${saleData.name}*\n⛁ Valor » *¥${characterValue}*\n⛁ Precio » *¥${saleData.price.toLocaleString()}*\n❖ Vendedor » *${sellerName}*\nⴵ Expira en » *${days}d ${hours}h ${minutes}m ${seconds}s*`)
                }

                m.reply(`*☆ HaremShop \`≧◠ᴥ◠≦\`*\n❏ Personajes en venta <${salesEntries.length}>:\n\n` + 
                       salesList.join('\n\n') + 
                       `\n\n> • Paginá *${page}* de *${totalPages}*`)
                break
            }

            case 'buycharacter':
            case 'buyc':
            case 'buychar': {
                if (!args.length) {
                    return m.reply(`❀ Debes especificar un personaje para comprar.\n> Ejemplo » *${usedPrefix + command} Yuki Suou*`)
                }

                const characterName = args.join(' ').toLowerCase()
                const characterId = Object.keys(chatData.sales).find(id => 
                    (chatData.sales[id]?.name || '').toLowerCase() === characterName
                )

                if (!characterId) {
                    return m.reply(`ꕥ No se ha encontrado al personaje *${args.join(' ')}* en venta.`)
                }

                const saleData = chatData.sales[characterId]
                if (saleData.user === m.sender) {
                    return m.reply(`ꕥ No puedes comprar tu propio personaje.`)
                }

                const buyerData = global.db.data.users[m.sender]
                const buyerCoins = typeof buyerData?.coin === 'number' ? buyerData.coin : 0

                if (buyerCoins < saleData.price) {
                    return m.reply(`ꕥ No tienes suficientes monedas para comprar a *${saleData.name}*.\n> Necesitas *¥${saleData.price.toLocaleString()}*`)
                }

                const sellerData = global.db.data.users[saleData.user]
                if (!sellerData) global.db.data.users[saleData.user] = { coin: 0, characters: [] }
                if (!Array.isArray(sellerData.characters)) sellerData.characters = []

                // Transfer coins
                buyerData.coin -= saleData.price
                sellerData.coin += saleData.price

                // Transfer character
                global.db.data.characters[characterId].user = m.sender
                if (!buyerData.characters.includes(characterId)) {
                    buyerData.characters.push(characterId)
                }
                sellerData.characters = sellerData.characters.filter(id => id !== characterId)

                // Remove from favorites if needed
                if (sellerData.favorite === characterId) {
                    delete sellerData.favorite
                }

                // Remove from sales
                delete chatData.sales[characterId]

                let sellerName = await (async () => {
                    return sellerData.name?.trim() || 
                           await conn.getName(saleData.user).then(name => 
                               typeof name === 'string' && name.trim() ? name : saleData.user.split('@')[0]
                           ).catch(() => saleData.user.split('@')[0])
                })()

                let buyerName = await (async () => {
                    return buyerData.name?.trim() || 
                           await conn.getName(m.sender).then(name => 
                               typeof name === 'string' && name.trim() ? name : m.sender.split('@')[0]
                           ).catch(() => m.sender.split('@')[0])
                })()

                m.reply(`❀ *${saleData.name}* ha sido comprado por *${buyerName}*!\n> Se han transferido *¥${saleData.price.toLocaleString()}* a *${sellerName}*`)
                break
            }
        }
    } catch (error) {
        await conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`, m)
    }
}

handler.help = ['sell', 'removesale', 'wshop', 'buycharacter']
handler.tags = ['gacha']
handler.command = ['sell', 'vender', 'removesale', 'removerventa', 'haremshop', 'tiendawaifus', 'wshop', 'buyc', 'buychar', 'buycharacter']
handler.group = true

export default handler