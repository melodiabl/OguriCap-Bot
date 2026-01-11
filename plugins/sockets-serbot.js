import baileys from "@whiskeysockets/baileys"

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
import { fileURLToPath } from 'url'
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
const yukiJBOptions = {}
if (global.conns instanceof Array) console.log()
else global.conns = []
function isSubBotConnected(jid) { return global.conns.some(sock => sock?.user?.jid && sock.user.jid.split("@")[0] === jid.split("@")[0]) }
function sanitizeSessionAliasName(input) {
  const raw = String(input || '').trim()
  if (!raw) return ''
  try {
    const normalized = raw.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    return normalized
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48)
  } catch {
    return raw
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 48)
  }
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
  let socklimit = global.conns.filter(sock => sock?.user).length
  if (socklimit >= 50) {
    return m.reply(`ꕥ No se han encontrado espacios para *Sub-Bots* disponibles.`)
  }
  let mentionedJid = await m.mentionedJid
  let who = mentionedJid && mentionedJid[0] ? mentionedJid[0] : m.fromMe ? conn.user.jid : m.sender
  let id = `${who.split`@`[0]}`
  let pathYukiJadiBot = path.join(global.jadi || 'Sessions/SubBot', id)
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
    const resolvedSessionPath = path.resolve(pathYukiJadiBot)
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
        generateHighQualityLinkPreview: true
      }
      let sock = makeWASocket(connectionOptions)
      // ─────────── METADATA SUBBOT (ANTIBOT / LINAJE)
      sock.isSubBot = true
      sock.parentJid = conn?.user?.jid || null
      sock.subbotCode = sessionCode
      sock.sessionPath = resolvedSessionPath
      sock.isInit = false
      let isInit = true
      setTimeout(async () => {
        if (!sock.user) {
          const subbotCodeCleanup = path.basename(pathYukiJadiBot)
          try { fs.rmSync(resolvedSessionPath, { recursive: true, force: true }) } catch { }
          try { sock.ws?.close() } catch { }
          sock.ev.removeAllListeners()
          let i = global.conns.indexOf(sock)
          if (i >= 0) global.conns.splice(i, 1)
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
      }, 60000)
      async function connectionUpdate(update) {
        const { connection, lastDisconnect, isNewLogin, qr } = update
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
          const pairingNumber = api?.pairingNumber || (m?.sender ? m.sender.split`@`[0] : '')
          if (!pairingNumber) return resolveOnce({ success: false, error: 'pairingNumber requerido' })

          // Generar código para subbot
          let secret
          const panelConfig = global.db?.data?.panel?.whatsapp?.subbots

          if (panelConfig?.useFixedCodes) {
            // Usar código fijo personalizado para subbots
            const customCode = generateSubbotCode(pairingNumber, sessionCode)
            if (customCode) {
              secret = await sock.requestPairingCode(pairingNumber, customCode)
              console.log(chalk.cyan(`[ ✿ ] SubBot usando código fijo: ${customCode}`))
            } else {
              secret = await sock.requestPairingCode(pairingNumber)
              console.log(chalk.yellow('[ ⚠ ] SubBot usando código fijo (fallback)'))
            }
          } else {
            // Usar código fijo para subbots
            secret = await sock.requestPairingCode(pairingNumber)
            console.log(chalk.cyan('[ ✿ ] SubBot usando código fijo'))
          }

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
            let i = global.conns.indexOf(sock)
            if (i < 0) return
            delete global.conns[i]
            global.conns.splice(i, 1)
          }
        }
        const reason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode
        if (connection === 'close') {
          if (reason === 428) {
            console.log(chalk.bold.magentaBright(`\n╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡\n┆ La conexión (+${path.basename(pathYukiJadiBot)}) fue cerrada inesperadamente. Intentando reconectar...\n╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡`))
            await creloadHandler(true).catch(console.error)
          }
          if (reason === 408) {
            console.log(chalk.bold.magentaBright(`\n╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡\n┆ La conexión (+${path.basename(pathYukiJadiBot)}) se perdió o expiró. Razón: ${reason}. Intentando reconectar...\n╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡`))
            await creloadHandler(true).catch(console.error)
          }
          if (reason === 440) {
            console.log(chalk.bold.magentaBright(`\n╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡\n┆ La conexión (+${path.basename(pathYukiJadiBot)}) fue reemplazada por otra sesión activa.\n╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡`))
            try {
              if (options.fromCommand) m?.chat ? await conn.sendMessage(`${path.basename(pathYukiJadiBot)}@s.whatsapp.net`, { text: '⚠︎ Hemos detectado una nueva sesión, borre la antigua sesión para continuar.\n\n> ☁︎ Si Hay algún problema vuelva a conectarse.' }, { quoted: m || null }) : ""
            } catch (error) {
              console.error(chalk.bold.yellow(`⚠︎ Error 440 no se pudo enviar mensaje a: +${path.basename(pathYukiJadiBot)}`))
            }
          }
          if (reason == 405 || reason == 401) {
            console.log(chalk.bold.magentaBright(`\n╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡\n┆ La sesión (+${path.basename(pathYukiJadiBot)}) fue cerrada. Credenciales no válidas o dispositivo desconectado manualmente.\n╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡`))
            try {
              if (options.fromCommand) m?.chat ? await conn.sendMessage(`${path.basename(pathYukiJadiBot)}@s.whatsapp.net`, { text: '⚠︎ Sesión pendiente.\n\n> ☁︎ Vuelva a intentar nuevamente volver a ser *SUB-BOT*.' }, { quoted: m || null }) : ""
            } catch (error) {
              console.error(chalk.bold.yellow(`⚠︎ Error 405 no se pudo enviar mensaje a: +${path.basename(pathYukiJadiBot)}`))
            }
            const subbotCode = path.basename(pathYukiJadiBot)
            try {
              if (sock?.sessionAliasPath) fs.rmSync(sock.sessionAliasPath, { recursive: false, force: true })
              if (sock?.phoneAliasPath) fs.rmSync(sock.phoneAliasPath, { recursive: false, force: true })
            } catch { }
            fs.rmdirSync(pathYukiJadiBot, { recursive: true })
            // Emitir evento de subbot eliminado al panel
            try {
              const { emitSubbotDeleted, emitSubbotDisconnected } = await import('../lib/socket-io.js')
              emitSubbotDisconnected(subbotCode, reason)
              emitSubbotDeleted(subbotCode)
            } catch { }
            // Eliminar de la base de datos del panel
            try {
              if (global.db?.data?.panel?.subbots?.[subbotCode]) {
                delete global.db.data.panel.subbots[subbotCode]
              }
            } catch { }
          }
          if (reason === 500) {
            console.log(chalk.bold.magentaBright(`\n╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡\n┆ Conexión perdida en la sesión (+${path.basename(pathYukiJadiBot)}). Borrando datos...\n╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡`))
            if (options.fromCommand) m?.chat ? await conn.sendMessage(`${path.basename(pathYukiJadiBot)}@s.whatsapp.net`, { text: '⚠︎ Conexión perdida.\n\n> ☁︎ Intenté conectarse manualmente para volver a ser *SUB-BOT*' }, { quoted: m || null }) : ""
            return creloadHandler(true).catch(console.error)
          }
          if (reason === 515) {
            console.log(chalk.bold.magentaBright(`\n╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡\n┆ Reinicio automático para la sesión (+${path.basename(pathYukiJadiBot)}).\n╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡`))
            await creloadHandler(true).catch(console.error)
          }
          if (reason === 403) {
            console.log(chalk.bold.magentaBright(`\n╭┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡\n┆ Sesión cerrada o cuenta en soporte para la sesión (+${path.basename(pathYukiJadiBot)}).\n╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄ • • • ┄┄┄┄┄┄┄┄┄┄┄┄┄┄⟡`))
            const subbotCode403 = path.basename(pathYukiJadiBot)
            try {
              if (sock?.sessionAliasPath) fs.rmSync(sock.sessionAliasPath, { recursive: false, force: true })
              if (sock?.phoneAliasPath) fs.rmSync(sock.phoneAliasPath, { recursive: false, force: true })
            } catch { }
            fs.rmdirSync(pathYukiJadiBot, { recursive: true })
            // Emitir evento de subbot eliminado al panel
            try {
              const { emitSubbotDeleted, emitSubbotDisconnected } = await import('../lib/socket-io.js')
              emitSubbotDisconnected(subbotCode403, reason)
              emitSubbotDeleted(subbotCode403)
            } catch { }
            // Eliminar de la base de datos del panel
            try {
              if (global.db?.data?.panel?.subbots?.[subbotCode403]) {
                delete global.db.data.panel.subbots[subbotCode403]
              }
            } catch { }
          }
        }
        if (global.db.data == null) loadDatabase()
        if (connection == `open`) {
          if (!global.db.data?.users) loadDatabase()
          await joinChannels(conn)
          let userName, userJid
          userName = sock.authState.creds.me.name || 'Anónimo'
          userJid = sock.authState.creds.me.jid || `${path.basename(pathYukiJadiBot)}@s.whatsapp.net`
          try {
            const phone = sock?.user?.jid ? String(sock.user.jid).split('@')[0] : String(userJid).split('@')[0]
            const whatsappName = sock?.authState?.creds?.me?.name ? String(sock.authState.creds.me.name).trim() : ''

            // Actualizar estado en la base de datos del panel
            try {
              const subbotCode = path.basename(pathYukiJadiBot)
              if (!global.db.data.panel.subbots) global.db.data.panel.subbots = {}

              const prev = global.db.data.panel.subbots[subbotCode] || {}
              global.db.data.panel.subbots[subbotCode] = {
                ...prev,
                id: prev?.id || subbotCode,
                code: prev?.code || subbotCode,
                codigo: prev?.codigo || subbotCode,
                numero: phone || prev?.numero || null,
                nombre_whatsapp: whatsappName || prev?.nombre_whatsapp || 'Anónimo',
                estado: 'activo',
                isOnline: true,
                connected: true,
                conectado_desde: prev?.conectado_desde || new Date().toISOString(),
                ultima_actividad: new Date().toISOString(),
                qr_data: null,
                pairingCode: null,
                alias_dir: prev?.alias_dir || null
              }

              // Emitir evento de subbot conectado al panel
              try {
                const { emitSubbotConnected, emitSubbotStatus } = await import('../lib/socket-io.js')
                emitSubbotConnected(subbotCode, phone)
                // Emitir estado global para que el panel refresque rápido
                emitSubbotStatus()
              } catch { }
            } catch (e) {
              console.warn('Error actualizando estado del subbot:', e.message)
            }

            // Si el subbot fue creado desde el panel (code sb_*), crear un alias de carpeta con el nombre (fallback: número):
            // Sessions/SubBot/<nombre_o_numero> -> Sessions/SubBot/<codigo>
            try {
              const shouldAlias = Boolean(api?.code && /^sb_/.test(String(api.code)))
              if (shouldAlias) {
                const root = path.resolve(global.jadi || 'Sessions/SubBot')
                const targetPath = resolvedSessionPath
                const baseFromName = whatsappName ? sanitizeSessionAliasName(whatsappName) : ''
                const base = baseFromName || String(phone || sessionCode)
                const targetReal = fs.realpathSync(targetPath)

                let aliasDir = null
                const candidates = [
                  base,
                  baseFromName && phone ? `${baseFromName}_${phone}` : null,
                  phone ? `${base}_${phone}` : null,
                  `${base}_${sessionCode}`,
                ].filter(Boolean)

                for (const cand of candidates) {
                  const aliasPath = path.join(root, String(cand))
                  if (fs.existsSync(aliasPath)) {
                    try {
                      const st = fs.lstatSync(aliasPath)
                      if (st.isSymbolicLink()) {
                        const real = fs.realpathSync(aliasPath)
                        if (real === targetReal) {
                          sock.sessionAliasPath = aliasPath
                          aliasDir = String(cand)
                          break
                        }
                      }
                    } catch { }
                    continue
                  }
                  try {
                    fs.symlinkSync(targetPath, aliasPath, process.platform === 'win32' ? 'junction' : 'dir')
                    sock.sessionAliasPath = aliasPath
                    aliasDir = String(cand)
                    break
                  } catch { }
                }

                if (aliasDir) {
                  sock.sessionAliasDir = aliasDir
                  // Actualizar alias en la base de datos
                  try {
                    const subbotCode = path.basename(pathYukiJadiBot)
                    if (global.db.data.panel.subbots[subbotCode]) {
                      global.db.data.panel.subbots[subbotCode].alias_dir = aliasDir
                    }
                  } catch { }
                }
              }
            } catch { }
            api?.onUpdate?.({
              numero: phone || null,
              nombre_whatsapp: whatsappName || null,
              alias_dir: sock?.sessionAliasDir || null,
              qr_data: null,
              pairingCode: null,
              estado: 'activo',
              updated_at: new Date().toISOString()
            })
          } catch { }
          console.log(chalk.bold.cyanBright(`\n❒⸺⸺⸺⸺【• SUB-BOT •】⸺⸺⸺⸺❒\n│\n│ ❍ ${userName} (+${path.basename(pathYukiJadiBot)}) conectado exitosamente.\n│\n❒⸺⸺⸺【• CONECTADO •】⸺⸺⸺❒`))
          sock.isInit = true
          global.conns.push(sock)
          
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
      setInterval(async () => {
        if (!sock.user) {
          const subbotCodeInterval = sock?.subbotCode || 'unknown'
          try { sock.ws.close() } catch (e) { }
          sock.ev.removeAllListeners()
          let i = global.conns.indexOf(sock)
          if (i < 0) return
          delete global.conns[i]
          global.conns.splice(i, 1)
          // Emitir evento de subbot eliminado al panel
          try {
            const { emitSubbotDeleted, emitSubbotDisconnected } = await import('../lib/socket-io.js')
            emitSubbotDisconnected(subbotCodeInterval, 'interval-cleanup')
            emitSubbotDeleted(subbotCodeInterval)
          } catch { }
          // Eliminar de la base de datos del panel
          try {
            if (global.db?.data?.panel?.subbots?.[subbotCodeInterval]) {
              delete global.db.data.panel.subbots[subbotCodeInterval]
            }
          } catch { }
        } else {
          // Actualizar última actividad si el subbot está activo
          try {
            const subbotCode = path.basename(pathYukiJadiBot)
            if (global.db?.data?.panel?.subbots?.[subbotCode]) {
              global.db.data.panel.subbots[subbotCode].ultima_actividad = new Date().toISOString()
              global.db.data.panel.subbots[subbotCode].estado = 'activo'
            }
          } catch { }
        }
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

