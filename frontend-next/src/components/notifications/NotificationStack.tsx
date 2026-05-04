'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, Zap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface StackNotification {
  id: string
  type: 'success' | 'error' | 'warning' | 'info' | 'system'
  title: string
  message?: string
  duration?: number
  timestamp: number
  action?: { label: string; onClick: () => void }
}

interface NotificationStackProps {
  notifications: StackNotification[]
  onDismiss: (id: string) => void
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
  maxVisible?: number
}

const SWIPE_THRESHOLD = 72

export function NotificationStack({ notifications, onDismiss, position = 'top-right', maxVisible = 5 }: NotificationStackProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const pos = { 'top-right': 'top-4 right-4', 'top-left': 'top-4 left-4', 'bottom-right': 'bottom-4 right-4', 'bottom-left': 'bottom-4 left-4' }

  const stack = (
    <div className={`fixed ${pos[position]} z-[99999] w-[360px] max-w-[calc(100vw-2rem)] flex flex-col gap-3`}>
      <AnimatePresence mode="popLayout">
        {notifications.slice(0, maxVisible).map((n) => (
          <NotificationCard key={n.id} notification={n} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>
  )

  if (!mounted) return null
  return createPortal(stack, document.body)
}

function NotificationCard({ notification, onDismiss }: { notification: StackNotification; onDismiss: (id: string) => void }) {
  const [translateX, setTranslateX] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const [paused, setPaused] = useState(false)
  const startX = useRef<number | null>(null)
  const isDragging = useRef(false)

  // Auto-dismiss
  useEffect(() => {
    if (!notification.duration || paused || dismissed) return
    const t = setTimeout(() => dismiss(0), notification.duration)
    return () => clearTimeout(t)
  }, [notification.duration, paused, dismissed])

  function dismiss(toX: number) {
    if (dismissed) return
    setDismissed(true)
    setTranslateX(toX)
    setTimeout(() => onDismiss(notification.id), 250)
  }

  function onPointerDown(e: React.PointerEvent) {
    if ((e.target as HTMLElement).closest('button')) return
    startX.current = e.clientX
    isDragging.current = false
    setPaused(true)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (startX.current === null) return
    const dx = e.clientX - startX.current
    if (Math.abs(dx) > 5) isDragging.current = true
    if (isDragging.current) setTranslateX(dx)
  }

  function onPointerUp(e: React.PointerEvent) {
    if (startX.current === null) return
    const dx = e.clientX - startX.current
    startX.current = null
    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      dismiss(dx > 0 ? 500 : -500)
    } else {
      setTranslateX(0)
      setPaused(false)
    }
    isDragging.current = false
  }

  const absX = Math.abs(translateX)
  const dragOpacity = dismissed ? 0 : Math.max(0, 1 - absX / 200)

  const colors: Record<string, string> = {
    success: 'bg-emerald-50/95 dark:bg-emerald-950/90 border-emerald-200/50 dark:border-emerald-800/50',
    error:   'bg-red-50/95 dark:bg-red-950/90 border-red-200/50 dark:border-red-800/50',
    warning: 'bg-amber-50/95 dark:bg-amber-950/90 border-amber-200/50 dark:border-amber-800/50',
    system:  'bg-purple-50/95 dark:bg-purple-950/90 border-purple-200/50 dark:border-purple-800/50',
    info:    'bg-blue-50/95 dark:bg-blue-950/90 border-blue-200/50 dark:border-blue-800/50',
  }

  const icons: Record<string, React.ReactNode> = {
    success: <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" />,
    error:   <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />,
    system:  <Zap className="w-5 h-5 text-purple-500 flex-shrink-0" />,
    info:    <Info className="w-5 h-5 text-blue-500 flex-shrink-0" />,
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
    >
      <div
        className={`${colors[notification.type] ?? colors.info} border rounded-xl shadow-xl backdrop-blur-md select-none touch-pan-y cursor-grab active:cursor-grabbing`}
        style={{
          transform: `translateX(${translateX}px)`,
          opacity: dragOpacity,
          transition: isDragging.current ? 'none' : 'transform 0.25s ease, opacity 0.25s ease',
          willChange: 'transform',
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <div className="p-4 flex items-start gap-3">
          <div className="mt-0.5">{icons[notification.type] ?? icons.info}</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 leading-tight">
              {notification.title}
            </p>
            {notification.message && (
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                {notification.message}
              </p>
            )}
            {notification.action && (
              <button
                onClick={() => { notification.action!.onClick(); onDismiss(notification.id) }}
                className="mt-2 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline"
              >
                {notification.action.label}
              </button>
            )}
          </div>
          <button
            onClick={() => dismiss(400)}
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {notification.duration && !paused && !dismissed && (
          <motion.div
            className="h-0.5 bg-current opacity-20 rounded-b-xl"
            initial={{ scaleX: 1, originX: 0 }}
            animate={{ scaleX: 0 }}
            transition={{ duration: notification.duration / 1000, ease: 'linear' }}
          />
        )}
      </div>
    </motion.div>
  )
}
