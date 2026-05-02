/**
 * api/middleware/rate-limit.js
 * Rate limiting por IP — ventana deslizante en memoria
 */

const store = new Map() // key → { count, resetAt }

/**
 * Crea un limiter. Devuelve función (req, res) → boolean (true=permitido)
 */
export function rateLimit({ windowMs = 60_000, max = 60, keyFn } = {}) {
  setInterval(() => {
    const now = Date.now()
    for (const [k, v] of store) if (v.resetAt < now) store.delete(k)
  }, windowMs * 2).unref?.()

  return function check(req, res) {
    const k = keyFn ? keyFn(req) : defaultKey(req)
    const now = Date.now()
    let e = store.get(k)
    if (!e || e.resetAt < now) { e = { count: 0, resetAt: now + windowMs }; store.set(k, e) }
    e.count++
    res.setHeader('X-RateLimit-Limit', max)
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - e.count))
    res.setHeader('X-RateLimit-Reset', Math.ceil(e.resetAt / 1000))
    if (e.count > max) {
      res.setHeader('Retry-After', Math.ceil((e.resetAt - now) / 1000))
      return false
    }
    return true
  }
}

function defaultKey(req) {
  return (
    req.headers['cf-connecting-ip'] ||
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  )
}

// Limiters preconfigurados
export const authLimiter  = rateLimit({ windowMs: 15 * 60_000, max: 20  })  // 20/15min — login
export const apiLimiter   = rateLimit({ windowMs: 60_000,       max: 120 })  // 120/min  — general
export const heavyLimiter = rateLimit({ windowMs: 60_000,       max: 10  })  // 10/min   — broadcast, backups
