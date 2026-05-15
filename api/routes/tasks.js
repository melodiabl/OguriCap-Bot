/**
 * api/routes/tasks.js — /api/tasks/**, /api/backups/**
 */
import { json, readJson, getJwtAuth, safeString } from '../middleware/core.js'
import { heavyLimiter } from '../middleware/rate-limit.js'

function isAdmin(user) {
  return ['owner', 'admin', 'administrador'].includes(safeString(user?.rol || '').toLowerCase())
}

export async function handleTasks({ req, res, url, taskScheduler, backupSystem }) {
  const pathname = url.pathname
  const method = req.method.toUpperCase()

  // ── /api/tasks ────────────────────────────────────────────────────────────
  if (pathname === '/api/tasks' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const tasks = taskScheduler?.getAllTasks?.() || []
    return json(res, 200, { tasks, total: tasks.length })
  }

  if (pathname === '/api/tasks' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const body = await readJson(req)
    try {
      const task = await taskScheduler?.createTask?.(body)
      return json(res, 201, { success: true, task })
    } catch (err) { return json(res, 500, { error: err?.message || 'Error creando tarea' }) }
  }

  if (pathname === '/api/tasks/executions' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const executions = taskScheduler?.getExecutions?.() || []
    return json(res, 200, { executions })
  }

  // ── /api/backups ──────────────────────────────────────────────────────────
  if (pathname === '/api/backups' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const backups = backupSystem?.getBackups?.() || []
    return json(res, 200, { backups, total: backups.length })
  }

  if (pathname === '/api/backups' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    if (!heavyLimiter(req, res)) return json(res, 429, { error: 'Demasiadas solicitudes' })
    try {
      const backup = await backupSystem?.createBackup?.()
      return json(res, 200, { success: true, backup })
    } catch (err) { return json(res, 500, { error: err?.message || 'Error creando backup' }) }
  }
}
