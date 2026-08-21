import fetch from 'node-fetch'
import { melodiaResult, withFallback } from '../lib/melodia-api.js'

let handler = async (m, { text, usedPrefix, command, conn }) => {
if (!text) return m.reply(`❀ Por favor, escribe el nombre de la canción para obtener la letra`)
try {
await m.react('🕒')
const normalize = (json) => {
if (!json) return null
if (json.status && json.data && (json.data.lyrics || json.data?.lyrics === '')) {
return { title: json.data.title || json.data.name || 'Desconocido', artists: json.data.artists || json.data.artist || 'Desconocido', lyrics: json.data.lyrics, image: json.data.image || null, url: json.data.url || null }}
if (json.status && (json.lyrics || json.lyrics === '')) {
return { title: json.title || json.name || 'Desconocido', artists: json.artist || json.artists || 'Desconocido', lyrics: json.lyrics, image: json.image || null, url: json.url || null }}
return null
}
let final = await withFallback(
async () => {
const result = await melodiaResult('/search/lyrics', { q: text })
if (typeof result !== 'string' || result.length <= 80 || /letra no encontrada/i.test(result)) throw new Error('Letra no encontrada')
return { title: text, artists: 'Desconocido', lyrics: result, image: null, url: null }
},
async () => {
const res = await fetch(`${global.APIs.delirius.url}/search/lyrics?query=${encodeURIComponent(text)}`)
if (!res.ok) throw new Error(`Delirius HTTP: ${res.status}`)
return normalize(await res.json())
})
if (!final || !final.lyrics) {
await m.react('✖️')
return m.reply('ꕥ No se encontró la letra de la canción')
}
let { title, artists, lyrics, image, url } = final
title = title || 'Desconocido'
artists = artists || 'Desconocido'
lyrics = lyrics || ''
image = image || null
url = url || null
let caption = `❀ *Título:* ${title}\n○ *Artista:* ${artists}\n○ *Letra:*\n\n${lyrics}`
if (caption.length > 4000) caption = caption.slice(0, 3990) + '...'
if (url) caption += `\n\n↯ [Ver fuente](${url})`
if (image) {
await conn.sendMessage(m.chat, { image: { url: image }, caption, mentions: [m.sender] }, { quoted: m })
} else {
await conn.sendMessage(m.chat, { text: caption, mentions: [m.sender] }, { quoted: m })
}
await m.react('✔️')
} catch (error) {
await m.react('✖️')
return conn.reply(m.chat, `⚠︎ Se ha producido un problema\n> Usa *${usedPrefix}report* para informarlo\n\n${error.message}`, m)
}}

handler.command = ['lyrics']
handler.help = ['lyrics']
handler.tags = ['tools']

export default handler
