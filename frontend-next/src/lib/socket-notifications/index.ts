/**
 * lib/socket-notifications/index.ts — Dispatcher de eventos de socket → toasts
 *
 * Análogo a api/api.js: recibe todos los eventos entrantes y los enruta
 * al handler de dominio correcto. Cada archivo de dominio devuelve un
 * ToastPayload puro (sin side effects), y este dispatcher lo ejecuta.
 *
 * NO maneja SOCKET_EVENTS.NOTIFICATION — ese evento es propiedad de
 * NotificationContext (persistencia + lista del panel).
 */

import type { Socket } from 'socket.io-client'
import { SOCKET_EVENTS } from '@/contexts/SocketContext'
import { notifications } from '@/lib/notifications'
import type { ToastPayload, ToastLevel } from './types'

import { onBotConnected, onBotDisconnected }                                      from './bot'
import { onSubbotCreated, onSubbotConnected, onSubbotDisconnected, onSubbotDeleted } from './subbots'
import { onPedidoCreated, onPedidoUpdated, onPedidoDeleted }                     from './pedidos'
import { onAporteCreated, onAporteUpdated, onAporteDeleted }                      from './aportes'
import { onGrupoUpdated, onGrupoSynced }                                           from './grupos'
import { onTaskCreated, onTaskExecuted }                                           from './tasks'
import { onUsuarioCreated }                                                         from './usuarios'

// ─── Deduplicación ────────────────────────────────────────────────────────────

function makeDeduper() {
  const seen = new Map<string, number>()
  return function dedup(key: string, windowMs = 5000): boolean {
    const now  = Date.now()
    const last = seen.get(key) ?? 0
    if (now - last < windowMs) return false
    seen.set(key, now)
    return true
  }
}

// ─── Dispatch ─────────────────────────────────────────────────────────────────

function dispatch(
  dedup: ReturnType<typeof makeDeduper>,
  payload: ToastPayload | null,
) {
  if (!payload) return
  if (!dedup(payload.dedupKey, payload.dedupWindow)) return
  notifications[payload.level as ToastLevel](payload.title, {
    message:  payload.message,
    duration: payload.duration,
  })
}

// ─── Registro ─────────────────────────────────────────────────────────────────

/**
 * Registra todos los listeners de socket para eventos de sistema.
 * Retorna una función de cleanup (para usar en el return de useEffect).
 */
export function registerSocketNotifications(socket: Socket): () => void {
  const dedup = makeDeduper()
  const d = (payload: ToastPayload | null) => dispatch(dedup, payload)

  // ── Bot principal ──────────────────────────────────────────────────────────
  const _botConnected    = (data: any) => d(onBotConnected(data))
  const _botDisconnected = (data: any) => d(onBotDisconnected(data))

  // ── Subbots ───────────────────────────────────────────────────────────────
  const _subbotCreated      = (data: any) => d(onSubbotCreated(data))
  const _subbotConnected    = (data: any) => d(onSubbotConnected(data))
  const _subbotDisconnected = (data: any) => d(onSubbotDisconnected(data))
  const _subbotDeleted      = (data: any) => d(onSubbotDeleted(data))

  // ── Pedidos ───────────────────────────────────────────────────────────────
  const _pedidoCreated = (data: any) => d(onPedidoCreated(data))
  const _pedidoUpdated = (data: any) => d(onPedidoUpdated(data))
  const _pedidoDeleted = (data: any) => d(onPedidoDeleted(data))

  // ── Aportes ───────────────────────────────────────────────────────────────
  const _aporteCreated = (data: any) => d(onAporteCreated(data))
  const _aporteUpdated = (data: any) => d(onAporteUpdated(data))
  const _aporteDeleted = (data: any) => d(onAporteDeleted(data))

  // ── Grupos ────────────────────────────────────────────────────────────────
  const _grupoUpdated = (data: any) => d(onGrupoUpdated(data))
  const _grupoSynced  = (data: any) => d(onGrupoSynced(data))

  // ── Tareas ────────────────────────────────────────────────────────────────
  const _taskCreated  = (data: any) => d(onTaskCreated(data))
  const _taskExecuted = (data: any) => d(onTaskExecuted(data))

  // ── Usuarios ──────────────────────────────────────────────────────────────
  const _usuarioCreated = (data: any) => d(onUsuarioCreated(data))

  socket.on(SOCKET_EVENTS.BOT_CONNECTED,       _botConnected)
  socket.on(SOCKET_EVENTS.BOT_DISCONNECTED,    _botDisconnected)
  socket.on(SOCKET_EVENTS.SUBBOT_CREATED,      _subbotCreated)
  socket.on(SOCKET_EVENTS.SUBBOT_CONNECTED,    _subbotConnected)
  socket.on(SOCKET_EVENTS.SUBBOT_DISCONNECTED, _subbotDisconnected)
  socket.on(SOCKET_EVENTS.SUBBOT_DELETED,      _subbotDeleted)
  socket.on(SOCKET_EVENTS.PEDIDO_CREATED,      _pedidoCreated)
  socket.on(SOCKET_EVENTS.PEDIDO_UPDATED,      _pedidoUpdated)
  socket.on(SOCKET_EVENTS.PEDIDO_DELETED,      _pedidoDeleted)
  socket.on(SOCKET_EVENTS.APORTE_CREATED,      _aporteCreated)
  socket.on(SOCKET_EVENTS.APORTE_UPDATED,      _aporteUpdated)
  socket.on(SOCKET_EVENTS.APORTE_DELETED,      _aporteDeleted)
  socket.on(SOCKET_EVENTS.GRUPO_UPDATED,       _grupoUpdated)
  socket.on(SOCKET_EVENTS.GRUPO_SYNCED,        _grupoSynced)
  socket.on(SOCKET_EVENTS.TASK_CREATED,        _taskCreated)
  socket.on(SOCKET_EVENTS.TASK_EXECUTED,       _taskExecuted)
  socket.on(SOCKET_EVENTS.USUARIO_CREATED,     _usuarioCreated)

  return () => {
    socket.off(SOCKET_EVENTS.BOT_CONNECTED,       _botConnected)
    socket.off(SOCKET_EVENTS.BOT_DISCONNECTED,    _botDisconnected)
    socket.off(SOCKET_EVENTS.SUBBOT_CREATED,      _subbotCreated)
    socket.off(SOCKET_EVENTS.SUBBOT_CONNECTED,    _subbotConnected)
    socket.off(SOCKET_EVENTS.SUBBOT_DISCONNECTED, _subbotDisconnected)
    socket.off(SOCKET_EVENTS.SUBBOT_DELETED,      _subbotDeleted)
    socket.off(SOCKET_EVENTS.PEDIDO_CREATED,      _pedidoCreated)
    socket.off(SOCKET_EVENTS.PEDIDO_UPDATED,      _pedidoUpdated)
    socket.off(SOCKET_EVENTS.PEDIDO_DELETED,      _pedidoDeleted)
    socket.off(SOCKET_EVENTS.APORTE_CREATED,      _aporteCreated)
    socket.off(SOCKET_EVENTS.APORTE_UPDATED,      _aporteUpdated)
    socket.off(SOCKET_EVENTS.APORTE_DELETED,      _aporteDeleted)
    socket.off(SOCKET_EVENTS.GRUPO_UPDATED,       _grupoUpdated)
    socket.off(SOCKET_EVENTS.GRUPO_SYNCED,        _grupoSynced)
    socket.off(SOCKET_EVENTS.TASK_CREATED,        _taskCreated)
    socket.off(SOCKET_EVENTS.TASK_EXECUTED,       _taskExecuted)
    socket.off(SOCKET_EVENTS.USUARIO_CREATED,     _usuarioCreated)
  }
}
