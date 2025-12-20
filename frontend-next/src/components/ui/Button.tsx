'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-gradient-to-r from-primary-500 to-primary-600 text-white hover:from-primary-400 hover:to-primary-500 shadow-glow hover:shadow-glow-lg transform hover:scale-105 active:scale-95',
        secondary: [
          'bg-white/5 border border-white/20 text-white hover:bg-white/10 hover:border-primary-400/50',
          '[html.light_&]:bg-gray-100/80 [html.light_&]:border-gray-300/50 [html.light_&]:text-gray-800',
          '[html.light_&]:hover:bg-gray-200/80 [html.light_&]:hover:border-primary-400/50',
          'transform hover:scale-105 active:scale-95'
        ],
        danger: 'bg-gradient-to-r from-red-500 to-rose-600 text-white hover:from-red-400 hover:to-rose-500 transform hover:scale-105 active:scale-95',
        success: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-400 hover:to-teal-500 transform hover:scale-105 active:scale-95',
        ghost: [
          'text-gray-400 hover:text-white hover:bg-white/5',
          '[html.light_&]:text-gray-600 [html.light_&]:hover:text-gray-900 [html.light_&]:hover:bg-gray-100/50'
        ],
        glow: 'bg-gradient-to-r from-accent-cyan to-accent-emerald text-white shadow-glow-cyan hover:shadow-glow-lg transform hover:scale-105',
      },
      size: {
        default: 'h-10 px-6 py-2',
        sm: 'h-9 px-4 text-xs',
        lg: 'h-12 px-8',
        icon: 'h-10 w-10',
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
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading, icon, children, disabled, ...props }, ref) => {
    return (
      <motion.button
        whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
        whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref as any}
        disabled={disabled || loading}
        {...(props as any)}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : icon ? (
          icon
        ) : null}
        {children}
      </motion.button>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };