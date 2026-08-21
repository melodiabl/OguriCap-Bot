import axios from 'axios'
import cheerio from 'cheerio'

let handler = async (m, { conn, text, usedPrefix, command }) => {
if (!text) {
await conn.reply(m.chat, `❀ Por favor, ingresa lo que quieres buscar en Wikipedia.`, m)
return
}
try {
await m.react('🕒')
let wik, resulw
try {
const api = global.APIs.MelodyApi
if (!api?.url || !api?.key) throw new Error('MelodiaAPI no configurada')
const response = await axios.get(`${api.url}/search/wikipedia`, { params: { q: text, apikey: api.key }, timeout: 12000 })
if (!response.data?.status || !response.data?.result?.title) throw new Error(response.data?.error || 'Respuesta inválida')
wik = response.data.result.title
resulw = response.data.result.extract
} catch {
const link = await axios.get(`https://es.wikipedia.org/wiki/${encodeURIComponent(text)}`, { timeout: 12000 })
const $ = cheerio.load(link.data)
wik = $('#firstHeading').text().trim()
resulw = $('#mw-content-text > div.mw-parser-output').find('p').text().trim()
}
await m.reply(`▢ *Wikipedia*\n\n‣ Buscado : ${wik}\n\n${resulw}`)
await m.react('✔️')
} catch (e) {
await m.react('✖️')
await m.reply(`⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${e.message}`, m)
}}

handler.help = ['wikipedia']
handler.tags = ['tools']
handler.command = ['wiki', 'wikipedia'] 
handler.group = true

export default handler
