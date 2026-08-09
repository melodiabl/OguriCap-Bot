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
  children?: React.ReactNode;
}

export function PageHeader({ title, description, icon, actions, className, children }: PageHeaderProps) {
  const reduceMotion = useReducedMotion();

  return (
    <div
      className={cn(
        'panel-surface relative overflow-hidden rounded-3xl p-5 backdrop-blur-xl sm:p-6 lg:p-8',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />
        <motion.div
          className="absolute -left-20 -top-24 h-56 w-56 rounded-full bg-primary/14 blur-[102px]"
          animate={reduceMotion ? { opacity: 1 } : { x: [0, 24, 0], y: [0, 16, 0], opacity: [0.46, 0.76, 0.46] }}
          transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 12, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -right-24 top-0 h-48 w-48 rounded-full bg-secondary/12 blur-[90px]"
          animate={reduceMotion ? { opacity: 1 } : { x: [0, -16, 0], y: [0, 18, 0], opacity: [0.34, 0.58, 0.34] }}
          transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 11, ease: 'easeInOut', delay: 0.3 }}
        />
        <motion.div
          className="absolute inset-x-8 bottom-0 h-20 rounded-full bg-gradient-to-r from-primary/0 via-primary/12 to-accent/0 blur-2xl"
          animate={reduceMotion ? { opacity: 0.75 } : { opacity: [0.32, 0.62, 0.32], scaleX: [0.97, 1.03, 0.97] }}
          transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 8.5, ease: 'easeInOut' }}
        />
      </div>
      
      <div className="relative z-10 flex flex-col gap-6">
        <div className="flex flex-col items-center gap-5 text-center lg:flex-row lg:items-center lg:justify-between lg:text-left">
          <div className="flex w-full flex-col items-center gap-4 text-center sm:flex-row sm:items-center sm:text-left lg:w-auto">
            {icon && (
              <motion.div
                className="relative isolate overflow-hidden rounded-2xl border border-primary/20 bg-primary/10 p-3.5 text-primary shadow-glow-sm"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.8, rotate: -10 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              >
                <motion.div
                  className="absolute -inset-4 rounded-full bg-[conic-gradient(from_120deg,rgba(var(--primary),0.28),transparent,rgba(var(--accent),0.22),transparent,rgba(var(--secondary),0.28))] blur-2xl"
                  animate={reduceMotion ? { opacity: 0.5 } : { rotate: [0, 180, 360], opacity: [0.22, 0.44, 0.22] }}
                  transition={reduceMotion ? { duration: 0.12 } : { repeat: Infinity, duration: 10.5, ease: 'linear' }}
                />
                {icon}
              </motion.div>
            )}
            <div className="min-w-0 flex-1">
              <motion.div
                className="header-underline-animated mb-2 inline-flex max-w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-[0.22em] text-[rgb(var(--text-secondary))] sm:justify-start"
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              >
                <span className="h-2 w-2 rounded-full bg-primary shadow-[0_0_18px_rgba(var(--primary),0.75)]" />
                Panel En Vivo
              </motion.div>
              <motion.h1
                className="text-2xl font-black tracking-tight text-foreground sm:text-3xl md:text-4xl"
                initial={reduceMotion ? false : { opacity: 0, x: -20 }}
                animate={reduceMotion ? { opacity: 1 } : { opacity: 1, x: 0 }}
                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                {title}
              </motion.h1>
              {description && (
                <motion.p
                  className="mx-auto mt-1 max-w-2xl text-sm font-semibold text-[rgb(var(--text-secondary))] sm:mx-0"
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
              className="flex w-full flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center lg:w-auto lg:justify-end"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              {actions}
            </motion.div>
          )}
        </div>
        
        {children && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 10 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            {children}
          </motion.div>
        )}
      </div>
    </div>
  );
}
