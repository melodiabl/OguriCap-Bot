import { sticker, addExif } from '../lib/sticker.js'
import axios from 'axios'
import fetch from 'node-fetch'

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))
const fetchSticker = async (text, attempt = 1) => {
try {
const api = global.APIs.MelodyApi
if (api?.url && api?.key) {
try {
const response = await axios.get(`${api.url}/imagecreator/brat`, { params: { text, apikey: api.key }, responseType: 'arraybuffer', timeout: 20000 })
if (response.data) return response.data
} catch {}
}
const response = await axios.get(`https://skyzxu-brat.hf.space/brat`, { params: { text }, responseType: 'arraybuffer' })
return response.data
} catch (error) {
if (error.response?.status === 429 && attempt <= 3) {
const retryAfter = error.response.headers['retry-after'] || 5
await delay(retryAfter * 1000)
return fetchSticker(text, attempt + 1)
}
throw error
}}
const fetchStickerVideo = async (text) => {
const api = global.APIs.MelodyApi
if (api?.url && api?.key) {
try {
const response = await axios.get(`${api.url}/imagecreator/brat-animated`, { params: { text, apikey: api.key }, responseType: 'arraybuffer', timeout: 25000 })
if (response.data) return response.data
} catch {}
}
const response = await axios.get(`https://skyzxu-brat.hf.space/brat-animated`, { params: { text }, responseType: 'arraybuffer' })
if (!response.data) throw new Error('Error al obtener el video de la API.')
return response.data
}
const fetchJson = (url, options) =>
new Promise((resolve, reject) => { fetch(url, options).then(res => res.json()).then(json => resolve(json)).catch(err => reject(err)) })
const handler = async (m, { conn, text, args, command, usedPrefix }) => {
try {
let userId = m.sender
let packstickers = global.db.data.users[userId] || {}
let texto1 = packstickers.text1 || global.packsticker
let texto2 = packstickers.text2 || global.packsticker2
switch (command) {
case 'brat': {
text = m.quoted?.text || text
if (!text) return conn.sendMessage(m.chat, { text: '❀ Por favor, responde a un mensaje o ingresa un texto para crear el Sticker.' }, { quoted: m })
await m.react('🕒')
const buffer = await fetchSticker(text)
const stiker = await sticker(buffer, false, texto1, texto2)
if (!stiker) throw new Error('ꕥ No se pudo generar el sticker.')
await conn.sendFile(m.chat, stiker, 'sticker.webp', '', m)
await m.react('✔️')
break
}
case 'bratv': {
text = m.quoted?.text || text
if (!text) return conn.sendMessage(m.chat, { text: '❀ Por favor, responde a un mensaje o ingresa un texto para crear el Sticker.' }, { quoted: m })
await m.react('🕒')
const videoBuffer = await fetchStickerVideo(text)
const stickerBuffer = await sticker(videoBuffer, null, texto1, texto2)
await conn.sendMessage(m.chat, { sticker: stickerBuffer }, { quoted: m })
await m.react('✔️')
break
}
case 'emojimix': {
if (!args[0]) return m.reply(`❀ Ingresa 2 emojis para combinar.\n> Ejemplo: *${usedPrefix + command}* 👻+👀`)
let [emoji1, emoji2] = text.split`+`
await m.react('🕒')
const api = global.APIs.MelodyApi
if (!api?.url || !api?.key) throw new Error('MelodiaAPI no configurada')
const response = await axios.get(`${api.url}/tools/emojimix`, { params: { emoji1, emoji2, apikey: api.key }, responseType: 'arraybuffer', timeout: 20000 })
let stiker = await sticker(response.data, false, texto1, texto2)
await conn.sendFile(m.chat, stiker, null, { asSticker: true }, m)
await m.react('✔️')
break
}
case 'qc': {
let textFinal = args.join(' ') || m.quoted?.text
if (!textFinal) return conn.reply(m.chat, `❀ Ingresa un texto para crear el sticker.`, m)
let target = m.quoted ? await m.quoted.sender : m.sender
const pp = await conn.profilePictureUrl(target).catch((_) => 'https://telegra.ph/file/24fa902ead26340f3df2c.png')
const nombre = await (async () => global.db.data.users[target].name || (async () => { try { const n = await conn.getName(target); return typeof n === 'string' && n.trim() ? n : target.split('@')[0] } catch { return target.split('@')[0] } })())()
const mentionRegex = new RegExp(`@${target.split('@')[0]}`, 'g')
let frase = textFinal.replace(mentionRegex, '')
if (frase.length > 30) return await m.react('✖️'), conn.reply(m.chat, `ꕥ El texto no puede tener más de 30 caracteres.`, m)
await m.react('🕒')
const quoteObj = { type: 'quote', format: 'png', backgroundColor: '#000000', width: 512, height: 768, scale: 2, messages: [{ entities: [], avatar: true, from: { id: 1, name: nombre, photo: { url: pp } }, text: frase, replyMessage: {} }]}
let json
try {
const api = global.APIs.MelodyApi
if (!api?.url || !api?.key) throw new Error('MelodiaAPI no configurada')
json = await axios.post(`${api.url}/imagecreator/quote?apikey=${encodeURIComponent(api.key)}`, quoteObj, { timeout: 25000, headers: { 'Content-Type': 'application/json' } })
json = { data: { result: json.data.result } }
} catch {
json = await axios.post('https://bot.lyo.su/quote/generate', quoteObj, { timeout: 25000, headers: { 'Content-Type': 'application/json' }})
}
const buffer = Buffer.from(json.data.result.image, 'base64')
const stiker = await sticker(buffer, false, texto1, texto2)
if (stiker) {
await m.react('✔️')
await conn.sendFile(m.chat, stiker, 'sticker.webp', '', m)
}
break
}
case 'take': case 'wm': {
if (!m.quoted) return m.reply(`❀ Responde a un sticker con el comando *${usedPrefix + command}* seguido del nuevo nombre.\n> Ejemplo: *${usedPrefix + command}* NuevoNombre`)
await m.react('🕒')
const stickerData = await m.quoted.download()
if (!stickerData) return await m.react('✖️'), m.reply('ꕥ No se pudo descargar el sticker.')
const parts = text.split(/[\u2022|]/).map(p => p.trim())
const nuevoPack = parts[0] || texto1
const nuevoAutor = parts[1] || texto2
const exif = await addExif(stickerData, nuevoPack, nuevoAutor)
await conn.sendMessage(m.chat, { sticker: exif }, { quoted: m })
await m.react('✔️')
break
}}} catch (e) {
await m.react('✖️')
conn.sendMessage(m.chat, { text: `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${e.message}` }, { quoted: m })
}}

handler.tags = ['sticker']
handler.help = ['brat', 'bratv', 'emojimix', 'qc', 'take', 'robar', 'wm']
handler.command = ['brat', 'bratv', 'emojimix', 'qc', 'take', 'wm']

export default handler
