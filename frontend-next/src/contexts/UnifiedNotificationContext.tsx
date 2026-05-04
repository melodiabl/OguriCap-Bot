'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { NotificationStack, StackNotification } from '@/components/notifications/NotificationStack'
import { useSocketConnection, SOCKET_EVENTS } from './SocketContext'

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
  const socket = useSocketConnection()

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

  // ─── Socket.IO event handlers ────────────────────────────────────────────────
  // Estructura de datos del backend (lib/socket-io.js):
  //   PEDIDO_CREATED/UPDATED  → { pedido: {...}, timestamp }
  //   PEDIDO_DELETED          → { pedidoId, timestamp }
  //   APORTE_CREATED/UPDATED  → { aporte: {...}, timestamp }
  //   APORTE_DELETED          → { aporteId, timestamp }
  //   GRUPO_UPDATED           → { grupo: {...}, timestamp }
  //   GRUPO_SYNCED            → { grupos: [...], timestamp }
  //   BOT_CONNECTED           → { phone, timestamp }
  //   BOT_DISCONNECTED        → { reason, timestamp }
  //   SUBBOT_CONNECTED        → { subbotCode, phone, timestamp }
  //   SUBBOT_DISCONNECTED     → { subbotCode, reason, timestamp }
  //   SUBBOT_CREATED          → { subbot: {...}, timestamp }
  //   SUBBOT_DELETED          → { subbotCode, timestamp }
  //   USUARIO_CREATED         → { usuario: {...}, timestamp }
  //   TASK_CREATED            → { task: {...}, timestamp }
  //   TASK_EXECUTED           → { taskId, taskName, success, ... }
  //   NOTIFICATION            → { id, titulo, mensaje, tipo, categoria, ... }

  useEffect(() => {
    if (!socket) return

    // Pedidos
    const onPedidoCreated = (data: any) => {
      const p = data?.pedido ?? data
      const id = p?.id ?? p?.pedido_id ?? p?.numero ?? 'N/A'
      info('Nuevo pedido', {
        message: `Pedido #${id}${p?.cliente ? ` — ${p.cliente}` : ''} creado`,
        action: { label: 'Ver pedidos', onClick: () => { window.location.href = '/pedidos' } }
      })
    }

    const onPedidoUpdated = (data: any) => {
      const p = data?.pedido ?? data
      const id = p?.id ?? p?.pedido_id ?? 'N/A'
      const estado = p?.estado ?? p?.status
      success('Pedido actualizado', {
        message: `Pedido #${id}${estado ? ` → ${estado}` : ''} actualizado`,
        duration: 3000
      })
    }

    const onPedidoDeleted = (data: any) => {
      const id = data?.pedidoId ?? data?.id ?? 'N/A'
      warning('Pedido eliminado', { message: `Pedido #${id} fue eliminado`, duration: 4000 })
    }

    // Aportes
    const onAporteCreated = (data: any) => {
      const a = data?.aporte ?? data
      const id = a?.id ?? a?.aporte_id ?? 'N/A'
      info('Nuevo aporte', {
        message: `Aporte #${id}${a?.monto ? ` — $${a.monto}` : ''} registrado`,
        action: { label: 'Ver aportes', onClick: () => { window.location.href = '/aportes' } }
      })
    }

    const onAporteUpdated = (data: any) => {
      const a = data?.aporte ?? data
      const id = a?.id ?? a?.aporte_id ?? 'N/A'
      success('Aporte actualizado', { message: `Aporte #${id} actualizado`, duration: 3000 })
    }

    const onAporteDeleted = (data: any) => {
      const id = data?.aporteId ?? data?.id ?? 'N/A'
      warning('Aporte eliminado', { message: `Aporte #${id} fue eliminado`, duration: 4000 })
    }

    // Grupos
    const onGrupoUpdated = (data: any) => {
      const g = data?.grupo ?? data
      const nombre = g?.nombre ?? g?.name ?? g?.subject ?? 'desconocido'
      info('Grupo actualizado', { message: `Grupo "${nombre}" fue modificado`, duration: 3000 })
    }

    const onGrupoSynced = (data: any) => {
      const grupos = data?.grupos
      const count = Array.isArray(grupos) ? grupos.length : '?'
      success('Grupos sincronizados', {
        message: `${count} grupos actualizados desde WhatsApp`,
        duration: 5000
      })
    }

    // Bot principal
    const onBotConnected = (data: any) => {
      const phone = data?.phone
      system('Bot conectado', {
        message: phone ? `WhatsApp conectado: ${phone}` : 'El bot de WhatsApp está en línea',
        duration: 4000
      })
    }

    const onBotDisconnected = (data: any) => {
      const reason = data?.reason
      warning('Bot desconectado', {
        message: reason ? `Desconectado: ${reason}` : 'El bot de WhatsApp se ha desconectado',
        duration: 6000
      })
    }

    // Subbots
    const onSubbotCreated = (data: any) => {
      const s = data?.subbot ?? data
      const code = s?.subbotCode ?? s?.code ?? s?.phone ?? 'nuevo'
      success('Subbot creado', { message: `Subbot ${code} fue creado`, duration: 4000 })
    }

    const onSubbotConnected = (data: any) => {
      const code = data?.subbotCode ?? data?.phone ?? data?.code ?? 'desconocido'
      success('Subbot conectado', { message: `Subbot ${code} está en línea`, duration: 4000 })
    }

    const onSubbotDisconnected = (data: any) => {
      const code = data?.subbotCode ?? data?.phone ?? data?.code ?? 'desconocido'
      const reason = data?.reason
      warning('Subbot desconectado', {
        message: reason ? `${code}: ${reason}` : `Subbot ${code} se desconectó`,
        duration: 4000
      })
    }

    const onSubbotDeleted = (data: any) => {
      const code = data?.subbotCode ?? data?.code ?? 'desconocido'
      warning('Subbot eliminado', { message: `Subbot ${code} fue eliminado`, duration: 4000 })
    }

    // Usuarios
    const onUsuarioCreated = (data: any) => {
      const u = data?.usuario ?? data
      const nombre = u?.nombre ?? u?.name ?? u?.username ?? u?.email ?? 'nuevo usuario'
      info('Nuevo usuario', { message: `${nombre} se registró en el panel`, duration: 4000 })
    }

    // Tareas
    const onTaskCreated = (data: any) => {
      const t = data?.task ?? data
      const nombre = t?.nombre ?? t?.name ?? t?.title ?? 'nueva tarea'
      info('Tarea creada', { message: `Tarea "${nombre}" programada`, duration: 3000 })
    }

    const onTaskExecuted = (data: any) => {
      const nombre = data?.taskName ?? data?.nombre ?? data?.name ?? 'tarea'
      const ok = data?.success ?? data?.exitCode === 0
      if (ok) {
        success('Tarea ejecutada', { message: `"${nombre}" completada exitosamente`, duration: 3000 })
      } else {
        error('Tarea fallida', { message: `"${nombre}" falló durante la ejecución`, duration: 5000 })
      }
    }

    // Notificaciones genéricas del sistema (emitidas por emitNotification)
    const onNotification = (data: any) => {
      const type = (data?.tipo ?? data?.type ?? 'info') as NotificationType
      const title = data?.titulo ?? data?.title ?? 'Notificación'
      const message = data?.mensaje ?? data?.message
      addNotification(type, title, { message, duration: data?.duration })
    }

    socket.on(SOCKET_EVENTS.PEDIDO_CREATED,      onPedidoCreated)
    socket.on(SOCKET_EVENTS.PEDIDO_UPDATED,      onPedidoUpdated)
    socket.on(SOCKET_EVENTS.PEDIDO_DELETED,      onPedidoDeleted)
    socket.on(SOCKET_EVENTS.APORTE_CREATED,      onAporteCreated)
    socket.on(SOCKET_EVENTS.APORTE_UPDATED,      onAporteUpdated)
    socket.on(SOCKET_EVENTS.APORTE_DELETED,      onAporteDeleted)
    socket.on(SOCKET_EVENTS.GRUPO_UPDATED,       onGrupoUpdated)
    socket.on(SOCKET_EVENTS.GRUPO_SYNCED,        onGrupoSynced)
    socket.on(SOCKET_EVENTS.BOT_CONNECTED,       onBotConnected)
    socket.on(SOCKET_EVENTS.BOT_DISCONNECTED,    onBotDisconnected)
    socket.on(SOCKET_EVENTS.SUBBOT_CREATED,      onSubbotCreated)
    socket.on(SOCKET_EVENTS.SUBBOT_CONNECTED,    onSubbotConnected)
    socket.on(SOCKET_EVENTS.SUBBOT_DISCONNECTED, onSubbotDisconnected)
    socket.on(SOCKET_EVENTS.SUBBOT_DELETED,      onSubbotDeleted)
    socket.on(SOCKET_EVENTS.USUARIO_CREATED,     onUsuarioCreated)
    socket.on(SOCKET_EVENTS.TASK_CREATED,        onTaskCreated)
    socket.on(SOCKET_EVENTS.TASK_EXECUTED,       onTaskExecuted)
    socket.on(SOCKET_EVENTS.NOTIFICATION,        onNotification)

    return () => {
      socket.off(SOCKET_EVENTS.PEDIDO_CREATED,      onPedidoCreated)
      socket.off(SOCKET_EVENTS.PEDIDO_UPDATED,      onPedidoUpdated)
      socket.off(SOCKET_EVENTS.PEDIDO_DELETED,      onPedidoDeleted)
      socket.off(SOCKET_EVENTS.APORTE_CREATED,      onAporteCreated)
      socket.off(SOCKET_EVENTS.APORTE_UPDATED,      onAporteUpdated)
      socket.off(SOCKET_EVENTS.APORTE_DELETED,      onAporteDeleted)
      socket.off(SOCKET_EVENTS.GRUPO_UPDATED,       onGrupoUpdated)
      socket.off(SOCKET_EVENTS.GRUPO_SYNCED,        onGrupoSynced)
      socket.off(SOCKET_EVENTS.BOT_CONNECTED,       onBotConnected)
      socket.off(SOCKET_EVENTS.BOT_DISCONNECTED,    onBotDisconnected)
      socket.off(SOCKET_EVENTS.SUBBOT_CREATED,      onSubbotCreated)
      socket.off(SOCKET_EVENTS.SUBBOT_CONNECTED,    onSubbotConnected)
      socket.off(SOCKET_EVENTS.SUBBOT_DISCONNECTED, onSubbotDisconnected)
      socket.off(SOCKET_EVENTS.SUBBOT_DELETED,      onSubbotDeleted)
      socket.off(SOCKET_EVENTS.USUARIO_CREATED,     onUsuarioCreated)
      socket.off(SOCKET_EVENTS.TASK_CREATED,        onTaskCreated)
      socket.off(SOCKET_EVENTS.TASK_EXECUTED,       onTaskExecuted)
      socket.off(SOCKET_EVENTS.NOTIFICATION,        onNotification)
    }
  }, [socket, success, error, warning, info, system, addNotification])

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
