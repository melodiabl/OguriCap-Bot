'use client';

import * as React from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';

export interface RevealProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  delay?: number;
  once?: boolean;
}

export function Reveal({ className, delay = 0, once = true, children, ...props }: RevealProps) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(className)}
      initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.99 }}
      whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
      viewport={reduceMotion ? undefined : { once, amount: 0.25 }}
      transition={
        reduceMotion
          ? { duration: 0.12 }
          : {
              duration: 0.38,
              ease: [0.16, 1, 0.3, 1],
              delay,
            }
      }
      {...props}
    >
      {children}
    </motion.div>
  );
}
