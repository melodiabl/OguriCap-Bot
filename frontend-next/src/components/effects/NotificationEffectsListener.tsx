'use client';

import { useEffect, useRef } from 'react';
import { useSocketConnection, SOCKET_EVENTS } from '@/contexts/SocketContext';
import { usePreferences } from '@/contexts/PreferencesContext';

function isImportantNotification(n: any) {
  const type = String(n?.tipo ?? n?.type ?? '').toLowerCase();
  return type === 'error' || type === 'warning' || n?.important === true || n?.severity >= 4;
}

function notificationKey(n: any) {
  const id = n?.id ?? n?._id;
  if (id != null) return `id:${String(id)}`;
  const title = String(n?.titulo ?? n?.title ?? '');
  const message = String(n?.mensaje ?? n?.message ?? '');
  const type = String(n?.tipo ?? n?.type ?? '');
  const ts = String(n?.fecha_creacion ?? n?.timestamp ?? '');
  return `sig:${type}|${title}|${message}|${ts}`;
}

function playBeep(ctx: AudioContext) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();

  oscillator.type = 'sine';
  oscillator.frequency.value = 880;

  gain.gain.setValueAtTime(0.0001, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);

  oscillator.connect(gain);
  gain.connect(ctx.destination);

  oscillator.start();
  oscillator.stop(ctx.currentTime + 0.25);
}

export function NotificationEffectsListener() {
  const { socket } = useSocketConnection();
  const { preferences } = usePreferences();
  const audioCtxRef = useRef<AudioContext | null>(null);
  const hasUserInteractedRef = useRef(false);
  const seenRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const onFirstInteraction = () => {
      hasUserInteractedRef.current = true;
      window.removeEventListener('pointerdown', onFirstInteraction);
      window.removeEventListener('keydown', onFirstInteraction);
    };
    window.addEventListener('pointerdown', onFirstInteraction, { passive: true });
    window.addEventListener('keydown', onFirstInteraction);
    return () => {
      window.removeEventListener('pointerdown', onFirstInteraction);
      window.removeEventListener('keydown', onFirstInteraction);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handle = (n: any) => {
      if (!n) return;
      if (!isImportantNotification(n)) return;

      const key = notificationKey(n);
      const now = Date.now();
      const last = seenRef.current.get(key) ?? 0;
      if (now - last < 2000) return;
      seenRef.current.set(key, now);

      if (preferences.hapticsEnabled && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          (navigator as any).vibrate?.([40, 30, 90]);
        } catch {
          // ignore
        }
      }

      if (!preferences.soundEnabled) return;
      if (!hasUserInteractedRef.current) return;

      try {
        if (!audioCtxRef.current) {
          const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
          if (!AC) return;
          audioCtxRef.current = new AC();
        }

        const ctx = audioCtxRef.current;
        if (!ctx) return;
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        playBeep(ctx);
      } catch {
        // ignore
      }
    };

    socket.on(SOCKET_EVENTS.NOTIFICATION, handle);
    socket.on('notification:created', handle);

    return () => {
      socket.off(SOCKET_EVENTS.NOTIFICATION, handle);
      socket.off('notification:created', handle);
    };
  }, [preferences.hapticsEnabled, preferences.soundEnabled, socket]);

  return null;
}
