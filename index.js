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
import { Low, JSONFile } from 'lowdb'
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

global.db = new Low(/https?:\/\//.test(global.opts['db'] || '') ? new cloudDBAdapter(global.opts['db']) : new JSONFile('database.json'))
global.DATABASE = global.db
global.loadDatabase = async function loadDatabase() {
if (global.db.READ) {
return new Promise((resolve) => setInterval(async function () {
if (!global.db.READ) {
clearInterval(this)
resolve(global.db.data == null ? global.loadDatabase() : global.db.data)
}}, 1 * 1000))
}
if (global.db.data !== null) return
global.db.READ = true
await global.db.read().catch(console.error)
global.db.READ = null
global.db.data = {
users: {},
chats: {},
settings: {},
...(global.db.data || {}),
}
global.db.chain = chain(global.db.data)
}
loadDatabase()

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

if (methodCodeQR) {
opcion = '1'
}
if (!methodCodeQR && !methodCode && !fs.existsSync(`./${global.sessions}/creds.json`)) {
if (noPrompt) {
  // Modo panel: usar QR por defecto sin preguntar
  opcion = '1'
  console.log(chalk.cyan('[ ✿ ] Modo panel activo - Usando QR por defecto'))
  console.log(chalk.cyan('[ ✿ ] Puedes conectar desde el panel web o escanear el QR en la terminal'))
} else {
  // Modo terminal: preguntar al usuario
  do {
  opcion = await question(colors("Seleccione una opción:\n") + qrOption("1. Con código QR\n") + textOption("2. Con código de texto de 8 dígitos\n--> "))
  if (!/^[1-2]$/.test(opcion)) {
  console.log(chalk.bold.redBright(`No se permiten numeros que no sean 1 o 2, tampoco letras o símbolos especiales.`))
  }} while (opcion !== '1' && opcion !== '2' || fs.existsSync(`./${global.sessions}/creds.json`))
}
}
console.info = () => {}
const connectionOptions = {
logger: pino({ level: 'silent' }),
printQRInTerminal: opcion == '1' ? true : methodCodeQR ? true : false,
mobile: MethodMobile,
browser: ["MacOs", "Safari"],
auth: {
creds: state.creds,
keys: makeCacheableSignalKeyStore(state.keys, Pino({ level: "fatal" }).child({ level: "fatal" })),
},
markOnlineOnConnect: false,
generateHighQualityLinkPreview: true,
syncFullHistory: false,
getMessage: async (key) => {
try {
let jid = jidNormalizedUser(key.remoteJid)
let msg = await store.loadMessage(jid, key.id)
return msg?.message || ""
} catch (error) {
return ""
}},
msgRetryCounterCache: msgRetryCounterCache || new Map(),
userDevicesCache: userDevicesCache || new Map(),
defaultQueryTimeoutMs: undefined,
cachedGroupMetadata: (jid) => global.conn.chats[jid] ?? {},
version: version,
keepAliveIntervalMs: 55000,
maxIdleTimeMs: 60000,
}
global.conn = makeWASocket(connectionOptions)
conn.ev.on("creds.update", saveCreds)

// Iniciar Panel API
if (process.env.PANEL_API !== '0') {
try {
const { startPanelApi } = await import('./lib/panel-api.js')
startPanelApi({ port: process.env.PANEL_PORT || PORT }).catch(console.error)
} catch (e) {
console.error('panel-api error:', e)
}}

if (!fs.existsSync(`./${global.sessions}/creds.json`)) {
if (opcion === '2' || methodCode) {
opcion = '2'
if (!conn.authState.creds.registered) {
let addNumber
if (!!phoneNumber) {
addNumber = phoneNumber.replace(/[^0-9]/g, '')
} else {
do {
phoneNumber = await question(chalk.bgBlack(chalk.bold.greenBright(`[ ✿ ]  Por favor, Ingrese el número de WhatsApp.\n${chalk.bold.magentaBright('---> ')}`)))
phoneNumber = phoneNumber.replace(/\D/g, '')
if (!phoneNumber.startsWith('+')) {
phoneNumber = `+${phoneNumber}`
}} while (!await isValidPhoneNumber(phoneNumber))
rl.close()
addNumber = phoneNumber.replace(/\D/g, '')
setTimeout(async () => {
let codeBot = await conn.requestPairingCode(addNumber)
codeBot = codeBot.match(/.{1,4}/g)?.join("-") || codeBot
console.log(chalk.bold.white(chalk.bgMagenta(`[ ✿ ]  Código:`)), chalk.bold.white(chalk.white(codeBot)))
}, 3000)
}}}}
conn.isInit = false
conn.well = false
conn.logger.info(`[ ✿ ]  H E C H O\n`)
if (!opts['test']) {
if (global.db) setInterval(async () => {
if (global.db.data) await global.db.write()
if (opts['autocleartmp'] && (global.support || {}).find) {
const tmp = [os.tmpdir(), 'tmp', `${global.jadi}`]
tmp.forEach((filename) => cp.spawn('find', [filename, '-amin', '3', '-type', 'f', '-delete']))
}}, 30 * 1000)
}

// Variables globales para el panel
global.panelApiMainQr = null
global.panelApiMainDisconnect = false
global.reauthInProgress = false
global.panelApiLastSeen = null
global.stopped = 'connecting' // Estado inicial de conexión

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
// Emitir conexión via Socket.IO
try {
  const { emitBotConnected, emitBotStatus } = await import('./lib/socket-io.js')
  emitBotConnected(conn.user?.id)
  emitBotStatus()
} catch {}
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
console.log(chalk.green.bold(`[ ✿ ]  Escanea este código QR`))
}}
if (connection === "open") {
const userJid = jidNormalizedUser(conn.user.id)
const userName = conn.user.name || conn.user.verifiedName || "Desconocido"
await joinChannels(conn)
console.log(chalk.green.bold(`[ ✿ ]  Conectado a: ${userName}`))
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
}}
process.on('uncaughtException', console.error)
let isInit = true
let handler = await import('./handler.js')
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
global.conn = makeWASocket(connectionOptions, { chats: oldChats })
isInit = true
}
if (!isInit) {
conn.ev.off('messages.upsert', conn.handler)
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
conn.ev.on('connection.update', conn.connectionUpdate)
conn.ev.on('creds.update', conn.credsUpdate)
isInit = false
return true
}
process.on('unhandledRejection', (reason, promise) => {
console.error("Rechazo no manejado detectado:", reason)
})

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
}}}}}

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
}}}
filesInit().then((_) => Object.keys(global.plugins)).catch(console.error)
global.reload = async (_ev, filename) => {
if (pluginFilter(filename)) {
const dir = global.__filename(join(pluginFolder, filename), true)
if (filename in global.plugins) {
if (existsSync(dir)) conn.logger.info(` updated plugin - '${filename}'`)
else {
conn.logger.warn(`deleted plugin - '${filename}'`)
return delete global.plugins[filename]
}} else conn.logger.info(`new plugin - '${filename}'`)
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
}}}}
Object.freeze(global.reload)
watch(pluginFolder, global.reload)
await global.reloadHandler()
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
})}),
new Promise((resolve) => {
p.on('error', (_) => resolve(false))
})])
}))
const [ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find] = test
const s = global.support = { ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find }
Object.freeze(global.support)
}
// Tmp
setInterval(async () => {
const tmpDir = join(__dirname, 'tmp')
try {
const filenames = readdirSync(tmpDir)
filenames.forEach(file => {
const filePath = join(tmpDir, file)
unlinkSync(filePath)})
console.log(chalk.gray(`→ Archivos de la carpeta TMP eliminados`))
} catch {
console.log(chalk.gray(`→ Los archivos de la carpeta TMP no se pudieron eliminar`))
}}, 30 * 1000) 
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
}}

async function joinChannels(sock) {
for (const value of Object.values(global.ch)) {
if (typeof value === 'string' && value.endsWith('@newsletter')) {
await sock.newsletterFollow(value).catch(() => {})
}}}

// ==========================================
// INICIALIZACIÓN DE SISTEMAS AVANZADOS
// ==========================================

console.log(chalk.cyan('🚀 Inicializando sistemas avanzados...'))

// Inicializar sistema de datos en tiempo real PRIMERO
try {
  const { default: realTimeData } = await import('./lib/real-time-data.js')
  realTimeData.start()
  console.log(chalk.green('✅ Sistema de Datos en Tiempo Real iniciado'))
} catch (error) {
  console.error(chalk.red('❌ Error iniciando sistema de datos en tiempo real:'), error)
}

// Inicializar sistemas de monitoreo y reportes
try {
  // Sistema de métricas
  const { default: metricsSystem } = await import('./lib/metrics-system.js')
  metricsSystem.start()
  console.log(chalk.green('✅ Sistema de Métricas iniciado'))
  
  // Sistema de alertas inteligentes
  const { default: intelligentAlerts } = await import('./lib/intelligent-alerts.js')
  intelligentAlerts.start()
  console.log(chalk.green('✅ Sistema de Alertas Inteligentes iniciado'))
  
  // Sistema de reportes
  const { default: reportingSystem } = await import('./lib/reporting-system.js')
  reportingSystem.start()
  console.log(chalk.green('✅ Sistema de Reportes iniciado'))
  
  // Sistemas existentes (si no están ya iniciados)
  // Temporarily disable system initializations to fix 502 errors
  // try {
  //   const { default: resourceMonitor } = await import('./lib/resource-monitor.js')
  //   if (!resourceMonitor.isRunning) {
  //     resourceMonitor.start()
  //     console.log(chalk.green('✅ Monitor de Recursos iniciado'))
  //   }
  // } catch (e) {
  //   console.log(chalk.yellow('⚠️ Monitor de Recursos ya iniciado o no disponible'))
  // }
  
  // try {
  //   const { default: logManager } = await import('./lib/log-manager.js')
  //   if (!logManager.isRunning) {
  //     logManager.start()
  //     console.log(chalk.green('✅ Gestor de Logs iniciado'))
  //   }
  // } catch (e) {
  //   console.log(chalk.yellow('⚠️ Gestor de Logs ya iniciado o no disponible'))
  // }
  
  // try {
  //   const { default: alertSystem } = await import('./lib/alert-system.js')
  //   if (!alertSystem.isRunning) {
  //     alertSystem.start()
  //     console.log(chalk.green('✅ Sistema de Alertas iniciado'))
  //   }
  // } catch (e) {
  //   console.log(chalk.yellow('⚠️ Sistema de Alertas ya iniciado o no disponible'))
  // }
  
  // try {
  //   const { default: taskScheduler } = await import('./lib/task-scheduler.js')
  //   if (!taskScheduler.isRunning) {
  //     taskScheduler.start()
  //     console.log(chalk.green('✅ Programador de Tareas iniciado'))
  //   }
  // } catch (e) {
  //   console.log(chalk.yellow('⚠️ Programador de Tareas ya iniciado o no disponible'))
  // }
  
  // try {
  //   const { default: backupSystem } = await import('./lib/backup-system.js')
  //   if (!backupSystem.isRunning) {
  //     backupSystem.start()
  //     console.log(chalk.green('✅ Sistema de Backups iniciado'))
  //   }
  // } catch (e) {
  //   console.log(chalk.yellow('⚠️ Sistema de Backups ya iniciado o no disponible'))
  // }
  
  // Temporarily disable system initialization to fix 502 errors
  // try {
  //   const { default: notificationSystem } = await import('./lib/notification-system.js')
  //   if (!notificationSystem.isRunning) {
  //     notificationSystem.start()
  //     console.log(chalk.green('✅ Sistema de Notificaciones iniciado'))
  //   }
  // } catch (e) {
  //   console.log(chalk.yellow('⚠️ Sistema de Notificaciones ya iniciado o no disponible'))
  // }
  
  // try {
  //   const { default: securityMonitor } = await import('./lib/security-monitor.js')
  //   if (!securityMonitor.isRunning) {
  //     securityMonitor.start()
  //     console.log(chalk.green('✅ Monitor de Seguridad iniciado'))
  //   }
  // } catch (e) {
  //   console.log(chalk.yellow('⚠️ Monitor de Seguridad ya iniciado o no disponible'))
  // }
  
  // Configurar alertas inteligentes para métricas críticas
  intelligentAlerts.addAlert('critical_cpu', 'system.cpu', 'gt', 95, async (metric, alert) => {
    console.log(chalk.red(`🚨 ALERTA CRÍTICA: CPU al ${JSON.stringify(metric.value)}%`))
  })
  
  intelligentAlerts.addAlert('critical_memory', 'system.memory', 'gt', 90, async (metric, alert) => {
    console.log(chalk.red(`🚨 ALERTA CRÍTICA: Memoria al ${JSON.stringify(metric.value)}%`))
  })
  
  intelligentAlerts.addAlert('bot_disconnected', 'bot.connections', 'custom', null, async (metric, alert) => {
    if (metric.value.mainBot === 0) {
      console.log(chalk.red('🚨 ALERTA CRÍTICA: Bot principal desconectado'))
    }
  })
  
  // Programar reporte diario automático
  setTimeout(() => {
    reportingSystem.generateDailyReport({ notify: true }).catch(console.error)
  }, 60000) // Después de 1 minuto de iniciado
  
  console.log(chalk.green('🎉 Todos los sistemas avanzados iniciados correctamente'))
  
} catch (error) {
  console.error(chalk.red('❌ Error inicializando sistemas avanzados:'), error)
}

// ==========================================
// MANEJO DE SEÑALES DEL SISTEMA
// ==========================================

// Manejo graceful de cierre del proceso
process.on('SIGINT', async () => {
  console.log(chalk.yellow('\n🛑 Recibida señal SIGINT, cerrando sistemas...'))
  
  try {
    // Detener sistemas avanzados
    const { default: metricsSystem } = await import('./lib/metrics-system.js')
    const { default: intelligentAlerts } = await import('./lib/intelligent-alerts.js')
    const { default: reportingSystem } = await import('./lib/reporting-system.js')
    
    metricsSystem.stop()
    intelligentAlerts.stop()
    reportingSystem.stop()
    
    console.log(chalk.green('✅ Sistemas avanzados detenidos correctamente'))
  } catch (error) {
    console.error(chalk.red('❌ Error deteniendo sistemas:'), error)
  }
  
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log(chalk.yellow('\n🛑 Recibida señal SIGTERM, cerrando sistemas...'))
  
  try {
    // Generar reporte final antes de cerrar
    const { default: reportingSystem } = await import('./lib/reporting-system.js')
    await reportingSystem.generateReport('shutdown', { 
      notify: false,
      filename: `shutdown-report-${Date.now()}.json`
    })
    
    console.log(chalk.green('✅ Reporte de cierre generado'))
  } catch (error) {
    console.error(chalk.red('❌ Error generando reporte de cierre:'), error)
  }
  
  process.exit(0)
})

// Manejo de errores no capturados
process.on('uncaughtException', async (error) => {
  console.error(chalk.red('💥 Error no capturado:'), error)
  
  try {
    // Log del error crítico
    const { default: logManager } = await import('./lib/log-manager.js')
    logManager.error('Uncaught Exception', error)
    
    // Notificar error crítico
    const { default: notificationSystem } = await import('./lib/notification-system.js')
    await notificationSystem.send({
      type: 'critical_error',
      title: '💥 Error Crítico del Sistema',
      message: `Error no capturado: ${error.message}`,
      data: { error: error.stack }
    })
  } catch (notifError) {
    console.error('Error enviando notificación de error crítico:', notifError)
  }
  
  // No hacer exit automático para permitir recuperación
})

process.on('unhandledRejection', async (reason, promise) => {
  console.error(chalk.red('🚫 Promise rechazada no manejada:'), reason)
  
  try {
    // Log del error
    const { default: logManager } = await import('./lib/log-manager.js')
    logManager.error('Unhandled Promise Rejection', { reason, promise })
  } catch (logError) {
    console.error('Error loggeando promise rejection:', logError)
  }
})

console.log(chalk.magenta('🤖 OguriCap Bot completamente iniciado y listo para usar'))
console.log(chalk.cyan(`📊 Panel disponible en: ${process.env.PANEL_URL || 'https://oguricap.ooguy.com'}`))
console.log(chalk.gray('💡 Usa Ctrl+C para detener el bot de forma segura'))