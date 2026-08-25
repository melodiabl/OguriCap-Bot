import axios from 'axios'

const handler = async (m, { conn, text, usedPrefix }) => {
if (!text) return conn.reply(m.chat, '❀ Por favor, ingresa un término de búsqueda o el enlace de TikTok.', m)
const isUrl = /(?:https:?\/{2})?(?:www\.|vm\.|vt\.|t\.)?tiktok\.com\/([^\s&]+)/gi.test(text)
try {
await m.react('🕒')
if (isUrl) {
 let response = null
 try {
 const mel = global.APIs.MelodyApi
 const api = await axios.get(`${mel.url}/download/tiktok`, { params: { url: text }, headers: mel.key ? { 'x-api-key': mel.key } : {}, timeout: 25_000 })
 if (api.data?.status && api.data?.result) response = { source: 'melodia', result: api.data.result }
 } catch {}
 if (!response) {
 const legacy = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(text)}&hd=1`, { timeout: 20_000 })
 response = { source: 'legacy', result: legacy.data?.data }
 }
 const out = response.result
 if (response.source === 'melodia' && out && (out.video_nowm || out.video || (Array.isArray(out.slides) && out.slides.length))) {
const caption = createTikTokCaption(out, text)
if (Array.isArray(out.slides) && out.slides.length) {
const medias = out.slides.slice(0, 10).map(s => ({ type: 'image', data: { url: s.url }, caption }))
await conn.sendSylphy(m.chat, medias, { quoted: m })
if (out.audio_url) {
await conn.sendMessage(m.chat, { audio: { url: out.audio_url }, mimetype: 'audio/mp4', fileName: 'tiktok_audio.mp4' }, { quoted: m })
}
await m.react('✔️')
return
}
if (out.video_nowm || out.video) {
await conn.sendMessage(m.chat, { video: { url: out.video_nowm || out.video }, caption }, { quoted: m })
await m.react('✔️')
return
}
}
const data = out;
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
 let response = null
 try {
 const mel = global.APIs.MelodyApi
 const api = await axios.get(`${mel.url}/search/tiktok`, { params: { q: text }, headers: mel.key ? { 'x-api-key': mel.key } : {}, timeout: 25_000 })
 if (api.data?.status && Array.isArray(api.data?.result)) response = { source: 'melodia', result: api.data.result }
 } catch {}
 if (!response) {
 const legacy = await axios({ method: 'POST', url: 'https://tikwm.com/api/feed/search', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'Cookie': 'current_language=en', 'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36' }, data: { keywords: text, count: 20, cursor: 0, HD: 1 }, timeout: 20_000 })
 response = { source: 'legacy', result: legacy.data?.data?.videos || [] }
 }
 const results = Array.isArray(response.result) ? response.result.filter(v => v.play) : []
 if (results.length >= 2) {
const medias = results.slice(0, 10).map(v => ({ type: 'video', data: { url: v.play }, caption: createSearchCaption(v) }))
await conn.sendSylphy(m.chat, medias, { quoted: m })
await m.react('✔️')
return
}
if (results.length < 2) return conn.reply(m.chat, 'ꕥ Se requieren al menos 2 resultados válidos con contenido.', m)
}
await m.react('✔️')
} catch (e) {
await m.react('✖️')
await conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${e.message}`, m)
}}
function createCaption(title, author, duration, created_at = '') {
  return `❀ *Título ›* \`${title || 'No disponible'}\`\n> ☕︎ Autor › *${author?.nickname || author?.unique_id || 'No disponible'}*\n> ✰ Duración › *${duration || 'No disponible'}s*${created_at ? `\n> ☁︎ Creado » ${created_at}` : ''}\n> 𝅘𝅥𝅮 Música » [${author?.nickname || author?.unique_id || 'No disponible'}] original sound - ${author?.unique_id || 'unknown'}`
}
export function createTikTokCaption(data = {}, sourceUrl = '') {
  const number = value => Number(value || 0).toLocaleString('es-ES')
  const author = data.author || {}
  const stats = data.stats || {}
  const date = data.created_at
    ? new Date(Number(data.created_at) * 1000).toLocaleDateString('es-ES')
    : 'No disponible'
  const music = data.music || {}
  const audio = music.title
    ? `${music.title}${music.author ? ` — ${music.author}` : ''}`
    : `${author.nickname || author.unique_id || 'TikTok'} original sound`
  return `ㅤ۟∩　ׅ　★ ໌　ׅ　🅣𝗂𝗄𝖳𝗈𝗄 🅓ownload　ᰙ

𖣣ֶㅤ֯⌗ ✿ ⬭ Título: ${data.title || data.description || 'No disponible'}
𖣣ֶㅤ֯⌗ ★ ⬭ Autor: ${author.nickname || 'Desconocido'}${author.unique_id ? ` (@${author.unique_id})` : ''}
𖣣ֶㅤ֯⌗ ❖ ⬭ Duración: ${data.duration ? `${data.duration}s` : 'No disponible'}
𖣣ֶㅤ֯⌗ ◷ ⬭ Publicado: ${date}
𖣣ֶㅤ֯⌗ ♡ ⬭ Likes: ${number(stats.likes)}
𖣣ֶㅤ֯⌗ ꕥ ⬭ Comentarios: ${number(stats.comments)}
𖣣ֶㅤ֯⌗ ❒ ⬭ Vistas: ${number(stats.views)}
𖣣ֶㅤ֯⌗ ☄︎ ⬭ Compartidos: ${number(stats.shares)}
𖣣ֶㅤ֯⌗ ❍ ⬭ Enlace: ${sourceUrl || 'No disponible'}
𖣣ֶㅤ֯⌗ ❖ ⬭ Audio: ${audio}`
}
function createSearchCaption(data) {
  return `❀ Título › ${data.title || 'No disponible'}\n\n☕︎ Autor › ${data.author?.nickname || 'Desconocido'} ${data.author?.unique_id ? `@${data.author.unique_id}` : ''}\n✧︎ Duración › ${data.duration || 'No disponible'}\n𝅘𝅥𝅮 Música › ${data.music?.title || `[${data.author?.nickname || 'No disponible'}] original sound - ${data.author?.unique_id || 'unknown'}`}`
}

handler.help = ['tiktok', 'tt']
handler.tags = ['downloader']
handler.command = ['tiktok', 'tt', 'tiktoks', 'tts']
handler.group = true

export default handler
