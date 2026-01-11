import fs from 'fs'
import path from 'path'
import mimeTypes from 'mime-types'
import { createMachine, fromPromise, interpret } from 'xstate'
import { classifyProviderLibraryContent } from '../lib/provider-content-classifier.js'
import { generatePedidoPDF } from '../lib/pedido-pdf.js'

const safeString = (v) => (v == null ? '' : typeof v === 'string' ? v : String(v))

const waSafeInline = (v) => safeString(v).replace(/\s+/g, ' ').replace(/[*_~`]/g, '').trim()

const userKey = (jid) => safeString(jid || '').split('@')[0].replace(/\D/g, '')

const sameUser = (a, b) => {
  const ak = userKey(a)
  const bk = userKey(b)
  if (!ak || !bk) return safeString(a) === safeString(b)
  return ak === bk
}

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

// -----------------------------
// Coverage / Ranges / Packs
// -----------------------------

const COVERAGE_TYPES = {
  SINGLE_CHAPTER: 'SINGLE_CHAPTER',
  CHAPTER_RANGE: 'CHAPTER_RANGE',
  FULL_SEASON: 'FULL_SEASON',
  FULL_SERIES: 'FULL_SERIES',
  VOLUME: 'VOLUME',
  COMPLETE_PACK: 'COMPLETE_PACK',
  UNKNOWN: 'UNKNOWN',
}

const normalizeForRangeParsing = (rawText) => safeString(rawText || '')
  .normalize('NFKC')
  .replace(/[–—−]/g, '-')
  .replace(/[_|]+/g, ' ')
  .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase()

const hasCompleteKeyword = (rawText) => {
  const t = normalizeText(rawText || '')
  if (!t) return false
  return /\b(completo|completa|complete|full|all\s*chapters|todos?|todo|final|finished)\b/u.test(t)
}

const extractSeasonFromTextRobust = (rawText) => {
  const t = normalizeForRangeParsing(rawText)
  if (!t) return null
  // "temporada 2", "season 2", "temp 02"
  let m = t.match(/\b(?:temporada|temp(?:orada)?|season)\s*0*(\d{1,2})\b/i)
  if (m) return normalizeSeason(m[1])
  // "t02", "s2", "t 02", "s 2"
  m = t.match(/\b(?:t|s)\s*0*(\d{1,2})\b/i)
  if (m) return normalizeSeason(m[1])
  return null
}

const isLikelyDateLikeRange = (a, b) => {
  const x = Number(a)
  const y = Number(b)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false
  const isYear = (n) => n >= 1900 && n <= 2100
  const isMonthOrDay = (n) => n >= 1 && n <= 31
  return (isYear(x) && isMonthOrDay(y)) || (isYear(y) && isMonthOrDay(x))
}

const extractChapterRangeFromText = (rawText) => {
  const t = normalizeForRangeParsing(rawText)
  if (!t) return null

  // 1) Explícito: "cap 1-20", "caps 001-050", "ch 5-12"
  let m = t.match(/\b(?:cap(?:itulo)?s?|chapters?|ch(?:apter)?s?|eps?|episodes?)\b\s*0*(\d{1,4})\s*(?:-|a|to)\s*0*(\d{1,4})\b/i)
  if (m) {
    const from = normalizeChapter(m[1])
    const to = normalizeChapter(m[2])
    if (from && to) return Number(from) <= Number(to) ? { from, to } : { from: to, to: from }
  }

  // 2) Genérico: "01-108" (solo si el texto tiene señales de capítulos o de pack completo)
  const looksChaptery = /\b(cap(?:itulo)?s?|chapter(?:s)?|ch(?:apter)?|eps?|episodes?)\b/u.test(t)
  const looksPacky = hasCompleteKeyword(t) || /\b(pack|bundle|合集)\b/u.test(t)

  const re = /0*(\d{1,4})\s*-\s*0*(\d{1,4})/g
  m = re.exec(t)
  if (!m) return null
  const from = normalizeChapter(m[1])
  const to = normalizeChapter(m[2])
  if (!from || !to) return null
  const atStart = (m.index != null) ? m.index <= 2 : false
  const likelyRangeToken = atStart || looksChaptery || looksPacky
  if (!likelyRangeToken) return null
  if (isLikelyDateLikeRange(from, to)) return null
  return Number(from) <= Number(to) ? { from, to } : { from: to, to: from }
}

const extractSingleChapterFromText = (rawText, { contentType = 'main' } = {}) => {
  const raw = safeString(rawText || '').trim()
  if (!raw) return null

  const low = normalizeText(raw)
  if (contentType !== 'main') return null
  if (/\b(extra|especial|special|side|bonus|omake|epilogue|prologue|spin\s*off|spinoff|illustration|ilustr)\b/u.test(low)) return null
  if (hasCompleteKeyword(low)) return null
  if (extractChapterRangeFromText(raw)) return null

  // prefer explícitos
  const t = normalizeForRangeParsing(raw)
  const m1 = t.match(/\b(?:cap(?:itulo)?|chapter|ch)\s*0*(\d{1,4})\b/i)
  if (m1) {
    const ch = normalizeChapter(m1[1])
    const n = ch ? Number(ch) : NaN
    if (Number.isFinite(n) && !(n >= 1900 && n <= 2100)) return ch
  }

  // prefijo numérico (ej: 05_ ...), evitando años
  const m2 = t.match(/^\s*0*(\d{1,4})\s*[_\-]/)
  if (m2) {
    const ch = normalizeChapter(m2[1])
    const n = ch ? Number(ch) : NaN
    if (Number.isFinite(n) && !(n >= 1900 && n <= 2100)) return ch
  }

  return null
}

const extractVolumeFromText = (rawText) => {
  const t = normalizeForRangeParsing(rawText)
  if (!t) return null
  const m = t.match(/\b(?:vol(?:ume)?|volumen|tomo)\s*0*(\d{1,3})\b/i)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n <= 0) return null
  return String(n)
}

const getFileMeasures = (filePath) => {
  try {
    if (!filePath || !fs.existsSync(filePath)) return { sizeBytes: null, sizeMB: null, pageCount: null }
    const st = fs.statSync(filePath)
    if (!st.isFile()) return { sizeBytes: null, sizeMB: null, pageCount: null }
    const sizeBytes = Number(st.size) || 0
    const sizeMB = Math.round((sizeBytes / 1024 / 1024) * 10) / 10
    return { sizeBytes, sizeMB, pageCount: null }
  } catch {
    return { sizeBytes: null, sizeMB: null, pageCount: null }
  }
}

const quickPdfPageCount = (filePath) => {
  try {
    const ext = getFileExtUpper(filePath || '')
    if (ext !== 'PDF') return null
    const fd = fs.openSync(filePath, 'r')
    try {
      const maxBytes = 2 * 1024 * 1024
      const buf = Buffer.allocUnsafe(maxBytes)
      const bytesRead = fs.readSync(fd, buf, 0, maxBytes, 0)
      const chunk = buf.subarray(0, Math.max(0, bytesRead)).toString('latin1')
      let max = 0
      const re = /\/Count\s+(\d{1,6})/g
      let m
      while ((m = re.exec(chunk))) {
        const n = Number(m[1])
        if (Number.isFinite(n) && n > max) max = n
      }
      return max > 0 ? max : null
    } finally {
      fs.closeSync(fd)
    }
  } catch {
    return null
  }
}

const classifyCoverageFromItemText = ({ rawText, contentType = 'main', explicitSeason = null, explicitChapter = null, filePath = null } = {}) => {
  const type = safeString(contentType || 'main').toLowerCase().trim() || 'main'
  const baseText = safeString(rawText || '').trim()

  const season = normalizeSeason(explicitSeason) || extractSeasonFromTextRobust(baseText) || '0'
  if (type !== 'main') {
    return { coverageType: COVERAGE_TYPES.UNKNOWN, season, chapterFrom: null, chapterTo: null, inferredCoverage: false, isComplete: false, volume: null, measures: null }
  }

  const volume = extractVolumeFromText(baseText)
  const complete = hasCompleteKeyword(baseText)
  const range = extractChapterRangeFromText(baseText)
  const single = range ? null : (normalizeChapter(explicitChapter) || extractSingleChapterFromText(baseText, { contentType: type }))

  let coverageType = COVERAGE_TYPES.UNKNOWN
  let chapterFrom = null
  let chapterTo = null
  let inferredCoverage = false

  if (volume) {
    coverageType = COVERAGE_TYPES.VOLUME
  } else if (range) {
    chapterFrom = range.from
    chapterTo = range.to
    inferredCoverage = true
    const fromN = Number(chapterFrom)
    const toN = Number(chapterTo)
    const isLargeFromOne = Number.isFinite(fromN) && Number.isFinite(toN) && fromN === 1 && toN >= 20
    if (complete || isLargeFromOne) {
      coverageType = season && season !== '0' ? COVERAGE_TYPES.FULL_SEASON : COVERAGE_TYPES.COMPLETE_PACK
    } else {
      coverageType = COVERAGE_TYPES.CHAPTER_RANGE
    }
  } else if (complete) {
    inferredCoverage = true
    coverageType = season && season !== '0' ? COVERAGE_TYPES.FULL_SEASON : COVERAGE_TYPES.COMPLETE_PACK
  } else if (single) {
    chapterFrom = String(single)
    chapterTo = String(single)
    coverageType = COVERAGE_TYPES.SINGLE_CHAPTER
  }

  // Heurística por medidas (si existe un archivo local) para evitar falsos positivos (packs).
  let measures = null
  if (filePath && (coverageType === COVERAGE_TYPES.CHAPTER_RANGE || coverageType === COVERAGE_TYPES.FULL_SEASON || coverageType === COVERAGE_TYPES.COMPLETE_PACK || coverageType === COVERAGE_TYPES.UNKNOWN)) {
    const m = getFileMeasures(filePath)
    const pageCount = quickPdfPageCount(filePath)
    measures = { ...m, pageCount }
    const sizeMB = Number(measures?.sizeMB || 0)
    const pages = Number(measures?.pageCount || 0)
    if ((pages && pages >= 200) || (sizeMB && sizeMB >= 30)) {
      if (coverageType === COVERAGE_TYPES.SINGLE_CHAPTER) {
        // no degradar single explícito
      } else if (coverageType === COVERAGE_TYPES.UNKNOWN && (complete || range)) {
        coverageType = season && season !== '0' ? COVERAGE_TYPES.FULL_SEASON : COVERAGE_TYPES.COMPLETE_PACK
        inferredCoverage = true
      } else if (coverageType === COVERAGE_TYPES.CHAPTER_RANGE) {
        coverageType = season && season !== '0' ? COVERAGE_TYPES.FULL_SEASON : COVERAGE_TYPES.COMPLETE_PACK
        inferredCoverage = true
      }
    }
  }

  const normalizedType =
    (coverageType === COVERAGE_TYPES.COMPLETE_PACK && /\bseries\b/u.test(normalizeText(baseText || '')))
      ? COVERAGE_TYPES.FULL_SERIES
      : coverageType

  return { coverageType: normalizedType, season, chapterFrom, chapterTo, inferredCoverage, isComplete: Boolean(complete), volume: volume || null, measures }
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

const extractInteractiveSelectionId = (m) => {
  try {
    const msg =
      m?.msg ||
      m?.message?.interactiveResponseMessage ||
      m?.message ||
      null

    if (!msg || typeof msg !== 'object') return null

    const direct =
      msg?.buttonsResponseMessage?.selectedButtonId ||
      msg?.templateButtonReplyMessage?.selectedId ||
      msg?.listResponseMessage?.singleSelectReply?.selectedRowId ||
      msg?.singleSelectReply?.selectedRowId ||
      msg?.selectedButtonId ||
      msg?.selectedRowId ||
      msg?.selectedId ||
      null

    if (typeof direct === 'string' && direct.trim()) return direct.trim()

    const paramsJson =
      msg?.nativeFlowResponseMessage?.paramsJson ||
      msg?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
      msg?.interactiveResponseMessage?.paramsJson ||
      msg?.paramsJson ||
      null

    if (typeof paramsJson === 'string' && paramsJson.trim()) {
      try {
        const parsed = JSON.parse(paramsJson)
        const id =
          parsed?.id ||
          parsed?.selectedId ||
          parsed?.selectedRowId ||
          parsed?.rowId ||
          parsed?.selectedButtonId ||
          null
        if (typeof id === 'string' && id.trim()) return id.trim()
      } catch { }
    }

    return null
  } catch {
    return null
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

const stripKnownExtensions = (name) => {
  const s = safeString(name || '').trim()
  if (!s) return ''
  return s.replace(/\.(pdf|epub|cbz|cbr|zip|rar|7z|png|jpg|jpeg|webp|mp4|mkv)\b/gi, ' ')
}

const inferTitleFromFilename = (name) => {
  let s = safeString(name || '')
  if (!s) return ''
  // Normalizar unicode y separadores
  s = s.normalize('NFKC')
  s = stripKnownExtensions(s)
  s = s.replace(/[_|┇~•·]+/g, ' ')
  s = s.replace(/[()\[\]{}]/g, ' ')
  // Quitar prefijos numéricos tipo "05_" o "5 -" al inicio, pero sin eliminar palabras clave del título
  s = s.replace(/^\s*0*\d{1,4}\s*[_\-–]\s*/g, ' ')
  // Quitar tokens de temporada/capítulo que claramente son metadatos
  s = s
    .replace(/\b(?:temporada|temp(?:orada)?|season)\s*0*\d{1,2}\b/gi, ' ')
    .replace(/\b(?:t|s)\s*0*\d{1,2}\b/gi, ' ')
    .replace(/\b(?:cap(?:itulo)?|chapter|ch)\s*0*\d{1,4}\b/gi, ' ')
    .replace(/\b(?:cap(?:itulo)?s?|chapters?)\s*0*\d{1,4}\s*(?:-|–|a)\s*0*\d{1,4}\b/gi, ' ')
  // No eliminar por completo palabras como "especial" o "special":
  // dejar que formen parte del título base para que el match por título sea más tolerante.
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

const normalizeText = (s) => safeString(s || '')
  .toLowerCase()
  // NFKC primero para compatibilidad (fullwidth/fancy digits/letters), luego NFKD para separar diacríticos.
  .normalize('NFKC')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  // Mantener letras/números Unicode para títulos con tipografías/cjk.
  .replace(/[^\p{L}\p{N}\s]/gu, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const tokenize = (s) => {
  const norm = normalizeText(s)
  const parts = norm.split(' ').filter(Boolean)
  const out = []
  for (const p of parts) {
    const hasCjk = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(p)
    const minLen = hasCjk ? 2 : 3
    if (p.length < minLen) continue
    if (!hasCjk && stopwords.has(p)) continue
    out.push(p)
    if (out.length >= 24) break
  }
  // Fallback para títulos sin espacios (CJK o strings compactas).
  if (!out.length && norm) out.push(norm.slice(0, 48))
  return out
}

const CONTENT_TYPES = [
  'main',
  'extra',
  'side',
  'bonus',
  'epilogue',
  'prologue',
  'illustration',
  'au',
  'spin_off',
]

const CONTENT_TYPE_LABEL = {
  main: 'Capítulos principales',
  extra: 'Extras / Special',
  side: 'Side stories',
  bonus: 'Bonus',
  epilogue: 'Epilogues',
  prologue: 'Prologues',
  illustration: 'Ilustraciones',
  au: 'AU / What-if',
  spin_off: 'Spin-offs',
}

const CONTENT_TYPE_WARNING = {
  extra: 'Este contenido no forma parte de la historia principal.',
  side: 'Este contenido no forma parte de la historia principal.',
  bonus: 'Este contenido no forma parte de la historia principal.',
  epilogue: 'Este contenido no forma parte de la historia principal.',
  prologue: 'Este contenido no forma parte de la historia principal.',
  illustration: 'Este contenido no forma parte de la historia principal.',
  au: 'Este contenido no forma parte de la historia principal.',
  spin_off: 'Este contenido no forma parte de la historia principal.',
}

const detectContentTypeFromText = (rawText) => {
  const t = normalizeText(rawText || '')
  if (!t) return 'main'

  const has = (re) => re.test(t)
  if (has(/\b(illustration|illustrations|ilustracion|ilustraciones|illust|artbook|art\s*book|artwork|gallery|galeria)\b/u)) return 'illustration'
  if (has(/\b(spin\s*off|spin-off|spinoff)\b/u)) return 'spin_off'
  if (has(/\b(au|what\s*if|what-if|universo\s*alterno)\b/u)) return 'au'
  if (has(/\b(side\s*story|side\s*stories|side-story|sidestory|side)\b/u)) return 'side'
  if (has(/\b(bonus|omake)\b/u)) return 'bonus'
  if (has(/\b(epilogue|epilogo|epilogo?s)\b/u)) return 'epilogue'
  if (has(/\b(prologue|prologo|prologo?s)\b/u)) return 'prologue'
  if (has(/\b(extra|extras|special|specials|especial|especiales)\b/u)) return 'extra'
  return 'main'
}

const detectContentSourceFromText = (rawText) => {
  const t = normalizeText(rawText || '')
  if (!t) return null
  if (/\b(fan|fanmade|fan\s*made|fansub|scanlation|scanlated)\b/u.test(t)) return 'fan'
  return 'official'
}

const detectIsBLFromText = (rawText) => {
  const t = normalizeText(rawText || '')
  if (!t) return false
  return /\b(bl|boys\s*love|boy\s*s\s*love|yaoi)\b/u.test(t)
}

const inferSeasonFromText = (rawText) => {
  const inferred = extractSeasonFromTextRobust(rawText)
  if (inferred) return inferred
  const t = safeString(rawText || '').trim()
  if (!t) return null
  const m = t.match(/\b(?:temporada|temp(?:orada)?|season|s)\s*0*(\d{1,2})\b/i)
  if (m) return normalizeSeason(m[1])
  return null
}

const inferChapterFromText = (rawText) => {
  const inferred = extractSingleChapterFromText(rawText, { contentType: 'main' })
  if (inferred) return inferred
  const t = safeString(rawText || '').trim()
  if (!t) return null
  // prefer explícitos
  const m1 = t.match(/\b(?:cap(?:itulo)?|chapter|ch)\s*0*(\d{1,4})\b/i)
  if (m1) return normalizeChapter(m1[1])
  // prefijo numérico (ej: 05_ ...), evitando extras/special
  const low = normalizeText(t)
  if (/\b(extra|especial|special|side|bonus|omake|epilogue|prologue|spin\s*off|spinoff|illustration|ilustr)\b/u.test(low)) return null
  const m2 = t.match(/^\s*0*(\d{1,4})\s*[_\-–]/)
  if (m2) return normalizeChapter(m2[1])
  return null
}

const classifyLibraryItem = (it) => {
  const text = `${safeString(it?.title || '')} ${safeString(it?.originalName || '')} ${safeString(it?.category || '')} ${(it?.tags || []).join(' ')}`.trim()
  const contentType = detectContentTypeFromText(text)
  const contentSource = detectContentSourceFromText(text)
  const isBL = detectIsBLFromText(text)
  return { contentType, contentSource, isBL }
}

const classifyAporteItem = (aporte) => {
  const text = `${safeString(aporte?.titulo || '')} ${safeString(aporte?.archivoNombre || '')} ${safeString(aporte?.contenido || '')} ${safeString(aporte?.tipo || '')} ${(aporte?.tags || []).join(' ')}`.trim()
  const contentType = detectContentTypeFromText(text)
  const contentSource = detectContentSourceFromText(text)
  const isBL = detectIsBLFromText(text)
  return { contentType, contentSource, isBL }
}

const needsExplicitConfirmForType = (contentType) => String(contentType || 'main') !== 'main'

const needsExplicitConfirmForCoverage = (coverage) => {
  const t = safeString(coverage?.coverageType || '').trim()
  if (!t) return false
  return (
    t === COVERAGE_TYPES.CHAPTER_RANGE ||
    t === COVERAGE_TYPES.FULL_SEASON ||
    t === COVERAGE_TYPES.FULL_SERIES ||
    t === COVERAGE_TYPES.COMPLETE_PACK ||
    t === COVERAGE_TYPES.VOLUME
  )
}

const appendPedidoLog = (pedido, entry) => {
  try {
    pedido.bot ||= {}
    pedido.bot.logs ||= []
    pedido.bot.logs.push({ at: new Date().toISOString(), ...(entry || {}) })
    if (pedido.bot.logs.length > 200) pedido.bot.logs.splice(0, pedido.bot.logs.length - 200)
  } catch { }
}

const buildContentBucketsForTitle = (items, classifier) => {
  const out = {
    main: [],
    illustration: [],
    extrasByType: new Map(),
    anyBL: false,
  }
  for (const it of items || []) {
    const cls = classifier(it)
    if (cls?.isBL) out.anyBL = true
    const type = cls?.contentType || 'main'
    if (type === 'main') out.main.push({ it, cls })
    else if (type === 'illustration') out.illustration.push({ it, cls })
    else {
      const key = CONTENT_TYPES.includes(type) ? type : 'extra'
      const arr = out.extrasByType.get(key) || []
      arr.push({ it, cls })
      out.extrasByType.set(key, arr)
    }
  }
  return out
}

// -----------------------------
// Pedido Flow (State Machine)
// -----------------------------

const FLOW_ID_PREFIX = 'PEDIDO:'

const FLOW_STEPS = {
  // Nuevos estados obligatorios
  idle: 'idle',
  parsing_title: 'parsing_title',
  searching_aportes: 'searching_aportes',
  searching_providers_groups: 'searching_providers_groups',
  merging_results: 'merging_results',
  presenting_interactives: 'presenting_interactives',
  awaiting_confirmation: 'awaiting_confirmation',
  delivering: 'delivering',
  completed: 'completed',
  error: 'error',
  // Estados legacy para compatibilidad (no usados en el nuevo flujo)
  parsing_input: 'parsing_input',
  normalized: 'normalized',
  classified: 'classified',
  browsing_titles: 'browsing_titles',
  browsing_seasons: 'browsing_seasons',
  browsing_ranges: 'browsing_ranges',
  browsing_extras: 'browsing_extras',
  sending_file: 'sending_file',
}

const createPedidoMachine = (ctxInit) => createMachine({
  id: 'pedidoFlow',
  context: {
    pedidoId: null,
    title: '',
    titleKey: '',
    merged: null,
    index: null,
    selection: null,
    availability: null,
    ...ctxInit,
  },
  initial: 'idle',
  states: {
    idle: {
      on: { START: 'parsing_title' }
    },
    parsing_title: {
      entry: 'doParseTitle',
      on: { PARSE_OK: 'searching_aportes', PARSE_ERR: 'error' }
    },
    searching_aportes: {
      entry: 'doSearchAportes',
      on: { APORTES_OK: 'merging_results', APORTES_PARTIAL: 'searching_providers_groups', APORTES_EMPTY: 'searching_providers_groups' }
    },
    searching_providers_groups: {
      entry: 'doSearchProviders',
      on: { PROVIDERS_OK: 'merging_results', PROVIDERS_EMPTY: 'merging_results' }
    },
    merging_results: {
      entry: 'doMergeResults',
      on: { MERGE_OK: 'presenting_interactives', MERGE_EMPTY: 'presenting_interactives', MERGE_ERR: 'error' }
    },
    presenting_interactives: {
      entry: 'doPresentInteractives',
      on: { USER_SELECTION: 'awaiting_confirmation', BACK: 'presenting_interactives', CANCEL: 'error' }
    },
    awaiting_confirmation: {
      entry: 'doPrepareConfirmation',
      on: { CONFIRM_SEND: 'delivering', REJECT: 'presenting_interactives', CANCEL: 'error' }
    },
    delivering: {
      entry: 'doDeliver',
      on: { SEND_OK: 'completed', SEND_ERR: 'error' }
    },
    completed: { type: 'final' },
    error: { type: 'final' },
  }
})

// Machine actions wiring to existing helper functions
const machines = new Map()
const getMachineForPedido = (pedidoId, ctxInit = {}) => {
  const id = Number(pedidoId)
  const key = String(id)
  let service = machines.get(key)
  if (!service) {
    const machine = createPedidoMachine({ pedidoId: id, ...ctxInit }).withConfig({
      actions: {
        doParseAndNormalize: (ctx, evt) => { },
        doBuildCandidates: (ctx, evt) => { },
        doCollectAndClassify: (ctx, evt) => { },
        doSendFile: (ctx, evt) => { },
        doParseTitle: (ctx, evt) => { },
        doSearchAportes: (ctx, evt) => { },
        doSearchProviders: (ctx, evt) => { },
        doMergeResults: (ctx, evt) => { },
        doPresentInteractives: (ctx, evt) => { },
        doPrepareConfirmation: (ctx, evt) => { },
        doDeliver: (ctx, evt) => { },
      }
    })
    service = interpret(machine)
    service.start()
    machines.set(key, service)
  }
  return service
}

const makeFlowId = (pedidoId, action, ...parts) => {
  const pid = Number(pedidoId)
  if (!Number.isFinite(pid) || pid <= 0) return `${FLOW_ID_PREFIX}0:INVALID`
  const a = safeString(action || '').trim().replace(/[:\s]/g, '_').slice(0, 32) || 'A'
  const rest = (parts || []).map((p) => safeString(p).trim().replace(/[:\s]/g, '_').slice(0, 64)).filter(Boolean)
  // Formato estricto: PEDIDO:<id>:STEP:<action>[:payload...]
  return `${FLOW_ID_PREFIX}${pid}:STEP:${a}${rest.length ? `:${rest.join(':')}` : ''}`
}

const parseFlowId = (text) => {
  const raw = safeString(text || '').trim()
  if (!raw.startsWith(FLOW_ID_PREFIX)) return null
  const parts = raw.split(':').filter(Boolean)
  // Aceptar formatos antiguos: PEDIDO:<id>:<action>:...
  // y el nuevo: PEDIDO:<id>:STEP:<action>:...
  if (parts.length < 3) return null
  const pid = Number(parts[1])
  if (!Number.isFinite(pid) || pid <= 0) return null
  const hasStep = String(parts[2] || '').toUpperCase() === 'STEP'
  const action = safeString(parts[hasStep ? 3 : 2] || '').trim()
  const args = parts.slice(hasStep ? 4 : 3).map((p) => safeString(p || '').trim())
  return { pedidoId: pid, action, args, raw }
}

const setPedidoFlow = (pedido, { step, data } = {}) => {
  pedido.flow ||= {}
  if (step) pedido.flow.step = safeString(step)
  if (data && typeof data === 'object') pedido.flow.data = data
  pedido.flow.updatedAt = new Date().toISOString()
  const ttlMs = clampInt(process.env.PEDIDOS_FLOW_TTL_MS, { min: 60_000, max: 24 * 60 * 60 * 1000, fallback: 10 * 60 * 1000 })
  pedido.flow.expiresAt = new Date(Date.now() + ttlMs).toISOString()
}

const isFlowExpired = (pedido) => {
  try {
    const exp = new Date(pedido?.flow?.expiresAt || 0).getTime()
    return Number.isFinite(exp) ? Date.now() > exp : false
  } catch {
    return false
  }
}

const isTitleMatch = (aNorm, bNorm) => {
  const a = safeString(aNorm || '').trim()
  const b = safeString(bNorm || '').trim()
  if (!a || !b) return false
  if (a === b) return true
  if (a.includes(b) || b.includes(a)) return true
  return false
}

const getFileExtUpper = (name) => {
  const base = safeString(name || '').trim()
  const ext = base.includes('.') ? base.split('.').pop() : ''
  const up = safeString(ext).toUpperCase().replace(/[^A-Z0-9]/g, '')
  return up || null
}

const pickDisplayTitle = (candidates, fallbackTitle) => {
  const best = candidates?.[0]
  return safeString(best?.title || fallbackTitle || '').trim() || safeString(fallbackTitle || '').trim()
}

const scoreTitleCandidate = (candidateTitle, queryTitle) => {
  const cNorm = normalizeText(candidateTitle || '')
  const qNorm = normalizeText(queryTitle || '')
  if (!cNorm || !qNorm) return 0
  if (cNorm === qNorm) return 100
  const qTokens = new Set(tokenize(qNorm))
  const cTokens = new Set(tokenize(cNorm))
  let overlap = 0
  for (const t of qTokens) if (cTokens.has(t)) overlap += 1
  const ratio = qTokens.size ? overlap / qTokens.size : 0
  let score = ratio * 80
  if (cNorm.includes(qNorm) || qNorm.includes(cNorm)) score += 20
  return Math.max(0, Math.min(100, Math.round(score)))
}

const searchTitleCandidatesFromLibrary = (panel, { proveedorJid, queryTitle, limit = 10 } = {}) => {
  const qNorm = normalizeText(queryTitle || '')
  if (!qNorm) return []
  const list = Object.values(panel?.contentLibrary || {})
    .filter((it) => it && it.id)
    .filter((it) => (proveedorJid ? String(it?.proveedorJid || '') === String(proveedorJid) : true))

  const buckets = new Map()
  for (const it of list) {
    const rawTitle = safeString(it?.title || it?.originalName || '').trim()
    const inferred = inferTitleFromFilename(rawTitle)
    const t = inferred || rawTitle
    const n = normalizeText(t)
    if (!n) continue
    const s = scoreTitleCandidate(n, qNorm)
    if (s <= 0) continue
    const entry = buckets.get(n) || { key: n, title: inferred || rawTitle, score: s, sampleId: Number(it?.id) || null }
    entry.score = Math.max(entry.score, s)
    if (!entry.sampleId) entry.sampleId = Number(it?.id) || null
    buckets.set(n, entry)
  }
  const out = [...buckets.values()].sort((a, b) => b.score - a.score).slice(0, limit)
  return out
}

const searchTitleCandidatesFromAportes = (queryTitle, { limit = 10, m, isBotOwner, isAdmin } = {}) => {
  const qNorm = normalizeText(queryTitle || '')
  if (!qNorm) return []
  const aportes = Array.isArray(global.db?.data?.aportes) ? global.db.data.aportes : []

  const buckets = new Map()
  for (const a of aportes) {
    if (!a) continue
    if (!isAporteVisibleToUser(a, { m, isBotOwner, isAdmin })) continue
    const rawTitle = safeString(a?.titulo || a?.archivoNombre || '').trim()
    const inferred = inferTitleFromFilename(rawTitle)
    const t = inferred || rawTitle
    const n = normalizeText(t)
    if (!n) continue
    const s = scoreTitleCandidate(n, qNorm)
    if (s <= 0) continue
    const entry = buckets.get(n) || { key: n, title: inferred || rawTitle, score: s, sampleId: Number(a?.id) || null }
    entry.score = Math.max(entry.score, s)
    if (!entry.sampleId) entry.sampleId = Number(a?.id) || null
    buckets.set(n, entry)
  }
  return [...buckets.values()].sort((a, b) => b.score - a.score).slice(0, limit)
}

const collectTitleItems = (panel, { titleKey, proveedorJid } = {}) => {
  const key = normalizeText(titleKey || '')
  if (!key) return { library: [], aportes: [] }
  const library = Object.values(panel?.contentLibrary || {})
    .filter((it) => it && it.id)
    .filter((it) => (proveedorJid ? String(it?.proveedorJid || '') === String(proveedorJid) : true))
    .filter((it) => {
      const raw = safeString(it?.title || it?.originalName || '')
      const t = normalizeText(inferTitleFromFilename(raw) || raw)
      return isTitleMatch(t, key)
    })

  const aportes = Array.isArray(global.db?.data?.aportes) ? global.db.data.aportes : []
  const aportesMatched = aportes.filter((a) => {
    const raw = safeString(a?.titulo || a?.archivoNombre || '')
    const t = normalizeText(inferTitleFromFilename(raw) || raw)
    return isTitleMatch(t, key)
  })
  return { library, aportes: aportesMatched }
}

const buildAvailabilityFromItems = (items) => {
  const seasons = new Map() // season -> { intervals:[{from,to}], min,max, available }
  const formats = new Set()
  const origin = new Set()
  let hasExtras = false
  let hasSide = false
  let hasIllus = false
  let anyBL = false
  const packs = {
    completePack: 0,
    fullSeries: 0,
    fullSeason: 0,
    chapterRange: 0,
    volume: 0,
  }

  const mergeIntervals = (intervals) => {
    const list = (intervals || [])
      .map((x) => ({ from: Number(x?.from), to: Number(x?.to) }))
      .filter((x) => Number.isFinite(x.from) && Number.isFinite(x.to))
      .map((x) => (x.from <= x.to ? x : ({ from: x.to, to: x.from })))
      .sort((a, b) => a.from - b.from)

    const merged = []
    for (const it of list) {
      const prev = merged[merged.length - 1]
      if (!prev) merged.push({ ...it })
      else if (it.from <= prev.to + 1) prev.to = Math.max(prev.to, it.to)
      else merged.push({ ...it })
    }

    let length = 0
    for (const m of merged) length += Math.max(0, m.to - m.from + 1)
    return { merged, length }
  }

  const pushInterval = (season, from, to) => {
    const s = safeString(season || '0').trim() || '0'
    const a = normalizeChapter(from)
    const b = normalizeChapter(to)
    if (!a || !b) return
    const n1 = Number(a)
    const n2 = Number(b)
    if (!Number.isFinite(n1) || !Number.isFinite(n2)) return
    const entry = seasons.get(s) || { season: s, intervals: [] }
    entry.intervals.push({ from: Math.min(n1, n2), to: Math.max(n1, n2) })
    seasons.set(s, entry)
  }

  for (const it of items.library || []) {
    origin.add('biblioteca')
    const cls = classifyLibraryItem(it)
    if (cls?.isBL) anyBL = true
    const ext = getFileExtUpper(it?.originalName || it?.filename || it?.file_path || '')
    if (ext) formats.add(ext)
    const type = cls?.contentType || 'main'
    if (type === 'main') {
      const rawName = safeString(it?.originalName || it?.title || '').trim()
      const filePathHint = (it?.file_path && (hasCompleteKeyword(rawName) || extractChapterRangeFromText(rawName))) ? it.file_path : null
      const cov = classifyCoverageFromItemText({
        rawText: rawName,
        contentType: 'main',
        explicitSeason: it?.season,
        explicitChapter: it?.chapter,
        filePath: filePathHint,
      })
      if (cov.coverageType === COVERAGE_TYPES.SINGLE_CHAPTER) pushInterval(cov.season, cov.chapterFrom, cov.chapterTo)
      else if (cov.coverageType === COVERAGE_TYPES.CHAPTER_RANGE) {
        packs.chapterRange += 1
        if (cov.chapterFrom && cov.chapterTo) pushInterval(cov.season, cov.chapterFrom, cov.chapterTo)
      } else if (cov.coverageType === COVERAGE_TYPES.FULL_SEASON) {
        packs.fullSeason += 1
        if (cov.chapterFrom && cov.chapterTo) pushInterval(cov.season, cov.chapterFrom, cov.chapterTo)
      } else if (cov.coverageType === COVERAGE_TYPES.FULL_SERIES) {
        packs.fullSeries += 1
        if (cov.chapterFrom && cov.chapterTo) pushInterval(cov.season, cov.chapterFrom, cov.chapterTo)
      } else if (cov.coverageType === COVERAGE_TYPES.COMPLETE_PACK) {
        packs.completePack += 1
        if (cov.chapterFrom && cov.chapterTo) pushInterval(cov.season, cov.chapterFrom, cov.chapterTo)
      } else if (cov.coverageType === COVERAGE_TYPES.VOLUME) {
        packs.volume += 1
      }
    }
    else if (type === 'illustration') hasIllus = true
    else {
      hasExtras = true
      if (type === 'side') hasSide = true
    }
  }

  for (const a of items.aportes || []) {
    origin.add('aportes')
    const cls = classifyAporteItem(a)
    if (cls?.isBL) anyBL = true
    const ext = getFileExtUpper(a?.archivoNombre || a?.archivo || '')
    if (ext) formats.add(ext)
    const type = cls?.contentType || 'main'
    if (type === 'main') {
      const rawName = safeString(a?.archivoNombre || a?.titulo || '').trim()
      const filePathHint = null
      const cov = classifyCoverageFromItemText({
        rawText: rawName,
        contentType: 'main',
        explicitSeason: a?.temporada,
        explicitChapter: a?.capitulo,
        filePath: filePathHint,
      })
      if (cov.coverageType === COVERAGE_TYPES.SINGLE_CHAPTER) pushInterval(cov.season, cov.chapterFrom, cov.chapterTo)
      else if (cov.coverageType === COVERAGE_TYPES.CHAPTER_RANGE) {
        packs.chapterRange += 1
        if (cov.chapterFrom && cov.chapterTo) pushInterval(cov.season, cov.chapterFrom, cov.chapterTo)
      } else if (cov.coverageType === COVERAGE_TYPES.FULL_SEASON) {
        packs.fullSeason += 1
        if (cov.chapterFrom && cov.chapterTo) pushInterval(cov.season, cov.chapterFrom, cov.chapterTo)
      } else if (cov.coverageType === COVERAGE_TYPES.FULL_SERIES) {
        packs.fullSeries += 1
        if (cov.chapterFrom && cov.chapterTo) pushInterval(cov.season, cov.chapterFrom, cov.chapterTo)
      } else if (cov.coverageType === COVERAGE_TYPES.COMPLETE_PACK) {
        packs.completePack += 1
        if (cov.chapterFrom && cov.chapterTo) pushInterval(cov.season, cov.chapterFrom, cov.chapterTo)
      } else if (cov.coverageType === COVERAGE_TYPES.VOLUME) {
        packs.volume += 1
      }
    }
    else if (type === 'illustration') hasIllus = true
    else {
      hasExtras = true
      if (type === 'side') hasSide = true
    }
  }

  const seasonList = [...seasons.values()].sort((a, b) => Number(a.season) - Number(b.season))
  let chaptersTotal = 0
  let chaptersAvailable = 0
  let missingTotal = 0
  const seasonSummaries = []

  for (const s of seasonList) {
    const { merged, length } = mergeIntervals(s.intervals || [])
    const min = merged.length ? merged[0].from : null
    const max = merged.length ? merged[merged.length - 1].to : null
    const total = (min != null && max != null) ? Math.max(0, max - min + 1) : 0
    const missing = total > 0 ? Math.max(0, total - length) : 0
    chaptersAvailable += length
    chaptersTotal += total
    missingTotal += missing
    seasonSummaries.push({
      season: s.season,
      min,
      max,
      available: length,
      total: total || length,
      complete: total > 0 ? missing === 0 : false,
    })
  }

  const hasAnyPack = Object.values(packs).some((n) => Number(n || 0) > 0)
  const complete = chaptersTotal > 0 ? missingTotal === 0 : Boolean(hasAnyPack && (packs.completePack || packs.fullSeries || packs.fullSeason))

  return {
    seasons: seasonSummaries,
    seasonsCount: seasonSummaries.length,
    chaptersTotal,
    chaptersAvailable,
    hasExtras,
    hasSide,
    hasIllus,
    formats: [...formats].slice(0, 6),
    origin: [...origin],
    packs,
    complete,
    anyBL,
  }
}

const renderAvailabilitySummaryText = (pedido, availability) => {
  const title = waSafeInline(pedido?.titulo || '')
  const fmt = availability?.formats?.length ? availability.formats.join(', ') : '-'
  const origin = availability?.origin?.length ? availability.origin.map((x) => (x === 'biblioteca' ? 'Biblioteca' : 'Aportes')).join(' + ') : '-'
  const stateLabel = availability?.complete ? 'Completo' : (availability?.chaptersAvailable ? 'Parcial' : 'Vacío')
  const packs = availability?.packs || {}
  const packsTotal =
    Number(packs.completePack || 0) +
    Number(packs.fullSeries || 0) +
    Number(packs.fullSeason || 0) +
    Number(packs.chapterRange || 0) +
    Number(packs.volume || 0)
  const hasCompletePack = (Number(packs.completePack || 0) + Number(packs.fullSeries || 0) + Number(packs.fullSeason || 0)) > 0

  const lines = []
  lines.push(`📖 *${title}*`)
  lines.push('')
  lines.push('📊 *Disponibilidad detectada:*')
  lines.push(`• Temporadas: *${Number(availability?.seasonsCount || 0)}*`)
  lines.push(`• Capítulos totales: *${Number(availability?.chaptersTotal || 0)}*`)
  lines.push(`• Capítulos disponibles: *${Number(availability?.chaptersAvailable || 0)}*`)
  lines.push(`• Packs completos: *${hasCompletePack ? 'Sí' : 'No'}*`)
  lines.push(`• Extras BL: *${availability?.hasExtras ? 'Sí' : 'No'}*`)
  lines.push(`• Side stories: *${availability?.hasSide ? 'Sí' : 'No'}*`)
  lines.push(`• Ilustraciones: *${availability?.hasIllus ? 'Sí' : 'No'}*`)
  lines.push(`• Formatos: *${fmt}*`)
  lines.push(`• Origen: *${origin}*`)
  lines.push(`• Estado: *${stateLabel}*`)
  if (packsTotal) lines.push(`• Variantes/Packs detectados: *${packsTotal}*`)
  lines.push('')
  lines.push('¿Es este el título que estabas buscando?')
  return lines.join('\n')
}

const renderAvailabilityDetailsText = (pedido, availability) => {
  const title = waSafeInline(pedido?.titulo || '')
  const lines = []
  lines.push(`📖 *${title}* — *Detalles*`)
  lines.push('')
  const seasons = Array.isArray(availability?.seasons) ? availability.seasons : []
  if (seasons.length) {
    for (const s of seasons) {
      const label = s.season === '0' ? 'Sin temporada' : `Temporada ${String(s.season).padStart(2, '0')}`
      const range = (s.min != null && s.max != null) ? `Cap. ${s.min}–${s.max}` : `Capítulos: ${s.available}`
      const status = s.complete ? 'completo' : 'incompleto'
      lines.push(`• ${label}: ${range} (${status})`)
    }
  } else {
    lines.push('• Temporadas: -')
  }
  lines.push('')
  const packs = availability?.packs || {}
  const packsTotal =
    Number(packs.completePack || 0) +
    Number(packs.fullSeries || 0) +
    Number(packs.fullSeason || 0) +
    Number(packs.chapterRange || 0) +
    Number(packs.volume || 0)
  if (packsTotal) {
    const parts = []
    if (packs.fullSeries) parts.push(`FULL_SERIES: ${packs.fullSeries}`)
    if (packs.completePack) parts.push(`COMPLETE_PACK: ${packs.completePack}`)
    if (packs.fullSeason) parts.push(`FULL_SEASON: ${packs.fullSeason}`)
    if (packs.chapterRange) parts.push(`RANGOS: ${packs.chapterRange}`)
    if (packs.volume) parts.push(`VOLUMENES: ${packs.volume}`)
    lines.push(`• Packs/variantes: ${parts.join(' | ')}`)
    lines.push('')
  }
  lines.push(`• Extras BL: ${availability?.hasExtras ? 'Sí' : 'No'}`)
  lines.push(`• Side stories: ${availability?.hasSide ? 'Sí' : 'No'}`)
  lines.push(`• Ilustraciones: ${availability?.hasIllus ? 'Sí' : 'No'}`)
  return lines.join('\n')
}


const yesNo = (b) => (b ? 'sí' : 'no')

const formatSeasonShort = (s) => (s === '0' ? 'T0' : `T${String(s).padStart(1, '0')}`)

const buildAvailableRangesBySeason = (availability) => {
  try {
    const seasons = Array.isArray(availability?.seasons) ? availability.seasons : []
    const parts = []
    for (const s of seasons) {
      if (!s || Number(s.available || 0) <= 0) continue
      const label = formatSeasonShort(String(s.season || '0'))
      if (s.min != null && s.max != null) parts.push(`${label}: ${s.min}–${s.max}`)
      else if (Number(s.available || 0) > 0) parts.push(`${label}: ${s.available} caps`)
    }
    return parts.join('; ')
  } catch { return '' }
}

const buildMissingRangesBySeason = (missingBySeason) => {
  try {
    if (!missingBySeason || typeof missingBySeason !== 'object') return ''
    const seasons = Object.keys(missingBySeason)
    const parts = []
    for (const s of seasons) {
      const arr = Array.isArray(missingBySeason[s]) ? missingBySeason[s] : []
      const label = formatSeasonShort(String(s || '0'))
      const ranges = arr
        .map((r) => {
          const a = Number(r?.from), b = Number(r?.to)
          if (Number.isFinite(a) && Number.isFinite(b)) return `${Math.min(a, b)}–${Math.max(a, b)}`
          return null
        })
        .filter(Boolean)
      if (ranges.length) parts.push(`${label}: ${ranges.join(', ')}`)
    }
    return parts.join('; ')
  } catch { return '' }
}

const buildSourceLabel = (availability, { mode } = {}) => {
  const origin = Array.isArray(availability?.origin) ? availability.origin : []
  const hasAportes = origin.includes('aportes')
  const hasLib = origin.includes('biblioteca')
  if (mode === 'complete') {
    if (hasAportes && hasLib) return 'Aportes verificados + Grupos proveedores'
    if (hasAportes) return 'Aportes verificados'
    if (hasLib) return 'Grupos proveedores'
    return 'En seguimiento'
  }
  // parcial/registrado context
  return {
    aportes: hasAportes ? 'disponibles' : 'no disponibles',
    proveedores: 'monitoreando',
  }
}

// Build push text according to availability and templates
// Input: { userName, title, availability, missingBySeason }
const buildPedidoPush = ({ userName, title, availability, missingBySeason } = {}) => {
  const name = waSafeInline(userName || '-')
  const t = waSafeInline(title || '-')
  const avail = availability || {}
  const hasExtras = Boolean(avail?.hasExtras)
  const isBL = Boolean(avail?.anyBL)
  const chaptersAvailable = Number(avail?.chaptersAvailable || 0) || 0
  const isComplete = Boolean(avail?.complete)

  // Complete (solo si validado determinísticamente)
  if (isComplete) {
    const seasonsCount = Number(avail?.seasonsCount || 0) || 0
    const source = buildSourceLabel(avail, { mode: 'complete' })
    return (
      '✅ PEDIDO LISTO\n' +
      `👤 Usuario: ${name}\n` +
      `📖 Título: ${t}\n` +
      `✔ Contenido completo disponible\n` +
      `🎬 Temporadas: ${seasonsCount}\n` +
      `📚 Capítulos: COMPLETO\n` +
      `✨ Extras: ${yesNo(hasExtras)}\n` +
      `🏷️ BL: ${yesNo(isBL)}\n` +
      `📂 Fuente: ${source}\n` +
      '👉 Confirmá para recibir el contenido.'
    )
  }

  // Parcial (hay algo disponible pero faltan rangos)
  if (chaptersAvailable > 0) {
    const availableStr = buildAvailableRangesBySeason(avail)
    const missingStr = buildMissingRangesBySeason(missingBySeason)
    const source = buildSourceLabel(avail, { mode: 'partial' })
    const lines = []
    lines.push('⚠️ PEDIDO PARCIAL')
    lines.push(`👤 Usuario: ${name}`)
    lines.push(`📖 Título: ${t}`)
    if (availableStr) lines.push(`📚 Disponible: ${availableStr}`)
    if (missingStr) lines.push(`❌ Falta: ${missingStr}`)
    lines.push(`✨ Extras: ${yesNo(hasExtras)}`)
    lines.push(`📂 Aportes: ${source.aportes}`)
    lines.push(`📡 Grupos proveedores: ${source.proveedores}`)
    lines.push('👉 ¿Deseás recibir lo disponible o esperar?')
    return lines.join('\n')
  }

  // Registrado (sin contenido aún)
  return (
    '⏳ PEDIDO REGISTRADO\n' +
    `👤 Usuario: ${name}\n` +
    `📖 Título: ${t}\n` +
    '❌ Aún no hay aportes disponibles\n' +
    '📡 Grupos proveedores: en seguimiento\n' +
    '🔔 Te avisaremos automáticamente\n' +
    'cuando llegue nuevo contenido.'
  )
}

const savePedidoAndEmit = async (panel, pedido, eventName = 'updated') => {
  try {
    pedido.fecha_actualizacion = new Date().toISOString()
    panel.pedidos[pedido.id] = pedido
    if (global.db?.write) await global.db.write().catch(() => { })
    try {
      const { emitPedidoUpdated } = await import('../lib/socket-io.js')
      emitPedidoUpdated(pedido)
    } catch { }
    if (eventName) appendPedidoLog(pedido, { event: eventName, step: safeString(pedido?.flow?.step || '') })
  } catch { }
}

const getMergedItemsForPedido = (panel, pedido, { m, isBotOwner, isAdmin } = {}) => {
  const selectedKey = safeString(pedido?.titulo_normalizado || pedido?.flow?.data?.selectedKey || '').trim() || normalizeText(pedido?.titulo || '')
  const proveedorJid = pedido?.proveedor_jid || pedido?.flow?.data?.proveedorJid || null
  const allowGlobalLibrary = !m?.isGroup || Boolean(isBotOwner)

  const libProv = Object.values(panel?.contentLibrary || {})
    .filter((it) => it && it.id)
    .filter((it) => (proveedorJid ? String(it?.proveedorJid || '') === String(proveedorJid) : true))
    .filter((it) => {
      const raw = safeString(it?.title || it?.originalName || '')
      return isTitleMatch(normalizeText(inferTitleFromFilename(raw) || raw), selectedKey)
    })
  const libGlobal = allowGlobalLibrary
    ? Object.values(panel?.contentLibrary || {})
      .filter((it) => it && it.id)
      .filter((it) => {
        const raw = safeString(it?.title || it?.originalName || '')
        return isTitleMatch(normalizeText(inferTitleFromFilename(raw) || raw), selectedKey)
      })
    : []

  const aportesAll = Array.isArray(global.db?.data?.aportes) ? global.db.data.aportes : []
  const aportes = aportesAll
    .filter((a) => {
      const raw = safeString(a?.titulo || a?.archivoNombre || '')
      return isTitleMatch(normalizeText(inferTitleFromFilename(raw) || raw), selectedKey)
    })
    .filter((a) => isAporteVisibleToUser(a, { m, isBotOwner, isAdmin }))

  const libMap = new Map()
  for (const it of [...libProv, ...libGlobal]) libMap.set(Number(it?.id), it)
  return { titleKey: selectedKey, proveedorJid, library: [...libMap.values()], aportes }
}

const buildUnifiedIndex = (merged) => {
  const unified = []
  for (const it of merged?.library || []) unified.push({ source: 'lib', id: Number(it?.id) || null, it })
  for (const a of merged?.aportes || []) unified.push({ source: 'aporte', id: Number(a?.id) || null, it: a })

  const main = []
  const mainRanges = []
  const mainPacks = []
  const mainUnknown = []
  const illustrations = []
  const extrasByType = new Map()
  let anyBL = false

  const resolveAporteFilePathForMeasures = (aporte) => {
    try {
      const rel = safeString(aporte?.archivoPath || '').trim()
      if (!rel) return null
      if (rel.includes('..')) return null
      const root = path.resolve(process.cwd(), 'storage', 'media')
      const filePath = path.resolve(process.cwd(), rel)
      if (!filePath.toLowerCase().startsWith(root.toLowerCase())) return null
      if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null
      return filePath
    } catch {
      return null
    }
  }

  const getUnifiedCoverageMeta = (u, { includeMeasures = false } = {}) => {
    if (!u) return { coverageType: COVERAGE_TYPES.UNKNOWN, season: '0', chapterFrom: null, chapterTo: null, inferredCoverage: false, isComplete: false, volume: null, measures: null }
    if (u.__coverage && (!includeMeasures || u.__coverage?.measures)) return u.__coverage

    const rawName =
      u.source === 'lib'
        ? safeString(u?.it?.originalName || u?.it?.title || '').trim()
        : safeString(u?.it?.archivoNombre || u?.it?.titulo || '').trim()

    const explicitSeason = u.source === 'lib' ? u?.it?.season : u?.it?.temporada
    const explicitChapter = u.source === 'lib' ? u?.it?.chapter : u?.it?.capitulo
    const contentType = safeString(u?.cls?.contentType || 'main').toLowerCase().trim() || 'main'

    let filePath = null
    if (includeMeasures) {
      if (u.source === 'lib') filePath = safeString(u?.it?.file_path || '').trim() || null
      else filePath = resolveAporteFilePathForMeasures(u?.it)
    }

    const wantsMeasures = includeMeasures && filePath && (hasCompleteKeyword(rawName) || extractChapterRangeFromText(rawName))
    const cov = classifyCoverageFromItemText({
      rawText: rawName,
      contentType,
      explicitSeason,
      explicitChapter,
      filePath: wantsMeasures ? filePath : null,
    })

    u.__coverage = cov
    return cov
  }

  for (const u of unified) {
    if (!u?.id) continue
    const cls = u.source === 'lib' ? classifyLibraryItem(u.it) : classifyAporteItem(u.it)
    if (cls?.isBL) anyBL = true
    const contentType = cls?.contentType || 'main'
    const entry = { ...u, cls }
    if (contentType === 'main') {
      const cov = getUnifiedCoverageMeta(entry, { includeMeasures: false })
      entry.coverage = cov
      if (cov.coverageType === COVERAGE_TYPES.SINGLE_CHAPTER) main.push(entry)
      else if (cov.coverageType === COVERAGE_TYPES.CHAPTER_RANGE) mainRanges.push(entry)
      else if (
        cov.coverageType === COVERAGE_TYPES.FULL_SEASON ||
        cov.coverageType === COVERAGE_TYPES.FULL_SERIES ||
        cov.coverageType === COVERAGE_TYPES.COMPLETE_PACK ||
        cov.coverageType === COVERAGE_TYPES.VOLUME
      ) mainPacks.push(entry)
      else mainUnknown.push(entry)
    }
    else if (contentType === 'illustration') illustrations.push(entry)
    else {
      const key = CONTENT_TYPES.includes(contentType) ? contentType : 'extra'
      const arr = extrasByType.get(key) || []
      arr.push(entry)
      extrasByType.set(key, arr)
    }
  }

  return { main, mainRanges, mainPacks, mainUnknown, illustrations, extrasByType, anyBL }
}

const getSeasonAndChapterFromUnified = (u) => {
  if (!u) return { season: '0', chapter: null }
  const cov = u?.coverage || null
  if (cov) {
    const chapter = cov.coverageType === COVERAGE_TYPES.SINGLE_CHAPTER ? cov.chapterFrom : null
    return { season: safeString(cov.season || '0') || '0', chapter }
  }
  if (u.source === 'lib') {
    const season = normalizeSeason(u?.it?.season) || inferSeasonFromText(u?.it?.originalName || u?.it?.title || '') || '0'
    const chapter = normalizeChapter(u?.it?.chapter) || inferChapterFromText(u?.it?.originalName || u?.it?.title || '')
    return { season, chapter }
  }
  const season = normalizeSeason(u?.it?.temporada) || inferSeasonFromText(u?.it?.archivoNombre || u?.it?.titulo || '') || '0'
  const chapter = normalizeChapter(u?.it?.capitulo) || inferChapterFromText(u?.it?.archivoNombre || u?.it?.titulo || '')
  return { season, chapter }
}

const buildMainChapterMap = (mainItems) => {
  const bySeason = new Map() // season -> Map(chapter -> unified[])
  for (const u of mainItems || []) {
    const { season, chapter } = getSeasonAndChapterFromUnified(u)
    if (!chapter) continue
    const sKey = safeString(season || '0') || '0'
    const cKey = String(chapter)
    const seasonMap = bySeason.get(sKey) || new Map()
    const arr = seasonMap.get(cKey) || []
    arr.push(u)
    seasonMap.set(cKey, arr)
    bySeason.set(sKey, seasonMap)
  }
  return bySeason
}

const renderContentTypeMenu = async (m, conn, panel, pedido, index) => {
  const pid = Number(pedido?.id)
  const availability = pedido?.disponibilidad_detectada || null
  const buttons = [
    ['📘 Historia principal', makeFlowId(pid, 'TYPE_MAIN')],
  ]
  if (availability?.hasExtras) buttons.push(['✨ Extras / Side', makeFlowId(pid, 'TYPE_EXTRAS')])
  if (availability?.hasIllus) buttons.push(['🎨 Ilustraciones', makeFlowId(pid, 'TYPE_ILLUS')])
  buttons.push(['🔙 Volver', makeFlowId(pid, 'BACK', 'AVAIL')])
  buttons.push(['❌ Cancelar', makeFlowId(pid, 'AVAIL_CANCEL')])

  setPedidoFlow(pedido, { step: FLOW_STEPS.SELECT_TIPO, data: { ...(pedido.flow?.data || {}), lastMenu: 'TYPE' } })
  await savePedidoAndEmit(panel, pedido, 'menu_type')

  const text =
    `📌 *Contenido disponible*\n\n` +
    `> *Título:* ${waSafeInline(pedido?.titulo || '')}\n` +
    `> _Elige qué quieres recibir:_`
  const ok = await trySendFlowButtons(m, conn, { text, footer: '🛡️ Oguri Bot', buttons: buttons.slice(0, 10) })
  if (ok) return true
  await m.reply(`${text}\n\n> Responde: *PRINCIPAL*${availability?.hasExtras ? ' / *EXTRAS*' : ''}${availability?.hasIllus ? ' / *ILUSTRACIONES*' : ''} / *VOLVER* / *CANCELAR*`)
  return true
}

const renderAvailabilityMenu = async (m, conn, panel, pedido) => {
  const pid = Number(pedido?.id)
  const availability = pedido?.disponibilidad_detectada || buildAvailabilityFromItems({ library: [], aportes: [] })
  const summaryText = renderAvailabilitySummaryText(pedido, availability)
  setPedidoFlow(pedido, { step: FLOW_STEPS.RESUMEN, data: { ...(pedido.flow?.data || {}), lastMenu: 'AVAIL' } })
  await savePedidoAndEmit(panel, pedido, 'menu_availability')

  const buttons = [
    ['✅ Sí, continuar', makeFlowId(pid, 'AVAIL_YES')],
    ['🔍 Ver detalles', makeFlowId(pid, 'AVAIL_DETAILS')],
    ['🔁 Buscar otro', makeFlowId(pid, 'AVAIL_OTHER')],
    ['❌ Cancelar', makeFlowId(pid, 'AVAIL_CANCEL')],
  ]
  const ok = await trySendFlowButtons(m, conn, { text: summaryText, footer: '🛡️ Oguri Bot', buttons })
  if (!ok) await m.reply(summaryText)
  return true
}

const renderDetailsMenu = async (m, conn, panel, pedido) => {
  const pid = Number(pedido?.id)
  const availability = pedido?.disponibilidad_detectada || null
  const text = renderAvailabilityDetailsText(pedido, availability)
  const buttons = [
    ['📘 Capítulos', makeFlowId(pid, 'TYPE_MAIN')],
  ]
  if (availability?.hasExtras) buttons.push(['✨ Extras', makeFlowId(pid, 'TYPE_EXTRAS')])
  if (availability?.hasIllus) buttons.push(['🎨 Ilustraciones', makeFlowId(pid, 'TYPE_ILLUS')])
  buttons.push(['🔙 Volver', makeFlowId(pid, 'BACK', 'AVAIL')])
  buttons.push(['❌ Cancelar', makeFlowId(pid, 'AVAIL_CANCEL')])

  setPedidoFlow(pedido, { step: FLOW_STEPS.DETALLE, data: { ...(pedido.flow?.data || {}), lastMenu: 'DETAIL' } })
  await savePedidoAndEmit(panel, pedido, 'menu_details')

  const ok = await trySendFlowButtons(m, conn, { text, footer: '🛡️ Oguri Bot', buttons: buttons.slice(0, 10) })
  if (!ok) await m.reply(text)
  return true
}

const renderCandidatesMenu = async (m, conn, panel, pedido) => {
  const pid = Number(pedido?.id)
  const candidates = Array.isArray(pedido?.flow?.data?.candidates) ? pedido.flow.data.candidates : []
  if (!candidates.length) {
    await m.reply('🔎 *Buscar otro título*\n\n🛡️ _No tengo más títulos candidatos para mostrar._')
    return renderAvailabilityMenu(m, conn, panel, pedido)
  }

  const rows = candidates.slice(0, 10).map((c, idx) => ({
    title: truncateText(c?.title || c?.key || `Título ${idx + 1}`, 44),
    description: truncateText(`Score: ${Number(c?.score || 0)} · ${waSafeInline(c?.source || '')}`, 60),
    rowId: makeFlowId(pid, 'TITLE_PICK', String(idx)),
  }))

  setPedidoFlow(pedido, { step: FLOW_STEPS.SELECT_TITULO, data: { ...(pedido.flow?.data || {}), lastMenu: 'CANDIDATES' } })
  await savePedidoAndEmit(panel, pedido, 'menu_candidates')

  const ok = await trySendInteractiveList(m, conn, {
    title: '🔎 Buscar otro título',
    text: `*Pedido:* ${waSafeInline(pedido?.titulo || '')}\n> _Selecciona el título correcto._`,
    sections: [{ title: 'Títulos', rows }],
  })
  if (!ok) {
    const lines = rows.map((r, i) => `${i + 1}. ${waSafeInline(r.title)}`).join('\n')
    await m.reply(`🔎 *Títulos candidatos*\n\n${lines}`)
  }
  return true
}

const renderMainSeasonsMenu = async (m, conn, panel, pedido, index) => {
  const pid = Number(pedido?.id)
  const chapterMap = buildMainChapterMap(index?.main || [])
  const seasonKeys = new Set([...chapterMap.keys()].map((s) => safeString(s || '0') || '0'))
  for (const u of index?.mainPacks || []) seasonKeys.add(safeString(u?.coverage?.season || '0') || '0')
  for (const u of index?.mainRanges || []) seasonKeys.add(safeString(u?.coverage?.season || '0') || '0')
  for (const u of index?.mainUnknown || []) seasonKeys.add(safeString(u?.coverage?.season || '0') || '0')

  const seasons = [...seasonKeys].sort((a, b) => Number(a) - Number(b))

  const formatCoverage = (cov) => {
    if (!cov) return 'desconocido'
    if (cov.coverageType === COVERAGE_TYPES.SINGLE_CHAPTER) return cov.chapterFrom ? `Cap ${cov.chapterFrom}` : 'Capítulo'
    if (cov.coverageType === COVERAGE_TYPES.CHAPTER_RANGE) return (cov.chapterFrom && cov.chapterTo) ? `Rango ${cov.chapterFrom}-${cov.chapterTo}` : 'Rango'
    if (cov.coverageType === COVERAGE_TYPES.FULL_SEASON) return (cov.chapterFrom && cov.chapterTo) ? `Temporada completa ${cov.chapterFrom}-${cov.chapterTo}` : 'Temporada completa'
    if (cov.coverageType === COVERAGE_TYPES.FULL_SERIES) return (cov.chapterFrom && cov.chapterTo) ? `Serie completa ${cov.chapterFrom}-${cov.chapterTo}` : 'Serie completa'
    if (cov.coverageType === COVERAGE_TYPES.COMPLETE_PACK) return (cov.chapterFrom && cov.chapterTo) ? `Pack completo ${cov.chapterFrom}-${cov.chapterTo}` : 'Pack completo'
    if (cov.coverageType === COVERAGE_TYPES.VOLUME) return cov.volume ? `Volumen ${cov.volume}` : 'Volumen'
    return 'desconocido'
  }

  const seriesPacks = (index?.mainPacks || []).filter((u) => {
    const t = u?.coverage?.coverageType
    return t === COVERAGE_TYPES.COMPLETE_PACK || t === COVERAGE_TYPES.FULL_SERIES
  })
  const seasonPacks = (index?.mainPacks || []).filter((u) => u?.coverage?.coverageType === COVERAGE_TYPES.FULL_SEASON)
  const ranges = Array.isArray(index?.mainRanges) ? index.mainRanges : []

  const sections = []
  if (seriesPacks.length) {
    const rows = seriesPacks.slice(0, 10).map((u) => {
      const name = u.source === 'lib' ? (u?.it?.originalName || u?.it?.title || `Archivo #${u.id}`) : (u?.it?.archivoNombre || u?.it?.titulo || `Aporte #${u.id}`)
      const fmt = getFileExtUpper(name) || 'DOC'
      return {
        title: truncateText(`🟢 Serie completa (${fmt})`, 44),
        description: truncateText(`${formatCoverage(u.coverage)} · ${waSafeInline(name)}`, 60),
        rowId: makeFlowId(pid, 'SEND', u.source, String(u.id)),
      }
    })
    sections.push({ title: '🟢 Packs completos', rows })
  }
  if (seasonPacks.length) {
    const rows = seasonPacks.slice(0, 10).map((u) => {
      const s = safeString(u?.coverage?.season || '0') || '0'
      const seasonLabel = s === '0' ? 'Sin temporada' : `Temp ${String(s).padStart(2, '0')}`
      return {
        title: truncateText(`🟢 ${seasonLabel}`, 44),
        description: truncateText(formatCoverage(u.coverage), 60),
        rowId: makeFlowId(pid, 'SEND', u.source, String(u.id)),
      }
    })
    sections.push({ title: 'Packs por temporada', rows })
  }
  if (ranges.length) {
    const rows = ranges.slice(0, 10).map((u) => {
      const s = safeString(u?.coverage?.season || '0') || '0'
      const seasonLabel = s === '0' ? 'Sin temporada' : `Temp ${String(s).padStart(2, '0')}`
      return {
        title: truncateText(`📦 ${seasonLabel}`, 44),
        description: truncateText(formatCoverage(u.coverage), 60),
        rowId: makeFlowId(pid, 'SEND', u.source, String(u.id)),
      }
    })
    sections.push({ title: 'Rangos', rows })
  }

  const seasonRows = seasons.slice(0, 10).map((s) => {
    const seasonMap = chapterMap.get(s) || new Map()
    const chapters = [...seasonMap.keys()].map(Number).filter((n) => Number.isFinite(n)).sort((x, y) => x - y)
    const desc = chapters.length ? `Caps: ${chapters[0]}-${chapters[chapters.length - 1]} (${chapters.length})` : 'Caps: -'
    const label = s === '0' ? 'Sin temporada' : `Temporada ${String(s).padStart(2, '0')}`
    return {
      title: label,
      description: truncateText(desc, 60),
      rowId: makeFlowId(pid, 'MAIN_SEASON', s),
    }
  })
  if (seasonRows.length) sections.push({ title: 'Temporadas', rows: seasonRows })

  const hasAnyMainOptions = Boolean(seasonRows.length || seriesPacks.length || seasonPacks.length || ranges.length)
  if (!hasAnyMainOptions) {
    await m.reply('📘 *Capítulos principales*\n\n🛡️ _No encontré contenido principal para este título._')
    return renderContentTypeMenu(m, conn, panel, pedido, index)
  }

  const hasAlt = Boolean(seriesPacks.length || seasonPacks.length || ranges.length)
  if (seasons.length === 1 && !hasAlt) {
    const season = seasons[0]
    pedido.flow ||= {}
    pedido.flow.data ||= {}
    pedido.flow.data.season = season
    setPedidoFlow(pedido, { step: FLOW_STEPS.SELECT_CAP, data: pedido.flow.data })
    await savePedidoAndEmit(panel, pedido, 'auto_one_season')
    return renderMainChaptersPage(m, conn, panel, pedido, index, season, 1)
  }

  setPedidoFlow(pedido, { step: FLOW_STEPS.SELECT_TEMP, data: { ...(pedido.flow?.data || {}), lastMenu: 'MAIN_SEASONS' } })
  await savePedidoAndEmit(panel, pedido, 'menu_main_seasons')

  const ok = await trySendInteractiveList(m, conn, {
    title: '📘 Temporadas',
    text: `*Título:* ${waSafeInline(pedido?.titulo || '')}\n> _Selecciona una temporada._`,
    sections,
  })
  if (!ok) await m.reply('📘 *Temporadas*')
  return true
}

const renderMainChaptersPage = async (m, conn, panel, pedido, index, season, page) => {
  const pid = Number(pedido?.id)
  const chapterMap = buildMainChapterMap(index?.main || [])
  const seasonKey = safeString(season || '0') || '0'
  const seasonMap = chapterMap.get(seasonKey) || new Map()
  const chapters = [...seasonMap.keys()].map(Number).filter((n) => Number.isFinite(n)).sort((x, y) => x - y)
  if (!chapters.length) {
    const seasonPacks = (index?.mainPacks || []).filter((u) => safeString(u?.coverage?.season || '0') === seasonKey)
    const seasonRanges = (index?.mainRanges || []).filter((u) => safeString(u?.coverage?.season || '0') === seasonKey)
    const fallbackRows = []
    for (const u of [...seasonPacks, ...seasonRanges].slice(0, 10)) {
      const name = u.source === 'lib' ? (u?.it?.originalName || u?.it?.title || `Archivo #${u.id}`) : (u?.it?.archivoNombre || u?.it?.titulo || `Aporte #${u.id}`)
      const fmt = getFileExtUpper(name) || 'DOC'
      const cov = u.coverage || {}
      const desc = cov.chapterFrom && cov.chapterTo ? `${cov.coverageType} ${cov.chapterFrom}-${cov.chapterTo}` : cov.coverageType || 'PACK'
      fallbackRows.push({
        title: truncateText(`${fmt}`, 44),
        description: truncateText(desc, 60),
        rowId: makeFlowId(pid, 'SEND', u.source, String(u.id)),
      })
    }
    if (!fallbackRows.length) {
      await m.reply('📘 *Capítulos*\n\n🛡️ _No encontré capítulos ni packs para esta temporada._')
      return renderMainSeasonsMenu(m, conn, panel, pedido, index)
    }
    const seasonLabel = seasonKey === '0' ? 'Sin temporada' : `Temporada ${String(seasonKey).padStart(2, '0')}`
    setPedidoFlow(pedido, { step: FLOW_STEPS.SELECT_VARIANTE, data: { ...(pedido.flow?.data || {}), season: seasonKey, lastMenu: 'SEASON_PACKS' } })
    await savePedidoAndEmit(panel, pedido, 'menu_season_packs')
    const ok = await trySendInteractiveList(m, conn, {
      title: '📦 Packs',
      text: `*Título:* ${waSafeInline(pedido?.titulo || '')}\n> *Temporada:* _${seasonLabel}_\n> _Selecciona un pack/rango._`,
      sections: [{ title: 'Packs', rows: fallbackRows }, { title: 'Navegación', rows: [{ title: '🔙 Volver', description: 'Volver a temporadas', rowId: makeFlowId(pid, 'BACK', 'MAIN_SEASONS') }] }],
    })
    if (!ok) await m.reply('📦 *Packs*')
    return true
  }

  const perPage = 9
  const p = clampInt(page, { min: 1, max: 9999, fallback: 1 })
  const maxPage = Math.max(1, Math.ceil(chapters.length / perPage))
  const start = (p - 1) * perPage
  const slice = chapters.slice(start, start + perPage)
  const rows = slice.map((ch) => ({
    title: `Capítulo ${String(ch).padStart(4, '0')}`,
    description: 'Ver opciones',
    rowId: makeFlowId(pid, 'MAIN_CH', seasonKey, String(ch)),
  }))

  const nav = []
  if (p > 1) nav.push({ title: '⬅️ Anterior', description: `Página ${p - 1}/${maxPage}`, rowId: makeFlowId(pid, 'MAIN_PAGE', seasonKey, String(p - 1)) })
  if (p < maxPage) nav.push({ title: '➡️ Siguiente', description: `Página ${p + 1}/${maxPage}`, rowId: makeFlowId(pid, 'MAIN_PAGE', seasonKey, String(p + 1)) })
  nav.push({ title: '🔙 Volver', description: 'Volver a temporadas', rowId: makeFlowId(pid, 'BACK', 'MAIN_SEASONS') })

  setPedidoFlow(pedido, { step: FLOW_STEPS.SELECT_CAP, data: { ...(pedido.flow?.data || {}), season: seasonKey, page: p, lastMenu: 'MAIN_CHAPTERS' } })
  await savePedidoAndEmit(panel, pedido, 'menu_main_chapters')

  const seasonLabel = seasonKey === '0' ? 'Sin temporada' : `Temporada ${String(seasonKey).padStart(2, '0')}`
  const ok = await trySendInteractiveList(m, conn, {
    title: '📘 Capítulos',
    text: `*Título:* ${waSafeInline(pedido?.titulo || '')}\n> *Temporada:* _${seasonLabel}_\n> *Página:* _${p}/${maxPage}_\n> _Selecciona un capítulo._`,
    sections: [{ title: 'Capítulos', rows }, { title: 'Navegación', rows: nav }],
  })
  if (!ok) await m.reply('📘 *Capítulos*')
  return true
}

const renderVariantsForChapter = async (m, conn, panel, pedido, index, seasonKey, chapterNum) => {
  const pid = Number(pedido?.id)
  const chapterMap = buildMainChapterMap(index?.main || [])
  const seasonMap = chapterMap.get(String(seasonKey)) || new Map()
  const variants = seasonMap.get(String(chapterNum)) || []

  const extraVariants = []
  for (const u of index?.mainRanges || []) {
    const cov = u?.coverage || null
    if (!cov) continue
    if (safeString(cov.season || '0') !== safeString(seasonKey || '0')) continue
    const fromN = Number(cov.chapterFrom)
    const toN = Number(cov.chapterTo)
    if (!Number.isFinite(fromN) || !Number.isFinite(toN)) continue
    if (chapterNum >= Math.min(fromN, toN) && chapterNum <= Math.max(fromN, toN)) extraVariants.push(u)
  }
  for (const u of index?.mainPacks || []) {
    const cov = u?.coverage || null
    if (!cov) continue
    if (safeString(cov.season || '0') !== safeString(seasonKey || '0')) continue
    if (cov.chapterFrom && cov.chapterTo) {
      const fromN = Number(cov.chapterFrom)
      const toN = Number(cov.chapterTo)
      if (Number.isFinite(fromN) && Number.isFinite(toN) && chapterNum >= Math.min(fromN, toN) && chapterNum <= Math.max(fromN, toN)) extraVariants.push(u)
    }
  }

  const combined = []
  const seen = new Set()
  for (const u of [...variants, ...extraVariants]) {
    const key = `${u.source}:${u.id}`
    if (seen.has(key)) continue
    seen.add(key)
    combined.push(u)
  }

  if (!combined.length) {
    await m.reply('📘 *Capítulo*\n\n🛡️ _No encontré archivos para ese capítulo._')
    return renderMainChaptersPage(m, conn, panel, pedido, index, seasonKey, pedido?.flow?.data?.page || 1)
  }

  const isSingleChapterOnly = combined.length === 1 && (combined[0]?.coverage?.coverageType === COVERAGE_TYPES.SINGLE_CHAPTER)
  if (isSingleChapterOnly) {
    const v = combined[0]
    return handleSendSelection(m, conn, panel, pedido, v.source, v.id, v.cls?.contentType || 'main')
  }

  const rows = combined.slice(0, 10).map((v) => {
    const name = v.source === 'lib' ? (v?.it?.originalName || v?.it?.title || `Archivo #${v.id}`) : (v?.it?.archivoNombre || v?.it?.titulo || `Aporte #${v.id}`)
    const fmt = getFileExtUpper(name) || (v.source === 'lib' ? 'DOC' : 'DOC')
    const origin = v.source === 'lib' ? 'Biblioteca' : 'Aportes'
    const cov = v.coverage || {}
    const covLabel =
      cov.coverageType === COVERAGE_TYPES.SINGLE_CHAPTER
        ? (cov.chapterFrom ? `Cap ${cov.chapterFrom}` : 'Capítulo')
        : cov.chapterFrom && cov.chapterTo
          ? `${cov.coverageType} ${cov.chapterFrom}-${cov.chapterTo}`
          : (cov.coverageType || 'VARIANTE')
    return {
      title: truncateText(`${origin} (${fmt})`, 44),
      description: truncateText(`${covLabel} · ${waSafeInline(name)}`, 60),
      rowId: makeFlowId(pid, 'SEND', v.source, String(v.id)),
    }
  })

  setPedidoFlow(pedido, { step: FLOW_STEPS.SELECT_VARIANTE, data: { ...(pedido.flow?.data || {}), season: String(seasonKey), chapter: String(chapterNum), lastMenu: 'VARIANTS' } })
  await savePedidoAndEmit(panel, pedido, 'menu_variants')

  const ok = await trySendInteractiveList(m, conn, {
    title: '📦 Opciones',
    text: `*Título:* ${waSafeInline(pedido?.titulo || '')}\n> *Capítulo:* _${String(chapterNum)}_\n> _Selecciona una opción._`,
    sections: [{ title: 'Opciones', rows }],
  })
  if (ok) return true
  await m.reply('📦 *Opciones*\n\n🛡️ _No pude mostrar el menú._')
  return true
}

const renderExtraTypesMenu = async (m, conn, panel, pedido, index) => {
  const pid = Number(pedido?.id)
  const types = [...(index?.extrasByType?.keys?.() || [])]
  if (!types.length) {
    await m.reply('✨ *Extras / Side stories*\n\n🛡️ _No encontré contenido adicional._')
    return renderContentTypeMenu(m, conn, panel, pedido, index)
  }

  const rows = types.slice(0, 10).map((t) => {
    const arr = index.extrasByType.get(t) || []
    return {
      title: truncateText(CONTENT_TYPE_LABEL[t] || t, 44),
      description: truncateText(`Items: ${arr.length}`, 60),
      rowId: makeFlowId(pid, 'EXTRA_TYPE', t),
    }
  })

  setPedidoFlow(pedido, { step: FLOW_STEPS.SELECT_TIPO, data: { ...(pedido.flow?.data || {}), lastMenu: 'EXTRA_TYPES' } })
  await savePedidoAndEmit(panel, pedido, 'menu_extra_types')

  const ok = await trySendInteractiveList(m, conn, {
    title: '✨ Contenido adicional',
    text: `*Título:* ${waSafeInline(pedido?.titulo || '')}\n> _Selecciona un tipo._`,
    sections: [{ title: 'Tipos', rows }],
  })
  if (ok) return true
  await m.reply('✨ *Contenido adicional*\n\n🛡️ _No pude mostrar el menú._')
  return true
}

const renderExtraItemsPage = async (m, conn, panel, pedido, index, type, page) => {
  const pid = Number(pedido?.id)
  const t = CONTENT_TYPES.includes(type) ? type : detectContentTypeFromText(type)
  const list = (index?.extrasByType?.get(t) || []).slice()
  if (!list.length) {
    await m.reply('✨ *Extras*\n\n🛡️ _No encontré items para ese tipo._')
    return renderExtraTypesMenu(m, conn, panel, pedido, index)
  }

  const perPage = 9
  const p = clampInt(page, { min: 1, max: 9999, fallback: 1 })
  const maxPage = Math.max(1, Math.ceil(list.length / perPage))
  const start = (p - 1) * perPage
  const slice = list.slice(start, start + perPage)
  const rows = slice.map((u) => {
    const name = u.source === 'lib' ? (u?.it?.originalName || u?.it?.title || `Archivo #${u.id}`) : (u?.it?.archivoNombre || u?.it?.titulo || `Aporte #${u.id}`)
    const origin = u.source === 'lib' ? 'Biblioteca' : 'Aportes'
    return {
      title: truncateText(name, 44),
      description: truncateText(`${origin} · ${CONTENT_TYPE_LABEL[t] || t}`, 60),
      rowId: makeFlowId(pid, 'EXTRA_ITEM', u.source, String(u.id)),
    }
  })

  const nav = []
  if (p > 1) nav.push({ title: '⬅️ Anterior', description: `Página ${p - 1}/${maxPage}`, rowId: makeFlowId(pid, 'EXTRA_PAGE', t, String(p - 1)) })
  if (p < maxPage) nav.push({ title: '➡️ Siguiente', description: `Página ${p + 1}/${maxPage}`, rowId: makeFlowId(pid, 'EXTRA_PAGE', t, String(p + 1)) })
  nav.push({ title: '🔙 Tipos', description: 'Volver a tipos', rowId: makeFlowId(pid, 'BACK', 'EXTRA_TYPES') })

  setPedidoFlow(pedido, { step: FLOW_STEPS.SELECT_VARIANTE, data: { ...(pedido.flow?.data || {}), extraType: t, page: p, lastMenu: 'EXTRA_ITEMS' } })
  await savePedidoAndEmit(panel, pedido, 'menu_extra_items')

  const ok = await trySendInteractiveList(m, conn, {
    title: '✨ Extras',
    text: `*Título:* ${waSafeInline(pedido?.titulo || '')}\n> *Tipo:* _${CONTENT_TYPE_LABEL[t] || t}_\n> *Página:* _${p}/${maxPage}_\n> _Selecciona un item._`,
    sections: [{ title: 'Items', rows }, { title: 'Navegación', rows: nav }],
  })
  if (ok) return true
  await m.reply('✨ *Extras*\n\n🛡️ _No pude mostrar el menú._')
  return true
}

const renderIllustrationsMenu = async (m, conn, panel, pedido, index) => {
  const pid = Number(pedido?.id)
  const list = Array.isArray(index?.illustrations) ? index.illustrations.slice() : []
  if (!list.length) {
    await m.reply('🎨 *Ilustraciones*\n\n🛡️ _No encontré ilustraciones._')
    return renderContentTypeMenu(m, conn, panel, pedido, index)
  }
  const rows = list.slice(0, 10).map((u) => {
    const name = u.source === 'lib' ? (u?.it?.originalName || u?.it?.title || `Archivo #${u.id}`) : (u?.it?.archivoNombre || u?.it?.titulo || `Aporte #${u.id}`)
    const origin = u.source === 'lib' ? 'Biblioteca' : 'Aportes'
    return {
      title: truncateText(name, 44),
      description: truncateText(`${origin} · Ilustraciones`, 60),
      rowId: makeFlowId(pid, 'EXTRA_ITEM', u.source, String(u.id)),
    }
  })
  setPedidoFlow(pedido, { step: FLOW_STEPS.SELECT_VARIANTE, data: { ...(pedido.flow?.data || {}), lastMenu: 'ILLUS' } })
  await savePedidoAndEmit(panel, pedido, 'menu_illustrations')
  const ok = await trySendInteractiveList(m, conn, {
    title: '🎨 Ilustraciones',
    text: `*Título:* ${waSafeInline(pedido?.titulo || '')}\n> _Selecciona un item._`,
    sections: [{ title: 'Ilustraciones', rows }],
  })
  if (ok) return true
  await m.reply('🎨 *Ilustraciones*\n\n🛡️ _No pude mostrar el menú._')
  return true
}

const renderConfirmNonMain = async (m, conn, panel, pedido, pending) => {
  const pid = Number(pedido?.id)
  const type = safeString(pending?.contentType || 'extra')
  const cov = pending?.coverage || null
  const covType = safeString(cov?.coverageType || '').trim()
  const covLabel = (() => {
    if (!covType) return ''
    if (covType === COVERAGE_TYPES.SINGLE_CHAPTER) return ''
    if (covType === COVERAGE_TYPES.VOLUME) return cov?.volume ? `Volumen ${safeString(cov.volume)}` : 'Volumen'
    if (cov?.chapterFrom && cov?.chapterTo) return `${covType} ${safeString(cov.chapterFrom)}-${safeString(cov.chapterTo)}`
    return covType
  })()
  const sizeMB = cov?.measures?.sizeMB != null ? Number(cov.measures.sizeMB) : null
  const pageCount = cov?.measures?.pageCount != null ? Number(cov.measures.pageCount) : null

  const warning =
    (String(type).toLowerCase().trim() !== 'main')
      ? (CONTENT_TYPE_WARNING[type] || 'Este contenido no forma parte de la historia principal.')
      : needsExplicitConfirmForCoverage(cov)
        ? 'Este archivo contiene múltiples capítulos (pack/rango).'
        : ''

  setPedidoFlow(pedido, { step: FLOW_STEPS.CONFIRM_EXTRA, data: { ...(pedido.flow?.data || {}), pending } })
  await savePedidoAndEmit(panel, pedido, 'confirm_needed')

  const extraLines = []
  if (covLabel) extraLines.push(`> *Cobertura:* _${waSafeInline(covLabel)}_`)
  if (Number.isFinite(sizeMB) && sizeMB > 0) extraLines.push(`> *Tamaño:* _${sizeMB} MB_`)
  if (Number.isFinite(pageCount) && pageCount > 0) extraLines.push(`> *Páginas:* _${pageCount}_`)
  if (Number.isFinite(sizeMB) && sizeMB >= 30) extraLines.push('> ⚠️ _Archivo pesado: puede tardar y consumir datos._')

  const text =
    `⚠️ *Confirmación*\n\n` +
    `> *Título:* ${waSafeInline(pedido?.titulo || '')}\n` +
    `> *Tipo:* _${CONTENT_TYPE_LABEL[type] || type}_\n` +
    (extraLines.length ? `${extraLines.join('\n')}\n\n` : '\n') +
    (warning ? `${warning}\n\n` : '') +
    `¿Deseas continuar?`

  const buttons = [
    ['✅ Sí, enviar', makeFlowId(pid, 'CONFIRM_SEND', 'YES')],
    ['❌ Volver', makeFlowId(pid, 'CONFIRM_SEND', 'NO')],
  ]
  const ok = await trySendFlowButtons(m, conn, { text, footer: '🛡️ Oguri Bot', buttons })
  if (ok) return true
  await m.reply(`${text}\n\n> Responde: *SI* / *NO*`)
  return true
}

const handleSendSelection = async (m, conn, panel, pedido, source, itemId, contentType, { isAdmin, isBotOwner, confirmed = false } = {}) => {
  const src = safeString(source).toLowerCase()
  const idNum = Number(itemId)
  if (!Number.isFinite(idNum) || idNum <= 0) {
    await m.reply('❌ *Error*\n\n> _Selección inválida._')
    return true
  }
  const ctype = safeString(contentType || '').toLowerCase().trim() || 'main'
  const coverage = (() => {
    try {
      if (src === 'lib') {
        const it = panel?.contentLibrary?.[idNum] || null
        const name = safeString(it?.originalName || it?.title || '').trim()
        const fp = safeString(it?.file_path || '').trim() || null
        return classifyCoverageFromItemText({
          rawText: name,
          contentType: ctype,
          explicitSeason: it?.season,
          explicitChapter: it?.chapter,
          filePath: fp,
        })
      }
      const aportesAll = Array.isArray(global.db?.data?.aportes) ? global.db.data.aportes : []
      const a = aportesAll.find((x) => Number(x?.id) === idNum) || null
      const name = safeString(a?.archivoNombre || a?.titulo || '').trim()
      // Resolver filePath inline para medir tamaño/páginas (sin depender de funciones definidas más abajo).
      let fp = null
      try {
        const rel = safeString(a?.archivoPath || '').trim()
        if (rel && !rel.includes('..')) {
          const root = path.resolve(process.cwd(), 'storage', 'media')
          const p = path.resolve(process.cwd(), rel)
          if (p.toLowerCase().startsWith(root.toLowerCase()) && fs.existsSync(p) && fs.statSync(p).isFile()) fp = p
        }
      } catch { }
      return classifyCoverageFromItemText({
        rawText: name,
        contentType: ctype,
        explicitSeason: a?.temporada,
        explicitChapter: a?.capitulo,
        filePath: fp,
      })
    } catch {
      return null
    }
  })()

  const needsConfirm =
    needsExplicitConfirmForType(ctype) ||
    needsExplicitConfirmForCoverage(coverage) ||
    (Number(coverage?.measures?.sizeMB || 0) >= 30)

  if (!confirmed && needsConfirm) {
    const pending = { source: src, itemId: idNum, contentType: ctype, coverage, createdAt: new Date().toISOString() }
    return renderConfirmNonMain(m, conn, panel, pedido, pending)
  }

  setPedidoFlow(pedido, { step: FLOW_STEPS.EN_PROCESO, data: { ...(pedido.flow?.data || {}), lastMenu: 'SENDING' } })
  await savePedidoAndEmit(panel, pedido, 'sending')

  const processed = await processPedidoSelection(panel, {
    pedidoId: pedido.id,
    source: src === 'aporte' ? 'aporte' : 'lib',
    itemId: idNum,
    m,
    conn,
    usedPrefix: '',
    isAdmin: Boolean(isAdmin),
    isBotOwner: Boolean(isBotOwner),
  })
  if (!processed.ok) {
    setPedidoFlow(pedido, { step: FLOW_STEPS.ERROR, data: { ...(pedido.flow?.data || {}), error: processed.error || 'send_failed' } })
    await savePedidoAndEmit(panel, pedido, 'send_failed')
    await m.reply(`❌ *No pude enviar*\n\n> *Motivo:* _${waSafeInline(processed.error || 'Error')}_`)
    return true
  }

  setPedidoFlow(pedido, { step: FLOW_STEPS.COMPLETADO, data: { ...(pedido.flow?.data || {}), completedAt: new Date().toISOString() } })
  await savePedidoAndEmit(panel, pedido, 'completed')
  await m.reply(`✅ *Pedido completado*\n\n> *ID:* \`\`\`#${pedido.id}\`\`\`\n> *Título:* ${waSafeInline(pedido?.titulo || '')}`)
  return true
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
const connCanSendProtoFlow = (conn) => typeof conn?.sendNCarousel === 'function'

const toNativeFlowSingleSelectSections = (sections) => {
  const out = []
  for (const s of Array.isArray(sections) ? sections : []) {
    const rowsIn = Array.isArray(s?.rows) ? s.rows : []
    const rows = []
    for (const r of rowsIn) {
      const id = safeString(r?.id || r?.rowId || '').trim()
      const title = safeString(r?.title || '').trim()
      if (!id || !title) continue
      rows.push({
        title,
        description: safeString(r?.description || '').trim(),
        id,
      })
      if (rows.length >= 10) break
    }
    if (!rows.length) continue
    out.push({ title: safeString(s?.title || '').trim(), rows })
    if (out.length >= 10) break
  }
  return out
}

const trySendProtoSingleSelect = async (m, conn, { title, text, buttonText, sections, footer } = {}) => {
  if (!connCanSendProtoFlow(conn)) return false
  if (!Array.isArray(sections) || !sections.some((s) => Array.isArray(s?.rows) && s.rows.length)) return false

  const safeButtonText = safeString(buttonText || 'Ver opciones').trim() || 'Ver opciones'
  const body = `${title ? `*${waSafeInline(title)}*\n\n` : ''}${safeString(text || '')}`
  try {
    const nfSections = toNativeFlowSingleSelectSections(sections)
    if (!nfSections.length) return false
    const timeoutMs = clampInt(process.env.WA_LIST_TIMEOUT_MS, { min: 1500, max: 30000, fallback: 9000 })
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        await Promise.race([
          conn.sendNCarousel(m.chat, body, safeString(footer || '🛡️ Oguri Bot'), null, [], null, null, [[safeButtonText, nfSections]], m, {}),
          new Promise((_, reject) => setTimeout(() => reject(new Error('sendNCarousel(single_select) timeout')), timeoutMs)),
        ])
        return true
      } catch (err) {
        if (attempt === 0) await new Promise((r) => setTimeout(r, 450))
        else throw err
      }
    }
    return false
  } catch (err) {
    console.error('sendNCarousel(single_select) failed:', err)
    return false
  }
}

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

  const isCreator = sameUser(aporte?.usuario, m?.sender)
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
  if (!Array.isArray(sections) || !sections.some((s) => Array.isArray(s?.rows) && s.rows.length)) return false

  // 0) Preferir "proto/nativeFlow" (single_select) porque suele ser el más compatible.
  {
    const ok = await trySendProtoSingleSelect(m, conn, { title, text, buttonText: 'Ver opciones', sections, footer: '🛡️ Oguri Bot' })
    if (ok) return true
  }

  // 1) Fallback: listMessage (si existe) para dispositivos que no responden a nativeFlow.
  if (connCanSendList(conn)) {
    try {
      const listSections = (sections || []).map((s) => ({
        title: safeString(s?.title || '').trim(),
        rows: (Array.isArray(s?.rows) ? s.rows : [])
          .map((r) => ({
            title: safeString(r?.title || '').trim(),
            description: safeString(r?.description || '').trim(),
            rowId: safeString(r?.rowId || r?.id || '').trim(),
          }))
          .filter((r) => r.rowId && r.title)
          .slice(0, 10),
      })).filter((s) => s.rows.length).slice(0, 10)

      if (listSections.length) {
        await conn.sendList(m.chat, safeString(title || ''), safeString(text || ''), 'Ver opciones', listSections, m)
        return true
      }
    } catch (err) {
      console.error('sendList fallback failed:', err)
    }
  }

  return false
}

const trySendTemplateResponse = async (m, conn, { text, footer, buttons }) => {
  // 0) Preferir proto/nativeFlow (quick_reply) si está disponible.
  if (connCanSendProtoFlow(conn)) {
    const safeButtons = Array.isArray(buttons) ? buttons.filter((b) => Array.isArray(b) && b[0] && b[1]).slice(0, 10) : []
    if (safeButtons.length) {
      try {
        const timeoutMs = clampInt(process.env.WA_TEMPLATE_TIMEOUT_MS, { min: 1500, max: 30000, fallback: 9000 })
        await Promise.race([
          conn.sendNCarousel(m.chat, String(text || ''), String(footer || '🛡️ Oguri Bot'), null, safeButtons, null, null, null, m, {}),
          new Promise((_, reject) => setTimeout(() => reject(new Error('sendNCarousel(quick_reply) timeout')), timeoutMs)),
        ])
        return true
      } catch (err) {
        console.error('sendNCarousel(quick_reply) failed:', err)
      }
    }
  }

  return false
}

const trySendFlowButtons = async (m, conn, { text, footer, buttons } = {}) => {
  const safeButtons = Array.isArray(buttons) ? buttons.filter((b) => Array.isArray(b) && b[0] && b[1]).slice(0, 10) : []
  if (!safeButtons.length) return false

  // Preferir proto/nativeFlow (quick_reply).
  if (connCanSendProtoFlow(conn)) {
    try {
      const timeoutMs = clampInt(process.env.WA_FLOW_BUTTONS_TIMEOUT_MS, { min: 1500, max: 30000, fallback: 9000 })
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          await Promise.race([
            conn.sendNCarousel(m.chat, String(text || ''), String(footer || '🛡️ Oguri Bot'), null, safeButtons, null, null, null, m, {}),
            new Promise((_, reject) => setTimeout(() => reject(new Error('sendNCarousel timeout')), timeoutMs)),
          ])
          return true
        } catch (err) {
          if (attempt === 0) await new Promise((r) => setTimeout(r, 450))
          else throw err
        }
      }
    } catch (err) {
      console.error('sendNCarousel(flow) failed:', err)
    }
  }

  // Fallback: listMessage
  if (connCanSendList(conn)) {
    try {
      const rows = safeButtons.slice(0, 10).map(([t, id]) => ({
        title: safeString(t || '').trim().slice(0, 24) || 'Opción',
        description: '',
        rowId: safeString(id || '').trim(),
      })).filter((r) => r.rowId && r.title)
      if (rows.length) {
        await conn.sendList(m.chat, 'Opciones', safeString(text || ''), 'Abrir', [{ title: 'Opciones', rows }], m)
        return true
      }
    } catch (err) {
      console.error('sendList(flow) fallback failed:', err)
    }
  }

  return false
}

const isAporteApproved = (aporte) => {
  const estado = safeString(aporte?.estado || '').toLowerCase().trim()
  return estado === 'aprobado' || estado === 'approved'
}

const scoreAporte = (aporte, queryTokensSet, pedidoMeta = null) => {
  const title = safeString(aporte?.titulo || '')
  const body = safeString(aporte?.contenido || '')
  const archivoNombre = safeString(aporte?.archivoNombre || '')
  const tags = Array.isArray(aporte?.tags) ? aporte.tags.join(' ') : ''
  const tipo = safeString(aporte?.tipo || '')
  const combined = `${title} ${body} ${archivoNombre} ${tags} ${tipo}`
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

    const aTitleNorm = normalizeText(aporte?.titulo || aporte?.archivoNombre || '')
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

const dedupeDoubleExtension = (name) => {
  const s = safeString(name || '').trim()
  if (!s) return s
  // Evitar "archivo.pdf.pdf" u otros duplicados simples.
  return s.replace(/(\.[a-z0-9]{1,6})\1$/i, '$1')
}

const sanitizeDocumentFilename = (name, { fallbackExt = 'bin' } = {}) => {
  let s = safeString(name || '').trim()
  if (!s) s = `archivo.${fallbackExt}`
  s = s.replace(/[\\\/]+/g, '_')
  s = s.replace(/\s+/g, ' ').trim()
  s = dedupeDoubleExtension(s)
  if (!/\.[a-z0-9]{1,6}$/i.test(s)) s = `${s}.${fallbackExt}`
  return s
}

const withPedidoSendQueue = async (fn) => {
  const maxConcurrent = clampInt(process.env.PEDIDOS_SEND_CONCURRENCY, { min: 1, max: 3, fallback: 1 })
  global.__pedidoSendQueue ||= { active: 0, waiters: [] }
  const q = global.__pedidoSendQueue

  if (q.active >= maxConcurrent) {
    await new Promise((resolve) => q.waiters.push(resolve))
  }

  q.active += 1
  try {
    return await fn()
  } finally {
    q.active = Math.max(0, Number(q.active || 0) - 1)
    const next = q.waiters.shift()
    if (typeof next === 'function') next()
  }
}

const sendDocumentFromPath = async (m, conn, filePath, filename, caption) => {
  const safeName = sanitizeDocumentFilename(filename || path.basename(filePath), { fallbackExt: 'bin' })
  const mimetype = mimeTypes.lookup(safeName) || mimeTypes.lookup(filePath) || 'application/octet-stream'

  await withPedidoSendQueue(async () => {
    await conn.sendMessage(
      m.chat,
      {
        document: { url: filePath },
        fileName: safeName,
        mimetype,
        caption: safeString(caption || '').trim() || undefined,
      },
      { quoted: m }
    )
  })
}

const trySendLocalFile = async (m, conn, filePath, filename, caption) => {
  try {
    const stat = fs.statSync(filePath)
    const maxBytes = Number(process.env.WA_SEND_MAX_BYTES || 45 * 1024 * 1024)
    if (Number.isFinite(maxBytes) && stat.size > maxBytes) {
      return { ok: false, reason: `Archivo muy grande (${Math.round(stat.size / 1024 / 1024)}MB)` }
    }
    await sendDocumentFromPath(m, conn, filePath, filename, caption)
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
    await sendDocumentFromPath(m, conn, filePath, filename, caption)
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: err?.message || 'Error enviando archivo' }
  }
}

const canUserManagePedido = (pedido, { m, isBotOwner, isAdmin } = {}) => {
  if (!pedido) return false
  if (isBotOwner) return true
  const sameChat = !pedido?.grupo_id || String(pedido.grupo_id) === String(m?.chat || '')
  // Permitir a cualquier participante del mismo chat (grupo) usar los menús e interactivos del pedido
  if (sameChat) return true
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

const buildSelectedResultMeta = ({ source, score, libItem, aporte, coverage = null, contentType = null, contentSource = null, isBL = null } = {}) => {
  if (source === 'lib') {
    const cov = coverage || null
    const fmt = getFileExtUpper(libItem?.originalName || libItem?.filename || libItem?.file_path || '') || null
    return {
      source: 'biblioteca',
      id: Number(libItem?.id || 0) || null,
      title: safeString(libItem?.title || libItem?.originalName || '').trim(),
      filename: safeString(libItem?.originalName || libItem?.filename || '').trim() || null,
      format: fmt,
      season: cov?.season != null ? String(cov.season) : (libItem?.season != null ? String(libItem.season) : null),
      chapter: cov?.coverageType === COVERAGE_TYPES.SINGLE_CHAPTER ? (cov?.chapterFrom != null ? String(cov.chapterFrom) : null) : null,
      chapterFrom: cov?.chapterFrom != null ? String(cov.chapterFrom) : null,
      chapterTo: cov?.chapterTo != null ? String(cov.chapterTo) : null,
      coverageType: cov?.coverageType || null,
      inferredCoverage: Boolean(cov?.inferredCoverage),
      sizeMB: cov?.measures?.sizeMB != null ? Number(cov.measures.sizeMB) : null,
      pageCount: cov?.measures?.pageCount != null ? Number(cov.measures.pageCount) : null,
      score: typeof score === 'number' ? Math.round(score) : null,
      contentType: contentType || 'main',
      contentSource: contentSource || null,
      isBL: typeof isBL === 'boolean' ? isBL : null,
    }
  }
  if (source === 'aporte') {
    const cov = coverage || null
    const fmt = getFileExtUpper(aporte?.archivoNombre || aporte?.archivo || '') || null
    return {
      source: 'aporte',
      id: Number(aporte?.id || 0) || null,
      title: safeString(aporte?.titulo || aporte?.contenido || '').trim(),
      filename: safeString(aporte?.archivoNombre || '').trim() || null,
      format: fmt,
      season: cov?.season != null ? String(cov.season) : (aporte?.temporada != null ? String(aporte.temporada) : null),
      chapter: cov?.coverageType === COVERAGE_TYPES.SINGLE_CHAPTER ? (cov?.chapterFrom != null ? String(cov.chapterFrom) : null) : null,
      chapterFrom: cov?.chapterFrom != null ? String(cov.chapterFrom) : null,
      chapterTo: cov?.chapterTo != null ? String(cov.chapterTo) : null,
      coverageType: cov?.coverageType || null,
      inferredCoverage: Boolean(cov?.inferredCoverage),
      sizeMB: cov?.measures?.sizeMB != null ? Number(cov.measures.sizeMB) : null,
      pageCount: cov?.measures?.pageCount != null ? Number(cov.measures.pageCount) : null,
      score: typeof score === 'number' ? Math.round(score) : null,
      contentType: contentType || 'main',
      contentSource: contentSource || null,
      isBL: typeof isBL === 'boolean' ? isBL : null,
    }
  }
  return { source: safeString(source || 'unknown'), id: null, title: '', season: null, chapter: null, chapterFrom: null, chapterTo: null, coverageType: null, inferredCoverage: false, sizeMB: null, pageCount: null, score: null, contentType: contentType || 'main', contentSource: contentSource || null, isBL: typeof isBL === 'boolean' ? isBL : null }
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

    const cls = classifyLibraryItem(item)
    const cov = classifyCoverageFromItemText({
      rawText: safeString(item?.originalName || item?.title || '').trim(),
      contentType: cls?.contentType || 'main',
      explicitSeason: item?.season,
      explicitChapter: item?.chapter,
      filePath: safeString(item?.file_path || '').trim() || null,
    })
    selected = buildSelectedResultMeta({
      source: 'lib',
      score: typeof score === 'number' ? score : null,
      libItem: item,
      coverage: cov,
      contentType: cls?.contentType || 'main',
      contentSource: cls?.contentSource || null,
      isBL: cls?.isBL || false,
    })

    const sent = await trySendLibraryItem(m, conn, item)
    if (!sent.ok) return { ok: false, error: sent.reason || 'No pude enviar el archivo' }
  } else if (src === 'aporte' || src === 'aportes') {
    const aportes = Array.isArray(global.db?.data?.aportes) ? global.db.data.aportes : []
    const aporte = aportes.find((a) => Number(a?.id) === iid) || null
    if (!aporte) return { ok: false, error: `Aporte #${iid} no encontrado` }
    if (!isAporteVisibleToUser(aporte, { m, isBotOwner, isAdmin })) return { ok: false, error: 'No tienes acceso a este aporte' }

    const cls = classifyAporteItem(aporte)
    const filePath = resolveAporteFilePath(aporte)
    const cov = classifyCoverageFromItemText({
      rawText: safeString(aporte?.archivoNombre || aporte?.titulo || '').trim(),
      contentType: cls?.contentType || 'main',
      explicitSeason: aporte?.temporada,
      explicitChapter: aporte?.capitulo,
      filePath,
    })
    selected = buildSelectedResultMeta({
      source: 'aporte',
      score: typeof score === 'number' ? score : null,
      aporte,
      coverage: cov,
      contentType: cls?.contentType || 'main',
      contentSource: cls?.contentSource || null,
      isBL: cls?.isBL || false,
    })

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
    await sendDocumentFromPath(m, conn, pdfFile.filePath, pdfFile.filename, caption)
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
    includePending: Boolean(isBotOwner),
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
      // -----------------------------
      // NUEVO FLUJO (state machine)
      // El usuario solo escribe el título.
      // Todo lo demás se resuelve con interactivos + estados internos.
      // -----------------------------

      const rawInput = (args || []).join(' ').trim()
      if (!rawInput) {
        return m.reply(
          `📝 *Crear un pedido*\n\n` +
          `> *Uso:* \`\`\`${usedPrefix}${command} <título>\`\`\`\n` +
          `> _Solo escribe el título. El bot guía todo con interactivos._`
        )
      }

      const parsedInput = parsePedido(rawInput)
      if (!parsedInput.ok) return m.reply(`❌ *Pedido inválido*\n\n> _${safeString(parsedInput.error)}_`)

      const queryTitle = safeString(parsedInput.title).trim()
      const id = nextPedidoId()
      const now = new Date().toISOString()
      const proveedorJid = (m.isGroup && panel?.proveedores?.[m.chat]) ? m.chat : null

      const pedido = {
        id,
        titulo: queryTitle,
        titulo_normalizado: normalizeText(queryTitle),
        descripcion: '',
        tipo: 'general',
        estado: 'pendiente',
        prioridad: 'media',
        usuario: m.sender,
        grupo_id: m.isGroup ? m.chat : null,
        grupo_nombre: m.isGroup ? (await conn.groupMetadata(m.chat).catch(() => ({}))).subject || '' : '',
        proveedor_jid: proveedorJid,
        disponibilidad_detectada: null,
        flow: null,
        bot: {},
        votos: 0,
        votantes: [],
        fecha_creacion: now,
        fecha_actualizacion: now,
      }

      panel.pedidos[id] = pedido
      if (global.db?.write) await global.db.write().catch(() => { })
      try {
        const { emitPedidoCreated } = await import('../lib/socket-io.js')
        emitPedidoCreated(pedido)
      } catch { }

      const candidates = []
      for (const c of searchTitleCandidatesFromLibrary(panel, { proveedorJid, queryTitle, limit: 10 })) candidates.push({ ...c, source: 'proveedor' })
      for (const c of searchTitleCandidatesFromLibrary(panel, { proveedorJid: null, queryTitle, limit: 10 })) candidates.push({ ...c, source: 'global' })
      for (const c of searchTitleCandidatesFromAportes(queryTitle, { limit: 10, m, isBotOwner, isAdmin })) candidates.push({ ...c, source: 'aportes' })

      const dedup = new Map()
      for (const c of candidates) {
        const k = safeString(c?.key || '').trim()
        if (!k) continue
        const prev = dedup.get(k)
        if (!prev || Number(c.score || 0) > Number(prev.score || 0)) dedup.set(k, c)
      }
      const top = [...dedup.values()].sort((a, b) => Number(b.score || 0) - Number(a.score || 0)).slice(0, 10)

      const selectedKey = safeString(top?.[0]?.key || normalizeText(queryTitle)).trim()
      const displayTitle = pickDisplayTitle(top, queryTitle)
      pedido.titulo = displayTitle
      pedido.titulo_normalizado = selectedKey

      const allowGlobalLibrary = !m.isGroup || isBotOwner
      const libProv = Object.values(panel?.contentLibrary || {})
        .filter((it) => it && it.id)
        .filter((it) => (proveedorJid ? String(it?.proveedorJid || '') === String(proveedorJid) : true))
        .filter((it) => {
          const raw = safeString(it?.title || it?.originalName || '')
          return isTitleMatch(normalizeText(inferTitleFromFilename(raw) || raw), selectedKey)
        })
      const libGlobal = allowGlobalLibrary
        ? Object.values(panel?.contentLibrary || {})
          .filter((it) => it && it.id)
          .filter((it) => {
            const raw = safeString(it?.title || it?.originalName || '')
            return isTitleMatch(normalizeText(inferTitleFromFilename(raw) || raw), selectedKey)
          })
        : []
      const aportesAll = Array.isArray(global.db?.data?.aportes) ? global.db.data.aportes : []
      const aportes = aportesAll
        .filter((a) => {
          const raw = safeString(a?.titulo || a?.archivoNombre || '')
          return isTitleMatch(normalizeText(inferTitleFromFilename(raw) || raw), selectedKey)
        })
        .filter((a) => isAporteVisibleToUser(a, { m, isBotOwner, isAdmin }))
      const libMap = new Map()
      for (const it of [...libProv, ...libGlobal]) libMap.set(Number(it?.id), it)
      const mergedItems = { library: [...libMap.values()], aportes }

      const availability = buildAvailabilityFromItems(mergedItems)
      pedido.disponibilidad_detectada = availability
      setPedidoFlow(pedido, {
        step: FLOW_STEPS.RESUMEN,
        data: {
          queryTitle,
          queryKey: normalizeText(queryTitle),
          proveedorJid: proveedorJid || null,
          candidates: top.map((c) => ({ key: c.key, title: c.title, score: c.score, source: c.source })),
          selectedKey,
        },
      })
      appendPedidoLog(pedido, { event: 'pedido_created', step: FLOW_STEPS.RESUMEN, selectedKey })
      panel.pedidos[id] = pedido
      if (global.db?.write) await global.db.write().catch(() => { })

      const summaryText = renderAvailabilitySummaryText(pedido, availability)
      const buttons = [
        ['✅ Sí, continuar', makeFlowId(id, 'AVAIL_YES')],
        ['🔍 Ver detalles', makeFlowId(id, 'AVAIL_DETAILS')],
        ['🔁 Buscar otro', makeFlowId(id, 'AVAIL_OTHER')],
        ['❌ Cancelar', makeFlowId(id, 'AVAIL_CANCEL')],
      ]

      const ok = await trySendFlowButtons(m, conn, { text: summaryText, footer: '🛡️ Oguri Bot', buttons })
      if (ok) return null

      const fallback = `\n\n> _Si no ves botones, responde:_ *SI* / *DETALLES* / *OTRO* / *CANCELAR*`
      await m.reply(summaryText + `\n\n> _No pude mostrar el menú interactivo._` + fallback)
      return null


    }

    case 'seleccionpedido': {
      const pedidoId = parseInt(args[0])
      const source = safeString(args[1]).toLowerCase().trim()
      const itemId = parseInt(args[2])
      if (!pedidoId || !source || !itemId) {
        return m.reply(`✅ *Seleccionar coincidencia*\n\n> \`\`\`${usedPrefix}seleccionpedido <idPedido> <lib|aporte> <id>\`\`\``)
      }

      const pedido = panel?.pedidos?.[pedidoId] || null
      if (!pedido) return m.reply(`❌ *Error*\n\n> _Pedido #${pedidoId} no encontrado._`)
      if (String(pedido?.estado || '').toLowerCase().trim() === 'completado') {
        return m.reply(`✅ *Pedido ya completado*\n\n> \`\`\`#${pedidoId}\`\`\` _${waSafeInline(pedido?.titulo || '')}_`)
      }
      if (!canUserManagePedido(pedido, { m, isBotOwner, isAdmin })) {
        return m.reply('❌ *No permitido*\n\n> _Solo el creador, admins o owner pueden usar esto._')
      }

      let cls = { contentType: 'main', contentSource: null, isBL: false }
      if (source === 'lib' || source === 'biblioteca') {
        const it = panel?.contentLibrary?.[itemId] || null
        if (!it) return m.reply(`❌ *Error*\n\n> _Archivo #${itemId} no encontrado en biblioteca._`)
        cls = classifyLibraryItem(it)
      } else if (source === 'aporte' || source === 'aportes') {
        const aportes = Array.isArray(global.db?.data?.aportes) ? global.db.data.aportes : []
        const ap = aportes.find((a) => Number(a?.id) === Number(itemId)) || null
        if (!ap) return m.reply(`❌ *Error*\n\n> _Aporte #${itemId} no encontrado._`)
        cls = classifyAporteItem(ap)
      }

      const contentType = cls?.contentType || 'main'
      if (needsExplicitConfirmForType(contentType)) {
        pedido.bot ||= {}
        pedido.bot.pendingSelection = {
          source,
          itemId,
          contentType,
          contentSource: cls?.contentSource || null,
          isBL: Boolean(cls?.isBL),
          chat: String(m.chat || ''),
          sender: String(m.sender || ''),
          createdAt: new Date().toISOString(),
        }
        appendPedidoLog(pedido, {
          event: 'extra_selected',
          source,
          itemId,
          contentType,
          contentSource: cls?.contentSource || null,
        })
        panel.pedidos[pedidoId] = pedido
        if (global.db?.write) await global.db.write().catch(() => { })

        const typeLabel = CONTENT_TYPE_LABEL[contentType] || contentType
        const warning = CONTENT_TYPE_WARNING[contentType] || 'Este contenido no forma parte de la historia principal.'
        const srcLabel = cls?.contentSource ? `> *Fuente:* _${waSafeInline(cls.contentSource)}_\n` : ''

        const msg =
          `⚠️ *Contenido adicional detectado*\n\n` +
          `> *Tipo:* _${waSafeInline(typeLabel)}_\n` +
          srcLabel +
          `> _${waSafeInline(warning)}_\n\n` +
          `¿Deseas continuar?`

        const ok = await trySendFlowButtons(m, conn, {
          text: msg,
          footer: '🛡️ Confirmación requerida',
          buttons: [
            ['✅ Sí, enviar', `${usedPrefix}confirmarpedido ${pedidoId} si`],
            ['❌ Volver', `${usedPrefix}confirmarpedido ${pedidoId} no`],
            ['🔙 Menú', `${usedPrefix}procesarpedido ${pedidoId}`],
          ],
        })
        if (ok) return null
        return m.reply(`${msg}\n\n> \`\`\`${usedPrefix}confirmarpedido ${pedidoId} si|no\`\`\``)
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

    case 'confirmarpedido': {
      const pedidoId = parseInt(args[0])
      const decision = safeString(args[1] || '').toLowerCase().trim()
      if (!pedidoId || !decision) {
        return m.reply(`⚠️ *Confirmación*\n\n> \`\`\`${usedPrefix}confirmarpedido <idPedido> si|no\`\`\``)
      }

      const pedido = panel?.pedidos?.[pedidoId] || null
      if (!pedido) return m.reply(`❌ *Error*\n\n> _Pedido #${pedidoId} no encontrado._`)
      if (String(pedido?.estado || '').toLowerCase().trim() === 'completado') {
        return m.reply(`✅ *Pedido ya completado*\n\n> \`\`\`#${pedidoId}\`\`\` _${waSafeInline(pedido?.titulo || '')}_`)
      }
      if (!canUserManagePedido(pedido, { m, isBotOwner, isAdmin })) {
        return m.reply('❌ *No permitido*\n\n> _Solo el creador, admins o owner pueden usar esto._')
      }

      const pending = pedido?.bot?.pendingSelection || null
      if (!pending) return m.reply('🛡️ _No hay ninguna confirmación pendiente._')

      const createdAt = new Date(pending?.createdAt || 0).getTime()
      if (!createdAt || Number.isNaN(createdAt) || (Date.now() - createdAt) > 10 * 60 * 1000) {
        try {
          pedido.bot ||= {}
          pedido.bot.pendingSelection = null
          appendPedidoLog(pedido, { event: 'extra_expired' })
          panel.pedidos[pedidoId] = pedido
          if (global.db?.write) await global.db.write().catch(() => { })
        } catch { }
        return m.reply('🛡️ _Confirmación expirada. Abre el menú y selecciona de nuevo._')
      }

      if (decision === 'no' || decision === 'cancelar' || decision === 'volver') {
        pedido.bot ||= {}
        pedido.bot.pendingSelection = null
        appendPedidoLog(pedido, { event: 'extra_cancelled' })
        panel.pedidos[pedidoId] = pedido
        if (global.db?.write) await global.db.write().catch(() => { })

        const ok = await trySendFlowButtons(m, conn, {
          text: `✅ _Cancelado._\n\n> *Pedido:* ${waSafeInline(pedido?.titulo || '')}\n> _Elige un flujo:_`,
          footer: '🛡️ Oguri Bot',
          buttons: [
            ['📚 Biblioteca', `${usedPrefix}procesarpedido ${pedidoId}`],
            ['📌 Aportes', `${usedPrefix}buscaraporte ${pedidoId}`],
            ['📦 Proveedor', `${usedPrefix}elegirproveedorpedido ${pedidoId}`],
          ],
        })
        if (ok) return null
        return m.reply(`✅ _Cancelado._\n\n> \`\`\`${usedPrefix}procesarpedido ${pedidoId}\`\`\``)
      }

      if (decision !== 'si' && decision !== 'sí' && decision !== 'yes') {
        return m.reply(`⚠️ *Confirmación inválida*\n\n> \`\`\`${usedPrefix}confirmarpedido ${pedidoId} si|no\`\`\``)
      }

      appendPedidoLog(pedido, {
        event: 'extra_confirmed',
        source: pending?.source,
        itemId: pending?.itemId,
        contentType: pending?.contentType,
        contentSource: pending?.contentSource || null,
      })
      pedido.bot ||= {}
      pedido.bot.pendingSelection = null
      panel.pedidos[pedidoId] = pedido
      if (global.db?.write) await global.db.write().catch(() => { })

      const processed = await processPedidoSelection(panel, {
        pedidoId,
        source: pending?.source,
        itemId: pending?.itemId,
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

    case 'elegirproveedorpedido': {
      const pedidoId = parseInt(args[0])
      if (!pedidoId) return m.reply(`📦 *Elegir proveedor*\n\n> \`\`\`${usedPrefix}elegirproveedorpedido <idPedido>\`\`\``)

      const pedido = panel?.pedidos?.[pedidoId] || null
      if (!pedido) return m.reply(`❌ *Error*\n\n> _Pedido #${pedidoId} no encontrado._`)
      if (String(pedido?.estado || '').toLowerCase().trim() === 'completado') {
        return m.reply(`✅ *Pedido ya completado*\n\n> \`\`\`#${pedidoId}\`\`\` _${waSafeInline(pedido?.titulo || '')}_`)
      }

      const isPedidoCreator = String(pedido?.usuario || '') === String(m.sender || '')
      const sameChat = !pedido?.grupo_id || String(pedido.grupo_id) === String(m.chat || '')
      const canUse = isBotOwner || (m.isGroup && isAdmin) || (isPedidoCreator && sameChat)
      if (!canUse) return m.reply('❌ *No permitido*\n\n> _Solo admins/owner o el creador del pedido puede hacer esto._')

      const rows = buildProviderSelectRows(panel, usedPrefix, pedidoId)
      if (!rows.length) return m.reply('❌ *Error*\n\n> _No hay proveedores configurados._')

      const ok = await trySendInteractiveList(m, conn, {
        title: '📦 Proveedores',
        text: `*Pedido:* ${waSafeInline(pedido?.titulo || '')}\n> _Selecciona el proveedor._`,
        sections: [{ title: 'Proveedores', rows }],
      })
      if (ok) return null

      const lines = []
      lines.push('📦 *Proveedores*')
      lines.push(`> *Pedido:* ${waSafeInline(pedido?.titulo || '')}`)
      lines.push('')
      for (const r of rows) lines.push(`> ${waSafeInline(r.title)} — _${waSafeInline(r.description || '')}_`)
      lines.push('')
      lines.push(`> \`\`\`${usedPrefix}procesarpedido ${pedidoId} <idProveedor|jidProveedor>\`\`\``)
      return m.reply(lines.join('\n'))
    }

    case 'pedidotitulo': {
      const pedidoId = parseInt(args[0])
      const baseLibId = parseInt(args[1])
      if (!pedidoId || !baseLibId) {
        return m.reply(`📚 *Contenido por título*\n\n> \`\`\`${usedPrefix}pedidotitulo <idPedido> <idBiblioteca>\`\`\``)
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
      const allItems = getLibraryItemsByTitleKey(panel, { baseItem: base, restrictProviderJid })
      const buckets = buildContentBucketsForTitle(allItems, classifyLibraryItem)
      const mainItems = buckets.main.map((x) => x.it)
      const illustrationItems = buckets.illustration.map((x) => x.it)
      const hasExtras = buckets.extrasByType.size > 0
      const hasIllustrations = illustrationItems.length > 0

      try {
        pedido.proveedor_jid = restrictProviderJid || pedido.proveedor_jid || null
        pedido.fecha_actualizacion = new Date().toISOString()
        panel.pedidos[pedidoId] = pedido
        if (global.db?.write) await global.db.write().catch(() => { })
      } catch { }

      // Si no hay extras/ilustraciones, ir directo a capítulos principales.
      if (!hasExtras && !hasIllustrations) {
        if (!mainItems.length) {
          return m.reply('🛡️ _No encontré capítulos principales para este título._')
        }

        // Auto-envío permitido solo si es MAIN y hay 1 solo archivo.
        if (mainItems.length === 1) {
          appendPedidoLog(pedido, { event: 'auto_main', itemId: Number(mainItems[0]?.id || 0) })
          const processed = await processPedidoSelection(panel, {
            pedidoId,
            source: 'lib',
            itemId: Number(mainItems[0].id),
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

        const rows = buildSeasonsRowsForPedido(mainItems, usedPrefix, pedidoId, baseLibId)
        if (!rows.length) return m.reply('🛡️ _No encontré temporadas/capítulos para este título._')
        const ok = await trySendInteractiveList(m, conn, {
          title: '📚 Capítulos principales',
          text: `*Título:* ${waSafeInline(base?.title || base?.originalName || pedido?.titulo || '')}\n> _Selecciona una temporada para ver capítulos._`,
          sections: [{ title: 'Temporadas', rows }],
        })
        if (ok) return null
        return m.reply(`📚 *Capítulos principales*\n\n> \`\`\`${usedPrefix}pedidomain ${pedidoId} ${baseLibId}\`\`\``)
      }

      const summaryParts = []
      summaryParts.push(`> *Main:* _${mainItems.length}_`)
      if (hasExtras) {
        const extrasCount = [...buckets.extrasByType.values()].reduce((n, arr) => n + (arr?.length || 0), 0)
        summaryParts.push(`> *Extras:* _${extrasCount}_`)
      }
      if (hasIllustrations) summaryParts.push(`> *Ilustraciones:* _${illustrationItems.length}_`)

      appendPedidoLog(pedido, {
        event: 'bl_content_detected',
        mainCount: mainItems.length,
        extrasTypes: [...buckets.extrasByType.keys()],
        illustrationsCount: illustrationItems.length,
      })

      const menuText =
        `📌 *Contenido adicional detectado*\n\n` +
        `> *Título:* ${waSafeInline(base?.title || base?.originalName || pedido?.titulo || '')}\n` +
        `${summaryParts.join('\n')}\n\n` +
        `Elige qué deseas recibir:`

      const buttons = [
        ['📖 Capítulos principales', `${usedPrefix}pedidomain ${pedidoId} ${baseLibId}`],
      ]
      if (hasExtras) buttons.push(['✨ Extras / Side stories', `${usedPrefix}pedidoextrasmenu ${pedidoId} ${baseLibId}`])
      if (hasIllustrations) buttons.push(['🎨 Ilustraciones', `${usedPrefix}pedidoilustraciones ${pedidoId} ${baseLibId}`])

      const ok = await trySendFlowButtons(m, conn, {
        text: menuText,
        footer: '🛡️ Oguri Bot',
        buttons,
      })
      if (ok) return null

      return m.reply(`${menuText}\n\n> \`\`\`${usedPrefix}pedidomain ${pedidoId} ${baseLibId}\`\`\``)
    }

    case 'pedidomain': {
      const pedidoId = parseInt(args[0])
      const baseLibId = parseInt(args[1])
      if (!pedidoId || !baseLibId) return m.reply(`📖 *Capítulos principales*\n\n> \`\`\`${usedPrefix}pedidomain <idPedido> <idBiblioteca>\`\`\``)

      const pedido = panel?.pedidos?.[pedidoId] || null
      if (!pedido) return m.reply(`❌ *Error*\n\n> _Pedido #${pedidoId} no encontrado._`)
      if (String(pedido?.estado || '').toLowerCase().trim() === 'completado') {
        return m.reply(`✅ *Pedido ya completado*\n\n> \`\`\`#${pedidoId}\`\`\` _${waSafeInline(pedido?.titulo || '')}_`)
      }
      if (!canUserManagePedido(pedido, { m, isBotOwner, isAdmin })) return m.reply('❌ *No permitido*\n\n> _Solo el creador, admins o owner pueden usar esto._')

      const base = panel?.contentLibrary?.[baseLibId] || null
      if (!base) return m.reply(`❌ *Error*\n\n> _Archivo #${baseLibId} no encontrado en biblioteca._`)
      if (m.isGroup && !isBotOwner && String(base?.proveedorJid || '') !== String(m.chat || '')) {
        return m.reply('❌ *No permitido*\n\n> _Este archivo pertenece a otro proveedor._')
      }

      const restrictProviderJid = base?.proveedorJid ? String(base.proveedorJid) : (pedido?.proveedor_jid ? String(pedido.proveedor_jid) : null)
      const allItems = getLibraryItemsByTitleKey(panel, { baseItem: base, restrictProviderJid })
      const buckets = buildContentBucketsForTitle(allItems, classifyLibraryItem)
      const mainItems = buckets.main.map((x) => x.it)
      if (!mainItems.length) return m.reply('🛡️ _No encontré capítulos principales para este título._')

      const rows = buildSeasonsRowsForPedido(mainItems, usedPrefix, pedidoId, baseLibId)
      if (!rows.length) return m.reply('🛡️ _No encontré temporadas/capítulos para este título._')

      const ok = await trySendInteractiveList(m, conn, {
        title: '📖 Capítulos principales',
        text: `*Título:* ${waSafeInline(base?.title || base?.originalName || pedido?.titulo || '')}\n> _Selecciona una temporada para ver capítulos._`,
        sections: [{ title: 'Temporadas', rows }],
      })
      if (ok) return null

      const lines = []
      lines.push('📖 *Capítulos principales*')
      lines.push(`> *Título:* ${waSafeInline(base?.title || base?.originalName || pedido?.titulo || '')}`)
      lines.push('')
      for (const r of rows) lines.push(`> ${r.title} — _${r.description}_`)
      lines.push('')
      lines.push(`> \`\`\`${usedPrefix}pedidocapslib ${pedidoId} ${baseLibId} <temporada> <página>\`\`\``)
      return m.reply(lines.join('\n'))
    }

    case 'pedidoextrasmenu': {
      const pedidoId = parseInt(args[0])
      const baseLibId = parseInt(args[1])
      if (!pedidoId || !baseLibId) return m.reply(`✨ *Extras / Side stories*\n\n> \`\`\`${usedPrefix}pedidoextrasmenu <idPedido> <idBiblioteca>\`\`\``)

      const pedido = panel?.pedidos?.[pedidoId] || null
      if (!pedido) return m.reply(`❌ *Error*\n\n> _Pedido #${pedidoId} no encontrado._`)
      if (String(pedido?.estado || '').toLowerCase().trim() === 'completado') {
        return m.reply(`✅ *Pedido ya completado*\n\n> \`\`\`#${pedidoId}\`\`\` _${waSafeInline(pedido?.titulo || '')}_`)
      }
      if (!canUserManagePedido(pedido, { m, isBotOwner, isAdmin })) return m.reply('❌ *No permitido*\n\n> _Solo el creador, admins o owner pueden usar esto._')

      const base = panel?.contentLibrary?.[baseLibId] || null
      if (!base) return m.reply(`❌ *Error*\n\n> _Archivo #${baseLibId} no encontrado en biblioteca._`)
      if (m.isGroup && !isBotOwner && String(base?.proveedorJid || '') !== String(m.chat || '')) {
        return m.reply('❌ *No permitido*\n\n> _Este archivo pertenece a otro proveedor._')
      }

      const restrictProviderJid = base?.proveedorJid ? String(base.proveedorJid) : (pedido?.proveedor_jid ? String(pedido.proveedor_jid) : null)
      const allItems = getLibraryItemsByTitleKey(panel, { baseItem: base, restrictProviderJid })
      const buckets = buildContentBucketsForTitle(allItems, classifyLibraryItem)

      const rows = []
      for (const [type, arr] of buckets.extrasByType.entries()) {
        const label = CONTENT_TYPE_LABEL[type] || type
        const count = Array.isArray(arr) ? arr.length : 0
        if (!count) continue
        const hasFan = arr.some((x) => x?.cls?.contentSource === 'fan')
        const hasOfficial = arr.some((x) => x?.cls?.contentSource === 'official')
        const srcTxt = hasFan && hasOfficial ? 'mix' : hasFan ? 'fan' : hasOfficial ? 'official' : '-'
        rows.push({
          title: `✨ ${label}`,
          description: truncateText(`Items: ${count} · Fuente: ${srcTxt}`, 60),
          rowId: `${usedPrefix}pedidoextrastipo ${pedidoId} ${baseLibId} ${type}`,
        })
        if (rows.length >= 10) break
      }

      if (!rows.length) return m.reply('🛡️ _No encontré extras/side content para este título._')

      appendPedidoLog(pedido, { event: 'extras_menu_opened' })

      const ok = await trySendInteractiveList(m, conn, {
        title: '✨ Extras / Side stories',
        text: `*Título:* ${waSafeInline(base?.title || base?.originalName || '')}\n> _Selecciona un tipo (requiere confirmación)._`,
        sections: [{ title: 'Tipos', rows }],
      })
      if (ok) return null

      return m.reply(`✨ *Extras / Side stories*\n\n> \`\`\`${usedPrefix}pedidoextrastipo ${pedidoId} ${baseLibId} <tipo>\`\`\``)
    }

    case 'pedidoextrastipo': {
      const pedidoId = parseInt(args[0])
      const baseLibId = parseInt(args[1])
      const type = safeString(args[2] || '').trim()
      if (!pedidoId || !baseLibId || !type) return m.reply(`✨ *Extras por tipo*\n\n> \`\`\`${usedPrefix}pedidoextrastipo <idPedido> <idBiblioteca> <tipo>\`\`\``)

      const pedido = panel?.pedidos?.[pedidoId] || null
      if (!pedido) return m.reply(`❌ *Error*\n\n> _Pedido #${pedidoId} no encontrado._`)
      if (String(pedido?.estado || '').toLowerCase().trim() === 'completado') {
        return m.reply(`✅ *Pedido ya completado*\n\n> \`\`\`#${pedidoId}\`\`\` _${waSafeInline(pedido?.titulo || '')}_`)
      }
      if (!canUserManagePedido(pedido, { m, isBotOwner, isAdmin })) return m.reply('❌ *No permitido*\n\n> _Solo el creador, admins o owner pueden usar esto._')

      const base = panel?.contentLibrary?.[baseLibId] || null
      if (!base) return m.reply(`❌ *Error*\n\n> _Archivo #${baseLibId} no encontrado en biblioteca._`)
      if (m.isGroup && !isBotOwner && String(base?.proveedorJid || '') !== String(m.chat || '')) {
        return m.reply('❌ *No permitido*\n\n> _Este archivo pertenece a otro proveedor._')
      }

      const normalizedType = CONTENT_TYPES.includes(type) ? type : detectContentTypeFromText(type)
      const restrictProviderJid = base?.proveedorJid ? String(base.proveedorJid) : (pedido?.proveedor_jid ? String(pedido.proveedor_jid) : null)
      const allItems = getLibraryItemsByTitleKey(panel, { baseItem: base, restrictProviderJid })
      const buckets = buildContentBucketsForTitle(allItems, classifyLibraryItem)
      const list = buckets.extrasByType.get(normalizedType) || []
      if (!list.length) return m.reply('🛡️ _No encontré items para ese tipo._')

      appendPedidoLog(pedido, { event: 'extras_type_opened', type: normalizedType })

      const rows = list
        .slice()
        .sort((a, b) => Number(a?.it?.id || 0) - Number(b?.it?.id || 0))
        .slice(0, 10)
        .map(({ it, cls }) => {
          const id = Number(it?.id)
          const cap = normalizeChapter(it?.chapter)
          const title = cap ? `Capítulo ${String(cap).padStart(4, '0')}` : truncateText(it?.title || it?.originalName || `Archivo #${id}`, 44)
          const descParts = []
          if (it?.season != null && String(it.season).trim()) descParts.push(`Temp: ${waSafeInline(it.season)}`)
          if (cap) descParts.push(`Cap: ${cap}`)
          if (cls?.contentSource) descParts.push(`Fuente: ${waSafeInline(cls.contentSource)}`)
          if (it?.originalName) descParts.push(waSafeInline(it.originalName))
          return {
            title: truncateText(title, 44),
            description: truncateText(descParts.filter(Boolean).join(' · '), 60),
            rowId: `${usedPrefix}seleccionpedido ${pedidoId} lib ${id}`,
          }
        })

      const typeLabel = CONTENT_TYPE_LABEL[normalizedType] || normalizedType
      const ok = await trySendInteractiveList(m, conn, {
        title: `✨ ${typeLabel}`,
        text: `*Título:* ${waSafeInline(base?.title || base?.originalName || '')}\n> _Selecciona un item (requiere confirmación)._`,
        sections: [{ title: 'Items', rows }],
      })
      if (ok) return null

      return m.reply(`✨ *${waSafeInline(typeLabel)}*\n\n> \`\`\`${usedPrefix}seleccionpedido ${pedidoId} lib <idBiblioteca>\`\`\``)
    }

    case 'pedidoilustraciones': {
      const pedidoId = parseInt(args[0])
      const baseLibId = parseInt(args[1])
      if (!pedidoId || !baseLibId) return m.reply(`🎨 *Ilustraciones*\n\n> \`\`\`${usedPrefix}pedidoilustraciones <idPedido> <idBiblioteca>\`\`\``)

      const pedido = panel?.pedidos?.[pedidoId] || null
      if (!pedido) return m.reply(`❌ *Error*\n\n> _Pedido #${pedidoId} no encontrado._`)
      if (String(pedido?.estado || '').toLowerCase().trim() === 'completado') {
        return m.reply(`✅ *Pedido ya completado*\n\n> \`\`\`#${pedidoId}\`\`\` _${waSafeInline(pedido?.titulo || '')}_`)
      }
      if (!canUserManagePedido(pedido, { m, isBotOwner, isAdmin })) return m.reply('❌ *No permitido*\n\n> _Solo el creador, admins o owner pueden usar esto._')

      const base = panel?.contentLibrary?.[baseLibId] || null
      if (!base) return m.reply(`❌ *Error*\n\n> _Archivo #${baseLibId} no encontrado en biblioteca._`)
      if (m.isGroup && !isBotOwner && String(base?.proveedorJid || '') !== String(m.chat || '')) {
        return m.reply('❌ *No permitido*\n\n> _Este archivo pertenece a otro proveedor._')
      }

      const restrictProviderJid = base?.proveedorJid ? String(base.proveedorJid) : (pedido?.proveedor_jid ? String(pedido.proveedor_jid) : null)
      const allItems = getLibraryItemsByTitleKey(panel, { baseItem: base, restrictProviderJid })
      const buckets = buildContentBucketsForTitle(allItems, classifyLibraryItem)
      const list = buckets.illustration || []
      if (!list.length) return m.reply('🛡️ _No encontré ilustraciones para este título._')

      appendPedidoLog(pedido, { event: 'illustrations_opened' })

      const rows = list
        .slice()
        .sort((a, b) => Number(a?.it?.id || 0) - Number(b?.it?.id || 0))
        .slice(0, 10)
        .map(({ it, cls }) => {
          const id = Number(it?.id)
          const descParts = []
          if (cls?.contentSource) descParts.push(`Fuente: ${waSafeInline(cls.contentSource)}`)
          if (it?.originalName) descParts.push(waSafeInline(it.originalName))
          return {
            title: truncateText(it?.title || it?.originalName || `Archivo #${id}`, 44),
            description: truncateText(descParts.filter(Boolean).join(' · '), 60),
            rowId: `${usedPrefix}seleccionpedido ${pedidoId} lib ${id}`,
          }
        })

      const ok = await trySendInteractiveList(m, conn, {
        title: '🎨 Ilustraciones',
        text: `*Título:* ${waSafeInline(base?.title || base?.originalName || '')}\n> _Selecciona un item (requiere confirmación)._`,
        sections: [{ title: 'Items', rows }],
      })
      if (ok) return null

      return m.reply(`🎨 *Ilustraciones*\n\n> \`\`\`${usedPrefix}seleccionpedido ${pedidoId} lib <idBiblioteca>\`\`\``)
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
      const itemsAll = getLibraryItemsByTitleKey(panel, { baseItem: base, season, restrictProviderJid })
      const items = itemsAll.filter((it) => (classifyLibraryItem(it)?.contentType || 'main') === 'main')
      const { rows, total, page, perPage } = buildLibraryChaptersRows(items, usedPrefix, pedidoId, pageArg)
      if (!rows.length) {
        const seasonLabel = season === '0' ? 'Sin temporada' : `Temporada ${String(season).padStart(2, '0')}`
        return m.reply(`📖 *Capítulos*\n\n> *Título:* ${waSafeInline(base?.title || base?.originalName || '')}\n> *Temporada:* _${seasonLabel}_\n\n🛡️ _No encontré capítulos para mostrar._`)
      }

      const navRows = []
      const maxPage = total ? Math.max(1, Math.ceil(total / perPage)) : 1
      if (page > 1) navRows.push({ title: '⬅️ Anterior', description: `Página ${page - 1}/${maxPage}`, rowId: `${usedPrefix}pedidocapslib ${pedidoId} ${baseLibId} ${season} ${page - 1}` })
      if (page < maxPage) navRows.push({ title: '➡️ Siguiente', description: `Página ${page + 1}/${maxPage}`, rowId: `${usedPrefix}pedidocapslib ${pedidoId} ${baseLibId} ${season} ${page + 1}` })
      navRows.push({ title: '🔙 Temporadas', description: 'Volver a temporadas', rowId: `${usedPrefix}pedidomain ${pedidoId} ${baseLibId}` })

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

      const groups = {
        main: [],
        extras: [],
        illustration: [],
      }
      for (const m0 of matches || []) {
        const a = m0?.aporte || null
        if (!a) continue
        const cls = classifyAporteItem(a)
        const type = cls?.contentType || 'main'
        const entry = { ...m0, __cls: cls }
        if (type === 'main') groups.main.push(entry)
        else if (type === 'illustration') groups.illustration.push(entry)
        else groups.extras.push(entry)
      }

      const buildRows = (list, { prefixTitle = '' } = {}) => {
        const rows = []
        for (const m1 of list || []) {
          const a = m1?.aporte || {}
          const id = Number(a?.id)
          if (!Number.isFinite(id) || id <= 0) continue
          const cls = m1?.__cls || classifyAporteItem(a)
          const score = Math.max(0, Math.min(100, Math.round(Number(m1?.score) || 0)))
          const type = cls?.contentType || 'main'
          const label = CONTENT_TYPE_LABEL[type] || type
          const title = truncateText(a?.titulo || a?.archivoNombre || a?.contenido || `Aporte #${id}`, 44)
          const descParts = []
          descParts.push(`Tipo: ${waSafeInline(label)}`)
          if (cls?.contentSource) descParts.push(`Fuente: ${waSafeInline(cls.contentSource)}`)
          if (a?.temporada != null && String(a.temporada).trim()) descParts.push(`Temp: ${waSafeInline(a.temporada)}`)
          if (a?.capitulo != null && String(a.capitulo).trim()) descParts.push(`Cap: ${waSafeInline(a.capitulo)}`)
          descParts.push(`Score: ${score}`)
          rows.push({
            title: waSafeInline(`${prefixTitle}${title}`),
            description: truncateText(descParts.filter(Boolean).join(' · '), 60),
            rowId: `${usedPrefix}seleccionpedido ${pedidoId} aporte ${id}`,
          })
          if (rows.length >= 10) break
        }
        return rows
      }

      const sections = []
      const mainRows = buildRows(groups.main, { prefixTitle: '📖 ' })
      const extraRows = buildRows(groups.extras, { prefixTitle: '✨ ' })
      const illustRows = buildRows(groups.illustration, { prefixTitle: '🎨 ' })
      if (mainRows.length) sections.push({ title: '📖 Main', rows: mainRows })
      if (extraRows.length) sections.push({ title: '✨ Extras / Side', rows: extraRows })
      if (illustRows.length) sections.push({ title: '🎨 Ilustraciones', rows: illustRows })

      const ok = await trySendInteractiveList(m, conn, {
        title: '📌 Aportes sugeridos',
        text: `*Pedido:* ${waSafeInline(pedido?.titulo || '')}\n> _Selecciona un aporte para enviarlo._`,
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
          includePending: Boolean(isBotOwner),
          allowPendingUserJid: pedido?.usuario || null,
          allowPendingGroupJid: isBotOwner || (m.isGroup && isAdmin) ? (pedido?.grupo_id || null) : null,
        })

        const sections = []
        const titleRows = buildTitleSelectRowsForPedido(buckets, usedPrefix, id)
        if (titleRows.length) sections.push({ title: '📚 Títulos', rows: titleRows })

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

// Capturar clicks de botones/listas sin comandos visibles.
handler.before = async function (m, { conn, isAdmin, isOwner } = {}) {
  try {
    ensureStore()
    const panel = global.db.data.panel
    const isBotOwner = Boolean(isOwner) || global.owner.map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net').includes(m.sender)

    const rawText = safeString(m?.text || '').trim()
    const selectedId = extractInteractiveSelectionId(m)
    const candidateText = selectedId || rawText
    if (!candidateText) return

    if (process.env.DEBUG_PEDIDOS_FLOW === '1') {
      try {
        console.log('[PEDIDOS_FLOW]', {
          chat: m?.chat,
          sender: m?.sender,
          mtype: m?.mtype,
          fromMe: Boolean(m?.fromMe),
          rawText: rawText || null,
          selectedId: selectedId || null,
        })
      } catch { }
    }

    let flow = parseFlowId(candidateText)
    let pedido = flow ? (panel?.pedidos?.[flow.pedidoId] || null) : null

    // Fallback por texto (solo si el interactivo no se ve)
    if (!flow) {
      const norm = normalizeText(rawText)
      if (!norm) return
      const active = Object.values(panel?.pedidos || {})
        .filter((p) => p && sameUser(p?.usuario, m?.sender))
        .filter((p) => String(p?.estado || '').toLowerCase().trim() !== 'completado' && String(p?.estado || '').toLowerCase().trim() !== 'cancelado')
        .sort((a, b) => String(b?.fecha_creacion || '').localeCompare(String(a?.fecha_creacion || '')))
      pedido = active?.[0] || null
      if (!pedido) return
      const step = safeString(pedido?.flow?.step || '')
      if (step === FLOW_STEPS.RESUMEN) {
        if (norm === 'si' || norm === 'sí' || norm === 'continuar') flow = { pedidoId: pedido.id, action: 'AVAIL_YES', args: [] }
        else if (norm === 'detalles' || norm === 'detalle') flow = { pedidoId: pedido.id, action: 'AVAIL_DETAILS', args: [] }
        else if (norm === 'otro' || norm === 'buscar' || norm === 'buscar otro') flow = { pedidoId: pedido.id, action: 'AVAIL_OTHER', args: [] }
        else if (norm === 'cancelar' || norm === 'cancelado') flow = { pedidoId: pedido.id, action: 'AVAIL_CANCEL', args: [] }
      } else if (step === FLOW_STEPS.DETALLE || step === FLOW_STEPS.SELECT_TIPO) {
        if (norm.includes('principal') || norm.includes('capitulo')) flow = { pedidoId: pedido.id, action: 'TYPE_MAIN', args: [] }
        else if (norm.includes('extra')) flow = { pedidoId: pedido.id, action: 'TYPE_EXTRAS', args: [] }
        else if (norm.includes('ilustr')) flow = { pedidoId: pedido.id, action: 'TYPE_ILLUS', args: [] }
        else if (norm === 'volver' || norm === 'atras' || norm === 'atrás') flow = { pedidoId: pedido.id, action: 'BACK', args: ['AVAIL'] }
        else if (norm === 'cancelar') flow = { pedidoId: pedido.id, action: 'AVAIL_CANCEL', args: [] }
      } else if (step === FLOW_STEPS.CONFIRM_EXTRA) {
        if (norm === 'si' || norm === 'sí') flow = { pedidoId: pedido.id, action: 'CONFIRM_SEND', args: ['YES'] }
        else if (norm === 'no') flow = { pedidoId: pedido.id, action: 'CONFIRM_SEND', args: ['NO'] }
      }
    }

    if (!flow) return
    pedido = panel?.pedidos?.[flow.pedidoId] || pedido
    if (!pedido) return true

    if (!canUserManagePedido(pedido, { m, isBotOwner, isAdmin })) {
      await m.reply('❌ *No permitido*\n\n> _Solo el creador, admins o el owner pueden usar este menú._')
      return true
    }

    if (String(pedido?.estado || '').toLowerCase().trim() === 'completado') {
      await m.reply(`✅ *Pedido ya completado*\n\n> *ID:* \`\`\`#${pedido.id}\`\`\`\n> *Título:* ${waSafeInline(pedido?.titulo || '')}`)
      return true
    }

    if (isFlowExpired(pedido) && !['AVAIL_CANCEL'].includes(flow.action)) {
      await m.reply('⏳ *Menú vencido*\n\n> _Reconstruyendo el flujo..._')
      await renderAvailabilityMenu(m, conn, panel, pedido)
      return true
    }

    const merged = getMergedItemsForPedido(panel, pedido, { m, isBotOwner, isAdmin })
    const index = buildUnifiedIndex(merged)

    switch (safeString(flow.action)) {
      case 'AVAIL_DETAILS':
        await renderDetailsMenu(m, conn, panel, pedido)
        return true
      case 'AVAIL_OTHER':
        await renderCandidatesMenu(m, conn, panel, pedido)
        return true
      case 'TITLE_PICK': {
        const idx = clampInt(flow?.args?.[0], { min: 0, max: 50, fallback: 0 })
        const candidates = Array.isArray(pedido?.flow?.data?.candidates) ? pedido.flow.data.candidates : []
        const c = candidates[idx] || null
        if (c?.key) {
          pedido.titulo = safeString(c.title || pedido.titulo || '').trim() || pedido.titulo
          pedido.titulo_normalizado = safeString(c.key).trim()
          pedido.flow ||= {}
          pedido.flow.data ||= {}
          pedido.flow.data.selectedKey = pedido.titulo_normalizado
        }
        const merged2 = getMergedItemsForPedido(panel, pedido, { m, isBotOwner, isAdmin })
        const availability = buildAvailabilityFromItems({ library: merged2.library, aportes: merged2.aportes })
        pedido.disponibilidad_detectada = availability
        await savePedidoAndEmit(panel, pedido, 'title_picked')
        await renderAvailabilityMenu(m, conn, panel, pedido)
        return true
      }
      case 'AVAIL_CANCEL':
        pedido.estado = 'cancelado'
        setPedidoFlow(pedido, { step: FLOW_STEPS.CANCELADO, data: { ...(pedido.flow?.data || {}), cancelledAt: new Date().toISOString() } })
        await savePedidoAndEmit(panel, pedido, 'cancelled')
        await m.reply(`✅ *Pedido cancelado*\n\n> *ID:* \`\`\`#${pedido.id}\`\`\`\n> *Título:* ${waSafeInline(pedido?.titulo || '')}`)
        return true
      case 'BACK': {
        const target = safeString(flow?.args?.[0] || '').toUpperCase()
        if (target === 'AVAIL') return renderAvailabilityMenu(m, conn, panel, pedido)
        if (target === 'MAIN_SEASONS') return renderMainSeasonsMenu(m, conn, panel, pedido, index)
        if (target === 'EXTRA_TYPES') return renderExtraTypesMenu(m, conn, panel, pedido, index)
        return renderContentTypeMenu(m, conn, panel, pedido, index)
      }
      case 'AVAIL_YES':
        await renderContentTypeMenu(m, conn, panel, pedido, index)
        return true
      case 'TYPE_MAIN':
        await renderMainSeasonsMenu(m, conn, panel, pedido, index)
        return true
      case 'MAIN_SEASON': {
        const season = safeString(flow?.args?.[0] || '0') || '0'
        await renderMainChaptersPage(m, conn, panel, pedido, index, season, 1)
        return true
      }
      case 'MAIN_PAGE': {
        const season = safeString(flow?.args?.[0] || '0') || '0'
        const page = clampInt(flow?.args?.[1], { min: 1, max: 9999, fallback: 1 })
        await renderMainChaptersPage(m, conn, panel, pedido, index, season, page)
        return true
      }
      case 'MAIN_CH': {
        const season = safeString(flow?.args?.[0] || '0') || '0'
        const chapter = clampInt(flow?.args?.[1], { min: 1, max: 9999, fallback: 1 })
        await renderVariantsForChapter(m, conn, panel, pedido, index, season, chapter)
        return true
      }
      case 'SEND': {
        const src = safeString(flow?.args?.[0] || '').toLowerCase()
        const idNum = clampInt(flow?.args?.[1], { min: 1, max: 1_000_000_000, fallback: 0 })
        if (!idNum) {
          await m.reply('❌ *Error*\n\n> _Selección inválida._')
          return true
        }
        const contentType = (() => {
          if (src === 'lib') {
            const it = panel?.contentLibrary?.[idNum] || null
            return classifyLibraryItem(it)?.contentType || 'main'
          }
          const aportesAll = Array.isArray(global.db?.data?.aportes) ? global.db.data.aportes : []
          const a = aportesAll.find((x) => Number(x?.id) === idNum) || null
          return classifyAporteItem(a)?.contentType || 'main'
        })()
        await handleSendSelection(m, conn, panel, pedido, src, idNum, contentType, { isAdmin, isBotOwner })
        return true
      }
      case 'TYPE_EXTRAS':
        await renderExtraTypesMenu(m, conn, panel, pedido, index)
        return true
      case 'EXTRA_TYPE': {
        const type = safeString(flow?.args?.[0] || '').trim()
        await renderExtraItemsPage(m, conn, panel, pedido, index, type, 1)
        return true
      }
      case 'EXTRA_PAGE': {
        const type = safeString(flow?.args?.[0] || '').trim()
        const page = clampInt(flow?.args?.[1], { min: 1, max: 9999, fallback: 1 })
        await renderExtraItemsPage(m, conn, panel, pedido, index, type, page)
        return true
      }
      case 'EXTRA_ITEM': {
        const src = safeString(flow?.args?.[0] || '').toLowerCase()
        const idNum = clampInt(flow?.args?.[1], { min: 1, max: 1_000_000_000, fallback: 0 })
        if (!idNum) {
          await m.reply('❌ *Error*\n\n> _Selección inválida._')
          return true
        }
        const contentType = (() => {
          if (src === 'lib') {
            const it = panel?.contentLibrary?.[idNum] || null
            return classifyLibraryItem(it)?.contentType || 'extra'
          }
          const aportesAll = Array.isArray(global.db?.data?.aportes) ? global.db.data.aportes : []
          const a = aportesAll.find((x) => Number(x?.id) === idNum) || null
          return classifyAporteItem(a)?.contentType || 'extra'
        })()
        await handleSendSelection(m, conn, panel, pedido, src, idNum, contentType, { isAdmin, isBotOwner })
        return true
      }
      case 'TYPE_ILLUS':
        await renderIllustrationsMenu(m, conn, panel, pedido, index)
        return true
      case 'CONFIRM_SEND': {
        const ans = safeString(flow?.args?.[0] || '').toUpperCase()
        const pending = pedido?.flow?.data?.pending || null
        if (!pending) {
          await m.reply('⚠️ *Confirmación*\n\n> _No tengo una selección pendiente._')
          return renderContentTypeMenu(m, conn, panel, pedido, index)
        }
        if (ans === 'NO') {
          pedido.flow.data.pending = null
          await savePedidoAndEmit(panel, pedido, 'confirm_no')
          return renderContentTypeMenu(m, conn, panel, pedido, index)
        }
        if (ans === 'YES') {
          pedido.flow.data.pending = null
          await savePedidoAndEmit(panel, pedido, 'confirm_yes')
          await handleSendSelection(m, conn, panel, pedido, pending.source, pending.itemId, pending.contentType, { isAdmin, isBotOwner, confirmed: true })
          return true
        }
        await m.reply('⚠️ *Confirmación*\n\n> _Respuesta inválida._')
        return true
      }
      default:
        return true
    }
  } catch (err) {
    console.error('[pedidos-flow.before] error:', err)
    return
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
  'confirmarpedido',
  'elegirproveedorpedido',
  'pedidotitulo',
  'pedidomain',
  'pedidoextrasmenu',
  'pedidoextrastipo',
  'pedidoilustraciones',
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
// Permitir pedidos aunque el grupo esté en "modo admin".
handler.allowInAdminMode = true
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
  'confirmarpedido',
  'elegirproveedorpedido',
  'pedidotitulo',
  'pedidomain',
  'pedidoextrasmenu',
  'pedidoextrastipo',
  'pedidoilustraciones',
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
