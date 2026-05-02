process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1'
process.env.TZ = process.env.TZ || 'America/Argentina/Buenos_Aires'
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

    if (!global.__pgDatabaseInstance) global.__pgDatabaseInstance = Database
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
const hasMainSessionCreds = fs.existsSync(`./${global.sessions}/creds.json`)

// Modo no interactivo para panel/containers (sin depender de NO_PROMPT)
const noPromptEnv = ['1', 'true', 'yes'].includes(String(process.env.NO_PROMPT || '').toLowerCase())
const runningInContainer = fs.existsSync('/.dockerenv') || process.env.CONTAINER === '1'
const noPrompt =
  process.argv.includes('--no-prompt') ||
  noPromptEnv ||
  !process.stdin.isTTY ||
  (runningInContainer && process.env.PANEL_API !== '0')
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
  // Preferir configuracion real (Postgres / global.db)
  const cfg = global.db?.data?.panel?.whatsapp || null
  if (cfg) {
    panelAuthMethod = cfg?.authMethod === 'pairing' ? 'pairing' : 'qr'
    panelPairingPhone = cfg?.pairingPhone ? String(cfg.pairingPhone).replace(/[^0-9]/g, '') : null
  } else {
    // Fallback legacy (si existe database.json)
    const dbPath = path.join(__dirname, 'database.json')
    if (fs.existsSync(dbPath)) {
      const dbData = JSON.parse(fs.readFileSync(dbPath, 'utf-8'))
      const whatsappConfig = dbData?.panel?.whatsapp || dbData?.whatsapp || {}
      panelAuthMethod = whatsappConfig?.authMethod || 'qr'
      panelPairingPhone = whatsappConfig?.pairingPhone || null
    }
  }

  console.log(chalk.cyan(`[ ✿ ] Método de auth del panel: ${panelAuthMethod}`))
  if (panelAuthMethod === 'pairing' && panelPairingPhone) {
    console.log(chalk.cyan(`[ ✿ ] Número de pairing: ${panelPairingPhone}`))
  }
} catch (e) {
  console.warn(chalk.yellow('⚠️  No se pudo leer configuración del panel, usando valores por defecto'))
}

// Exponer para el panel y reconexiones
global.panelAuthMethod = panelAuthMethod
global.panelPairingPhone = panelPairingPhone
const shouldWaitForPanelAuthChoice = noPrompt && !methodCodeQR && !methodCode && !hasMainSessionCreds

// ============================================
// SELECCIÓN DE MÉTODO DE AUTENTICACIÓN
// ============================================
if (methodCodeQR) {
  opcion = '1'
}

if (!methodCodeQR && !methodCode && !hasMainSessionCreds) {
  if (noPrompt) {
    if (shouldWaitForPanelAuthChoice) {
      console.log(chalk.cyan('[ ✿ ] Modo panel activo - Esperando que la API/panel elija el método de autenticación'))
      console.log(chalk.cyan('[ ✿ ] No se iniciará QR ni pairing automáticamente hasta que el panel lo solicite'))
    } else if (panelAuthMethod === 'pairing' && panelPairingPhone) {
      opcion = '2'
      phoneNumber = panelPairingPhone
      console.log(chalk.cyan('[ ✿ ] Modo panel activo - Usando código de emparejamiento'))
    } else {
      opcion = '1'
      console.log(chalk.cyan('[ ✿ ] Modo panel activo - Usando QR por defecto'))
    }
    console.log(chalk.cyan('[ ✿ ] Puedes conectar desde el panel web y elegir QR o código cuando quieras'))
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

// Inicializar jerarquía global de bots para el sistema antibot
try {
  global.botHierarchy = global.botHierarchy || { parent: null, subbots: [] }
  if (!Array.isArray(global.botHierarchy.subbots)) global.botHierarchy.subbots = []
} catch {
  global.botHierarchy = { parent: null, subbots: [] }
}

global.conn.ev.on("creds.update", saveCreds)

// ============================================
// INICIAR PANEL API
// ============================================
if (process.env.PANEL_API !== '0') {
  try {
    const { startPanelApi } = await import('./api/api.js')
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
if (!hasMainSessionCreds) {
  const shouldAutoPairingBootstrap = !noPrompt || methodCode
  if ((opcion === '2' || methodCode || panelAuthMethod === 'pairing') && shouldAutoPairingBootstrap) {
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
      
      // Generar código de emparejamiento
      setTimeout(async () => {
        try {
          console.log(chalk.cyan('[ ✿ ] Solicitando código de emparejamiento...'))

          const response = typeof global.getMainPairingCode === 'function'
            ? await global.getMainPairingCode({ force: true, phoneNumber: addNumber })
            : null
          const codeBot = response?.pairingCode || null

          if (!codeBot) {
            throw new Error(response?.message || 'No se pudo generar código de emparejamiento')
          }

          console.log(chalk.bold.white(chalk.bgMagenta(`[ ✿ ] Código de Emparejamiento:`)), chalk.bold.white(chalk.white(codeBot)))
          console.log(chalk.cyan('[ ✿ ] Ingresa este código en WhatsApp: Dispositivos Vinculados > Vincular Dispositivo > Vincular con número de teléfono'))
        } catch (error) {
          console.error(chalk.red('❌ Error generando código:'), error.message)
        }
      }, 3000)
    }
  }
}

global.conn.isInit = false
global.conn.well = false
global.conn.logger.info(`[ ✿ ] H E C H O\n`)

if (!opts['test']) {
  if (global.db) setInterval(async () => {
    if (global.db.data) {
      try {
        await global.db.write()
      } catch (err) {
        console.error('[DB] write failed:', err?.message || err)
      }
    }
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
global.panelPairingCode = null
global.panelApiMainDisconnect = false
global.reauthInProgress = false
global.panelApiLastSeen = null
global.stopped = 'connecting'
global.__panelLastConnState ||= null
// Controla si el backend tiene permiso para emitir QR al panel
global.panelAllowQr = false
global.mainPairingGenerationPromise = global.mainPairingGenerationPromise || null

// Estado de autenticacion on-demand (usado por panel-api.js)
global.botAuthState = global.botAuthState || 'DISCONNECTED'
if (global.botAuthState === 'IDLE') global.botAuthState = 'DISCONNECTED'
global.botAuthMethod = global.botAuthMethod || null
global.botAuthPhone = global.botAuthPhone || null
global.authRequestId = global.authRequestId || null

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const newAuthRequestId = (prefix = 'auth') => `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`

const normalizeMainAuthState = (state) => {
  if (state === 'CONNECTED' || state === 'AUTHENTICATING' || state === 'DISCONNECTED') return state
  if (state === 'IDLE') return 'DISCONNECTED'
  return 'DISCONNECTED'
}

const resetMainAuthSession = () => {
  global.botAuthState = 'DISCONNECTED'
  global.botAuthMethod = null
  global.botAuthPhone = null
  global.authRequestId = null
}

const setMainAuthSession = ({ state, method = null, phone = null, requestId = null } = {}) => {
  global.botAuthState = normalizeMainAuthState(state)
  global.botAuthMethod = method || null
  global.botAuthPhone = phone || null
  global.authRequestId = requestId || null
}

const sanitizeMainPhone = (value) => String(value || '').replace(/[^0-9]/g, '')

const normalizeMainPairingCode = (raw) => {
  const cleaned = String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!cleaned || cleaned.length < 8) return null
  if (cleaned.length === 8) return cleaned.match(/.{1,4}/g)?.join('-') || cleaned
  return cleaned.match(/.{1,4}/g)?.slice(0, 3).join('-') || cleaned
}

const sanitizeMainPairKey = (value) => {
  const raw = String(value || '').trim()
  if (!raw) return null
  const cleaned = raw.replace(/[^0-9A-Za-z_-]/g, '').slice(0, 32)
  return cleaned || null
}

const getMaxMainPairingAgeMs = () => {
  const parsed = Number.parseInt(process.env.PANEL_PAIRING_CODE_MAX_AGE_MS || '', 10)
  if (!Number.isFinite(parsed)) return 5 * 60 * 1000
  if (parsed < 30000) return 30000
  if (parsed > 3600000) return 3600000
  return parsed
}

const isFreshMainTimestamp = (ts, maxAgeMs) => {
  if (!ts) return false
  const time = Date.parse(String(ts))
  if (!Number.isFinite(time)) return false
  return Date.now() - time <= maxAgeMs
}

async function persistMainWhatsappConfig(mutator) {
  try {
    if (!global.db?.data) return
    global.db.data.panel ||= {}
    global.db.data.panel.whatsapp ||= {}
    if (typeof mutator === 'function') mutator(global.db.data.panel.whatsapp)
    if (global.db?.write) await global.db.write().catch(() => {})
  } catch {}
}

async function clearStoredMainPairingCode() {
  global.panelPairingCode = null
  void persistMainWhatsappConfig((whatsapp) => {
    whatsapp.pairingCode = null
    whatsapp.pairingUpdatedAt = null
  })
}

async function requestMainPairingCodeNow(phoneNumber, pairKey = null) {
  if (!phoneNumber) {
    return {
      success: false,
      available: false,
      pairingCode: null,
      code: null,
      displayCode: null,
      phoneNumber: null,
      message: 'phoneNumber es requerido',
    }
  }

  if (!global.conn || typeof global.conn.requestPairingCode !== 'function') {
    return {
      success: false,
      available: false,
      pairingCode: null,
      code: null,
      displayCode: null,
      phoneNumber,
      message: 'Conexion no disponible para pairing',
    }
  }

  try {
    const raw = pairKey
      ? await global.conn.requestPairingCode(phoneNumber, pairKey)
      : await global.conn.requestPairingCode(phoneNumber)
    const pairingCode = normalizeMainPairingCode(raw)
    if (!pairingCode) throw new Error('Código de pairing inválido')

    global.panelPairingCode = pairingCode
    global.panelPairingPhone = phoneNumber
    setMainAuthSession({
      state: 'AUTHENTICATING',
      method: 'pairing',
      phone: phoneNumber,
      requestId: global.authRequestId || newAuthRequestId('pair'),
    })

    void persistMainWhatsappConfig((whatsapp) => {
      whatsapp.authMethod = 'pairing'
      whatsapp.pairingPhone = phoneNumber
      whatsapp.pairingCode = pairingCode
      whatsapp.pairingUpdatedAt = new Date().toISOString()
    })

    try {
      const { emitBotPairingCode } = await import('./lib/socket-io.js')
      if (typeof emitBotPairingCode === 'function') emitBotPairingCode(pairingCode, phoneNumber)
    } catch {}

    return {
      success: true,
      available: true,
      pairingCode,
      code: pairingCode,
      displayCode: pairingCode,
      phoneNumber,
    }
  } catch (error) {
    return {
      success: false,
      available: false,
      pairingCode: null,
      code: null,
      displayCode: null,
      phoneNumber,
      message: error?.message || String(error),
    }
  }
}

function ensureMainPairingCodeGeneration(phoneNumber, pairKey = null) {
  if (global.mainPairingGenerationPromise) return global.mainPairingGenerationPromise

  global.mainPairingGenerationPromise = (async () => {
    return await requestMainPairingCodeNow(phoneNumber, pairKey)
  })().finally(() => {
    global.mainPairingGenerationPromise = null
  })

  return global.mainPairingGenerationPromise
}

global.setMainAuthMethod = async function setMainAuthMethod(methodName, phoneNumber = null) {
  const method = methodName === 'pairing' ? 'pairing' : 'qr'
  const digits = method === 'pairing' ? sanitizeMainPhone(phoneNumber) : null

  if (method === 'pairing' && !digits) {
    return { success: false, error: 'phoneNumber invalido', method, phoneNumber: null }
  }

  const prevMethod = (global.panelAuthMethod || panelAuthMethod) === 'pairing' ? 'pairing' : 'qr'
  const prevPhone = sanitizeMainPhone(global.panelPairingPhone || panelPairingPhone)
  const nextPhone = method === 'pairing' ? digits : null
  const shouldInvalidate = method !== 'pairing' || prevMethod !== method || prevPhone !== nextPhone

  panelAuthMethod = method
  panelPairingPhone = nextPhone
  global.panelAuthMethod = method
  global.panelPairingPhone = nextPhone

  if (shouldInvalidate) global.panelPairingCode = null

  void persistMainWhatsappConfig((whatsapp) => {
    whatsapp.authMethod = method
    whatsapp.pairingPhone = nextPhone
    if (shouldInvalidate) {
      whatsapp.pairingCode = null
      whatsapp.pairingUpdatedAt = null
    }
  })

  return { success: true, method, phoneNumber: nextPhone }
}

global.getMainPairingCode = async function getMainPairingCode(options = {}) {
  const force = Boolean(options?.force)
  const wait = options?.wait !== false
  const pairKey = sanitizeMainPairKey(options?.pairKey || options?.customCode)
  const optionPhone = sanitizeMainPhone(options?.phoneNumber)
  const phoneNumber =
    optionPhone ||
    sanitizeMainPhone(global.botAuthPhone) ||
    sanitizeMainPhone(global.panelPairingPhone) ||
    sanitizeMainPhone(global.db?.data?.panel?.whatsapp?.pairingPhone)

  if (!phoneNumber) {
    return {
      success: false,
      available: false,
      pairingCode: null,
      code: null,
      displayCode: null,
      phoneNumber: null,
      message: 'phoneNumber es requerido',
    }
  }

  const methodResult = await global.setMainAuthMethod('pairing', phoneNumber)
  if (!methodResult?.success) {
    return {
      success: false,
      available: false,
      pairingCode: null,
      code: null,
      displayCode: null,
      phoneNumber,
      message: methodResult?.error || 'No se pudo establecer el método pairing',
    }
  }

  const maxAgeMs = getMaxMainPairingAgeMs()
  const cachedCode = normalizeMainPairingCode(global.panelPairingCode || global.db?.data?.panel?.whatsapp?.pairingCode)
  const updatedAt = global.db?.data?.panel?.whatsapp?.pairingUpdatedAt || null

  if (!force && cachedCode && isFreshMainTimestamp(updatedAt, maxAgeMs)) {
    global.panelPairingCode = cachedCode
    global.panelPairingPhone = phoneNumber
    try {
      const { emitBotPairingCode } = await import('./lib/socket-io.js')
      if (typeof emitBotPairingCode === 'function') emitBotPairingCode(cachedCode, phoneNumber)
    } catch {}
    return {
      success: true,
      available: true,
      pairingCode: cachedCode,
      code: cachedCode,
      displayCode: cachedCode,
      phoneNumber,
    }
  }

  await clearStoredMainPairingCode()

  if (!wait) {
    ensureMainPairingCodeGeneration(phoneNumber, pairKey).catch(() => {})
    return {
      success: true,
      available: false,
      pending: true,
      pairingCode: null,
      code: null,
      displayCode: null,
      phoneNumber,
      message: 'Código de pairing en generación',
    }
  }

  return await ensureMainPairingCodeGeneration(phoneNumber, pairKey)
}

// Permite al panel iniciar auth QR bajo demanda
global.startQrAuth = async function startQrAuth() {
  try {
    if (global.stopped === 'open' && global.conn?.user?.id) {
      setMainAuthSession({ state: 'CONNECTED', phone: global.conn.user.id })
      return { success: true, state: 'CONNECTED', phoneNumber: global.conn.user.id }
    }

    const methodResult = await global.setMainAuthMethod('qr')
    if (!methodResult?.success) {
      return { success: false, error: methodResult?.error || 'No se pudo establecer método QR' }
    }

    setMainAuthSession({ state: 'AUTHENTICATING', method: 'qr', requestId: newAuthRequestId('qr') })
    global.panelApiMainDisconnect = false
    global.panelApiMainQr = null
    global.panelAllowQr = true

    if (typeof global.reloadHandler === 'function') {
      void global.reloadHandler(true).catch(() => {
        resetMainAuthSession()
      })
    }

    return { success: true }
  } catch (e) {
    resetMainAuthSession()
    return { success: false, error: e?.message || String(e) }
  }
}

// Permite al panel iniciar auth pairing bajo demanda
global.startPairingAuth = async function startPairingAuth(phoneNumber) {
  try {
    const digits = sanitizeMainPhone(phoneNumber)
    if (!digits) return { success: false, error: 'phoneNumber invalido' }

    if (global.stopped === 'open' && global.conn?.user?.id) {
      setMainAuthSession({ state: 'CONNECTED', phone: global.conn.user.id })
      return { success: true, state: 'CONNECTED', phoneNumber: global.conn.user.id }
    }

    const methodResult = await global.setMainAuthMethod('pairing', digits)
    if (!methodResult?.success) {
      return { success: false, error: methodResult?.error || 'No se pudo establecer método pairing' }
    }

    setMainAuthSession({ state: 'AUTHENTICATING', method: 'pairing', phone: digits, requestId: newAuthRequestId('pair') })
    global.panelApiMainDisconnect = false
    global.panelAllowQr = false
    global.panelApiMainQr = null
    global.panelPairingCode = null

    if (typeof global.reloadHandler === 'function') {
      void global.reloadHandler(true).catch(() => {
        resetMainAuthSession()
      })
    }

    void (async () => {
      await sleep(1200)
      if (typeof global.getMainPairingCode !== 'function') return
      const pairingResult = await global.getMainPairingCode({ force: true, phoneNumber: digits, wait: true })
      if (!pairingResult?.available || !pairingResult?.pairingCode) {
        resetMainAuthSession()
      }
    })().catch(() => {
      resetMainAuthSession()
    })

    return {
      success: true,
      pending: true,
      pairingCode: null,
      displayCode: null,
      phoneNumber: digits,
    }
  } catch (e) {
    resetMainAuthSession()
    return { success: false, error: e?.message || String(e) }
  }
}

// Permite al panel cerrar el proceso de auth y quedar desconectado
global.closeAuthConnection = async function closeAuthConnection() {
  try {
    global.panelApiMainDisconnect = true
    try { global.panelAllowQr = false } catch {}
    try { global.panelApiMainQr = null } catch {}
    try { global.panelPairingCode = null } catch {}
    try { resetMainAuthSession() } catch {}
    try {
      void persistMainWhatsappConfig((whatsapp) => {
        whatsapp.pairingCode = null
        whatsapp.pairingUpdatedAt = null
      })
    } catch {}
    try { global.conn?.ws?.close?.() } catch {}
    try { global.conn?.ev?.removeAllListeners?.() } catch {}
    return { success: true }
  } catch (e) {
    return { success: false, error: e?.message || String(e) }
  }
}

global.getMainAuthStatus = function getMainAuthStatus() {
  const statusRaw = global.stopped || 'unknown'
  const connected = statusRaw === 'open' && Boolean(global.conn?.user?.id)
  let state = normalizeMainAuthState(global.botAuthState)

  if (connected) state = 'CONNECTED'
  if (state === 'CONNECTED' && !connected) state = 'DISCONNECTED'

  const authenticating = state === 'AUTHENTICATING'
  const disconnected = state === 'DISCONNECTED'
  const method = authenticating ? (global.botAuthMethod || null) : null
  const phone = authenticating ? (global.botAuthPhone || null) : (connected ? (global.conn?.user?.id || null) : null)

  return {
    state,
    status: statusRaw,
    connected,
    authenticating,
    disconnected,
    method,
    phone,
    requestId: authenticating ? (global.authRequestId || null) : null,
    qrAvailable: authenticating && method === 'qr' ? Boolean(global.panelApiMainQr) : false,
    pairingCode: authenticating && method === 'pairing' ? (global.panelPairingCode || null) : null,
    phoneNumber: connected ? (global.conn?.user?.id || null) : null,
  }
}

global.startMainAuth = async function startMainAuth(options = {}) {
  const targetMethod = options?.method === 'pairing' ? 'pairing' : 'qr'
  const phoneNumber = targetMethod === 'pairing' ? sanitizeMainPhone(options?.phoneNumber) : null
  const force = Boolean(options?.force)

  if (targetMethod === 'pairing' && !phoneNumber) {
    return { success: false, error: 'phoneNumber es requerido', state: 'DISCONNECTED', method: targetMethod }
  }

  const status = typeof global.getMainAuthStatus === 'function'
    ? global.getMainAuthStatus()
    : {
        state: normalizeMainAuthState(global.botAuthState),
        connected: Boolean(global.stopped === 'open' && global.conn?.user?.id),
        authenticating: normalizeMainAuthState(global.botAuthState) === 'AUTHENTICATING',
        method: global.botAuthMethod || null,
        phone: global.botAuthPhone || null,
        requestId: global.authRequestId || null,
      }

  if (status.connected) {
    return {
      success: true,
      state: 'CONNECTED',
      method: targetMethod,
      message: 'El bot ya está conectado',
      phone: global.conn?.user?.id || null,
    }
  }

  if (status.authenticating && !force) {
    const sameMethod = status.method === targetMethod
    const samePhone = targetMethod !== 'pairing' || String(status.phone || '') === String(phoneNumber || '')

    if (sameMethod && samePhone) {
      return {
        success: true,
        state: 'AUTHENTICATING',
        method: targetMethod,
        message: targetMethod === 'qr' ? 'Autenticación QR ya iniciada' : 'Autenticación por pairing ya iniciada',
        requestId: status.requestId || null,
        pairingCode: targetMethod === 'pairing' ? (global.panelPairingCode || null) : null,
        displayCode: targetMethod === 'pairing' ? (global.panelPairingCode || null) : null,
        phoneNumber: targetMethod === 'pairing' ? phoneNumber : null,
      }
    }
  }

  const shouldReplaceCurrentAuth =
    status.authenticating && (
      force ||
      status.method !== targetMethod ||
      (targetMethod === 'pairing' && String(status.phone || '') !== String(phoneNumber || ''))
    )

  if (shouldReplaceCurrentAuth) {
    try {
      if (typeof global.closeAuthConnection === 'function') await global.closeAuthConnection()
    } catch {}
  }

  if (targetMethod === 'pairing') {
    if (typeof global.startPairingAuth !== 'function') return { success: false, error: 'Función de autenticación no disponible' }
    const result = await global.startPairingAuth(phoneNumber)
    if (!result?.success) return { success: false, error: result?.error || 'Error iniciando autenticación por pairing', state: normalizeMainAuthState(global.botAuthState) }
    return {
      success: true,
      state: 'AUTHENTICATING',
      method: 'pairing',
      message: 'Autenticación por pairing iniciada',
      requestId: global.authRequestId || null,
      pairingCode: result.pairingCode || null,
      displayCode: result.displayCode || result.pairingCode || null,
      phoneNumber: result.phoneNumber || phoneNumber,
    }
  }

  if (typeof global.startQrAuth !== 'function') return { success: false, error: 'Función de autenticación no disponible' }
  const qrResult = await global.startQrAuth()
  if (!qrResult?.success) return { success: false, error: qrResult?.error || 'Error iniciando autenticación QR', state: normalizeMainAuthState(global.botAuthState) }

  return {
    success: true,
    state: 'AUTHENTICATING',
    method: 'qr',
    message: 'Autenticación QR iniciada',
    requestId: global.authRequestId || null,
  }
}

global.disconnectMainAuth = async function disconnectMainAuth() {
  if (typeof global.closeAuthConnection !== 'function') {
    return { success: false, error: 'Función de desconexión no disponible' }
  }
  const result = await global.closeAuthConnection()
  if (!result?.success) return { success: false, error: result?.error || 'Error desconectando' }
  return {
    success: true,
    state: 'DISCONNECTED',
    message: 'Bot desconectado y listo para nueva autenticación',
  }
}

global.handleMainBotBindingApiRoute = async function handleMainBotBindingApiRoute(context = {}) {
  const {
    req,
    res,
    url,
    pathname,
    method,
    panelDb,
    helpers = {},
  } = context

  const json = helpers?.json
  const readJson = helpers?.readJson
  const isOwnerOrAdmin = helpers?.isOwnerOrAdmin
  const formatUptime = helpers?.formatUptime || ((seconds) => `${Math.max(0, Math.floor(Number(seconds) || 0))}s`)

  if (typeof json !== 'function') return false

  const httpMethod = String(method || 'GET').toUpperCase()
  const isPath = (...paths) => paths.includes(pathname)
  const toDigits = (value) => String(value || '').replace(/[^0-9]/g, '')

  const requireAdminControl = () => {
    if (!panelDb) {
      json(res, 500, { error: 'DB no disponible' })
      return false
    }
    if (typeof isOwnerOrAdmin === 'function' && !isOwnerOrAdmin(req, url, panelDb)) {
      json(res, 403, { error: 'Permisos insuficientes' })
      return false
    }
    return true
  }

  if (isPath('/api/bot/status') && httpMethod === 'GET') {
    const statusRaw = global.stopped || 'unknown'
    const connected = statusRaw === 'open'
    const connecting = statusRaw === 'connecting'
    const phone = global.conn?.user?.id || null
    const qr = global.panelApiMainQr || null
    json(res, 200, {
      connected,
      isConnected: connected,
      connecting,
      status: statusRaw,
      connectionStatus: statusRaw,
      phone,
      qrCode: qr,
      uptime: formatUptime(process.uptime()),
      lastSeen: global.panelApiLastSeen || null,
      timestamp: new Date().toISOString(),
    })
    return true
  }

  if (isPath('/api/bot/main/status') && httpMethod === 'GET') {
    const statusRaw = global.stopped || 'unknown'
    const connected = statusRaw === 'open'
    const connecting = statusRaw === 'connecting'
    const phone = global.conn?.user?.id || null
    json(res, 200, {
      connected,
      isConnected: connected,
      connecting,
      status: statusRaw,
      connectionStatus: statusRaw,
      phone,
      uptime: formatUptime(process.uptime()),
      lastSeen: global.panelApiLastSeen || null,
      timestamp: new Date().toISOString(),
    })
    return true
  }

  if (isPath('/api/bot/qr', '/api/bot/main/qr') && httpMethod === 'GET') {
    const qrRaw = global.panelApiMainQr || null
    if (!qrRaw) {
      json(res, 200, { available: false, message: 'QR no disponible' })
      return true
    }
    try {
      const buffer = await qrcode.toBuffer(qrRaw, { scale: 8 })
      json(res, 200, {
        available: true,
        qr: buffer.toString('base64'),
        qrCode: qrRaw,
        status: global.stopped || 'unknown',
      })
    } catch (error) {
      json(res, 500, { error: error?.message || 'No se pudo generar QR' })
    }
    return true
  }

  if (isPath('/api/whatsapp/auth-method', '/api/bot/main/method') && httpMethod === 'POST') {
    if (!requireAdminControl()) return true

    const body = typeof readJson === 'function' ? await readJson(req).catch(() => ({})) : {}
    const methodName = body?.method === 'pairing' ? 'pairing' : 'qr'
    const phoneNumber = body?.phoneNumber ? toDigits(body.phoneNumber) : null

    if (typeof global.setMainAuthMethod !== 'function') {
      json(res, 500, { error: 'Función central de método no disponible' })
      return true
    }

    const result = await global.setMainAuthMethod(methodName, phoneNumber)
    if (!result?.success) {
      json(res, 400, { error: result?.error || 'No se pudo guardar método de autenticación' })
      return true
    }

    json(res, 200, {
      success: true,
      method: result.method || methodName,
      phoneNumber: result.phoneNumber || null,
    })
    return true
  }

  if (isPath('/api/whatsapp/pairing-code', '/api/bot/main/pairing-code') && httpMethod === 'GET') {
    if (!requireAdminControl()) return true

    const force = ['1', 'true', 'yes'].includes(String(url?.searchParams?.get('force') || '').toLowerCase())
    const pairKey = String(
      url?.searchParams?.get('pairKey') ||
      url?.searchParams?.get('pair_key') ||
      url?.searchParams?.get('customCode') ||
      url?.searchParams?.get('custom_code') ||
      ''
    ).trim() || null
    const phoneNumber = panelDb?.whatsapp?.pairingPhone || global.panelPairingPhone || null

    if (typeof global.getMainPairingCode !== 'function') {
      json(res, 500, { error: 'Función central de pairing no disponible' })
      return true
    }

    const result = await global.getMainPairingCode({ force, pairKey, phoneNumber, wait: false })
    json(res, 200, {
      available: Boolean(result?.available),
      pending: Boolean(result?.pending),
      pairingCode: result?.pairingCode || null,
      code: result?.code || result?.pairingCode || null,
      displayCode: result?.displayCode || result?.pairingCode || null,
      phoneNumber: result?.phoneNumber || phoneNumber || null,
      ...(result?.message ? { message: result.message } : {}),
    })
    return true
  }

  if (isPath('/api/bot/auth/qr', '/bot/auth/qr') && httpMethod === 'POST') {
    if (!requireAdminControl()) return true

    const body = typeof readJson === 'function' ? await readJson(req).catch(() => ({})) : {}
    const force = Boolean(body?.force)

    if (typeof global.startMainAuth !== 'function') {
      json(res, 500, { error: 'Función central de autenticación no disponible' })
      return true
    }

    const result = await global.startMainAuth({ method: 'qr', force })
    if (!result?.success) {
      json(res, 500, { error: result?.error || 'Error iniciando autenticación QR' })
      return true
    }

    json(res, 200, {
      success: true,
      state: result.state || 'AUTHENTICATING',
      method: 'qr',
      message: result.message || 'Autenticación QR iniciada',
      requestId: result.requestId || null,
    })
    return true
  }

  if (isPath('/api/bot/auth/pair', '/bot/auth/pair') && httpMethod === 'POST') {
    if (!requireAdminControl()) return true

    const body = typeof readJson === 'function' ? await readJson(req).catch(() => ({})) : {}
    const phoneNumber = body?.phoneNumber ? toDigits(body.phoneNumber) : null
    const force = Boolean(body?.force)

    if (!phoneNumber) {
      json(res, 400, { error: 'phoneNumber es requerido' })
      return true
    }

    if (typeof global.startMainAuth !== 'function') {
      json(res, 500, { error: 'Función central de autenticación no disponible' })
      return true
    }

    const result = await global.startMainAuth({ method: 'pairing', phoneNumber, force })
    if (!result?.success) {
      const statusCode = result?.error === 'phoneNumber es requerido' ? 400 : 500
      json(res, statusCode, { error: result?.error || 'Error iniciando autenticación por pairing' })
      return true
    }

    json(res, 200, {
      success: true,
      state: result.state || 'AUTHENTICATING',
      method: 'pairing',
      message: result.message || 'Autenticación por pairing iniciada',
      requestId: result.requestId || null,
      pairingCode: result.pairingCode || null,
      displayCode: result.displayCode || result.pairingCode || null,
      phoneNumber: result.phoneNumber || phoneNumber,
    })
    return true
  }

  if (isPath('/api/bot/auth/status', '/bot/auth/status') && httpMethod === 'GET') {
    if (typeof global.getMainAuthStatus !== 'function') {
      json(res, 500, { error: 'Función central de estado no disponible' })
      return true
    }
    json(res, 200, global.getMainAuthStatus())
    return true
  }

  if (isPath('/api/bot/auth/disconnect', '/bot/auth/disconnect') && httpMethod === 'POST') {
    if (!requireAdminControl()) return true

    if (typeof global.disconnectMainAuth !== 'function') {
      json(res, 500, { error: 'Función central de desconexión no disponible' })
      return true
    }

    const result = await global.disconnectMainAuth()
    if (!result?.success) {
      json(res, 500, { error: result?.error || 'Error desconectando' })
      return true
    }

    json(res, 200, {
      success: true,
      state: result.state || 'DISCONNECTED',
      message: result.message || 'Bot desconectado y listo para nueva autenticación',
    })
    return true
  }

  return false
}

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

  const capture = (method, nivel) => (...args) => {
    try {
      if (typeof original[method] === 'function') original[method](...args)
      if (shouldDrop()) return

      pushPanelLog({
        tipo: 'terminal',
        nivel,
        mensaje: formatArgs(args),
        metadata: { source: 'console', method },
      })
    } catch {
      try {
        if (typeof original[method] === 'function') original[method](...args)
      } catch {}
    }
  }

  console.log = capture('log', 'info')
  console.warn = capture('warn', 'warn')
  console.error = capture('error', 'error')
  console.info = capture('info', 'info')
  console.debug = capture('debug', 'debug')
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

  if (isNewLogin) global.conn.isInit = true
  const code = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode

  // Actualizar QR para el panel
  if (qr) {
    // Si el método es pairing, no guardar ni emitir QR para evitar bucles
    if ((global.panelAuthMethod || panelAuthMethod) === 'pairing') {
      console.log(chalk.yellow('⚠️  QR recibido pero método es pairing, ignorando...'))
      return
    }

    // Estado de autenticacion para el panel
    try {
      setMainAuthSession({
        state: 'AUTHENTICATING',
        method: 'qr',
        phone: global.botAuthPhone || null,
        requestId: global.authRequestId || newAuthRequestId('qr'),
      })
    } catch {}
    
    // Guardar siempre el último QR generado
    global.panelApiMainQr = qr

    // Si el panel aún no ha pedido ver el QR, no lo emitimos por Socket.IO
    if (!global.panelAllowQr) return

    // Emitir QR via Socket.IO sólo cuando el panel lo haya solicitado
    try {
      const { emitBotQR } = await import('./lib/socket-io.js')
      emitBotQR(qr)
    } catch {}
  }

  // Actualizar último seen
  if (connection === 'open') {
    global.panelApiLastSeen = new Date().toISOString()
    global.stopped = 'open'
    // Ya no necesitamos mostrar QR cuando la conexión está abierta
    global.panelAllowQr = false

    // Registrar bot principal como padre en la jerarquía global (si aún no está)
    try {
      const mainJid = global.conn.user?.id || global.conn.user?.jid || null
      if (mainJid) {
        global.botHierarchy = global.botHierarchy || { parent: null, subbots: [] }
        if (!Array.isArray(global.botHierarchy.subbots)) global.botHierarchy.subbots = []
        if (!global.botHierarchy.parent) global.botHierarchy.parent = mainJid
      }
    } catch {}

    try {
      setMainAuthSession({ state: 'CONNECTED', phone: global.conn?.user?.id || null })
    } catch {}

    // Limpiar código de pairing
    global.panelPairingCode = null
    // Emitir conexión via Socket.IO
    try {
      const { emitBotConnected, emitBotStatus } = await import('./lib/socket-io.js')
      emitBotConnected(global.conn.user?.id)
      emitBotStatus()
      
      // Notificación persistente
      const { sendTemplateNotification } = await import('./lib/notification-system.js')
      sendTemplateNotification('bot_connected')
    } catch {}

    if (global.__panelLastConnState !== 'open') {
      pushPanelLog({
        tipo: 'bot',
        titulo: 'Bot conectado',
        detalles: global.conn.user?.id ? `Conectado como ${global.conn.user.id}` : 'Conexión abierta',
        usuario: global.conn.user?.id || 'bot',
        metadata: { event: 'connection_open' },
      })
    }
  }

  if (connection === 'connecting') {
    global.stopped = 'connecting'
    try {
      const currentState = normalizeMainAuthState(global.botAuthState)
      if (currentState !== 'AUTHENTICATING' && currentState !== 'CONNECTED') {
        setMainAuthSession({
          state: 'AUTHENTICATING',
          method: global.botAuthMethod || global.panelAuthMethod || 'qr',
          phone: global.botAuthPhone || global.panelPairingPhone || null,
          requestId: global.authRequestId || newAuthRequestId('auth'),
        })
      }
    } catch {}
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
    const userJid = jidNormalizedUser(global.conn.user.id)
    const userName = global.conn.user.name || global.conn.user.verifiedName || "Desconocido"
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
    // En desconexión, deshabilitar emisión automática de QR hasta que el panel lo pida de nuevo
    global.panelAllowQr = false
    // Emitir desconexión via Socket.IO
    try {
      const { emitBotDisconnected, emitBotStatus } = await import('./lib/socket-io.js')
      emitBotDisconnected(reason)
      emitBotStatus()

      // Notificación persistente
      const { sendTemplateNotification } = await import('./lib/notification-system.js')
      sendTemplateNotification('bot_disconnected', { reason })
    } catch {}

    if (global.__panelLastConnState !== 'close') {
      pushPanelLog({
        tipo: 'bot',
        titulo: 'Bot desconectado',
        detalles: reason ? `Razón: ${reason}` : 'Conexión cerrada',
        usuario: global.conn.user?.id || 'bot',
        nivel: 'error',
        metadata: { event: 'connection_close', reason: reason || null },
      })
    }

    // Si el panel solicitó desconexión, no reconectar
    if (global.panelApiMainDisconnect) {
      console.log(chalk.yellow("→ Bot desconectado desde el panel"))
      try {
        resetMainAuthSession()
      } catch {}
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

process.on('uncaughtException', async (err) => {
  console.error('❌ Uncaught Exception:', err)
  try {
    const { sendTemplateNotification } = await import('./lib/notification-system.js')
    await sendTemplateNotification('system_error', { 
      error: err?.message || String(err) 
    })
  } catch {}
})

process.on('unhandledRejection', async (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason)
  try {
    const { sendTemplateNotification } = await import('./lib/notification-system.js')
    await sendTemplateNotification('system_error', { 
      error: reason?.message || String(reason) 
    })
  } catch {}
})

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
    global.conn.ev.removeAllListeners()
    
    // Recargar configuración del panel antes de reconectar (preferir in-memory/DB)
    let currentOptions = { ...connectionOptions }
    try {
      const inMemoryWhatsapp = global.db?.data?.panel?.whatsapp || null
      const method = inMemoryWhatsapp?.authMethod === 'pairing' ? 'pairing' : 'qr'
      global.panelAuthMethod = method
      global.panelPairingPhone = inMemoryWhatsapp?.pairingPhone ? String(inMemoryWhatsapp.pairingPhone).replace(/[^0-9]/g, '') : null

      if (method === 'pairing') {
        currentOptions.browser = ["Ubuntu", "Chrome", "20.0.04"]
        currentOptions.printQRInTerminal = false
        console.log(chalk.cyan('[ ✿ ] Reconectando con método pairing'))
      } else {
        currentOptions.browser = ["MacOs", "Safari", "10.0"]
        currentOptions.printQRInTerminal = (opcion == '1' || methodCodeQR)
        console.log(chalk.cyan('[ ✿ ] Reconectando con método QR'))
      }
    } catch (e) {
      console.warn(chalk.yellow('⚠️  Error leyendo config del panel en reload'))
    }

    global.conn = makeWASocket(currentOptions, { chats: oldChats })
    isInit = true
  }
  
  if (!isInit) {
    global.conn.ev.off('messages.upsert', global.conn.handler)
    if (global.conn.providerMediaHandler) global.conn.ev.off('messages.upsert', global.conn.providerMediaHandler)
    global.conn.ev.off('connection.update', global.conn.connectionUpdate)
    global.conn.ev.off('creds.update', global.conn.credsUpdate)
  }
  
  global.conn.handler = handler.handler.bind(global.conn)
  global.conn.connectionUpdate = connectionUpdate.bind(global.conn)
  global.conn.credsUpdate = saveCreds.bind(global.conn, true)
  
  // Sincronizar el nuevo handler.js con todos los SubBots activos
  if (Array.isArray(global.conns)) {
    for (const sock of global.conns) {
      if (sock && sock.ev) {
        sock.ev.off('messages.upsert', sock.handler)
        sock.handler = handler.handler.bind(sock)
        sock.ev.on('messages.upsert', sock.handler)
      }
    }
  }
  
  const currentDateTime = new Date()
  const messageDateTime = new Date(global.conn.ev)
  
  if (currentDateTime >= messageDateTime) {
    const chats = Object.entries(global.conn.chats).filter(([jid, chat]) => !jid.endsWith('@g.us') && chat.isChats).map((v) => v[0])
  } else {
    const chats = Object.entries(global.conn.chats).filter(([jid, chat]) => !jid.endsWith('@g.us') && chat.isChats).map((v) => v[0])
  }
  
  global.conn.ev.on('messages.upsert', global.conn.handler)
  try {
    const { createProviderMediaCaptureHandler } = await import('./lib/provider-media-capture.js')
    global.conn.providerMediaHandler = createProviderMediaCaptureHandler(global.conn)
    global.conn.ev.on('messages.upsert', global.conn.providerMediaHandler)
  } catch {}
  global.conn.ev.on('connection.update', global.conn.connectionUpdate)
  global.conn.ev.on('creds.update', global.conn.credsUpdate)
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
  
  const creds = 'creds.json'

  const readJsonSafe = (filePath) => {
    try {
      if (!filePath) return null
      if (!existsSync(filePath)) return null
      const raw = readFileSync(filePath, 'utf8')
      if (!raw) return null
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  const normalizeWhatsAppNumber = (value) => String(value || '').replace(/[^0-9]/g, '')

  const sanitizeSessionAliasName = (input) => {
    const raw = String(input || '').trim()
    if (!raw) return ''
    try {
      const normalized = raw.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      return normalized
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64)
    } catch {
      return raw
        .replace(/[^a-zA-Z0-9_-]+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 64)
    }
  }

  const deriveSessionDirBaseFromPushname = (pushname) => {
    const sanitized = sanitizeSessionAliasName(pushname)
    if (!sanitized) return ''
    const parts = sanitized.split('_').filter(Boolean)
    const hasLetters = parts.some((p) => /[a-zA-Z]/.test(p))
    if (!hasLetters) return sanitized

    while (parts.length > 1 && /^[0-9]+$/.test(parts[0]) && parts.some((p) => /[a-zA-Z]/.test(p))) {
      parts.shift()
    }
    while (parts.length > 1 && /^[0-9]+$/.test(parts[parts.length - 1]) && parts.some((p) => /[a-zA-Z]/.test(p))) {
      parts.pop()
    }

    const result = parts.join('_').slice(0, 64)
    return result || sanitized
  }

  const readCredsSummary = (dirPath) => {
    try {
      const parsed = readJsonSafe(join(dirPath, creds))
      const me = parsed?.me || parsed?.creds?.me || null
      const jid = String(me?.id || me?.jid || '').trim()
      let base = jid ? jid.split('@')[0] : ''
      if (base.includes(':')) base = base.split(':')[0]
      const phone = base ? normalizeWhatsAppNumber(base) : ''
      const name = String(me?.name || parsed?.name || '').trim()
      return { phone: phone || null, name: name || null }
    } catch {
      return { phone: null, name: null }
    }
  }

  const pickDesiredDirName = ({ root, currentPath, currentDir, phone, name }) => {
    try {
      const base = deriveSessionDirBaseFromPushname(name)
      if (!base) return null
      const last4 = phone ? String(phone).slice(-4) : ''
      const preferSuffix = base.length <= 2
      const candidates = (preferSuffix
        ? [
            last4 ? `${base}_${last4}` : null,
            phone ? `${base}_${phone}` : null,
            base,
            `${base}_${currentDir}`,
          ]
        : [
            base,
            last4 ? `${base}_${last4}` : null,
            phone ? `${base}_${phone}` : null,
            `${base}_${currentDir}`,
          ]
      ).filter(Boolean)
      for (const candRaw of candidates) {
        const cand = sanitizeSessionAliasName(candRaw)
        if (!cand) continue
        if (cand === currentDir) return cand
        const desiredPath = join(root, cand)
        try {
          const st = fs.lstatSync(desiredPath)
          if (st.isSymbolicLink()) {
            // No usamos symlinks en Sessions/SubBot: eliminar y tomar el nombre.
            try { rmSync(desiredPath, { recursive: false, force: true }) } catch {}
            return cand
          }
          continue
        } catch {
          return cand
        }
      }
      return null
    } catch {
      return null
    }
  }

  // Normalizar carpetas reales a pushname (solo carpetas numericas/sb_*).
  try {
    const root = global.rutaJadiBot
    const entries = readdirSync(root, { withFileTypes: true })
    let renamed = 0
    for (const ent of entries) {
      if (ent?.isSymbolicLink?.()) {
        // Limpiar symlinks heredados/anteriores.
        try { rmSync(join(root, ent.name), { recursive: false, force: true }) } catch {}
        continue
      }
      if (!ent?.isDirectory?.()) continue
      const dirName = ent.name
      const currentPath = join(root, dirName)
      if (!existsSync(join(currentPath, creds))) continue

      const summary = readCredsSummary(currentPath)
      const phone = normalizeWhatsAppNumber(summary?.phone || '')
      const name = String(summary?.name || '').trim()
      if (!phone || !name) continue

      const desired = pickDesiredDirName({ root, currentPath, currentDir: dirName, phone, name })
      if (!desired || desired === dirName) continue

      const desiredPath = join(root, desired)
      try {
        fs.renameSync(currentPath, desiredPath)
        renamed++
      } catch {
        // ignore
      }
    }
    if (renamed > 0) console.log(chalk.cyan(`🧩 SubBots: ${renamed} carpeta(s) renombrada(s) a pushname al iniciar`))
  } catch {}

  // Autoiniciar sesiones (solo carpetas reales; no symlinks)
  const readRutaJadiBot = readdirSync(global.rutaJadiBot, { withFileTypes: true })
  if (readRutaJadiBot.length > 0) {
    for (const ent of readRutaJadiBot) {
      if (!ent?.isDirectory?.()) continue
      // Evitar duplicados: NO autoiniciar sesiones desde symlinks/aliases.
      if (ent?.isSymbolicLink?.()) continue

      const gjbts = ent.name
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
      if (global.conn?.logger) global.conn.logger.error(e)
      delete global.plugins[filename]
    }
  }
}

filesInit().then((_) => Object.keys(global.plugins)).catch(console.error)

global.reload = async (_ev, filename) => {
  if (pluginFilter(filename)) {
    const dir = global.__filename(join(pluginFolder, filename), true)
    if (filename in global.plugins) {
      if (existsSync(dir)) global.conn?.logger?.info(` updated plugin - '${filename}'`)
      else {
        global.conn?.logger?.warn(`deleted plugin - '${filename}'`)
        return delete global.plugins[filename]
      }
    } else global.conn?.logger?.info(`new plugin - '${filename}'`)
    
    const err = syntaxerror(readFileSync(dir), filename, {
      sourceType: 'module',
      allowAwaitOutsideFunction: true,
    })
    
    if (err) global.conn?.logger?.error(`syntax error while loading '${filename}'\n${format(err)}`)
    else {
      try {
        const module = (await import(`${global.__filename(dir)}?update=${Date.now()}`))
        global.plugins[filename] = module.default || module
      } catch (e) {
        global.conn?.logger?.error(`error require plugin '${filename}\n${format(e)}'`)
      } finally {
        global.plugins = Object.fromEntries(Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b)))
      }
    }
  }
}

Object.freeze(global.reload)
watch(pluginFolder, global.reload)
await global.reloadHandler()

if (shouldWaitForPanelAuthChoice) {
  try {
    console.log(chalk.cyan('[ ✿ ] Sesión principal vacía - dejando el bot en espera para autenticación on-demand desde la API'))
    if (typeof global.closeAuthConnection === 'function') {
      await global.closeAuthConnection()
    }
    try { resetMainAuthSession() } catch {}
    global.stopped = 'close'
  } catch (e) {
    console.warn(chalk.yellow('⚠️  No se pudo dejar el bot principal en modo espera:'), e?.message || e)
  }
}

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

// Notificación de sistema reiniciado
try {
  if (typeof global.sendTemplateNotification === 'function') {
    global.sendTemplateNotification('system_restart');
  }
} catch {}

const panelUrlForLog =
  (process.env.PANEL_URL || process.env.NEXT_PUBLIC_API_URL || '').trim() ||
  'http://localhost:3000'
console.log(chalk.cyan(`📊 Panel disponible en: ${panelUrlForLog}`))
console.log(chalk.gray('💡 Usa Ctrl+C para detener el bot de forma segura'))
