import axios from 'axios'

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_RETRIES = 2
const CIRCUIT_FAILURE_LIMIT = 4
const CIRCUIT_COOLDOWN_MS = 30_000

const circuit = { failures: 0, openUntil: 0 }

function config() {
  const configured = global.APIs?.MelodyApi || global.APIs?.MelodiaApi || global.APIs?.melodia || {}
  const baseUrl = String(process.env.MELODIA_API_URL || configured.url || '').trim().replace(/\/+$/, '')
  const apiKey = String(process.env.MELODIA_API_KEY || configured.key || '').trim()
  return { baseUrl, apiKey }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function retryable(error) {
  const status = Number(error?.response?.status || 0)
  return !status || status === 408 || status === 429 || status >= 500
}

function normalizedError(error, path) {
  const status = Number(error?.response?.status || 0) || null
  const message = error?.response?.data?.error || error?.message || 'MelodiaAPI no disponible'
  const wrapped = new Error(String(message))
  wrapped.name = 'MelodiaApiError'
  wrapped.code = error?.code || (status ? `HTTP_${status}` : 'MELODIA_UNAVAILABLE')
  wrapped.status = status
  wrapped.path = path
  wrapped.retryable = retryable(error)
  wrapped.cause = error
  return wrapped
}

export async function melodiaRequest(path, options = {}) {
  const { baseUrl, apiKey } = config()
  if (!baseUrl) throw normalizedError(new Error('MELODIA_API_URL no configurada'), path)
  if (Date.now() < circuit.openUntil) {
    const error = new Error('MelodiaAPI temporalmente aislada; usando respaldo')
    error.name = 'MelodiaApiError'
    error.code = 'CIRCUIT_OPEN'
    error.retryable = true
    throw error
  }

  const retries = Number.isInteger(options.retries) ? Math.max(0, options.retries) : DEFAULT_RETRIES
  let lastError
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await axios({
        method: options.method || 'GET',
        url: `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`,
        params: options.params,
        data: options.data,
        responseType: options.responseType,
        headers: { ...(apiKey ? { 'x-api-key': apiKey } : {}), ...options.headers },
        timeout: options.timeout || DEFAULT_TIMEOUT_MS,
        maxContentLength: options.maxContentLength || 10 * 1024 * 1024,
        validateStatus: status => status >= 200 && status < 300
      })
      circuit.failures = 0
      circuit.openUntil = 0
      if (response.data?.status === false) throw normalizedError({ response }, path)
      return response.data
    } catch (error) {
      lastError = error?.name === 'MelodiaApiError' ? error : normalizedError(error, path)
      if (!lastError.retryable || attempt >= retries) break
      await delay(Math.min(1500, 200 * (2 ** attempt) + Math.floor(Math.random() * 100)))
    }
  }

  circuit.failures += 1
  if (circuit.failures >= CIRCUIT_FAILURE_LIMIT) circuit.openUntil = Date.now() + CIRCUIT_COOLDOWN_MS
  throw lastError
}

export async function melodiaResult(path, params, options) {
  const payload = await melodiaRequest(path, { ...options, params })
  if (!payload || payload.status !== true || payload.result == null) {
    throw normalizedError(new Error('Respuesta inválida de MelodiaAPI'), path)
  }
  return payload.result
}

export async function melodiaBinary(path, params, options = {}) {
  const payload = await melodiaRequest(path, {
    ...options,
    params,
    responseType: 'arraybuffer',
    maxContentLength: options.maxContentLength || 20 * 1024 * 1024
  })
  return Buffer.isBuffer(payload) ? payload : Buffer.from(payload)
}

export async function withFallback(primary, fallback) {
  try {
    return await primary()
  } catch (primaryError) {
    try {
      return await fallback(primaryError)
    } catch (fallbackError) {
      fallbackError.primaryError = primaryError
      throw fallbackError
    }
  }
}

export function resetMelodiaCircuitForTests() {
  circuit.failures = 0
  circuit.openUntil = 0
}
