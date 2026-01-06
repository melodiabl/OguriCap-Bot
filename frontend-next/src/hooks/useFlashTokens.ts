import { useCallback, useEffect, useRef, useState } from 'react';

type FlashTokenMap = Record<string, number>;

export function useFlashTokens(options?: { ttlMs?: number }) {
  const ttlMs = options?.ttlMs ?? 1500;
  const [tokens, setTokens] = useState<FlashTokenMap>({});
  const timeoutsRef = useRef<Record<string, number>>({});

  const trigger = useCallback(
    (id: string) => {
      const key = String(id);
      setTokens(prev => ({ ...prev, [key]: (prev[key] ?? 0) + 1 }));

      const existing = timeoutsRef.current[key];
      if (existing) window.clearTimeout(existing);

      timeoutsRef.current[key] = window.setTimeout(() => {
        setTokens(prev => {
          if (!(key in prev)) return prev;
          const rest = { ...prev };
          delete rest[key];
          return rest;
        });
        delete timeoutsRef.current[key];
      }, ttlMs);
    },
    [ttlMs]
  );

  useEffect(() => {
    return () => {
      for (const timeoutId of Object.values(timeoutsRef.current)) {
        window.clearTimeout(timeoutId);
      }
      timeoutsRef.current = {};
    };
  }, []);

  return { tokens, trigger };
}
