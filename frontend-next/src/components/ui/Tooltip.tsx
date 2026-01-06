'use client';

import React from 'react';
import { cn } from '@/lib/utils';

type Side = 'top' | 'bottom' | 'left' | 'right';

function getSideClasses(side: Side) {
  switch (side) {
    case 'top':
      return 'bottom-full left-1/2 -translate-x-1/2 mb-2';
    case 'bottom':
      return 'top-full left-1/2 -translate-x-1/2 mt-2';
    case 'left':
      return 'right-full top-1/2 -translate-y-1/2 mr-2';
    case 'right':
    default:
      return 'left-full top-1/2 -translate-y-1/2 ml-2';
  }
}

export function Tooltip({
  content,
  side = 'bottom',
  delayMs = 120,
  className,
  children,
}: {
  content: React.ReactNode;
  side?: Side;
  delayMs?: number;
  className?: string;
  children: React.ReactElement;
}) {
  const id = React.useId();
  const [open, setOpen] = React.useState(false);
  const timerRef = React.useRef<number | null>(null);

  const clearTimer = React.useCallback(() => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const show = React.useCallback(() => {
    clearTimer();
    timerRef.current = window.setTimeout(() => setOpen(true), delayMs);
  }, [clearTimer, delayMs]);

  const hide = React.useCallback(() => {
    clearTimer();
    setOpen(false);
  }, [clearTimer]);

  React.useEffect(() => () => clearTimer(), [clearTimer]);

  return (
    <span className="relative inline-flex">
      {React.cloneElement(children, {
        onPointerEnter: (e: any) => {
          children.props.onPointerEnter?.(e);
          show();
        },
        onPointerLeave: (e: any) => {
          children.props.onPointerLeave?.(e);
          hide();
        },
        onFocus: (e: any) => {
          children.props.onFocus?.(e);
          show();
        },
        onBlur: (e: any) => {
          children.props.onBlur?.(e);
          hide();
        },
        onKeyDown: (e: any) => {
          children.props.onKeyDown?.(e);
          if (e.key === 'Escape') hide();
        },
        'aria-describedby': open ? id : undefined,
      })}
      <div
        id={id}
        role="tooltip"
        className={cn('tooltip-panel', getSideClasses(side), open && 'tooltip-open', className)}
      >
        {content}
      </div>
    </span>
  );
}

