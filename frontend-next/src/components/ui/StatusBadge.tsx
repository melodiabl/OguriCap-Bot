'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'terminal';

export function StatusBadge({
  tone = 'neutral',
  children,
  pulse = false,
  className,
}: {
  tone?: StatusTone;
  children: React.ReactNode;
  pulse?: boolean;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.span
      className={cn('status-badge', `status-badge--${tone}`, pulse && 'status-badge--pulse', className)}
      initial={reduceMotion ? false : { opacity: 0, y: 6, scale: 0.98 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      transition={reduceMotion ? { duration: 0.12 } : { duration: 0.35, ease: 'easeOut' }}
    >
      <span className="status-badge__sheen" aria-hidden="true" />
      <span className="status-badge__dot" aria-hidden="true" />
      <span className="status-badge__text">{children}</span>
    </motion.span>
  );
}

