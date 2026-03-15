'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion, useReducedMotion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NavParticlesHost } from '@/components/ui/NavParticles';

const buttonVariants = cva(
  'btn-sheen relative overflow-hidden press-scale focus-ring-animated inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold tracking-wide transition-all duration-500 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-oguri-lavender/50 focus-visible:ring-offset-2 focus-visible:ring-offset-oguri-phantom-950 disabled:pointer-events-none disabled:opacity-50 ring-1 ring-oguri-purple/20 hover:ring-oguri-lavender/40 hover:-translate-y-0.5 active:translate-y-0',
  {
    variants: {
      variant: {
        primary: 'btn-oguri bg-gradient-oguri-primary text-white shadow-glow-oguri-purple',
        secondary: 'bg-oguri-phantom-800/60 text-oguri-lavender hover:bg-oguri-phantom-700/80 border border-oguri-purple/10',
        danger: 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20',
        success: 'bg-oguri-cyan/10 text-oguri-cyan hover:bg-oguri-cyan/20 border border-oguri-cyan/20 shadow-glow-oguri-cyan',
        glow: 'btn-oguri bg-gradient-oguri-power text-white shadow-glow-oguri-mixed animate-oguri-aura',
        ghost: [
          'px-4 py-2',
          'text-oguri-lavender/60 hover:text-oguri-lavender hover:bg-oguri-purple/10',
        ],
      },
      size: {
        default: '',
        sm: '!px-4 !py-2 text-xs',
        lg: '!px-8 !py-4 text-base',
        icon: '!p-2.5 h-11 w-11',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  navFx?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, icon, navFx = false, children, disabled, ...props }, forwardedRef) => {
    const reduceMotion = useReducedMotion();
    const isDisabled = !!disabled || !!loading;
    const localRef = React.useRef<HTMLButtonElement | null>(null);
    return (
      <motion.button
        whileHover={reduceMotion ? undefined : { scale: disabled || loading ? 1 : 1.02 }}
        whileTap={reduceMotion ? undefined : { scale: disabled || loading ? 1 : 0.98 }}
        className={cn(
          buttonVariants({ variant, size }),
          isDisabled && 'is-disabled',
          loading && 'is-loading',
          className
        )}
        ref={(node) => {
          localRef.current = node;
          if (!forwardedRef) return;
          if (typeof forwardedRef === 'function') forwardedRef(node);
          else (forwardedRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
        }}
        disabled={isDisabled}
        {...(props as any)}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : icon ? (
          icon
        ) : null}
        {children}
        {navFx && !isDisabled ? <NavParticlesHost targetRef={localRef} /> : null}
      </motion.button>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
