import axios from 'axios'

const handler = async (m, { conn, text, usedPrefix }) => {
if (!text) return conn.reply(m.chat, '❀ Por favor, ingresa un término de búsqueda o el enlace de TikTok.', m)
const isUrl = /(?:https:?\/{2})?(?:www\.|vm\.|vt\.|t\.)?tiktok\.com\/([^\s&]+)/gi.test(text)
try {
await m.react('🕒')
if (isUrl) {
  const melApi = global.APIs.MelodyApi
  const mel = (typeof melApi?.url === 'string' ? melApi.url : '').trim().replace(/\/+$/, '')
  const melKey = (typeof melApi?.key === 'string' ? melApi.key : '').trim()
  const melHeaders = melKey ? { 'x-api-key': melKey } : {}
 if (mel) {
 try {
 const r = await axios.get(`${mel}/download/tiktok?url=${encodeURIComponent(text)}`, { timeout: 20000, headers: melHeaders })
 const out = r.data?.result
 if (r.data?.status && out && (out.video_nowm || (Array.isArray(out.slides) && out.slides.length))) {
const caption = createCaption(out.description || 'No disponible', { nickname: 'TikTok', unique_id: 'tiktok' }, 'No disponible')
if (Array.isArray(out.slides) && out.slides.length) {
const medias = out.slides.slice(0, 10).map(s => ({ type: 'image', data: { url: s.url }, caption }))
await conn.sendSylphy(m.chat, medias, { quoted: m })
if (out.audio_url) {
await conn.sendMessage(m.chat, { audio: { url: out.audio_url }, mimetype: 'audio/mp4', fileName: 'tiktok_audio.mp4' }, { quoted: m })
}
await m.react('✔️')
return
}
if (out.video_nowm) {
await conn.sendMessage(m.chat, { video: { url: out.video_nowm }, caption }, { quoted: m })
await m.react('✔️')
return
}
}
} catch {}
}
const res = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(text)}?hd=1`)
const data = res.data?.data;
if (!data?.play) return conn.reply(m.chat, 'ꕥ Enlace inválido o sin contenido descargable.', m)
const { title, duration, author, created_at, type, images, music, play } = data
const caption = createCaption(title, author, duration, created_at)
if (type === 'image' && Array.isArray(images)) {
const medias = images.map(url => ({ type: 'image', data: { url }, caption }));
await conn.sendSylphy(m.chat, medias, { quoted: m })
if (music) {
await conn.sendMessage(m.chat, { audio: { url: music }, mimetype: 'audio/mp4', fileName: 'tiktok_audio.mp4' }, { quoted: m })
}} else {
await conn.sendMessage(m.chat, { video: { url: play }, caption }, { quoted: m })
}} else {
  const melApi = global.APIs.MelodyApi
  const mel = (typeof melApi?.url === 'string' ? melApi.url : '').trim().replace(/\/+$/, '')
  const melKey = (typeof melApi?.key === 'string' ? melApi.key : '').trim()
  const melHeaders = melKey ? { 'x-api-key': melKey } : {}
 if (mel) {
 try {
 const r = await axios.get(`${mel}/search/tiktok?q=${encodeURIComponent(text)}`, { timeout: 20000, headers: melHeaders })
 const results = Array.isArray(r.data?.result) ? r.data.result.filter(v => v.play) : []
 if (r.data?.status && results.length >= 2) {
const medias = results.slice(0, 10).map(v => ({ type: 'video', data: { url: v.play }, caption: createSearchCaption(v) }))
await conn.sendSylphy(m.chat, medias, { quoted: m })
await m.react('✔️')
return
}
} catch {}
}
const res = await axios({ method: 'POST', url: 'https://tikwm.com/api/feed/search', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'Cookie': 'current_language=en', 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36' }, data: { keywords: text, count: 20, cursor: 0, HD: 1 }})
const results = res.data?.data?.videos?.filter(v => v.play) || []
if (results.length < 2) return conn.reply(m.chat, 'ꕥ Se requieren al menos 2 resultados válidos con contenido.', m)
const medias = results.slice(0, 10).map(v => ({ type: 'video', data: { url: v.play }, caption: createSearchCaption(v) }))
await conn.sendSylphy(m.chat, medias, { quoted: m })
}
await m.react('✔️')
} catch (e) {
await m.react('✖️')
await conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${e.message}`, m)
}}
function createCaption(title, author, duration, created_at = '') {
  return `❀ *Título ›* \`${title || 'No disponible'}\`\n> ☕︎ Autor › *${author?.nickname || author?.unique_id || 'No disponible'}*\n> ✰ Duración › *${duration || 'No disponible'}s*${created_at ? `\n> ☁︎ Creado » ${created_at}` : ''}\n> 𝅘𝅥𝅮 Música » [${author?.nickname || author?.unique_id || 'No disponible'}] original sound - ${author?.unique_id || 'unknown'}`
}
function createSearchCaption(data) {
  return `❀ Título › ${data.title || 'No disponible'}\n\n☕︎ Autor › ${data.author?.nickname || 'Desconocido'} ${data.author?.unique_id ? `@${data.author.unique_id}` : ''}\n✧︎ Duración › ${data.duration || 'No disponible'}\n𝅘𝅥𝅮 Música › ${data.music?.title || `[${data.author?.nickname || 'No disponible'}] original sound - ${data.author?.unique_id || 'unknown'}`}`
}

handler.help = ['tiktok', 'tt']
handler.tags = ['downloader']
handler.command = ['tiktok', 'tt', 'tiktoks', 'tts']
handler.group = true

export default handler
