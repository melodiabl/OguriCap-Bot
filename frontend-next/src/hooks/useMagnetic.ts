'use client';

import { useEffect, useRef } from 'react';

interface UseMagneticOptions {
  /** Fraction of offset to apply (0–1). Default: 0.35 */
  strength?: number;
  /** Ease-in transition duration in ms. Default: 200 */
  easeIn?: number;
  /** Ease-out (release) transition duration in ms. Default: 500 */
  easeOut?: number;
}

export function useMagnetic<T extends HTMLElement = HTMLButtonElement>(
  options: UseMagneticOptions = {}
) {
  const ref = useRef<T | null>(null);
  const { strength = 0.35, easeIn = 200, easeOut = 500 } = options;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const el = ref.current;
    if (!el) return;

    function onMove(e: MouseEvent) {
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = (e.clientX - rect.left - rect.width / 2) * strength;
      const y = (e.clientY - rect.top - rect.height / 2) * strength;
      el.style.transition = `transform ${easeIn}ms cubic-bezier(0.16,1,0.3,1)`;
      el.style.transform = `translate(${x}px, ${y}px)`;
    }

    function onLeave() {
      if (!el) return;
      el.style.transition = `transform ${easeOut}ms cubic-bezier(0.16,1,0.3,1)`;
      el.style.transform = 'translate(0px, 0px)';
    }

    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);
    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
    };
  }, [strength, easeIn, easeOut]);

  return ref;
}
