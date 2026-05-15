'use client'

import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
} from 'framer-motion'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
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

type NType = StackNotification['type']

// ─── Design tokens per type ────────────────────────────────────────────────

const ICON_EL: Record<NType, React.ElementType> = {
  success: CheckCircle,
  error:   AlertCircle,
  warning: AlertTriangle,
  info:    Info,
  system:  Zap,
}

const ICON_BG: Record<NType, string> = {
  success: 'linear-gradient(135deg, rgb(var(--success))  0%, rgb(var(--secondary)) 100%)',
  error:   'linear-gradient(135deg, rgb(var(--danger))   0%, rgb(var(--warning)/0.75) 100%)',
  warning: 'linear-gradient(135deg, rgb(var(--warning))  0%, rgb(var(--danger)/0.65) 100%)',
  info:    'linear-gradient(135deg, rgb(var(--info))     0%, rgb(var(--primary)) 100%)',
  system:  'linear-gradient(135deg, rgb(var(--primary))  0%, rgb(var(--secondary)) 100%)',
}

const ACCENT: Record<NType, string> = {
  success: 'rgb(var(--success))',
  error:   'rgb(var(--danger))',
  warning: 'rgb(var(--warning))',
  info:    'rgb(var(--info))',
  system:  'rgb(var(--primary))',
}

const GLOW: Record<NType, string> = {
  success: '0 0 0 1px rgb(var(--success)/0.18), 0 4px 30px rgb(var(--success)/0.1), 0 12px 48px rgb(0 0 0/0.6)',
  error:   '0 0 0 1px rgb(var(--danger)/0.18),  0 4px 30px rgb(var(--danger)/0.1),  0 12px 48px rgb(0 0 0/0.6)',
  warning: '0 0 0 1px rgb(var(--warning)/0.18), 0 4px 30px rgb(var(--warning)/0.1), 0 12px 48px rgb(0 0 0/0.6)',
  info:    '0 0 0 1px rgb(var(--info)/0.18),    0 4px 30px rgb(var(--info)/0.1),    0 12px 48px rgb(0 0 0/0.6)',
  system:  '0 0 0 1px rgb(var(--primary)/0.18), 0 4px 30px rgb(var(--primary)/0.1), 0 12px 48px rgb(0 0 0/0.6)',
}

const POSITIONS: Record<string, string> = {
  'top-right':    'top-4 right-4 items-end',
  'top-left':     'top-4 left-4 items-start',
  'bottom-right': 'bottom-4 right-4 items-end',
  'bottom-left':  'bottom-4 left-4 items-start',
}

// ─── Stack ─────────────────────────────────────────────────────────────────

export function NotificationStack({
  notifications,
  onDismiss,
  position = 'top-right',
  maxVisible = 5,
}: NotificationStackProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])
  if (!mounted) return null

  const pos = POSITIONS[position] ?? POSITIONS['top-right']

  return createPortal(
    <div className={`fixed ${pos} z-[99999] flex flex-col gap-2.5 w-[360px] max-w-[calc(100vw-2rem)] pointer-events-none`}>
      <AnimatePresence mode="popLayout">
        {notifications.slice(0, maxVisible).map((n) => (
          <NotificationCard key={n.id} notification={n} onDismiss={onDismiss} />
        ))}
      </AnimatePresence>
    </div>,
    document.body,
  )
}

// ─── Card ──────────────────────────────────────────────────────────────────

function NotificationCard({
  notification: n,
  onDismiss,
}: {
  notification: StackNotification
  onDismiss: (id: string) => void
}) {
  const [paused, setPaused]   = useState(false)
  const [leaving, setLeaving] = useState(false)

  const x       = useMotionValue(0)
  const opacity = useTransform(x, [-220, -50, 0, 50, 220], [0, 0.45, 1, 0.45, 0])
  const rotate  = useTransform(x, [-220, 0, 220], [-2.5, 0, 2.5])

  const Icon = ICON_EL[n.type]
  const accent = ACCENT[n.type]

  function dismiss(toX?: number) {
    if (leaving) return
    setLeaving(true)
    if (toX) {
      animate(x, toX, { duration: 0.2, ease: [0.4, 0, 1, 1] })
      setTimeout(() => onDismiss(n.id), 195)
    } else {
      onDismiss(n.id)
    }
  }

  useEffect(() => {
    if (!n.duration || paused || leaving) return
    const t = setTimeout(() => dismiss(), n.duration)
    return () => clearTimeout(t)
  }, [n.duration, paused, leaving])

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -22, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.86, y: -8, transition: { duration: 0.17, ease: 'easeIn' } }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.1}
      whileDrag={{ scale: 0.975 }}
      onDragStart={() => setPaused(true)}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.x) > 80 || Math.abs(info.velocity.x) > 480) {
          dismiss(info.offset.x > 0 ? 520 : -520)
        } else {
          animate(x, 0, { type: 'spring', stiffness: 440, damping: 36 })
          setPaused(false)
        }
      }}
      style={{
        x,
        opacity,
        rotate,
        boxShadow: GLOW[n.type],
        background: 'rgba(14, 18, 16, 0.88)',
        backdropFilter: 'blur(28px) saturate(175%)',
        WebkitBackdropFilter: 'blur(28px) saturate(175%)',
        borderTop:    '1px solid rgba(255,255,255,0.08)',
        borderRight:  '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        borderLeft:   `3px solid ${accent}`,
      }}
      className="pointer-events-auto cursor-grab active:cursor-grabbing select-none rounded-2xl overflow-hidden"
    >
      {/* Ambient gradient from accent color */}
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse 90% 70% at 0% 0%, ${accent}10 0%, transparent 65%)`,
        }}
      />

      {/* Content */}
      <div className="relative p-3.5 flex items-start gap-3">
        {/* Icon badge */}
        <div
          className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center mt-0.5 shadow-lg"
          style={{ background: ICON_BG[n.type] }}
        >
          <Icon className="w-[15px] h-[15px] text-white" strokeWidth={2.5} />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0 py-0.5">
          <p className="font-semibold text-sm leading-snug text-foreground">
            {n.title}
          </p>
          {n.message && (
            <p className="text-xs mt-1 leading-relaxed line-clamp-2 text-muted">
              {n.message}
            </p>
          )}
          {n.action && (
            <button
              onClick={(e) => { e.stopPropagation(); n.action!.onClick(); onDismiss(n.id) }}
              className="mt-1.5 text-xs font-semibold hover:opacity-70 transition-opacity"
              style={{ color: accent }}
            >
              {n.action.label} →
            </button>
          )}
        </div>

        {/* Close button */}
        <button
          onClick={() => dismiss(400)}
          className="flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-white/10 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      {n.duration && !paused && !leaving && (
        <div className="px-3.5 pb-2.5">
          <div className="h-[2px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{
                transformOrigin: 'left',
                background: `linear-gradient(90deg, ${accent}, ${accent}50)`,
              }}
              initial={{ scaleX: 1 }}
              animate={{ scaleX: 0 }}
              transition={{ duration: n.duration / 1000, ease: 'linear' }}
            />
          </div>
        </div>
      )}
    </motion.div>
  )
}
