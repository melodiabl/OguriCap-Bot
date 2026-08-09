'use client';

import { useCallback, useRef } from 'react';

interface RateLimitOptions {
  maxCalls: number;
  windowMs: number;
}

export function useRateLimit(options: RateLimitOptions = { maxCalls: 10, windowMs: 60000 }) {
  const callTimes = useRef<number[]>([]);

  const isAllowed = useCallback(() => {
    const now = Date.now();
    const { maxCalls, windowMs } = options;

    // Remove calls outside the current window
    callTimes.current = callTimes.current.filter(time => now - time < windowMs);

    // Check if we can make another call
    if (callTimes.current.length >= maxCalls) {
      return false;
    }

    // Record this call
    callTimes.current.push(now);
    return true;
  }, [options]);

  const getRemainingCalls = useCallback(() => {
    const now = Date.now();
    const { maxCalls, windowMs } = options;

    // Remove calls outside the current window
    callTimes.current = callTimes.current.filter(time => now - time < windowMs);

    return Math.max(0, maxCalls - callTimes.current.length);
  }, [options]);

  const getResetTime = useCallback(() => {
    if (callTimes.current.length === 0) return 0;
    
    const { windowMs } = options;
    const oldestCall = Math.min(...callTimes.current);
    return oldestCall + windowMs;
  }, [options]);

  return {
    isAllowed,
    getRemainingCalls,
    getResetTime,
  };
}

// Hook específico para APIs de grupos
export function useGroupsRateLimit() {
  return useRateLimit({ maxCalls: 5, windowMs: 60000 }); // 5 llamadas por minuto
}

// Hook para crear funciones con rate limiting automático
export function useRateLimitedFunction<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: RateLimitOptions
): T & { canCall: () => boolean; remainingCalls: () => number } {
  const { isAllowed, getRemainingCalls } = useRateLimit(options);

  const rateLimitedFn = useCallback(async (...args: any[]) => {
    if (!isAllowed()) {
      throw new Error('Rate limit exceeded. Please wait before making another request.');
    }
    return fn(...args);
  }, [fn, isAllowed]) as T;

  return Object.assign(rateLimitedFn, {
    canCall: isAllowed,
    remainingCalls: getRemainingCalls,
  });
}