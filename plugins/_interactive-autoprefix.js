const INTERACTIVE_MTYPES = new Set([
  'templateButtonReplyMessage',
  'buttonsResponseMessage',
  'listResponseMessage',
  'interactiveResponseMessage',
  'nativeFlowResponseMessage',
])

const INTERNAL_ID_PREFIX = 'ogcmd:'
const MENU_LABEL_TO_COMMAND = new Map([
  ['economia', 'menu economia'],
  ['descargas', 'menu descargas'],
  ['gacha', 'menu gacha'],
  ['sockets', 'menu sockets'],
  ['utilidades', 'menu utilidades'],
  ['grupos', 'menu grupos'],
  ['perfil', 'menu perfil'],
  ['diversion', 'menu diversion'],
  ['anime', 'menu anime'],
  ['nsfw', 'menu nsfw'],
  ['panel', 'menu panel'],
  ['owner', 'menu owner'],
  ['menu completo texto', 'menu full'],
  ['menu completo texto ver el menu largo', 'menu full'],
  ['menu completo texto ver menu largo', 'menu full'],
  ['menu completo', 'menu full'],
  ['panel web', 'panel'],
  ['registro panel', 'registro'],
  ['buscar comando', 'menu buscar'],
])

function normalizeLabel(text) {
  try {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/^[^\p{L}\p{N}]+/u, '')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  } catch {
    return String(text || '').toLowerCase().trim()
  }
}

function mapInteractiveLabelToCommand(text) {
  const k = normalizeLabel(text)
  if (!k) return ''
  const exact = MENU_LABEL_TO_COMMAND.get(k)
  if (exact) return exact

  // Fallback tolerante para clientes que devuelven título + descripción
  if (k.includes('menu completo')) return 'menu full'
  if (k.includes('registro panel') || k === 'registro' || k.includes('crear ver tu registro')) return 'registro'
  if (k.includes('panel web')) return 'panel'
  if (k.includes('buscar comando')) return 'menu buscar'

  const byCategory = [
    'economia',
    'descargas',
    'gacha',
    'sockets',
    'utilidades',
    'grupos',
    'perfil',
    'diversion',
    'anime',
    'nsfw',
    'panel',
    'owner',
  ].find((c) => k.includes(c))

  if (byCategory) return `menu ${byCategory}`
  return ''
}

function stripLeadingPrefix(text, prefix) {
  const t = String(text || '')
  if (!t) return ''

  if (prefix instanceof RegExp) {
    try {
      prefix.lastIndex = 0
      const m = prefix.exec(t)
      if (m && m.index === 0 && m[0]) return t.slice(String(m[0]).length).trimStart()
    } catch {
      // ignore
    }
    return ''
  }

  if (typeof prefix === 'string') {
    if (!prefix) return ''
    if (t.startsWith(prefix)) return t.slice(prefix.length).trimStart()
    return ''
  }

  if (Array.isArray(prefix)) {
    for (const p of prefix) {
      const out = stripLeadingPrefix(t, p)
      if (out) return out
    }
  }

  return ''
}

function decodeInternalCommand(text) {
  const raw = String(text || '').trim()
  if (!raw || !raw.startsWith(INTERNAL_ID_PREFIX)) return raw
  const payload = raw.slice(INTERNAL_ID_PREFIX.length)
  if (!payload) return raw
  try {
    const decoded = Buffer.from(payload, 'base64url').toString('utf8').trim()
    return decoded || raw
  } catch {
    return raw
  }
}

async function tryDeleteInteractiveMessage(conn, m) {
  try {
    if (!conn || !m?.chat || !m?.key?.id) return

    const key = {
      remoteJid: m.chat,
      fromMe: false,
      id: m.key.id,
      ...(m.isGroup && m.sender ? { participant: m.sender } : {}),
    }

    // Intento directo con key reconstruida
    try {
      await conn.sendMessage(m.chat, { delete: key })
      return
    } catch {
      // continue
    }

    // Fallback con key original
    try {
      await conn.sendMessage(m.chat, { delete: m.key })
      return
    } catch {
      // continue
    }

    // Fallback usando helper del mensaje serializado
    try {
      if (typeof m.delete === 'function') await m.delete()
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }
}

function getMsgType(m) {
  try {
    return String(
      m?.mtype ||
        m?.type ||
        (m?.message && typeof m.message === 'object' ? Object.keys(m.message)[0] : '') ||
        ''
    )
  } catch {
    return ''
  }
}

function hasAnyPrefix(text, prefix) {
  const t = String(text || '')
  if (!t) return false

  if (prefix instanceof RegExp) return prefix.test(t)
  if (typeof prefix === 'string') return prefix ? t.startsWith(prefix) : false
  if (Array.isArray(prefix)) {
    return prefix.some((p) => {
      if (!p) return false
      if (p instanceof RegExp) return p.test(t)
      return typeof p === 'string' ? t.startsWith(p) : false
    })
  }
  return false
}

function pickPrefixString(connPrefix, globalPrefix) {
  if (typeof connPrefix === 'string' && connPrefix.trim()) return connPrefix
  if (Array.isArray(connPrefix)) {
    const p = connPrefix.find((x) => typeof x === 'string' && String(x).trim())
    if (p) return p
  }

  // globalPrefix suele ser un RegExp (ej: ^[#!./-])
  if (globalPrefix instanceof RegExp) {
    const candidates = ['.', '#', '!', '/', '$', '@', '*', '&', '?', '+', '-', '_', ';', ':', ',']
    for (const c of candidates) {
      try {
        if (globalPrefix.test(c)) return c
      } catch {
        // ignore
      }
    }
  }

  return '.'
}

function getCommandMatchers() {
  const plugins = global.plugins || {}
  const keys = Object.keys(plugins)

  if (!global.__interactiveAutoprefixCache) {
    global.__interactiveAutoprefixCache = { ts: 0, n: 0, strings: new Set(), regexes: [] }
  }
  const cache = global.__interactiveAutoprefixCache

  const now = Date.now()
  if ((cache.strings.size > 0 || cache.regexes.length > 0) && cache.n === keys.length && now - cache.ts < 60 * 1000) {
    return cache
  }

  const strings = new Set()
  const regexes = []
  for (const plugin of Object.values(plugins)) {
    if (!plugin || !plugin.command) continue
    const c = plugin.command

    if (typeof c === 'string') {
      const cmd = c.trim().toLowerCase()
      if (cmd) strings.add(cmd)
      continue
    }

    if (c instanceof RegExp) {
      regexes.push(c)
      continue
    }

    if (Array.isArray(c)) {
      for (const item of c) {
        if (typeof item === 'string') {
          const cmd = item.trim().toLowerCase()
          if (cmd) strings.add(cmd)
        } else if (item instanceof RegExp) {
          regexes.push(item)
        }
      }
    }
  }

  cache.ts = now
  cache.n = keys.length
  cache.strings = strings
  cache.regexes = regexes
  return cache
}

function matchesKnownCommand(token, matchers) {
  const t = String(token || '').toLowerCase()
  if (!t) return false
  if (matchers?.strings?.has(t)) return true
  const regexes = Array.isArray(matchers?.regexes) ? matchers.regexes : []
  for (const re of regexes) {
    try {
      re.lastIndex = 0
      if (re.test(t)) return true
    } catch {
      // ignore invalid regex
    }
  }
  return false
}

function extractAltInteractiveText(m) {
  try {
    const msg = m?.msg || {}
    const fromMsg =
      msg?.selectedDisplayText ||
      msg?.title ||
      msg?.singleSelectReply?.selectedRowId ||
      msg?.selectedId ||
      ''

    const fromRaw =
      m?.message?.buttonsResponseMessage?.selectedDisplayText ||
      m?.message?.templateButtonReplyMessage?.selectedDisplayText ||
      m?.message?.listResponseMessage?.title ||
      ''

    return String(fromMsg || fromRaw || '').trim()
  } catch {
    return ''
  }
}

export async function before(m, { conn }) {
  try {
    if (!m?.text) return
    if (m?.fromMe) return

    const msgType = getMsgType(m)
    if (!INTERACTIVE_MTYPES.has(msgType)) return

    const incoming = String(m.text || '').trim()
    let raw = decodeInternalCommand(incoming)
    if (!raw) return

    const basePrefix = conn?.prefix || global.prefix
    const matchers = getCommandMatchers()

    let strippedPrefixed = ''
    if (hasAnyPrefix(raw, basePrefix) || hasAnyPrefix(raw, global.prefix)) {
      strippedPrefixed = stripLeadingPrefix(raw, basePrefix) || stripLeadingPrefix(raw, global.prefix)
      const prefToken = strippedPrefixed.split(/\s+/)[0]?.toLowerCase() || ''
      if (prefToken && matchesKnownCommand(prefToken, matchers)) return
      if (strippedPrefixed) raw = strippedPrefixed
    }

    let token = raw.split(/\s+/)[0]?.toLowerCase() || ''
    if (!token) return

    if (!matchesKnownCommand(token, matchers)) {
      const alt = decodeInternalCommand(extractAltInteractiveText(m))
      const altToken = alt.split(/\s+/)[0]?.toLowerCase() || ''
      if (alt && altToken && matchesKnownCommand(altToken, matchers)) {
        raw = alt
        token = altToken
      } else {
        const mapped =
          mapInteractiveLabelToCommand(raw) ||
          mapInteractiveLabelToCommand(alt) ||
          mapInteractiveLabelToCommand(incoming) ||
          mapInteractiveLabelToCommand(strippedPrefixed)
        const mappedToken = mapped.split(/\s+/)[0]?.toLowerCase() || ''
        if (!mapped || !mappedToken || !matchesKnownCommand(mappedToken, matchers)) return
        raw = mapped
        token = mappedToken
      }
    }

    const p = pickPrefixString(conn?.prefix, global.prefix)
    // `m.text` es getter (lib/simple.js). Para sobreescribir, usar `_text`.
    m._text = hasAnyPrefix(raw, basePrefix) || hasAnyPrefix(raw, global.prefix) ? raw : `${p}${raw}`

    // Opcional: ocultar en chat la respuesta interactiva del usuario (best-effort)
    // Activa solo con: HIDE_INTERACTIVE_REPLY=1
    if (process.env.HIDE_INTERACTIVE_REPLY === '1' && m?.key && m?.chat) {
      void tryDeleteInteractiveMessage(conn, m)
      // Reintento diferido por si el cliente tarda en sincronizar el mensaje
      setTimeout(() => {
        void tryDeleteInteractiveMessage(conn, m)
      }, 1200)
    }
  } catch {
    // ignore
  }
}
