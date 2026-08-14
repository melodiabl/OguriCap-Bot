'use client';

import { useEffect, useRef } from 'react';
import { annotate } from 'rough-notation';
import type { RoughAnnotation, RoughAnnotationType } from 'rough-notation/lib/model';

interface UseRoughAnnotationOptions {
  type?: RoughAnnotationType;
  color?: string;
  strokeWidth?: number;
  padding?: number;
  animate?: boolean;
  animationDuration?: number;
  /** Delay (ms) after the element enters the viewport before showing the annotation */
  delay?: number;
}

export function useRoughAnnotation<T extends HTMLElement = HTMLElement>(
  visible: boolean,
  options: UseRoughAnnotationOptions = {}
) {
  const ref = useRef<T | null>(null);
  const annotationRef = useRef<RoughAnnotation | null>(null);

  const {
    type = 'underline',
    color = '#25d366',
    strokeWidth = 2,
    padding = 2,
    animate = true,
    animationDuration = 800,
    delay = 0,
  } = options;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (!ref.current) return;

    annotationRef.current = annotate(ref.current, {
      type,
      color,
      strokeWidth,
      padding,
      animate,
      animationDuration,
    });

    return () => {
      annotationRef.current?.remove();
      annotationRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!annotationRef.current) return;
    if (visible) {
      const t = delay > 0 ? setTimeout(() => annotationRef.current?.show(), delay) : null;
      if (!t) annotationRef.current.show();
      return () => { if (t) clearTimeout(t); };
    } else {
      annotationRef.current.hide();
    }
  }, [visible, delay]);

  return ref;
}
