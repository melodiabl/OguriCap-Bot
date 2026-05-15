import { createRequire } from 'module'
import { Jimp, JimpMime } from 'jimp'

const _require = createRequire(import.meta.url)

async function generateProfilePicture(mediaUpload) {
  let buffer
  if (Buffer.isBuffer(mediaUpload)) {
    buffer = mediaUpload
  } else if (mediaUpload && 'url' in mediaUpload) {
    const fetch = (await import('node-fetch')).default
    const res = await fetch(mediaUpload.url.toString())
    buffer = Buffer.from(await res.arrayBuffer())
  } else if (mediaUpload && mediaUpload.stream) {
    const chunks = []
    for await (const chunk of mediaUpload.stream) chunks.push(chunk)
    buffer = Buffer.concat(chunks)
  } else {
    buffer = mediaUpload
  }

  const img = await Jimp.read(buffer)
  const w = img.width
  const h = img.height
  const resized = w > h ? img.resize({ w: 550 }) : img.resize({ h: 650 })
  const processedImg = await resized.getBuffer(JimpMime.jpeg)

  return { img: processedImg }
}

// The Utils barrel uses read-only getters that delegate to messages-media.js exports.
// Patching the source module is sufficient — the getter always reads from it.
const messagesMedia = _require('baileys/lib/Utils/messages-media')
messagesMedia.generateProfilePicture = generateProfilePicture
