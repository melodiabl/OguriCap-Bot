import { promises as fs } from 'fs'
const charactersFilePath = './lib/characters.json'

async function loadCharacters() {
const data = await fs.readFile(charactersFilePath, 'utf-8')
return JSON.parse(data)
}

function getCharacterById(id, characters) {
return Object.values(characters).flatMap(series => series.characters).find(char => char.id === id)
}

// Función de verificación simplificada - siempre retorna true
const verifi = async () => {
return true // Eliminada verificación del repositorio
}

let handler = async (m, { conn, usedPrefix, command }) => {
// Verificación simplificada
if (!await verifi()) return conn.reply(m.chat, ❀ El comando *${command}* está temporalmente deshabilitado., m)

const chatData = global.db.data.chats?.[m.chat] || {}
if (!chatData.gacha && m.isGroup) return m.reply(ꕥ Los comandos de *Gacha* están desactivados en este grupo.\n\nUn *administrador* puede activarlos con el comando:\n» *${usedPrefix}gacha on*)

try {
const userData = global.db.data.users[m.sender]
const now = Date.now()
const cooldown = 30 * 60 * 1000 // 30 minutos

if (userData.lastClaim && now < userData.lastClaim) {  
  const remaining = Math.ceil((userData.lastClaim - now) / 1000)  
  const minutes = Math.floor(remaining / 60)  
  const seconds = remaining % 60  
    
  let timeStr = ''  
  if (minutes > 0) timeStr += minutes + ' minuto' + (minutes !== 1 ? 's' : '') + ' '  
  if (seconds > 0 || timeStr === '') timeStr += seconds + ' segundo' + (seconds !== 1 ? 's' : '')  
    
  return m.reply(`ꕥ Debes esperar *${timeStr.trim()}* para usar *${usedPrefix + command}* de nuevo.`)  
}  
  
const characterId = chatData.lastRolledCharacter?.id || ''  
const canClaim = m.quoted?.id === chatData.lastRolledMsgId ||   
                m.quoted?.text?.includes(characterId) && characterId  
  
if (!canClaim) return m.reply('❀ Debes citar un personaje válido para reclamar.')  
  
const rolledId = chatData.lastRolledId  
const characters = await loadCharacters()  
const character = getCharacterById(rolledId, characters)  
  
if (!character) return m.reply('ꕥ Personaje no encontrado en characters.json')  
  
if (!global.db.data.characters) global.db.data.characters = {}  
if (!global.db.data.characters[rolledId]) global.db.data.characters[rolledId] = {}  
  
const charData = global.db.data.characters[rolledId]  
charData.name = charData.name || character.name  
charData.value = typeof charData.value === 'number' ? charData.value : character.value || 0  
charData.votes = charData.votes || 0  
  
if (charData.reservedBy && charData.reservedBy !== m.sender && now < charData.reservedUntil) {  
  let reservedByName = global.db.data.users[charData.reservedBy]?.name || charData.reservedBy.split('@')[0]  
  const remainingTime = ((charData.reservedUntil - now) / 1000).toFixed(1)  
  return m.reply(`ꕥ Este personaje está protegido por *${reservedByName}* durante *${remainingTime}s.*`)  
}  
  
if (charData.expiresAt && now > charData.expiresAt && !charData.user && !(charData.reservedBy && now < charData.reservedUntil)) {  
  const expiredTime = ((now - charData.expiresAt) / 1000).toFixed(1)  
  return m.reply(`ꕥ El personaje ha expirado » ${expiredTime}s.`)  
}  
  
if (charData.user) {  
  let ownerName = global.db.data.users[charData.user]?.name || charData.user.split('@')[0]  
  return m.reply(`ꕥ El personaje *${charData.name}* ya ha sido reclamado por *${ownerName}*`)  
}  
  
charData.user = m.sender  
charData.claimedAt = now  
delete charData.reservedBy  
delete charData.reservedUntil  
userData.lastClaim = now + cooldown  
  
if (!Array.isArray(userData.characters)) userData.characters = []  
if (!userData.characters.includes(rolledId)) userData.characters.push(rolledId)  
  
let userName = global.db.data.users[m.sender]?.name || m.sender.split('@')[0]  
const characterName = charData.name  
const claimMessage = userData.claimMessage  
const expireTime = typeof charData.expiresAt === 'number' ? ((now - charData.expiresAt + 60000) / 1000).toFixed(1) : '∞'  
  
const message = claimMessage ?   
  claimMessage.replace(/€user/g, `*${userName}*`).replace(/€character/g, `*${characterName}*`) :  
  `*${characterName}* ha sido reclamado por *${userName}*`  
  
await conn.reply(m.chat, `❀ ${message} (${expireTime}s)`, m)

} catch (error) {
await conn.reply(m.chat, ⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}, m)
}
}

handler.help = ['claim']
handler.tags = ['gacha']
handler.command = ['claim', 'c', 'reclamar']
handler.group = true

export default handler