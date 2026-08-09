'use client';

import * as React from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

type UltraCardTone = 'auto' | 'brand' | 'success' | 'warning' | 'danger' | 'terminal';

export interface UltraCardProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  tone?: UltraCardTone;
  interactive?: boolean;
  glow?: boolean;
  elevated?: boolean;
}

export const UltraCard = React.forwardRef<HTMLDivElement, UltraCardProps>(
  (
    {
      className,
      tone = 'auto',
      interactive = true,
      glow = true,
      elevated = true,
      children,
      ...props
    },
    ref
  ) => {
    const reduceMotion = useReducedMotion();

    return (
      <motion.div
        ref={ref}
        className={cn(
          'ultra-card',
          'preserve-3d',
          tone !== 'auto' && `ultra-card--${tone}`,
          glow && 'ultra-card--glow',
          elevated && 'ultra-card--elevated',
          interactive && 'ultra-card--interactive',
          className
        )}
        initial={
          reduceMotion
            ? false
            : { opacity: 0, y: 18, scale: 0.99 }
        }
        whileInView={
          reduceMotion
            ? { opacity: 1 }
            : { opacity: 1, y: 0, scale: 1 }
        }
        viewport={{ once: true, amount: 0.2 }}
        transition={
          reduceMotion
            ? { duration: 0.12 }
            : { duration: 0.42, ease: [0.16, 1, 0.3, 1] }
        }
        whileHover={
          reduceMotion || !interactive
            ? undefined
            : { y: -6, scale: 1.01, rotateX: 1.2, rotateY: -1.2 }
        }
        whileTap={reduceMotion || !interactive ? undefined : { scale: 0.985 }}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

UltraCard.displayName = 'UltraCard';
