'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface AnimatedSectionProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  stagger?: boolean;
}

export function AnimatedSection({
  title,
  description,
  icon,
  actions,
  children,
  className,
  contentClassName,
  stagger = true,
}: AnimatedSectionProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className={cn('animated-section', className)}
      initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.99 }}
      whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={reduceMotion ? { duration: 0.12 } : { duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
    >
      {(title || description || icon || actions) && (
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            {icon ? <div className="animated-section__icon">{icon}</div> : null}
            <div className="min-w-0">
              {title ? <div className="animated-section__title">{title}</div> : null}
              {description ? <div className="animated-section__desc">{description}</div> : null}
            </div>
          </div>
          {actions ? <div className="shrink-0 flex items-center gap-2">{actions}</div> : null}
        </div>
      )}

      <div className={cn(stagger && 'stagger-children', contentClassName)}>{children}</div>
    </motion.section>
  );
}
