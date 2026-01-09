'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Terminal as XTermTerminal } from 'xterm';
import type { FitAddon as FitAddonType } from 'xterm-addon-fit';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useSocketConnection, SOCKET_EVENTS } from '@/contexts/SocketContext';
import api from '@/services/api';

interface TerminalLine {
  id?: number;
  timestamp?: string;
  stream?: 'stdout' | 'stderr' | string;
  line?: string;
}

function safeString(value: any) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return String(value);
}

function toIso(ts: any) {
  const raw = safeString(ts).trim();
  if (!raw) return new Date().toISOString();
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

export function TerminalLogViewer() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const xtermRef = useRef<XTermTerminal | null>(null);
  const fitRef = useRef<FitAddonType | null>(null);
  const { socket, isConnected } = useSocketConnection();

  const [paused, setPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const pendingRef = useRef<string[]>([]);

  const fallbackLinesRef = useRef<string[]>([]);
  const [fallbackTick, setFallbackTick] = useState(0);

  const pushFallbackLine = useCallback((line: string) => {
    const buf = fallbackLinesRef.current;
    buf.push(line);
    if (buf.length > 2000) buf.splice(0, buf.length - 2000);
    setFallbackTick((n) => (n + 1) % 1_000_000);
  }, []);

  const writeRaw = useCallback(
    (line: string) => {
      const term = xtermRef.current;
      if (!term) {
        pushFallbackLine(line);
        return;
      }
      term.writeln(line);
    },
    [pushFallbackLine]
  );

  const flushPending = useCallback(() => {
    if (paused) return;
    const pending = pendingRef.current;
    if (!pending.length) return;
    pendingRef.current = [];
    for (const raw of pending) writeRaw(raw);
  }, [paused, writeRaw]);

  const handleTerminalLine = useCallback(
    (raw: any) => {
      const item: TerminalLine = raw || {};
      const stream = safeString(item.stream || 'stdout').toLowerCase();
      const ts = toIso(item.timestamp).replace('T', ' ').replace('Z', '');
      const line = safeString(item.line ?? '').replace(/\r?\n/g, '');
      if (!line) return;

      const hasAnsi = /\x1b\[[0-9;]*m/.test(line);
      const prefixed = stream === 'stderr' && !hasAnsi ? `\x1b[31m${line}\x1b[0m` : line;
      const out = hasAnsi ? prefixed : `${ts} ${prefixed}`;

      if (paused) {
        pendingRef.current.push(out);
        if (pendingRef.current.length > 500) pendingRef.current.shift();
        return;
      }

      writeRaw(out);
    },
    [paused, writeRaw]
  );

  useEffect(() => {
    if (!containerRef.current) return;

    let disposed = false;
    let onResize: (() => void) | null = null;

    (async () => {
      setInitError(null);
      const [{ Terminal }, { FitAddon }] = await Promise.all([
        import('xterm'),
        import('xterm-addon-fit'),
      ]);

      if (disposed) return;
      if (!Terminal || !FitAddon) throw new Error('xterm no se pudo inicializar');

      const term = new Terminal({
        convertEol: true,
        cursorBlink: false,
        fontFamily:
          'var(--font-mono), ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: 12,
        scrollback: 6000,
        theme: {
          background: '#070b16',
          foreground: '#e5e7eb',
          cursor: '#a78bfa',
          selectionBackground: '#334155',
        },
      });
      const fit = new FitAddon();
      term.loadAddon(fit);

      if (!containerRef.current) throw new Error('Contenedor no disponible');
      term.open(containerRef.current);
      fit.fit();

      xtermRef.current = term as any;
      fitRef.current = fit as any;

      onResize = () => {
        try {
          fit.fit();
        } catch {}
      };
      window.addEventListener('resize', onResize);

      term.writeln('\x1b[90m(terminal listo)\x1b[0m');

      const buffered = fallbackLinesRef.current;
      if (buffered.length) {
        term.writeln('\x1b[90m(reproduciendo salida en cola…)\x1b[0m');
        for (const line of buffered) term.writeln(line);
        fallbackLinesRef.current = [];
        setFallbackTick((n) => (n + 1) % 1_000_000);
      }
    })().catch((err) => {
      console.error('xterm init failed:', err);
      setInitError(err?.message || 'Error inicializando terminal');
    });

    return () => {
      disposed = true;
      if (onResize) window.removeEventListener('resize', onResize);
      try {
        xtermRef.current?.dispose();
      } catch {}
      xtermRef.current = null;
      fitRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on(SOCKET_EVENTS.TERMINAL_LINE, handleTerminalLine);
    return () => {
      socket.off(SOCKET_EVENTS.TERMINAL_LINE, handleTerminalLine);
    };
  }, [socket, handleTerminalLine]);

  const loadRecent = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getTerminal({ limit: 200 });
      const list = Array.isArray(data?.lines) ? data.lines : [];
      writeRaw('\x1b[90m--- últimos 200 ---\x1b[0m');
      for (const item of list) handleTerminalLine(item);
      writeRaw('\x1b[90m--- fin ---\x1b[0m');
    } catch {
      writeRaw('\x1b[31mError cargando terminal.\x1b[0m');
    } finally {
      setLoading(false);
    }
  }, [handleTerminalLine, writeRaw]);

  const clear = useCallback(() => {
    pendingRef.current = [];
    try {
      xtermRef.current?.clear();
    } catch {}
    try {
      void api.clearTerminal();
    } catch {}
    fallbackLinesRef.current = [];
    setFallbackTick((n) => (n + 1) % 1_000_000);
    writeRaw('\x1b[90m(clear)\x1b[0m');
  }, [writeRaw]);

  const connectionBadge = useMemo(() => {
    return isConnected ? (
      <Badge variant="success">Socket conectado</Badge>
    ) : (
      <Badge variant="danger">Socket desconectado</Badge>
    );
  }, [isConnected]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {connectionBadge}
          {paused ? <Badge variant="warning">Pausado</Badge> : <Badge variant="info">En vivo</Badge>}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={loadRecent} disabled={loading}>
            {loading ? 'Cargando…' : 'Cargar últimos 200'}
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setPaused((p) => {
                const next = !p;
                if (!next) setTimeout(flushPending, 0);
                return next;
              });
            }}
          >
            {paused ? 'Reanudar' : 'Pausar'}
          </Button>
          <Button variant="danger" onClick={clear}>
            Limpiar
          </Button>
        </div>
      </div>

      <div className="glass-card p-0 overflow-hidden border border-white/10">
        {initError ? (
          <div className="p-4 text-sm text-red-200">
            <div className="font-semibold">Error inicializando terminal</div>
            <div className="mt-1">{initError}</div>
            <div className="mt-3 rounded-md bg-black/30 p-3 text-xs text-white/80">
              <div className="mb-2 font-semibold text-white/90">Salida (modo simple)</div>
              <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-words font-mono">
                {fallbackLinesRef.current.join('\n')}
              </pre>
            </div>
          </div>
        ) : (
          <div ref={containerRef} className="h-[600px] w-full bg-[#070b16]" />
        )}
      </div>

      <span className="hidden">{fallbackTick}</span>
    </div>
  );
}

