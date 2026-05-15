import type { ToastPayload } from './types'

export function onPedidoCreated(data: any): ToastPayload {
  const p  = data?.pedido ?? data
  const id = p?.id ?? p?.pedido_id ?? p?.numero ?? 'N/A'
  return {
    level:    'info',
    title:    'Nuevo pedido',
    message:  `Pedido #${id}${p?.cliente ? ` — ${p.cliente}` : ''} creado`,
    dedupKey: `pedido:created:${id}`,
  }
}

export function onPedidoUpdated(data: any): ToastPayload {
  const p      = data?.pedido ?? data
  const id     = p?.id ?? p?.pedido_id ?? 'N/A'
  const estado = p?.estado ?? p?.status
  return {
    level:    'success',
    title:    'Pedido actualizado',
    message:  `Pedido #${id}${estado ? ` → ${estado}` : ''}`,
    duration: 3000,
    dedupKey: `pedido:updated:${id}:${estado ?? ''}`,
  }
}

export function onPedidoDeleted(data: any): ToastPayload {
  const id = data?.pedidoId ?? data?.id ?? 'N/A'
  return {
    level:    'warning',
    title:    'Pedido eliminado',
    message:  `Pedido #${id} fue eliminado`,
    duration: 4000,
    dedupKey: `pedido:deleted:${id}`,
  }
}
