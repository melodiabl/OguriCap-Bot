// Resolver de versión de WhatsApp Web.
// El fork de Baileys instalado (GataNina-Li) tiene fetchLatestBaileysVersion roto:
// apunta a unpkg.com/wileys@0.0.1 (404) y siempre cae a una versión embebida vieja,
// lo que provoca rechazos 405 de WhatsApp en bot principal y subbots.
// Este helper consulta fuentes oficiales con caché en disco y fallback pineado.

import fs from 'fs'
import path from 'path'
import axios from 'axios'

// Última versión conocida buena (actualizar si WhatsApp vuelve a rechazar con 405).
const PINNED_VERSION = [2, 3000, 1043857760]

const SOURCES = [
  'https://raw.githubusercontent.com/WhiskeySockets/Baileys/master/src/Defaults/baileys-version.json',
  'https://cdn.jsdelivr.net/gh/WhiskeySockets/Baileys@master/src/Defaults/baileys-version.json',
]

const CACHE_FILE = path.join(process.cwd(), 'tmp', 'wa-version-cache.json')
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 horas

let memoryCache = null // { version, fetchedAt }

const isValidVersion = (v) => Array.isArray(v) && v.length >= 3 && v.every((n) => Number.isInteger(n) && n >= 0)

const compareVersions = (a, b) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] || 0) - (b[i] || 0)
    if (diff !== 0) return diff
  }
  return 0
}

const readDiskCache = () => {
  try {
    const raw = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))
    if (isValidVersion(raw?.version) && typeof raw?.fetchedAt === 'number') return raw
  } catch {}
  return null
}

const writeDiskCache = (entry) => {
  try {
    fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true })
    fs.writeFileSync(CACHE_FILE, JSON.stringify(entry))
  } catch {}
}

async function fetchRemoteVersion() {
  for (const url of SOURCES) {
    try {
      const { data } = await axios.get(url, { timeout: 10000, responseType: 'json' })
      const version = data?.version
      if (isValidVersion(version)) return version
    } catch {}
  }
  return null
}

/**
 * Devuelve la versión de WhatsApp Web a usar en makeWASocket.
 * Nunca lanza; siempre devuelve una versión válida (remota > caché > pineada).
 * @param {{ forceRefresh?: boolean }} [opts]
 * @returns {Promise<number[]>}
 */
export async function getWAVersion(opts = {}) {
  const now = Date.now()

  if (!opts.forceRefresh && memoryCache && now - memoryCache.fetchedAt < CACHE_TTL_MS) {
    return memoryCache.version
  }

  if (!opts.forceRefresh) {
    const disk = readDiskCache()
    if (disk && now - disk.fetchedAt < CACHE_TTL_MS) {
      memoryCache = disk
      return disk.version
    }
  }

  const remote = await fetchRemoteVersion()
  if (remote) {
    // Quedarse con la más nueva entre remota y pineada por si la fuente queda desactualizada.
    const version = compareVersions(remote, PINNED_VERSION) >= 0 ? remote : PINNED_VERSION
    memoryCache = { version, fetchedAt: now }
    writeDiskCache(memoryCache)
    return version
  }

  // Sin red: usar caché en disco aunque esté vencida, si es más nueva que la pineada.
  const disk = readDiskCache()
  if (disk && compareVersions(disk.version, PINNED_VERSION) >= 0) {
    memoryCache = { version: disk.version, fetchedAt: now }
    return disk.version
  }

  memoryCache = { version: PINNED_VERSION, fetchedAt: now }
  return PINNED_VERSION
}

export default getWAVersion
