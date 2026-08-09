import axios from 'axios'
import path from 'path'
import mime from 'mime-types'

function safeString(v) {
  if (v === null || typeof v === 'undefined') return ''
  if (typeof v === 'string') return v
  return String(v)
}

function clampInt(value, { min, max, fallback }) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(Math.max(Math.floor(n), min), max)
}

function sanitizeTitle(title) {
  const t = safeString(title).replace(/\s+/g, ' ').trim()
  return t.slice(0, 140)
}

function normalizeCategory(cat) {
  const c = safeString(cat).toLowerCase().trim()
  if (c === 'bl' || c === 'yaoi' || c === 'boys love' || c === 'boys-love' || c === 'shounen-ai') return 'bl'
  if (c === 'hetero' || c === 'straight') return 'hetero'
  return 'other'
}

function parseSeasonHeuristic(text) {
  const cleaned = safeString(text || '')
    .replace(/[_\.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return null

  const strong = [
    /\b(?:temporada|temp(?:orada)?)\s*0*(\d{1,2})\b/i,
    /\b(?:season)\s*0*(\d{1,2})\b/i,
  ]
  for (const rx of strong) {
    const m = rx.exec(cleaned)
    if (m) return String(Number(m[1]))
  }

  const hasContext = /\b(?:temporada|temp(?:orada)?|season)\b/i.test(cleaned)
  const hasChapterHint = /\b(?:cap(?:itulo)?|ch(?:apter)?|ep(?:isode)?|c)\b/i.test(cleaned)
  if (hasContext || hasChapterHint) {
    const weak = [
      /\bS\s*0*(\d{1,2})\b/i,
      /\bT\s*0*(\d{1,2})\b/i,
      /\bS0*(\d{1,2})\b/i,
      /\bT0*(\d{1,2})\b/i,
    ]
    for (const rx of weak) {
      const m = rx.exec(cleaned)
      if (m) return String(Number(m[1]))
    }
  }

  return null
}

function parseTitleAndChapterHeuristic(filename) {
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
  const season = parseSeasonHeuristic(cleaned)
  let title = cleaned
  for (const rx of patterns) {
    const m = rx.exec(cleaned)
    if (m) {
      chapter = m[1]
      title = cleaned.replace(m[0], ' ').replace(/\s+/g, ' ').trim()
      break
    }
  }

  if (season) {
    title = title
      .replace(/\b(?:temporada|temp(?:orada)?|season)\s*0*\d{1,2}\b/gi, ' ')
      .replace(/\b[ST]\s*0*\d{1,2}\b/g, ' ')
      .replace(/\b[ST]0*\d{1,2}\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  }

  return {
    title:
      (title || base || 'Sin título')
        .replace(/\b(bl|yaoi|boys[\s_-]?love|shounen[\s_-]?ai)\b/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim(),
    chapter: chapter ? String(Number(chapter)) : null,
    season: season ? String(Number(season)) : null,
  }
}

function detectRelationshipCategoryHeuristic(text) {
  const hay = safeString(text).toLowerCase()
  if (!hay) return 'other'
  if (/\b(bl|yaoi|boys[\s_-]?love|shounen[\s_-]?ai)\b/i.test(hay)) return 'bl'
  if (/\b(hetero|straight)\b/i.test(hay)) return 'hetero'
  return 'other'
}

function extractFirstJsonObject(text) {
  const s = safeString(text)
  const first = s.indexOf('{')
  if (first === -1) return null
  let depth = 0
  for (let i = first; i < s.length; i++) {
    const ch = s[i]
    if (ch === '{') depth += 1
    if (ch === '}') depth -= 1
    if (depth === 0) {
      const candidate = s.slice(first, i + 1)
      return candidate
    }
  }
  return null
}

function normalizeTags(tags) {
  if (!Array.isArray(tags)) return []
  const out = []
  for (const t of tags) {
    const v = safeString(t).trim().toLowerCase()
    if (!v) continue
    if (v.length > 24) continue
    out.push(v)
    if (out.length >= 10) break
  }
  return [...new Set(out)]
}

function defaultTags({ filename, provider }) {
  const ext = path.extname(safeString(filename)).replace('.', '').toLowerCase()
  const tags = []
  if (ext) tags.push(ext)
  const tipo = safeString(provider?.tipo || '').toLowerCase()
  if (tipo) tags.push(tipo)
  const mimeType = safeString(mime.lookup(filename) || '')
  if (mimeType.includes('pdf')) tags.push('pdf')
  if (mimeType.includes('epub')) tags.push('epub')
  return [...new Set(tags)].slice(0, 8)
}

function isAiEnabled() {
  const raw = safeString(process.env.PANEL_LIBRARY_AI_ENABLED || '1').toLowerCase()
  return !['0', 'false', 'no', 'off'].includes(raw)
}

function isAiPrimary() {
  const raw = safeString(process.env.PANEL_LIBRARY_AI_PRIMARY || '1').toLowerCase()
  return !['0', 'false', 'no', 'off'].includes(raw)
}

function getApis() {
  return global.APIs || {
    delirius: { url: 'https://api.delirius.store', key: null },
    zenzxz: { url: 'https://api.zenzxz.my.id', key: null },
    adonix: { url: 'https://api-adonix.ultraplus.click', key: 'Yuki-WaBot' },
  }
}

function modelToProvider(model) {
  const m = safeString(model).toLowerCase()
  const map = {
    'gpt-3.5-turbo': 'delirius',
    'gpt-4': 'delirius',
    'chatgpt': 'delirius',
    'gemini': 'zenzxz',
    'claude': 'zenzxz',
    'luminai': 'zenzxz',
    'qwen': 'zenzxz',
  }
  return map[m] || 'delirius'
}

async function callAiText(message, model) {
  const timeout = clampInt(process.env.PANEL_LIBRARY_AI_TIMEOUT_MS, { min: 2000, max: 60000, fallback: 12000 })
  const m = safeString(model).toLowerCase()

  const allowLegacy = !['0', 'false', 'no', 'off'].includes(safeString(process.env.PANEL_LIBRARY_AI_LEGACY_APIS || process.env.PANEL_AI_LEGACY_APIS || '1').toLowerCase().trim())
  if (!allowLegacy) throw new Error('AI deshabilitada (PANEL_LIBRARY_AI_LEGACY_APIS=0)')

  const APIs = getApis()
  const apiProvider = modelToProvider(model)
  const api = APIs?.[apiProvider]
  if (!api?.url) throw new Error(`AI provider ${apiProvider} no configurado`)

  if (apiProvider === 'delirius') {
    const basePrompt = 'Responde SOLO JSON. No uses markdown.'
    const url = `${api.url}/ia/gptprompt?text=${encodeURIComponent(message)}&prompt=${encodeURIComponent(basePrompt)}`
    const res = await axios.get(url, { timeout })
    const ok = Boolean(res.data?.status) && Boolean(res.data?.data)
    if (!ok) throw new Error('Respuesta inválida de Delirius')
    return { content: safeString(res.data.data), provider: apiProvider, model: m }
  }

  if (apiProvider === 'zenzxz') {
    const modelMap = {
      gemini: 'gemini',
      claude: 'grok-3-mini',
      luminai: 'qwen-qwq-32b',
      qwen: 'qwen-qwq-32b',
    }
    const endpoint = modelMap[m] || 'gemini'
    const url = `${api.url}/ai/${endpoint}?text=${encodeURIComponent(message)}`
    const res = await axios.get(url, { timeout })
    const output = res.data?.response || res.data?.assistant
    const ok = Boolean(res.data?.status) && Boolean(output)
    if (!ok) throw new Error(`Respuesta inválida de ZenzXZ (${m})`)
    return { content: safeString(output), provider: apiProvider, model: m }
  }

  if (apiProvider === 'adonix') {
    const url = `${api.url}/ai/chatgpt?apikey=${api.key}&q=${encodeURIComponent(message)}`
    const res = await axios.get(url, { timeout })
    const ok = Boolean(res.data?.result)
    if (!ok) throw new Error('Respuesta inválida de Adonix')
    return { content: safeString(res.data.result), provider: apiProvider, model: m }
  }

  throw new Error(`AI provider ${apiProvider} no soportado`)
}

function buildPrompt({ filename, caption, provider }) {
  const providerHint = {
    tipo: safeString(provider?.tipo || ''),
    generos_captura: Array.isArray(provider?.generos_captura) ? provider.generos_captura : [],
  }

  return [
    'Eres un clasificador de archivos de contenido (manhwa/manga/novela/media).',
    'Devuelve SOLO un JSON válido (sin markdown, sin texto extra).',
    'Campos requeridos:',
    '- title: título de la obra (sin "cap/chapter/vol", limpio)',
    '- chapter: número de capítulo como string (ej "10") o null',
    '- season: número de temporada como string (ej "2") o null',
    '- category: "bl" | "hetero" | "other"',
    '- tags: array de strings cortos (máx 10)',
    '- confidence: número 0..1',
    '',
    `filename: ${JSON.stringify(safeString(filename))}`,
    `caption: ${JSON.stringify(safeString(caption))}`,
    `provider_hint: ${JSON.stringify(providerHint)}`,
  ].join('\n')
}

function validateAiResult(raw) {
  if (!raw || typeof raw !== 'object') return null
  const title = sanitizeTitle(raw.title)
  const chapterRaw = raw.chapter
  const chapter =
    chapterRaw === null || typeof chapterRaw === 'undefined'
      ? null
      : String(chapterRaw).replace(/[^0-9]/g, '') || null
  const seasonRaw = raw.season
  const season =
    seasonRaw === null || typeof seasonRaw === 'undefined'
      ? null
      : String(seasonRaw).replace(/[^0-9]/g, '').slice(0, 2) || null
  const category = normalizeCategory(raw.category)
  const confidenceNum = Number(raw.confidence)
  const confidence = Number.isFinite(confidenceNum) ? Math.min(Math.max(confidenceNum, 0), 1) : 0
  const tags = normalizeTags(raw.tags)

  if (!title) return null
  return { title, chapter, season, category, tags, confidence }
}

export async function classifyProviderLibraryContent({ filename, caption = '', provider = null } = {}) {
  const file = safeString(filename)
  const cap = safeString(caption)

  const heuristicParsed = parseTitleAndChapterHeuristic(file)
  const heuristicSeason = heuristicParsed.season || parseSeasonHeuristic(`${file} ${cap}`)
  const heuristicCategory = detectRelationshipCategoryHeuristic(`${file} ${cap}`)
  const heuristic = {
    title: sanitizeTitle(heuristicParsed.title),
    chapter: heuristicParsed.chapter,
    season: heuristicSeason,
    category: heuristicCategory,
    tags: defaultTags({ filename: file, provider }),
    confidence: 0.35,
    source: 'heuristic',
    model: 'none',
    provider: 'local',
  }

  if (!isAiEnabled()) return heuristic

  const aiPrimary = isAiPrimary()
  const cacheKey = `${safeString(provider?.jid || '')}|${file}|${cap}`
  global.__providerLibraryAiCache ||= new Map()
  const cache = global.__providerLibraryAiCache
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const minConfidence = Number(process.env.PANEL_LIBRARY_AI_MIN_CONFIDENCE || 0.45)
  const model = safeString(process.env.PANEL_LIBRARY_AI_MODEL || 'gemini') || 'gemini'
  const prompt = buildPrompt({ filename: file, caption: cap, provider })

  try {
    const ai = await callAiText(prompt, model)
    const jsonText = extractFirstJsonObject(ai.content)
    const parsed = jsonText ? JSON.parse(jsonText) : null
    const validated = validateAiResult(parsed)
    if (!validated || (!aiPrimary && validated.confidence < minConfidence)) {
      cache.set(cacheKey, { expiresAt: Date.now() + 15 * 60 * 1000, value: heuristic })
      return heuristic
    }

    const mergedTags = normalizeTags([...(validated.tags || []), ...defaultTags({ filename: file, provider })])

    const result = {
      ...validated,
      tags: mergedTags,
      source: 'ai',
      model: ai.model,
      provider: ai.provider,
    }

    cache.set(cacheKey, { expiresAt: Date.now() + 60 * 60 * 1000, value: result })
    return result
  } catch {
    cache.set(cacheKey, { expiresAt: Date.now() + 10 * 60 * 1000, value: heuristic })
    return heuristic
  }
}
