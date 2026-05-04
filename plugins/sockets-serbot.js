import baileys from "baileys"

const {
  useMultiFileAuthState,
  DisconnectReason,
  makeCacheableSignalKeyStore,
  fetchLatestBaileysVersion,
  proto,
  generateWAMessageFromContent
} = baileys

import qrcode from "qrcode"
import NodeCache from "node-cache"
import fs from "fs"
import path from "path"
import pino from 'pino'
import chalk from 'chalk'
import util from 'util'
import * as ws from 'ws'
import { spawn, exec } from 'child_process'
const { CONNECTING } = ws
import { makeWASocket } from '../lib/simple.js'
import { getSubbotCapacityInfo } from '../lib/subbot-capacity.js'
import { fileURLToPath } from 'url'
import { sendTemplateNotification } from '../lib/notification-system.js'
let crm1 = "Y2QgcGx1Z2lucy"
let crm2 = "A7IG1kNXN1b"
let crm3 = "SBpbmZvLWRvbmFyLmpz"
let crm4 = "IF9hdXRvcmVzcG9uZGVyLmpzIGluZm8tYm90Lmpz"
let drm1 = ""
let drm2 = ""
let rtx = "*❀ SER BOT • MODE QR*\n\n✰ Con otro celular o en la PC escanea este QR para convertirte en un *Sub-Bot* Temporal.\n\n\`1\` » Haga clic en los tres puntos en la esquina superior derecha\n\n\`2\` » Toque dispositivos vinculados\n\n\`3\` » Escanee este codigo QR para iniciar sesion con el bot\n\n✧ ¡Este código QR expira en 45 segundos!."
let rtx2 = "*❀ SER BOT • MODE CODE*\n\n✰ Usa este Código para convertirte en un *Sub-Bot* Temporal.\n\n\`1\` » Haga clic en los tres puntos en la esquina superior derecha\n\n\`2\` » Toque dispositivos vinculados\n\n\`3\` » Selecciona Vincular con el número de teléfono\n\n\`4\` » Escriba el Código para iniciar sesion con el bot\n\n✧ No es recomendable usar tu cuenta principal."
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

function readJsonSafe(filePath) {
  try {
    if (!filePath) return null
    if (!fs.existsSync(filePath)) return null
    const raw = fs.readFileSync(filePath, 'utf8')
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function normalizeWhatsAppNumber(value) {
  return String(value || '').replace(/[^0-9]/g, '')
}

function resolvePanelUsernameByWhatsApp(panelDb, phoneDigits) {
  try {
    const digits = normalizeWhatsAppNumber(phoneDigits)
    if (!digits) return null
    const users = panelDb?.users && typeof panelDb.users === 'object' ? Object.values(panelDb.users) : []
    for (const u of users) {
      const wa = normalizeWhatsAppNumber(u?.whatsapp_number || u?.whatsapp || u?.phone)
      if (wa && wa === digits) return String(u?.username || '').trim() || null
    }
    return null
  } catch {
    return null
  }
}

function getSockPhoneDigits(sock) {
  try {
    const jid =
      sock?.user?.jid ||
      sock?.user?.id ||
      sock?.authState?.creds?.me?.jid ||
      sock?.authState?.creds?.me?.id ||
      ''
    let base = String(jid || '').split('@')[0]
    if (base.includes(':')) base = base.split(':')[0]
    return normalizeWhatsAppNumber(base)
  } catch {
    return ''
  }
}

function getStableSubbotKey(sock, fallback) {
  try {
    const fromCode = normalizeWhatsAppNumber(sock?.subbotCode || '')
    if (fromCode) return fromCode
    const fromJid = getSockPhoneDigits(sock)
    if (fromJid) return fromJid
    const fb = String(fallback || '').trim()
    const fbDigits = normalizeWhatsAppNumber(fb)
    return fbDigits || fb || 'unknown'
  } catch {
    return String(fallback || '').trim() || 'unknown'
  }
}

const __subbotSessionDirCache = new Map()
function resolveSubbotSessionDirByPhone(phoneDigits) {
  try {
    const digits = normalizeWhatsAppNumber(phoneDigits)
    if (!digits) return ''

    const root = path.resolve(global.jadi || 'Sessions/SubBot')
    const now = Date.now()
    const cached = __subbotSessionDirCache.get(digits)
    if (cached && (now - cached.ts) < 30 * 1000) {
      if (cached.dir && fs.existsSync(path.join(root, cached.dir))) return cached.dir
      if (cached.dir === null) return digits
    }

    // Prefer panelDb mapping if available
    try {
      const rec = global.db?.data?.panel?.subbots?.[digits] || null
      const fromRec = rec ? String(rec.session_dir || rec.sessionDir || rec.alias_dir || rec.aliasDir || '').trim() : ''
      if (fromRec) {
        const full = path.join(root, fromRec)
        const st = fs.lstatSync(full)
        if (st.isDirectory() && !st.isSymbolicLink()) {
          __subbotSessionDirCache.set(digits, { dir: fromRec, ts: now })
          return fromRec
        }
      }
    } catch {}

    if (!fs.existsSync(root)) {
      __subbotSessionDirCache.set(digits, { dir: null, ts: now })
      return digits
    }

    const entries = fs.readdirSync(root, { withFileTypes: true })
    for (const ent of entries) {
      if (!ent?.isDirectory?.()) continue
      if (ent?.isSymbolicLink?.()) continue

      const dirName = ent.name
      const credsPath = path.join(root, dirName, 'creds.json')
      const parsed = readJsonSafe(credsPath)
      if (!parsed) continue

      const me = parsed?.me || parsed?.creds?.me || null
      const jid = String(me?.id || me?.jid || '').trim()
      let base = jid ? jid.split('@')[0] : ''
      if (base.includes(':')) base = base.split(':')[0]
      const phone = normalizeWhatsAppNumber(base)
      if (!phone || phone !== digits) continue

      __subbotSessionDirCache.set(digits, { dir: dirName, ts: now })

      // Backfill mapping
      try {
        if (global.db?.data?.panel) {
          global.db.data.panel.subbots ||= {}
          global.db.data.panel.subbots[digits] ||= {
            id: digits,
            code: digits,
            codigo: digits,
            tipo: 'qr',
            usuario: 'auto',
            numero: digits,
            fecha_creacion: new Date().toISOString(),
            estado: 'inactivo',
          }
          const rec = global.db.data.panel.subbots[digits]
          rec.code = digits
          rec.codigo = digits
          rec.numero = rec.numero || digits
          rec.session_dir = dirName
          rec.alias_dir = dirName
          const waName = String(me?.name || '').trim()
          if (waName && !rec.nombre_whatsapp) rec.nombre_whatsapp = waName
        }
      } catch {}

      return dirName
    }

    __subbotSessionDirCache.set(digits, { dir: null, ts: now })
    return digits
  } catch {
    return normalizeWhatsAppNumber(phoneDigits) || ''
  }
}

function normalizePrefixConfig(prefix) {
  const raw = String(prefix || '').trim()
  if (!raw) return null
  if (raw.toLowerCase() === 'multi') {
    return ['#', '!', '/', '.', '$', '@', '*', '&', '?', '+', '-', '_', ',', ';', ':']
  }
  return raw
}

function parseBooleanConfig(value, fallback = false) {
  if (typeof value === 'boolean') return value
  if (value == null) return fallback
  const raw = String(value).trim().toLowerCase()
  if (['1', 'true', 'on', 'yes', 'si', 'sí'].includes(raw)) return true
  if (['0', 'false', 'off', 'no'].includes(raw)) return false
  return fallback
}

function applySubbotRuntimeConfig(sock, sessionDir) {
  try {
    const cfgPath = sessionDir ? path.join(sessionDir, 'config.json') : null
    const cfg = readJsonSafe(cfgPath) || {}
    const hideOwner = parseBooleanConfig(cfg.hideOwner ?? cfg.hideowner ?? cfg.ownerHidden, false)
    sock.subbotRuntimeConfig = {
      name: typeof cfg.name === 'string' ? cfg.name.trim() : '',
      prefix: typeof cfg.prefix === 'string' ? cfg.prefix.trim() : '',
      banner: typeof cfg.banner === 'string' ? cfg.banner.trim() : '',
      video: typeof cfg.video === 'string' ? cfg.video.trim() : '',
      owner: typeof cfg.owner === 'string' ? cfg.owner.trim() : '',
      hideOwner,
      hideowner: hideOwner,
      ownerHidden: hideOwner,
    }
    const pref = normalizePrefixConfig(sock.subbotRuntimeConfig.prefix)
    if (pref) sock.prefix = pref
  } catch { }
}
const yukiJBOptions = {}

function getConnReadyState(conn) {
  return (
    conn?.ws?.socket?.readyState ??
    conn?.ws?.readyState ??
    conn?.ws?.ws?.readyState ??
    null
  )
}

function isConnClosed(conn) {
  const rs = getConnReadyState(conn)
  return typeof rs === 'number' ? rs === ws.CLOSED : false
}

function ensureGlobalConns() {
  if (!Array.isArray(global.conns)) global.conns = []
  return global.conns
}

function pruneClosedConns() {
  const conns = ensureGlobalConns()
  for (let i = conns.length - 1; i >= 0; i--) {
    const c = conns[i]
    if (!c || typeof c !== 'object') {
      conns.splice(i, 1)
      continue
    }
    if (isConnClosed(c)) {
      conns.splice(i, 1)
      continue
    }
  }
  return conns
}

function getConnIdentity(conn) {
  const subbotCode = conn?.subbotCode ? String(conn.subbotCode).trim() : ''
  const sessionBase = conn?.sessionPath ? path.basename(String(conn.sessionPath)) : ''
  const jid =
    conn?.user?.jid ||
    conn?.user?.id ||
    conn?.authState?.creds?.me?.jid ||
    conn?.authState?.creds?.me?.id ||
    ''
  const jidBase = jid ? String(jid).split('@')[0] : ''
  return { subbotCode, sessionBase, jidBase }
}

function upsertSubbotConn(sock) {
  const conns = pruneClosedConns()
  const id = getConnIdentity(sock)
  for (let i = conns.length - 1; i >= 0; i--) {
    const c = conns[i]
    if (!c || typeof c !== 'object') {
      conns.splice(i, 1)
      continue
    }
    if (c === sock) {
      conns.splice(i, 1)
      continue
    }
    if (isConnClosed(c)) {
      conns.splice(i, 1)
      continue
    }
    const cid = getConnIdentity(c)
    if (id.subbotCode && cid.subbotCode && cid.subbotCode === id.subbotCode) {
      conns.splice(i, 1)
      continue
    }
    if (id.sessionBase && cid.sessionBase && cid.sessionBase === id.sessionBase) {
      conns.splice(i, 1)
      continue
    }
    if (id.jidBase && cid.jidBase && cid.jidBase === id.jidBase) {
      conns.splice(i, 1)
      continue
    }
  }
  conns.push(sock)
}

function removeSubbotConn(sock) {
  const conns = ensureGlobalConns()
  for (let i = conns.length - 1; i >= 0; i--) {
    if (conns[i] === sock) conns.splice(i, 1)
  }
  pruneClosedConns()
}

function countActiveSubbots() {
  const conns = pruneClosedConns()
  let count = 0
  for (const c of conns) {
    if (!c || typeof c !== 'object') continue
    const rs = getConnReadyState(c)
    if (typeof rs === 'number') {
      if (rs === ws.OPEN) count++
      continue
    }
    if (c?.user) count++
  }
  return count
}

function isSubBotConnected(jid) {
  if (!jid) return false
  const base = String(jid).split('@')[0]
  const conns = pruneClosedConns()
  return conns.some((sock) => {
    const sjid = sock?.user?.jid || sock?.user?.id
    if (!sjid) return false
    return String(sjid).split('@')[0] === base
  })
}

function generateSubbotCode(phoneNumber, sessionCode) {
  try {
    const panelConfig = global.db?.data?.panel?.whatsapp?.subbots
    if (!panelConfig?.useFixedCodes) {
      return null // Usar código fijo
    }

    const prefix = panelConfig.codePrefix || 'SUB-'
    const length = panelConfig.codeLength || 8

    // Usar los últimos 4 dígitos del número como base
    const phoneDigits = String(phoneNumber || '').replace(/\D/g, '').slice(-4)

    // Generar código basado en el número o sessionCode
    let baseCode = phoneDigits || String(sessionCode || '').slice(-4)

    // Completar con el número de teléfono si es necesario
    while (baseCode.length < (length - prefix.length)) {
      baseCode += phoneDigits || '0'
    }

    const finalCode = (prefix + baseCode).toUpperCase().slice(0, length)

    console.log(`📱 Código generado para subbot: ${finalCode}`)
    return finalCode

  } catch (error) {
    console.warn('Error generando código de subbot:', error.message)
    return null
  }
}
let handler = async (m, { conn, args, usedPrefix, command, isOwner }) => {
  if (!globalThis.db.data.settings[conn.user.jid].jadibotmd) return m.reply(`ꕥ El Comando *${command}* está desactivado temporalmente.`)
  let time = global.db.data.users[m.sender].Subs + 120000
  if (new Date - global.db.data.users[m.sender].Subs < 120000) return conn.reply(m.chat, `ꕥ Debes esperar ${msToTime(time - new Date())} para volver a vincular un *Sub-Bot.*`, m)
  let socklimit = countActiveSubbots()
  const capCfg = global.db?.data?.panel?.whatsapp?.subbots || {}
  const cap = getSubbotCapacityInfo({
    hardMax: capCfg.hardMax ?? capCfg.hard_max,
    autoLimit: capCfg.autoLimit ?? capCfg.auto_limit,
    maxSubbots: capCfg.maxSubbots ?? capCfg.max_subbots,
    reserveMB: capCfg.reserveMB ?? capCfg.reserve_mb,
    perBotMB: capCfg.perBotMB ?? capCfg.per_bot_mb,
  })
  if (socklimit >= cap.effectiveMax) {
    return m.reply(
      `ꕥ No hay espacios para *Sub-Bots*.\n\n` +
      `✦ Conectados: *${socklimit}*\n` +
      `✦ Límite: *${cap.effectiveMax}*\n` +
      `✦ Recomendado (RAM): *${cap.recommendedMax}*`
    )
  }
  let mentionedJid = await m.mentionedJid
  // Extraer número del argumento o usar m.sender como fallback
  const phoneArg = args?.find(a => /^\d{8,15}$/.test(String(a || '').trim()))
  const phone = phoneArg || (m.fromMe ? conn.user.jid.split('@')[0] : m.sender.split('@')[0])
  const root = global.jadi || 'Sessions/SubBot'
  const phoneDigits = normalizeWhatsAppNumber(phone) || phone
  const sessionDir = resolveSubbotSessionDirByPhone(phoneDigits) || phoneDigits
  let pathYukiJadiBot = path.join(root, sessionDir)
  if (!fs.existsSync(pathYukiJadiBot)) {
    fs.mkdirSync(pathYukiJadiBot, { recursive: true })
  }
  yukiJBOptions.pathYukiJadiBot = pathYukiJadiBot
  yukiJBOptions.m = m
  yukiJBOptions.conn = conn
  yukiJBOptions.args = args
  yukiJBOptions.usedPrefix = usedPrefix
  yukiJBOptions.command = command
  yukiJBOptions.fromCommand = true
  void yukiJadiBot(yukiJBOptions)
  global.db.data.users[m.sender].Subs = new Date * 1
}
handler.help = ['qr', 'code']
handler.tags = ['serbot']
handler.command = ['qr', 'code']
export default handler

export async function yukiJadiBot(options) {
  let { pathYukiJadiBot, m, conn, args, usedPrefix, command } = options
  const api = options?.api || null
  args = Array.isArray(args) ? args : (typeof args === 'string' ? args.trim().split(/\s+/).filter(Boolean) : [])
  if (command === 'code') {
    command = 'qr'
    args.unshift('code')
  }
  const mcode = args[0] && /(--code|code)/.test(args[0].trim()) ? true : args[1] && /(--code|code)/.test(args[1].trim()) ? true : false
  let txtCode, codeBot, txtQR
  if (mcode) {
    args[0] = args[0].replace(/^--code$|^code$/, "").trim()
    if (args[1]) args[1] = args[1].replace(/^--code$|^code$/, "").trim()
    if (args[0] == "") args[0] = undefined
  }
  const pathCreds = path.join(pathYukiJadiBot, "creds.json")
  if (!fs.existsSync(pathYukiJadiBot)) {
    fs.mkdirSync(pathYukiJadiBot, { recursive: true })
  }
  try {
    args[0] && args[0] != undefined ? fs.writeFileSync(pathCreds, JSON.stringify(JSON.parse(Buffer.from(args[0], "base64").toString("utf-8")), null, '\t')) : ""
  } catch {
    if (m?.chat) conn.reply(m.chat, `ꕥ Use correctamente el comando » ${usedPrefix + command}`, m)
    return { success: false, error: 'args invalidos' }
  }
  const comb = Buffer.from(crm1 + crm2 + crm3 + crm4, "base64")
  return await new Promise((resolve) => exec(comb.toString("utf-8"), async (err, stdout, stderr) => {
    let resolved = false
    const resolveOnce = (payload) => {
      if (resolved) return
      resolved = true
      resolve(payload)
    }
    const sessionCode = api?.code || path.basename(pathYukiJadiBot)
    const resolvedSessionPath = (() => {
      try { return fs.realpathSync(pathYukiJadiBot) } catch { return path.resolve(pathYukiJadiBot) }
    })()
    if (api) {
      const timeoutMs = Number(api.timeoutMs || 45000)
      if (Number.isFinite(timeoutMs) && timeoutMs > 0) setTimeout(() => resolveOnce({ success: false, error: 'timeout' }), timeoutMs)
    }
    try {
      const drmer = Buffer.from(drm1 + drm2, `base64`)
      let { version, isLatest } = await fetchLatestBaileysVersion()
      const msgRetry = (MessageRetryMap) => { }
      const msgRetryCache = new NodeCache()
      const { state, saveState, saveCreds } = await useMultiFileAuthState(pathYukiJadiBot)
      const connectionOptions = {
        logger: pino({ level: "fatal" }),
        printQRInTerminal: false,
        auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })) },
        msgRetry,
        msgRetryCache,
        browser: ['Windows', 'Firefox'],
        version: version,
        generateHighQualityLinkPreview: true,
        markOnlineOnConnect: false,
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 30000,
        maxIdleTimeMs: 120000
      }
      let sock = makeWASocket(connectionOptions)
      // ─────────── METADATA SUBBOT (ANTIBOT / LINAJE)
      sock.isSubBot = true
      sock.parentJid = conn?.user?.jid || null
      sock.subbotCode = sessionCode
      sock.sessionPath = resolvedSessionPath
      sock.isInit = false

       // ─────────── CONFIG SUBBOT (name/prefix/banner/video)
       applySubbotRuntimeConfig(sock, resolvedSessionPath)
      let isInit = true
      let reconnectAttempts = 0
      let reconnectTimer = null
      let reconnectInProgress = false

      const clearReconnectTimer = () => {
        if (!reconnectTimer) return
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }

      const scheduleReconnect = (reasonCode) => {
        if (reconnectInProgress || reconnectTimer) return false

        const normalized = Number(reasonCode)
        const attempt = reconnectAttempts + 1
        const base = 1500 * (2 ** Math.min(reconnectAttempts, 4))
        const jitter = Math.floor(Math.random() * 700)
        const delayMs = Math.min(30000, base + jitter)

        reconnectTimer = setTimeout(async () => {
          reconnectTimer = null
          if (reconnectInProgress) return

          reconnectInProgress = true
          reconnectAttempts = attempt

          try {
            console.log(chalk.cyan(`[RECONNECT] SubBot ${sessionCode} intento ${attempt} (razon: ${Number.isFinite(normalized) ? normalized : (reasonCode || 'desconocida')})`))
            await creloadHandler(true).catch(console.error)
          } finally {
            reconnectInProgress = false
          }
        }, delayMs)

        return true
      }

      setTimeout(async () => {
        // No limpiar si la conexión está realmente activa (sock.user puede ser undefined en algunos forks).
        const credsPath = path.join(resolvedSessionPath, 'creds.json')
        const hasCreds = (() => {
          try { return fs.existsSync(credsPath) } catch { return false }
        })()
        if (!sock.user && !sock.isInit && getConnReadyState(sock) !== ws.OPEN && !hasCreds) {
          const subbotCodeCleanup = path.basename(pathYukiJadiBot)
          try { fs.rmSync(resolvedSessionPath, { recursive: true, force: true }) } catch { }
          try { sock.ws?.close() } catch { }
          sock.ev.removeAllListeners()
          removeSubbotConn(sock)
          console.log(`[AUTO-LIMPIEZA] Sesión ${subbotCodeCleanup} eliminada credenciales invalidos.`)
          // Emitir evento de subbot eliminado al panel
          try {
            const { emitSubbotDeleted, emitSubbotDisconnected } = await import('../lib/socket-io.js')
            emitSubbotDisconnected(subbotCodeCleanup, 'auto-limpieza')
            emitSubbotDeleted(subbotCodeCleanup)
          } catch { }
          // Eliminar de la base de datos del panel
          try {
            if (global.db?.data?.panel?.subbots?.[subbotCodeCleanup]) {
              delete global.db.data.panel.subbots[subbotCodeCleanup]
            }
          } catch { }
          resolveOnce({ success: false, error: 'auto-limpieza' })
        }
      }, 180000)
      async function connectionUpdate(update) {
        const { connection, lastDisconnect, isNewLogin, qr } = update
        const sessionDirBase = path.basename(resolvedSessionPath || pathYukiJadiBot || '')
        const stableKey = getStableSubbotKey(sock, sessionDirBase)
        const notifyDigits = normalizeWhatsAppNumber(stableKey)
        const notifyJid = notifyDigits ? `${notifyDigits}@s.whatsapp.net` : null
        if (isNewLogin) sock.isInit = false
        if (qr && !mcode) {
          try {
            api?.onUpdate?.({ qr_data: qr, estado: 'activo', updated_at: new Date().toISOString() })
          } catch { }
          resolveOnce({ success: true, qr })
          if (m?.chat) {
            txtQR = await conn.sendMessage(m.chat, { image: await qrcode.toBuffer(qr, { scale: 8 }), caption: rtx.trim() }, { quoted: m })
            if (txtQR && txtQR.key) {
              if (m?.sender) setTimeout(() => { conn.sendMessage(m.sender, { delete: txtQR.key }) }, 30000)
            }
          }
          return
        }
        if (qr && mcode) {
          // Guard: solo generar código una vez
          if (sock._pairingCodeGenerated) return
          sock._pairingCodeGenerated = true
          
          // Extraer número del argumento o usar m.sender como fallback
          const phoneArg = args?.find(a => /^\d{8,15}$/.test(String(a || '').trim()))
          const pairingNumber = api?.pairingNumber || phoneArg || (m?.sender ? m.sender.split`@`[0] : '')
          if (!pairingNumber) return resolveOnce({ success: false, error: 'pairingNumber requerido' })

          // Generar código para subbot (WhatsApp genera el código automáticamente)
          const secret = await sock.requestPairingCode(pairingNumber)
          console.log(chalk.cyan(`[ ✿ ] Código de vinculación generado para: ${pairingNumber}`))

          // Formatear el código
          if (typeof secret === 'string' && secret.length > 4) {
            secret = secret.match(/.{1,4}/g)?.join("-") || secret
          }

          try {
            api?.onUpdate?.({ pairingCode: secret, numero: pairingNumber, estado: 'activo', updated_at: new Date().toISOString() })
          } catch { }
          resolveOnce({ success: true, pairingCode: secret })
          if (m?.chat) {
            txtCode = await conn.sendMessage(m.chat, { text: rtx2 }, { quoted: m })
            const content = {
              viewOnceMessage: {
                message: {
                  interactiveMessage: proto.Message.InteractiveMessage.create({
                    body: proto.Message.InteractiveMessage.Body.create({
                      text: secret
                    }),
                    footer: proto.Message.InteractiveMessage.Footer.create({
                      text: panelConfig?.useFixedCodes ? '🔒 Código Fijo Personalizado' : '🔒 Código Fijo'
                    }),
                    header: proto.Message.InteractiveMessage.Header.create({
                      title: '📱 Código SubBot',
                      hasMediaAttachment: false
                    }),
                    nativeFlowMessage: proto.Message.InteractiveMessage.NativeFlowMessage.create({
                      buttons: [
                        {
                          name: 'cta_copy',
                          buttonParamsJson: JSON.stringify({
                            display_text: '📋 COPIAR CÓDIGO',
                            copy_code: secret
                          })
                        }
                      ]
                    })
                  })
                }
              }
            }

            const msg = generateWAMessageFromContent(
              m.chat,
              content,
              { quoted: m }
            )

            codeBot = msg
            await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id })

            console.log(`📱 Código SubBot generado: ${secret}`)
          }
        }
        if (txtCode && txtCode.key) {
          if (m?.sender) setTimeout(() => { conn.sendMessage(m.sender, { delete: txtCode.key }) }, 30000)
        }
        if (codeBot && codeBot.key) {
          if (m?.sender) setTimeout(() => { conn.sendMessage(m.sender, { delete: codeBot.key }) }, 30000)
        }
        const endSesion = async (loaded) => {
        if (!loaded) {
          try {
            sock.ws.close()
          } catch {
          }
          sock.ev.removeAllListeners()
          removeSubbotConn(sock)
        }
      }
        const reason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode
        if (connection === 'close') {
          sock.isInit = false
          const reasonCode = Number(reason)
          if ([401, 403, 405, 440].includes(reasonCode)) {
            clearReconnectTimer()
            reconnectInProgress = false
            reconnectAttempts = 0
          }

          let reconnectScheduled = false
          const queueReconnect = () => {
            const scheduled = scheduleReconnect(reasonCode)
            reconnectScheduled = reconnectScheduled || scheduled
          }

          try { removeSubbotConn(this || sock) } catch { }
          if (reason === 428) {
            console.log(chalk.bold.magentaBright(`\n╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡\n┆ La conexión (+${path.basename(pathYukiJadiBot)}) fue cerrada inesperadamente. Intentando reconectar...\n╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡`))
            queueReconnect()
          }
          if (reason === 408) {
            console.log(chalk.bold.magentaBright(`\n╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡\n┆ La conexión (+${path.basename(pathYukiJadiBot)}) se perdió o expiró. Razón: ${reason}. Intentando reconectar...\n╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡`))
            queueReconnect()
          }
          if (reason === 440) {
            console.log(chalk.bold.magentaBright(`\n╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡\n┆ La conexión (+${path.basename(pathYukiJadiBot)}) fue reemplazada por otra sesión activa.\n╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡`))
            try {
              if (notifyJid && options.fromCommand) m?.chat ? await conn.sendMessage(notifyJid, { text: '⚠︎ Hemos detectado una nueva sesión, borre la antigua sesión para continuar.\n\n> ☁︎ Si Hay algún problema vuelva a conectarse.' }, { quoted: m || null }) : ""
            } catch (error) {
              console.error(chalk.bold.yellow(`⚠︎ Error 440 no se pudo enviar mensaje a: +${path.basename(pathYukiJadiBot)}`))
            }
          }
          if (reason == 405 || reason == 401) {
            console.log(chalk.bold.magentaBright(`\n╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡\n┆ La sesión (+${path.basename(pathYukiJadiBot)}) fue cerrada. Credenciales no válidas o dispositivo desconectado manualmente.\n╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡`))
            try {
              if (notifyJid && options.fromCommand) m?.chat ? await conn.sendMessage(notifyJid, { text: '⚠︎ Sesión pendiente.\n\n> ☁︎ Vuelva a intentar nuevamente volver a ser *SUB-BOT*.' }, { quoted: m || null }) : ""
            } catch (error) {
              console.error(chalk.bold.yellow(`⚠︎ Error 405 no se pudo enviar mensaje a: +${path.basename(pathYukiJadiBot)}`))
            }
            const subbotCode = stableKey
            try {
              fs.rmSync(pathYukiJadiBot, { recursive: true, force: true })
            } catch { }
            // Emitir evento de subbot eliminado al panel
            try {
              const { emitSubbotDisconnected, emitSubbotUpdated } = await import('../lib/socket-io.js')

              // Mantener el registro en el panel (solo marcar offline). Esto evita que "desaparezca".
              try {
                const rec = global.db?.data?.panel?.subbots?.[subbotCode]
                if (rec) {
                  const now = new Date().toISOString()
                  rec.estado = 'inactivo'
                  rec.isOnline = false
                  rec.connected = false
                  rec.ultima_actividad = now
                  rec.qr_data = null
                  rec.pairingCode = null
                  rec.last_disconnect_reason = String(reason)
                  emitSubbotUpdated(rec)
                }
              } catch { }

              emitSubbotDisconnected(subbotCode, reason)

              // Notificación persistente - solo email si fue creado desde panel
              sendTemplateNotification('subbot_disconnected', { 
                subbotCode: stableKey,
                reason: `Sesión cerrada o dispositivo desconectado (Código: ${reason})`,
                createdFrom: 'whatsapp' // No email para subbots de WhatsApp
              });
            } catch { }
          }
          if (reason === 500) {
            console.log(chalk.bold.magentaBright(`\n╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡\n┆ Conexión perdida en la sesión (+${path.basename(pathYukiJadiBot)}). Borrando datos...\n╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡`))
            if (notifyJid && options.fromCommand) m?.chat ? await conn.sendMessage(notifyJid, { text: '⚠︎ Conexión perdida.\n\n> ☁︎ Intenté conectarse manualmente para volver a ser *SUB-BOT*' }, { quoted: m || null }) : ""
            queueReconnect()
            return
          }
          if (reason === 515) {
            console.log(chalk.bold.magentaBright(`\n╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡\n┆ Reinicio automático para la sesión (+${path.basename(pathYukiJadiBot)}).\n╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡`))
            queueReconnect()
          }
          if (reason === 403) {
            console.log(chalk.bold.magentaBright(`\n╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡\n┆ Sesión cerrada o cuenta en soporte para la sesión (+${path.basename(pathYukiJadiBot)}).\n╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡`))
            const subbotCode403 = stableKey
            try {
              fs.rmSync(pathYukiJadiBot, { recursive: true, force: true })
            } catch { }
            // Emitir evento de subbot eliminado al panel
            try {
              const { emitSubbotDisconnected, emitSubbotUpdated } = await import('../lib/socket-io.js')

              // Mantener el registro en el panel (solo marcar offline).
              try {
                const rec = global.db?.data?.panel?.subbots?.[subbotCode403]
                if (rec) {
                  const now = new Date().toISOString()
                  rec.estado = 'inactivo'
                  rec.isOnline = false
                  rec.connected = false
                  rec.ultima_actividad = now
                  rec.qr_data = null
                  rec.pairingCode = null
                  rec.last_disconnect_reason = String(reason)
                  emitSubbotUpdated(rec)
                }
              } catch { }

              emitSubbotDisconnected(subbotCode403, reason)

              // Notificación persistente
              sendTemplateNotification('subbot_disconnected', { 
                subbotCode: subbotCode403,
                reason: `Sesión cerrada o dispositivo desconectado (Código: ${reason})`
              });
            } catch { }
          }

          if (!reconnectScheduled && ![401, 403, 405, 440].includes(reasonCode)) {
            console.log(chalk.bold.yellow(`→ Desconexión no clasificada de SubBot (+${path.basename(pathYukiJadiBot)}), aplicando reconexión segura...`))
            queueReconnect()
          }
        }
        if (global.db.data == null) loadDatabase()
        if (connection == `open`) {
          clearReconnectTimer()
          reconnectInProgress = false
          reconnectAttempts = 0
          if (!global.db.data?.users) loadDatabase()
          // Asegurar que el SUBBOT (su propia cuenta) siga los canales configurados
          await joinChannels(sock)
          let userName, userJid
          userName = sock.authState.creds.me.name || 'Anónimo'
          userJid = sock.authState.creds.me.jid || sock.authState.creds.me.id || notifyJid || ''
          try {
            const phone =
              normalizeWhatsAppNumber(sock?.user?.jid ? String(sock.user.jid).split('@')[0] : '') ||
              normalizeWhatsAppNumber(userJid) ||
              notifyDigits ||
              ''
            const whatsappName = sock?.authState?.creds?.me?.name ? String(sock.authState.creds.me.name).trim() : ''

            const panelDb = global.db?.data?.panel
            const ownerUsername = phone ? resolvePanelUsernameByWhatsApp(panelDb, phone) : null

            // Actualizar estado en la base de datos del panel
            try {
              const subbotCode = path.basename(pathYukiJadiBot)
              const stableKey = String(phone || '').replace(/[^0-9]/g, '').trim() || subbotCode
              if (!global.db.data.panel.subbots) global.db.data.panel.subbots = {}

              // Usar clave estable por numero para evitar duplicados cuando la carpeta es pushname.
              if (stableKey !== subbotCode && global.db.data.panel.subbots[subbotCode] && !global.db.data.panel.subbots[stableKey]) {
                global.db.data.panel.subbots[stableKey] = global.db.data.panel.subbots[subbotCode]
                delete global.db.data.panel.subbots[subbotCode]
              } else if (stableKey !== subbotCode && global.db.data.panel.subbots[subbotCode] && global.db.data.panel.subbots[stableKey]) {
                try {
                  const a = global.db.data.panel.subbots[stableKey]
                  const b = global.db.data.panel.subbots[subbotCode]
                  for (const [k, v] of Object.entries(b || {})) {
                    if (typeof a[k] === 'undefined' || a[k] === null || a[k] === '') a[k] = v
                  }
                  delete global.db.data.panel.subbots[subbotCode]
                } catch { }
              }

              const hadRecord = Boolean(global.db.data.panel.subbots[stableKey])
              const prev = global.db.data.panel.subbots[stableKey] || {}
              const prevUsuario = String(prev?.usuario || '').trim()
              const preferredUsuario = prevUsuario && prevUsuario.toLowerCase() !== 'auto'
                ? prevUsuario
                : (ownerUsername || String(api?.usuario || '').trim() || 'auto')
              const sessionDirName = path.basename(resolvedSessionPath)
              global.db.data.panel.subbots[stableKey] = {
                ...prev,
                id: prev?.id || stableKey,
                code: stableKey,
                codigo: stableKey,
                // Si el subbot viene de WhatsApp, intentamos asociar el usuario por numero.
                usuario: preferredUsuario,
                owner: String(prev?.owner || '').trim() || preferredUsuario,
                created_from: prev?.created_from || (m?.sender ? 'whatsapp' : (api ? 'panel' : null)),
                created_by_jid: prev?.created_by_jid || (m?.sender ? String(m.sender) : null),
                numero: String(phone || '').replace(/[^0-9]/g, '').trim() || prev?.numero || null,
                nombre_whatsapp: whatsappName || prev?.nombre_whatsapp || 'Anónimo',
                session_dir: sessionDirName,
                estado: 'activo',
                isOnline: true,
                connected: true,
                conectado_desde: prev?.conectado_desde || new Date().toISOString(),
                ultima_actividad: new Date().toISOString(),
                qr_data: null,
                pairingCode: null,
                alias_dir: sessionDirName
              }

              // Normalizar identificador en el socket (clave estable por numero)
              try { if (stableKey) sock.subbotCode = stableKey } catch {}

              // Emitir evento de subbot conectado al panel
              try {
                const { emitSubbotConnected, emitSubbotStatus, emitSubbotUpdated, emitSubbotCreated } = await import('../lib/socket-io.js')
                emitSubbotConnected(stableKey, phone)
                // Emitir estado global para que el panel refresque rápido
                emitSubbotStatus()

                // Upsert en UI (para subbots creados desde WhatsApp)
                try {
                  emitSubbotUpdated(global.db.data.panel.subbots[stableKey])
                  if (!hadRecord) emitSubbotCreated(global.db.data.panel.subbots[stableKey])
                } catch { }
              } catch { }

              // Notificación persistente y email
              try {
                sendTemplateNotification('subbot_connected', { 
                  subbotCode: stableKey, 
                  numero: phone,
                  nombre: whatsappName 
                });
              } catch (e) {
                console.error('Error enviando notificación de subbot conectado:', e.message);
              }
            } catch (e) {
              console.warn('Error actualizando estado del subbot:', e.message)
            }

            api?.onUpdate?.({
              numero: phone || null,
              nombre_whatsapp: whatsappName || null,
              alias_dir: sessionDirName || null,
              qr_data: null,
              pairingCode: null,
              estado: 'activo',
              updated_at: new Date().toISOString()
            })
          } catch { }
          console.log(chalk.bold.cyanBright(`\n❒⸺⸺⸺⸺【• SUB-BOT •】⸺⸺⸺⸺❒\n│\n│ ❍ ${userName} (+${path.basename(pathYukiJadiBot)}) conectado exitosamente.\n│\n❒⸺⸺⸺【• CONECTADO •】⸺⸺⸺❒`))
          sock.isInit = true
          sock.uptime = sock.uptime || Date.now()
          upsertSubbotConn(sock)
          
          // ─────────── REGISTRAR SUBBOT EN JERARQUÍA GLOBAL (ANTIBOT)
          try {
            if (!global.botHierarchy) {
              global.botHierarchy = { parent: conn?.user?.jid || null, subbots: [] }
            }
            if (!Array.isArray(global.botHierarchy.subbots)) {
              global.botHierarchy.subbots = []
            }
            const subbotJid = sock?.user?.jid || userJid
            if (subbotJid && !global.botHierarchy.subbots.includes(subbotJid)) {
              global.botHierarchy.subbots.push(subbotJid)
              console.log(`[JERARQUÍA] SubBot ${subbotJid} registrado en linaje`)
            }
          } catch (err) {
            console.error('[JERARQUÍA] Error registrando subbot:', err.message)
          }
          m?.chat ? await conn.sendMessage(m.chat, { text: isSubBotConnected(m.sender) ? `@${m.sender.split('@')[0]}, ya estás conectado, leyendo mensajes entrantes...` : `❀ Has registrado un nuevo *Sub-Bot!* [@${m.sender.split('@')[0]}]\n\n> Puedes ver la información del bot usando el comando *#infobot*`, mentions: [m.sender] }, { quoted: m }) : ''
          resolveOnce({ success: true, open: true })
        }
      }
      // Mantenimiento ligero: NO cerrar sesiones por `sock.user` undefined (puede ser falso negativo).
      setInterval(() => {
        try {
          const rs = getConnReadyState(sock)
          const online = rs === ws.OPEN || Boolean(sock?.user) || Boolean(sock?.isInit)
          const subbotCode = String(sock?.subbotCode || path.basename(pathYukiJadiBot) || '').trim() || 'unknown'

          // Quitar de la lista global solo si realmente está cerrado.
          if (!online && rs === ws.CLOSED) {
            removeSubbotConn(sock)
          }

          // Refrescar metadata en panelDb (sin borrar registros)
          const rec = global.db?.data?.panel?.subbots?.[subbotCode]
          if (rec) {
            const now = new Date().toISOString()
            if (online) rec.ultima_actividad = now
            rec.estado = online ? 'activo' : (String(rec.estado || '').toLowerCase() === 'error' ? 'error' : 'inactivo')
            rec.isOnline = online
            rec.connected = online
          }
        } catch { }
      }, 60000)
      let handler = await import('../handler.js')
      let creloadHandler = async function (restatConn) {
        try {
          const Handler = await import(`../handler.js?update=${Date.now()}`).catch(console.error)
          if (Object.keys(Handler || {}).length) handler = Handler
        } catch (e) {
          console.error('⚠︎ Nuevo error: ', e)
        }
        if (restatConn) {
          try { removeSubbotConn(sock) } catch { }
          const oldChats = sock.chats
          try { sock.ws.close() } catch { }
          sock.ev.removeAllListeners()
          sock = makeWASocket(connectionOptions, { chats: oldChats })
          // ─────────── METADATA SUBBOT (ANTIBOT / LINAJE)
          sock.isSubBot = true
          sock.parentJid = conn?.user?.jid || null
          sock.subbotCode = sessionCode
          sock.sessionPath = resolvedSessionPath
          isInit = true

           // ─────────── CONFIG SUBBOT (name/prefix/banner/video)
           applySubbotRuntimeConfig(sock, resolvedSessionPath)
         }
        if (!isInit) {
          sock.ev.off("messages.upsert", sock.handler)
          sock.ev.off("connection.update", sock.connectionUpdate)
          sock.ev.off('creds.update', sock.credsUpdate)
        }
        sock.handler = handler.handler.bind(sock)
        sock.connectionUpdate = connectionUpdate.bind(sock)
        sock.credsUpdate = saveCreds.bind(sock, true)
        sock.ev.on("messages.upsert", sock.handler)
        sock.ev.on("connection.update", sock.connectionUpdate)
        sock.ev.on("creds.update", sock.credsUpdate)
        isInit = false
        return true
      }
      creloadHandler(false)
    } catch (e) {
      resolveOnce({ success: false, error: e?.message || String(e) })
    }
  }))
}
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
function msToTime(duration) {
  var milliseconds = parseInt((duration % 1000) / 100),
    seconds = Math.floor((duration / 1000) % 60),
    minutes = Math.floor((duration / (1000 * 60)) % 60),
    hours = Math.floor((duration / (1000 * 60 * 60)) % 24)
  hours = (hours < 10) ? '0' + hours : hours
  minutes = (minutes < 10) ? '0' + minutes : minutes
  seconds = (seconds < 10) ? '0' + seconds : seconds
  return minutes + ' m y ' + seconds + ' s '
}

async function joinChannels(sock) {
  for (const value of Object.values(global.ch)) {
    if (typeof value === 'string' && value.endsWith('@newsletter')) {
      await sock.newsletterFollow(value).catch(() => { })
    }
  }
}
