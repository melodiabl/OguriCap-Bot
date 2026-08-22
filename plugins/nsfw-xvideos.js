import fetch from 'node-fetch'
import axios from 'axios'
import cheerio from 'cheerio'

const handler = async (m, { text, conn, args, usedPrefix }) => {
if (!db.data.chats[m.chat].nsfw && m.isGroup) {
return m.reply(`ꕥ El contenido *NSFW* está desactivado en este grupo.\n\nUn *administrador* puede activarlo con el comando:\n» *${usedPrefix}nsfw on*`)
}
if (!text) {
return m.reply('❀ Por favor, ingresa el título o URL del video de *(xvideos)*.')
}
conn.xvideos = conn.xvideos || {}
const isUrl = text.includes('xvideos.com')
if (isUrl) {
try {
await m.react('🕒')
const res = await xvideosdl(args[0])
const { duration, quality, views, likes, deslikes } = res.result
const txt = `*乂 ¡XVIDEOS - DOWNLOAD! 乂*

≡ Título : ${res.result.title}
≡ Duración : ${duration || 'Desconocida'}
≡ Likes : ${likes || 'Desconocida'}
≡ Des-Likes : ${deslikes}
≡ Vistas : ${views || 'Desconocidas'}`
const dll = res.result.url
await conn.sendFile(m.chat, dll, res.result.title + '.mp4', txt, m)
await m.react('✔️')
} catch (e) {
await m.react('✖️')
await conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n` + e, m)
}
return
}
const res = await search(text)
await m.react('🕒')
if (!res.length) {
return m.reply('ꕥ No se encontraron resultados.')
}
await m.react('✔️')
const list = res.slice(0, 10).map((v, i) => `*${i + 1}*\n≡ Título : *${v.title}*\n≡ Link : ${v.url}`).join('\n\n')
const caption = `*乂 ¡XVIDEOS - SEARCH! 乂*

${list}

> » Responde con el número + n para descargar uno de los siguientes vídeos o bien, usa directamente la URL.`
const { key } = await conn.sendMessage(m.chat, { text: caption }, { quoted: m })
conn.xvideos[m.sender] = {
result: res,
key,
downloads: 0,
timeout: setTimeout(() => delete conn.xvideos[m.sender], 120_000),
}}
handler.before = async (m, { conn }) => {
conn.xvideos = conn.xvideos || {}
const session = conn.xvideos[m.sender]
if (!session || !m.quoted || m.quoted.id !== session.key.id) return
const n = parseInt(m.text.trim())
if (isNaN(n) || n < 1 || n > session.result.length) {
await m.reply('ꕥ Por favor, ingresa un número válido.')
return
}
try {
await m.react('🕒')
const link = session.result[n - 1].url
const res = await xvideosdl(link)
const { duration, quality, views, likes, deslikes } = res.result
const txt = `*乂 ¡XVIDEOS - DOWNLOAD! 乂*

≡ Título : ${res.result.title}
≡ Duración : ${duration || 'Desconocida'}
≡ Likes : ${likes || 'Desconocida'}
≡ Des-Likes : ${deslikes}
≡Vistas : ${views || 'Desconocidas'}`
const dll = res.result.url
await conn.sendFile(m.chat, dll, res.result.title + '.mp4', txt, m)
await m.react('✔️')
} catch (e) {
await m.react('✖️')
await conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n` + e, m)
} finally {
session.downloads++
if (session.downloads >= 5) {
clearTimeout(session.timeout)
delete conn.xvideos[m.sender]}}}

handler.help = ['xvideos']
handler.tags = ['download']
handler.command = ['xvideos', 'xvsearch', 'xvideosdl', 'xvid']
handler.group = true

export default handler

async function search(query) {
try {
const api = global.APIs.MelodyApi
if (!api?.url || !api?.key) throw new Error('MelodiaAPI no configurada')
const response = await fetch(`${api.url}/search/xvideos?q=${encodeURIComponent(query)}&apikey=${encodeURIComponent(api.key)}`)
const json = await response.json()
if (!response.ok || !json.status || !Array.isArray(json.result)) throw new Error(json.error || 'Sin resultados')
return json.result
} catch {}
return new Promise(async (resolve, reject) => {
try {
const url = `https://www.xvideos.com/?k=${encodeURIComponent(query)}`

const response = await axios.get(url)
const $ = cheerio.load(response.data)
const results = []
$("div.mozaique > div").each((index, element) => {
const title = $(element).find("p.title a").attr("title")
const videoUrl = "https://www.xvideos.com" + $(element).find("p.title a").attr("href")
const quality = $(element).find("span.video-hd-mark").text().trim()
results.push({ title, url: videoUrl, quality })
})
resolve(results)
} catch (error) {
reject(error)
}})
}
async function xvideosdl(url) {
try {
const api = global.APIs.MelodyApi
if (!api?.url || !api?.key) throw new Error('MelodiaAPI no configurada')
const response = await fetch(`${api.url}/download/xvideos?url=${encodeURIComponent(url)}&apikey=${encodeURIComponent(api.key)}`)
const json = await response.json()
if (!response.ok || !json.status || !json.result?.url) throw new Error(json.error || 'Sin resultados')
return { status: 200, result: { ...json.result, duration: json.result.duration ? `${json.result.duration}s` : null } }
} catch {}
return new Promise((resolve, reject) => {
fetch(`${url}`, { method: 'get' })
.then(res => res.text())
.then(res => {
let $ = cheerio.load(res, { xmlMode: false })
const title = $("meta[property='og:title']").attr("content")
const duration = (() => { const s = parseInt($('meta[property="og:duration"]').attr('content'), 10) || 0; return s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ${s % 60}s` : s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s` })()
const keyword = $("meta[name='keywords']").attr("content")
const views = $("div#video-tabs > div > div > div > div > strong.mobile-hide").text() + " views"
const vote = $("div.rate-infos > span.rating-total-txt").text()
const likes = $("span.rating-good-nbr").text()
const deslikes = $("span.rating-bad-nbr").text()
const thumb = $("meta[property='og:image']").attr("content")
const videoUrl = $("#html5video > #html5video_base > div > a").attr("href")
resolve({ status: 200, result: { title, duration, url: videoUrl, keyword, views, vote, likes, deslikes, thumb } })
})
.catch(err => reject(err))
})
}
