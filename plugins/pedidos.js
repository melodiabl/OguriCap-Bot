import fs from 'fs'
import path from 'path'
import { classifyProviderLibraryContent } from '../lib/provider-content-classifier.js'
import { generatePedidoPDF } from '../lib/pedido-pdf.js'

const safeString = (v) => (v == null ? '' : typeof v === 'string' ? v : String(v))

const waSafeInline = (v) => safeString(v).replace(/\s+/g, ' ').replace(/[*_~`]/g, '').trim()

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

const parsePedido = (rawInput) => {
  const raw = safeString(rawInput).trim()
  if (!raw) return { ok: false, error: 'Pedido vacío' }

  const parts = raw.split('|').map((s) => safeString(s).trim()).filter(Boolean)
  const hasPipes = raw.includes('|') && parts.length >= 2

  let title = hasPipes ? (parts[0] || '') : raw
  let season = null
  let chapterFrom = null
  let chapterTo = null
  let prioridad = null
  const extra = []

  const parseSeasonFromText = (text) => {
    const t = safeString(text)
    const m = t.match(/\b(?:temporada|temp(?:orada)?|season|s|t)\s*0*(\d{1,2})\b/i)
    return m ? normalizeSeason(m[1]) : null
  }

  const parseChaptersFromText = (text) => {
    const t = safeString(text)
    const range = t.match(/\b(?:cap(?:itulo)?s?|ch(?:apter)?s?)\s*0*(\d{1,4})\s*(?:-|–|a)\s*0*(\d{1,4})\b/i)
    if (range) {
      const a = normalizeChapter(range[1])
      const b = normalizeChapter(range[2])
      if (a && b) return { from: a, to: b }
    }
    const single = t.match(/\b(?:cap(?:itulo)?|ch(?:apter)?|cap|ch)\s*0*(\d{1,4})\b/i)
    if (single) {
      const n = normalizeChapter(single[1])
      if (n) return { from: n, to: n }
    }
    return null
  }

  const parsePriority = (text) => {
    const v = safeString(text).toLowerCase().trim()
    if (v === 'alta' || v === 'media' || v === 'baja') return v
    return null
  }

  if (hasPipes) {
    const rest = parts.slice(1)
    for (const seg of rest) {
      const p = parsePriority(seg)
      if (p) {
        prioridad = p
        continue
      }
      const s = parseSeasonFromText(seg)
      if (s) season = s
      const ch = parseChaptersFromText(seg)
      if (ch) {
        chapterFrom = ch.from
        chapterTo = ch.to
      }
      if (!s && !ch) extra.push(seg)
    }
  } else {
    const s = parseSeasonFromText(raw)
    if (s) season = s
    const ch = parseChaptersFromText(raw)
    if (ch) {
      chapterFrom = ch.from
      chapterTo = ch.to
      // intentar recortar el título removiendo la parte del capítulo/temporada
      title = raw
        .replace(/\b(?:temporada|temp(?:orada)?|season|s|t)\s*0*\d{1,2}\b/gi, ' ')
        .replace(/\b(?:cap(?:itulo)?s?|ch(?:apter)?s?|cap|ch)\b[^0-9]*(\d{1,4})(\s*(?:-|–|a)\s*\d{1,4})?/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    }
  }

  title = safeString(title).trim()
  if (!title) return { ok: false, error: 'Falta el título' }

  const hasChapter = Boolean(chapterFrom)
  if (hasChapter) {
    const fromN = Number(chapterFrom)
    const toN = Number(chapterTo || chapterFrom)
    if (Number.isFinite(fromN) && Number.isFinite(toN) && toN < fromN) {
      chapterFrom = String(toN)
      chapterTo = String(fromN)
    }
  }

  const descripcion = extra.length ? extra.join(' | ').trim() : ''
  return {
    ok: true,
    title,
    season,
    chapterFrom,
    chapterTo: hasChapter ? (chapterTo || chapterFrom) : null,
    isRange: hasChapter ? (String(chapterTo || chapterFrom) !== String(chapterFrom)) : false,
    hasChapter,
    prioridad,
    descripcion,
  }
}

const extractLibChapterRange = (item) => {
  const text = `${safeString(item?.title || '')} ${safeString(item?.originalName || '')}`.trim()
  const m = text.match(/\b(\d{1,4})\s*[-–]\s*(\d{1,4})\b/)
  if (!m) return null
  const a = normalizeChapter(m[1])
  const b = normalizeChapter(m[2])
  if (!a || !b) return null
  const fromN = Number(a), toN = Number(b)
  if (!Number.isFinite(fromN) || !Number.isFinite(toN)) return null
  return fromN <= toN ? { from: a, to: b } : { from: b, to: a }
}

const searchExactMatch = ({ panel, proveedorJid, pedidoParsed, limit = 10, allowGlobal = false } = {}) => {
  const list = Object.values(panel?.contentLibrary || {})
    .filter((it) => it && it.id)
    .filter((it) => (proveedorJid ? String(it?.proveedorJid || '') === String(proveedorJid) : true))

  const qTitleNorm = normalizeText(pedidoParsed?.title || '')
  if (!qTitleNorm) return []
  if (!pedidoParsed?.hasChapter) return []
  const qSeason = pedidoParsed?.season ? String(pedidoParsed.season) : null
  const qFrom = Number(pedidoParsed?.chapterFrom)
  const qTo = Number(pedidoParsed?.chapterTo ?? pedidoParsed?.chapterFrom)
  const isRange = Boolean(pedidoParsed?.isRange)

  const out = []
  for (const it of list) {
    const itTitle = safeString(it?.title || it?.originalName || '')
    const itNorm = normalizeText(itTitle)
    if (!itNorm) continue

    const exactTitle = itNorm === qTitleNorm
    const looseTitle = exactTitle || (qTitleNorm && (itNorm.includes(qTitleNorm) || qTitleNorm.includes(itNorm)))
    if (!looseTitle) continue

    const itSeason = it?.season != null ? normalizeSeason(it.season) : normalizeSeason(itTitle)
    if (qSeason && String(itSeason || '') !== String(qSeason)) continue

    const itChapter = it?.chapter != null ? normalizeChapter(it.chapter) : normalizeChapter(itTitle)
    const itRange = extractLibChapterRange(it)

    let chapterOk = false
    let score = 0
    if (!isRange) {
      const q = String(pedidoParsed.chapterFrom)
      if (itChapter && String(itChapter) === q) {
        chapterOk = true
        score = exactTitle ? 100 : 86
      } else if (itRange && Number(q) >= Number(itRange.from) && Number(q) <= Number(itRange.to)) {
        chapterOk = true
        score = exactTitle ? 96 : 82
      }
    } else {
      if (itRange) {
        const fromOk = Number(itRange.from) <= qFrom
        const toOk = Number(itRange.to) >= qTo
        if (fromOk && toOk) {
          chapterOk = true
          score = exactTitle ? 100 : 88
        }
      } else if (itChapter) {
        const n = Number(itChapter)
        if (Number.isFinite(n) && n >= qFrom && n <= qTo) {
          chapterOk = true
          score = exactTitle ? 92 : 78
        }
      }
    }

    if (!chapterOk) continue
    if (!allowGlobal && !proveedorJid && it?.proveedorJid) {
      // si no hay proveedor asignado, no mezclar bibliotecas de otros proveedores en grupos
      // (en privados se permite el caller decidir allowGlobal)
    }

    // bonus por temporada si aplica
    if (qSeason && itSeason && String(itSeason) === String(qSeason)) score += 4
    out.push({ it, score })
  }

  out.sort((a, b) => b.score - a.score)
  return out.slice(0, limit)
}

const searchTitlesInLibrary = ({ panel, proveedorJid, titleQuery, limitTitles = 10 } = {}) => {
  const qNorm = normalizeText(titleQuery || '')
  if (!qNorm) return []

  const list = Object.values(panel?.contentLibrary || {})
    .filter((it) => it && it.id)
    .filter((it) => (proveedorJid ? String(it?.proveedorJid || '') === String(proveedorJid) : true))

  const buckets = new Map()
  for (const it of list) {
    const itTitle = safeString(it?.title || it?.originalName || '').trim()
    const itNorm = normalizeText(itTitle)
    if (!itNorm) continue
    const matches = itNorm === qNorm || itNorm.includes(qNorm) || qNorm.includes(itNorm)
    if (!matches) continue

    const key = itNorm
    const season = normalizeSeason(it?.season) || '0'
    const chapter = normalizeChapter(it?.chapter)
    const entry = buckets.get(key) || {
      key,
      title: itTitle,
      sampleId: Number(it?.id) || null,
      proveedorJid: safeString(it?.proveedorJid || ''),
      seasons: new Set(),
      chapters: [],
    }
    entry.seasons.add(season)
    if (chapter) entry.chapters.push(Number(chapter))
    if (!entry.sampleId) entry.sampleId = Number(it?.id) || null
    buckets.set(key, entry)
  }

  const scored = [...buckets.values()].map((b) => {
    const normTitle = normalizeText(b.title)
    let score = 0
    if (normTitle === qNorm) score += 100
    else if (normTitle.startsWith(qNorm) || qNorm.startsWith(normTitle)) score += 80
    else score += 60
    score += Math.min(10, b.seasons.size)
    return { ...b, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limitTitles)
}

const buildTitleSelectRowsForPedido = (titleBuckets, usedPrefix, pedidoId) => {
  const rows = []
  for (const b of titleBuckets || []) {
    const sampleId = Number(b?.sampleId)
    if (!Number.isFinite(sampleId) || sampleId <= 0) continue
    const seasonsCount = Number(b?.seasons?.size || 0) || 0
    const chapters = Array.isArray(b?.chapters) ? b.chapters.filter((n) => Number.isFinite(n)).sort((x, y) => x - y) : []
    const capTxt = chapters.length ? `Caps: ${chapters[0]}-${chapters[chapters.length - 1]} (${chapters.length})` : 'Caps: ?'
    const desc = `${seasonsCount ? `Temps: ${seasonsCount} · ` : ''}${capTxt}`
    rows.push({
      title: truncateText(b?.title || `Título #${sampleId}`, 44),
      description: truncateText(desc, 60),
      rowId: `${usedPrefix}pedidotitulo ${pedidoId} ${sampleId}`,
    })
    if (rows.length >= 10) break
  }
  return rows
}

const getLibraryItemsByTitleKey = (panel, { baseItem, season = null, restrictProviderJid = null } = {}) => {
  if (!baseItem) return []
  const titleKey = normalizeText(baseItem?.title || baseItem?.originalName || '')
  if (!titleKey) return []
  const providerJid = restrictProviderJid ? String(restrictProviderJid) : String(baseItem?.proveedorJid || '')
  const targetSeason = season != null ? String(season) : null

  return Object.values(panel?.contentLibrary || {})
    .filter((it) => it && it.id)
    .filter((it) => (providerJid ? String(it?.proveedorJid || '') === providerJid : true))
    .filter((it) => normalizeText(it?.title || it?.originalName || '') === titleKey)
    .filter((it) => {
      if (targetSeason == null) return true
      const s = normalizeSeason(it?.season) || '0'
      return String(s) === String(targetSeason)
    })
}

const buildSeasonsRowsForPedido = (items, usedPrefix, pedidoId, baseLibId) => {
  const grouped = new Map()
  for (const it of items || []) {
    const s = normalizeSeason(it?.season) || '0'
    const entry = grouped.get(s) || { season: s, chapters: [] }
    const ch = normalizeChapter(it?.chapter)
    if (ch) entry.chapters.push(Number(ch))
    grouped.set(s, entry)
  }

  const seasons = [...grouped.values()].sort((a, b) => Number(a.season) - Number(b.season))
  const rows = []
  for (const g of seasons) {
    const seasonLabel = g.season === '0' ? 'Sin temporada' : `Temporada ${String(g.season).padStart(2, '0')}`
    const chs = g.chapters.filter((n) => Number.isFinite(n)).sort((x, y) => x - y)
    const desc = chs.length ? `Caps: ${chs[0]}-${chs[chs.length - 1]} (${chs.length})` : 'Caps: ?'
    rows.push({
      title: seasonLabel,
      description: truncateText(desc, 60),
      rowId: `${usedPrefix}pedidocapslib ${pedidoId} ${baseLibId} ${g.season} 1`,
    })
    if (rows.length >= 10) break
  }
  return rows
}

const buildLibraryChaptersRows = (items, usedPrefix, pedidoId, page = 1) => {
  const perPage = 9
  const p = clampInt(page, { min: 1, max: 9999, fallback: 1 })
  const sorted = (items || []).slice().sort((a, b) => {
    const ac = normalizeChapter(a?.chapter)
    const bc = normalizeChapter(b?.chapter)
    if (ac && bc) return Number(ac) - Number(bc)
    if (ac && !bc) return -1
    if (!ac && bc) return 1
    return Number(a?.id || 0) - Number(b?.id || 0)
  })

  const total = sorted.length
  const start = (p - 1) * perPage
  const slice = sorted.slice(start, start + perPage)
  const rows = []
  for (const it of slice) {
    const id = Number(it?.id)
    if (!Number.isFinite(id) || id <= 0) continue
    const cap = normalizeChapter(it?.chapter)
    const capLabel = cap ? `Capítulo ${String(cap).padStart(4, '0')}` : `Archivo #${id}`
    rows.push({
      title: capLabel,
      description: truncateText(waSafeInline(it?.originalName || it?.title || ''), 60),
      rowId: `${usedPrefix}seleccionpedido ${pedidoId} lib ${id}`,
    })
    if (rows.length >= perPage) break
  }

  return { rows, total, page: p, perPage }
}

const truncateText = (v, max = 140) => {
  const s = waSafeInline(v)
  if (s.length <= max) return s
  return `${s.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

const shouldSkipDuplicateCommand = (m, command) => {
  try {
    const msgId = m?.key?.id || m?.id || m?.message?.key?.id || null
    if (!msgId) return false

    global.__panelPedidoCommandSeen ||= new Map()
    const seen = global.__panelPedidoCommandSeen
    const now = Date.now()
    const key = `${String(command || '')}|${String(m?.chat || '')}|${String(m?.sender || '')}|${String(msgId)}`

    const prev = seen.get(key)
    if (prev && now - prev < 2 * 60 * 1000) return true
    seen.set(key, now)

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

    return false
  } catch {
    return false
  }
}

const ensureStore = () => {
  if (!global.db.data.panel) global.db.data.panel = {}
  if (!global.db.data.panel.pedidos) global.db.data.panel.pedidos = {}
  if (!global.db.data.panel.pedidosCounter) global.db.data.panel.pedidosCounter = 0
  if (!global.db.data.panel.proveedores) global.db.data.panel.proveedores = {}
  if (!global.db.data.panel.contentLibrary) global.db.data.panel.contentLibrary = {}
  if (!Array.isArray(global.db.data.aportes)) global.db.data.aportes = []
  if (!global.db.data.aportesCounter) global.db.data.aportesCounter = 1
}

const nextPedidoId = () => {
  global.db.data.panel.pedidosCounter = (global.db.data.panel.pedidosCounter || 0) + 1
  return global.db.data.panel.pedidosCounter
}

const formatDate = (value) => {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toISOString().slice(0, 10)
}

const prioridadEmoji = {
  alta: '🔴',
  media: '🟡',
  baja: '🟢',
}

const estadoEmoji = {
  pendiente: '⏳',
  en_proceso: '🔄',
  completado: '✅',
  cancelado: '❌',
}

const formatPedido = (pedido, index) => {
  const capFrom = safeString(pedido?.capitulo_desde || pedido?.capitulo || '').trim()
  const capTo = safeString(pedido?.capitulo_hasta || '').trim()
  const capTxt = capFrom ? (capTo && capTo !== capFrom ? `${capFrom}-${capTo}` : capFrom) : ''
  const tempTxt = safeString(pedido?.temporada || '').trim()
  const lines = [
    `${index}. ${waSafeInline(pedido?.titulo || 'Sin título')}`,
    `   ${prioridadEmoji[pedido?.prioridad] || '⚪'} Prioridad: ${waSafeInline(pedido?.prioridad || 'media')}`,
    `   ${estadoEmoji[pedido?.estado] || '⏳'} Estado: ${waSafeInline(pedido?.estado || 'pendiente')}`,
    `   📝 ${truncateText(pedido?.descripcion || 'Sin descripción', 90)}`,
    `   👤 Usuario: ${waSafeInline(pedido?.usuario || '-')}`,
    `   📅 Fecha: ${formatDate(pedido?.fecha_creacion)}`,
    `   👍 Votos: ${Number(pedido?.votos || 0) || 0}`,
  ]
  return lines.join('\n')
}

const stopwords = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'y', 'o', 'a', 'en', 'por', 'para', 'con', 'sin',
  'un', 'una', 'unos', 'unas', 'que', 'se', 'su', 'sus', 'al', 'lo', 'le', 'les',
  'cap', 'capitulo', 'capítulo', 'chapter', 'ch', 'episodio', 'ep', 'pdf', 'epub',
])

const normalizeText = (s) => safeString(s || '')
  .toLowerCase()
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const tokenize = (s) => {
  const parts = normalizeText(s).split(' ').filter(Boolean)
  const out = []
  for (const p of parts) {
    if (p.length < 3) continue
    if (stopwords.has(p)) continue
    out.push(p)
    if (out.length >= 24) break
  }
  return out
}

const getPanelUrl = () => {
  const raw = process.env.PANEL_PUBLIC_URL || process.env.PUBLIC_URL || process.env.PANEL_URL || ''
  return String(raw || '').trim().replace(/\/+$/, '')
}

const aiClassifyWithTimeout = async ({ filename, caption, provider }) => {
  const timeoutMs = clampInt(process.env.PEDIDOS_AI_TIMEOUT_MS || process.env.APORTES_AI_TIMEOUT_MS, { min: 800, max: 20000, fallback: 6000 })
  try {
    const result = await Promise.race([
      classifyProviderLibraryContent({ filename, caption, provider }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), timeoutMs)),
    ])
    return result || null
  } catch {
    return null
  }
}

const aiEnhancePedido = async ({ titulo, descripcion, proveedor } = {}) => {
  const filename = safeString(titulo || '').trim()
  const caption = safeString(descripcion || '').trim()
  const provider = proveedor && typeof proveedor === 'object' ? proveedor : { tipo: '' }

  const result = await aiClassifyWithTimeout({ filename, caption, provider })
  if (!result) return null

  const title = safeString(result?.title || '').trim()
  const category = safeString(result?.category || '').trim()
  const chapter = typeof result?.chapter !== 'undefined' ? result.chapter : null
  const season = typeof result?.season !== 'undefined' ? result.season : null
  const tags = Array.isArray(result?.tags) ? result.tags.map((t) => safeString(t).trim()).filter(Boolean).slice(0, 12) : []
  const confidence = typeof result?.confidence === 'number' ? result.confidence : null

  return {
    title,
    category,
    chapter,
    season,
    tags,
    ai: {
      source: safeString(result?.source || 'heuristic'),
      model: safeString(result?.model || 'none'),
      provider: safeString(result?.provider || 'local'),
      confidence,
      updatedAt: new Date().toISOString(),
    },
  }
}

const resolveProveedorJid = (panel, raw) => {
  const v = String(raw || '').trim()
  if (!v) return null
  const asNum = Number(v)
  if (Number.isFinite(asNum)) {
    const found = Object.values(panel?.proveedores || {}).find((p) => Number(p?.id) === asNum) || null
    return found?.jid || null
  }
  const byJid = panel?.proveedores?.[v] || null
  return byJid?.jid || v
}

const scoreLibraryItem = (item, query) => {
  const itemTitle = normalizeText(item?.title || '')
  const queryTitle = normalizeText(query?.title || '')
  const itemText = `${item?.title || ''} ${item?.originalName || ''} ${(item?.tags || []).join(' ')}`
  const qTokens = new Set(tokenize(`${query?.title || ''} ${query?.descripcion || ''} ${(query?.tags || []).join(' ')}`))
  const iTokens = new Set(tokenize(itemText))

  let overlap = 0
  for (const t of qTokens) if (iTokens.has(t)) overlap += 1
  const overlapRatio = qTokens.size ? overlap / qTokens.size : 0

  let score = overlapRatio * 70
  if (queryTitle && itemTitle) {
    if (itemTitle === queryTitle) score += 28
    else if (itemTitle.includes(queryTitle) || queryTitle.includes(itemTitle)) score += 18
  }

  const qChapter = query?.chapter ? String(query.chapter) : null
  const iChapter = item?.chapter ? String(item.chapter) : null
  if (qChapter && iChapter && qChapter === iChapter) score += 30

  const qSeason = query?.season ? String(query.season) : null
  const iSeason = item?.season ? String(item.season) : null
  if (qSeason && iSeason && qSeason === iSeason) score += 18

  const qCat = query?.category ? String(query.category).toLowerCase() : null
  const iCat = item?.category ? String(item.category).toLowerCase() : null
  if (qCat && iCat && qCat === iCat) score += 10

  return score
}

const searchProviderLibrary = async (panel, proveedorJid, pedido, limit = 5) => {
  const list = Object.values(panel.contentLibrary || {}).filter((it) => String(it?.proveedorJid || '') === String(proveedorJid || ''))
  const proveedor = panel?.proveedores?.[proveedorJid] || { jid: proveedorJid }

  const classified = await aiClassifyWithTimeout({
    filename: String(pedido?.titulo || ''),
    caption: String(pedido?.descripcion || pedido?.contenido_solicitado || ''),
    provider: { jid: proveedorJid, tipo: proveedor?.tipo || '' },
  })

  const query = {
    title: String(classified?.title || pedido?.titulo || '').trim(),
    descripcion: String(pedido?.descripcion || pedido?.contenido_solicitado || '').trim(),
    category: String(classified?.category || '').trim(),
    chapter: typeof classified?.chapter !== 'undefined' ? classified.chapter : null,
    season: typeof classified?.season !== 'undefined' ? classified.season : null,
    tags: Array.isArray(classified?.tags) ? classified.tags : [],
    provider: { jid: proveedorJid, nombre: proveedor?.nombre || '', tipo: proveedor?.tipo || '' },
  }

  const scored = list
    .map((it) => ({ it, score: scoreLibraryItem(it, query) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return { query, results: scored }
}

const searchGlobalLibrary = async (panel, pedido, limit = 5) => {
  const list = Object.values(panel.contentLibrary || {})

  const classified = await aiClassifyWithTimeout({
    filename: String(pedido?.titulo || ''),
    caption: String(pedido?.descripcion || pedido?.contenido_solicitado || ''),
    provider: { jid: '', tipo: '' },
  })

  const query = {
    title: String(classified?.title || pedido?.titulo || '').trim(),
    descripcion: String(pedido?.descripcion || pedido?.contenido_solicitado || '').trim(),
    category: String(classified?.category || '').trim(),
    chapter: typeof classified?.chapter !== 'undefined' ? classified.chapter : null,
    season: typeof classified?.season !== 'undefined' ? classified.season : null,
    tags: Array.isArray(classified?.tags) ? classified.tags : [],
    provider: { jid: '', nombre: '', tipo: '' },
  }

  const scored = list
    .map((it) => ({ it, score: scoreLibraryItem(it, query) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)

  return { query, results: scored }
}

const formatSearchResults = (pedido, query, results, usedPrefix, proveedorJid) => {
  const lines = []
  lines.push('🔎 *Búsqueda en biblioteca*')
  lines.push(`> *Pedido:* ${waSafeInline(pedido?.titulo || '')}`)
  if (query?.title && query.title !== pedido?.titulo) lines.push(`> *Interpretado:* _${waSafeInline(query.title)}_`)
  if (query?.category) lines.push(`> *Categoría:* _${waSafeInline(query.category)}_`)
  if (query?.chapter != null) lines.push(`> *Capítulo:* _${waSafeInline(query.chapter)}_`)

  if (!results.length) {
    lines.push('')
    lines.push('❌ _No encontré coincidencias en la biblioteca._')
    const panelUrl = getPanelUrl()
    if (panelUrl && proveedorJid) lines.push(`> *Proveedor:* ${panelUrl}/proveedores/${encodeURIComponent(String(proveedorJid))}`)
    return lines.join('\n')
  }

  lines.push('')
  lines.push('✅ *Coincidencias*')
  for (const r of results) {
    const it = r.it || {}
    const title = waSafeInline(it.title || it.originalName || `Archivo #${it.id || '?'}`)
    const score = Math.round(r.score)
    lines.push(`> \`\`\`#${it.id}\`\`\` ${title} (_${score}_)`)
  }
  lines.push('')
  lines.push(`📥 *Enviar:* \`\`\`${usedPrefix}enviarlib <id>\`\`\``)
  return lines.join('\n')
}

const connCanSendList = (conn) => typeof conn?.sendList === 'function'

const buildLibraryListRows = (results, usedPrefix, opts = {}) => {
  const rowIdOf = typeof opts?.rowIdOf === 'function' ? opts.rowIdOf : (id) => `${usedPrefix}infolib ${id}`
  const rows = []
  for (const r of results || []) {
    const it = r?.it || {}
    const id = Number(it?.id)
    if (!Number.isFinite(id) || id <= 0) continue
    const score = Math.max(0, Math.min(100, Math.round(Number(r?.score) || 0)))
    const title = truncateText(it?.title || it?.originalName || `Archivo #${id}`, 44)
    const descParts = []
    if (it?.season != null && String(it.season).trim()) descParts.push(`Temp: ${waSafeInline(it.season)}`)
    if (it?.chapter != null && String(it.chapter).trim()) descParts.push(`Cap: ${waSafeInline(it.chapter)}`)
    if (it?.category) descParts.push(waSafeInline(it.category))
    descParts.push(`Score: ${score}`)
    rows.push({
      title: waSafeInline(title),
      description: truncateText(descParts.filter(Boolean).join(' · '), 60),
      rowId: rowIdOf(id, it),
    })
    if (rows.length >= 10) break
  }
  return rows
}

const buildLibraryRowsFromItems = (items, usedPrefix) => {
  const rows = []
  for (const it of items || []) {
    const id = Number(it?.id)
    if (!Number.isFinite(id) || id <= 0) continue
    const title = truncateText(it?.title || it?.originalName || `Archivo #${id}`, 44)
    const descParts = []
    if (it?.season != null && String(it.season).trim()) descParts.push(`Temp: ${waSafeInline(it.season)}`)
    if (it?.chapter != null && String(it.chapter).trim()) descParts.push(`Cap: ${waSafeInline(it.chapter)}`)
    if (it?.category) descParts.push(waSafeInline(it.category))
    rows.push({
      title: waSafeInline(title),
      description: truncateText(descParts.filter(Boolean).join(' · '), 60),
      rowId: `${usedPrefix}infolib ${id}`,
    })
    if (rows.length >= 10) break
  }
  return rows
}

const buildAportesListRows = (matches, usedPrefix) => {
  const rows = []
  for (const m of matches || []) {
    const a = m?.aporte || {}
    const id = Number(a?.id)
    if (!Number.isFinite(id) || id <= 0) continue
    const score = Math.max(0, Math.min(100, Math.round(Number(m?.score) || 0)))
    const title = truncateText(a?.titulo || a?.contenido || `Aporte #${id}`, 44)
    const descParts = []
    if (a?.tipo) descParts.push(waSafeInline(a.tipo))
    if (a?.temporada != null && String(a.temporada).trim()) descParts.push(`Temp: ${waSafeInline(a.temporada)}`)
    if (a?.capitulo != null && String(a.capitulo).trim()) descParts.push(`Cap: ${waSafeInline(a.capitulo)}`)
    if (a?.estado) descParts.push(waSafeInline(a.estado))
    descParts.push(`Score: ${score}`)
    rows.push({
      title: waSafeInline(title),
      description: truncateText(descParts.filter(Boolean).join(' · '), 60),
      rowId: `${usedPrefix}infoaporte ${id}`,
    })
    if (rows.length >= 10) break
  }
  return rows
}

const buildAporteRowsFromItems = (aportes, usedPrefix) => {
  const rows = []
  for (const a of aportes || []) {
    const id = Number(a?.id)
    if (!Number.isFinite(id) || id <= 0) continue
    const title = truncateText(a?.titulo || a?.contenido || `Aporte #${id}`, 44)
    const descParts = []
    if (a?.tipo) descParts.push(waSafeInline(a.tipo))
    if (a?.temporada != null && String(a.temporada).trim()) descParts.push(`Temp: ${waSafeInline(a.temporada)}`)
    if (a?.capitulo != null && String(a.capitulo).trim()) descParts.push(`Cap: ${waSafeInline(a.capitulo)}`)
    if (a?.estado) descParts.push(waSafeInline(a.estado))
    const fecha = formatDate(a?.fecha || a?.fecha_creacion || a?.created_at)
    if (fecha && fecha !== '-') descParts.push(fecha)
    rows.push({
      title: waSafeInline(title),
      description: truncateText(descParts.filter(Boolean).join(' · '), 60),
      rowId: `${usedPrefix}infoaporte ${id}`,
    })
    if (rows.length >= 10) break
  }
  return rows
}

const isAporteVisibleToUser = (aporte, { m, isBotOwner, isAdmin } = {}) => {
  if (!aporte) return false
  if (isBotOwner) return true

  const isCreator = String(aporte?.usuario || '') === String(m?.sender || '')
  if (isCreator) return true

  if (isAporteApproved(aporte)) return true

  const sameGroup = !aporte?.grupo || !m?.isGroup || String(aporte.grupo) === String(m?.chat || '')
  if (m?.isGroup && isAdmin && sameGroup) return true

  return false
}

const buildProviderSelectRows = (panel, usedPrefix, pedidoId) => {
  const proveedores = Object.values(panel?.proveedores || {}).filter((p) => p && (p.jid || p.id))
  const rows = []
  for (const p of proveedores) {
    const provKey = typeof p?.id !== 'undefined' && p?.id !== null ? String(p.id) : safeString(p?.jid || '').trim()
    if (!provKey) continue
    const title = waSafeInline(p?.nombre || p?.jid || `Proveedor ${provKey}`) || `Proveedor ${provKey}`
    const descParts = []
    if (p?.tipo) descParts.push(waSafeInline(p.tipo))
    if (p?.jid) descParts.push(waSafeInline(p.jid))
    rows.push({
      title,
      description: truncateText(descParts.filter(Boolean).join(' · '), 60),
      rowId: `${usedPrefix}procesarpedido ${pedidoId} ${provKey}`,
    })
    if (rows.length >= 10) break
  }
  return rows
}

const trySendInteractiveList = async (m, conn, { title, text, sections }) => {
  if (!connCanSendList(conn)) return false
  if (!Array.isArray(sections) || !sections.some((s) => Array.isArray(s?.rows) && s.rows.length)) return false
  try {
    const timeoutMs = clampInt(process.env.WA_LIST_TIMEOUT_MS, { min: 1500, max: 30000, fallback: 9000 })
    await Promise.race([
      conn.sendList(m.chat, title, text, 'Ver opciones', sections, m),
      new Promise((_, reject) => setTimeout(() => reject(new Error('sendList timeout')), timeoutMs)),
    ])
    return true
  } catch (err) {
    console.error('sendList failed:', err)
    return false
  }
}

const trySendTemplateResponse = async (m, conn, { text, footer, buttons }) => {
  try {
    if (typeof conn?.sendHydrated !== 'function') return false
    const safeButtons = Array.isArray(buttons) ? buttons.filter((b) => Array.isArray(b) && b[0] && b[1]).slice(0, 3) : []
    if (!safeButtons.length) return false
    const timeoutMs = clampInt(process.env.WA_TEMPLATE_TIMEOUT_MS, { min: 1500, max: 30000, fallback: 9000 })
    await Promise.race([
      conn.sendHydrated(m.chat, String(text || ''), String(footer || ''), null, null, null, null, null, safeButtons, m),
      new Promise((_, reject) => setTimeout(() => reject(new Error('sendHydrated timeout')), timeoutMs)),
    ])
    return true
  } catch (err) {
    console.error('sendHydrated failed:', err)
    return false
  }
}

const isAporteApproved = (aporte) => {
  const estado = safeString(aporte?.estado || '').toLowerCase().trim()
  return estado === 'aprobado' || estado === 'approved'
}

const scoreAporte = (aporte, queryTokensSet, pedidoMeta = null) => {
  const title = safeString(aporte?.titulo || '')
  const body = safeString(aporte?.contenido || '')
  const tags = Array.isArray(aporte?.tags) ? aporte.tags.join(' ') : ''
  const tipo = safeString(aporte?.tipo || '')
  const combined = `${title} ${body} ${tags} ${tipo}`
  const aTokens = new Set(tokenize(combined))

  let overlap = 0
  for (const t of queryTokensSet) if (aTokens.has(t)) overlap += 1
  const overlapRatio = queryTokensSet.size ? overlap / queryTokensSet.size : 0

  let score = overlapRatio * 100
  const qt = [...queryTokensSet].join(' ')
  const nt = normalizeText(title)
  if (qt && nt && (nt.includes(qt) || qt.includes(nt))) score += 12

  if (isAporteApproved(aporte)) score += 8
  if (aporte?.archivoPath || aporte?.archivo) score += 6

  const qSeason = pedidoMeta?.temporada != null ? String(pedidoMeta.temporada).trim() : ''
  const iSeason = aporte?.temporada != null ? String(aporte.temporada).trim() : ''
  if (qSeason && iSeason && qSeason === iSeason) score += 14

  const qFrom = pedidoMeta?.capitulo_desde != null ? String(pedidoMeta.capitulo_desde).trim() : (pedidoMeta?.capitulo != null ? String(pedidoMeta.capitulo).trim() : '')
  const qTo = pedidoMeta?.capitulo_hasta != null ? String(pedidoMeta.capitulo_hasta).trim() : qFrom
  const iChapter = aporte?.capitulo != null ? String(aporte.capitulo).trim() : ''
  if (qFrom && iChapter) {
    const qf = Number(normalizeChapter(qFrom) || '')
    const qt = Number(normalizeChapter(qTo) || '')
    const ic = Number(normalizeChapter(iChapter) || '')
    if (Number.isFinite(qf) && Number.isFinite(qt) && Number.isFinite(ic) && ic >= Math.min(qf, qt) && ic <= Math.max(qf, qt)) score += 18
  }

  return score
}

const searchAportesForPedido = (
  pedido,
  {
    limit = 5,
    includePending = false,
    allowPendingUserJid = null,
    allowPendingGroupJid = null,
  } = {}
) => {
  const aportes = Array.isArray(global.db?.data?.aportes) ? global.db.data.aportes : []
  const queryText = `${pedido?.titulo || ''} ${pedido?.descripcion || ''} ${(pedido?.tags || []).join(' ')}`
  const qTokens = new Set(tokenize(queryText))
  if (!qTokens.size) return []

  const scored = []
  for (const aporte of aportes) {
    if (!aporte) continue
    if (!isAporteApproved(aporte)) {
      const allowPending =
        includePending ||
        (allowPendingUserJid && String(aporte?.usuario || '') === String(allowPendingUserJid)) ||
        (allowPendingGroupJid && String(aporte?.grupo || '') === String(allowPendingGroupJid))
      if (!allowPending) continue
    }
    const score = scoreAporte(aporte, qTokens, pedido)
    if (score <= 0) continue
    scored.push({ aporte, score })
  }
  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, limit)
}

const searchExactMatchAportes = (pedidoParsed, { limit = 10, allowPendingUserJid = null, allowPendingGroupJid = null, includePending = false } = {}) => {
  const aportes = Array.isArray(global.db?.data?.aportes) ? global.db.data.aportes : []
  const qTitleNorm = normalizeText(pedidoParsed?.title || '')
  const qSeason = pedidoParsed?.season ? String(pedidoParsed.season) : null
  const qFrom = Number(pedidoParsed?.chapterFrom)
  const qTo = Number(pedidoParsed?.chapterTo ?? pedidoParsed?.chapterFrom)
  const isRange = Boolean(pedidoParsed?.isRange)

  const out = []
  for (const aporte of aportes) {
    if (!aporte) continue
    if (!isAporteApproved(aporte)) {
      const allowPending =
        includePending ||
        (allowPendingUserJid && String(aporte?.usuario || '') === String(allowPendingUserJid)) ||
        (allowPendingGroupJid && String(aporte?.grupo || '') === String(allowPendingGroupJid))
      if (!allowPending) continue
    }

    const aTitleNorm = normalizeText(aporte?.titulo || '')
    if (!aTitleNorm || !qTitleNorm) continue
    const exactTitle = aTitleNorm === qTitleNorm
    const looseTitle = exactTitle || aTitleNorm.includes(qTitleNorm) || qTitleNorm.includes(aTitleNorm)
    if (!looseTitle) continue

    const aSeason = normalizeSeason(aporte?.temporada)
    if (qSeason && String(aSeason || '') !== String(qSeason)) continue

    const aChapter = normalizeChapter(aporte?.capitulo)
    if (!aChapter) continue
    const n = Number(aChapter)
    if (!Number.isFinite(n)) continue
    if (!isRange) {
      if (String(aChapter) !== String(pedidoParsed.chapterFrom)) continue
    } else {
      if (!(n >= qFrom && n <= qTo)) continue
    }

    let score = exactTitle ? 100 : 86
    if (qSeason && aSeason && String(aSeason) === String(qSeason)) score += 4
    out.push({ aporte, score })
  }

  out.sort((a, b) => b.score - a.score)
  return out.slice(0, limit)
}

const formatAportesMatches = (pedido, matches, usedPrefix) => {
  const lines = []
  lines.push('📌 *Aportes sugeridos*')
  lines.push(`> *Pedido:* ${waSafeInline(pedido?.titulo || '')}`)

  if (!matches.length) {
    lines.push('')
    lines.push('🛡️ _No hay aportes que coincidan._')
    return lines.join('\n')
  }

  lines.push('')
  for (const m of matches) {
    const a = m.aporte || {}
    const score = Math.round(m.score)
    const titulo = truncateText(a.titulo || a.contenido || `Aporte #${a.id}`, 44)
    const tipo = waSafeInline(a.tipo || 'extra')
    const estado = waSafeInline(a.estado || 'pendiente')
    const fecha = formatDate(a.fecha || a.fecha_creacion || a.created_at)
    lines.push(`> \`\`\`#${safeString(a.id)}\`\`\` ${titulo} (_${score}_)`)
    lines.push(`> *Tipo:* _${tipo}_ | *Estado:* _${estado}_ | *Fecha:* _${fecha}_`)
  }
  lines.push('')
  lines.push(`📎 *Enviar aporte:* \`\`\`${usedPrefix}enviaraporte <idAporte>\`\`\``)
  return lines.join('\n')
}

const resolveAporteFilePath = (aporte) => {
  const rel = safeString(aporte?.archivoPath || '').trim()
  if (!rel) return null
  if (rel.includes('..')) return null

  const root = path.resolve(process.cwd(), 'storage', 'media')
  const filePath = path.resolve(process.cwd(), rel)
  if (!filePath.toLowerCase().startsWith(root.toLowerCase())) return null
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null
  return filePath
}

const trySendLocalFile = async (m, conn, filePath, filename, caption) => {
  try {
    const stat = fs.statSync(filePath)
    const maxBytes = Number(process.env.WA_SEND_MAX_BYTES || 45 * 1024 * 1024)
    if (Number.isFinite(maxBytes) && stat.size > maxBytes) {
      return { ok: false, reason: `Archivo muy grande (${Math.round(stat.size / 1024 / 1024)}MB)` }
    }
    await conn.sendFile(m.chat, filePath, filename, caption, m, null, { asDocument: true })
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: err?.message || 'Error enviando archivo' }
  }
}

const trySendLibraryItem = async (m, conn, item) => {
  try {
    const filePath = item?.file_path
    if (!filePath || !fs.existsSync(filePath)) return { ok: false, reason: 'Archivo no encontrado en disco' }
    const stat = fs.statSync(filePath)
    if (!stat.isFile()) return { ok: false, reason: 'No es un archivo' }

    const maxBytes = Number(process.env.WA_SEND_MAX_BYTES || 45 * 1024 * 1024)
    if (Number.isFinite(maxBytes) && stat.size > maxBytes) {
      return { ok: false, reason: `Archivo muy grande (${Math.round(stat.size / 1024 / 1024)}MB)` }
    }

    const filename = item?.originalName || item?.filename || path.basename(filePath)
    const caption = `${item?.title || filename}`.trim()
    await conn.sendFile(m.chat, filePath, filename, caption, m, null, { asDocument: true })
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: err?.message || 'Error enviando archivo' }
  }
}

const canUserManagePedido = (pedido, { m, isBotOwner, isAdmin } = {}) => {
  if (!pedido) return false
  if (isBotOwner) return true
  const isPedidoCreator = String(pedido?.usuario || '') === String(m?.sender || '')
  const sameChat = !pedido?.grupo_id || String(pedido.grupo_id) === String(m?.chat || '')
  if (isPedidoCreator && sameChat) return true
  if (m?.isGroup && isAdmin) return true
  return false
}

const isLibraryItemAllowedInChat = (item, { m, isBotOwner } = {}) => {
  if (!item) return false
  if (!m?.isGroup) return true
  if (isBotOwner) return true
  const itemProvider = String(item?.proveedorJid || '')
  return itemProvider && String(m.chat || '') === itemProvider
}

const buildLibrarySelectRowsForPedido = (results, usedPrefix, pedidoId) =>
  buildLibraryListRows(results, usedPrefix, {
    rowIdOf: (id) => `${usedPrefix}seleccionpedido ${pedidoId} lib ${id}`,
  })

const buildAporteSelectRowsForPedido = (matches, usedPrefix, pedidoId) => {
  const rows = []
  for (const m of matches || []) {
    const a = m?.aporte || {}
    const id = Number(a?.id)
    if (!Number.isFinite(id) || id <= 0) continue
    const score = Math.max(0, Math.min(100, Math.round(Number(m?.score) || 0)))
    const title = truncateText(a?.titulo || a?.contenido || `Aporte #${id}`, 44)
    const descParts = []
    if (a?.tipo) descParts.push(waSafeInline(a.tipo))
    if (a?.temporada != null && String(a.temporada).trim()) descParts.push(`Temp: ${waSafeInline(a.temporada)}`)
    if (a?.capitulo != null && String(a.capitulo).trim()) descParts.push(`Cap: ${waSafeInline(a.capitulo)}`)
    if (a?.estado) descParts.push(waSafeInline(a.estado))
    descParts.push(`Score: ${score}`)
    rows.push({
      title: waSafeInline(title),
      description: truncateText(descParts.filter(Boolean).join(' · '), 60),
      rowId: `${usedPrefix}seleccionpedido ${pedidoId} aporte ${id}`,
    })
    if (rows.length >= 10) break
  }
  return rows
}

const buildSelectedResultMeta = ({ source, score, libItem, aporte } = {}) => {
  if (source === 'lib') {
    return {
      source: 'biblioteca',
      id: Number(libItem?.id || 0) || null,
      title: safeString(libItem?.title || libItem?.originalName || '').trim(),
      season: libItem?.season != null ? String(libItem.season) : null,
      chapter: libItem?.chapter != null ? String(libItem.chapter) : null,
      score: typeof score === 'number' ? Math.round(score) : null,
    }
  }
  if (source === 'aporte') {
    return {
      source: 'aporte',
      id: Number(aporte?.id || 0) || null,
      title: safeString(aporte?.titulo || aporte?.contenido || '').trim(),
      season: aporte?.temporada != null ? String(aporte.temporada) : null,
      chapter: aporte?.capitulo != null ? String(aporte.capitulo) : null,
      score: typeof score === 'number' ? Math.round(score) : null,
    }
  }
  return { source: safeString(source || 'unknown'), id: null, title: '', season: null, chapter: null, score: null }
}

const finalizePedidoAsCompleted = async (panel, pedido, { selected, pdfFile } = {}) => {
  pedido.estado = 'completado'
  pedido.fecha_actualizacion = new Date().toISOString()
  pedido.resultado = selected || null
  pedido.bot ||= {}
  pedido.bot.completedAt = new Date().toISOString()
  if (pdfFile?.filePath) {
    try {
      pedido.bot.pdfPath = path.relative(process.cwd(), pdfFile.filePath)
    } catch {
      pedido.bot.pdfPath = safeString(pdfFile.filePath)
    }
  }
  panel.pedidos[pedido.id] = pedido
  if (global.db?.write) await global.db.write().catch(() => { })
  try {
    const { emitPedidoUpdated } = await import('../lib/socket-io.js')
    emitPedidoUpdated(pedido)
  } catch { }
}

const processPedidoSelection = async (
  panel,
  {
    pedidoId,
    source,
    itemId,
    score = null,
    m,
    conn,
    usedPrefix,
    isAdmin,
    isBotOwner,
  } = {}
) => {
  const pid = Number(pedidoId)
  const iid = Number(itemId)
  if (!Number.isFinite(pid) || pid <= 0) return { ok: false, error: 'ID de pedido inválido' }
  if (!Number.isFinite(iid) || iid <= 0) return { ok: false, error: 'ID inválido' }

  const pedido = panel?.pedidos?.[pid] || null
  if (!pedido) return { ok: false, error: `Pedido #${pid} no encontrado` }
  if (String(pedido?.estado || '').toLowerCase().trim() === 'completado') {
    return { ok: false, error: `Pedido #${pid} ya está completado` }
  }
  if (!canUserManagePedido(pedido, { m, isBotOwner, isAdmin })) return { ok: false, error: 'No permitido' }

  const src = safeString(source || '').toLowerCase().trim()
  let selected = null

  if (src === 'lib' || src === 'biblioteca') {
    const item = panel?.contentLibrary?.[iid] || null
    if (!item) return { ok: false, error: `Archivo #${iid} no encontrado en biblioteca` }
    if (!isLibraryItemAllowedInChat(item, { m, isBotOwner })) return { ok: false, error: 'Este archivo pertenece a otro proveedor' }

    selected = buildSelectedResultMeta({ source: 'lib', score: typeof score === 'number' ? score : null, libItem: item })

    const sent = await trySendLibraryItem(m, conn, item)
    if (!sent.ok) return { ok: false, error: sent.reason || 'No pude enviar el archivo' }
  } else if (src === 'aporte' || src === 'aportes') {
    const aportes = Array.isArray(global.db?.data?.aportes) ? global.db.data.aportes : []
    const aporte = aportes.find((a) => Number(a?.id) === iid) || null
    if (!aporte) return { ok: false, error: `Aporte #${iid} no encontrado` }
    if (!isAporteVisibleToUser(aporte, { m, isBotOwner, isAdmin })) return { ok: false, error: 'No tienes acceso a este aporte' }

    selected = buildSelectedResultMeta({ source: 'aporte', score: typeof score === 'number' ? score : null, aporte })

    const filePath = resolveAporteFilePath(aporte)
    const filename = safeString(aporte?.archivoNombre || `aporte_${iid}`)
    const caption = `${safeString(aporte?.titulo || 'Aporte')}`.trim()

    if (filePath) {
      const sent = await trySendLocalFile(m, conn, filePath, filename, caption)
      if (!sent.ok) return { ok: false, error: sent.reason || 'No pude enviar el aporte' }
    } else {
      const panelUrl = getPanelUrl()
      const url = panelUrl && String(aporte?.archivo || '').startsWith('/media/') ? `${panelUrl}${aporte.archivo}` : safeString(aporte?.archivo || '')
      if (!url) return { ok: false, error: 'Este aporte no tiene archivo adjunto' }
      await m.reply(`📎 *Aporte* \`\`\`#${iid}\`\`\`\n> *Link:* ${url}`)
    }
  } else {
    return { ok: false, error: `Fuente inválida: ${waSafeInline(src)}` }
  }

  let pdfFile = null
  try {
    pdfFile = await generatePedidoPDF({ pedido, selected })
    const caption =
      `📄 *Resumen del pedido* \`\`\`#${pid}\`\`\`\n` +
      `> *Título:* ${waSafeInline(pedido?.titulo || '')}\n` +
      `> *Resultado:* _${waSafeInline(selected?.title || '')}_`
    await conn.sendFile(m.chat, pdfFile.filePath, pdfFile.filename, caption, m, null, { asDocument: true })
  } catch (err) {
    pedido.bot ||= {}
    pedido.bot.pdfError = safeString(err?.message || 'Error generando PDF')
  }

  await finalizePedidoAsCompleted(panel, pedido, { selected, pdfFile })
  return { ok: true, selected }
}

const processPedidoAuto = async ({ panel, pedido, parsed, proveedorJid, m, conn, usedPrefix, isAdmin, isBotOwner } = {}) => {
  const allowGlobal = !m?.isGroup || isBotOwner
  const libraryResults = proveedorJid
    ? searchExactMatch({ panel, proveedorJid, pedidoParsed: parsed, limit: 10 })
    : allowGlobal
      ? searchExactMatch({ panel, proveedorJid: null, pedidoParsed: parsed, limit: 10, allowGlobal: true })
      : []

  const exactAporteMatches = searchExactMatchAportes(parsed, {
    limit: 10,
    allowPendingUserJid: m?.sender || null,
    allowPendingGroupJid: isBotOwner || (m?.isGroup && isAdmin) ? (m?.isGroup ? m?.chat : null) : null,
  })

  const totalMatches = (libraryResults?.length || 0) + (exactAporteMatches?.length || 0)
  if (totalMatches !== 1) {
    return { mode: 'choose', libraryResults, exactAporteMatches }
  }

  const firstLib = libraryResults?.[0]?.it || null
  const firstAporte = exactAporteMatches?.[0]?.aporte || null
  const selection =
    firstLib && Number(firstLib?.id) > 0
      ? { source: 'lib', itemId: Number(firstLib.id), score: Number(libraryResults?.[0]?.score) || null }
      : firstAporte && Number(firstAporte?.id) > 0
        ? { source: 'aporte', itemId: Number(firstAporte.id), score: Number(exactAporteMatches?.[0]?.score) || null }
        : null

  if (!selection) return { mode: 'choose', libraryResults, exactAporteMatches }

  const processed = await processPedidoSelection(panel, {
    pedidoId: pedido?.id,
    source: selection.source,
    itemId: selection.itemId,
    score: selection.score,
    m,
    conn,
    usedPrefix,
    isAdmin,
    isBotOwner,
  })
  if (!processed.ok) return { mode: 'error', error: processed.error || 'No se pudo procesar automáticamente' }
  return { mode: 'auto', selected: processed.selected }
}

let handler = async (m, { args, usedPrefix, command, conn, isAdmin, isOwner }) => {
  ensureStore()
  const panel = global.db.data.panel

  if (shouldSkipDuplicateCommand(m, command)) return null

  const isBotOwner = Boolean(isOwner) || global.owner.map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net').includes(m.sender)

  switch (command) {
    case 'pedido':
    case 'pedir': {
      const raw = (args || []).join(' ').trim()
      if (!raw) {
        return m.reply(
          `📝 *Crear un pedido*\n\n` +
          `> *Rápido (solo título):* \`\`\`${usedPrefix}${command} <título>\`\`\`\n` +
          `> _Te muestro temporadas y capítulos para elegir._\n\n` +
          `> *Estructurado:* \`\`\`${usedPrefix}${command} <título> | Capítulo <n>\`\`\`\n` +
          `> *Rango:* \`\`\`${usedPrefix}${command} <título> | Capítulos <n>-<m>\`\`\`\n` +
          `> *Con temporada:* \`\`\`${usedPrefix}${command} <título> | Temporada <t> | Capítulo <n>\`\`\``
        )
      }

      const parsed = parsePedido(raw)
      if (!parsed.ok) return m.reply(`❌ *Pedido inválido*\n\n> _${safeString(parsed.error)}_`)

      const titulo = parsed.title
      const descripcion = parsed.descripcion || ''
      const prioridad = parsed.prioridad || 'media'
      const temporada = parsed.season
      const capDesde = parsed.chapterFrom
      const capHasta = parsed.chapterTo

      const id = nextPedidoId()
      const now = new Date().toISOString()
      const proveedorJid = (m.isGroup && panel?.proveedores?.[m.chat]) ? m.chat : null

      const pedido = {
        id,
        titulo,
        descripcion,
        tipo: 'general',
        estado: 'pendiente',
        prioridad,
        usuario: m.sender,
        grupo_id: m.isGroup ? m.chat : null,
        grupo_nombre: m.isGroup ? (await conn.groupMetadata(m.chat).catch(() => ({}))).subject || '' : '',
        proveedor_jid: proveedorJid,
        tags: [],
        categoria: null,
        capitulo: capDesde,
        capitulo_desde: capDesde,
        capitulo_hasta: capHasta,
        temporada,
        ai: null,
        votos: 0,
        votantes: [],
        fecha_creacion: now,
        fecha_actualizacion: now,
      }

      let aiEnhanced = null
      try {
        aiEnhanced = await aiEnhancePedido({
          titulo,
          descripcion,
          proveedor: proveedorJid ? { jid: proveedorJid, tipo: safeString(panel?.proveedores?.[proveedorJid]?.tipo || '') } : { tipo: '' },
        })
        if (aiEnhanced) {
          pedido.ai = aiEnhanced.ai || null
          if (aiEnhanced.tags?.length) pedido.tags = aiEnhanced.tags
          if (aiEnhanced.category) pedido.categoria = aiEnhanced.category
          if (aiEnhanced.chapter != null) pedido.capitulo = aiEnhanced.chapter
          if (aiEnhanced.season != null) pedido.temporada = aiEnhanced.season
        }
      } catch (e) {
        console.error('aiEnhancePedido failed:', e)
      }

      panel.pedidos[id] = pedido
      if (global.db?.write) await global.db.write().catch(() => { })

      try {
        const { emitPedidoCreated } = await import('../lib/socket-io.js')
        emitPedidoCreated(pedido)
      } catch { }

      // Modo rápido: si no viene capítulo, navegar por biblioteca (título -> temporadas -> capítulos).
      if (!parsed.hasChapter) {
        const canBrowseGlobal = !m.isGroup && isBotOwner
        const browseProviderJid = proveedorJid || pedido?.proveedor_jid || null

        const buckets = (browseProviderJid || canBrowseGlobal)
          ? searchTitlesInLibrary({
            panel,
            proveedorJid: browseProviderJid || null,
            titleQuery: titulo,
            limitTitles: 10,
          })
          : []

        const provRows = !browseProviderJid ? buildProviderSelectRows(panel, usedPrefix, id) : []

        const aporteMatches = searchAportesForPedido(pedido, {
          limit: 5,
          allowPendingUserJid: m.sender,
          allowPendingGroupJid: isBotOwner || (m.isGroup && isAdmin) ? (m.isGroup ? m.chat : null) : null,
        })

        const sections = []
        if (buckets.length === 1) {
          const sampleId = Number(buckets?.[0]?.sampleId)
          const baseItem = sampleId ? panel?.contentLibrary?.[sampleId] : null
          const items = baseItem ? getLibraryItemsByTitleKey(panel, { baseItem, restrictProviderJid: browseProviderJid || null }) : []
          const seasonRows = buildSeasonsRowsForPedido(items, usedPrefix, id, sampleId)
          if (seasonRows.length) sections.push({ title: '📚 Temporadas', rows: seasonRows })
        } else {
          const titleRows = buildTitleSelectRowsForPedido(buckets, usedPrefix, id)
          if (titleRows.length) sections.push({ title: '📚 Títulos', rows: titleRows })
        }

        const aporteRows = buildAporteSelectRowsForPedido(aporteMatches, usedPrefix, id)
        if (aporteRows.length) sections.push({ title: '📌 Aportes', rows: aporteRows })
        if (provRows.length) sections.push({ title: '📦 Elegir proveedor', rows: provRows })

        const bodyLines = []
        bodyLines.push('✅ *Pedido creado*')
        bodyLines.push(`> *ID:* \`\`\`#${id}\`\`\``)
        bodyLines.push(`> *Título:* ${waSafeInline(titulo)}`)
        bodyLines.push(`> *Prioridad:* ${prioridadEmoji[prioridad]} _${waSafeInline(prioridad)}_`)
        bodyLines.push(`> *Estado:* ${estadoEmoji.pendiente} _pendiente_`)
        if (descripcion) bodyLines.push(`> *Descripción:* ${truncateText(descripcion, 120)}`)
        if (!browseProviderJid && m.isGroup) bodyLines.push('> 🛡️ _Selecciona un proveedor para ver temporadas/capítulos._')
        else if (!sections.length) bodyLines.push('> 🔎 _No encontré coincidencias en biblioteca (por ahora)._')
        else bodyLines.push('> ✅ _Selecciona una opción para enviarla._')

        if (m.fromMe) {
          const templateButtons = [
            ['👁️ Ver pedido', `${usedPrefix}verpedido ${id}`],
            ['🔎 Explorar', `${usedPrefix}procesarpedido ${id}`],
            ['📌 Aportes', `${usedPrefix}buscaraporte ${id}`],
          ]
          await trySendTemplateResponse(m, conn, { text: bodyLines.join('\n'), footer: '🛡️ Oguri Bot', buttons: templateButtons })
          await m.reply(`✅ Pedido #${id} creado.\n\nUsa:\n${usedPrefix}procesarpedido ${id}`)
          return null
        }

        const ok = await trySendInteractiveList(m, conn, { title: 'Pedido', text: bodyLines.join('\n'), sections })
        if (ok) {
          await m.reply(`✅ Pedido #${id} creado.\n\nSi no te aparece el menú, usa:\n${usedPrefix}procesarpedido ${id}`)
          return null
        }

        const lines = []
        lines.push(...bodyLines)
        lines.push('')
        lines.push(`🔎 *Explorar:* \`\`\`${usedPrefix}procesarpedido ${id}\`\`\``)
        return m.reply(lines.join('\n'))
      }

      const auto = await processPedidoAuto({
        panel,
        pedido,
        parsed,
        proveedorJid,
        m,
        conn,
        usedPrefix,
        isAdmin,
        isBotOwner,
      })

      if (auto.mode === 'auto') {
        await m.reply(
          `✅ *Pedido completado automáticamente*\n\n` +
          `> *ID:* \`\`\`#${id}\`\`\`\n` +
          `> *Resultado:* _${waSafeInline(auto?.selected?.title || '')}_`
        )
        return null
      }
      if (auto.mode === 'error') {
        await m.reply(`⚠️ *No pude procesar automáticamente*\n\n> *Motivo:* _${waSafeInline(auto.error || 'Error desconocido')}_`)
      }

      const libraryResults = Array.isArray(auto?.libraryResults) ? auto.libraryResults : []
      const exactAporteMatches = Array.isArray(auto?.exactAporteMatches) ? auto.exactAporteMatches : []

      const libRows = buildLibrarySelectRowsForPedido(libraryResults, usedPrefix, id)
      const aporteRows = buildAporteSelectRowsForPedido(exactAporteMatches, usedPrefix, id)
      const provRows = !proveedorJid ? buildProviderSelectRows(panel, usedPrefix, id) : []

      const sections = []
      if (libRows.length) sections.push({ title: '📚 Biblioteca', rows: libRows })
      if (aporteRows.length) sections.push({ title: '📌 Aportes', rows: aporteRows })
      if (provRows.length) sections.push({ title: '📦 Elegir proveedor', rows: provRows })

      const actionRows = [
        { title: '👁️ Ver pedido', description: 'Ver detalles del pedido', rowId: `${usedPrefix}verpedido ${id}` },
        { title: '🗳️ Votar', description: 'Sumar 1 voto al pedido', rowId: `${usedPrefix}votarpedido ${id}` },
        { title: '📌 Buscar aportes', description: 'Ver aportes sugeridos', rowId: `${usedPrefix}buscaraporte ${id}` },
      ]
      if (proveedorJid) actionRows.push({ title: '🔎 Buscar en biblioteca', description: 'Procesar pedido en biblioteca', rowId: `${usedPrefix}procesarpedido ${id}` })
      if (actionRows.length) sections.push({ title: 'Acciones', rows: actionRows.slice(0, 10) })

      const bodyLines = []
      bodyLines.push('✅ *Pedido creado*')
      bodyLines.push(`> *ID:* \`\`\`#${id}\`\`\``)
      bodyLines.push(`> *Título:* ${waSafeInline(titulo)}`)
      bodyLines.push(`> *Prioridad:* ${prioridadEmoji[prioridad]} _${waSafeInline(prioridad)}_`)
      bodyLines.push(`> *Estado:* ${estadoEmoji.pendiente} _pendiente_`)
      if (descripcion) bodyLines.push(`> *Descripción:* ${truncateText(descripcion, 120)}`)
      bodyLines.push(`> *Capítulo(s):* _${waSafeInline(parsed.isRange ? `${parsed.chapterFrom}-${parsed.chapterTo}` : parsed.chapterFrom)}_`)
      if (parsed.season) bodyLines.push(`> *Temporada:* _${waSafeInline(parsed.season)}_`)
      if (aiEnhanced?.title && aiEnhanced.title && normalizeText(aiEnhanced.title) !== normalizeText(titulo)) {
        bodyLines.push(`> *IA:* _${waSafeInline(aiEnhanced.title)}_`)
      }
      const cat = waSafeInline(aiEnhanced?.category || pedido?.categoria || '')
      if (cat) bodyLines.push(`> *Categoría:* _${cat}_`)
      // No sobreescribir capítulo/temporada estructurados con IA: solo metadata arriba
      if (!proveedorJid && m.isGroup) bodyLines.push('> 🛡️ _Selecciona un proveedor para buscar en biblioteca._')
      else if (!libRows.length && !aporteRows.length) bodyLines.push('> 🔎 _Sin coincidencias (por ahora)._')
      else bodyLines.push('> ✅ _Encontré coincidencias: elige una para enviarla._')
      if (aiEnhanced?.title && normalizeText(aiEnhanced.title) !== normalizeText(titulo)) bodyLines.push(`> 🔎 *Interpretado:* _${waSafeInline(aiEnhanced.title)}_`)

      if (m.fromMe) {
        const templateButtons = [
          ['👁️ Ver pedido', `${usedPrefix}verpedido ${id}`],
          ['📌 Aportes', `${usedPrefix}buscaraporte ${id}`],
          [proveedorJid ? '🔎 Biblioteca' : '📦 Elegir proveedor', `${usedPrefix}procesarpedido ${id}`],
        ]
        await trySendTemplateResponse(m, conn, {
          text: bodyLines.join('\n'),
          footer: '🛡️ Oguri Bot',
          buttons: templateButtons,
        })
        await m.reply(`✅ Pedido #${id} creado.\n\nUsa:\n${usedPrefix}verpedido ${id}`)
        return null
      }

      const ok = await trySendInteractiveList(m, conn, {
        title: 'Pedido',
        text: bodyLines.join('\n'),
        sections,
      })
      if (ok) {
        await m.reply(`✅ Pedido #${id} creado.\n\nSi no te aparece el menú, usa:\n${usedPrefix}verpedido ${id}`)
        return null
      }

      const lines = []
      lines.push(...bodyLines)
      if (proveedorJid) {
        lines.push('')
        lines.push(`🔎 *Buscar en biblioteca:* \`\`\`${usedPrefix}procesarpedido ${id}\`\`\``)
      } else {
        lines.push('')
        lines.push(`📦 *Proveedores:* \`\`\`${usedPrefix}procesarpedido ${id} <idProveedor|jidProveedor>\`\`\``)
      }
      if (aporteMatches.length) {
        lines.push('')
        lines.push(formatAportesMatches(pedido, aporteMatches, usedPrefix))
      } else {
        lines.push('')
        lines.push(`📌 *Aportes:* \`\`\`${usedPrefix}buscaraporte ${id}\`\`\``)
      }
      return m.reply(lines.join('\n'))
    }

    case 'seleccionpedido': {
      const pedidoId = parseInt(args[0])
      const source = safeString(args[1]).toLowerCase().trim()
      const itemId = parseInt(args[2])
      if (!pedidoId || !source || !itemId) {
        return m.reply(`✅ *Seleccionar coincidencia*\n\n> \`\`\`${usedPrefix}seleccionpedido <idPedido> <lib|aporte> <id>\`\`\``)
      }

      const processed = await processPedidoSelection(panel, {
        pedidoId,
        source,
        itemId,
        m,
        conn,
        usedPrefix,
        isAdmin,
        isBotOwner,
      })
      if (!processed.ok) {
        return m.reply(`❌ *No pude completar el pedido*\n\n> *Motivo:* _${waSafeInline(processed.error || 'Error desconocido')}_`)
      }

      return m.reply(
        `✅ *Pedido completado*\n\n` +
        `> *ID:* \`\`\`#${pedidoId}\`\`\`\n` +
        `> *Resultado:* _${waSafeInline(processed?.selected?.title || '')}_`
      )
    }

    case 'pedidotitulo': {
      const pedidoId = parseInt(args[0])
      const baseLibId = parseInt(args[1])
      if (!pedidoId || !baseLibId) {
        return m.reply(`📚 *Temporadas por título*\n\n> \`\`\`${usedPrefix}pedidotitulo <idPedido> <idBiblioteca>\`\`\``)
      }

      const pedido = panel?.pedidos?.[pedidoId] || null
      if (!pedido) return m.reply(`❌ *Error*\n\n> _Pedido #${pedidoId} no encontrado._`)
      if (String(pedido?.estado || '').toLowerCase().trim() === 'completado') {
        return m.reply(`✅ *Pedido ya completado*\n\n> \`\`\`#${pedidoId}\`\`\` _${waSafeInline(pedido?.titulo || '')}_`)
      }

      const isPedidoCreator = String(pedido?.usuario || '') === String(m.sender || '')
      const sameChat = !pedido?.grupo_id || String(pedido.grupo_id) === String(m.chat || '')
      const canProcess = isBotOwner || (m.isGroup && isAdmin) || (isPedidoCreator && sameChat)
      if (!canProcess) return m.reply('❌ *No permitido*\n\n> _Solo admins/owner o el creador del pedido pueden usar esto._')

      const base = panel?.contentLibrary?.[baseLibId] || null
      if (!base) return m.reply(`❌ *Error*\n\n> _Archivo #${baseLibId} no encontrado en biblioteca._`)

      if (m.isGroup && !isBotOwner && String(base?.proveedorJid || '') !== String(m.chat || '')) {
        return m.reply('❌ *No permitido*\n\n> _Este archivo pertenece a otro proveedor._')
      }

      const restrictProviderJid = base?.proveedorJid ? String(base.proveedorJid) : (pedido?.proveedor_jid ? String(pedido.proveedor_jid) : null)
      const items = getLibraryItemsByTitleKey(panel, { baseItem: base, restrictProviderJid })
      const rows = buildSeasonsRowsForPedido(items, usedPrefix, pedidoId, baseLibId)
      if (!rows.length) return m.reply('📚 *Temporadas*\n\n🛡️ _No encontré temporadas/capítulos para este título._')

      try {
        pedido.proveedor_jid = restrictProviderJid || pedido.proveedor_jid || null
        pedido.fecha_actualizacion = new Date().toISOString()
        panel.pedidos[pedidoId] = pedido
        if (global.db?.write) await global.db.write().catch(() => { })
      } catch { }

      const ok = await trySendInteractiveList(m, conn, {
        title: '📚 Temporadas',
        text: `*Título:* ${waSafeInline(base?.title || base?.originalName || pedido?.titulo || '')}\n> _Selecciona una temporada para ver capítulos._`,
        sections: [{ title: 'Temporadas', rows }],
      })
      if (ok) return null

      const lines = []
      lines.push('📚 *Temporadas*')
      lines.push(`> *Título:* ${waSafeInline(base?.title || base?.originalName || pedido?.titulo || '')}`)
      lines.push('')
      for (const r of rows) lines.push(`> ${r.title} — _${r.description}_`)
      lines.push('')
      lines.push(`> \`\`\`${usedPrefix}pedidocapslib ${pedidoId} ${baseLibId} <temporada> <página>\`\`\``)
      return m.reply(lines.join('\n'))
    }

    case 'pedidocapslib': {
      const pedidoId = parseInt(args[0])
      const baseLibId = parseInt(args[1])
      const seasonArg = safeString(args[2] || '').trim()
      const pageArg = parseInt(args[3] || '1')
      if (!pedidoId || !baseLibId || !seasonArg) {
        return m.reply(`📖 *Capítulos de biblioteca*\n\n> \`\`\`${usedPrefix}pedidocapslib <idPedido> <idBiblioteca> <temporada> [página]\`\`\``)
      }

      const pedido = panel?.pedidos?.[pedidoId] || null
      if (!pedido) return m.reply(`❌ *Error*\n\n> _Pedido #${pedidoId} no encontrado._`)
      if (String(pedido?.estado || '').toLowerCase().trim() === 'completado') {
        return m.reply(`✅ *Pedido ya completado*\n\n> \`\`\`#${pedidoId}\`\`\` _${waSafeInline(pedido?.titulo || '')}_`)
      }

      const isPedidoCreator = String(pedido?.usuario || '') === String(m.sender || '')
      const sameChat = !pedido?.grupo_id || String(pedido.grupo_id) === String(m.chat || '')
      const canProcess = isBotOwner || (m.isGroup && isAdmin) || (isPedidoCreator && sameChat)
      if (!canProcess) return m.reply('❌ *No permitido*\n\n> _Solo admins/owner o el creador del pedido pueden usar esto._')

      const base = panel?.contentLibrary?.[baseLibId] || null
      if (!base) return m.reply(`❌ *Error*\n\n> _Archivo #${baseLibId} no encontrado en biblioteca._`)

      if (m.isGroup && !isBotOwner && String(base?.proveedorJid || '') !== String(m.chat || '')) {
        return m.reply('❌ *No permitido*\n\n> _Este archivo pertenece a otro proveedor._')
      }

      const season = seasonArg === '0' ? '0' : (normalizeSeason(seasonArg) || seasonArg)
      const restrictProviderJid = base?.proveedorJid ? String(base.proveedorJid) : (pedido?.proveedor_jid ? String(pedido.proveedor_jid) : null)
      const items = getLibraryItemsByTitleKey(panel, { baseItem: base, season, restrictProviderJid })
      const { rows, total, page, perPage } = buildLibraryChaptersRows(items, usedPrefix, pedidoId, pageArg)
      if (!rows.length) {
        const seasonLabel = season === '0' ? 'Sin temporada' : `Temporada ${String(season).padStart(2, '0')}`
        return m.reply(`📖 *Capítulos*\n\n> *Título:* ${waSafeInline(base?.title || base?.originalName || '')}\n> *Temporada:* _${seasonLabel}_\n\n🛡️ _No encontré capítulos para mostrar._`)
      }

      const navRows = []
      const maxPage = total ? Math.max(1, Math.ceil(total / perPage)) : 1
      if (page > 1) navRows.push({ title: '⬅️ Anterior', description: `Página ${page - 1}/${maxPage}`, rowId: `${usedPrefix}pedidocapslib ${pedidoId} ${baseLibId} ${season} ${page - 1}` })
      if (page < maxPage) navRows.push({ title: '➡️ Siguiente', description: `Página ${page + 1}/${maxPage}`, rowId: `${usedPrefix}pedidocapslib ${pedidoId} ${baseLibId} ${season} ${page + 1}` })
      navRows.push({ title: '🔙 Temporadas', description: 'Volver a temporadas', rowId: `${usedPrefix}pedidotitulo ${pedidoId} ${baseLibId}` })

      const seasonLabel = season === '0' ? 'Sin temporada' : `Temporada ${String(season).padStart(2, '0')}`
      const sections = [{ title: 'Capítulos', rows }]
      if (navRows.length) sections.push({ title: 'Navegación', rows: navRows.slice(0, 10) })

      const ok = await trySendInteractiveList(m, conn, {
        title: '📖 Capítulos',
        text: `*Título:* ${waSafeInline(base?.title || base?.originalName || '')}\n> *Temporada:* _${seasonLabel}_\n> _Selecciona un capítulo para enviarlo._`,
        sections,
      })
      if (ok) return null

      const lines = []
      lines.push('📖 *Capítulos*')
      lines.push(`> *Título:* ${waSafeInline(base?.title || base?.originalName || '')}`)
      lines.push(`> *Temporada:* _${seasonLabel}_`)
      lines.push(`> *Página:* _${page}/${maxPage}_`)
      lines.push('')
      for (const r of rows) lines.push(`> ${r.title} — _${r.description}_`)
      lines.push('')
      lines.push(`> \`\`\`${usedPrefix}seleccionpedido ${pedidoId} lib <idBiblioteca>\`\`\``)
      return m.reply(lines.join('\n'))
    }

    case 'pedidos':
    case 'listpedidos': {
      const pedidos = Object.values(panel.pedidos || {})
        .filter(p => p.estado !== 'cancelado')
        .sort((a, b) => {
          const prioridadOrder = { alta: 0, media: 1, baja: 2 }
          return (prioridadOrder[a.prioridad] ?? 1) - (prioridadOrder[b.prioridad] ?? 1)
        })
        .slice(0, 15)

      if (!pedidos.length) return m.reply(`📋 *Pedidos*\n\n🛡️ _No hay pedidos registrados._`)
      const msg = pedidos.map((p, i) => formatPedido(p, i + 1)).join('\n\n')
      return m.reply(`📋 *Lista de pedidos*\n\n${msg}\n\n👍 *Votar:* \`\`\`${usedPrefix}votarpedido <id>\`\`\``)
    }

    case 'mispedidos': {
      const pedidos = Object.values(panel.pedidos || {})
        .filter(p => p.usuario === m.sender)
        .sort((a, b) => String(b.fecha_creacion || '').localeCompare(String(a.fecha_creacion || '')))
        .slice(0, 10)

      if (!pedidos.length) return m.reply(`📋 *Mis pedidos*\n\n🛡️ _No tienes pedidos registrados._`)
      const msg = pedidos.map((p, i) => formatPedido(p, i + 1)).join('\n\n')
      return m.reply(`📋 *Mis pedidos*\n\n${msg}`)
    }

    case 'verpedido': {
      const id = parseInt(args[0])
      if (!id) return m.reply(`🧾 *Ver pedido*\n\n> \`\`\`${usedPrefix}verpedido <id>\`\`\``)

      const pedido = panel.pedidos[id]
      if (pedido && String(pedido?.estado || '').toLowerCase().trim() === 'completado') {
        return m.reply(`✅ *Pedido ya completado*\n\n> \`\`\`#${id}\`\`\` _${waSafeInline(pedido?.titulo || '')}_`)
      }
      if (!pedido) return m.reply(`❌ *Error*\n\n> _Pedido #${id} no encontrado._`)

      const proveedor = pedido?.proveedor_jid ? (panel?.proveedores?.[pedido.proveedor_jid] || null) : null
      const proveedorTxt = proveedor ? (proveedor.nombre || proveedor.jid) : (pedido?.proveedor_jid || '')

      const lines = []
      lines.push(`🧾 *Pedido* \`\`\`#${id}\`\`\``)
      lines.push('')
      lines.push(`> *Título:* ${waSafeInline(pedido.titulo)}`)
      lines.push(`> *Descripción:* ${truncateText(pedido.descripcion || 'Sin descripción', 220)}`)
      lines.push(`> *Prioridad:* ${prioridadEmoji[pedido.prioridad] || '⚪'} _${waSafeInline(pedido.prioridad || 'media')}_`)
      lines.push(`> *Estado:* ${estadoEmoji[pedido.estado] || '⏳'} _${waSafeInline(pedido.estado || 'pendiente')}_`)
      lines.push(`> *Solicitante:* @${safeString(pedido.usuario || '').split('@')[0] || 'desconocido'}`)
      lines.push(`> *Fecha:* _${formatDate(pedido.fecha_creacion)}_`)
      lines.push(`> *Votos:* _${Number(pedido.votos || 0) || 0}_`)
      if (pedido.grupo_nombre) lines.push(`> *Grupo:* _${waSafeInline(pedido.grupo_nombre)}_`)
      if (proveedorTxt) lines.push(`> *Proveedor:* _${waSafeInline(proveedorTxt)}_`)

      return conn.reply(m.chat, lines.join('\n'), m, { mentions: [pedido.usuario] })
    }

    case 'votarpedido':
    case 'votepedido': {
      const id = parseInt(args[0])
      if (!id) return m.reply(`👍 *Votar pedido*\n\n> \`\`\`${usedPrefix}votarpedido <id>\`\`\``)

      const pedido = panel.pedidos[id]
      if (!pedido) return m.reply(`❌ *Error*\n\n> _Pedido #${id} no encontrado._`)
      if (pedido.estado === 'completado' || pedido.estado === 'cancelado') return m.reply(`❌ *No permitido*\n\n> _No puedes votar por un pedido ${pedido.estado}._`)

      pedido.votantes = pedido.votantes || []
      if (pedido.votantes.includes(m.sender)) return m.reply('❌ *No permitido*\n\n> _Ya votaste por este pedido._')

      pedido.votantes.push(m.sender)
      pedido.votos = (pedido.votos || 0) + 1
      pedido.fecha_actualizacion = new Date().toISOString()
      if (global.db?.write) await global.db.write().catch(() => { })

      try {
        const { emitPedidoUpdated } = await import('../lib/socket-io.js')
        emitPedidoUpdated(pedido)
      } catch { }

      return m.reply(`✅ *Voto registrado*\n\n> *Pedido:* \`\`\`#${id}\`\`\` ${waSafeInline(pedido.titulo)}\n> *Votos:* _${pedido.votos}_`)
    }

    case 'cancelarpedido': {
      const id = parseInt(args[0])
      if (!id) return m.reply(`❌ *Cancelar pedido*\n\n> \`\`\`${usedPrefix}cancelarpedido <id>\`\`\``)

      const pedido = panel.pedidos[id]
      if (!pedido) return m.reply(`❌ *Error*\n\n> _Pedido #${id} no encontrado._`)

      if (pedido.usuario !== m.sender && !isBotOwner) {
        return m.reply('❌ *No permitido*\n\n> _Solo el creador del pedido o el owner puede cancelarlo._')
      }

      pedido.estado = 'cancelado'
      pedido.fecha_actualizacion = new Date().toISOString()
      if (global.db?.write) await global.db.write().catch(() => { })

      try {
        const { emitPedidoUpdated } = await import('../lib/socket-io.js')
        emitPedidoUpdated(pedido)
      } catch { }

      return m.reply(`✅ *Pedido cancelado*\n\n> \`\`\`#${id}\`\`\` ${waSafeInline(pedido.titulo)}`)
    }

    case 'estadopedido': {
      const id = parseInt(args[0])
      const nuevoEstado = safeString(args[1]).toLowerCase().trim()
      if (!id || !nuevoEstado) return m.reply(`🔄 *Cambiar estado*\n\n> \`\`\`${usedPrefix}estadopedido <id> <estado>\`\`\`\n> _Estados: pendiente, en_proceso, completado, cancelado_`)

      const estadosValidos = ['pendiente', 'en_proceso', 'completado', 'cancelado']
      if (!estadosValidos.includes(nuevoEstado)) return m.reply(`❌ *Error*\n\n> _Estado inválido: ${waSafeInline(nuevoEstado)}_`)

      const pedido = panel.pedidos[id]
      if (!pedido) return m.reply(`❌ *Error*\n\n> _Pedido #${id} no encontrado._`)

      const canModerate = isBotOwner || (m.isGroup && isAdmin && String(m.chat) === String(pedido.grupo_id || ''))
      if (!canModerate) return m.reply('❌ *No permitido*\n\n> _Solo el owner o admins del grupo pueden cambiar el estado._')

      pedido.estado = nuevoEstado
      pedido.fecha_actualizacion = new Date().toISOString()
      if (global.db?.write) await global.db.write().catch(() => { })

      try {
        const { emitPedidoUpdated } = await import('../lib/socket-io.js')
        emitPedidoUpdated(pedido)
      } catch { }

      return m.reply(`✅ *Estado actualizado*\n\n> \`\`\`#${id}\`\`\` ${waSafeInline(pedido.titulo)}\n> *Estado:* ${estadoEmoji[nuevoEstado]} _${waSafeInline(nuevoEstado)}_`)
    }

    case 'buscaraporte': {
      const pedidoId = parseInt(args[0])
      if (!pedidoId) return m.reply(`📌 *Buscar aportes*\n\n> \`\`\`${usedPrefix}buscaraporte <idPedido>\`\`\``)

      const pedido = panel.pedidos[pedidoId]
      if (!pedido) return m.reply(`❌ *Error*\n\n> _Pedido #${pedidoId} no encontrado._`)

      const canSeeAll = isBotOwner || (m.isGroup && isAdmin)
      const matches = searchAportesForPedido(pedido, {
        limit: 5,
        includePending: canSeeAll,
        allowPendingUserJid: m.sender,
        allowPendingGroupJid: canSeeAll ? (m.isGroup ? m.chat : null) : null,
      })
      const rows = buildAportesListRows(matches, usedPrefix)
      const sections = rows.length ? [{ title: '📌 Aportes', rows }] : []
      const ok = await trySendInteractiveList(m, conn, {
        title: '📌 Aportes sugeridos',
        text: `*Pedido:* ${waSafeInline(pedido?.titulo || '')}\n> _Selecciona un aporte para ver más info o enviarlo._`,
        sections,
      })
      if (ok) return null
      return m.reply(formatAportesMatches(pedido, matches, usedPrefix))
    }

    case 'enviaraporte': {
      const aporteId = parseInt(args[0])
      if (!aporteId) return m.reply(`📎 *Enviar aporte*\n\n> \`\`\`${usedPrefix}enviaraporte <idAporte>\`\`\``)

      const aportes = Array.isArray(global.db?.data?.aportes) ? global.db.data.aportes : []
      const aporte = aportes.find((a) => Number(a?.id) === aporteId) || null
      if (!aporte) return m.reply(`❌ *Error*\n\n> _Aporte #${aporteId} no encontrado._`)

      const isCreator = String(aporte?.usuario || '') === String(m.sender || '')
      const isApproved = isAporteApproved(aporte)
      const canSend =
        isBotOwner ||
        isCreator ||
        (m.isGroup && isAdmin && isApproved)

      if (!canSend) {
        return m.reply('❌ *No permitido*\n\n> _Solo el owner, el creador, o un admin (si está aprobado) puede enviarlo._')
      }

      const filePath = resolveAporteFilePath(aporte)
      const filename = safeString(aporte?.archivoNombre || `aporte_${aporteId}`)
      const caption =
        `📎 *Aporte* \`\`\`#${aporteId}\`\`\`\n` +
        `> *Título:* ${waSafeInline(aporte?.titulo || '')}\n` +
        `> *Tipo:* _${waSafeInline(aporte?.tipo || 'extra')}_\n` +
        `> *Estado:* _${waSafeInline(aporte?.estado || 'pendiente')}_`

      if (filePath) {
        const sent = await trySendLocalFile(m, conn, filePath, filename, caption)
        if (sent.ok) return null
        const panelUrl = getPanelUrl()
        const url = panelUrl && String(aporte?.archivo || '').startsWith('/media/') ? `${panelUrl}${aporte.archivo}` : safeString(aporte?.archivo || '')
        if (url) return m.reply(`📎 *No pude enviar el archivo*\n\n> *Motivo:* _${waSafeInline(sent.reason)}_\n> *Link:* ${url}`)
        return m.reply(`📎 *No pude enviar el archivo*\n\n> *Motivo:* _${waSafeInline(sent.reason)}_`)
      }

      const panelUrl = getPanelUrl()
      const url = panelUrl && String(aporte?.archivo || '').startsWith('/media/') ? `${panelUrl}${aporte.archivo}` : safeString(aporte?.archivo || '')
      if (url) return m.reply(`${caption}\n\n> *Link:* ${url}`)
      return m.reply('📎 *Error*\n\n> _Este aporte no tiene archivo adjunto._')
    }

    case 'procesarpedido':
    case 'buscarpedido': {
      const id = parseInt(args[0])
      if (!id) return m.reply(`🔎 *Procesar pedido*\n\n> \`\`\`${usedPrefix}${command} <id> [idProveedor|jidProveedor]\`\`\``)

      const pedido = panel.pedidos[id]
      if (!pedido) return m.reply(`❌ *Error*\n\n> _Pedido #${id} no encontrado._`)
      if (String(pedido?.estado || '').toLowerCase().trim() === 'completado') {
        return m.reply(`✅ *Pedido ya completado*\n\n> \`\`\`#${id}\`\`\` _${waSafeInline(pedido?.titulo || '')}_`)
      }

      const isPedidoCreator = String(pedido?.usuario || '') === String(m.sender || '')
      const sameChat = !pedido?.grupo_id || String(pedido.grupo_id) === String(m.chat || '')
      const canProcess = isBotOwner || (m.isGroup && isAdmin) || (isPedidoCreator && sameChat)
      if (!canProcess) return m.reply('❌ *No permitido*\n\n> _Solo admins/owner o el creador del pedido pueden procesarlo._')

      const providerArg = resolveProveedorJid(panel, args[1])
      let targetProviderJid =
        providerArg ||
        pedido.proveedor_jid ||
        ((m.isGroup && panel?.proveedores?.[m.chat]) ? m.chat : null)

      if (!targetProviderJid) {
        const proveedores = Object.values(panel?.proveedores || {})
        if (!proveedores.length) return m.reply('❌ *Error*\n\n> _No hay proveedores configurados._')
        if (proveedores.length === 1 && proveedores[0]?.jid) targetProviderJid = proveedores[0].jid
        else {
          const items = proveedores.slice(0, 10).map((p) => `> \`\`\`${p?.id ?? 'N/A'}\`\`\` ${waSafeInline(p?.nombre || p?.jid || 'Proveedor')}`).join('\n')
          return m.reply(
            `❌ *Pedido sin proveedor*\n\n` +
            `> \`\`\`${usedPrefix}${command} ${id} <idProveedor>\`\`\`\n\n` +
            `📦 *Proveedores*\n${items}`
          )
        }
      }

      const proveedor = panel?.proveedores?.[targetProviderJid] || null
      if (!proveedor) return m.reply('❌ *Error*\n\n> _El proveedor indicado no existe o no está configurado en el panel._')

      const hasStructuredChapter = Boolean(pedido?.capitulo_desde || pedido?.capitulo)
      if (!hasStructuredChapter) {
        pedido.proveedor_jid = targetProviderJid
        pedido.fecha_actualizacion = new Date().toISOString()
        pedido.bot ||= {}
        pedido.bot.browseAt = new Date().toISOString()
        panel.pedidos[id] = pedido
        if (global.db?.write) await global.db.write().catch(() => { })

        try {
          const { emitPedidoUpdated } = await import('../lib/socket-io.js')
          emitPedidoUpdated(pedido)
        } catch { }

        const buckets = searchTitlesInLibrary({
          panel,
          proveedorJid: targetProviderJid,
          titleQuery: pedido?.titulo || '',
          limitTitles: 10,
        })

        const aporteMatches = searchAportesForPedido(pedido, {
          limit: 5,
          allowPendingUserJid: pedido?.usuario || null,
          allowPendingGroupJid: isBotOwner || (m.isGroup && isAdmin) ? (pedido?.grupo_id || null) : null,
        })

        const sections = []
        if (buckets.length === 1) {
          const sampleId = Number(buckets?.[0]?.sampleId)
          const baseItem = sampleId ? panel?.contentLibrary?.[sampleId] : null
          const items = baseItem ? getLibraryItemsByTitleKey(panel, { baseItem, restrictProviderJid: targetProviderJid }) : []
          const seasonRows = buildSeasonsRowsForPedido(items, usedPrefix, id, sampleId)
          if (seasonRows.length) sections.push({ title: '📚 Temporadas', rows: seasonRows })
        } else {
          const titleRows = buildTitleSelectRowsForPedido(buckets, usedPrefix, id)
          if (titleRows.length) sections.push({ title: '📚 Títulos', rows: titleRows })
        }

        const aporteRows = buildAporteSelectRowsForPedido(aporteMatches, usedPrefix, id)
        if (aporteRows.length) sections.push({ title: '📌 Aportes', rows: aporteRows })

        const proveedorTxt = waSafeInline(proveedor?.nombre || proveedor?.jid || targetProviderJid || '')
        const ok = await trySendInteractiveList(m, conn, {
          title: '🔎 Explorar',
          text:
            `*Pedido:* ${waSafeInline(pedido?.titulo || '')}\n` +
            (proveedorTxt ? `> *Proveedor:* _${proveedorTxt}_\n` : '') +
            `> _Selecciona una opción para enviar._`,
          sections,
        })
        if (ok) return null

        if (!sections.length) {
          return m.reply(`🔎 *Explorar*\n\n> *Pedido:* ${waSafeInline(pedido?.titulo || '')}\n\n🛡️ _No encontré coincidencias en biblioteca._`)
        }

        return m.reply(
          `🔎 *Explorar*\n\n` +
          `> *Pedido:* ${waSafeInline(pedido?.titulo || '')}\n` +
          (buckets.length ? `> *Títulos:* _${buckets.length}_\n` : '') +
          `\nSi no te aparece el menú, prueba:\n` +
          `\`\`\`${usedPrefix}pedidotitulo ${id} <idBiblioteca>\`\`\``
        )
      }

      const { query, results } = await searchProviderLibrary(panel, targetProviderJid, pedido, 5)
      const hasMatches = results.length > 0
      pedido.estado = hasMatches ? 'en_proceso' : 'pendiente'
      pedido.fecha_actualizacion = new Date().toISOString()
      pedido.proveedor_jid = targetProviderJid
      pedido.bot = {
        processedAt: new Date().toISOString(),
        query,
        matches: results.map((r) => ({ id: r.it?.id, score: r.score })),
        note: hasMatches ? 'matches_found' : 'no_matches',
      }
      panel.pedidos[id] = pedido
      if (global.db?.write) await global.db.write().catch(() => { })

      try {
        const { emitPedidoUpdated } = await import('../lib/socket-io.js')
        emitPedidoUpdated(pedido)
      } catch { }

      const aporteMatches = searchAportesForPedido(pedido, {
        limit: 5,
        includePending: isBotOwner || (m.isGroup && isAdmin),
        allowPendingUserJid: pedido?.usuario || null,
        allowPendingGroupJid: pedido?.grupo_id || null,
      })

      const libRows = buildLibraryListRows(results, usedPrefix)
      const aporteRows = buildAportesListRows(aporteMatches, usedPrefix)
      const sections = []
      if (libRows.length) sections.push({ title: '📚 Biblioteca', rows: libRows })
      if (aporteRows.length) sections.push({ title: '📌 Aportes', rows: aporteRows })

      const proveedorTxt = waSafeInline(proveedor?.nombre || proveedor?.jid || targetProviderJid || '')
      const ok = await trySendInteractiveList(m, conn, {
        title: '🔎 Coincidencias',
        text:
          `*Pedido:* ${waSafeInline(pedido?.titulo || '')}\n` +
          (proveedorTxt ? `> *Proveedor:* _${proveedorTxt}_\n` : '') +
          `> _Selecciona una opción para ver más info._`,
        sections,
      })
      if (ok) return null

      let msg = formatSearchResults(pedido, query, results, usedPrefix, targetProviderJid)
      if (aporteMatches.length) msg = `${msg}\n\n${formatAportesMatches(pedido, aporteMatches, usedPrefix)}`
      return m.reply(msg)
    }

    case 'infolib': {
      const libId = parseInt(args[0])
      if (!libId) return m.reply(`📚 *Info de biblioteca*\n\n> \`\`\`${usedPrefix}infolib <id>\`\`\``)

      const item = panel?.contentLibrary?.[libId] || null
      if (!item) return m.reply(`❌ *Error*\n\n> _Archivo #${libId} no encontrado en biblioteca._`)

      if (m.isGroup && !isBotOwner && String(item?.proveedorJid || '') !== String(m.chat || '')) {
        return m.reply('❌ *No permitido*\n\n> _Este archivo pertenece a otro proveedor._')
      }

      const proveedor = item?.proveedorJid ? (panel?.proveedores?.[item.proveedorJid] || null) : null
      const proveedorTxt = waSafeInline(proveedor?.nombre || proveedor?.jid || item?.proveedorJid || '')
      const tags = Array.isArray(item?.tags) ? item.tags.map((t) => waSafeInline(t)).filter(Boolean).slice(0, 12) : []

      let sizeTxt = ''
      try {
        const fp = item?.file_path
        if (fp && fs.existsSync(fp)) {
          const st = fs.statSync(fp)
          if (st.isFile()) sizeTxt = `${Math.round(st.size / 1024 / 1024)}MB`
        }
      } catch { }

      const lines = []
      lines.push(`📚 *Biblioteca* \`\`\`#${libId}\`\`\``)
      if (item?.title) lines.push(`> *Título:* ${waSafeInline(item.title)}`)
      if (item?.season != null && String(item.season).trim()) lines.push(`> *Temporada:* _${waSafeInline(item.season)}_`)
      if (item?.chapter != null && String(item.chapter).trim()) lines.push(`> *Capítulo:* _${waSafeInline(item.chapter)}_`)
      if (item?.category) lines.push(`> *Categoría:* _${waSafeInline(item.category)}_`)
      if (proveedorTxt) lines.push(`> *Proveedor:* _${proveedorTxt}_`)
      if (tags.length) lines.push(`> *Tags:* _${waSafeInline(tags.join(', '))}_`)
      if (item?.originalName) lines.push(`> *Archivo:* _${waSafeInline(item.originalName)}_`)
      if (sizeTxt) lines.push(`> *Tamaño:* _${sizeTxt}_`)

      const actionRows = [
        { title: '📥 Enviar archivo', description: 'Enviar el archivo por WhatsApp', rowId: `${usedPrefix}enviarlib ${libId}` },
        { title: '🔎 Más por título', description: 'Buscar más coincidencias del título', rowId: `${usedPrefix}libtitulo ${libId}` },
      ]
      if (item?.proveedorJid) {
        actionRows.splice(1, 0, { title: '📚 Más del proveedor', description: 'Ver más archivos del proveedor', rowId: `${usedPrefix}libproveedor ${item.proveedorJid}` })
      }

      const ok = await trySendInteractiveList(m, conn, {
        title: '📚 Opciones',
        text: lines.join('\n'),
        sections: [{ title: 'Acciones', rows: actionRows.slice(0, 10) }],
      })
      if (ok) return null

      lines.push('')
      lines.push(`> \`\`\`${usedPrefix}enviarlib ${libId}\`\`\``)
      if (item?.proveedorJid) lines.push(`> \`\`\`${usedPrefix}libproveedor ${item.proveedorJid}\`\`\``)
      lines.push(`> \`\`\`${usedPrefix}libtitulo ${libId}\`\`\``)
      return m.reply(lines.join('\n'))
    }

    case 'libproveedor': {
      const proveedorJid = resolveProveedorJid(panel, args[0]) || safeString(args[0]).trim()
      if (!proveedorJid) return m.reply(`📚 *Biblioteca por proveedor*\n\n> \`\`\`${usedPrefix}libproveedor <idProveedor|jidProveedor>\`\`\``)

      if (m.isGroup && !isBotOwner && String(proveedorJid || '') !== String(m.chat || '')) {
        return m.reply('❌ *No permitido*\n\n> _Este proveedor no corresponde a este grupo._')
      }

      const proveedor = panel?.proveedores?.[proveedorJid] || null
      const proveedorTxt = waSafeInline(proveedor?.nombre || proveedor?.jid || proveedorJid || '')
      const items = Object.values(panel?.contentLibrary || {})
        .filter((it) => String(it?.proveedorJid || '') === String(proveedorJid || ''))
        .sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0))

      const rows = buildLibraryRowsFromItems(items, usedPrefix)
      const sections = rows.length ? [{ title: '📚 Biblioteca', rows }] : []
      const ok = await trySendInteractiveList(m, conn, {
        title: '📚 Biblioteca',
        text: `*Proveedor:* _${proveedorTxt}_\n> _Selecciona un archivo para ver más info._`,
        sections,
      })
      if (ok) return null

      const lines = []
      lines.push('📚 *Biblioteca*')
      lines.push(`> *Proveedor:* _${proveedorTxt}_`)
      if (!items.length) {
        lines.push('')
        lines.push('🛡️ _No hay archivos en este proveedor._')
        return m.reply(lines.join('\n'))
      }
      lines.push('')
      for (const it of items.slice(0, 10)) {
        lines.push(`> \`\`\`#${it.id}\`\`\` ${waSafeInline(it.title || it.originalName || `Archivo #${it.id}`)}`)
      }
      lines.push('')
      lines.push(`> \`\`\`${usedPrefix}infolib <id>\`\`\``)
      return m.reply(lines.join('\n'))
    }

    case 'libtitulo': {
      const libId = parseInt(args[0])
      if (!libId) return m.reply(`🔎 *Buscar por título*\n\n> \`\`\`${usedPrefix}libtitulo <idBiblioteca>\`\`\``)

      const base = panel?.contentLibrary?.[libId] || null
      if (!base) return m.reply(`❌ *Error*\n\n> _Archivo #${libId} no encontrado en biblioteca._`)

      if (m.isGroup && !isBotOwner && String(base?.proveedorJid || '') !== String(m.chat || '')) {
        return m.reply('❌ *No permitido*\n\n> _Este archivo pertenece a otro proveedor._')
      }

      const providerJid = base?.proveedorJid || null
      const baseTitle = safeString(base?.title || base?.originalName || '').trim()
      const norm = normalizeText(baseTitle)
      if (!norm) return m.reply('❌ *Error*\n\n> _No pude inferir el título para buscar._')

      const items = Object.values(panel?.contentLibrary || {})
        .filter((it) => Number(it?.id || 0) !== libId)
        .filter((it) => (providerJid ? String(it?.proveedorJid || '') === String(providerJid) : true))
        .filter((it) => normalizeText(it?.title || it?.originalName || '').includes(norm))
        .sort((a, b) => Number(b?.id || 0) - Number(a?.id || 0))

      const rows = buildLibraryRowsFromItems(items, usedPrefix)
      const sections = rows.length ? [{ title: '🔎 Coincidencias', rows }] : []
      const ok = await trySendInteractiveList(m, conn, {
        title: '🔎 Por título',
        text: `*Título:* ${waSafeInline(baseTitle)}\n> _Selecciona un archivo para ver más info._`,
        sections,
      })
      if (ok) return null

      if (!items.length) return m.reply(`🔎 *Por título*\n\n> *Título:* ${waSafeInline(baseTitle)}\n\n🛡️ _No encontré más coincidencias._`)
      const lines = []
      lines.push('🔎 *Por título*')
      lines.push(`> *Título:* ${waSafeInline(baseTitle)}`)
      lines.push('')
      for (const it of items.slice(0, 10)) {
        lines.push(`> \`\`\`#${it.id}\`\`\` ${waSafeInline(it.title || it.originalName || `Archivo #${it.id}`)}`)
      }
      lines.push('')
      lines.push(`> \`\`\`${usedPrefix}infolib <id>\`\`\``)
      return m.reply(lines.join('\n'))
    }

    case 'infoaporte': {
      const aporteId = parseInt(args[0])
      if (!aporteId) return m.reply(`📌 *Info de aporte*\n\n> \`\`\`${usedPrefix}infoaporte <idAporte>\`\`\``)

      const aportes = Array.isArray(global.db?.data?.aportes) ? global.db.data.aportes : []
      const aporte = aportes.find((a) => Number(a?.id) === aporteId) || null
      if (!aporte) return m.reply(`❌ *Error*\n\n> _Aporte #${aporteId} no encontrado._`)

      const canView = isAporteVisibleToUser(aporte, { m, isBotOwner, isAdmin })
      if (!canView) return m.reply('❌ *No permitido*\n\n> _No tienes acceso a este aporte._')

      const tags = Array.isArray(aporte?.tags) ? aporte.tags.map((t) => waSafeInline(t)).filter(Boolean).slice(0, 12) : []
      const fecha = formatDate(aporte?.fecha || aporte?.fecha_creacion || aporte?.created_at)
      const lines = []
      lines.push(`📌 *Aporte* \`\`\`#${aporteId}\`\`\``)
      if (aporte?.titulo) lines.push(`> *Título:* ${waSafeInline(aporte.titulo)}`)
      if (aporte?.tipo) lines.push(`> *Tipo:* _${waSafeInline(aporte.tipo)}_`)
      if (aporte?.temporada != null && String(aporte.temporada).trim()) lines.push(`> *Temporada:* _${waSafeInline(aporte.temporada)}_`)
      if (aporte?.capitulo != null && String(aporte.capitulo).trim()) lines.push(`> *Capítulo:* _${waSafeInline(aporte.capitulo)}_`)
      if (aporte?.estado) lines.push(`> *Estado:* _${waSafeInline(aporte.estado)}_`)
      if (fecha && fecha !== '-') lines.push(`> *Fecha:* _${fecha}_`)
      if (aporte?.usuario) lines.push(`> *Usuario:* @${safeString(aporte.usuario).split('@')[0]}`)
      if (aporte?.categoria) lines.push(`> *Categoría:* _${waSafeInline(aporte.categoria)}_`)
      if (tags.length) lines.push(`> *Tags:* _${waSafeInline(tags.join(', '))}_`)
      if (aporte?.contenido) lines.push(`> *Contenido:* ${truncateText(aporte.contenido, 220)}`)
      if (aporte?.archivoNombre) lines.push(`> *Archivo:* _${waSafeInline(aporte.archivoNombre)}_`)

      const actionRows = [
        { title: '📎 Enviar archivo', description: 'Enviar el adjunto (si existe)', rowId: `${usedPrefix}enviaraporte ${aporteId}` },
        { title: '👤 Más del usuario', description: 'Ver más aportes de este usuario', rowId: `${usedPrefix}aportesde ${aporteId}` },
        { title: '📚 Temporadas del título', description: 'Ver todas las temporadas de este título', rowId: `${usedPrefix}aportestemporadas ${aporteId}` },
      ]
      if (aporte?.temporada != null && String(aporte.temporada).trim()) {
        actionRows.push({
          title: '📖 Capítulos de esta temporada',
          description: 'Ver capítulos dentro de la temporada',
          rowId: `${usedPrefix}aportescaps ${aporteId} ${normalizeSeason(aporte.temporada) || '0'}`,
        })
      }

      const ok = await trySendInteractiveList(m, conn, {
        title: '📌 Opciones',
        text: lines.join('\n'),
        sections: [{ title: 'Acciones', rows: actionRows.slice(0, 10) }],
      })
      if (ok) return null

      lines.push('')
      lines.push(`> \`\`\`${usedPrefix}enviaraporte ${aporteId}\`\`\``)
      lines.push(`> \`\`\`${usedPrefix}aportesde ${aporteId}\`\`\``)
      lines.push(`> \`\`\`${usedPrefix}aportestemporadas ${aporteId}\`\`\``)
      if (aporte?.temporada != null && String(aporte.temporada).trim()) lines.push(`> \`\`\`${usedPrefix}aportescaps ${aporteId} ${normalizeSeason(aporte.temporada) || '0'}\`\`\``)
      return m.reply(lines.join('\n'))
    }

    case 'aportesde': {
      const aporteId = parseInt(args[0])
      if (!aporteId) return m.reply(`👤 *Aportes de usuario*\n\n> \`\`\`${usedPrefix}aportesde <idAporte>\`\`\``)

      const aportes = Array.isArray(global.db?.data?.aportes) ? global.db.data.aportes : []
      const base = aportes.find((a) => Number(a?.id) === aporteId) || null
      if (!base) return m.reply(`❌ *Error*\n\n> _Aporte #${aporteId} no encontrado._`)

      const usuario = safeString(base?.usuario || '').trim()
      if (!usuario) return m.reply('❌ *Error*\n\n> _Este aporte no tiene usuario._')

      const isSelf = String(usuario) === String(m.sender || '')
      const canSeeAll = isBotOwner || isSelf || (m.isGroup && isAdmin)

      const list = aportes
        .filter((a) => String(a?.usuario || '') === String(usuario))
        .filter((a) => (canSeeAll ? true : isAporteApproved(a)))
        .filter((a) => {
          if (!m.isGroup) return true
          if (canSeeAll) return true
          return !a?.grupo || String(a.grupo) === String(m.chat)
        })
        .sort((a, b) => String(b?.fecha || b?.fecha_creacion || b?.created_at || '').localeCompare(String(a?.fecha || a?.fecha_creacion || a?.created_at || '')))

      const rows = buildAporteRowsFromItems(list, usedPrefix)
      const sections = rows.length ? [{ title: '📌 Aportes', rows }] : []
      const ok = await trySendInteractiveList(m, conn, {
        title: '👤 Aportes',
        text: `*Usuario:* @${safeString(usuario).split('@')[0]}\n> _Selecciona un aporte para ver más info._`,
        sections,
      })
      if (ok) return null

      if (!list.length) return m.reply(`👤 *Aportes*\n\n> *Usuario:* @${safeString(usuario).split('@')[0]}\n\n🛡️ _No hay aportes para mostrar._`)
      const lines = []
      lines.push('👤 *Aportes*')
      lines.push(`> *Usuario:* @${safeString(usuario).split('@')[0]}`)
      lines.push('')
      for (const a of list.slice(0, 10)) {
        lines.push(`> \`\`\`#${a.id}\`\`\` ${truncateText(a.titulo || a.contenido || `Aporte #${a.id}`, 46)}`)
      }
      lines.push('')
      lines.push(`> \`\`\`${usedPrefix}infoaporte <idAporte>\`\`\``)
      return m.reply(lines.join('\n'))
    }

    case 'aportestemporadas': {
      const aporteId = parseInt(args[0])
      if (!aporteId) return m.reply(`📚 *Temporadas*\n\n> \`\`\`${usedPrefix}aportestemporadas <idAporte>\`\`\``)

      const aportes = Array.isArray(global.db?.data?.aportes) ? global.db.data.aportes : []
      const base = aportes.find((a) => Number(a?.id) === aporteId) || null
      if (!base) return m.reply(`❌ *Error*\n\n> _Aporte #${aporteId} no encontrado._`)
      if (!isAporteVisibleToUser(base, { m, isBotOwner, isAdmin })) return m.reply('❌ *No permitido*\n\n> _No tienes acceso a este aporte._')

      const titleKey = normalizeText(base?.titulo || '')
      if (!titleKey) return m.reply('❌ *Error*\n\n> _Este aporte no tiene título para agrupar._')

      const sameTitle = aportes
        .filter((a) => normalizeText(a?.titulo || '') === titleKey)
        .filter((a) => isAporteVisibleToUser(a, { m, isBotOwner, isAdmin }))
        .filter((a) => {
          if (!m.isGroup) return true
          if (isBotOwner || isAdmin) return true
          return !a?.grupo || String(a.grupo) === String(m.chat)
        })

      const grouped = new Map()
      for (const a of sameTitle) {
        const season = normalizeSeason(a?.temporada) || '0'
        const entry = grouped.get(season) || { season, aportes: [] }
        entry.aportes.push(a)
        grouped.set(season, entry)
      }

      const seasons = [...grouped.values()].sort((a, b) => Number(a.season) - Number(b.season))
      if (!seasons.length) return m.reply('📚 *Temporadas*\n\n🛡️ _No hay aportes para mostrar._')

      const rows = seasons.slice(0, 10).map((g) => {
        const seasonLabel = g.season === '0' ? 'Sin temporada' : `Temporada ${String(g.season).padStart(2, '0')}`
        const chapterNums = g.aportes.map((x) => normalizeChapter(x?.capitulo)).filter(Boolean).map(Number).filter((n) => Number.isFinite(n))
        chapterNums.sort((x, y) => x - y)
        const capTxt = chapterNums.length
          ? `Caps: ${chapterNums[0]}-${chapterNums[chapterNums.length - 1]} (${chapterNums.length})`
          : `Aportes: ${g.aportes.length}`
        return {
          title: seasonLabel,
          description: truncateText(capTxt, 60),
          rowId: `${usedPrefix}aportescaps ${aporteId} ${g.season}`,
        }
      })

      const ok = await trySendInteractiveList(m, conn, {
        title: '📚 Temporadas',
        text: `*Título:* ${waSafeInline(base.titulo)}\n> _Selecciona una temporada para ver capítulos._`,
        sections: [{ title: 'Temporadas', rows }],
      })
      if (ok) return null

      const lines = []
      lines.push('📚 *Temporadas*')
      lines.push(`> *Título:* ${waSafeInline(base.titulo)}`)
      lines.push('')
      for (const r of rows) lines.push(`> ${r.title} — _${r.description}_`)
      lines.push('')
      lines.push(`> \`\`\`${usedPrefix}aportescaps ${aporteId} <temporada>\`\`\``)
      return m.reply(lines.join('\n'))
    }

    case 'aportescaps': {
      const aporteId = parseInt(args[0])
      const seasonArg = safeString(args[1] || '').trim()
      if (!aporteId) return m.reply(`📖 *Capítulos*\n\n> \`\`\`${usedPrefix}aportescaps <idAporte> <temporada>\`\`\``)

      const aportes = Array.isArray(global.db?.data?.aportes) ? global.db.data.aportes : []
      const base = aportes.find((a) => Number(a?.id) === aporteId) || null
      if (!base) return m.reply(`❌ *Error*\n\n> _Aporte #${aporteId} no encontrado._`)
      if (!isAporteVisibleToUser(base, { m, isBotOwner, isAdmin })) return m.reply('❌ *No permitido*\n\n> _No tienes acceso a este aporte._')

      const titleKey = normalizeText(base?.titulo || '')
      if (!titleKey) return m.reply('❌ *Error*\n\n> _Este aporte no tiene título para agrupar._')

      const season = normalizeSeason(seasonArg) || (seasonArg === '0' ? '0' : normalizeSeason(base?.temporada) || '0')

      const list = aportes
        .filter((a) => normalizeText(a?.titulo || '') === titleKey)
        .filter((a) => (normalizeSeason(a?.temporada) || '0') === String(season))
        .filter((a) => isAporteVisibleToUser(a, { m, isBotOwner, isAdmin }))
        .filter((a) => {
          if (!m.isGroup) return true
          if (isBotOwner || isAdmin) return true
          return !a?.grupo || String(a.grupo) === String(m.chat)
        })
        .sort((a, b) => {
          const ac = normalizeChapter(a?.capitulo)
          const bc = normalizeChapter(b?.capitulo)
          if (ac && bc) return Number(ac) - Number(bc)
          if (ac && !bc) return -1
          if (!ac && bc) return 1
          return String(a?.fecha || a?.fecha_creacion || a?.created_at || '').localeCompare(String(b?.fecha || b?.fecha_creacion || b?.created_at || ''))
        })

      if (!list.length) {
        const seasonLabel = season === '0' ? 'Sin temporada' : `Temporada ${String(season).padStart(2, '0')}`
        return m.reply(`📖 *Capítulos*\n\n> *Título:* ${waSafeInline(base.titulo)}\n> *Temporada:* _${seasonLabel}_\n\n🛡️ _No hay capítulos para mostrar._`)
      }

      const rows = list.slice(0, 10).map((a) => {
        const cap = normalizeChapter(a?.capitulo)
        const capLabel = cap ? `Capítulo ${String(cap).padStart(4, '0')}` : `Aporte #${a.id}`
        const descParts = []
        if (a?.archivoNombre) descParts.push(waSafeInline(a.archivoNombre))
        if (a?.estado) descParts.push(waSafeInline(a.estado))
        const fecha = formatDate(a?.fecha || a?.fecha_creacion || a?.created_at)
        if (fecha && fecha !== '-') descParts.push(fecha)
        return {
          title: capLabel,
          description: truncateText(descParts.filter(Boolean).join(' · '), 60),
          rowId: `${usedPrefix}infoaporte ${a.id}`,
        }
      })

      const seasonLabel = season === '0' ? 'Sin temporada' : `Temporada ${String(season).padStart(2, '0')}`
      const ok = await trySendInteractiveList(m, conn, {
        title: '📖 Capítulos',
        text: `*Título:* ${waSafeInline(base.titulo)}\n> *Temporada:* _${seasonLabel}_\n> _Selecciona un capítulo._`,
        sections: [{ title: 'Capítulos', rows }],
      })
      if (ok) return null

      const lines = []
      lines.push('📖 *Capítulos*')
      lines.push(`> *Título:* ${waSafeInline(base.titulo)}`)
      lines.push(`> *Temporada:* _${seasonLabel}_`)
      lines.push('')
      for (const r of rows) lines.push(`> ${r.title} — _${r.description}_`)
      lines.push('')
      lines.push(`> \`\`\`${usedPrefix}infoaporte <idAporte>\`\`\``)
      return m.reply(lines.join('\n'))
    }

    case 'enviarlib': {
      const libId = parseInt(args[0])
      if (!libId) return m.reply(`📥 *Enviar archivo de biblioteca*\n\n> \`\`\`${usedPrefix}enviarlib <id>\`\`\``)
      const item = panel?.contentLibrary?.[libId] || null
      if (!item) return m.reply(`❌ *Error*\n\n> _Archivo #${libId} no encontrado en biblioteca._`)

      if (m.isGroup && !isBotOwner && String(item?.proveedorJid || '') !== String(m.chat || '')) {
        return m.reply('❌ *No permitido*\n\n> _Este archivo pertenece a otro proveedor._')
      }

      const sent = await trySendLibraryItem(m, conn, item)
      if (sent.ok) return null

      const panelUrl = getPanelUrl()
      if (panelUrl && item?.url) {
        return m.reply(`📎 *No pude enviar el archivo*\n\n> *Motivo:* _${waSafeInline(sent.reason)}_\n> *Link:* ${panelUrl}${item.url}`)
      }
      return m.reply(`📎 *No pude enviar el archivo*\n\n> *Motivo:* _${waSafeInline(sent.reason)}_`)
    }

    default:
      return null
  }
}

handler.help = [
  'pedido',
  'pedidos',
  'mispedidos',
  'verpedido',
  'votarpedido',
  'cancelarpedido',
  'estadopedido',
  'seleccionpedido',
  'pedidotitulo',
  'pedidocapslib',
  'procesarpedido',
  'infolib',
  'libproveedor',
  'libtitulo',
  'enviarlib',
  'buscaraporte',
  'infoaporte',
  'aportestemporadas',
  'aportescaps',
  'aportesde',
  'enviaraporte',
]
handler.tags = ['tools']
handler.command = [
  'pedido',
  'pedir',
  'pedidos',
  'listpedidos',
  'mispedidos',
  'verpedido',
  'votarpedido',
  'votepedido',
  'cancelarpedido',
  'estadopedido',
  'seleccionpedido',
  'pedidotitulo',
  'pedidocapslib',
  'procesarpedido',
  'buscarpedido',
  'infolib',
  'libproveedor',
  'libtitulo',
  'enviarlib',
  'buscaraporte',
  'infoaporte',
  'aportestemporadas',
  'aportescaps',
  'aportesde',
  'enviaraporte',
]

export default handler
