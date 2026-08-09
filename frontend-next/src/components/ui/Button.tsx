'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion, useReducedMotion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NavParticlesHost } from '@/components/ui/NavParticles';

const buttonVariants = cva(
  'btn-sheen relative overflow-hidden press-scale focus-ring-animated inline-flex max-w-full items-center justify-center gap-2 break-words text-center whitespace-normal rounded-2xl text-sm font-semibold tracking-[0.01em] transition-all duration-300 ease-out focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 ring-1 ring-border/15 hover:ring-border/25 hover:-translate-y-[1px] active:translate-y-0',
  {
    variants: {
      variant: {
        primary: 'btn-oguri bg-gradient-oguri-primary text-white shadow-glow-oguri-purple hover:shadow-glow-oguri-mixed',
        secondary: 'border border-border/20 bg-card/72 text-foreground hover:bg-card/88 hover:border-border/40 hover:shadow-glow',
        danger: 'border border-red-500/25 bg-red-500/12 text-red-400 hover:bg-red-500/20 hover:border-red-500/40 hover:shadow-glow-red',
        success: 'border border-oguri-cyan/25 bg-oguri-cyan/12 text-oguri-cyan hover:bg-oguri-cyan/20 hover:border-oguri-cyan/40 shadow-glow-oguri-cyan',
        glow: 'btn-oguri bg-gradient-oguri-power text-white shadow-glow-oguri-mixed animate-oguri-aura',
        ghost: [
          'px-4 py-2',
          'text-[rgb(var(--text-secondary))] hover:text-[rgb(var(--text-primary))] hover:bg-white/10',
        ],
        accent: 'btn-oguri bg-gradient-oguri-accent text-white shadow-glow-oguri-accent',
      },
      size: {
        default: '!px-5 !py-2.5 text-sm',
        sm: '!px-4 !py-2 text-xs',
        lg: '!px-8 !py-4 text-base',
        xl: '!px-10 !py-5 text-lg font-bold',
        icon: '!p-3 h-12 w-12',
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
        whileHover={reduceMotion ? undefined : { scale: disabled || loading ? 1 : 1.015 }}
        whileTap={reduceMotion ? undefined : { scale: disabled || loading ? 1 : 0.985 }}
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
