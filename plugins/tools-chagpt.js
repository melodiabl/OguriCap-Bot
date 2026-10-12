import FormData from "form-data"
import { fileTypeFromBuffer } from "file-type"
import axios from "axios"
import fetch from "node-fetch"

const handler = async (m, { conn, command, usedPrefix, text, args }) => {
try {
const q = m.quoted ? m.quoted : m
const mime = (q.msg || q).mimetype || ''
const username = global.db?.data?.users?.[m.sender]?.name || await conn.getName(m.sender).catch(() => 'amigo') || 'amigo'
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
const basePrompt = `Tu nombre es ${global.botname || 'OguriCap'}, creada por ${global.etiqueta || 'Melodia'}. Tu versión es ${global.vs || 'actual'}. Responde en español, de forma clara y amigable. Hablas con ${username}.`
const output = await askAI(text, { system: basePrompt })
if (!output) throw new Error('La IA no respondió')
await conn.sendMessage(m.chat, { text: output }, { quoted: m })
await m.react('✔️')
break
}
case 'luminai': case 'gemini': case 'bard': {
if (!text) return conn.reply(m.chat, `❀ Ingrese una petición.`, m)
await m.react('🕒')
// MelodiaAPI primero; proveedor independiente como respaldo.
const output = await askAI(text)
if (!output) throw new Error(`Respuesta inválida de ${command}`)
await conn.sendMessage(m.chat, { text: output }, { quoted: m })
await m.react('✔️')
break
}
case 'iavoz': case 'aivoz': case 'vozia': {
if (!text) return conn.reply(m.chat, `❀ Ingrese lo que desea decirle a la inteligencia artificial con voz`, m)
await m.react('🕒')
// Respuesta compartida de IA y voz con Google TTS.
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
return await conn.reply(m.chat, '❀ No pude responder ahora. Inténtalo de nuevo en unos momentos.', m)
}}

handler.command = ['gemini', 'bard', 'openai', 'dalle', 'flux', 'ia', 'chatgpt', 'luminai', 'iavoz']
handler.help = ['gemini', 'bard', 'openai', 'dalle', 'flux', 'ia', 'chatgpt', 'luminai', 'iavoz', 'aivoz', 'vozia']
handler.tags = ['tools']
handler.group = true

export default handler

function validAiText(value, contentType = '') {
 if (typeof value !== 'string' || /text\/html/i.test(contentType)) return null
 const text = value.trim()
 if (!text || text.length > 32000 || /^(?:<!doctype\s+html|<html\b)/i.test(text)) return null
 return text
}

// La clave de MelodiaAPI se utiliza únicamente en el proveedor principal.
async function askAI(text, { system = 'Responde en español, claro y conciso.' } = {}) {
 const content = String(text || '').trim()
 if (!content || content.length > 4000) return null
 const mel = global.APIs?.MelodyApi
 if (mel?.url) {
  try {
   const response = await axios.get(`${mel.url.replace(/\/+$/, '')}/ai/openai`, {
    params: { text: content, system }, headers: mel.key ? { 'x-api-key': mel.key } : {},
    timeout: 20000, proxy: false, maxContentLength: 512 * 1024
   })
   const output = response.data?.status === true ? validAiText(response.data.result, response.headers?.['content-type']) : null
   if (output) return output
  } catch (error) {
   console.warn('[AI_PROVIDER]', JSON.stringify({ provider: 'MelodiaAPI', status: error.response?.status || null }))
  }
 }
 try {
  const prompt = `${system}\n\nUsuario: ${content}`
  if (encodeURIComponent(prompt).length > 14000) return null
  const response = await axios.get(`https://text.pollinations.ai/${encodeURIComponent(prompt)}`, {
   params: { private: true }, timeout: 20000, proxy: false,
   responseType: 'text', maxContentLength: 512 * 1024
  })
  return validAiText(response.data, response.headers?.['content-type'])
 } catch (error) {
  console.warn('[AI_PROVIDER]', JSON.stringify({ provider: 'Pollinations', status: error.response?.status || null }))
 }
 return null
}

const fluximg = { defaultRatio: "2:3", create: async (query) => {
const config = { headers: { accept: "*/*", authority: "1yjs1yldj7.execute-api.us-east-1.amazonaws.com", "user-agent": "Postify/1.0.0" }}
const url = `https://1yjs1yldj7.execute-api.us-east-1.amazonaws.com/default/ai_image?prompt=${encodeURIComponent(query)}&aspect_ratio=${fluximg.defaultRatio}`
const res = await axios.get(url, config)
return { imageLink: res.data.image_link }
}}
