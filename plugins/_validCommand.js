export async function before(m, { isOwner, isROwner }) {
 if (!m.text || !global.prefix.test(m.text)) return
 const usedPrefix = global.prefix.exec(m.text)[0]
 const command = m.text.slice(usedPrefix.length).trim().split(' ')[0].toLowerCase()
 if (!command || command.length === 0) return
 const validCommand = (command, plugins) => {
   for (let plugin of Object.values(plugins)) {
     if (!plugin || !plugin.command) continue
     const c = plugin.command
     if (c instanceof RegExp) {
       if (c.test(command)) return true
       continue
     }
     if (Array.isArray(c)) {
       if (c.some((x) => x instanceof RegExp ? x.test(command) : String(x).toLowerCase() === command)) return true
       continue
     }
     if (typeof c === 'string') {
       if (c.toLowerCase() === command) return true
       continue
     }
   }
   return false
 }
 let chat = global.db.data.chats[m.chat]
 let settings = global.db.data.settings[this.user.jid]
 const owner = Boolean(isOwner || isROwner)
 if (chat.modoadmin) return
 if (settings.self) return
 if (command === 'mute') return
 if (chat.isMute && !owner) return
 if (command === 'bot') return
 if (chat.isBanned && !owner) return
 const globalState = global.db?.data?.panel?.botGlobalState
 if (m.isGroup && globalState?.isOn === false && !owner) return
 if (validCommand(command, global.plugins)) {
 } else {
 const comando = command
 await m.reply(`ꕥ El comando *<${comando}>* no existe.\n> Usa *${usedPrefix}help* para ver la lista de comandos disponibles.`)
 }}
