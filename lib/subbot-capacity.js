import os from 'os'

function clampInt(n, { min, max, fallback }) {
  const v = Number.parseInt(String(n), 10)
  if (!Number.isFinite(v)) return fallback
  return Math.min(max, Math.max(min, v))
}

function toMB(bytes) {
  return Math.round((Number(bytes) || 0) / 1024 / 1024)
}

export function getSubbotCapacityInfo(custom = {}) {
  const conns = Array.isArray(global.conns) ? global.conns : []
  const connectedSubs = conns.filter((s) => Boolean(s?.user)).length
  const botsNow = 1 + connectedSubs

  const mem = process.memoryUsage()
  const rssMB = toMB(mem?.rss || 0)
  const totalMB = toMB(os.totalmem())

  // Defaults (configurable)
  const hardMax = clampInt(custom.hardMax ?? process.env.SUBBOT_HARD_MAX ?? 50, { min: 1, max: 500, fallback: 50 })

  const reserveMB = (() => {
    const v = custom.reserveMB ?? custom.reserveMb ?? process.env.SUBBOT_RESERVE_MB
    const fromCfg = clampInt(v, { min: 256, max: Math.max(256, totalMB - 256), fallback: 0 })
    if (fromCfg) return fromCfg
    // Reservar 20% o 1024MB (lo que sea mayor)
    return Math.min(Math.max(1024, Math.round(totalMB * 0.2)), Math.max(256, totalMB - 256))
  })()

  const perBotMB = (() => {
    const v = custom.perBotMB ?? custom.perBotMb ?? process.env.SUBBOT_PERBOT_MB
    const fromCfg = clampInt(v, { min: 50, max: 512, fallback: 0 })
    if (fromCfg) return fromCfg
    // Estimar con RSS actual dividido entre bots conectados (main + subbots)
    const est = botsNow > 0 ? Math.round(Math.max(1, rssMB) / botsNow) : 140
    return Math.min(300, Math.max(90, est))
  })()

  const maxByMemory = Math.max(1, Math.floor((totalMB - reserveMB) / Math.max(1, perBotMB)))
  const recommendedMax = Math.min(hardMax, maxByMemory)

  const autoLimit = custom.autoLimit ?? custom.auto ?? (process.env.SUBBOT_AUTO_LIMIT === '1')
  const manualMaxRaw = custom.maxSubbots ?? custom.maxSubs ?? null
  const manualMax = manualMaxRaw == null ? null : clampInt(manualMaxRaw, { min: 1, max: hardMax, fallback: null })

  const effectiveMax = autoLimit
    ? recommendedMax
    : (manualMax != null ? manualMax : hardMax)

  const remaining = Math.max(0, effectiveMax - connectedSubs)

  return {
    connectedSubs,
    botsNow,
    totalMB,
    rssMB,
    reserveMB,
    perBotMB,
    maxByMemory,
    hardMax,
    recommendedMax,
    autoLimit: Boolean(autoLimit),
    manualMax,
    effectiveMax,
    remaining,
  }
}
