'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

type LiveState = 'live' | 'idle' | 'warning' | 'danger';

export function LiveIndicator({
  state = 'live',
  label,
  className,
}: {
  state?: LiveState;
  label?: React.ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <span className={cn('live-indicator', `live-indicator--${state}`, className)}>
      <motion.span
        aria-hidden="true"
        className="live-indicator__dot"
        animate={
          reduceMotion
            ? undefined
            : state === 'live'
              ? { scale: [1, 1.2, 1], opacity: [0.9, 1, 0.9] }
              : state === 'warning'
                ? { scale: [1, 1.28, 1], opacity: [0.9, 1, 0.9] }
                : state === 'danger'
                  ? { scale: [1, 1.35, 1], opacity: [0.85, 1, 0.85] }
                  : { opacity: 0.65 }
        }
        transition={
          reduceMotion
            ? { duration: 0 }
            : state === 'danger'
              ? { duration: 0.85, repeat: Infinity, ease: 'easeInOut' }
              : state === 'warning'
                ? { duration: 1.1, repeat: Infinity, ease: 'easeInOut' }
                : state === 'live'
                  ? { duration: 1.35, repeat: Infinity, ease: 'easeInOut' }
                  : { duration: 0.2 }
        }
      />
      <span aria-hidden="true" className="live-indicator__ring" />
      {label ? <span className="live-indicator__label">{label}</span> : null}
    </span>
  );
}

