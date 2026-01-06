'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';

type MetricTone = 'auto' | 'info' | 'success' | 'warning' | 'danger' | 'terminal';

export interface MetricBlockProps {
  label: string;
  value: number | string;
  icon?: React.ReactNode;
  hint?: string;
  tone?: MetricTone;
  trend?: number;
  className?: string;
}

export function MetricBlock({ label, value, icon, hint, tone = 'auto', trend, className }: MetricBlockProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn('metric-block', tone !== 'auto' && `metric-block--${tone}`, className)}
      initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.99 }}
      whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={reduceMotion ? { duration: 0.12 } : { duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="metric-block__bg" aria-hidden="true" />
      <div className="metric-block__inner">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="metric-block__label">{label}</div>
            <div className="metric-block__value">
              {typeof value === 'number' ? <AnimatedNumber value={value} duration={0.75} /> : value}
            </div>
          </div>
          {icon ? <div className="metric-block__icon">{icon}</div> : null}
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          {hint ? <div className="metric-block__hint">{hint}</div> : <span />}
          {typeof trend === 'number' ? (
            <div className={cn('metric-block__trend', trend > 0 ? 'is-up' : trend < 0 ? 'is-down' : 'is-flat')}>
              <span aria-hidden="true" className="metric-block__trendDot" />
              <span className="font-mono">{Math.abs(trend)}%</span>
            </div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
