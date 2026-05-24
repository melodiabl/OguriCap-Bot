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
        primary: 'bg-[#25d366] text-black font-semibold hover:bg-[#22c55e] active:scale-95 transition-all',
        secondary: 'bg-[#18181b] text-zinc-200 border border-[#27272a] hover:bg-[#27272a] hover:text-zinc-50 transition-colors',
        danger: 'bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors',
        success: 'bg-[#25d366]/15 text-[#25d366] border border-[#25d366]/25 hover:bg-[#25d366]/20 transition-colors',
        glow: 'bg-[#25d366] text-black font-semibold hover:bg-[#22c55e] shadow-[0_0_24px_#25d36640] transition-all',
        ghost: 'text-zinc-400 hover:bg-[#18181b] hover:text-zinc-200 transition-colors',
        accent: 'bg-[#27272a] text-zinc-200 border border-[#3f3f46] hover:bg-[#3f3f46] hover:text-zinc-50 transition-colors',
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
