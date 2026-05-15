'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { NotificationStack, StackNotification } from '@/components/notifications/NotificationStack'

type NotificationType = 'success' | 'error' | 'warning' | 'info' | 'system'

interface NotificationOptions {
  message?: string
  duration?: number
  action?: {
    label: string
    onClick: () => void
  }
}

interface UnifiedNotificationContextValue {
  success: (title: string, options?: NotificationOptions) => void
  error: (title: string, options?: NotificationOptions) => void
  warning: (title: string, options?: NotificationOptions) => void
  info: (title: string, options?: NotificationOptions) => void
  system: (title: string, options?: NotificationOptions) => void
  dismiss: (id: string) => void
  dismissAll: () => void
}

const UnifiedNotificationContext = createContext<UnifiedNotificationContextValue | undefined>(undefined)

const DEFAULT_DURATIONS: Record<NotificationType, number> = {
  success: 4000,
  error: 6000,
  warning: 5000,
  info: 4000,
  system: 5000
}

export function UnifiedNotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<StackNotification[]>([])

  const addNotification = useCallback((
    type: NotificationType,
    title: string,
    options?: NotificationOptions
  ) => {
    const notification: StackNotification = {
      id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      message: options?.message,
      duration: options?.duration ?? DEFAULT_DURATIONS[type],
      timestamp: Date.now(),
      action: options?.action
    }
    setNotifications(prev => [notification, ...prev].slice(0, 10))

    // Web Push cuando la pestaña está en segundo plano
    if (typeof window !== 'undefined' && document.visibilityState === 'hidden' && (window as any).Notification?.permission === 'granted') {
      try { new (window as any).Notification(title, { body: options?.message, icon: '/bot-icon.svg', tag: title }) } catch {}
    }
  }, [])

  const success = useCallback((title: string, options?: NotificationOptions) => addNotification('success', title, options), [addNotification])
  const error   = useCallback((title: string, options?: NotificationOptions) => addNotification('error', title, options), [addNotification])
  const warning = useCallback((title: string, options?: NotificationOptions) => addNotification('warning', title, options), [addNotification])
  const info    = useCallback((title: string, options?: NotificationOptions) => addNotification('info', title, options), [addNotification])
  const system  = useCallback((title: string, options?: NotificationOptions) => addNotification('system', title, options), [addNotification])

  const dismiss    = useCallback((id: string) => setNotifications(prev => prev.filter(n => n.id !== id)), [])
  const dismissAll = useCallback(() => setNotifications([]), [])

  const value = { success, error, warning, info, system, dismiss, dismissAll }

  useEffect(() => { setGlobalNotify(value) }, [])

  return (
    <UnifiedNotificationContext.Provider value={value}>
      {children}
      <NotificationStack
        notifications={notifications}
        onDismiss={dismiss}
        position="top-right"
        maxVisible={5}
      />
    </UnifiedNotificationContext.Provider>
  )
}

export function useUnifiedNotifications() {
  const context = useContext(UnifiedNotificationContext)
  if (!context) throw new Error('useUnifiedNotifications must be used within UnifiedNotificationProvider')
  return context
}

// Export global para usar fuera de componentes React
let globalNotify: UnifiedNotificationContextValue | null = null

export function setGlobalNotify(notify: UnifiedNotificationContextValue) {
  globalNotify = notify
}

export const notify = {
  success: (title: string, message?: string) => globalNotify?.success(title, { message }),
  error:   (title: string, message?: string) => globalNotify?.error(title, { message }),
  warning: (title: string, message?: string) => globalNotify?.warning(title, { message }),
  info:    (title: string, message?: string) => globalNotify?.info(title, { message }),
  system:  (title: string, message?: string) => globalNotify?.system(title, { message })
}
