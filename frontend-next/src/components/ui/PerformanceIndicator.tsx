'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Activity, Clock, TrendingUp, Zap, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDevicePerformance } from '@/contexts/DevicePerformanceContext';

interface PerformanceIndicatorProps {
  metrics?: {
    tiempoRespuesta: number;
    disponibilidad: number;
    errorRate: number;
    throughput: number;
  };
  className?: string;
}

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const toneText: Record<Tone, string> = {
  neutral: 'text-muted',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  info: 'text-accent',
};

const toneFill: Record<Tone, string> = {
  neutral: 'bg-border/25',
  success: 'bg-gradient-to-r from-success to-accent',
  warning: 'bg-gradient-to-r from-warning to-accent',
  danger: 'bg-gradient-to-r from-danger to-warning',
  info: 'bg-gradient-to-r from-accent to-primary',
};

const toneRail: Record<Tone, string> = {
  neutral: 'bg-border/10',
  success: 'bg-success/10',
  warning: 'bg-warning/10',
  danger: 'bg-danger/10',
  info: 'bg-accent/10',
};

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function toPercent(v: number) {
  return Math.round(clamp01(v) * 1000) / 10;
}

function MetricTile({
  icon: Icon,
  label,
  value,
  tone,
  fill,
  index,
  enableMotion,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: Tone;
  fill: number;
  index: number;
  enableMotion: boolean;
}) {
  const tileBase = cn(
    'relative overflow-hidden rounded-2xl border border-border/15 bg-card/55 p-4',
    'shadow-[0_16px_50px_rgb(var(--shadow-rgb)_/_0.16)]'
  );

  const overlayStyle = React.useMemo(
    () => ({
      background:
        'radial-gradient(700px 280px at 10% 0%, rgb(var(--primary) / 0.12), transparent 60%),' +
        'radial-gradient(600px 260px at 100% 40%, rgb(var(--accent) / 0.10), transparent 55%)',
    }),
    []
  );

  return (
    <motion.div
      className={tileBase}
      initial={enableMotion ? { opacity: 0, y: 10 } : undefined}
      animate={enableMotion ? { opacity: 1, y: 0 } : undefined}
      transition={enableMotion ? { duration: 0.32, delay: index * 0.04, ease: [0.16, 1, 0.3, 1] } : undefined}
    >
      <div aria-hidden="true" className="absolute inset-0 opacity-60" style={overlayStyle} />
      <div aria-hidden="true" className={cn('absolute left-0 top-0 bottom-0 w-[2px]', toneFill[tone])} />

      <div className="relative z-10">
        <div className="flex items-center justify-between gap-3">
          <div className={cn('p-2 rounded-xl bg-card/55 border border-border/10', toneText[tone])}>
            <Icon className="w-5 h-5" />
          </div>
          <div className={cn('text-sm font-semibold tabular-nums', toneText[tone])}>{value}</div>
        </div>

        <div className="mt-2 text-xs font-medium text-muted">{label}</div>

        <div className={cn('mt-3 h-1.5 rounded-full overflow-hidden', toneRail[tone])}>
          {enableMotion ? (
            <motion.div
              className={cn('h-full rounded-full', toneFill[tone])}
              initial={{ width: 0 }}
              animate={{ width: `${toPercent(fill)}%` }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            />
          ) : (
            <div className={cn('h-full rounded-full', toneFill[tone])} style={{ width: `${toPercent(fill)}%` }} />
          )}
        </div>
      </div>
    </motion.div>
  );
}

export const PerformanceIndicator: React.FC<PerformanceIndicatorProps> = ({ metrics, className = '' }) => {
  const reduceMotion = useReducedMotion();
  const { performanceMode, isDesktop } = useDevicePerformance();

  const hasMetrics =
    metrics &&
    typeof metrics.tiempoRespuesta === 'number' &&
    typeof metrics.disponibilidad === 'number' &&
    typeof metrics.errorRate === 'number' &&
    typeof metrics.throughput === 'number';

  const safe = {
    tiempoRespuesta: hasMetrics ? Number(metrics.tiempoRespuesta) : 0,
    disponibilidad: hasMetrics ? Number(metrics.disponibilidad) : 0,
    errorRate: hasMetrics ? Number(metrics.errorRate) : 0,
    throughput: hasMetrics ? Number(metrics.throughput) : 0,
  };

  const responseTone: Tone = !hasMetrics
    ? 'neutral'
    : safe.tiempoRespuesta <= 100
      ? 'success'
      : safe.tiempoRespuesta <= 300
        ? 'warning'
        : 'danger';

  const availabilityTone: Tone = !hasMetrics
    ? 'neutral'
    : safe.disponibilidad >= 99
      ? 'success'
      : safe.disponibilidad >= 95
        ? 'warning'
        : 'danger';

  const errorTone: Tone = !hasMetrics
    ? 'neutral'
    : safe.errorRate <= 1
      ? 'success'
      : safe.errorRate <= 5
        ? 'warning'
        : 'danger';

  const throughputTone: Tone = !hasMetrics ? 'neutral' : 'info';

  const tiles = [
    {
      icon: Clock,
      label: 'Tiempo de respuesta',
      value: hasMetrics ? `${Math.round(safe.tiempoRespuesta)}ms` : '—',
      tone: responseTone,
      fill: hasMetrics ? clamp01(1 - safe.tiempoRespuesta / 450) : 0,
    },
    {
      icon: Activity,
      label: 'Disponibilidad',
      value: hasMetrics ? `${safe.disponibilidad.toFixed(1)}%` : '—',
      tone: availabilityTone,
      fill: hasMetrics ? clamp01(safe.disponibilidad / 100) : 0,
    },
    {
      icon: Zap,
      label: 'Tasa de error',
      value: hasMetrics ? `${safe.errorRate.toFixed(1)}%` : '—',
      tone: errorTone,
      fill: hasMetrics ? clamp01(1 - safe.errorRate / 10) : 0,
    },
    {
      icon: TrendingUp,
      label: 'Throughput',
      value: hasMetrics ? `${Math.round(safe.throughput)}/min` : '—',
      tone: throughputTone,
      fill: hasMetrics ? clamp01(safe.throughput / 50) : 0,
    },
  ] as const;

  const enableMotion = !reduceMotion && !performanceMode;
  const enableHover = isDesktop && !reduceMotion && !performanceMode;

  return (
    <div className={cn('grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4', className)}>
      {tiles.map((t, i) => (
        <div
          key={t.label}
          className={cn(
            enableHover && 'transition-transform duration-200 hover:-translate-y-0.5',
            enableHover && 'hover:shadow-[0_22px_60px_rgb(var(--shadow-rgb)_/_0.18)]'
          )}
        >
          <MetricTile {...t} index={i} enableMotion={enableMotion} />
        </div>
      ))}
    </div>
  );
};

export default PerformanceIndicator;
