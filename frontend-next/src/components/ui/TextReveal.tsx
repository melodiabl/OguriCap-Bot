'use client';

import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface TextRevealProps {
  text: string;
  as?: keyof React.JSX.IntrinsicElements;
  className?: string;
  /** Stagger delay per character in ms */
  stagger?: number;
  /** Base animation duration per char in ms */
  duration?: number;
  /** Intersection threshold before triggering */
  threshold?: number;
  once?: boolean;
}

export function TextReveal({
  text,
  as: Tag = 'span',
  className,
  stagger = 28,
  duration = 600,
  threshold = 0.2,
  once = true,
}: TextRevealProps) {
  const containerRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);
  const reduceMotion =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    if (reduceMotion) { setVisible(true); return; }
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (once) observer.disconnect();
        } else if (!once) {
          setVisible(false);
        }
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, once, reduceMotion]);

  const chars = text.split('');

  // Spaces rendered as non-breaking so they don't collapse
  return (
    // @ts-expect-error — polymorphic as prop
    <Tag ref={containerRef} className={cn('inline', className)} aria-label={text}>
      {reduceMotion
        ? text
        : chars.map((char, i) => (
            <span
              key={i}
              aria-hidden="true"
              style={{
                display: 'inline-block',
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0) rotateX(0deg)' : 'translateY(0.5em) rotateX(-40deg)',
                transition: visible
                  ? `opacity ${duration}ms cubic-bezier(0.16,1,0.3,1) ${i * stagger}ms, transform ${duration}ms cubic-bezier(0.16,1,0.3,1) ${i * stagger}ms`
                  : 'none',
                whiteSpace: char === ' ' ? 'pre' : 'normal',
              }}
            >
              {char === ' ' ? ' ' : char}
            </span>
          ))}
    </Tag>
  );
}
