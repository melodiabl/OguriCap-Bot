import { smsg } from "./lib/simple.js"
import { format } from "util"
import { fileURLToPath } from "url"
import path, { join } from "path"
import fs, { unwatchFile, watchFile } from "fs"
import chalk from "chalk"
import fetch from "node-fetch"
import ws from "ws"

const { proto } = (await import("@whiskeysockets/baileys")).default
const isNumber = x => typeof x === "number" && !isNaN(x)
const delay = ms => isNumber(ms) && new Promise(resolve => setTimeout(function () {
  clearTimeout(this)
  resolve()
}, ms))
// Moved outside handler for better performance
const strRegex = (str) => str.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&")
const getDayKey = (d = new Date()) => new Date(d).toISOString().slice(0, 10)

export async function handler(chatUpdate) {
  this.msgqueque = this.msgqueque || []
  this.uptime = this.uptime || Date.now()
  if (!chatUpdate) return
  this.pushMessage(chatUpdate.messages).catch(console.error)
  let m = chatUpdate.messages[chatUpdate.messages.length - 1]
  if (!m) return
  if (global.db.data == null) await global.loadDatabase()
  try {
    m = smsg(this, m) || m
    if (!m) return
    m.exp = 0

    // Compatibilidad LID: algunos usuarios llegan como `@lid` (en especial en grupos).
    // Esto rompe permisos/lookup de usuario y hace que "el remitente" no pueda usar botones/comandos.
    try {
      const rawSender = typeof m.sender === 'string' ? m.sender : ''
      if (
        rawSender &&
        rawSender.endsWith('@lid') &&
        m.isGroup &&
        typeof String.prototype.resolveLidToRealJid === 'function'
      ) {
        const resolved = await String.prototype.resolveLidToRealJid.call(rawSender, m.chat, this, 1, 2000)
        if (typeof resolved === 'string' && resolved && !resolved.endsWith('@lid')) {
          Object.defineProperty(m, 'sender', {
            value: resolved,
            writable: true,
            enumerable: true,
            configurable: true,
          })
          try {
            if (m?.key && typeof m.key === 'object') {
              if (typeof m.key.participant === 'string' && m.key.participant.endsWith('@lid')) {
                m.key.participant = resolved
              }
              if (typeof m.key.remoteJid === 'string' && m.key.remoteJid.endsWith('@lid')) {
                m.key.remoteJid = resolved
              }
            }
          } catch { }
        }
      }
    } catch { }
    try {
      let user = global.db.data.users[m.sender]
      if (typeof user !== "object") global.db.data.users[m.sender] = {}
      if (user) {
        if (!("name" in user)) user.name = m.name
        if (!("exp" in user) || !isNumber(user.exp)) user.exp = 0
        if (!("coin" in user) || !isNumber(user.coin)) user.coin = 0
        if (!("bank" in user) || !isNumber(user.bank)) user.bank = 0
        if (!("level" in user) || !isNumber(user.level)) user.level = 0
        if (!("health" in user) || !isNumber(user.health)) user.health = 100
        if (!("genre" in user)) user.genre = ""
        if (!("birth" in user)) user.birth = ""
        if (!("marry" in user)) user.marry = ""
        if (!("description" in user)) user.description = ""
        if (!("packstickers" in user)) user.packstickers = null
        if (!("premium" in user)) user.premium = false
        if (!("premiumTime" in user)) user.premiumTime = 0
        if (!("banned" in user)) user.banned = false
        if (!("bannedReason" in user)) user.bannedReason = ""
        if (!("commands" in user) || !isNumber(user.commands)) user.commands = 0
        if (!("afk" in user) || !isNumber(user.afk)) user.afk = -1
        if (!("afkReason" in user)) user.afkReason = ""
        if (!("warn" in user) || !isNumber(user.warn)) user.warn = 0
      } else global.db.data.users[m.sender] = {
        name: m.name,
        exp: 0,
        coin: 0,
        bank: 0,
        level: 0,
        health: 100,
        genre: "",
        birth: "",
        marry: "",
        description: "",
        packstickers: null,
        premium: false,
        premiumTime: 0,
        banned: false,
        bannedReason: "",
        commands: 0,
        afk: -1,
        afkReason: "",
        warn: 0
      }
      let chat = global.db.data.chats[m.chat]
      if (typeof chat !== "object") global.db.data.chats[m.chat] = {}
      if (chat) {
        if (!("isBanned" in chat)) chat.isBanned = false
        if (!("isMute" in chat)) chat.isMute = false;
        if (!("welcome" in chat)) chat.welcome = false
        if (!("sWelcome" in chat)) chat.sWelcome = ""
        if (!("sBye" in chat)) chat.sBye = ""
        if (!("detect" in chat)) chat.detect = true
        if (!("primaryBot" in chat)) chat.primaryBot = null
        if (!("modoadmin" in chat)) chat.modoadmin = false
        if (!("antiBot" in chat)) chat.antiBot = false
        // Compatibilidad: algunas versiones guardaron "antilink" (minúsculas)
        if (!("antiLink" in chat)) {
          if ("antilink" in chat) chat.antiLink = Boolean(chat.antilink)
          else chat.antiLink = true
        }
        if (!("antilink" in chat)) chat.antilink = Boolean(chat.antiLink)
        if (!("nsfw" in chat)) chat.nsfw = false
        if (!("economy" in chat)) chat.economy = true;
        if (!("gacha" in chat)) chat.gacha = true
      } else global.db.data.chats[m.chat] = {
        isBanned: false,
        isMute: false,
        welcome: false,
        sWelcome: "",
        sBye: "",
        detect: true,
        primaryBot: null,
        modoadmin: false,
        antiBot: false,
        antiLink: true,
        antilink: true,
        nsfw: false,
        economy: true,
        gacha: true
      }
      let settings = global.db.data.settings[this.user.jid]
      if (typeof settings !== "object") global.db.data.settings[this.user.jid] = {}
      if (settings) {
        if (!("self" in settings)) settings.self = false
        if (!("jadibotmd" in settings)) settings.jadibotmd = true
      } else global.db.data.settings[this.user.jid] = {
        self: false,
        jadibotmd: true
      }
    } catch (e) {
      console.error(e)
    }
    if (typeof m.text !== "string") m.text = ""
    // Métricas reales por día (mensajes/comandos) para el panel
    setImmediate(() => {
      try {
        if (!m?.sender || !global.db?.data) return
        if (m.fromMe || m.isBaileys) return
        // Mantener actividad real por usuario (para Usuarios de Comunidad)
        try {
          global.db.data.users ||= {}
          global.db.data.users[m.sender] ||= {}
          const u = global.db.data.users[m.sender]
          const nowIso = new Date().toISOString()
          u.lastSeen = nowIso
          u.messageCount = (Number(u.messageCount) || 0) + 1
          // Compat: si existía el contador viejo "commands", reflejarlo en commandCount
          if (u.commandCount == null && u.commands != null) u.commandCount = Number(u.commands) || 0
        } catch { }
        const panel = global.db.data.panel ||= {}
        panel.dailyMetrics ||= {}
        const dayKey = getDayKey()
        panel.dailyMetrics[dayKey] ||= { mensajes: 0, comandos: 0, mensajesPorHora: {}, comandosPorHora: {}, erroresComandos: 0 }
        const dm = panel.dailyMetrics[dayKey]
        const hour = String(new Date().getHours()).padStart(2, '0')
        dm.mensajes = (dm.mensajes || 0) + 1
        dm.mensajesPorHora ||= {}
        dm.mensajesPorHora[hour] = (dm.mensajesPorHora[hour] || 0) + 1

        // Emitir stats del dashboard en tiempo real (throttled)
        try {
          void import('./lib/socket-io.js')
            .then((m) => m?.emitDashboardStatsUpdateThrottled?.())
            .catch(() => { })
        } catch { }

        // Actividad reciente (panel.logs): registrar mensajes de forma limitada para no spamear
        panel.logs ||= []
        panel.logsCounter ||= 0
        const throttleMs = Number(process.env.PANEL_MESSAGE_LOG_THROTTLE_MS || 15000)
        const snippetMax = Number(process.env.PANEL_MESSAGE_SNIPPET_MAX || 120)
        global.__panelMsgLogDedup ||= new Map()
        const mtype = String(m?.mtype || m?.type || (m?.message && typeof m.message === 'object' ? Object.keys(m.message)[0] : '') || '')
        const dedupKey = `${m.chat || ''}|${mtype}`
        const last = global.__panelMsgLogDedup.get(dedupKey) || 0
        const now = Date.now()
        if (now - last >= throttleMs) {
          global.__panelMsgLogDedup.set(dedupKey, now)
          if (global.__panelMsgLogDedup.size > 5000) global.__panelMsgLogDedup.clear()
          const text = typeof m.text === 'string' ? m.text.trim() : ''
          const snippet = text ? text.slice(0, Math.max(0, snippetMax)) : ''
          panel.logs.push({
            id: panel.logsCounter++,
            usuario: m.sender,
            comando: '',
            detalles: snippet || (mtype ? `(${mtype})` : 'mensaje'),
            grupo: m.isGroup ? m.chat : '',
            fecha: new Date().toISOString(),
            tipo: 'mensaje',
            nivel: 'info',
            titulo: 'Mensaje',
            metadata: { mtype }
          })
          const maxLogs = parseInt(process.env.PANEL_LOGS_MAX || '2000', 10)
          if (Number.isFinite(maxLogs) && maxLogs > 0 && panel.logs.length > maxLogs) {
            panel.logs.splice(0, panel.logs.length - maxLogs)
          }
        }
      } catch { }
    })
    const user = global.db.data.users[m.sender]
    try {
      const actual = user.name || ""
      const nuevo = m.pushName || await this.getName(m.sender)
      if (typeof nuevo === "string" && nuevo.trim() && nuevo !== actual) {
        user.name = nuevo
      }
    } catch { }
    const chat = global.db.data.chats[m.chat]
    const settings = global.db.data.settings[this.user.jid]
    const isROwner = [...global.owner.map((number) => number)].map(v => v.replace(/[^0-9]/g, "") + "@s.whatsapp.net").includes(m.sender)
    const isOwner = isROwner || m.fromMe
    const isPrems = isROwner || global.prems.map(v => v.replace(/[^0-9]/g, "") + "@s.whatsapp.net").includes(m.sender) || user.premium == true
    const isOwners = [this.user.jid, ...global.owner.map((number) => number + "@s.whatsapp.net")].includes(m.sender)
    if (opts["queque"] && m.text && !(isPrems)) {
      const queque = this.msgqueque, time = 1000 * 5
      const previousID = queque[queque.length - 1]
      queque.push(m.id || m.key.id)
      setInterval(async function () {
        if (queque.indexOf(previousID) === -1) clearInterval(this)
        await delay(time)
      }, time)
    }

    global.panelApiLastSeen = new Date().toISOString()
    m.exp += Math.ceil(Math.random() * 10)
    let usedPrefix
    const isBaileysMessage = m.isBaileys === true

    // Optimized: Single groupMetadata call with caching
    let groupMetadata = {}
    let participants = []
    let userGroup = {}
    let botGroup = {}
    let isRAdmin = false
    let isAdmin = false
    let isBotAdmin = false

    if (m.isGroup) {
      const cachedMeta = conn.chats[m.chat]?.metadata
      const rawMeta = cachedMeta || await this.groupMetadata(m.chat).catch(_ => null) || {}
      groupMetadata = { ...rawMeta }
      if (rawMeta.participants) {
        groupMetadata.participants = rawMeta.participants.map(p => ({ ...p, id: p.jid, jid: p.jid, lid: p.lid }))
      }
      participants = (groupMetadata.participants || []).map(p => ({ id: p.jid, jid: p.jid, lid: p.lid, admin: p.admin }))
      userGroup = participants.find(u => conn.decodeJid(u.jid) === m.sender) || {}
      botGroup = participants.find(u => conn.decodeJid(u.jid) == this.user.jid) || {}
      isRAdmin = userGroup?.admin == "superadmin"
      isAdmin = isRAdmin || userGroup?.admin == "admin"
      isBotAdmin = !!botGroup?.admin
    }

    const ___dirname = path.join(path.dirname(fileURLToPath(import.meta.url)), "./plugins")

    // Variable para controlar si el antibot procesó el mensaje
    let antibotProcessed = false

    for (const name in global.plugins) {
      const plugin = global.plugins[name]
      if (!plugin) continue
      if (plugin.disabled) continue

      // Permitir que el Anti-Bots actúe sobre mensajes marcados como Baileys (otros bots),
      // pero evitar ejecutar el resto de plugins para no generar loops o falsos positivos.
      if (isBaileysMessage && name !== '_antibots.js') continue

      const __filename = join(___dirname, name)
      if (typeof plugin.all === "function") {
        try {
          await plugin.all.call(this, m, {
            chatUpdate,
            __dirname: ___dirname,
            __filename,
            user,
            chat,
            settings
          })
        } catch (err) {
          console.error(err)
        }
      }
      if (!opts["restrict"])
        if (plugin.tags && plugin.tags.includes("admin")) {
          continue
        }
      const pluginPrefix = plugin.customPrefix || conn.prefix || global.prefix
      const match = (pluginPrefix instanceof RegExp ?
        [[pluginPrefix.exec(m.text), pluginPrefix]] :
        Array.isArray(pluginPrefix) ?
          pluginPrefix.map(prefix => {
            const regex = prefix instanceof RegExp ?
              prefix : new RegExp(strRegex(prefix))
            return [regex.exec(m.text), regex]
          }) : typeof pluginPrefix === "string" ?
            [[new RegExp(strRegex(pluginPrefix)).exec(m.text), new RegExp(strRegex(pluginPrefix))]] :
            [[[], new RegExp]]).find(prefix => prefix[1])

      // EJECUTAR plugin.before (aquí se ejecuta el antibot)
      if (typeof plugin.before === "function") {
        try {
          const beforeResult = await plugin.before.call(this, m, {
            match,
            conn: this,
            participants,
            groupMetadata,
            userGroup,
            botGroup,
            isROwner,
            isOwner,
            isRAdmin,
            isAdmin,
            isBotAdmin,
            isPrems,
            chatUpdate,
            __dirname: ___dirname,
            __filename,
            user,
            chat,
            settings
          })

          // Si el antibot procesó el mensaje, marcar y continuar
          if (name === '_antibots.js' && beforeResult) {
            antibotProcessed = true
          }

          if (beforeResult) continue
        } catch (err) {
          console.error(err)
        }
      }

      if (typeof plugin !== "function") {
        continue
      }
      if ((usedPrefix = (match[0] || "")[0])) {
        const noPrefix = m.text.replace(usedPrefix, "")
        let [command, ...args] = noPrefix.trim().split(" ").filter(v => v)
        args = args || []
        let _args = noPrefix.trim().split(" ").slice(1)
        let text = _args.join(" ")
        command = (command || "").toLowerCase()
        const fail = plugin.fail || global.dfail
        const isAccept = plugin.command instanceof RegExp ?
          plugin.command.test(command) :
          Array.isArray(plugin.command) ?
            plugin.command.some(cmd => cmd instanceof RegExp ?
              cmd.test(command) : cmd === command) :
            typeof plugin.command === "string" ?
              plugin.command === command : false
        global.comando = command

        if (!isOwners && settings.self) return

        // MOVIDO: Ahora solo bloquea después de que el antibot haya tenido oportunidad de procesar
        // Si el antibot ya procesó este mensaje (lo detectó y eliminó), no ejecutar comandos
        if (antibotProcessed) {
          console.log('[HANDLER] Mensaje procesado por antibot, ignorando comandos')
          return
        }

        // Bloquear comandos de mensajes con IDs de bots conocidos
        // PERO solo si el antibot NO está activo en este chat
        if (!chat?.antiBot) {
          if ((m.id.startsWith("NJX-") || (m.id.startsWith("BAE5") && m.id.length === 16) || (m.id.startsWith("B24E") && m.id.length === 20))) {
            console.log('[HANDLER] Mensaje de bot detectado (antibot desactivado), ignorando')
            return
          }
        }

        if (global.db.data.chats[m.chat].primaryBot && global.db.data.chats[m.chat].primaryBot !== this.user.jid) {
          const primaryBotConn = global.conns.find(conn => conn.user.jid === global.db.data.chats[m.chat].primaryBot && conn.ws.socket && conn.ws.socket.readyState !== ws.CLOSED)
          // Reuse already fetched participants instead of calling groupMetadata again
          const primaryBotInGroup = participants.some(p => p.jid === global.db.data.chats[m.chat].primaryBot)
          if (primaryBotConn && primaryBotInGroup || global.db.data.chats[m.chat].primaryBot === global.conn.user.jid) {
            throw !1
          } else {
            global.db.data.chats[m.chat].primaryBot = null
          }
        }

        if (!isAccept) continue
        m.plugin = name
        global.db.data.users[m.sender].commands++
        // Compat UI: exponer conteo de comandos por usuario
        try {
          const u = global.db.data.users[m.sender]
          if (u) {
            u.commandCount = Number(u.commands) || 0
            u.lastSeen = new Date().toISOString()
          }
        } catch { }
        if (chat) {
          const botId = this.user.jid
          const primaryBotId = chat.primaryBot
          const globalState = global.db?.data?.panel?.botGlobalState
          if (m.isGroup && globalState?.isOn === false && !isROwner) {
            if (!primaryBotId || primaryBotId === botId) {
              const offMsg = global.db?.data?.panel?.botGlobalOffMessage || 'El bot está desactivado globalmente por el administrador.'
              await m.reply(offMsg)
              return
            }
          }
          if (name !== "group-banchat.js" && chat?.isBanned && !isROwner) {
            if (!primaryBotId || primaryBotId === botId) {
              const aviso = `ꕥ El bot *${botname}* está desactivado en este grupo\n\n> ✦ Un *administrador* puede activarlo con el comando:\n> » *${usedPrefix}bot on*`.trim()
              await m.reply(aviso)
              return
            }
          }
          if (m.text && user.banned && !isROwner) {
            const mensaje = `ꕥ Estas baneado/a, no puedes usar comandos en este bot!\n\n> ● *Razón ›* ${user.bannedReason}\n\n> ● Si este Bot es cuenta oficial y tienes evidencia que respalde que este mensaje es un error, puedes exponer tu caso con un moderador.`.trim()
            if (!primaryBotId || primaryBotId === botId) {
              m.reply(mensaje)
              return
            }
          }
        }
        if (!isOwners && !m.chat.endsWith('g.us') && !/code|p|ping|qr|estado|status|infobot|botinfo|report|reportar|invite|join|logout|suggest|help|menu/gim.test(m.text)) return
        const adminMode = chat.modoadmin || false
        const wa = plugin.botAdmin || plugin.admin || plugin.group || plugin || noPrefix || pluginPrefix || m.text.slice(0, 1) === pluginPrefix || plugin.command
        if (adminMode && !isOwner && m.isGroup && !isAdmin && wa) return
        if (plugin.rowner && plugin.owner && !(isROwner || isOwner)) {
          fail("owner", m, this)
          continue
        }
        if (plugin.rowner && !isROwner) {
          fail("rowner", m, this)
          continue
        }
        if (plugin.owner && !isOwner) {
          fail("owner", m, this)
          continue
        }
        if (plugin.premium && !isPrems) {
          fail("premium", m, this)
          continue
        }
        if (plugin.group && !m.isGroup) {
          fail("group", m, this)
          continue
        }
        if (plugin.botAdmin && !isBotAdmin) {
          fail("botAdmin", m, this)
          continue
        }
        if (plugin.admin && !isAdmin) {
          fail("admin", m, this)
          continue
        }
        m.isCommand = true
        m.exp += plugin.exp ? parseInt(plugin.exp) : 10
        let extra = {
          match,
          usedPrefix,
          noPrefix,
          _args,
          args,
          command,
          text,
          conn: this,
          participants,
          groupMetadata,
          userGroup,
          botGroup,
          isROwner,
          isOwner,
          isRAdmin,
          isAdmin,
          isBotAdmin,
          isPrems,
          chatUpdate,
          __dirname: ___dirname,
          __filename,
          user,
          chat,
          settings
        }
        const commandStart = Date.now()
        let commandSuccess = true
        let commandErrorMsg = null
        try {
          await plugin.call(this, m, extra)
        } catch (err) {
          m.error = err
          console.error(err)
          commandSuccess = false
          commandErrorMsg = err?.message || String(err)
        } finally {
          const responseTime = Date.now() - commandStart
          // Logging y métricas reales para el panel (comandos)
          setImmediate(() => {
            try {
              const panel = global.db?.data?.panel
              if (!panel) return
              panel.logs ||= []
              panel.logsCounter ||= 0
              panel.dailyMetrics ||= {}
              const dayKey = getDayKey()
              panel.dailyMetrics[dayKey] ||= { mensajes: 0, comandos: 0, mensajesPorHora: {}, comandosPorHora: {}, erroresComandos: 0 }
              const dm = panel.dailyMetrics[dayKey]
              const hour = String(new Date().getHours()).padStart(2, '0')
              dm.comandos = (dm.comandos || 0) + 1
              dm.comandosPorHora ||= {}
              dm.comandosPorHora[hour] = (dm.comandosPorHora[hour] || 0) + 1
              if (!commandSuccess) dm.erroresComandos = (dm.erroresComandos || 0) + 1
              panel.logs.push({
                id: panel.logsCounter++,
                usuario: m.sender,
                comando: `${usedPrefix}${command}`,
                detalles: typeof m.text === 'string' ? m.text : '',
                grupo: m.isGroup ? m.chat : '',
                fecha: new Date().toISOString(),
                tipo: 'comando',
                nivel: commandSuccess ? 'info' : 'error',
                metadata: {
                  command,
                  plugin: name,
                  success: commandSuccess,
                  responseTime,
                  error: commandSuccess ? null : commandErrorMsg,
                }
              })
              const maxLogs = parseInt(process.env.PANEL_LOGS_MAX || '2000', 10)
              if (Number.isFinite(maxLogs) && maxLogs > 0 && panel.logs.length > maxLogs) {
                panel.logs.splice(0, panel.logs.length - maxLogs)
              }

              // Emitir stats del dashboard en tiempo real (throttled)
              try {
                void import('./lib/socket-io.js')
                  .then((m) => m?.emitDashboardStatsUpdateThrottled?.())
                  .catch(() => { })
              } catch { }
            } catch { }
          })
          if (typeof plugin.after === "function") {
            try {
              await plugin.after.call(this, m, extra)
            } catch (err) {
              console.error(err)
            }
          }
        }
      }
    }
  } catch (err) {
    console.error(err)
  } finally {
    if (opts["queque"] && m.text) {
      const quequeIndex = this.msgqueque.indexOf(m.id || m.key.id)
      if (quequeIndex !== -1)
        this.msgqueque.splice(quequeIndex, 1)
    }
    let user = global.db.data.users[m.sender]
    if (m) {
      if (m.sender && user) {
        user.exp += m.exp
      }
    }
    // Non-blocking print
    if (!opts["noprint"]) {
      setImmediate(async () => {
        try {
          const printModule = await import("./lib/print.js")
          await printModule.default(m, this)
        } catch (err) {
          console.warn(err)
        }
      })
    }
  }
}

global.dfail = (type, m, conn) => {
  const msg = {
    rowner: `『✦』El comando *${comando}* solo puede ser usado por los creadores del bot.`,
    premium: `『✦』El comando *${comando}* solo puede ser usado por los usuarios premium.`,
    group: `『✦』El comando *${comando}* solo puede ser usado en grupos.`,
    admin: `『✦』El comando *${comando}* solo puede ser usado por los administradores del grupo.`,
    botAdmin: `『✦』Para ejecutar el comando *${comando}* debo ser administrador del grupo.`
  }[type]
  if (msg) return conn.reply(m.chat, msg, m).then(_ => m.react('✖️'))
}
let file = global.__filename(import.meta.url, true)
watchFile(file, async () => {
  unwatchFile(file)
  console.log(chalk.magenta("Se actualizo 'handler.js'"))
  if (global.reloadHandler) console.log(await global.reloadHandler())
})
