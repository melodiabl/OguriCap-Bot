'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button, type ButtonProps } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

type ActionTone = 'primary' | 'success' | 'danger' | 'glow';

export function ActionButton({
  tone = 'primary',
  pulse = false,
  className,
  children,
  ...props
}: ButtonProps & { tone?: ActionTone; pulse?: boolean }) {
  const reduceMotion = useReducedMotion();

  return (
    <Button
      {...props}
      variant={tone}
      className={cn('action-button', pulse && 'action-button--pulse', className)}
    >
      <motion.span
        aria-hidden="true"
        className="action-button__burst"
        initial={false}
        animate={
          reduceMotion || !pulse
            ? undefined
            : { opacity: [0.2, 0.45, 0.2], scale: [0.98, 1.08, 0.98] }
        }
        transition={
          reduceMotion || !pulse ? { duration: 0 } : { duration: 1.35, repeat: Infinity, ease: 'easeInOut' }
        }
      />
      <span className="action-button__content">{children}</span>
    </Button>
  );
}

