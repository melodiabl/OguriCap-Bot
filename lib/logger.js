import pino from 'pino'
import { createRequire } from 'module'

const _require = createRequire(import.meta.url)

function hasPinoPretty() {
  try { _require.resolve('pino-pretty'); return true } catch { return false }
}

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(hasPinoPretty() && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, ignore: 'pid,hostname,src', translateTime: 'HH:MM:ss' },
    },
  }),
})

export function patchConsole() {
  // no-op: preserve the bot's own color/emoji formatting
}
