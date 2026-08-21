import fetch from 'node-fetch'

let handler = async (m, { text, usedPrefix, args }) => {
if (!text) return m.reply(`❀ Por favor, proporciona el término de búsqueda que deseas realizar a *Google*.\n\nEjemplo: ${usedPrefix}google gatos curiosos`)
let maxResults = Number(args[1]) || 3
try {
await m.react('🕒')
let results = []
try {
const mel = global.APIs.MelodyApi
const response = await fetch(`${mel.url}/search/web?q=${encodeURIComponent(text)}&limit=${maxResults}`, { headers: mel.key ? { 'x-api-key': mel.key } : {} })
const payload = await response.json()
if (response.ok && payload.status && Array.isArray(payload.result)) results = payload.result
} catch {}
if (!results.length) {
const response = await fetch(`${global.APIs.delirius.url}/search/googlesearch?query=${encodeURIComponent(text)}`)
if (!response.ok) throw new Error('No se pudo conectar con el buscador de respaldo')
const payload = await response.json()
results = payload.status && Array.isArray(payload.data) ? payload.data : []
}
if (!Array.isArray(results) || !results.length) {
await m.react('✖️')
return m.reply('ꕥ No se encontraron resultados para esa búsqueda.')
}
let replyMessage = `✦ Resultados de la búsqueda para: *${text}*\n\n`
results.slice(0, maxResults).forEach((item, index) => {
replyMessage += `❀ Título: *${index + 1}. ${item.title || 'Sin título'}*\n`
replyMessage += `✐︎ Descripción: ${item.description ? `*${item.description}*` : '_Sin descripción_'}\n`
replyMessage += `🜸 URL: ${item.url || '_Sin url_'}\n\n`})
await m.reply(replyMessage.trim())
await m.react('✔️')
} catch (error) {
await m.react('✖️')
m.reply(`⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}.`)
}}

handler.help = ['google']
handler.command = ['google']
handler.group = true

export default handler
