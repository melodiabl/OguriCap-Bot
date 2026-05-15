import type { ToastPayload } from './types'

export function onBotConnected(data: any): ToastPayload {
  const phone = data?.phone
  return {
    level:       'system',
    title:       'Bot conectado',
    message:     phone ? `WhatsApp conectado: ${phone}` : 'El bot de WhatsApp está en línea',
    duration:    4000,
    dedupKey:    'bot:connected',
    dedupWindow: 10000,
  }
}

export function onBotDisconnected(data: any): ToastPayload {
  const reason = data?.reason
  return {
    level:       'warning',
    title:       'Bot desconectado',
    message:     reason ? `Desconectado: ${reason}` : 'El bot de WhatsApp se ha desconectado',
    duration:    6000,
    dedupKey:    `bot:disconnected:${reason ?? ''}`,
    dedupWindow: 10000,
  }
}
