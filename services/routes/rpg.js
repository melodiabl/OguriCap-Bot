/**
 * api/routes/rpg.js — /api/rpg/*
 * Dashboard de economía/niveles desde PostgreSQL
 */
import { json, getJwtAuth, safeString, clampInt } from '../middleware/core.js'

export async function handleRpg({ req, res, url }) {
  const pathname = url.pathname
  const method = req.method.toUpperCase()
  const db = global.db

  // ── GET /api/rpg/leaderboard ──────────────────────────────────────────────
  if (pathname === '/api/rpg/leaderboard' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })

    const type = url.searchParams.get('type') || 'coin' // coin | exp | level | bank
    const limit = clampInt(url.searchParams.get('limit'), { min: 1, max: 100, fallback: 20 })
    const validTypes = ['coin', 'exp', 'level', 'bank']
    const sortBy = validTypes.includes(type) ? type : 'coin'

    try {
      if (db?.pool?.query) {
        const result = await db.pool.query(
          `SELECT jid, name, stats
           FROM whatsapp_users
           WHERE stats IS NOT NULL AND (stats->>'${sortBy}')::numeric > 0
           ORDER BY (stats->>'${sortBy}')::numeric DESC
           LIMIT $1`,
          [limit]
        )
        const rows = result.rows.map((r, i) => ({
          rank: i + 1,
          jid: safeString(r.jid),
          name: safeString(r.name || r.jid?.split('@')[0] || 'Unknown'),
          coin: Number(r.stats?.coin || 0),
          bank: Number(r.stats?.bank || 0),
          exp: Number(r.stats?.exp || 0),
          level: Number(r.stats?.level || 0),
          health: Number(r.stats?.health || 100),
          total: Number(r.stats?.coin || 0) + Number(r.stats?.bank || 0),
        }))
        return json(res, 200, { leaderboard: rows, type: sortBy, total: rows.length })
      }

      // Fallback: desde memoria
      const users = Object.values(db?.data?.users || {})
      const sorted = users
        .filter(u => u?.stats?.[sortBy] > 0)
        .sort((a, b) => (b.stats?.[sortBy] || 0) - (a.stats?.[sortBy] || 0))
        .slice(0, limit)
        .map((u, i) => ({
          rank: i + 1,
          jid: safeString(u.jid || u.id || ''),
          name: safeString(u.name || u.pushname || 'Unknown'),
          coin: Number(u.stats?.coin || 0),
          bank: Number(u.stats?.bank || 0),
          exp: Number(u.stats?.exp || 0),
          level: Number(u.stats?.level || 0),
          health: Number(u.stats?.health || 100),
          total: Number(u.stats?.coin || 0) + Number(u.stats?.bank || 0),
        }))
      return json(res, 200, { leaderboard: sorted, type: sortBy, total: sorted.length })
    } catch (err) {
      return json(res, 500, { error: err?.message || 'Error obteniendo leaderboard' })
    }
  }

  // ── GET /api/rpg/stats ────────────────────────────────────────────────────
  if (pathname === '/api/rpg/stats' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })

    try {
      if (db?.pool?.query) {
        const result = await db.pool.query(
          `SELECT
            COUNT(*) as total_players,
            SUM((stats->>'coin')::numeric) as total_coins,
            SUM((stats->>'bank')::numeric) as total_bank,
            MAX((stats->>'level')::numeric) as max_level,
            AVG((stats->>'level')::numeric) as avg_level,
            MAX((stats->>'coin')::numeric + (stats->>'bank')::numeric) as richest
           FROM whatsapp_users WHERE stats IS NOT NULL`
        )
        const r = result.rows[0]
        return json(res, 200, {
          totalPlayers: Number(r.total_players || 0),
          totalCoins: Number(r.total_coins || 0),
          totalBank: Number(r.total_bank || 0),
          totalWealth: Number(r.total_coins || 0) + Number(r.total_bank || 0),
          maxLevel: Number(r.max_level || 0),
          avgLevel: Math.round(Number(r.avg_level || 0)),
          richest: Number(r.richest || 0),
        })
      }
      return json(res, 200, { totalPlayers: 0, totalCoins: 0, totalBank: 0, totalWealth: 0, maxLevel: 0, avgLevel: 0, richest: 0 })
    } catch (err) {
      return json(res, 500, { error: err?.message || 'Error obteniendo stats RPG' })
    }
  }

  // ── GET /api/rpg/user/:jid ────────────────────────────────────────────────
  const userMatch = pathname.match(/^\/api\/rpg\/user\/(.+)$/)
  if (userMatch && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const jid = decodeURIComponent(userMatch[1])
    try {
      if (db?.pool?.query) {
        const r = await db.pool.query('SELECT jid, name, stats FROM whatsapp_users WHERE jid = $1', [jid])
        if (!r.rows[0]) return json(res, 404, { error: 'Usuario no encontrado' })
        return json(res, 200, r.rows[0])
      }
      return json(res, 404, { error: 'Usuario no encontrado' })
    } catch (err) { return json(res, 500, { error: err?.message }) }
  }

  return json(res, 404, { error: 'Ruta no encontrada' })
}
