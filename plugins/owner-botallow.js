import { areJidsSameUser } from 'baileys'

global.__botallowPending ||= Object.create(null)
global.__botallowProbeCooldown ||= Object.create(null)

const IDS = {
  MENU: 'BOTALLOW_MENU',
  LIST: 'BOTALLOW_LIST',
  ADD: 'BOTALLOW_ADD',
  DEL: 'BOTALLOW_DEL',
  PREFIX_MENU: 'BOTALLOW_PREFIX_MENU',
  PREFIX_LIST: 'BOTALLOW_PREFIX_LIST',
  PREFIX_ADD: 'BOTALLOW_PREFIX_ADD',
  PREFIX_DEL: 'BOTALLOW_PREFIX_DEL',
  CANCEL: 'BOTALLOW_CANCEL',
}

function makeCmdId(usedPrefix, command, rest = '') {
  const p = usedPrefix || '.'
  const c = command || 'botallow'
  const r = String(rest || '').trim()
  return r ? `${p}${c} ${r}` : `${p}${c}`
}

async function safeSendList(conn, jid, title, text, buttonText, sections, quoted) {
  if (typeof conn.sendList !== 'function') return false
  try {
    await conn.sendList(jid, title, text, buttonText, sections, quoted)
    return true
  } catch (e) {
    console.error('[BOTALLOW] sendList failed:', e?.message || e)
    return false
  }
}

async function safeSendButton(conn, jid, text, footer, buttons, quoted) {
  if (typeof conn.sendButton !== 'function') return false
  try {
    await conn.sendButton(jid, text, footer || '🛡️ Oguri Bot', null, buttons, null, null, quoted)
    return true
  } catch (e) {
    console.error('[BOTALLOW] sendButton failed:', e?.message || e)
    return false
  }
}

function normalizeFromLabel(text, usedPrefix, command) {
  const t = String(text || '').trim().toLowerCase()
  if (!t) return ''
  const cmd = (rest) => makeCmdId(usedPrefix, command, rest)
  // Algunos clientes devuelven el display_text en vez del id.
  if (t === 'lista' || t.includes('📃')) return cmd('list')
  if (t.includes('agregar') || t.includes('➕')) return cmd('add')
  if (t.includes('quitar') || t.includes('➖') || t.includes('eliminar')) return cmd('del')
  if (t.includes('prefij') || t.includes('🧩')) return cmd('prefix')
  if (t.includes('cancel') || t.includes('❌')) return cmd('cancel')
  if (t.includes('menu') || t.includes('⬅')) return cmd('menu')
  return ''
}

function extractInteractiveId(m) {
  try {
    const msg = m?.msg || m?.message || null
    if (!msg || typeof msg !== 'object') return ''

    const direct =
      msg?.buttonsResponseMessage?.selectedButtonId ||
      msg?.templateButtonReplyMessage?.selectedId ||
      msg?.listResponseMessage?.singleSelectReply?.selectedRowId ||
      msg?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson ||
      msg?.nativeFlowResponseMessage?.paramsJson ||
      msg?.interactiveResponseMessage?.paramsJson ||
      msg?.paramsJson ||
      ''

    if (typeof direct === 'string' && direct.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(direct)
        return (
          parsed?.id ||
          parsed?.selectedId ||
          parsed?.selectedRowId ||
          parsed?.rowId ||
          parsed?.selectedButtonId ||
          ''
        )
      } catch {
        return ''
      }
    }
    const id = typeof direct === 'string' ? direct : ''
    if (id) return id

    // Fallback: a veces el text getter ya trae el id
    const t = String(m?.text || '').trim()
    return t
  } catch {
    return ''
  }
}

function getBotSettings(conn) {
  const botJid = conn?.user?.jid || conn?.user?.id
  if (!botJid) return null
  global.db.data.settings ||= {}
  global.db.data.settings[botJid] ||= {}
  const s = global.db.data.settings[botJid]
  if (!Array.isArray(s.antiBotGlobalAllowJids)) s.antiBotGlobalAllowJids = []
  if (!Array.isArray(s.antiBotGlobalAllowPrefixes)) s.antiBotGlobalAllowPrefixes = []
  if (typeof s.antiBotDetected !== 'object' || s.antiBotDetected == null) s.antiBotDetected = {}
  return s
}

async function pickJid(m, arg) {
  const mentioned = await m.mentionedJid
  if (Array.isArray(mentioned) && mentioned[0]) return mentioned[0]
  const raw = String(arg || '').trim()
  const num = raw.replace(/[^0-9]/g, '')
  if (!num) return null
  return `${num}@s.whatsapp.net`
}

function pickPrefixFromText(text) {
  const raw = String(text || '').trim()
  if (!raw) return ''
  // Tomar 1er token como prefijo
  return raw.split(/\s+/)[0].trim().slice(0, 32)
}

async function sendMainMenu(m, { conn, usedPrefix, command, s }) {
  const jCount = Array.isArray(s.antiBotGlobalAllowJids) ? s.antiBotGlobalAllowJids.length : 0
  const pCount = Array.isArray(s.antiBotGlobalAllowPrefixes) ? s.antiBotGlobalAllowPrefixes.length : 0
  const text =
    `Evita que *Anti-Bots* expulse bots aliados (global).\n\n` +
    `✦ JIDs permitidos: *${jCount}*\n` +
    `✦ Prefijos permitidos: *${pCount}*`

  if (typeof conn.sendList === 'function') {
    const rows = [
      { title: '📃 Ver allowlist', description: 'JIDs y prefijos permitidos', rowId: makeCmdId(usedPrefix, command, 'list') },
      { title: '➕ Agregar bot (JID)', description: 'Permitir un bot aliado', rowId: makeCmdId(usedPrefix, command, 'add') },
      { title: '➖ Quitar bot (JID)', description: 'Sacar de la allowlist', rowId: makeCmdId(usedPrefix, command, 'del') },
      { title: '🧩 Prefijos permitidos', description: 'Gestionar firmas/prefijos', rowId: makeCmdId(usedPrefix, command, 'prefix') },
      { title: '🗂️ Detectados', description: 'Ver bots detectados', rowId: makeCmdId(usedPrefix, command, 'detected') },
      { title: '❌ Cancelar', description: 'Cerrar', rowId: makeCmdId(usedPrefix, command, 'cancel') },
    ]
    const ok = await safeSendList(
      conn,
      m.chat,
      '🛡️ BotAllow (Global)',
      text,
      'Abrir',
      [{ title: 'Acciones', rows }],
      m
    )
    if (ok) return true
  }

  // Fallback: botones (nativeFlow)
  const btn = [
    ['📃 Lista', makeCmdId(usedPrefix, command, 'list')],
    ['➕ Agregar', makeCmdId(usedPrefix, command, 'add')],
    ['➖ Quitar', makeCmdId(usedPrefix, command, 'del')],
    ['🧩 Prefijos', makeCmdId(usedPrefix, command, 'prefix')],
    ['🗂️ Detectados', makeCmdId(usedPrefix, command, 'detected')],
    ['❌ Cancelar', makeCmdId(usedPrefix, command, 'cancel')],
  ]
  const okBtn = await safeSendButton(conn, m.chat, `🛡️ *BotAllow (Global)*\n\n${text}`, '🛡️ Oguri Bot', btn, m)
  if (okBtn) return true

  return m.reply(
    `ꕥ *BOTS PERMITIDOS (GLOBAL)*\n\n${text}\n\n` +
    `Comandos:\n` +
    `• ${makeCmdId(usedPrefix, command, 'list')}\n` +
    `• ${makeCmdId(usedPrefix, command, 'add')}\n` +
    `• ${makeCmdId(usedPrefix, command, 'del')}\n` +
    `• ${makeCmdId(usedPrefix, command, 'prefix')}\n` +
    `• ${makeCmdId(usedPrefix, command, 'detected')}`
  )
}

async function sendPrefixMenu(m, { conn, usedPrefix, command, s }) {
  const pCount = Array.isArray(s.antiBotGlobalAllowPrefixes) ? s.antiBotGlobalAllowPrefixes.length : 0
  const text =
    `Sirve para permitir bots por firma de Message-ID (menos seguro que JID).\n` +
    `Total: *${pCount}*`

  if (typeof conn.sendList === 'function') {
    const rows = [
      { title: '📃 Ver prefijos', description: 'Lista de firmas', rowId: makeCmdId(usedPrefix, command, 'prefix list') },
      { title: '➕ Agregar prefijo', description: 'Permitir por firma', rowId: makeCmdId(usedPrefix, command, 'prefix add') },
      { title: '➖ Quitar prefijo', description: 'Eliminar firma', rowId: makeCmdId(usedPrefix, command, 'prefix del') },
      { title: '⬅️ Volver', description: 'Menu principal', rowId: makeCmdId(usedPrefix, command, 'menu') },
      { title: '❌ Cancelar', description: 'Cerrar', rowId: makeCmdId(usedPrefix, command, 'cancel') },
    ]
    const ok = await safeSendList(
      conn,
      m.chat,
      '🧩 Prefijos permitidos',
      text,
      'Abrir',
      [{ title: 'Acciones', rows }],
      m
    )
    if (ok) return true
  }

  // Fallback: botones (nativeFlow)
  const btn = [
    ['📃 Ver', makeCmdId(usedPrefix, command, 'prefix list')],
    ['➕ Agregar', makeCmdId(usedPrefix, command, 'prefix add')],
    ['➖ Quitar', makeCmdId(usedPrefix, command, 'prefix del')],
    ['⬅️ Volver', makeCmdId(usedPrefix, command, 'menu')],
    ['❌ Cancelar', makeCmdId(usedPrefix, command, 'cancel')],
  ]
  const okBtn = await safeSendButton(conn, m.chat, `🧩 *Prefijos permitidos*\n\n${text}`, '🧩 Prefijos', btn, m)
  if (okBtn) return true

  return m.reply(
    `ꕥ *PREFIJOS PERMITIDOS*\n\n${text}\n\n` +
    `Comandos:\n` +
    `• ${makeCmdId(usedPrefix, command, 'prefix list')}\n` +
    `• ${makeCmdId(usedPrefix, command, 'prefix add')}\n` +
    `• ${makeCmdId(usedPrefix, command, 'prefix del')}`
  )
}


let handler = async (m, { conn, args, usedPrefix, command }) => {
  const s = getBotSettings(conn)
  if (!s) return m.reply('❌ No pude resolver el JID del bot.')

  // Evitar respuestas duplicadas entre sockets
  try {
    if (m.isGroup) {
      const chatCfg = global.db?.data?.chats?.[m.chat]
      const primary = chatCfg?.primaryBot
      const selfJid = conn?.user?.jid || conn?.user?.id
      if (primary && selfJid && primary !== selfJid) return
      if (!primary && conn?.isSubBot) return
    }
  } catch {}

  const sub = String(args[0] || '').toLowerCase()
  const sub2 = String(args[1] || '').toLowerCase()

  if (!sub || sub === 'help') {
    // En grupos: por defecto provocar actividad (.menu) y mostrar detectados recientes
    if (m.isGroup) {
      const secs = /^\d+$/.test(String(args[0] || '').trim()) ? Number(args[0]) : 10
      const waitSecs = Math.min(60, Math.max(5, secs))
      const startedAt = Date.now()

      // Cooldown para no spamear probes
      const cdKey = `${m.chat}|${conn?.user?.jid || ''}`
      const last = Number(global.__botallowProbeCooldown?.[cdKey] || 0)
      if (!last || (Date.now() - last) > 45 * 1000) {
        global.__botallowProbeCooldown[cdKey] = Date.now()

        // Provocar actividad con 2 prefijos comunes (evitar rate-limit)
        const probes = ['.menu', '!menu']
        for (const text of probes) {
          try { await conn.sendMessage(m.chat, { text }, { quoted: m }) } catch { }
          await new Promise((r) => setTimeout(r, 900))
        }
      }
      await new Promise((r) => setTimeout(r, waitSecs * 1000))

      const detected = (s.antiBotDetected && typeof s.antiBotDetected === 'object') ? s.antiBotDetected : {}
      const list = Object.values(detected)
        .filter(Boolean)
        .filter((r) => r?.lastGroup === m.chat && Number(r?.lastSeenAt || 0) >= startedAt)
        .sort((a, b) => Number(b?.lastSeenAt || 0) - Number(a?.lastSeenAt || 0))
        .slice(0, 30)

      if (!list.length) {
        // Sin resultados: no enviar mensaje extra, solo mostrar el menu.
        return sendMainMenu(m, { conn, usedPrefix, command, s })
      }

      if (typeof conn.sendList === 'function') {
        const rows = list.map((r, i) => {
          const jid = String(r?.jid || '')
          const sigs = Array.isArray(r?.signatures) ? r.signatures.join(', ') : ''
          return {
            title: `${i + 1}. ${jid.split('@')[0]}`,
            description: `${(r?.count || 0)}x${sigs ? ` • ${sigs}` : ''}`,
            rowId: `${usedPrefix + command} detected show ${encodeURIComponent(jid)}`,
          }
        })
        await conn.sendList(
          m.chat,
          '🗂️ Bots detectados',
          `Resultados (ventana ${waitSecs}s). Selecciona uno para permitirlo.`,
          'Abrir',
          [{ title: 'Resultados', rows }],
          m
        )
      } else {
        const text = list.map((r, i) => {
          const jid = String(r?.jid || '')
          const sigs = Array.isArray(r?.signatures) ? r.signatures.join(', ') : ''
          return `${i + 1}. @${jid.split('@')[0]} • ${(r?.count || 0)}x${sigs ? ` • ${sigs}` : ''}`
        }).join('\n')
        await conn.sendMessage(m.chat, { text: `🗂️ *Detectados (ventana ${waitSecs}s)*\n\n${text}`, mentions: list.map(r => r.jid) }, { quoted: m })
      }

      return sendMainMenu(m, { conn, usedPrefix, command, s })
    }

    return sendMainMenu(m, { conn, usedPrefix, command, s })
  }

  if (sub === 'menu') {
    return sendMainMenu(m, { conn, usedPrefix, command, s })
  }

  if (sub === 'cancel' || sub === 'cancelar') {
    delete global.__botallowPending[m.sender]
    return m.reply('✅ Cancelado.')
  }

  if (['add', 'agregar'].includes(sub)) {
    const jid = await pickJid(m, args[1])
    if (!jid) {
      global.__botallowPending[m.sender] = { action: 'add_jid', chat: m.chat, expiresAt: Date.now() + 60 * 1000 }
      if (typeof conn.sendButton === 'function') {
        return conn.sendButton(
          m.chat,
          `Responde con *@mencion* o con el *numero* para permitirlo globalmente.\n\nEj: 51999999999\n\nTiempo: 60s`,
          '➕ Agregar bot',
          null,
          [['❌ Cancelar', `${usedPrefix + command} cancel`], ['📃 Lista', `${usedPrefix + command} list`]],
          null,
          null,
          m
        )
      }
      return m.reply(`Responde con @mencion o con el numero. Ej: ${usedPrefix + command} add 51999999999`)
    }
    if (s.antiBotGlobalAllowJids.some(j => areJidsSameUser(j, jid))) {
      return conn.sendMessage(m.chat, { text: `✅ Ya permitido: @${jid.split('@')[0]}`, mentions: [jid] }, { quoted: m })
    }
    s.antiBotGlobalAllowJids.push(jid)
    if (global.db?.write) await global.db.write().catch(() => {})
    return conn.sendMessage(m.chat, { text: `✅ Permitido global: @${jid.split('@')[0]}`, mentions: [jid] }, { quoted: m })
  }

  if (['del', 'delete', 'remove', 'quitar', 'rm'].includes(sub)) {
    const jid = await pickJid(m, args[1])
    if (!jid) {
      global.__botallowPending[m.sender] = { action: 'del_jid', chat: m.chat, expiresAt: Date.now() + 60 * 1000 }
      if (typeof conn.sendButton === 'function') {
        return conn.sendButton(
          m.chat,
          `Responde con *@mencion* o con el *numero* para quitarlo de la allowlist global.\n\nTiempo: 60s`,
          '➖ Quitar bot',
          null,
          [['❌ Cancelar', `${usedPrefix + command} cancel`], ['📃 Lista', `${usedPrefix + command} list`]],
          null,
          null,
          m
        )
      }
      return m.reply(`Responde con @mencion o con el numero. Ej: ${usedPrefix + command} del 51999999999`)
    }
    const before = s.antiBotGlobalAllowJids.length
    s.antiBotGlobalAllowJids = s.antiBotGlobalAllowJids.filter(j => !areJidsSameUser(j, jid))
    const removed = before - s.antiBotGlobalAllowJids.length
    if (removed > 0 && global.db?.write) await global.db.write().catch(() => {})
    return conn.sendMessage(m.chat, { text: removed ? `🗑️ Quitado: @${jid.split('@')[0]}` : `⚠️ No estaba: @${jid.split('@')[0]}`, mentions: [jid] }, { quoted: m })
  }

  if (sub === 'list' || sub === 'lista') {
    const list = Array.isArray(s.antiBotGlobalAllowJids) ? s.antiBotGlobalAllowJids : []
    const prefixes = Array.isArray(s.antiBotGlobalAllowPrefixes) ? s.antiBotGlobalAllowPrefixes : []
    const textJ = list.length ? list.slice(0, 50).map((j, i) => `${i + 1}. @${String(j).split('@')[0]}`).join('\n') : '(vacio)'
    const textP = prefixes.length ? prefixes.slice(0, 50).map((p, i) => `${i + 1}. ${p}`).join('\n') : '(vacio)'
    if (typeof conn.sendButton === 'function') {
      return conn.sendButton(
        m.chat,
        `📃 *Allowlist Global*\n\n*JIDs*\n${textJ}\n\n*Prefijos*\n${textP}`,
        '🛡️ Oguri Bot',
        null,
        [['⬅️ Menu', `${usedPrefix + command} menu`], ['🧩 Prefijos', `${usedPrefix + command} prefix`]],
        null,
        null,
        m,
      )
    }
    return conn.sendMessage(m.chat, { text: `📃 *Allowlist Global*\n\n*JIDs*\n${textJ}\n\n*Prefijos*\n${textP}`, mentions: list }, { quoted: m })
  }

  if (sub === 'prefix') {
    if (!sub2) return sendPrefixMenu(m, { conn, usedPrefix, command, s })
    if (sub2 === 'list' || sub2 === 'lista') {
      const prefixes = Array.isArray(s.antiBotGlobalAllowPrefixes) ? s.antiBotGlobalAllowPrefixes : []
      const textP = prefixes.length ? prefixes.slice(0, 50).map((p, i) => `${i + 1}. ${p}`).join('\n') : '(vacio)'
      if (typeof conn.sendButton === 'function') {
        return conn.sendButton(
          m.chat,
          `📃 *Prefijos permitidos*\n\n${textP}`,
          '🧩 Prefijos',
          null,
          [['⬅️ Prefijos', `${usedPrefix + command} prefix`], ['⬅️ Menu', `${usedPrefix + command} menu`]],
          null,
          null,
          m,
        )
      }
      return m.reply(`📃 *Prefijos permitidos*\n\n${textP}`)
    }
    const pref = String(args[2] || '').trim()
    if (!pref) {
      const act = (sub2 === 'add' || sub2 === 'agregar') ? 'prefix_add' : (sub2 === 'del' || sub2 === 'remove' || sub2 === 'quitar' || sub2 === 'rm') ? 'prefix_del' : ''
      if (!act) return m.reply(`Uso: ${usedPrefix + command} prefix add|del|list <prefijo>`)
      global.__botallowPending[m.sender] = { action: act, chat: m.chat, expiresAt: Date.now() + 60 * 1000 }
      const title = act === 'prefix_add' ? '➕ Agregar prefijo' : '➖ Quitar prefijo'
      if (typeof conn.sendButton === 'function') {
        return conn.sendButton(
          m.chat,
          `Responde con el prefijo de Message-ID.\n\nEj: NJX-\nEj: MYSTIC\n\nTiempo: 60s`,
          title,
          null,
          [['❌ Cancelar', `${usedPrefix + command} cancel`], ['📃 Ver prefijos', `${usedPrefix + command} prefix list`]],
          null,
          null,
          m
        )
      }
      return m.reply(`Responde con el prefijo. Ej: ${usedPrefix + command} prefix add NJX-`)
    }
    if (sub2 === 'add' || sub2 === 'agregar') {
      if (s.antiBotGlobalAllowPrefixes.includes(pref)) return m.reply('✅ Ya existe ese prefijo.')
      s.antiBotGlobalAllowPrefixes.push(pref)
      if (global.db?.write) await global.db.write().catch(() => {})
      return m.reply(`✅ Prefijo permitido: ${pref}`)
    }
    if (sub2 === 'del' || sub2 === 'remove' || sub2 === 'quitar' || sub2 === 'rm') {
      const before = s.antiBotGlobalAllowPrefixes.length
      s.antiBotGlobalAllowPrefixes = s.antiBotGlobalAllowPrefixes.filter(p => p !== pref)
      const removed = before - s.antiBotGlobalAllowPrefixes.length
      if (removed > 0 && global.db?.write) await global.db.write().catch(() => {})
      return m.reply(removed ? `🗑️ Prefijo quitado: ${pref}` : `⚠️ No estaba: ${pref}`)
    }
    return m.reply(`Uso: ${usedPrefix + command} prefix add|del|list <prefijo>`)
  }

  if (sub === 'detected' || sub === 'detectados') {
    try {
      const detected = (s.antiBotDetected && typeof s.antiBotDetected === 'object') ? s.antiBotDetected : {}
      const list = Object.values(detected)
        .filter(Boolean)
        .sort((a, b) => Number(b?.lastSeenAt || 0) - Number(a?.lastSeenAt || 0))
        .slice(0, 30)

      const action = String(args[1] || '').toLowerCase()
      if (action === 'clear' || action === 'limpiar') {
        s.antiBotDetected = {}
        if (global.db?.write) await global.db.write().catch(() => {})
        return m.reply('✅ Detectados limpiados.')
      }

      if (action === 'show') {
        const jid = decodeURIComponent(String(args[2] || '')).trim()
        const rec = detected?.[jid]
        if (!rec) return m.reply('⚠️ No encontrado.')
        const sigs = Array.isArray(rec.signatures) ? rec.signatures.join(', ') : '—'
        const samples = Array.isArray(rec.samples) ? rec.samples.slice(-5).join('\n') : ''
        const text =
          `🗂️ *Detectado*\n\n` +
          `• JID: @${String(rec.jid).split('@')[0]}\n` +
          `• Veces: ${rec.count || 0}\n` +
          `• Firmas: ${sigs}\n` +
          `• Ultimo grupo: ${rec.lastGroup || '—'}\n\n` +
          (samples ? `*Samples Message-ID:*\n${samples}` : '')

        const buttons = [
          ['✅ Permitir JID', `${usedPrefix + command} add ${String(rec.jid).split('@')[0]}`],
          ['🗑️ Quitar JID', `${usedPrefix + command} del ${String(rec.jid).split('@')[0]}`],
          ['⬅️ Volver', `${usedPrefix + command} detected`],
          ['❌ Menu', `${usedPrefix + command} menu`],
        ]
        if (Array.isArray(rec.signatures) && rec.signatures[0]) {
          buttons.splice(1, 0, ['🧩 Permitir firma', `${usedPrefix + command} prefix add ${rec.signatures[0]}`])
        }
        if (typeof conn.sendButton === 'function') {
          return conn.sendButton(m.chat, text, '🛡️ Oguri Bot', null, buttons, null, null, m)
        }
        return conn.sendMessage(m.chat, { text, mentions: [rec.jid] })
      }

      if (!list.length) {
        return conn.sendMessage(m.chat, { text: 'No hay bots detectados aun. Espera a que algun bot hable en un grupo con Anti-Bots.' })
      }

      if (typeof conn.sendList === 'function') {
        const rows = list.map((r, i) => {
          const jid = String(r?.jid || '')
          const sigs = Array.isArray(r?.signatures) ? r.signatures.join(', ') : ''
          return {
            title: `${i + 1}. ${jid.split('@')[0]}`,
            description: `${(r?.count || 0)}x${sigs ? ` • ${sigs}` : ''}`,
            rowId: `${usedPrefix + command} detected show ${encodeURIComponent(jid)}`,
          }
        })
        const ok = await safeSendList(
          conn,
          m.chat,
          '🗂️ Bots detectados',
          'Selecciona uno para ver detalles y permitirlo.',
          'Abrir',
          [{ title: 'Detectados', rows }],
          m
        )
        if (ok) return true
      }

      // Fallback: mostrar como botones cuando la lista no está disponible
      const preview = list.slice(0, 5)
      const text = preview.map((r, i) => {
        const jid = String(r?.jid || '')
        const sigs = Array.isArray(r?.signatures) ? r.signatures.join(', ') : ''
        return `${i + 1}. @${jid.split('@')[0]} • ${(r?.count || 0)}x${sigs ? ` • ${sigs}` : ''}`
      }).join('\n')

      const buttons = [
        ['📃 Ver lista', `${usedPrefix + command} detected`],
        ['🧹 Limpiar', `${usedPrefix + command} detected clear`],
        ['⬅️ Menu', `${usedPrefix + command} menu`],
      ]
      const okBtn = await safeSendButton(conn, m.chat, `🗂️ *Detectados*\n\n${text}`, '🗂️ Detectados', buttons, m)
      if (okBtn) return true

      const textAll = list.map((r, i) => {
        const jid = String(r?.jid || '')
        const sigs = Array.isArray(r?.signatures) ? r.signatures.join(', ') : ''
        return `${i + 1}. @${jid.split('@')[0]} • ${(r?.count || 0)}x${sigs ? ` • ${sigs}` : ''}`
      }).join('\n')
      return conn.sendMessage(m.chat, { text: `🗂️ *Detectados*\n\n${textAll}\n\nTip: ${usedPrefix + command} detected clear`, mentions: list.map(r => r.jid) })
    } catch (e) {
      console.error('[BOTALLOW] detected failed:', e)
      return conn.sendMessage(m.chat, { text: '❌ Error mostrando detectados.' })
    }
  }



  return m.reply(`Uso: ${usedPrefix + command}`)
}

handler.before = async (m, { conn, isOwner, isROwner, usedPrefix, command }) => {
  try {
    if (m.fromMe || m.isBaileys) return
    if (!(isOwner || isROwner)) return

    // Evitar que respondan varios sockets a la misma interacción
    try {
      const chatCfg = global.db?.data?.chats?.[m.chat]
      const primary = chatCfg?.primaryBot
      const selfJid = conn?.user?.jid || conn?.user?.id
      if (primary && selfJid && primary !== selfJid) return
      if (!primary && conn?.isSubBot) return
    } catch {}

    // Acciones por botones/listas (no dependen de prefijo)
    let flowId = extractInteractiveId(m)
    const prefix0 = usedPrefix || '.'
    const command0 = command || 'botallow'

    // Fallback: si no vino id, intentar mapear por label/display_text
    if (flowId && typeof flowId === 'string') {
      const v0 = String(flowId).trim()
      if (!/^[#!./-]/.test(v0) && !/\bbotallow\b/i.test(v0) && !v0.startsWith('BOTALLOW_')) {
        const mapped = normalizeFromLabel(v0 || m.text, prefix0, command0)
        if (mapped) flowId = mapped
      }
    }

    if (flowId && typeof flowId === 'string') {
      try {
        const v = String(flowId).trim()
        if (v.startsWith('BOTALLOW_') || /\bbotallow\b/i.test(v)) {
          console.log('[BOTALLOW_INTERACTIVE]', {
            sender: m.sender,
            chat: m.chat,
            mtype: m.mtype,
            text: String(m.text || '').slice(0, 80),
            id: v.slice(0, 80),
          })
        }
      } catch {}

      const s0 = getBotSettings(conn)
      if (s0) {
        // Si el id viene como comando real (ej: ".botallow list"), ejecutar directo
        // porque en templateButtonReply a veces m.text trae el display_text y el parser no lo ve.
        const v = String(flowId).trim()
        if (/^[#!./-]/.test(v) && /\bbotallow\b/i.test(v)) {
          const p = v[0]
          const rest = v.slice(1).trim() // "botallow ..."
          const parts = rest.split(/\s+/).filter(Boolean)
          const cmdName = (parts.shift() || '').toLowerCase()
          if (cmdName !== 'botallow' && cmdName !== 'permitirbot' && cmdName !== 'botspermitidos') return
          const args = parts
          try {
            await handler(m, { conn, args, usedPrefix: p, command: 'botallow' })
          } catch (e) {
            console.error('[BOTALLOW_INTERACTIVE] handler error:', e)
            try { await conn.sendMessage(m.chat, { text: '❌ Error ejecutando la accion del boton.' }) } catch { }
          }
          return true
        }

        if (flowId === IDS.MENU) {
          await sendMainMenu(m, { conn, usedPrefix: usedPrefix || '.', command: command || 'botallow', s: s0 })
          return
        }
        if (flowId === IDS.LIST) {
          // reutilizar salida del comando list
          const list = Array.isArray(s0.antiBotGlobalAllowJids) ? s0.antiBotGlobalAllowJids : []
          const prefixes = Array.isArray(s0.antiBotGlobalAllowPrefixes) ? s0.antiBotGlobalAllowPrefixes : []
          const textJ = list.length ? list.slice(0, 50).map((j, i) => `${i + 1}. @${String(j).split('@')[0]}`).join('\n') : '(vacio)'
          const textP = prefixes.length ? prefixes.slice(0, 50).map((p, i) => `${i + 1}. ${p}`).join('\n') : '(vacio)'
          await conn.sendMessage(m.chat, { text: `📃 *Allowlist Global*\n\n*JIDs*\n${textJ}\n\n*Prefijos*\n${textP}`, mentions: list }, { quoted: m })
          return
        }
        if (flowId === IDS.ADD) {
          global.__botallowPending[m.sender] = { action: 'add_jid', chat: m.chat, expiresAt: Date.now() + 60 * 1000 }
          await conn.sendMessage(m.chat, { text: '➕ Agregar bot\n\nResponde con @mencion o con el numero (60s).\nEj: 51999999999' }, { quoted: m })
          return
        }
        if (flowId === IDS.DEL) {
          global.__botallowPending[m.sender] = { action: 'del_jid', chat: m.chat, expiresAt: Date.now() + 60 * 1000 }
          await conn.sendMessage(m.chat, { text: '➖ Quitar bot\n\nResponde con @mencion o con el numero (60s).' }, { quoted: m })
          return
        }
        if (flowId === IDS.PREFIX_MENU) {
          await sendPrefixMenu(m, { conn, usedPrefix: usedPrefix || '.', command: command || 'botallow', s: s0 })
          return
        }
        if (flowId === IDS.PREFIX_LIST) {
          const prefixes = Array.isArray(s0.antiBotGlobalAllowPrefixes) ? s0.antiBotGlobalAllowPrefixes : []
          const textP = prefixes.length ? prefixes.slice(0, 50).map((p, i) => `${i + 1}. ${p}`).join('\n') : '(vacio)'
          await conn.sendMessage(m.chat, { text: `📃 *Prefijos permitidos*\n\n${textP}` }, { quoted: m })
          return
        }
        if (flowId === IDS.PREFIX_ADD) {
          global.__botallowPending[m.sender] = { action: 'prefix_add', chat: m.chat, expiresAt: Date.now() + 60 * 1000 }
          await conn.sendMessage(m.chat, { text: '➕ Agregar prefijo\n\nResponde con el prefijo (60s).\nEj: NJX-  |  MYSTIC' }, { quoted: m })
          return
        }
        if (flowId === IDS.PREFIX_DEL) {
          global.__botallowPending[m.sender] = { action: 'prefix_del', chat: m.chat, expiresAt: Date.now() + 60 * 1000 }
          await conn.sendMessage(m.chat, { text: '➖ Quitar prefijo\n\nResponde con el prefijo (60s).' }, { quoted: m })
          return
        }
        if (flowId === IDS.CANCEL) {
          delete global.__botallowPending[m.sender]
          await conn.sendMessage(m.chat, { text: '✅ Cancelado.' }, { quoted: m })
          return
        }
      }
    }

    const pending = global.__botallowPending?.[m.sender]
    if (!pending) return
    if (pending.chat && pending.chat !== m.chat) return
    if (pending.expiresAt && Date.now() > pending.expiresAt) {
      delete global.__botallowPending[m.sender]
      return
    }

    // Evitar que el mismo mensaje dispare el comando
    const text = String(m.text || '').trim()
    if (/^\.?botallow/i.test(text)) return

    const s = getBotSettings(conn)
    if (!s) return

    if (pending.action === 'add_jid' || pending.action === 'del_jid') {
      const jid = await pickJid(m, text)
      if (!jid) return conn.reply(m.chat, 'No detecte el numero/mencion. Intenta otra vez.', m)
      delete global.__botallowPending[m.sender]

      if (pending.action === 'add_jid') {
        if (!s.antiBotGlobalAllowJids.some(j => areJidsSameUser(j, jid))) s.antiBotGlobalAllowJids.push(jid)
        if (global.db?.write) await global.db.write().catch(() => {})
        return conn.sendMessage(m.chat, { text: `✅ Permitido global: @${jid.split('@')[0]}`, mentions: [jid] }, { quoted: m })
      }

      const before = s.antiBotGlobalAllowJids.length
      s.antiBotGlobalAllowJids = s.antiBotGlobalAllowJids.filter(j => !areJidsSameUser(j, jid))
      const removed = before - s.antiBotGlobalAllowJids.length
      if (removed > 0 && global.db?.write) await global.db.write().catch(() => {})
      return conn.sendMessage(m.chat, { text: removed ? `🗑️ Quitado: @${jid.split('@')[0]}` : `⚠️ No estaba: @${jid.split('@')[0]}`, mentions: [jid] }, { quoted: m })
    }

    if (pending.action === 'prefix_add' || pending.action === 'prefix_del') {
      const pref = pickPrefixFromText(text)
      if (!pref) return conn.reply(m.chat, 'No detecte el prefijo. Ej: NJX-', m)
      delete global.__botallowPending[m.sender]

      if (pending.action === 'prefix_add') {
        if (!s.antiBotGlobalAllowPrefixes.includes(pref)) s.antiBotGlobalAllowPrefixes.push(pref)
        if (global.db?.write) await global.db.write().catch(() => {})
        return conn.reply(m.chat, `✅ Prefijo permitido: ${pref}`, m)
      }

      const before = s.antiBotGlobalAllowPrefixes.length
      s.antiBotGlobalAllowPrefixes = s.antiBotGlobalAllowPrefixes.filter(p => p !== pref)
      const removed = before - s.antiBotGlobalAllowPrefixes.length
      if (removed > 0 && global.db?.write) await global.db.write().catch(() => {})
      return conn.reply(m.chat, removed ? `🗑️ Prefijo quitado: ${pref}` : `⚠️ No estaba: ${pref}`, m)
    }
  } catch { }
}

handler.help = ['botallow']
handler.tags = ['owner']
handler.command = /^(botallow|permitirbot|botspermitidos)$/i
handler.owner = true

export default handler
