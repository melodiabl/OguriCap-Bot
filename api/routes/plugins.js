/**
 * api/routes/plugins.js — GET /api/plugins  |  PATCH /api/plugins/:name
 */
import { json, getJwtAuth } from '../middleware/core.js'

function isAdmin(user) {
  return ['owner', 'admin', 'administrador'].includes(String(user?.rol || '').toLowerCase())
}

export async function handlePlugins({ req, res, url }) {
  const pathname = url.pathname
  const method   = req.method.toUpperCase()

  // ── GET /api/plugins ──────────────────────────────────────────────────────
  if (pathname === '/api/plugins' && method === 'GET') {
    const plugins = global.plugins || {}
    const disabled = global.db?.data?.disabledPlugins || global.db?.data?.panel?.disabledPlugins || {}
    const list = Object.entries(plugins).map(([name, p]) => ({
      name,
      label: name.replace('.js', ''),
      disabled: !!p?.disabled,
      message: disabled[name]?.message || null,
      disabledAt: disabled[name]?.disabledAt || null,
      tags: p?.tags || [],
      help: p?.help || [],
    }))
    return json(res, 200, { plugins: list, total: list.length })
  }

  // ── PATCH /api/plugins/:name ──────────────────────────────────────────────
  const match = pathname.match(/^\/api\/plugins\/(.+)$/)
  if (match && method === 'PATCH') {
    const auth = await getJwtAuth(req)
    if (!auth?.user) return json(res, 401, { error: 'No autorizado' })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Sin permisos' })

    const name = decodeURIComponent(match[1])
    const key  = resolvePluginKey(name)
    if (!key) return json(res, 404, { error: `Plugin '${name}' no encontrado` })

    let body = {}
    try {
      const raw = await new Promise((resolve, reject) => {
        let data = ''
        req.on('data', c => data += c)
        req.on('end', () => resolve(data))
        req.on('error', reject)
      })
      body = JSON.parse(raw || '{}')
    } catch { return json(res, 400, { error: 'JSON inválido' }) }

    const { disabled, message } = body
    if (typeof disabled !== 'boolean') return json(res, 400, { error: 'Campo "disabled" requerido (boolean)' })

    if (!global.db?.data) return json(res, 503, { error: 'DB no disponible' })
    global.db.data.disabledPlugins ||= {}

    if (global.plugins[key]) global.plugins[key].disabled = disabled

    if (disabled) {
      global.db.data.disabledPlugins[key] = {
        disabled: true,
        message: typeof message === 'string' ? message.trim() || null : null,
        disabledAt: new Date().toISOString(),
        disabledBy: auth.user.username || 'panel',
      }
    } else {
      delete global.db.data.disabledPlugins[key]
    }

    if (global.db?.write) global.db.write().catch(() => {})

    return json(res, 200, {
      name: key,
      disabled,
      message: global.db.data.disabledPlugins[key]?.message || null,
    })
  }

  return null // no manejado
}

function resolvePluginKey(name) {
  const plugins = global.plugins || {}
  if (plugins[name]) return name
  if (plugins[name + '.js']) return name + '.js'
  const lower = name.toLowerCase()
  return Object.keys(plugins).find(k => k.toLowerCase().includes(lower)) || null
}
