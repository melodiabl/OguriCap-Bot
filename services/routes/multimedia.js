/**
 * api/routes/multimedia.js — /api/multimedia/**
 */
import { json, getJwtAuth, safeString } from '../middleware/core.js'

export async function handleMultimedia({ req, res, url, panelDb }) {
  const pathname = url.pathname
  const method = req.method.toUpperCase()

  // ── POST /api/multimedia (upload) ─────────────────────────────────────────
  if ((pathname === '/api/multimedia' || pathname === '/api/multimedia/upload') && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    try {
      const { readBodyBuffer } = await import('../middleware/core.js')
      const buf = await readBodyBuffer(req, { limitBytes: 50 * 1024 * 1024 })
      const contentType = req.headers['content-type'] || 'application/octet-stream'
      const filename = safeString(url.searchParams.get('filename') || `upload-${Date.now()}`)
      const fs = await import('fs')
      const path = await import('path')
      const uploadDir = path.join(process.cwd(), 'storage', 'media')
      fs.mkdirSync(uploadDir, { recursive: true })
      const filePath = path.join(uploadDir, filename)
      fs.writeFileSync(filePath, buf)
      const record = {
        id: Date.now(), filename, path: filePath, size: buf.length,
        contentType, uploadedAt: new Date().toISOString(), uploadedBy: auth.user.username,
      }
      panelDb.multimedia ||= {}
      panelDb.multimedia[record.id] = record
      if (global.db?.write) await global.db.write()
      return json(res, 200, { success: true, file: record })
    } catch (err) { return json(res, 500, { error: err?.message || 'Error subiendo archivo' }) }
  }

  // ── GET /api/multimedia (lista) ───────────────────────────────────────────
  if (pathname === '/api/multimedia' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const items = Object.values(panelDb?.multimedia || {})
    return json(res, 200, { items, total: items.length })
  }

  // ── GET /api/multimedia/stats ─────────────────────────────────────────────
  if (pathname === '/api/multimedia/stats' && method === 'GET') {
    const items = Object.values(panelDb?.multimedia || {})
    return json(res, 200, { total: items.length })
  }

  // ── GET /api/multimedia/:id — servir archivo ──────────────────────────────
  const match = pathname.match(/^\/api\/multimedia\/([^/]+)$/)
  if (match && method === 'GET') {
    const id = decodeURIComponent(match[1])
    const record = panelDb?.multimedia?.[id] || Object.values(panelDb?.multimedia || {}).find(m => m?.filename === id)
    if (!record?.path) return json(res, 404, { error: 'Archivo no encontrado' })
    try {
      const fs = await import('fs')
      if (!fs.existsSync(record.path)) return json(res, 404, { error: 'Archivo no encontrado en disco' })
      const stat = fs.statSync(record.path)
      res.statusCode = 200
      res.setHeader('Content-Type', record.contentType || 'application/octet-stream')
      res.setHeader('Content-Length', stat.size)
      res.setHeader('Content-Disposition', `inline; filename="${record.filename}"`)
      res.setHeader('Cache-Control', 'public, max-age=86400')
      fs.createReadStream(record.path).pipe(res)
      return
    } catch (err) { return json(res, 500, { error: err?.message }) }
  }
}
