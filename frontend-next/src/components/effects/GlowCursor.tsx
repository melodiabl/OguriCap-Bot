'use client';

import { useEffect, useRef } from 'react';
import { useReducedMotion } from 'framer-motion';

export function GlowCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    if (typeof window === 'undefined') return;
    // Only on pointer devices
    if (!window.matchMedia('(pointer: fine)').matches) return;

    let raf: number;
    let mouseX = -200, mouseY = -200;
    let ringX = -200, ringY = -200;
    let isHover = false;

    const onMove = (e: MouseEvent) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
    };

    const onEnterLink = () => { isHover = true; };
    const onLeaveLink = () => { isHover = false; };

    document.addEventListener('mousemove', onMove, { passive: true });

    // Detect hover on interactive elements
    const handleHover = (e: MouseEvent) => {
      const target = e.target as Element;
      isHover = !!(target?.closest('button, a, [role="button"], [tabindex], input, select, textarea, label'));
      if (ringRef.current) {
        ringRef.current.style.transform = isHover
          ? `translate(${ringX - 20}px, ${ringY - 20}px) scale(1.8)`
          : `translate(${ringX - 20}px, ${ringY - 20}px) scale(1)`;
      }
    };

    document.addEventListener('mouseover', handleHover, { passive: true });

    const LERP = 0.11;

    function loop() {
      if (dotRef.current) {
        dotRef.current.style.transform = `translate(${mouseX - 4}px, ${mouseY - 4}px)`;
      }
      ringX += (mouseX - ringX) * LERP;
      ringY += (mouseY - ringY) * LERP;
      if (ringRef.current) {
        ringRef.current.style.transform = isHover
          ? `translate(${ringX - 20}px, ${ringY - 20}px) scale(1.8)`
          : `translate(${ringX - 20}px, ${ringY - 20}px) scale(1)`;
      }
      raf = requestAnimationFrame(loop);
    }
    raf = requestAnimationFrame(loop);

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseover', handleHover);
      cancelAnimationFrame(raf);
    };
  }, [reduceMotion]);

  if (reduceMotion) return null;

  return (
    <>
      <div ref={dotRef} aria-hidden="true" className="glow-cursor-dot" />
      <div ref={ringRef} aria-hidden="true" className="glow-cursor-ring" />
    </>
  );
}
