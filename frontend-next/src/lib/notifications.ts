/**
 * notifications.ts — Canal único de notificaciones
 *
 * Uso:
 *   import { notifications, notify } from '@/lib/notifications'
 *   notifications.success('Título', { message: 'Detalle' })
 *   notifications.requestWebPush()
 */

import { notify as _u, setGlobalNotify as _set } from '@/contexts/UnifiedNotificationContext'

export { setGlobalNotify } from '@/contexts/UnifiedNotificationContext'

type Level = 'success' | 'error' | 'warning' | 'info' | 'system'

interface Options {
  message?: string
  duration?: number
  title?: string
  webPush?: boolean
  [k: string]: unknown
}

// ─── Web Push ────────────────────────────────────────────────────────────────

export async function requestWebPush(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  return Notification.requestPermission()
}

function webPush(title: string, message?: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  if (document.visibilityState !== 'hidden') return
  try { new Notification(title, { body: message, icon: '/bot-icon.svg', tag: title }) } catch {}
}

// ─── Canal unificado ─────────────────────────────────────────────────────────

function send(level: Level, title: string, options?: Options) {
  _u[level](title, options?.message)
  if (options?.webPush !== false) webPush(title, options?.message)
}

/** API orientada a título + opciones (para código nuevo) */
export const notifications = {
  success: (title: string, options?: Options) => send('success', title, options),
  error:   (title: string, options?: Options) => send('error',   title, options),
  warning: (title: string, options?: Options) => send('warning', title, options),
  info:    (title: string, options?: Options) => send('info',    title, options),
  system:  (title: string, options?: Options) => send('system',  title, options),
  requestWebPush,
}

/** API orientada a mensaje (compatibilidad con código existente que usa notify.*) */
export const notify = {
  success: (message: string, options?: Options) => send('success', options?.title ?? message, { ...options, message: options?.title ? message : undefined }),
  error:   (message: string, options?: Options) => send('error',   options?.title ?? message, { ...options, message: options?.title ? message : undefined }),
  warning: (message: string, options?: Options) => send('warning', options?.title ?? message, { ...options, message: options?.title ? message : undefined }),
  info:    (message: string, options?: Options) => send('info',    options?.title ?? message, { ...options, message: options?.title ? message : undefined }),
  system:  (message: string, options?: Options) => send('system',  options?.title ?? message, { ...options, message: options?.title ? message : undefined }),
  dismiss: (_id?: string) => {},
}
