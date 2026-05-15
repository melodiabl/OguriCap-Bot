import pino from 'pino'
import { createRequire } from 'module'

const isDev = process.env.NODE_ENV !== 'production'
const _require = createRequire(import.meta.url)

function hasPinoPretty() {
  try { _require.resolve('pino-pretty'); return true } catch { return false }
}

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(isDev && hasPinoPretty() && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, ignore: 'pid,hostname', translateTime: 'HH:MM:ss' },
    },
  }),
})

function fmt(args) {
  return args.map(a => (a !== null && typeof a === 'object') ? JSON.stringify(a) : String(a ?? '')).join(' ')
}

export function patchConsole() {
  const child = logger.child({ src: 'console' })
  console.log   = (...a) => child.info(fmt(a))
  console.info  = (...a) => child.info(fmt(a))
  console.warn  = (...a) => child.warn(fmt(a))
  console.error = (...a) => child.error(fmt(a))
  console.debug = (...a) => child.debug(fmt(a))
}
