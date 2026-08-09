'use client';

import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { usePathname, useSearchParams } from 'next/navigation';

export function RouteProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();

  const routeKey = React.useMemo(() => {
    const qs = searchParams?.toString() || '';
    return `${pathname}${qs ? `?${qs}` : ''}`;
  }, [pathname, searchParams]);

  const [visible, setVisible] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    if (reduceMotion) return;

    setVisible(true);
    setProgress(15);

    const timers: Array<ReturnType<typeof setTimeout>> = [];
    timers.push(setTimeout(() => setProgress(55), 120));
    timers.push(setTimeout(() => setProgress(80), 260));
    timers.push(setTimeout(() => setProgress(92), 420));
    timers.push(setTimeout(() => setProgress(100), 600));
    timers.push(
      setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 780)
    );

    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [routeKey, reduceMotion]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="pointer-events-none fixed left-0 top-0 z-[60] h-[3px] w-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div
            className="h-full w-full origin-left bg-gradient-to-r from-primary-500 via-cyan-400 to-emerald-400 shadow-[0_0_18px_rgba(99,102,241,0.45)]"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: Math.min(1, Math.max(0, progress / 100)) }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

