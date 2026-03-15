import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import mime from 'mime-types'
import { classifyProviderLibraryContent } from './provider-content-classifier.js'

function safeString(v) {
  if (v === null || typeof v === 'undefined') return ''
  if (typeof v === 'string') return v
  return String(v)
}

function sanitizeFilename(name) {
  const base = path.basename(safeString(name || 'file'))
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '_')
  return cleaned || 'file'
}

function sanitizePathSegment(name) {
  const cleaned = safeString(name || '').replace(/[^a-zA-Z0-9._-]/g, '_')
  return cleaned || 'x'
}

function detectRelationshipCategory(text) {
  const hay = safeString(text).toLowerCase()
  if (!hay) return 'other'
  if (/\b(bl|yaoi|boys[\s_-]?love|shounen[\s_-]?ai)\b/i.test(hay)) return 'bl'
  if (/\b(hetero|straight)\b/i.test(hay)) return 'hetero'
  return 'other'
}

function parseTitleAndChapter(filename) {
  const base = safeString(filename || '').replace(/\.[a-z0-9]+$/i, '')
  const cleaned = base
    .replace(/[_\.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\[[^\]]+\]|\([^\)]+\)|\{[^\}]+\}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const patterns = [
    /\bcap(?:itulo)?\s*0*(\d{1,4})\b/i,
    /\bch(?:apter)?\s*0*(\d{1,4})\b/i,
    /\bep(?:isode)?\s*0*(\d{1,4})\b/i,
    /\b(?:c|ch)\s*0*(\d{1,4})\b/i,
  ]

  let chapter = null
  let title = cleaned
  for (const rx of patterns) {
    const m = rx.exec(cleaned)
    if (m) {
      chapter = m[1]
      title = cleaned.replace(m[0], ' ').replace(/\s+/g, ' ').trim()
      break
    }
  }

  return {
    title: title || base || 'Sin título',
    chapter: chapter ? String(Number(chapter)) : null,
  }
}

function unwrapMessage(message) {
  if (!message || typeof message !== 'object') return message
  if (message.ephemeralMessage?.message) return unwrapMessage(message.ephemeralMessage.message)
  if (message.viewOnceMessageV2?.message) return unwrapMessage(message.viewOnceMessageV2.message)
  if (message.viewOnceMessage?.message) return unwrapMessage(message.viewOnceMessage.message)
  if (message.documentWithCaptionMessage?.message) return unwrapMessage(message.documentWithCaptionMessage.message)
  return message
}

function ensurePanelStructures() {
  if (!global.db?.data) return null
  const panel = (global.db.data.panel ||= {})
  panel.proveedores ||= {}
  panel.contentLibrary ||= {}
  panel.contentLibraryCounter ||= 0
  panel.systemConfig ||= { fileUploadLimit: 10 }
  return panel
}

function nextId(panel, counterKey) {
  const next = Number(panel?.[counterKey] || 0) + 1
  panel[counterKey] = next
  return next
}

function normalizeAllowedTypes(arr) {
  if (!Array.isArray(arr)) return []
  return arr.map((x) => safeString(x).trim().toUpperCase()).filter(Boolean)
}

function shouldCaptureByExtension(proveedor, originalName) {
  let allowed = normalizeAllowedTypes(proveedor?.tipos_archivo)
  if (!allowed.length) return true
  if (allowed.includes('*') || allowed.includes('ALL')) return true

  // Compat: muchos proveedores se crean con default ["PDF","EPUB"] pero esperan capturar manhwa (imágenes/videos).
  // Si no se configuró explícitamente, ampliar a formatos comunes.
  const isDefaultRestricted =
    allowed.length === 2 &&
    allowed.includes('PDF') &&
    allowed.includes('EPUB')
  if (isDefaultRestricted) {
    allowed = [
      ...allowed,
      'JPG', 'JPEG', 'PNG', 'WEBP',
      'MP4',
      'ZIP', 'RAR', '7Z',
      'CBZ', 'CBR',
    ]
  }

  const ext = path.extname(originalName || '').replace('.', '').trim().toUpperCase()
  if (!ext) return false
  return allowed.includes(ext)
}

function getCaptureLimitBytes(panel) {
  const configured = Number(process.env.PANEL_PROVIDER_CAPTURE_LIMIT_MB || NaN)
  const fallback = 80
  const maxMb = Number.isFinite(configured)
    ? Math.min(Math.max(configured, 1), 500)
    : fallback
  return Math.floor(maxMb * 1024 * 1024)
}

function markSeen(messageId) {
  global.__providerCaptureSeen ||= new Map()
  const seen = global.__providerCaptureSeen
  const now = Date.now()
  seen.set(messageId, now)
  if (seen.size > 2000) {
    const minTs = now - 6 * 60 * 60 * 1000
    for (const [k, ts] of seen.entries()) {
      if (ts < minTs) seen.delete(k)
    }
    if (seen.size > 3000) {
      for (const k of seen.keys()) {
        seen.delete(k)
        if (seen.size <= 1500) break
      }
    }
  }
}

function wasSeen(messageId) {
  const seen = global.__providerCaptureSeen
  if (!seen) return false
  return seen.has(messageId)
}

async function saveLibraryRecord({ proveedor, panel, filePath, urlPath, originalName, mimeType, format, size, meta }) {
  const id = nextId(panel, 'contentLibraryCounter')
  const now = new Date().toISOString()

  const record = {
    id,
    proveedorJid: proveedor.jid,
    proveedorNombre: proveedor.nombre || proveedor.jid,
    category: meta.category,
    title: meta.title,
    chapter: meta.chapter,
    season: typeof meta?.season !== 'undefined' ? meta.season : null,
    tags: Array.isArray(meta?.tags) ? meta.tags : [],
    ai: meta?.ai || null,
    originalName,
    filename: path.basename(filePath),
    url: urlPath,
    format,
    size,
    mimeType,
    uploadedBy: meta.uploadedBy || 'whatsapp',
    uploadedAt: now,
    source: meta.source || 'whatsapp',
    message: meta.message || null,
    file_path: filePath,
  }

  panel.contentLibrary[id] = record

  if (global.db?.write) {
    try {
      await global.db.write()
    } catch {}
  }

  return record
}

async function captureOneMessage(conn, msg) {
  const enabledRaw = safeString(process.env.PANEL_PROVIDER_CAPTURE_ENABLED || '1').toLowerCase()
  const enabled = !['0', 'false', 'no', 'off'].includes(enabledRaw)
  if (!enabled) return
  const includeFromMeRaw = safeString(process.env.PANEL_PROVIDER_CAPTURE_INCLUDE_FROM_ME || '0').toLowerCase()
  const includeFromMe = ['1', 'true', 'yes', 'on'].includes(includeFromMeRaw)

  await (typeof global.loadDatabase === 'function' ? global.loadDatabase().catch(() => {}) : Promise.resolve())
  const panel = ensurePanelStructures()
  if (!panel) return

  const remoteJid = safeString(msg?.key?.remoteJid)
  if (!remoteJid || !remoteJid.endsWith('@g.us')) return
  if (msg?.key?.fromMe && !includeFromMe) return

  const proveedor = panel?.proveedores?.[remoteJid] || null
  if (!proveedor) return
  if (safeString(proveedor?.estado || 'activo') !== 'activo') return

  const messageId = safeString(msg?.key?.id)
  if (messageId && wasSeen(messageId)) return
  if (messageId) markSeen(messageId)

  const unwrapped = unwrapMessage(msg?.message)
  if (!unwrapped || typeof unwrapped !== 'object') return

  const doc = unwrapped.documentMessage || null
  const image = unwrapped.imageMessage || null
  const video = unwrapped.videoMessage || null
  const audio = unwrapped.audioMessage || null

  const picked =
    doc ? { kind: 'document', content: doc } :
      image ? { kind: 'image', content: image } :
        video ? { kind: 'video', content: video } :
          audio ? { kind: 'audio', content: audio } :
            null

  if (!picked) return

  const content = picked.content
  const kind = picked.kind

  const caption = safeString(content?.caption || '')
  const rawName =
    safeString(content?.fileName || '') ||
    (caption ? `${caption}` : '') ||
    `${kind}_${Date.now()}`

  let originalName = sanitizeFilename(rawName)
  const extPresent = path.extname(originalName)
  if (!extPresent) {
    const m = safeString(content?.mimetype || mime.lookup(originalName) || '')
    const extGuess = safeString(mime.extension(m) || '').toLowerCase()
    if (extGuess) originalName = sanitizeFilename(`${originalName}.${extGuess}`)
  }
  if (!shouldCaptureByExtension(proveedor, originalName)) return

  const maxBytes = getCaptureLimitBytes(panel)
  const fileLength = Number(content?.fileLength || 0)
  if (Number.isFinite(fileLength) && fileLength > 0 && fileLength > maxBytes) return

  if (!conn?.downloadM || typeof conn.downloadM !== 'function') return

  let buffer
  try {
    buffer = await conn.downloadM(content, kind)
  } catch {
    return
  }
  if (!buffer || !Buffer.isBuffer(buffer) || !buffer.length) return
  if (buffer.length > maxBytes) return

  const resolvedMime = safeString(content?.mimetype || mime.lookup(originalName) || 'application/octet-stream')
  const ext = path.extname(originalName).replace('.', '').toLowerCase()
  const format = ext || safeString(resolvedMime.split('/')[1] || 'bin')

  const category = detectRelationshipCategory(`${originalName} ${caption}`)
  const parsed = parseTitleAndChapter(originalName)
  let title = parsed.title
  let chapter = parsed.chapter
  let season = null
  let finalCategory = category
  let tags = []
  let ai = null
  try {
    const classified = await classifyProviderLibraryContent({ filename: originalName, caption, provider: proveedor })
    if (classified?.title) title = classified.title
    if (typeof classified?.chapter !== 'undefined') chapter = classified.chapter
    if (typeof classified?.season !== 'undefined') season = classified.season
    if (classified?.category) finalCategory = classified.category
    tags = Array.isArray(classified?.tags) ? classified.tags : []
    ai = {
      source: classified?.source || 'heuristic',
      model: classified?.model || null,
      provider: classified?.provider || null,
      confidence: classified?.confidence || null,
    }
  } catch {}

  const providerSeg = sanitizePathSegment(proveedor.jid || 'provider')
  const categorySeg = sanitizePathSegment(finalCategory)
  const titleSeg = sanitizePathSegment(title).slice(0, 80)
  const unique = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}_${originalName}`

  const libraryRoot = path.join(process.cwd(), 'storage', 'library')
  const fileRelParts = [providerSeg, categorySeg, titleSeg, unique]
  const filePath = path.join(libraryRoot, ...fileRelParts)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, buffer)

  const urlPath = `/library/${fileRelParts.map((s) => encodeURIComponent(String(s))).join('/')}`

  await saveLibraryRecord({
    proveedor,
    panel,
    filePath,
    urlPath,
    originalName,
    mimeType: resolvedMime,
    format,
    size: buffer.length,
    meta: {
      category: finalCategory,
      title,
      chapter,
      season,
      tags,
      ai,
      uploadedBy: 'whatsapp',
      source: 'whatsapp',
      message: {
        id: messageId || null,
        groupJid: remoteJid,
        participant: safeString(msg?.key?.participant || null),
        timestamp: msg?.messageTimestamp ? Number(msg.messageTimestamp) : null,
      },
    },
  })
}

export function createProviderMediaCaptureHandler(conn) {
  return async function providerMediaCaptureHandler(upsert) {
    try {
      const msgs = Array.isArray(upsert?.messages) ? upsert.messages : []
      for (const msg of msgs) {
        await captureOneMessage(conn, msg)
      }
    } catch {}
  }
}
