import type { ToastPayload } from './types'

export function onGrupoUpdated(data: any): ToastPayload {
  const g      = data?.grupo ?? data
  const nombre = g?.nombre ?? g?.name ?? g?.subject ?? 'desconocido'
  return {
    level:       'info',
    title:       'Grupo actualizado',
    message:     `Grupo "${nombre}" fue modificado`,
    duration:    3000,
    dedupKey:    `grupo:updated:${nombre}`,
    dedupWindow: 3000,
  }
}

export function onGrupoSynced(data: any): ToastPayload {
  const count = Array.isArray(data?.grupos) ? data.grupos.length : '?'
  return {
    level:       'success',
    title:       'Grupos sincronizados',
    message:     `${count} grupos actualizados desde WhatsApp`,
    duration:    5000,
    dedupKey:    'grupo:synced',
    dedupWindow: 10000,
  }
}
