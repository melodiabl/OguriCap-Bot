// HD/enhance local con sharp: los servicios externos de upscale (Siputzx/Vreden)
// murieron; procesar localmente es más rápido y no expone la imagen a terceros.
import sharp from 'sharp'

const MAX_DIM = 2048

const handler = async (m, { conn, usedPrefix }) => {
const q = m.quoted || m
const mime = (q.msg || q).mimetype || q.mediaType || ''
if (!mime) return conn.reply(m.chat, '❀ Por favor, responde a una imagen con el comando.', m)
if (!/image\/(jpe?g|png|webp)/.test(mime)) return conn.reply(m.chat, `ꕥ Formato no compatible (${mime}). Usa una imagen jpg o png.`, m)
const buffer = await q.download()
if (!buffer || buffer.length < 1000) return conn.reply(m.chat, '⚠︎ Imagen no válida.', m)
await m.react('🕒')
try {
const img = sharp(buffer, { failOn: 'none' })
const meta = await img.metadata()
const w = meta.width || 512
const h = meta.height || 512
// Escalar 2x sin pasar el límite (WhatsApp no necesita más de 2048px)
const scale = Math.min(2, MAX_DIM / Math.max(w, h))
const targetW = Math.max(w, Math.round(w * scale))
const result = await img
.resize({ width: targetW, kernel: 'lanczos3', withoutEnlargement: false })
.sharpen({ sigma: 1.1 })
.jpeg({ quality: 95, mozjpeg: true })
.toBuffer()
await conn.sendFile(m.chat, result, 'imagen.jpg', `❀ Imagen mejorada (${w}x${h} → ${targetW}px)`, m)
await m.react('✔️')
} catch (err) {
await m.react('✖️')
await conn.reply(m.chat, `⚠︎ No se pudo mejorar la imagen\n> Usa ${usedPrefix}report para informarlo\n\n${err.message}`, m)
}}

handler.command = ['hd', 'remini', 'enhance']
handler.help = ['hd']
handler.tags = ['tools']

export default handler
