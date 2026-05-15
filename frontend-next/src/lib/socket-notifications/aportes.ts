import type { ToastPayload } from './types'

export function onAporteCreated(data: any): ToastPayload {
  const a  = data?.aporte ?? data
  const id = a?.id ?? a?.aporte_id ?? 'N/A'
  return {
    level:    'info',
    title:    'Nuevo aporte',
    message:  `Aporte #${id}${a?.monto ? ` — $${a.monto}` : ''} registrado`,
    dedupKey: `aporte:created:${id}`,
  }
}

export function onAporteUpdated(data: any): ToastPayload {
  const a  = data?.aporte ?? data
  const id = a?.id ?? a?.aporte_id ?? 'N/A'
  return {
    level:    'success',
    title:    'Aporte actualizado',
    message:  `Aporte #${id} actualizado`,
    duration: 3000,
    dedupKey: `aporte:updated:${id}`,
  }
}

export function onAporteDeleted(data: any): ToastPayload {
  const id = data?.aporteId ?? data?.id ?? 'N/A'
  return {
    level:    'warning',
    title:    'Aporte eliminado',
    message:  `Aporte #${id} fue eliminado`,
    duration: 4000,
    dedupKey: `aporte:deleted:${id}`,
  }
}
