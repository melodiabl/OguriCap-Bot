import axios from 'axios'
import baileys from 'baileys'
import cheerio from 'cheerio'
import { melodiaResult, withFallback } from '../lib/melodia-api.js'

let handler = async (m, { conn, text, args, usedPrefix }) => {
if (!text) return m.reply(`❀ Por favor, ingresa lo que deseas buscar por Pinterest.`)
try {
await m.react('🕒')
if (text.includes("https://")) {
let i = await withFallback(
async () => {
const result = await melodiaResult('/download/pinterest', { url: args[0] }, { timeout: 25_000, retries: 1 })
const media = Array.isArray(result?.media) ? result.media[0] : null
const download = result?.url || media?.url || result?.download
if (!download) throw new Error('MelodiaAPI no devolvió un archivo descargable')
return { title: result?.title, download }
},
async () => dl(args[0])
)
if (!i || i.msg) return conn.reply(m.chat, `⚠︎ No se pudo descargar ese pin.`, m)
let isVideo = i.download?.includes(".mp4")
await conn.sendMessage(m.chat, { [isVideo ? "video" : "image"]: { url: i.download }, caption: i.title || '' }, { quoted: fkontak })
} else {
const results = await withFallback(
async () => {
const result = await melodiaResult('/search/pinterest', { q: text })
return result.map(item => ({ ...item, image_url: item.image_url || item.images_url }))
},
async () => pins(text)
)
if (!results.length) {
return conn.reply(m.chat, `ꕥ No se encontraron resultados para "${text}".`, m)
}
const medias = results.slice(0, 10).map(img => ({
type: img.video_url ? 'video' : 'image',
data: { url: img.video_url || img.image_url }
}))
await conn.sendSylphy(m.chat, medias, {
caption: `❀ Pinterest - Search ❀\n\n✧ Búsqueda » "${text}"\n✐ Resultados » ${medias.length}`, quoted: m })
}
await m.react('✔️')
} catch (e) {
await m.react('✖️')
conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n` + e, m)
}}

handler.help = ['pinterest']
handler.command = ['pinterest', 'pin']
handler.tags = ["download"]
handler.group = true

export default handler

async function dl(url) {
try {
let res = await axios.get(url, { headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }, timeout: 12000 }).catch(e => e.response)
if (!res?.data) return { msg: "No se pudo obtener el pin" }
let $ = cheerio.load(res.data)
let tag = $('script[data-test-id="video-snippet"]')
if (tag.length) {
let result = JSON.parse(tag.text())
return { title: result.name, download: result.contentUrl }
} else {
let json = JSON.parse($("script[data-relay-response='true']").eq(0).text())
let result = json.response.data["v3GetPinQuery"].data
return { title: result.title, download: result.imageLargeUrl }
}
} catch {
return { msg: "Error, inténtalo de nuevo más tarde" }
}}

// Búsqueda vía siputzx (id.pinterest.com devuelve 403 desde el VPS)
const pins = async (query) => {
try {
const res = await axios.get('https://api.siputzx.my.id/api/s/pinterest', {
params: { query },
headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
timeout: 12000
})
if (!res.data?.status || !Array.isArray(res.data.data)) return []
return res.data.data.filter(item => item.image_url || item.video_url)
} catch (error) {
console.error('Pinterest search error:', error.message)
return []
}}
