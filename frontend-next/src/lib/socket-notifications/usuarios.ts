import type { ToastPayload } from './types'

export function onUsuarioCreated(data: any): ToastPayload {
  const u      = data?.usuario ?? data
  const nombre = u?.nombre ?? u?.name ?? u?.username ?? u?.email ?? 'nuevo usuario'
  return {
    level:    'info',
    title:    'Nuevo usuario',
    message:  `${nombre} se registró en el panel`,
    duration: 4000,
    dedupKey: `usuario:created:${nombre}`,
  }
}
