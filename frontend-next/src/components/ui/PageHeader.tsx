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
    <div className={cn('relative overflow-hidden rounded-2xl border border-white/10 p-8 backdrop-blur-xl', className)} style={{ backgroundColor: 'rgb(var(--bg-0) / 0.80)' }}>
      {/* Background Accent */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-primary/5 blur-[100px] -ml-32 -mt-32" />
      
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div className="flex items-center gap-5">
          {icon && (
            <motion.div
              className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-primary shadow-glow-sm"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.8, rotate: -10 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              {icon}
            </motion.div>
          )}
          <div className="min-w-0">
            <motion.h1
              className="text-3xl md:text-4xl font-black text-white tracking-tight"
              initial={reduceMotion ? false : { opacity: 0, x: -20 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              {title}
            </motion.h1>
            {description && (
              <motion.p
                className="text-gray-500 font-bold text-sm mt-1 max-w-2xl"
                initial={reduceMotion ? false : { opacity: 0, x: -20 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
              >
                {description}
              </motion.p>
            )}
          </div>
        </div>

        {actions && (
          <motion.div
            className="flex items-center gap-3"
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
          >
            {actions}
          </motion.div>
        )}
      </div>
    </div>
  );
}
