'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, icon, actions, className }: PageHeaderProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div className={cn('ultra-card ultra-card--interactive p-6', className)}>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex items-start gap-3">
        {icon && (
          <motion.div
            className="p-3 rounded-3xl bg-white/5 border border-white/15 shadow-inner-glow"
            initial={reduceMotion ? false : { opacity: 0, scale: 0.85, rotate: -8 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: 0 }}
            transition={reduceMotion ? { duration: 0.12 } : { type: 'spring', stiffness: 420, damping: 28, mass: 0.7 }}
          >
            {icon}
          </motion.div>
        )}
        <div className="min-w-0">
          <motion.h1
            className="text-4xl md:text-5xl font-extrabold gradient-text-animated tracking-tight"
            initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.99 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            transition={reduceMotion ? { duration: 0.12 } : { duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
          >
            {title}
          </motion.h1>
          {description && (
            <motion.p
              className="text-gray-300 mt-3 text-base max-w-3xl"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              transition={reduceMotion ? { duration: 0.12 } : { duration: 0.22, ease: 'easeOut', delay: 0.04 }}
            >
              {description}
            </motion.p>
          )}

          <motion.div
            className="mt-5 h-[3px] w-28 rounded-full bg-gradient-to-r from-primary-500 via-cyan-400 to-emerald-400 header-underline-animated shadow-glow-lg origin-left"
            initial={reduceMotion ? false : { opacity: 0, scaleX: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scaleX: 1 }}
            transition={reduceMotion ? { duration: 0.12 } : { type: 'spring', stiffness: 420, damping: 30, mass: 0.6 }}
          />
        </div>
      </div>

      {actions && (
        <motion.div
          className="flex items-center gap-3"
          initial={reduceMotion ? false : { opacity: 0, y: 10, scale: 0.99 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          transition={reduceMotion ? { duration: 0.12 } : { duration: 0.26, ease: [0.16, 1, 0.3, 1], delay: 0.06 }}
        >
          {actions}
        </motion.div>
      )}
      </div>
    </div>
  );
}
