import FormData from "form-data"
import { fileTypeFromBuffer } from "file-type"
import axios from "axios"
import fetch from "node-fetch"

const handler = async (m, { conn, command, usedPrefix, text, args }) => {
try {
const q = m.quoted ? m.quoted : m
const mime = (q.msg || q).mimetype || ''
const username = await (async () => global.db.data.users[m.sender].name || (async () => { try { const n = await conn.getName(m.sender); return typeof n === 'string' && n.trim() ? n : m.sender.split('@')[0] } catch { return m.sender.split('@')[0] } })())()
switch (command) {
case 'dalle': {
if (!args[0]) return conn.reply(m.chat, `❀ Por favor, proporciona una descripción para generar la imagen.`, m)
const promptDalle = args.join(' ')
if (promptDalle.length < 5) return conn.reply(m.chat, `ꕥ La descripción es demasiado corta.`, m)
await m.react('🕒')
// eliasar-yt-api murió (500); usar el mismo generador que /flux (funciona).
const dalleResult = await fluximg.create(promptDalle)
if (!dalleResult?.imageLink) throw new Error('No se pudo generar la imagen')
await conn.sendMessage(m.chat, { image: { url: dalleResult.imageLink }, caption: `❀ *Resultados de:* ${promptDalle}` }, { quoted: m })
await m.react('✔️')
break
}
case 'flux': {
if (!text) return conn.reply(m.chat, `❀ Por favor, ingrese un término para generar la imagen`, m)
await m.react('🕒')
const result = await fluximg.create(text)
if (result?.imageLink) {
await conn.sendMessage(m.chat, { image: { url: result.imageLink }, caption: `❀ *Resultados de:* ${text}` }, { quoted: m })
await m.react('✔️')
} else throw new Error("No se pudo crear la imagen")
break
}
case 'ia': case 'chatgpt': case 'openai': {
if (!text) return conn.reply(m.chat, `❀ Ingrese una petición.`, m)
await m.react('🕒')
const basePrompt = `Tu nombre es ${botname} y parece haber sido creada por ${etiqueta}. Tu versión actual es ${vs}, Tú usas el idioma Español. Llamarás a las personas por su nombre ${username}, te gusta ser divertida, y te encanta aprender. Lo más importante es que debes ser amigable con la persona con la que estás hablando. ${username}`
const url = `${global.APIs.delirius.url}/ia/gptprompt?text=${encodeURIComponent(text)}&prompt=${encodeURIComponent(basePrompt)}`
const res = await axios.get(url)
if (!res.data?.status || !res.data?.data) throw new Error('Respuesta inválida de Delirius')
await conn.sendMessage(m.chat, { text: res.data.data }, { quoted: m })
await m.react('✔️')
break
}
case 'luminai': case 'gemini': case 'bard': {
if (!text) return conn.reply(m.chat, `❀ Ingrese una petición.`, m)
await m.react('🕒')
// zenzxz murió; usar MelodiaAPI (venicechat) con fallback a Delirius
const output = await askAI(text)
if (!output) throw new Error(`Respuesta inválida de ${command}`)
await conn.sendMessage(m.chat, { text: output }, { quoted: m })
await m.react('✔️')
break
}
case 'iavoz': case 'aivoz': case 'vozia': {
if (!text) return conn.reply(m.chat, `❀ Ingrese lo que desea decirle a la inteligencia artificial con voz`, m)
await m.react('🕒')
// adonix murió: respuesta vía MelodiaAPI/Delirius + voz con Google TTS
const answer = await askAI(`Responde en español, breve (máximo 2 frases): ${text}`)
if (!answer) throw new Error('La IA no respondió')
const ttsText = answer.slice(0, 190)
const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(ttsText)}&tl=es&client=tw-ob`
const response = await axios.get(ttsUrl, { responseType: 'arraybuffer', headers: { 'User-Agent': 'Mozilla/5.0' } })
await conn.sendMessage(m.chat, { audio: Buffer.from(response.data), mimetype: 'audio/mpeg', ptt: true }, { quoted: m })
await m.react('✔️')
break
}
}} catch (error) {
await m.react('✖️')
conn.reply(m.chat, `⚠︎ Se ha producido un problema.\n> Usa *${usedPrefix}report* para informarlo.\n\n${error.message}`, m)
}}

handler.command = ['gemini', 'bard', 'openai', 'dalle', 'flux', 'ia', 'chatgpt', 'luminai', 'iavoz']
handler.help = ['gemini', 'bard', 'openai', 'dalle', 'flux', 'ia', 'chatgpt', 'luminai', 'iavoz', 'aivoz', 'vozia']
handler.tags = ['tools']
handler.group = true

export default handler

// IA compartida: MelodiaAPI venicechat primero, Delirius como respaldo.
async function askAI(text) {
try {
const mel = (global.APIs?.MelodyApi?.url || '').replace(/\/+$/, '')
const melKey = global.APIs?.MelodyApi?.key || ''
if (mel) {
const r = await axios.get(`${mel}/ai/venicechat?text=${encodeURIComponent(text)}`, { timeout: 45000, headers: melKey ? { 'x-api-key': melKey } : {} })
if (r.data?.status && typeof r.data?.result === 'string' && r.data.result.trim()) return r.data.result.trim()
}
} catch {}
try {
const r = await axios.get(`${global.APIs.delirius.url}/ia/gptweb?text=${encodeURIComponent(text)}`, { timeout: 45000 })
const out = r.data?.data || r.data?.result || r.data?.response
if (typeof out === 'string' && out.trim()) return out.trim()
} catch {}
return null
}

const fluximg = { defaultRatio: "2:3", create: async (query) => {
const config = { headers: { accept: "*/*", authority: "1yjs1yldj7.execute-api.us-east-1.amazonaws.com", "user-agent": "Postify/1.0.0" }}
const url = `https://1yjs1yldj7.execute-api.us-east-1.amazonaws.com/default/ai_image?prompt=${encodeURIComponent(query)}&aspect_ratio=${fluximg.defaultRatio}`
const res = await axios.get(url, config)
return { imageLink: res.data.image_link }
}}
