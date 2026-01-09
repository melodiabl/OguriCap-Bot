'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Terminal as XTermTerminal } from 'xterm';
import type { FitAddon as FitAddonType } from 'xterm-addon-fit';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useSocketConnection, SOCKET_EVENTS } from '@/contexts/SocketContext';
import api from '@/services/api';

type LogLevel = 'error' | 'warn' | 'info' | 'debug' | 'trace' | string;

interface LogEntry {
  timestamp?: string;
  level?: LogLevel;
  category?: string;
  message?: string;
  data?: any;
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

function formatLine(log: LogEntry) {
  const ts = toIso(log.timestamp).replace('T', ' ').replace('Z', '');
  const level = safeString(log.level || 'info').toLowerCase();
  const category = safeString(log.category || 'system');
  const message = safeString(log.message || '').replace(/\s+/g, ' ').trim();
  const data =
    log.data && typeof log.data === 'object'
      ? safeString(JSON.stringify(log.data)).slice(0, 800)
      : safeString(log.data || '').slice(0, 800);
  const tail = data ? ` | ${data}` : '';
  return `${ts} [${level}] (${category}) ${message}${tail}`;
}

function levelColor(level: string) {
  switch (level) {
    case 'error':
      return '\x1b[31m';
    case 'warn':
    case 'warning':
      return '\x1b[33m';
    case 'debug':
      return '\x1b[35m';
    case 'trace':
      return '\x1b[90m';
    case 'info':
    default:
      return '\x1b[36m';
  }
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

  const writeLine = useCallback(
    (line: string, level: string) => {
      const term = xtermRef.current;
      if (!term) {
        pushFallbackLine(line);
        return;
      }
      const color = levelColor(level);
      term.writeln(`${color}${line}\x1b[0m`);
    },
    [pushFallbackLine]
  );

  const flushPending = useCallback(() => {
    if (paused) return;
    const pending = pendingRef.current;
    if (!pending.length) return;
    pendingRef.current = [];
    for (const raw of pending) {
      writeLine(raw, 'info');
    }
  }, [paused, writeLine]);

  const handleLog = useCallback(
    (raw: any) => {
      const log: LogEntry = raw || {};
      const level = safeString(log.level || 'info').toLowerCase();
      const line = formatLine(log);
      if (paused) {
        pendingRef.current.push(line);
        if (pendingRef.current.length > 500) pendingRef.current.shift();
        return;
      }
      writeLine(line, level);
    },
    [paused, writeLine]
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
        scrollback: 3000,
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
        term.writeln('\x1b[90m(reproduciendo logs en cola…)\x1b[0m');
        for (const line of buffered) {
          term.writeln(`\x1b[36m${line}\x1b[0m`);
        }
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
    socket.on(SOCKET_EVENTS.LOG_ENTRY, handleLog);
    return () => {
      socket.off(SOCKET_EVENTS.LOG_ENTRY, handleLog);
    };
  }, [socket, handleLog]);

  const loadRecent = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getLogs({ page: 1, limit: 200 });
      const list = Array.isArray(data?.logs) ? data.logs : Array.isArray(data?.data) ? data.data : [];
      writeLine('--- últimos 200 logs ---', 'trace');
      for (const item of list) {
        handleLog(item);
      }
      writeLine('--- fin ---', 'trace');
    } catch {
      writeLine('Error cargando logs.', 'error');
    } finally {
      setLoading(false);
    }
  }, [handleLog, writeLine]);

  const clear = useCallback(() => {
    pendingRef.current = [];
    try {
      xtermRef.current?.clear();
    } catch {}
    fallbackLinesRef.current = [];
    setFallbackTick((n) => (n + 1) % 1_000_000);
    writeLine('(clear)', 'trace');
  }, [writeLine]);

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
          <div ref={containerRef} className="h-[520px] w-full bg-[#070b16]" />
        )}
      </div>

      {/* re-render trigger for the simple fallback */}
      <span className="hidden">{fallbackTick}</span>
    </div>
  );
}
