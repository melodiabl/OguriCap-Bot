'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Returns [ref, visible] for scroll-triggered Animate.css entrance.
 * When visible === true, add 'animate__animated animate__<name>' to className.
 * threshold: 0–1 fraction of element visible to trigger (default 0.15).
 */
export function useScrollAnimate(threshold = 0.15) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reducedMotion) {
      setVisible(true);
      return;
    }
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, reducedMotion]);

  return [ref, visible] as const;
}
