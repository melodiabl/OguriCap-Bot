'use client';

import * as React from 'react';
import { animate, useMotionValue, useReducedMotion } from 'framer-motion';

export interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  className?: string;
  locale?: string;
}

function clampDecimals(decimals: number) {
  if (!Number.isFinite(decimals)) return 0;
  return Math.max(0, Math.min(6, Math.floor(decimals)));
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 0.55,
  decimals = 0,
  className,
  locale,
}) => {
  const reduceMotion = useReducedMotion();
  const safeValue = Number.isFinite(value) ? value : 0;
  const safeDecimals = clampDecimals(decimals);

  const motionValue = useMotionValue(safeValue);
  const previousValueRef = React.useRef<number>(safeValue);

  const [displayValue, setDisplayValue] = React.useState<number>(safeValue);

  React.useEffect(() => {
    if (reduceMotion) {
      previousValueRef.current = safeValue;
      motionValue.set(safeValue);
      setDisplayValue(safeValue);
      return;
    }

    const from = previousValueRef.current;
    const to = safeValue;
    previousValueRef.current = to;

    motionValue.set(from);
    const controls = animate(motionValue, to, { duration, ease: [0.16, 1, 0.3, 1] });
    return () => controls.stop();
  }, [duration, motionValue, reduceMotion, safeValue]);

  React.useEffect(() => {
    const unsubscribe = motionValue.on('change', (latest) => {
      const n = Number.isFinite(latest) ? latest : 0;
      setDisplayValue(n);
    });
    return () => unsubscribe();
  }, [motionValue]);

  const formatted = React.useMemo(() => {
    const factor = Math.pow(10, safeDecimals);
    const rounded = safeDecimals > 0 ? Math.round(displayValue * factor) / factor : Math.round(displayValue);
    try {
      return rounded.toLocaleString(locale, {
        minimumFractionDigits: safeDecimals,
        maximumFractionDigits: safeDecimals,
      });
    } catch {
      return String(rounded);
    }
  }, [displayValue, locale, safeDecimals]);

  return <span className={className}>{formatted}</span>;
};

