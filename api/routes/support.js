/**
 * api/routes/support.js
 * /api/support/**, /api/proveedores/**, /api/community/**, /api/chat/**,
 * /api/custom-commands/**, /api/terminal/**
 */
import { json, readJson, getJwtAuth, safeString } from '../middleware/core.js'

function isAdmin(user) {
  return ['owner', 'admin', 'administrador'].includes(safeString(user?.rol || '').toLowerCase())
}

export async function handleSupport({ req, res, url, panelDb }) {
  const pathname = url.pathname
  const method = req.method.toUpperCase()

  // ── /api/support ──────────────────────────────────────────────────────────
  if (pathname === '/api/support/my-chat' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const myChat = panelDb?.supportChats?.[auth.user.username] || { messages: [] }
    return json(res, 200, myChat)
  }

  if (pathname === '/api/support/my-chat' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    const msg = { id: Date.now(), text: safeString(body?.text || body?.message || ''), from: auth.user.username, at: new Date().toISOString() }
    panelDb.supportChats ||= {}
    panelDb.supportChats[auth.user.username] ||= { messages: [] }
    panelDb.supportChats[auth.user.username].messages.push(msg)
    if (global.db?.write) await global.db.write()
    return json(res, 200, { success: true, message: msg })
  }

  if (pathname === '/api/support/chats' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const chats = Object.entries(panelDb?.supportChats || {}).map(([user, chat]) => ({ user, ...chat }))
    return json(res, 200, { chats })
  }

  // ── /api/proveedores ──────────────────────────────────────────────────────
  if (pathname === '/api/proveedores/stats' && method === 'GET') {
    const proveedores = Object.values(panelDb?.proveedores || {})
    return json(res, 200, { total: proveedores.length, activos: proveedores.filter(p => p?.activo !== false).length })
  }

  if (pathname === '/api/proveedores/me' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const mine = Object.values(panelDb?.proveedores || {}).find(p => p?.usuario === auth.user.username || p?.jid === auth.user.jid)
    return json(res, 200, { proveedor: mine || null })
  }

  if (pathname === '/api/proveedores' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const proveedores = Object.values(panelDb?.proveedores || {})
    const list = isAdmin(auth.user) ? proveedores : proveedores.filter(p => p?.activo !== false)
    return json(res, 200, { proveedores: list, total: list.length })
  }

  if (pathname === '/api/proveedores' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    const id = safeString(body?.jid || body?.id || Date.now())
    const record = { id, ...body, usuario: auth.user.username, activo: true, createdAt: new Date().toISOString() }
    panelDb.proveedores ||= {}
    panelDb.proveedores[id] = record
    if (global.db?.write) await global.db.write()
    return json(res, 201, { success: true, proveedor: record })
  }

  // ── /api/community ────────────────────────────────────────────────────────
  if (pathname === '/api/community/users' && method === 'GET') {
    const page = Math.max(1, Number(url.searchParams.get('page')) || 1)
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get('limit')) || 20))
    const search = safeString(url.searchParams.get('search') || '').toLowerCase().trim()
    const statusFilter = safeString(url.searchParams.get('status') || 'all')
    const roleFilter = safeString(url.searchParams.get('role') || 'all')

    const usersMap = global.db?.data?.users || {}
    const chatsMap = global.conn?.chats || {}
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

    // Only WhatsApp individual contacts, not groups
    let entries = Object.entries(usersMap)
      .filter(([jid]) => safeString(jid).endsWith('@s.whatsapp.net'))
      .map(([jid, u]) => {
        const contact = chatsMap[jid] || {}
        const name = safeString(u?.name || contact?.name || contact?.notify || '').trim()
        const pushName = safeString(contact?.notify || contact?.name || u?.name || '').trim()
        const isBanned = Boolean(u?.banned)
        const commandCount = Number(u?.commands || 0)
        const messageCount = commandCount  // commands is the best proxy available
        // premium → se muestra como 'admin' en el panel
        const isPremium = Boolean(u?.premium)
        const role = isPremium ? 'admin' : safeString(u?.role || u?.rol || 'member')
        const isActive = commandCount > 0
        const lastSeen = u?.lastSeen || u?.last_seen || null
        const joinDate = u?.joinDate || u?.join_date || u?.createdAt || null
        const groups = []
        return { jid, name, pushName, lastSeen, messageCount, commandCount, joinDate, isActive, isBanned, role, groups }
      })

    // Filters
    if (search) {
      entries = entries.filter(u =>
        u.name.toLowerCase().includes(search) ||
        u.pushName.toLowerCase().includes(search) ||
        u.jid.includes(search)
      )
    }
    if (statusFilter === 'active') entries = entries.filter(u => u.isActive && !u.isBanned)
    else if (statusFilter === 'banned') entries = entries.filter(u => u.isBanned)
    else if (statusFilter === 'inactive') entries = entries.filter(u => !u.isActive && !u.isBanned)

    if (roleFilter !== 'all') entries = entries.filter(u => u.role === roleFilter)

    const total = entries.length
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const data = entries.slice((page - 1) * limit, page * limit)

    return json(res, 200, { data, pagination: { page, limit, total, totalPages } })
  }

  if (pathname === '/api/community/stats' && method === 'GET') {
    const usersMap = global.db?.data?.users || {}
    const chatsMap = global.conn?.chats || {}
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0)

    const allUsers = Object.entries(usersMap)
      .filter(([jid]) => safeString(jid).endsWith('@s.whatsapp.net'))
      .map(([jid, u]) => {
        const contact = chatsMap[jid] || {}
        const name = safeString(u?.name || contact?.name || contact?.notify || '').trim()
        const pushName = safeString(contact?.notify || contact?.name || '').trim()
        const commandCount = Number(u?.commands || 0)
        const isBanned = Boolean(u?.banned)
        const isActive = commandCount > 0
        const lastSeen = u?.lastSeen || u?.last_seen || null
        const joinDate = u?.joinDate || u?.join_date || u?.createdAt || null
        return { jid, name, pushName, commandCount, isBanned, isActive, lastSeen, joinDate }
      })

    const totalUsers = allUsers.length
    const activeUsers = allUsers.filter(u => u.isActive && !u.isBanned).length
    const bannedUsers = allUsers.filter(u => u.isBanned).length
    const commandsTotal = allUsers.reduce((s, u) => s + u.commandCount, 0)

    const topUsers = allUsers
      .filter(u => !u.isBanned)
      .sort((a, b) => b.commandCount - a.commandCount)
      .slice(0, 10)
      .map(u => {
        const isPremium = Boolean(usersMap[u.jid]?.premium)
        return { jid: u.jid, name: u.name || u.pushName, messageCount: u.commandCount, commandCount: u.commandCount, isActive: u.isActive, isBanned: false, role: isPremium ? 'admin' : 'member', groups: [], lastSeen: u.lastSeen }
      })

    return json(res, 200, { totalUsers, activeUsers, bannedUsers, newUsersToday: 0, messagesTotal: commandsTotal, commandsTotal, topUsers })
  }

  // POST /api/community/users/:jid/ban
  const banMatch = pathname.match(/^\/api\/community\/users\/([^/]+)\/ban$/)
  if (banMatch && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const jid = decodeURIComponent(banMatch[1])
    const body = await readJson(req)
    const banned = Boolean(body?.banned)
    const reason = safeString(body?.reason || '').trim() || (banned ? 'Baneado desde el panel' : '')
    try {
      const { setUserBanned } = await import('../../lib/panel-actions.js')
      const result = await setUserBanned(jid, banned, reason)
      if (!result.success) return json(res, 400, { error: result.error || 'Error al banear' })
      if (global.db?.write) await global.db.write()
      return json(res, 200, { success: true, jid: result.userId, banned, reason })
    } catch {
      // Fallback si panel-actions no está disponible
      if (!global.db?.data?.users) global.db.data.users = {}
      global.db.data.users[jid] ||= {}
      global.db.data.users[jid].banned = banned
      global.db.data.users[jid].bannedReason = reason
      if (global.db?.write) await global.db.write()
      return json(res, 200, { success: true, jid, banned, reason })
    }
  }

  // POST /api/community/users/:jid/promote
  // role='admin' → da premium; role='member' → quita premium
  const promoteMatch = pathname.match(/^\/api\/community\/users\/([^/]+)\/promote$/)
  if (promoteMatch && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    const jid = decodeURIComponent(promoteMatch[1])
    const body = await readJson(req)
    const role = safeString(body?.role || 'member')
    const givePremium = role === 'admin' || role === 'premium'
    try {
      const { setUserPremium } = await import('../../lib/panel-actions.js')
      await setUserPremium(jid, givePremium, 0)
      if (global.db?.write) await global.db.write()
    } catch {
      // fallback
      if (!global.db?.data?.users) global.db.data.users = {}
      global.db.data.users[jid] ||= {}
      global.db.data.users[jid].premium = givePremium
    }
    // También guardar role para que el panel lo muestre correctamente
    if (global.db?.data?.users?.[jid]) global.db.data.users[jid].role = role
    if (global.db?.write) await global.db.write()
    return json(res, 200, { success: true, jid, role, premium: givePremium })
  }

  // ── /api/chat ─────────────────────────────────────────────────────────────
  if (pathname === '/api/chat/sessions' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    return json(res, 200, { sessions: [] })
  }

  if (pathname === '/api/chat/sessions' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    return json(res, 201, { success: true, session: { id: Date.now() } })
  }

  // POST /api/chat/sessions/:sessionId/messages — AI chat
  const chatMsgMatch = pathname.match(/^\/api\/chat\/sessions\/([^/]+)\/messages$/)
  if (chatMsgMatch && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const sessionId = chatMsgMatch[1]
    const body = await readJson(req)
    const message = safeString(body?.message || '').trim()
    const model = safeString(body?.model || 'qwen').toLowerCase()
    if (!message) return json(res, 400, { error: 'message es requerido' })

    try {
      const PUBLIC_AI_URL = 'https://outerface.venice.ai/api/inference/chat'
      const modelMap = {
        qwen: 'qwen3-4b', 'qwen3': 'qwen3-4b', gemini: 'qwen3-4b',
        'gpt-4': 'qwen3-4b', 'gpt-3.5-turbo': 'qwen3-4b',
        claude: 'qwen3-4b', luminai: 'qwen3-4b', chatgpt: 'qwen3-4b',
      }
      const veniceModel = modelMap[model] || 'qwen3-4b'
      const version = 'interface@20250523.214528+393d253'

      const r = await fetch(PUBLIC_AI_URL, {
        method: 'POST',
        headers: {
          'accept': '*/*', 'content-type': 'application/json',
          'origin': 'https://venice.ai', 'referer': 'https://venice.ai/',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'x-venice-version': version,
        },
        body: JSON.stringify({
          requestId: `panel-${sessionId}-${Date.now()}`,
          modelId: veniceModel,
          prompt: [{ content: message, role: 'user' }],
          systemPrompt: '',
          conversationType: 'text',
          temperature: 0.7,
          webEnabled: false,
          topP: 0.9,
          isCharacter: false,
          clientProcessingTime: 15,
        }),
        signal: AbortSignal.timeout(30000),
      })

      const text = await r.text()
      const reply = text.split('\n').map(l => l.trim()).filter(Boolean).reduce((acc, line) => {
        try {
          const chunk = JSON.parse(line)
          if (chunk?.kind === 'content' && typeof chunk.content === 'string') return acc + chunk.content
        } catch {}
        return acc
      }, '').trim()

      if (!reply) return json(res, 502, { error: 'No se obtuvo respuesta del modelo' })
      return json(res, 200, { response: reply, content: reply, model, sessionId, timestamp: new Date().toISOString() })
    } catch (err) {
      return json(res, 502, { error: err?.message || 'Error al contactar el modelo de IA' })
    }
  }

  // ── /api/custom-commands ──────────────────────────────────────────────────
  if (pathname === '/api/custom-commands') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const cmds = panelDb?.customCommands || {}
    if (method === 'GET') return json(res, 200, { commands: Object.values(cmds) })
    if (method === 'POST') {
      const body = await readJson(req)
      const name = safeString(body?.name || '').trim()
      if (!name) return json(res, 400, { error: 'name es requerido' })
      cmds[name] = { name, response: safeString(body?.response || ''), createdAt: new Date().toISOString() }
      panelDb.customCommands = cmds
      if (global.db?.write) await global.db.write()
      return json(res, 201, { success: true, command: cmds[name] })
    }
  }

  if (pathname === '/api/custom-commands/test' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    const body = await readJson(req)
    return json(res, 200, { success: true, output: safeString(body?.response || '') })
  }

  // ── /api/terminal ─────────────────────────────────────────────────────────
  if (pathname === '/api/terminal' && method === 'GET') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    try {
      const { getTerminalLines } = await import('../../lib/terminal-mirror.js')
      const limit = Number(url.searchParams.get('limit')) || 200
      return json(res, 200, { output: getTerminalLines(Math.min(limit, 1000)) })
    } catch { return json(res, 200, { output: [] }) }
  }

  if (pathname === '/api/terminal/clear' && method === 'POST') {
    const auth = await getJwtAuth(req)
    if (!auth.ok) return json(res, auth.status, { error: auth.error })
    if (!isAdmin(auth.user)) return json(res, 403, { error: 'Permisos insuficientes' })
    return json(res, 200, { success: true })
  }
}
