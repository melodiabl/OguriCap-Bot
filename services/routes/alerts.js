/**
 * routes/alerts.js — /api/alerts
 */
import { json } from '../middleware/core.js'

export async function handleAlerts({ req, res, url, alertSystem }) {
  const method  = req.method.toUpperCase()
  const { pathname } = url

  // GET /api/alerts — lista todas las alertas
  if (method === 'GET' && pathname === '/api/alerts') {
    try {
      const alerts = alertSystem.getAllAlerts?.() ?? []
      return json(res, 200, { alerts, total: alerts.length })
    } catch (err) {
      return json(res, 500, { error: 'Error obteniendo alertas' })
    }
  }

  // GET /api/alerts/rules — lista todas las reglas
  if (method === 'GET' && pathname === '/api/alerts/rules') {
    try {
      const rules = alertSystem.getRules?.() ?? []
      return json(res, 200, { rules, total: rules.length })
    } catch (err) {
      return json(res, 500, { error: 'Error obteniendo reglas' })
    }
  }

  // POST /api/alerts/rules — crear nueva regla
  if (method === 'POST' && pathname === '/api/alerts/rules') {
    try {
      const body = await readBody(req)
      const rule = alertSystem.createRule?.(body)
      return json(res, 201, { rule })
    } catch (err) {
      return json(res, 400, { error: 'Error creando regla' })
    }
  }

  // POST /api/alerts/:id/acknowledge
  const ackMatch = pathname.match(/^\/api\/alerts\/([^/]+)\/acknowledge$/)
  if (method === 'POST' && ackMatch) {
    try {
      const alertId = decodeURIComponent(ackMatch[1])
      await alertSystem.acknowledgeAlert?.(alertId, 'panel')
      return json(res, 200, { ok: true })
    } catch (err) {
      return json(res, 404, { error: 'Alerta no encontrada' })
    }
  }

  // POST /api/alerts/:id/resolve
  const resolveMatch = pathname.match(/^\/api\/alerts\/([^/]+)\/resolve$/)
  if (method === 'POST' && resolveMatch) {
    try {
      const alertId = decodeURIComponent(resolveMatch[1])
      await alertSystem.resolveAlert?.(alertId)
      return json(res, 200, { ok: true })
    } catch (err) {
      return json(res, 404, { error: 'Alerta no encontrada' })
    }
  }

  // PATCH /api/alerts/rules/:id — actualizar regla
  const ruleUpdateMatch = pathname.match(/^\/api\/alerts\/rules\/([^/]+)$/)
  if (method === 'PATCH' && ruleUpdateMatch) {
    try {
      const ruleId = decodeURIComponent(ruleUpdateMatch[1])
      const body  = await readBody(req)
      const rules = alertSystem.rules
      if (!rules?.has?.(ruleId)) return json(res, 404, { error: 'Regla no encontrada' })
      const rule = rules.get(ruleId)
      Object.assign(rule, body)
      return json(res, 200, { rule })
    } catch (err) {
      return json(res, 500, { error: 'Error actualizando regla' })
    }
  }

  // POST /api/alerts/rules/:id/suppress
  const suppressMatch = pathname.match(/^\/api\/alerts\/rules\/([^/]+)\/suppress$/)
  if (method === 'POST' && suppressMatch) {
    try {
      const ruleId  = decodeURIComponent(suppressMatch[1])
      const body    = await readBody(req)
      const duration = Number(body.duration) || 3600
      alertSystem.suppressRule?.(ruleId, duration)
      return json(res, 200, { ok: true, suppressedFor: duration })
    } catch (err) {
      return json(res, 404, { error: 'Regla no encontrada' })
    }
  }

  return null
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', chunk => { data += chunk })
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}) }
      catch { resolve({}) }
    })
    req.on('error', reject)
  })
}
