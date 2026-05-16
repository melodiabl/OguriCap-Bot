import { getActiveProvider } from './providers/index.js'

let cache = { key: '', promise: null }

export function resetTransporterCache() {
  const previous = cache.promise
  cache = { key: '', promise: null }
  if (previous) {
    previous.then(t => t?.close?.()).catch(() => {})
  }
}

export async function getTransporter({ forceRefresh = false } = {}) {
  const provider = getActiveProvider()
  if (!provider) {
    resetTransporterCache()
    return null
  }

  const cacheKey = JSON.stringify(provider.config)

  if (forceRefresh || cache.key !== cacheKey || !cache.promise) {
    resetTransporterCache()
    cache = {
      key: cacheKey,
      promise: provider.createTransporter().catch(err => {
        console.error('❌ Error al cargar nodemailer:', err.message)
        cache = { key: '', promise: null }
        return null
      }),
    }
  }

  return cache.promise
}
