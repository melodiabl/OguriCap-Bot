/**
 * api/routes/config.js — /api/config/*
 * Lee/escribe configuración del bot desde global.* y panelDb.systemConfig
 */
import { json, readJson, getJwtAuth, safeString } from '../middleware/core.js'

function isAdmin(user) {
  return ['owner', 'admin', 'administrador'].includes(safeString(user?.rol || '').toLowerCase())
}

/** Construye el objeto config completo desde globals + panelDb */
function buildConfig(panelDb) {
  const sys = panelDb?.systemConfig || {}
  return {
    main: {
      name: global.botname || 'OguriCap-Bot',
      version: global.vs || '1.0.0',
      environment: process.env.NODE_ENV || 'production',
      maxMemory: process.env.MAX_MEMORY || '512MB',
      globalOffMessage: panelDb?.botGlobalOffMessage || '',
      group: global.group || '',
      channel: global.channel || '',
      github: global.github || '',
      gmail: global.gmail || '',
      banner: global.banner || '',
      currency: global.currency || '¥enes',
    },
    bot: {
      name: global.botname || 'OguriCap-Bot',
      prefix: global.prefix || '#',
      owner: Array.isArray(global.owner) ? global.owner : [],
      maxRequestsPerMinute: 120,
      autoRead: false,
      autoTyping: false,
      ...(panelDb?.botConfig || {}),
    },
    system: {
      maintenanceMode: sys.maintenanceMode || false,
      maintenanceMessage: sys.maintenanceMessage || '',
      adminIPs: sys.adminIPs || [],
      autoAddAdminIPOnLogin: sys.autoAddAdminIPOnLogin || false,
      registrationEnabled: sys.registrationEnabled !== false,
      maxSubbotsPerUser: sys.maxSubbotsPerUser || 3,
    },
    security: {
      jwtExpiry: process.env.JWT_EXPIRY || '24h',
      turnstileEnabled: process.env.TURNSTILE_DISABLED !== '1',
      bcryptRounds: 10,
    },
    notifications: {
      email: {
        enabled: Boolean(process.env.SMTP_HOST),
        smtp: {
          host: process.env.SMTP_HOST || '',
          port: Number(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_SECURE === 'true',
          user: process.env.SMTP_USER || '',
        },
      },
    },
  }
}

export async function handleConfig({ req, res, url, panelDb }) {
  const pathname = url.pathname
  const method = req.method.toUpperCase()

  // ── GET /api/config ───────────────────────────────────────────────────────
  if (pathname === '/api/config' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const config = buildConfig(panelDb)
    const versions = panelDb?.configVersions || []
    return json(res, 200, {
      config,
      stats: {
        totalKeys: Object.keys(config).reduce((n, k) => n + Object.keys(config[k]).length, 0),
        lastUpdated: panelDb?.systemConfig?.updated_at || null,
      },
      versions,
    })
  }

  // ── GET /api/config/stats ─────────────────────────────────────────────────
  if (pathname === '/api/config/stats' && method === 'GET') {
    const config = buildConfig(panelDb)
    return json(res, 200, { total: Object.keys(config).reduce((n, k) => n + Object.keys(config[k]).length, 0) })
  }

  // ── PUT /api/config/main ──────────────────────────────────────────────────
  if (pathname === '/api/config/main' && method === 'PUT') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const body = await readJson(req)
    if (body.name)             global.botname = safeString(body.name)
    if (body.currency)         global.currency = safeString(body.currency)
    if (body.banner)           global.banner = safeString(body.banner)
    if (body.group)            global.group = safeString(body.group)
    if (body.channel)          global.channel = safeString(body.channel)
    if ('globalOffMessage' in body) panelDb.botGlobalOffMessage = safeString(body.globalOffMessage)
    saveVersion(panelDb, 'main', body)
    if (global.db?.write) await global.db.write()
    return json(res, 200, { success: true, config: buildConfig(panelDb).main })
  }

  // ── PUT /api/config/bot ───────────────────────────────────────────────────
  if (pathname === '/api/config/bot' && method === 'PUT') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const body = await readJson(req)
    if (body.name)   global.botname = safeString(body.name)
    if (body.prefix) global.prefix  = safeString(body.prefix)
    if (Array.isArray(body.owner)) global.owner = body.owner.map(safeString).filter(Boolean)
    panelDb.botConfig = { ...(panelDb.botConfig || {}), ...body }
    saveVersion(panelDb, 'bot', body)
    if (global.db?.write) await global.db.write()
    return json(res, 200, { success: true, config: buildConfig(panelDb).bot })
  }

  // ── PUT /api/config/system ────────────────────────────────────────────────
  if (pathname === '/api/config/system' && method === 'PUT') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const body = await readJson(req)
    panelDb.systemConfig ||= {}
    const allowed = ['maintenanceMode','maintenanceMessage','adminIPs','autoAddAdminIPOnLogin','registrationEnabled','maxSubbotsPerUser']
    for (const k of allowed) { if (k in body) panelDb.systemConfig[k] = body[k] }
    panelDb.systemConfig.updated_at = new Date().toISOString()
    saveVersion(panelDb, 'system', body)
    if (global.db?.write) await global.db.write()
    return json(res, 200, { success: true, config: buildConfig(panelDb).system })
  }

  // ── POST /api/config/system/maintenance ───────────────────────────────────
  if (pathname === '/api/config/system/maintenance' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const body = await readJson(req)
    panelDb.systemConfig ||= {}
    panelDb.systemConfig.maintenanceMode = Boolean(body.enabled)
    panelDb.systemConfig.updated_at = new Date().toISOString()
    if (global.db?.write) await global.db.write()
    try {
      const { emitNotification } = await import('../../lib/socket-io.js')
      emitNotification({ type: body.enabled ? 'warning' : 'success', title: body.enabled ? 'Modo mantenimiento activado' : 'Modo mantenimiento desactivado', categoria: 'sistema' })
    } catch {}
    return json(res, 200, { success: true, maintenanceMode: panelDb.systemConfig.maintenanceMode })
  }

  // ── POST /api/config/system/admin-ip ─────────────────────────────────────
  if (pathname === '/api/config/system/admin-ip' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const body = await readJson(req)
    const ip = safeString(body?.ip || '').trim()
    if (!ip) return json(res, 400, { error: 'IP requerida' })
    panelDb.systemConfig ||= {}
    panelDb.systemConfig.adminIPs ||= []
    if (!panelDb.systemConfig.adminIPs.includes(ip)) panelDb.systemConfig.adminIPs.push(ip)
    if (global.db?.write) await global.db.write()
    return json(res, 200, { success: true, adminIPs: panelDb.systemConfig.adminIPs })
  }

  // ── GET /api/config/export ────────────────────────────────────────────────
  if (pathname === '/api/config/export' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const config = buildConfig(panelDb)
    res.statusCode = 200
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Content-Disposition', `attachment; filename="config-${Date.now()}.json"`)
    res.end(JSON.stringify(config, null, 2))
    return
  }

  // ── POST /api/config/import ───────────────────────────────────────────────
  if (pathname === '/api/config/import' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const body = await readJson(req)
    if (body.bot?.name)   global.botname = safeString(body.bot.name)
    if (body.bot?.prefix) global.prefix  = safeString(body.bot.prefix)
    if (body.system)      Object.assign(panelDb.systemConfig ||= {}, body.system)
    if (body.main?.globalOffMessage) panelDb.botGlobalOffMessage = safeString(body.main.globalOffMessage)
    if (global.db?.write) await global.db.write()
    return json(res, 200, { success: true })
  }

  // ── POST /api/config/rollback/:versionId ──────────────────────────────────
  if (pathname.startsWith('/api/config/rollback/') && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const versionId = pathname.split('/').pop()
    const versions = panelDb?.configVersions || []
    const version = versions.find(v => String(v.id) === String(versionId))
    if (!version) return json(res, 404, { error: 'Versión no encontrada' })
    // Aplicar snapshot guardado
    if (version.data?.bot?.name)   global.botname = safeString(version.data.bot.name)
    if (version.data?.bot?.prefix) global.prefix  = safeString(version.data.bot.prefix)
    if (version.data?.system)      Object.assign(panelDb.systemConfig ||= {}, version.data.system)
    if (global.db?.write) await global.db.write()
    return json(res, 200, { success: true, message: `Rollback a versión ${versionId} aplicado` })
  }

  // ── GET /api/config/email/status ──────────────────────────────────────────
  if (pathname === '/api/config/email/status' && method === 'GET') {
    try {
      const { getEmailServiceStatus } = await import('../../lib/email-service.js')
      return json(res, 200, getEmailServiceStatus?.() || { configured: false })
    } catch { return json(res, 200, { configured: false }) }
  }

  // ── GET /api/config/email/preview/:type ───────────────────────────────────
  if (pathname.startsWith('/api/config/email/preview/') && method === 'GET') {
    try {
      const type = pathname.split('/').pop()
      const { getEmailTemplatePreview } = await import('../../lib/email-service.js')
      return json(res, 200, { html: getEmailTemplatePreview?.(type) || '' })
    } catch { return json(res, 200, { html: '' }) }
  }

  // ── POST /api/config/email/verify ─────────────────────────────────────────
  if (pathname === '/api/config/email/verify' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    try {
      const { verifySmtp } = await import('../../lib/email-service.js')
      const result = await verifySmtp?.()
      return json(res, 200, { success: true, result })
    } catch (err) { return json(res, 500, { error: err?.message || 'Error verificando SMTP' }) }
  }

  // ── POST /api/config/email/test ───────────────────────────────────────────
  if (pathname === '/api/config/email/test' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    try {
      const { sendTestEmail } = await import('../../lib/email-service.js')
      await sendTestEmail?.({ to: body?.to || auth.user.email })
      return json(res, 200, { success: true })
    } catch (err) { return json(res, 500, { error: err?.message || 'Error enviando email de prueba' }) }
  }

  return null // no manejado — continúa al siguiente router
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function saveVersion(panelDb, section, data) {
  try {
    panelDb.configVersions ||= []
    panelDb.configVersions.unshift({
      id: Date.now(),
      section,
      data: { [section]: data },
      timestamp: new Date().toISOString(),
    })
    if (panelDb.configVersions.length > 20) panelDb.configVersions = panelDb.configVersions.slice(0, 20)
  } catch {}
}
