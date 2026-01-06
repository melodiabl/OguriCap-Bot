'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion, useReducedMotion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { NavParticlesHost } from '@/components/ui/NavParticles';

const buttonVariants = cva(
  'btn-sheen relative overflow-hidden press-scale focus-ring-animated inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl text-sm font-semibold tracking-wide transition-all duration-500 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring)/0.55)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgb(var(--bg)/1)] disabled:pointer-events-none disabled:opacity-50 ring-1 ring-[rgb(var(--border)/0.35)] hover:ring-[rgb(var(--border)/0.6)] hover:-translate-y-0.5 active:translate-y-0',
  {
    variants: {
      variant: {
        primary: 'btn-primary',
        secondary: 'btn-secondary',
        danger: 'btn-danger',
        success: 'btn-glow',
        glow: 'btn-glow',
        ghost: [
          'px-4 py-2',
          'text-muted hover:text-foreground hover:bg-card/40 hover:shadow-inner-glow',
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
