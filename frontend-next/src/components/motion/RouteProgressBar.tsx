'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { usePathname } from 'next/navigation';

function isModifiedEvent(event: MouseEvent) {
  return event.metaKey || event.altKey || event.ctrlKey || event.shiftKey;
}

function findAnchorTarget(target: EventTarget | null): HTMLAnchorElement | null {
  if (!target) return null;
  const el = target as HTMLElement;
  if (!el?.closest) return null;
  return el.closest('a');
}

function isSameOrigin(href: string) {
  try {
    const url = new URL(href, window.location.href);
    return url.origin === window.location.origin;
  } catch {
    return false;
  }
}

function shouldStartForAnchor(anchor: HTMLAnchorElement) {
  const href = anchor.getAttribute('href') || '';
  if (!href || href.startsWith('#')) return false;
  if (anchor.target && anchor.target !== '_self') return false;
  if (anchor.hasAttribute('download')) return false;
  if (!isSameOrigin(anchor.href)) return false;
  try {
    const nextUrl = new URL(anchor.href, window.location.href);
    const currentUrl = new URL(window.location.href);
    const nextPath = `${nextUrl.pathname}${nextUrl.search}`;
    const currentPath = `${currentUrl.pathname}${currentUrl.search}`;
    return nextPath !== currentPath;
  } catch {
    return false;
  }
}

export function RouteProgressBar() {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();

  const [active, setActive] = React.useState(false);
  const [progress, setProgress] = React.useState(0);

  const intervalRef = React.useRef<number | null>(null);
  const timeoutRef = React.useRef<number | null>(null);
  const lastPathRef = React.useRef<string | null>(null);

  const clearTimers = React.useCallback(() => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    intervalRef.current = null;
    timeoutRef.current = null;
  }, []);

  const start = React.useCallback(() => {
    if (reduceMotion) return;
    clearTimers();
    setActive(true);
    setProgress(12);

    intervalRef.current = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 90) return p;
        const bump = p < 55 ? 10 : p < 75 ? 6 : 2;
        return Math.min(90, p + bump);
      });
    }, 220);

    timeoutRef.current = window.setTimeout(() => {
      // failsafe: nunca se queda pegado
      setProgress(100);
      window.setTimeout(() => {
        setActive(false);
        setProgress(0);
      }, 280);
      clearTimers();
    }, 12_000);
  }, [clearTimers, reduceMotion]);

  const complete = React.useCallback(() => {
    if (reduceMotion) return;
    setProgress(100);
    window.setTimeout(() => {
      setActive(false);
      setProgress(0);
    }, 260);
    clearTimers();
  }, [clearTimers, reduceMotion]);

  React.useEffect(() => {
    if (reduceMotion) return;
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (isModifiedEvent(event)) return;

      const anchor = findAnchorTarget(event.target);
      if (!anchor) return;
      if (!shouldStartForAnchor(anchor)) return;
      start();
    };

    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [reduceMotion, start]);

  React.useEffect(() => {
    if (reduceMotion) return;
    if (lastPathRef.current === null) {
      lastPathRef.current = pathname;
      return;
    }
    if (lastPathRef.current !== pathname) {
      lastPathRef.current = pathname;
      if (active) complete();
    }
  }, [active, complete, pathname, reduceMotion]);

  if (reduceMotion) return null;

  return (
    <motion.div
      className="route-progress-container"
      initial={false}
      animate={{ opacity: active ? 1 : 0 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      aria-hidden="true"
    >
      <motion.div
        className="route-progress-bar origin-left"
        initial={false}
        animate={{ scaleX: Math.max(0.02, progress / 100) }}
        transition={
          progress >= 100
            ? { duration: 0.18, ease: 'easeOut' }
            : { type: 'spring', stiffness: 260, damping: 32, mass: 0.9 }
        }
      />
    </motion.div>
  );
}

