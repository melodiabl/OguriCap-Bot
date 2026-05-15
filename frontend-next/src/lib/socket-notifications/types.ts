export type ToastLevel = 'success' | 'error' | 'warning' | 'info' | 'system'

export interface ToastPayload {
  level:       ToastLevel
  title:       string
  message?:    string
  duration?:   number
  /** Clave única para deduplicación */
  dedupKey:    string
  /** Ventana de deduplicación en ms (default 5000) */
  dedupWindow?: number
}

export type EventHandler<T = any> = (data: T) => ToastPayload | null
