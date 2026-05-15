import type { ToastPayload } from './types'

export function onSubbotCreated(data: any): ToastPayload {
  const code = (data?.subbot ?? data)?.subbotCode ?? (data?.subbot ?? data)?.code ?? 'nuevo'
  return {
    level:    'success',
    title:    'Subbot creado',
    message:  `Subbot ${code} fue creado`,
    duration: 4000,
    dedupKey: `subbot:created:${code}`,
  }
}

export function onSubbotConnected(data: any): ToastPayload {
  const code = data?.subbotCode ?? data?.phone ?? data?.code ?? 'desconocido'
  return {
    level:       'success',
    title:       'Subbot conectado',
    message:     `Subbot ${code} está en línea`,
    duration:    4000,
    dedupKey:    `subbot:connected:${code}`,
    dedupWindow: 10000,
  }
}

export function onSubbotDisconnected(data: any): ToastPayload {
  const code   = data?.subbotCode ?? data?.phone ?? data?.code ?? 'desconocido'
  const reason = data?.reason
  return {
    level:       'warning',
    title:       'Subbot desconectado',
    message:     reason ? `${code}: ${reason}` : `Subbot ${code} se desconectó`,
    duration:    4000,
    dedupKey:    `subbot:disconnected:${code}`,
    dedupWindow: 10000,
  }
}

export function onSubbotDeleted(data: any): ToastPayload {
  const code = data?.subbotCode ?? data?.code ?? 'desconocido'
  return {
    level:    'warning',
    title:    'Subbot eliminado',
    message:  `Subbot ${code} fue eliminado`,
    duration: 4000,
    dedupKey: `subbot:deleted:${code}`,
  }
}
