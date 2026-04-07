import axios from 'axios'
import cheerio from 'cheerio'

let handler = async (m, { conn, args, text, usedPrefix }) => {
if (!text) {
return conn.reply(m.chat, `❀ Te faltó el link de una imagen/video de twitter.`, m)
}
try {
await m.react('🕒')

 // MelodyApi first
   try {
    const melApi = global.APIs.MelodyApi
    const mel = (typeof melApi?.url === 'string' ? melApi.url : '').trim().replace(/\/+$/, '')
    const melKey = (typeof melApi?.key === 'string' ? melApi.key : '').trim()
    const melHeaders = melKey ? { 'x-api-key': melKey } : {}
   if (mel) {
    const r = await axios.get(`${mel}/download/twitter?url=${encodeURIComponent(text)}`, { timeout: 20000, headers: melHeaders })
    const out = r.data?.result
    const direct = Array.isArray(out) ? (out[0]?.url || out[0]) : (out?.url || out)
    if (r.data?.status && direct) {
     const caption = `❀ Twitter - Download ❀\n\n> 🜸 URL » ${text}`
     await conn.sendFile(m.chat, direct, "video.mp4", caption, m)
     await m.react('✔️')
     return
    }
   }
  } catch {}

const result = await twitterScraper(text);
if (!result.status) return conn.reply(m.chat, `ꕥ No se pudo obtener el contenido de Twitter`, m)
if (result.data.type === 'video') {
let caption = `❀ Twitter - Download ❀

> ✦ Titulo » ${result.data.title}
> ⴵ Duración » ${result.data.duration}
> 🜸 URL » ${text}`
 conn.sendFile(m.chat, result.data.dl[0].url, "video.mp4", caption, m)
 await m.react('✔️')
} else {
await conn.sendMessage(m.chat, {
image: { url: result.data.imageUrl },
caption: `❀ Twitter - Download ❀\n\n> 🜸 URL » ${text}`}, { quoted: m })
 await m.react('✔️')
}} catch (e) {
await m.react('✖️')
return conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${e.message}`, m)
}}

handler.command = ["x", "twitter", "xdl"]
handler.help = ["twitter"]
handler.tags = ["download"]
handler.group = true

export default handler

async function twitterScraper(url) {
return new Promise(async (resolve, reject) => {
try {
const twitterUrlMatch = url.match(/(https:\/\/x.com\/[^?]+)/)
const tMatch = url.match(/t=([^&]+)/)
const twitterUrl = twitterUrlMatch ? twitterUrlMatch[1] : ''
const t = tMatch ? tMatch[1] : ''
const urlnya = encodeURIComponent(`${twitterUrl}?t=${t}&s=19`)
const response = await axios.post("https://savetwitter.net/api/ajaxSearch",
`q=${urlnya}&lang=en`)
const $ = cheerio.load(response.data.data)
const isVideo = $('.tw-video').length > 0
const twitterId = $('#TwitterId').val()
if (isVideo) {
const videoThumbnail = $('.tw-video .thumbnail .image-tw img').attr('src')
const data = []
$('.dl-action a').each((i, elem) => {
const quality = $(elem).text().trim()
const url = $(elem).attr('href')
if ($(elem).hasClass('action-convert')) {
const audioUrl = $(elem).attr('data-audioUrl')
data.push({
quality: quality,
url: audioUrl || 'URL not found',
})
} else {
data.push({
quality: quality,
url: url
})
}})
const title = $('.tw-middle h3').text().trim()
const videoDuration = $('.tw-middle p').text().trim()
resolve({
status: true,
data: {
type: "video",
title: title,
duration: videoDuration,
twitterId: twitterId,
videoThumbnail: videoThumbnail,
dl: data
}})
} else {
const imageUrl = $('.photo-list .download-items__thumb img').attr('src')
const downloadUrl = $('.photo-list .download-items__btn a').attr('href')
resolve({
status: true,
data: {
type: "image",
twitterId: twitterId,
imageUrl: imageUrl,
dl: downloadUrl
}})
}} catch (error) {
reject(error)
}})
}
