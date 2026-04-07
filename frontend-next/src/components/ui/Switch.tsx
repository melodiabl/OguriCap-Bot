'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type SwitchVariant = 'primary' | 'success' | 'warning' | 'danger';

function variantToCssVar(variant: SwitchVariant) {
  switch (variant) {
    case 'success':
      return '--success';
    case 'warning':
      return '--warning';
    case 'danger':
      return '--danger';
    case 'primary':
    default:
      return '--primary';
  }
}

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  variant = 'primary',
  label,
  className,
  id,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  variant?: SwitchVariant;
  label?: string;
  className?: string;
  id?: string;
}) {
  const reduceMotion = useReducedMotion();
  const cssVar = variantToCssVar(variant);

  const toggle = React.useCallback(() => {
    if (disabled) return;
    onCheckedChange(!checked);
  }, [disabled, onCheckedChange, checked]);

  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label || 'Toggle'}
      disabled={disabled}
      onClick={toggle}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          toggle();
        }
      }}
      style={{ ['--switch-rgb' as any]: `var(${cssVar})` } as React.CSSProperties}
      className={cn(
        'relative inline-flex h-7 w-14 items-center rounded-full border transition-colors focus:outline-none',
        'focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring)/0.75)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
        checked
          ? 'bg-[rgb(var(--switch-rgb)/0.18)] border-[rgb(var(--switch-rgb)/0.35)] shadow-[0_0_18px_rgb(var(--switch-rgb)/0.18)]'
          : 'bg-white/5 border-white/10 hover:bg-white/10',
        disabled && 'opacity-50 cursor-not-allowed hover:bg-white/5',
        className
      )}
    >
      <motion.span
        aria-hidden="true"
        className={cn(
          'absolute left-1 top-1 grid h-5 w-5 place-items-center rounded-full',
          'bg-[rgb(var(--bg-1))] border border-white/10 shadow-lg',
          checked ? 'text-[rgb(var(--switch-rgb)/0.95)]' : 'text-white/40'
        )}
        animate={reduceMotion ? undefined : { x: checked ? 28 : 0 }}
        transition={
          reduceMotion
            ? { duration: 0 }
            : { type: 'spring', stiffness: 520, damping: 34, mass: 0.8 }
        }
      >
        {checked ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      </motion.span>
    </button>
  );
}
