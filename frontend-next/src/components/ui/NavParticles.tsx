'use client';

import * as React from 'react';
import { useDevicePerformance } from '@/contexts/DevicePerformanceContext';
import { cn } from '@/lib/utils';

type Particle = { id: string; variant: string };

const DESKTOP_VARIANTS = Array.from({ length: 14 }, (_, i) => `nav-particle--${i + 1}`);
const MOBILE_VARIANTS = Array.from({ length: 6 }, (_, i) => `nav-particle--m${i + 1}`);

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function useNavParticleBurst() {
  const { viewport, performanceMode, reduceMotion } = useDevicePerformance();
  const disabled = reduceMotion;
  const [particles, setParticles] = React.useState<Particle[]>([]);
  const lastEmitRef = React.useRef(0);

  const emit = React.useCallback(() => {
    if (disabled) return;
    const now = performance.now();
    if (now - lastEmitRef.current < 220) return;
    lastEmitRef.current = now;

    const isMobile = viewport === 'mobile';
    const isTablet = viewport === 'tablet';

    const maxCount = performanceMode ? (isMobile ? 4 : isTablet ? 6 : 8) : isMobile ? 5 : isTablet ? 9 : 14;
    const minCount = performanceMode ? (isMobile ? 2 : isTablet ? 3 : 4) : isMobile ? 3 : isTablet ? 6 : 8;
    const count = randInt(minCount, maxCount);
    const variants = performanceMode || isMobile ? MOBILE_VARIANTS : DESKTOP_VARIANTS;

    const next: Particle[] = Array.from({ length: count }, () => {
      const id = `${now.toFixed(0)}-${Math.random().toString(16).slice(2)}`;
      return { id, variant: pick(variants) };
    });

    setParticles((prev) => {
      const capped = prev.length > 18 ? prev.slice(prev.length - 18) : prev;
      return [...capped, ...next];
    });
  }, [disabled, performanceMode, viewport]);

  const remove = React.useCallback((id: string) => {
    setParticles((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const layer = (
    <span aria-hidden="true" className="nav-particles">
      {particles.map((p) => (
        <span
          key={p.id}
          className={cn('nav-particle', p.variant)}
          onAnimationEnd={() => remove(p.id)}
        />
      ))}
    </span>
  );

  return { emit, layer, disabled, count: particles.length };
}

export function NavParticlesHost({ targetRef }: { targetRef: React.RefObject<HTMLElement | null> }) {
  const { emit, layer, disabled } = useNavParticleBurst();

  React.useEffect(() => {
    const el = targetRef.current;
    if (!el || disabled) return;

    const onEnter = () => emit();
    const onClick = () => emit();

    el.addEventListener('pointerenter', onEnter, { passive: true } as any);
    el.addEventListener('click', onClick, { passive: true } as any);
    return () => {
      el.removeEventListener('pointerenter', onEnter as any);
      el.removeEventListener('click', onClick as any);
    };
  }, [disabled, emit, targetRef]);

  return layer;
}
