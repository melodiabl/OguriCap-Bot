import fs from 'fs'
import path from 'path'
import { classifyProviderLibraryContent } from '../lib/provider-content-classifier.js'

const MEDIA_TYPE_MAP = {
  imageMessage: 'image',
  videoMessage: 'video',
  audioMessage: 'audio',
  documentMessage: 'document',
  stickerMessage: 'sticker',
}

const safeString = (v) => (v == null ? '' : typeof v === 'string' ? v : String(v))

const clampInt = (value, { min, max, fallback }) => {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(Math.floor(n), min), max)
}

const normalizeSeason = (value) => {
  const raw = safeString(value).trim()
  if (!raw) return null
  const m = raw.match(/(\d{1,2})/)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n <= 0) return null
  return String(n)
}

const normalizeChapter = (value) => {
  const raw = safeString(value).trim()
  if (!raw) return null
  const m = raw.match(/(\d{1,4})/)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n <= 0) return null
  return String(n)
}

const sanitizePathSegment = (input, maxLen = 60) => {
  const s = safeString(input)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/[^a-zA-Z0-9 _.-]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
  const trimmed = s.slice(0, Math.max(1, maxLen)).trim()
  return trimmed || 'sin_titulo'
}

const sanitizeFilename = (input) =>
  safeString(input)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 140)

const oneLine = (v) => safeString(v).replace(/\s+/g, ' ').trim()

const truncateText = (v, max = 140) => {
  const s = oneLine(v)
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

const waSafeInline = (v) => oneLine(v).replace(/[*_~`]/g, '').trim()

const ensureStore = () => {
  if (!global.db.data.aportes) global.db.data.aportes = []
  if (!global.db.data.aportesCounter) {
    const lastId = global.db.data.aportes.reduce((max, item) => Math.max(max, item?.id || 0), 0)
    global.db.data.aportesCounter = lastId + 1
  }
}

const ensureMediaDir = (...segments) => {
  const base = path.join(process.cwd(), 'storage', 'media', 'aportes')
  const dir = segments?.length ? path.join(base, ...segments) : base
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

const formatDate = (value) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toISOString().slice(0, 10)
}

const inferTipo = ({ tipo, media } = {}) => {
  const rawTipo = safeString(tipo).toLowerCase().trim()
  if (rawTipo && rawTipo !== 'extra') return rawTipo

  const mime = safeString(media?.mimetype || '').toLowerCase()
  if (mime.startsWith('image/')) return 'imagen'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  if (mime) return 'documento'
  return 'extra'
}

const formatEntry = (entry, index, showUser) => {
  const id = entry?.id ?? index
  const idCode = `\`\`\`#${safeString(id)}\`\`\``
  const titulo = waSafeInline(entry?.titulo || '') || truncateText(entry?.contenido || '(sin título)', 48)
  const contenido = truncateText(entry?.contenido || '-', 90)
  const fecha = formatDate(entry?.fecha || entry?.fecha_creacion || entry?.created_at)
  const estado = waSafeInline(entry?.estado || 'pendiente')
  const tipo = waSafeInline(entry?.tipo || 'extra')
  const temporada = waSafeInline(entry?.temporada || '')
  const capitulo = waSafeInline(entry?.capitulo || '')
  const usuario = safeString(entry?.usuario || '-')
  const archivo = waSafeInline(entry?.archivoNombre || '')

  const lines = []
  lines.push(`📌 *Aporte* ${idCode}`)
  lines.push(`> *Título:* ${titulo}`)
  lines.push(`> *Tipo:* _${tipo}_`)
  if (temporada) lines.push(`> *Temporada:* _${temporada}_`)
  if (capitulo) lines.push(`> *Capítulo:* _${capitulo}_`)
  lines.push(`> *Estado:* _${estado}_`)
  lines.push(`> *Fecha:* _${fecha}_`)
  if (showUser) lines.push(`> *Usuario:* ${usuario}`)
  lines.push(`> *Contenido:* ${contenido}`)
  if (archivo) lines.push(`> *Archivo:* _${archivo}_`)
  return lines.join('\n')
}

const detectMedia = (m) => {
  try {
    const q = m?.quoted ? m.quoted : m
    const mediaMessage = q?.mediaMessage && typeof q.mediaMessage === 'object' ? q.mediaMessage : null
    if (!mediaMessage) return null

    const key = Object.keys(mediaMessage)[0]
    const kind = MEDIA_TYPE_MAP[key]
    const content = mediaMessage[key]
    if (!kind || !content) return null

    const mimetype = content?.mimetype || ''
    const fileName = content?.fileName || content?.file_name || null

    return { kind, key, content, mimetype, fileName }
  } catch {
    return null
  }
}

const saveMedia = async (m, conn, { titulo = '', temporada = null, capitulo = null } = {}) => {
  const media = detectMedia(m)
  if (!media) return null

  try {
    const rawBuffer = await conn.downloadM(media.content, media.kind)
    if (!rawBuffer || !Buffer.isBuffer(rawBuffer) || rawBuffer.length === 0) return null

    let buffer = rawBuffer
    let mimetype = media.mimetype
    let filenameBase = (media.fileName ? sanitizeFilename(path.parse(safeString(media.fileName)).name) : '') || `aporte_${Date.now()}`
    let ext =
      mimetype?.split('/')[1]?.split(';')[0] ||
      (media.fileName ? safeString(media.fileName).split('.').pop() : null) ||
      (media.kind === 'image' ? 'jpg' : media.kind === 'video' ? 'mp4' : media.kind === 'audio' ? 'mp3' : 'bin')

    if (media.kind === 'sticker') {
      const { toImage } = await import('../lib/sticker.js')
      buffer = await toImage(rawBuffer)
      mimetype = 'image/png'
      ext = 'png'
      filenameBase = filenameBase.replace(/\.(webp|png|jpg|jpeg)$/i, '') || `aporte_${Date.now()}`
    }

    ext = safeString(ext || 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'bin'
    const seasonNum = normalizeSeason(temporada)
    const chapterNum = normalizeChapter(capitulo)
    const titleSeg = sanitizePathSegment(titulo || filenameBase, 60)
    const seasonSeg = `T${String(seasonNum || '0').padStart(2, '0')}`

    const chapterPrefix = chapterNum ? `c${String(chapterNum).padStart(4, '0')}_` : ''
    const finalBase = sanitizeFilename(`${chapterPrefix}${filenameBase}`.replace(/\s+/g, '_')).slice(0, 120) || `aporte_${Date.now()}`
    const filename = `${finalBase}.${ext}`

    const targetDir = ensureMediaDir(titleSeg, seasonSeg)
    const dest = path.join(targetDir, filename)
    fs.writeFileSync(dest, buffer)

    const urlParts = ['aportes', titleSeg, seasonSeg, filename].map((s) => encodeURIComponent(String(s)))
    return {
      path: path.relative(process.cwd(), dest),
      url: `/media/${urlParts.join('/')}`,
      mimetype,
      filename,
      size: buffer.length,
    }
  } catch (error) {
    console.error('Error guardando multimedia:', error)
    return null
  }
}

const aiEnhanceAporte = async ({ contenido, media, tipo }) => {
  const caption = safeString(contenido || '')
  const filename =
    safeString(media?.filename) ||
    safeString(media?.fileName) ||
    (caption ? `${caption}.txt` : '') ||
    (safeString(media?.mimetype) ? `aporte.${safeString(media.mimetype).split('/')[1]?.split(';')[0] || 'bin'}` : 'aporte.txt')
  const timeoutMs = clampInt(process.env.APORTES_AI_TIMEOUT_MS, { min: 800, max: 20000, fallback: 6000 })

  try {
    const result = await Promise.race([
      classifyProviderLibraryContent({ filename, caption, provider: { tipo: inferTipo({ tipo, media }) } }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), timeoutMs)),
    ])

    const title = oneLine(result?.title) || ''
    const tags = Array.isArray(result?.tags) ? result.tags.map((t) => oneLine(t)).filter(Boolean).slice(0, 10) : []
    const category = oneLine(result?.category) || ''
    const confidence = typeof result?.confidence === 'number' ? result.confidence : null
    const season = typeof result?.season !== 'undefined' ? normalizeSeason(result.season) : null
    const chapter = typeof result?.chapter !== 'undefined' ? normalizeChapter(result.chapter) : null

    return {
      titulo: title,
      descripcion: caption ? truncateText(caption, 220) : '',
      tags,
      categoria: category,
      temporada: season,
      capitulo: chapter,
      ai: {
        source: safeString(result?.source || 'heuristic'),
        model: safeString(result?.model || 'none'),
        provider: safeString(result?.provider || 'local'),
        confidence,
        updatedAt: new Date().toISOString(),
      },
    }
  } catch {
    return {
      titulo: '',
      descripcion: caption ? truncateText(caption, 220) : '',
      tags: [],
      categoria: '',
      temporada: null,
      capitulo: null,
      ai: {
        source: 'heuristic',
        model: 'none',
        provider: 'local',
        confidence: null,
        updatedAt: new Date().toISOString(),
      },
    }
  }
}

let handler = async (m, { args, usedPrefix, command, conn, isOwner }) => {
  ensureStore()
  const data = global.db.data
  const isBotOwner = Boolean(isOwner) || global.owner.map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net').includes(m.sender)

  switch (command) {
    case 'addaporte': {
      const raw = (args || []).join(' ').trim()
      const parts = raw.includes('|') ? raw.split('|').map(s => s.trim()) : [raw, 'extra', '']
      const contenido = parts[0] || ''
      const tipo = parts[1] || 'extra'
      const temporadaArg = parts[2] || ''
      const capituloArg = parts[3] || ''
      const detected = detectMedia(m)

      if (!contenido && !detected) {
        return m.reply(
          `🤖 *Aportes*\n\n` +
          `> *Crear aporte (texto):*\n` +
          `> \`\`\`${usedPrefix}addaporte texto | tipo | temporada(opcional) | capitulo(opcional)\`\`\`\n` +
          `> *Crear aporte (con adjunto):*\n` +
          `> _Envía o responde a un archivo y escribe el comando_\n\n` +
          `🛡️ _Formatos soportados: imagen, video, audio, documento, sticker_`
        )
      }

      const tipoFinal = inferTipo({ tipo, media: detected ? { mimetype: detected.mimetype } : null })
      const ai = await aiEnhanceAporte({
        contenido: contenido || '',
        media: detected ? { filename: detected.fileName, mimetype: detected.mimetype } : null,
        tipo: tipoFinal,
      })
      const tituloFinal = ai.titulo || truncateText(contenido || (detected?.fileName ? `Aporte: ${detected.fileName}` : 'Aporte'), 70)
      const temporadaFinal = normalizeSeason(temporadaArg) || normalizeSeason(ai?.temporada) || null
      const capituloFinal = normalizeChapter(capituloArg) || normalizeChapter(ai?.capitulo) || null

      const media = detected ? await saveMedia(m, conn, { titulo: tituloFinal, temporada: temporadaFinal, capitulo: capituloFinal }) : null

      const entry = {
        id: data.aportesCounter++,
        usuario: m.sender,
        grupo: m.isGroup ? m.chat : null,
        contenido: contenido || '(adjunto)',
        tipo: tipoFinal,
        titulo: tituloFinal,
        descripcion: ai.descripcion || '',
        tags: ai.tags || [],
        categoria: ai.categoria || null,
        temporada: temporadaFinal,
        capitulo: capituloFinal,
        ai: ai.ai || null,
        fecha: new Date().toISOString(),
        estado: 'pendiente',
        archivo: media?.url || null,
        archivoPath: media?.path || null,
        archivoMime: media?.mimetype || null,
        archivoNombre: media?.filename || null,
      }

      data.aportes.push(entry)
      if (global.db?.write) await global.db.write().catch(() => { })

      try {
        const { emitAporteCreated } = await import('../lib/socket-io.js')
        emitAporteCreated(entry)
      } catch { }

      const lines = []
      lines.push('🤖 *Aporte registrado*')
      lines.push('')
      lines.push(`> *ID:* \`\`\`#${entry.id}\`\`\``)
      lines.push(`> *Título:* ${waSafeInline(entry.titulo)}`)
      lines.push(`> *Tipo:* _${waSafeInline(entry.tipo)}_`)
      if (entry.temporada) lines.push(`> *Temporada:* _${waSafeInline(entry.temporada)}_`)
      if (entry.capitulo) lines.push(`> *Capítulo:* _${waSafeInline(entry.capitulo)}_`)
      lines.push(`> *Estado:* _pendiente_`)
      if (entry.archivoNombre) lines.push(`> *Archivo:* _${waSafeInline(entry.archivoNombre)}_`)
      if (Array.isArray(entry.tags) && entry.tags.length) lines.push(`> *Tags:* ${entry.tags.map(waSafeInline).filter(Boolean).join(', ')}`)
      if (entry.ai?.source) lines.push(`> *IA:* _${waSafeInline(entry.ai.source)}_`)
      lines.push('')
      lines.push('🛡️ _Queda en revisión por el staff._')
      return m.reply(lines.join('\n'))
    }

    case 'aportes': {
      const list = data.aportes
        .filter(item => !m.isGroup || item.grupo === m.chat)
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .slice(0, 20)

      if (!list.length) return m.reply('📦 *Aportes*\n\n🛡️ _No hay aportes registrados._')
      const msg = ['📦 *Aportes recientes*', '', ...list.map((entry, i) => formatEntry(entry, i + 1, !m.isGroup))].join('\n\n')
      return m.reply(msg)
    }

    case 'myaportes': {
      const list = data.aportes
        .filter(item => item.usuario === m.sender)
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        .slice(0, 10)

      if (!list.length) return m.reply('📦 *Mis aportes*\n\n🛡️ _Aún no tienes aportes registrados._')
      const msg = ['📦 *Mis aportes*', '', ...list.map((entry, i) => formatEntry(entry, i + 1, false))].join('\n\n')
      return m.reply(msg)
    }

    case 'organizaraportes': {
      if (!isBotOwner) return m.reply('❌ *No permitido*\n\n> _Solo el owner puede organizar los archivos._')

      const aportes = Array.isArray(data.aportes) ? data.aportes : []
      let moved = 0
      let skipped = 0
      let errors = 0

      for (const aporte of aportes) {
        try {
          if ((!aporte?.temporada || !aporte?.capitulo || !aporte?.titulo) && (aporte?.contenido || aporte?.archivoNombre)) {
            try {
              const classified = await classifyProviderLibraryContent({
                filename: safeString(aporte?.archivoNombre || aporte?.titulo || ''),
                caption: safeString(aporte?.contenido || ''),
                provider: { tipo: safeString(aporte?.tipo || '') },
              })
              if (!aporte?.titulo && classified?.title) aporte.titulo = classified.title
              if (!aporte?.temporada && typeof classified?.season !== 'undefined' && classified?.season) aporte.temporada = normalizeSeason(classified.season)
              if (!aporte?.capitulo && typeof classified?.chapter !== 'undefined' && classified?.chapter) aporte.capitulo = normalizeChapter(classified.chapter)
            } catch { }
          }

          const rel = safeString(aporte?.archivoPath || '').trim()
          if (!rel) {
            skipped += 1
            continue
          }

          const root = path.resolve(process.cwd(), 'storage', 'media')
          const abs = path.resolve(process.cwd(), rel)
          if (!abs.toLowerCase().startsWith(root.toLowerCase())) {
            skipped += 1
            continue
          }
          if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) {
            skipped += 1
            continue
          }

          const titleSeg = sanitizePathSegment(aporte?.titulo || 'sin_titulo', 60)
          const seasonNum = normalizeSeason(aporte?.temporada) || '0'
          const seasonSeg = `T${String(seasonNum).padStart(2, '0')}`
          const chapterNum = normalizeChapter(aporte?.capitulo)
          const chapterPrefix = chapterNum ? `c${String(chapterNum).padStart(4, '0')}_` : ''

          const parsed = path.parse(abs)
          const baseNoPrefix = parsed.name.replace(/^c\d{4}_/i, '')
          let desiredBase = sanitizeFilename(`${chapterPrefix}${baseNoPrefix}`.replace(/\s+/g, '_')).slice(0, 120) || `aporte_${aporte?.id || Date.now()}`
          let desiredFilename = `${desiredBase}${parsed.ext || ''}`

          const targetDir = ensureMediaDir(titleSeg, seasonSeg)
          let targetAbs = path.join(targetDir, desiredFilename)

          if (abs.toLowerCase() === targetAbs.toLowerCase()) {
            skipped += 1
            continue
          }

          if (fs.existsSync(targetAbs)) {
            desiredBase = sanitizeFilename(`${desiredBase}_id${aporte?.id || Date.now()}`).slice(0, 120)
            desiredFilename = `${desiredBase}${parsed.ext || ''}`
            targetAbs = path.join(targetDir, desiredFilename)
          }

          fs.renameSync(abs, targetAbs)

          aporte.archivoPath = path.relative(process.cwd(), targetAbs)
          aporte.archivoNombre = desiredFilename
          const urlParts = ['aportes', titleSeg, seasonSeg, desiredFilename].map((s) => encodeURIComponent(String(s)))
          aporte.archivo = `/media/${urlParts.join('/')}`
          moved += 1
        } catch (err) {
          errors += 1
        }
      }

      if (global.db?.write) await global.db.write().catch(() => { })
      return m.reply(
        `📁 *Organización de aportes*\n\n` +
        `> *Movidos:* _${moved}_\n` +
        `> *Sin cambios:* _${skipped}_\n` +
        `> *Errores:* _${errors}_`
      )
    }

    default:
      return null
  }
}

handler.help = ['addaporte', 'aportes', 'myaportes', 'organizaraportes']
handler.tags = ['tools']
handler.command = ['addaporte', 'aportes', 'myaportes', 'organizaraportes']

export default handler
