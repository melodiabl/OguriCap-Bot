process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1'
import 'dotenv/config'
import './settings.js'
import './plugins/_allfake.js'
import cfonts from 'cfonts'
import { createRequire } from 'module'
import { fileURLToPath, pathToFileURL } from 'url'
import { platform } from 'process'
import * as ws from 'ws'
import fs, { readdirSync, statSync, unlinkSync, existsSync, mkdirSync, readFileSync, rmSync, watch } from 'fs'
import yargs from 'yargs'
import { spawn, execSync } from 'child_process'
import lodash from 'lodash'
import { yukiJadiBot } from './plugins/sockets-serbot.js'
import chalk from 'chalk'
import syntaxerror from 'syntax-error'
import pino from 'pino'
import Pino from 'pino'
import path, { join, dirname } from 'path'
import { Boom } from '@hapi/boom'
import { makeWASocket, protoType, serialize } from './lib/simple.js'
import store from './lib/store.js'
import qrcode from 'qrcode'
import { format } from 'util'
const { proto } = (await import('@whiskeysockets/baileys')).default
import pkg from 'google-libphonenumber'
const { PhoneNumberUtil } = pkg
const phoneUtil = PhoneNumberUtil.getInstance()
const { DisconnectReason, useMultiFileAuthState, MessageRetryMap, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, jidNormalizedUser } = await import('@whiskeysockets/baileys')
import readline, { createInterface } from 'readline'
import NodeCache from 'node-cache'
const { CONNECTING } = ws
const { chain } = lodash
const PORT = process.env.PORT || process.env.SERVER_PORT || 3001

let { say } = cfonts
console.log(chalk.magentaBright('\n❀ Iniciando...'))
say('Oguri-Bot', {
  font: 'simple',
  align: 'left',
  gradient: ['green', 'white']
})
say('Made with love from Melodia', {
  font: 'console',
  align: 'center',
  colors: ['cyan', 'magenta', 'yellow']
})
protoType()
serialize()

global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') {
  return rmPrefix ? /file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL : pathToFileURL(pathURL).toString()
}
global.__dirname = function dirname(pathURL) {
  return path.dirname(global.__filename(pathURL, true))
}
global.__require = function require(dir = import.meta.url) {
  return createRequire(dir)
}
global.timestamp = { start: new Date() }
const __dirname = global.__dirname(import.meta.url)
global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse())
global.prefix = new RegExp('^[#!./-]')

// ============================================
// POSTGRESQL DATABASE - SIMPLE
// ============================================
if (process.env.LOG_DB === 'true') console.log(chalk.cyan('🚀 Initializing PostgreSQL...'))

import Database from './lib/database.js'

// Simple database initialization
global.loadDatabase = async function loadDatabase() {
  try {
    // Evitar reinstanciar DB/pool (esto causaba spam y degradaba el bot)
    if (global.db?.data) return global.db.data

    global.__pgDatabaseInstance ||= null
    global.__pgDatabaseInitPromise ||= null

    if (!global.__pgDatabaseInstance) global.__pgDatabaseInstance = new Database()
    if (!global.__pgDatabaseInitPromise) {
      global.__pgDatabaseInitPromise = global.__pgDatabaseInstance.init().then(() => global.__pgDatabaseInstance)
    }

    const db = await global.__pgDatabaseInitPromise

    // Make it compatible with existing code (LowDB-like API)
    if (!global.db) {
      global.db = {
        data: db.data,
        read: () => db.read(),
        write: () => db.write(),
        pool: db.pool,
        chain: (data) => ({
          get: (path) => {
            const keys = String(path || '').split('.')
            let result = data
            for (const key of keys) result = result?.[key]
            return { value: () => result }
          }
        })
      };
    } else {
      global.db.data = db.data
      global.db.pool = db.pool
    }

    global.DATABASE = global.db;

    // Loguear solo una vez
    if (!global.__pgDatabaseReadyLogged) {
      if (process.env.LOG_DB === 'true') console.log(chalk.green('✅ PostgreSQL ready'));
      global.__pgDatabaseReadyLogged = true
    }

    return global.db.data;
    
  } catch (error) {
    console.error(chalk.red('❌ PostgreSQL failed:'), error.message);
    process.exit(1);
  }
}

// Load database
if (process.env.LOG_DB === 'true') console.log(chalk.cyan('🚀 Starting database...'))
await loadDatabase()

// Asegurar estructura base del panel desde el arranque (evita perder métricas/logs antes del primer request al panel)
try {
  if (global.db?.data) {
    global.db.data.panel ||= {}
    const panel = global.db.data.panel
    panel.logs ||= []
    panel.logsCounter ||= 0
    panel.dailyMetrics ||= {}
  }
} catch {}

// Initialize user data synchronization
import('./lib/startup-sync.js').catch(err => {
  console.warn('Warning: Could not initialize user data synchronization:', err.message);
});

// Initialize admin user for JWT system
import('./lib/init-admin.js').catch(err => {
  console.warn('Warning: Could not initialize admin user:', err.message);
});

const { state, saveState, saveCreds } = await useMultiFileAuthState(global.sessions)
const msgRetryCounterMap = new Map()
const msgRetryCounterCache = new NodeCache({ stdTTL: 0, checkperiod: 0 })
const userDevicesCache = new NodeCache({ stdTTL: 0, checkperiod: 0 })
const { version } = await fetchLatestBaileysVersion()
let phoneNumber = global.botNumber
const methodCodeQR = process.argv.includes("qr")
const methodCode = !!phoneNumber || process.argv.includes("code")
const MethodMobile = process.argv.includes("mobile")
const colors = chalk.bold.white
const qrOption = chalk.blueBright
const textOption = chalk.cyan
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const question = (texto) => new Promise((resolver) => rl.question(texto, resolver))
let opcion

// Verificar si hay argumento --no-prompt para modo panel (sin preguntas interactivas)
const noPrompt = process.argv.includes("--no-prompt") || process.env.NO_PROMPT === '1'
// Print (lib/print.js) en producción:
// Antes se desactivaba automáticamente en modo panel/producción.
// Ahora solo se desactiva si lo pides explícitamente (env).
const noprintEnv =
  process.env.NOPRINT === '1' || process.env.NOPRINT === 'true' ||
  process.env.NO_PRINT === '1' || process.env.NO_PRINT === 'true'
if (noprintEnv) global.opts['noprint'] = true

// ============================================
// CONFIGURACIÓN DEL PANEL - MEJORADA
// ============================================
let panelAuthMethod = 'qr'
let panelPairingPhone = null

try {
  const dbPath = path.join(__dirname, 'database.json')
  if (fs.existsSync(dbPath)) {
    const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf-8'))
    const whatsappConfig = dbData?.panel?.whatsapp || dbData?.whatsapp || {}
    panelAuthMethod = whatsappConfig?.authMethod || 'qr'
    panelPairingPhone = whatsappConfig?.pairingPhone || null
    
    console.log(chalk.cyan(`[ ✿ ] Método de auth del panel: ${panelAuthMethod}`))
    if (panelAuthMethod === 'pairing' && panelPairingPhone) {
      console.log(chalk.cyan(`[ ✿ ] Número de pairing: ${panelPairingPhone}`))
    }
  }
} catch (e) {
  console.warn(chalk.yellow('⚠️  No se pudo leer configuración del panel, usando valores por defecto'))
}

// Exponer para el panel y reconexiones
global.panelAuthMethod = panelAuthMethod
global.panelPairingPhone = panelPairingPhone

// ============================================
// SELECCIÓN DE MÉTODO DE AUTENTICACIÓN
// ============================================
if (methodCodeQR) {
  opcion = '1'
}

if (!methodCodeQR && !methodCode && !fs.existsSync(`./${global.sessions}/creds.json`)) {
  if (noPrompt) {
    // Modo panel: usar configuración del panel
    if (panelAuthMethod === 'pairing' && panelPairingPhone) {
      opcion = '2'
      phoneNumber = panelPairingPhone
      console.log(chalk.cyan('[ ✿ ] Modo panel activo - Usando código de emparejamiento'))
    } else {
      opcion = '1'
      console.log(chalk.cyan('[ ✿ ] Modo panel activo - Usando QR por defecto'))
    }
    console.log(chalk.cyan('[ ✿ ] Puedes conectar desde el panel web o escanear el QR en la terminal'))
  } else {
    // Modo terminal: preguntar al usuario
    do {
      opcion = await question(colors("Seleccione una opción:\n") + qrOption("1. Con código QR\n") + textOption("2. Con código de texto de 8 dígitos\n--> "))
      if (!/^[1-2]$/.test(opcion)) {
        console.log(chalk.bold.redBright(`No se permiten numeros que no sean 1 o 2, tampoco letras o símbolos especiales.`))
      }
    } while (opcion !== '1' && opcion !== '2' || fs.existsSync(`./${global.sessions}/creds.json`))
  }
}

console.info = () => {}

// ============================================
// OPCIONES DE CONEXIÓN - OPTIMIZADAS
// ============================================
const connectionOptions = {
  logger: pino({ level: 'silent' }),
  printQRInTerminal: (opcion == '1' || methodCodeQR) && panelAuthMethod !== 'pairing',
  mobile: MethodMobile,
  browser: panelAuthMethod === 'pairing' ? ["Ubuntu", "Chrome", "20.0.04"] : ["MacOs", "Safari", "10.0"],
  auth: {
    creds: state.creds,
    keys: makeCacheableSignalKeyStore(state.keys, Pino({ level: "fatal" }).child({ level: "fatal" })),
  },
  markOnlineOnConnect: false,
  generateHighQualityLinkPreview: true,
  syncFullHistory: false,
  connectTimeoutMs: 60000,
  defaultQueryTimeoutMs: 0,
  keepAliveIntervalMs: 10000,
  getMessage: async (key) => {
    try {
      let jid = jidNormalizedUser(key.remoteJid)
      let msg = await store.loadMessage(jid, key.id)
      return msg?.message || ""
    } catch (error) {
      return ""
    }
  },
  msgRetryCounterCache: msgRetryCounterCache || new Map(),
  userDevicesCache: userDevicesCache || new Map(),
  cachedGroupMetadata: (jid) => global.conn.chats[jid] ?? {},
  version: version,
  keepAliveIntervalMs: 55000,
  maxIdleTimeMs: 60000,
}

global.conn = makeWASocket(connectionOptions)
conn.ev.on("creds.update", saveCreds)

// ============================================
// INICIAR PANEL API
// ============================================
if (process.env.PANEL_API !== '0') {
  try {
    const { startPanelApi } = await import('./lib/panel-api.js')
    const apiPort = PORT
    await startPanelApi({ port: apiPort })
    
    setTimeout(async () => {
      try {
        const response = await fetch(`http://localhost:${apiPort}/api/health`)
        if (response.ok) {
          console.log(chalk.green('✅ Panel API respondiendo correctamente'))
        }
      } catch (error) {
        console.warn(chalk.yellow('⚠️  Panel API no responde (puede estar iniciando)'))
      }
    }, 2000)
  } catch (e) {
    console.error(chalk.red('❌ Error iniciando Panel API:'), e)
  }
}

// ============================================
// MANEJO DE AUTENTICACIÓN
// ============================================
if (!fs.existsSync(`./${global.sessions}/creds.json`)) {
  if (opcion === '2' || methodCode || panelAuthMethod === 'pairing') {
    opcion = '2'
    if (!conn.authState.creds.registered) {
      let addNumber
      
      if (!!phoneNumber) {
        // Ya tenemos el número del panel o argumentos
        addNumber = phoneNumber.replace(/[^0-9]/g, '')
        console.log(chalk.cyan(`[ ✿ ] Usando número: +${addNumber}`))
      } else {
        // Preguntar por el número
        do {
          phoneNumber = await question(chalk.bgBlack(chalk.bold.greenBright(`[ ✿ ] Por favor, Ingrese el número de WhatsApp.\n${chalk.bold.magentaBright('---> ')}`)))
          phoneNumber = phoneNumber.replace(/\D/g, '')
          if (!phoneNumber.startsWith('+')) {
            phoneNumber = `+${phoneNumber}`
          }
        } while (!await isValidPhoneNumber(phoneNumber))
        
        rl.close()
        addNumber = phoneNumber.replace(/\D/g, '')
      }
      
      // Generar código de emparejamiento con código fijo del panel
      setTimeout(async () => {
        try {
          console.log(chalk.cyan('[ ✿ ] Solicitando código de emparejamiento...'))
          
          // Usar código fijo del socket (sin pasar segundo parámetro, usa el default)
          let codeBot = await conn.requestPairingCode(addNumber)
          console.log(chalk.cyan('[ ✿ ] Usando código fijo del socket'))
          
          // Formatear el código si es necesario
          if (typeof codeBot === 'string' && codeBot.length > 4) {
            codeBot = codeBot.match(/.{1,4}/g)?.join("-") || codeBot
          }
          
          console.log(chalk.bold.white(chalk.bgMagenta(`[ ✿ ] Código de Emparejamiento:`)), chalk.bold.white(chalk.white(codeBot)))
          console.log(chalk.cyan('[ ✿ ] Ingresa este código en WhatsApp: Dispositivos Vinculados > Vincular Dispositivo > Vincular con número de teléfono'))
          
          // Guardar código para el panel
          global.panelPairingCode = codeBot
        } catch (error) {
          console.error(chalk.red('❌ Error generando código:'), error.message)
        }
      }, 3000)
    }
  }
}

conn.isInit = false
conn.well = false
conn.logger.info(`[ ✿ ] H E C H O\n`)

if (!opts['test']) {
  if (global.db) setInterval(async () => {
    if (global.db.data) await global.db.write()
    if (opts['autocleartmp'] && (global.support || {}).find) {
      const tmp = [os.tmpdir(), 'tmp', `${global.jadi}`]
      tmp.forEach((filename) => cp.spawn('find', [filename, '-amin', '3', '-type', 'f', '-delete']))
    }
  }, 30 * 1000)
}

// ============================================
// VARIABLES GLOBALES PARA EL PANEL
// ============================================
global.panelApiMainQr = null
global.panelApiMainDisconnect = false
global.reauthInProgress = false
global.panelApiLastSeen = null
global.stopped = 'connecting'
global.__panelLastConnState ||= null

function pushPanelLog(entry) {
  try {
    if (!global.db?.data) return
    const panel = global.db.data.panel ||= {}
    panel.logs ||= []
    panel.logsCounter ||= 0

    const record = {
      id: panel.logsCounter++,
      fecha: new Date().toISOString(),
      nivel: 'info',
      ...entry,
    }

    panel.logs.push(record)

    const maxLogs = parseInt(process.env.PANEL_LOGS_MAX || '2000', 10)
    if (Number.isFinite(maxLogs) && maxLogs > 0 && panel.logs.length > maxLogs) {
      panel.logs.splice(0, panel.logs.length - maxLogs)
    }

    // Emitir al panel en tiempo real (Socket.IO) si está disponible
    try {
      emitPanelLogEntry(record)
    } catch {}
  } catch {}
}

// EmitLogEntry (Socket.IO) con carga perezosa + buffer
const emitPanelLogEntry = (() => {
  let emitFn = null
  const pending = []

  import('./lib/socket-io.js')
    .then((m) => {
      emitFn = m?.emitLogEntry
      if (typeof emitFn === 'function') {
        while (pending.length) {
          try { emitFn(pending.shift()) } catch { pending.shift() }
        }
      }
    })
    .catch(() => {})

  return (record) => {
    if (typeof emitFn === 'function') return emitFn(record)
    pending.push(record)
    if (pending.length > 50) pending.shift()
  }
})()

// Captura de console.* para que los "print" del backend aparezcan en el panel
function installPanelConsoleCapture() {
  if (global.__panelConsoleCaptureInstalled) return
  global.__panelConsoleCaptureInstalled = true

  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug,
  }

  const WINDOW_MS = 1000
  const MAX_PER_WINDOW = 40
  const rate = { start: Date.now(), count: 0, dropped: 0 }

  const safeStringify = (value) => {
    try {
      if (value instanceof Error) return value.stack || value.message || String(value)
      if (typeof value === 'string') return value
      if (typeof value === 'number' || typeof value === 'boolean' || value == null) return String(value)
      const seen = new WeakSet()
      return JSON.stringify(value, (k, v) => {
        if (typeof v === 'object' && v !== null) {
          if (seen.has(v)) return '[Circular]'
          seen.add(v)
        }
        return v
      })
    } catch {
      try { return String(value) } catch { return '[Unserializable]' }
    }
  }

  const formatArgs = (args) => {
    const msg = args.map(safeStringify).join(' ')
    const max = 1800
    return msg.length > max ? `${msg.slice(0, max)}…` : msg
  }

  const shouldDrop = () => {
    const now = Date.now()
    if (now - rate.start >= WINDOW_MS) {
      if (rate.dropped > 0) {
        pushPanelLog({
          tipo: 'terminal',
          nivel: 'warn',
          mensaje: `[Console] Se descartaron ${rate.dropped} logs por rate-limit`,
          metadata: { source: 'console', dropped: rate.dropped },
        })
      }
      rate.start = now
      rate.count = 0
      rate.dropped = 0
    }

    rate.count += 1
    if (rate.count > MAX_PER_WINDOW) {
      rate.dropped += 1
      return true
    }

    return false
  }

  const capture = (method, nivel, callOriginal) => (...args) => {
    try {
      if (callOriginal && typeof original[method] === 'function') original[method](...args)
      if (shouldDrop()) return

      pushPanelLog({
        tipo: 'terminal',
        nivel,
        mensaje: formatArgs(args),
        metadata: { source: 'console', method },
      })
    } catch {
      try {
        if (callOriginal && typeof original[method] === 'function') original[method](...args)
      } catch {}
    }
  }

  console.log = capture('log', 'info', true)
  console.warn = capture('warn', 'warn', true)
  console.error = capture('error', 'error', true)
  // Mantener console.info silenciado en la terminal, pero capturado para el panel
  console.info = capture('info', 'info', false)
  console.debug = capture('debug', 'debug', false)
}

installPanelConsoleCapture()

// ============================================
// MANEJADOR DE ACTUALIZACIONES DE CONEXIÓN
// ============================================
async function connectionUpdate(update) {
  const { connection, lastDisconnect, isNewLogin, qr } = update

  // Actualizar estado global para el panel
  if (connection) {
    global.stopped = connection
  }

  if (isNewLogin) conn.isInit = true
  const code = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode

  // Actualizar QR para el panel
  if (qr) {
    // Si el método es pairing, no guardar ni emitir QR para evitar bucles
    if ((global.panelAuthMethod || panelAuthMethod) === 'pairing') {
      console.log(chalk.yellow('⚠️  QR recibido pero método es pairing, ignorando...'))
      return
    }
    
    global.panelApiMainQr = qr
    // Emitir QR via Socket.IO
    try {
      const { emitBotQR } = await import('./lib/socket-io.js')
      emitBotQR(qr)
    } catch {}
  }

  // Actualizar último seen
  if (connection === 'open') {
    global.panelApiLastSeen = new Date().toISOString()
    global.stopped = 'open'
    // Limpiar código de pairing
    global.panelPairingCode = null
    // Emitir conexión via Socket.IO
    try {
      const { emitBotConnected, emitBotStatus } = await import('./lib/socket-io.js')
      emitBotConnected(conn.user?.id)
      emitBotStatus()
    } catch {}

    if (global.__panelLastConnState !== 'open') {
      pushPanelLog({
        tipo: 'bot',
        titulo: 'Bot conectado',
        detalles: conn.user?.id ? `Conectado como ${conn.user.id}` : 'Conexión abierta',
        usuario: conn.user?.id || 'bot',
        metadata: { event: 'connection_open' },
      })
    }
  }

  if (connection === 'connecting') {
    global.stopped = 'connecting'
  }

  if (code && code !== DisconnectReason.loggedOut && conn?.ws.socket == null) {
    await global.reloadHandler(true).catch(console.error)
    global.timestamp.connect = new Date()
  }
  
  if (global.db.data == null) loadDatabase()
  
  if (update.qr != 0 && update.qr != undefined || methodCodeQR) {
    if (opcion == '1' || methodCodeQR) {
      console.log(chalk.green.bold(`[ ✿ ] Escanea este código QR`))
    }
  }
  
  if (connection === "open") {
    const userJid = jidNormalizedUser(conn.user.id)
    const userName = conn.user.name || conn.user.verifiedName || "Desconocido"
    await joinChannels(conn)
    console.log(chalk.green.bold(`[ ✿ ] Conectado a: ${userName}`))
    // Limpiar QR del panel
    global.panelApiMainQr = null
    global.panelApiMainDisconnect = false
    global.reauthInProgress = false
  }
  
  let reason = new Boom(lastDisconnect?.error)?.output?.statusCode
  
  if (connection === "close") {
    global.stopped = 'close'
    // Emitir desconexión via Socket.IO
    try {
      const { emitBotDisconnected, emitBotStatus } = await import('./lib/socket-io.js')
      emitBotDisconnected(reason)
      emitBotStatus()
    } catch {}

    if (global.__panelLastConnState !== 'close') {
      pushPanelLog({
        tipo: 'bot',
        titulo: 'Bot desconectado',
        detalles: reason ? `Razón: ${reason}` : 'Conexión cerrada',
        usuario: conn.user?.id || 'bot',
        nivel: 'error',
        metadata: { event: 'connection_close', reason: reason || null },
      })
    }

    // Si el panel solicitó desconexión, no reconectar
    if (global.panelApiMainDisconnect) {
      console.log(chalk.yellow("→ Bot desconectado desde el panel"))
      return
    }
    
    if ([401, 440, 428, 405].includes(reason)) {
      console.log(chalk.red(`→ (${code}) › Cierra la session Principal.`))
    }
    
    console.log(chalk.yellow("→ Reconectando el Bot Principal..."))
    await global.reloadHandler(true).catch(console.error)
  }

  if (connection) global.__panelLastConnState = connection
}

process.on('uncaughtException', console.error)

let isInit = true
let handler = await import('./handler.js')

// ============================================
// RELOAD HANDLER - MEJORADO
// ============================================
global.reloadHandler = async function (restatConn) {
  try {
    const Handler = await import(`./handler.js?update=${Date.now()}`).catch(console.error)
    if (Object.keys(Handler || {}).length) handler = Handler
  } catch (e) {
    console.error(e)
  }
  
  if (restatConn) {
    const oldChats = global.conn.chats
    try {
      global.conn.ws.close()
    } catch { }
    conn.ev.removeAllListeners()
    
    // Recargar configuración del panel antes de reconectar
    let currentOptions = { ...connectionOptions }
    try {
      const dbPath = path.join(__dirname, 'database.json')
      if (fs.existsSync(dbPath)) {
        const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf-8'))
        const whatsappConfig = dbData?.panel?.whatsapp || dbData?.whatsapp || {}
        const inMemoryWhatsapp = global.db?.data?.panel?.whatsapp || null
        
        global.panelAuthMethod = inMemoryWhatsapp?.authMethod || whatsappConfig?.authMethod || 'qr'
        global.panelPairingPhone = inMemoryWhatsapp?.pairingPhone || whatsappConfig?.pairingPhone || null
        
        if (global.panelAuthMethod === 'pairing') {
          currentOptions.browser = ["Ubuntu", "Chrome", "20.0.04"]
          currentOptions.printQRInTerminal = false
          console.log(chalk.cyan('[ ✿ ] Reconectando con método pairing'))
        } else {
          currentOptions.browser = ["MacOs", "Safari", "10.0"]
          currentOptions.printQRInTerminal = (opcion == '1' || methodCodeQR)
          console.log(chalk.cyan('[ ✿ ] Reconectando con método QR'))
        }
      }
    } catch (e) {
      console.warn(chalk.yellow('⚠️  Error leyendo config del panel en reload'))
    }

    global.conn = makeWASocket(currentOptions, { chats: oldChats })
    isInit = true
  }
  
  if (!isInit) {
    conn.ev.off('messages.upsert', conn.handler)
    if (conn.providerMediaHandler) conn.ev.off('messages.upsert', conn.providerMediaHandler)
    conn.ev.off('connection.update', conn.connectionUpdate)
    conn.ev.off('creds.update', conn.credsUpdate)
  }
  
  conn.handler = handler.handler.bind(global.conn)
  conn.connectionUpdate = connectionUpdate.bind(global.conn)
  conn.credsUpdate = saveCreds.bind(global.conn, true)
  
  const currentDateTime = new Date()
  const messageDateTime = new Date(conn.ev)
  
  if (currentDateTime >= messageDateTime) {
    const chats = Object.entries(conn.chats).filter(([jid, chat]) => !jid.endsWith('@g.us') && chat.isChats).map((v) => v[0])
  } else {
    const chats = Object.entries(conn.chats).filter(([jid, chat]) => !jid.endsWith('@g.us') && chat.isChats).map((v) => v[0])
  }
  
  conn.ev.on('messages.upsert', conn.handler)
  try {
    const { createProviderMediaCaptureHandler } = await import('./lib/provider-media-capture.js')
    conn.providerMediaHandler = createProviderMediaCaptureHandler(conn)
    conn.ev.on('messages.upsert', conn.providerMediaHandler)
  } catch {}
  conn.ev.on('connection.update', conn.connectionUpdate)
  conn.ev.on('creds.update', conn.credsUpdate)
  isInit = false
  return true
}

process.on('unhandledRejection', (reason, promise) => {
  console.error("Rechazo no manejado detectado:", reason)
})

// ============================================
// JADIBOT - SUB BOTS
// ============================================
global.rutaJadiBot = join(__dirname, `./${global.jadi}`)

if (global.yukiJadibts) {
  if (!existsSync(global.rutaJadiBot)) {
    mkdirSync(global.rutaJadiBot, { recursive: true })
    console.log(chalk.bold.cyan(`ꕥ La carpeta: ${global.jadi} se creó correctamente.`))
  } else {
    console.log(chalk.bold.cyan(`ꕥ La carpeta: ${global.jadi} ya está creada.`))
  }
  
  const readRutaJadiBot = readdirSync(global.rutaJadiBot)
  if (readRutaJadiBot.length > 0) {
    const creds = 'creds.json'
    for (const gjbts of readRutaJadiBot) {
      const botPath = join(global.rutaJadiBot, gjbts)
      if (existsSync(botPath) && statSync(botPath).isDirectory()) {
        const readBotPath = readdirSync(botPath)
        if (readBotPath.includes(creds)) {
          yukiJadiBot({ pathYukiJadiBot: botPath, m: null, conn, args: '', usedPrefix: '/', command: 'serbot' })
        }
      }
    }
  }
}

// ============================================
// SISTEMA DE PLUGINS
// ============================================
const pluginFolder = global.__dirname(join(__dirname, './plugins/index'))
const pluginFilter = (filename) => /\.js$/.test(filename)
global.plugins = {}

async function filesInit() {
  for (const filename of readdirSync(pluginFolder).filter(pluginFilter)) {
    try {
      const file = global.__filename(join(pluginFolder, filename))
      const module = await import(file)
      global.plugins[filename] = module.default || module
    } catch (e) {
      conn.logger.error(e)
      delete global.plugins[filename]
    }
  }
}

filesInit().then((_) => Object.keys(global.plugins)).catch(console.error)

global.reload = async (_ev, filename) => {
  if (pluginFilter(filename)) {
    const dir = global.__filename(join(pluginFolder, filename), true)
    if (filename in global.plugins) {
      if (existsSync(dir)) conn.logger.info(` updated plugin - '${filename}'`)
      else {
        conn.logger.warn(`deleted plugin - '${filename}'`)
        return delete global.plugins[filename]
      }
    } else conn.logger.info(`new plugin - '${filename}'`)
    
    const err = syntaxerror(readFileSync(dir), filename, {
      sourceType: 'module',
      allowAwaitOutsideFunction: true,
    })
    
    if (err) conn.logger.error(`syntax error while loading '${filename}'\n${format(err)}`)
    else {
      try {
        const module = (await import(`${global.__filename(dir)}?update=${Date.now()}`))
        global.plugins[filename] = module.default || module
      } catch (e) {
        conn.logger.error(`error require plugin '${filename}\n${format(e)}'`)
      } finally {
        global.plugins = Object.fromEntries(Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b)))
      }
    }
  }
}

Object.freeze(global.reload)
watch(pluginFolder, global.reload)
await global.reloadHandler()

// ============================================
// UTILIDADES
// ============================================
async function _quickTest() {
  const test = await Promise.all([
    spawn('ffmpeg'),
    spawn('ffprobe'),
    spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-filter_complex', 'color', '-frames:v', '1', '-f', 'webp', '-']),
    spawn('convert'),
    spawn('magick'),
    spawn('gm'),
    spawn('find', ['--version']),
  ].map((p) => {
    return Promise.race([
      new Promise((resolve) => {
        p.on('close', (code) => {
          resolve(code !== 127)
        })
      }),
      new Promise((resolve) => {
        p.on('error', (_) => resolve(false))
      })
    ])
  }))
  
  const [ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find] = test
  const s = global.support = { ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find }
  Object.freeze(global.support)
}

// Limpieza de archivos temporales
setInterval(async () => {
  const tmpDir = join(__dirname, 'tmp')
  try {
    const filenames = readdirSync(tmpDir)
    filenames.forEach(file => {
      const filePath = join(tmpDir, file)
      unlinkSync(filePath)
    })
    console.log(chalk.gray(`→ Archivos de la carpeta TMP eliminados`))
  } catch {
    console.log(chalk.gray(`→ Los archivos de la carpeta TMP no se pudieron eliminar`))
  }
}, 30 * 1000)

_quickTest().catch(console.error)

async function isValidPhoneNumber(number) {
  try {
    number = number.replace(/\s+/g, '')
    if (number.startsWith('+521')) {
      number = number.replace('+521', '+52')
    } else if (number.startsWith('+52') && number[4] === '1') {
      number = number.replace('+52 1', '+52')
    }
    const parsedNumber = phoneUtil.parseAndKeepRawInput(number)
    return phoneUtil.isValidNumber(parsedNumber)
  } catch (error) {
    return false
  }
}

async function joinChannels(sock) {
  for (const value of Object.values(global.ch)) {
    if (typeof value === 'string' && value.endsWith('@newsletter')) {
      await sock.newsletterFollow(value).catch(() => {})
    }
  }
}

// ============================================
// INICIALIZACIÓN DE SISTEMAS AVANZADOS
// ============================================
console.log(chalk.cyan('🚀 Inicializando sistemas avanzados...'))

try {
  console.log(chalk.cyan('🔧 Iniciando sistemas básicos...'))
  
  const { default: realTimeData } = await import('./lib/real-time-data.js')
  if (!realTimeData.isRunning) {
    realTimeData.start()
    console.log(chalk.green('✅ Sistema de Datos en Tiempo Real iniciado'))
  }
  
  console.log(chalk.green('✅ Sistemas básicos iniciados correctamente'))
  
} catch (error) {
  console.error(chalk.red('❌ Error iniciando sistemas básicos:'), error)
}

// ============================================
// MANEJO DE SEÑALES DEL SISTEMA
// ============================================
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n🛑 Recibida señal SIGINT, cerrando sistemas...'))
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log(chalk.yellow('\n🛑 Recibida señal SIGTERM, cerrando sistemas...'))
  process.exit(0)
})

process.on('uncaughtException', (error) => {
  console.error(chalk.red('💥 Error no capturado:'), error)
})

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('🚫 Promise rechazada no manejada:'), reason)
})

console.log(chalk.magenta('🤖 OguriCap Bot completamente iniciado y listo para usar'))
console.log(chalk.cyan(`📊 Panel disponible en: ${process.env.PANEL_URL || 'https://melodiaauris.qzz.io'}`))
console.log(chalk.gray('💡 Usa Ctrl+C para detener el bot de forma segura'))
