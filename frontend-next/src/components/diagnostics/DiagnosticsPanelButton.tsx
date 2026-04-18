'use client';

import React, { useMemo, useState } from 'react';
import { Activity, Bot, Cpu, HardDrive, Radio, RefreshCw, Server, Wifi, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Tooltip } from '@/components/ui/Tooltip';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { useSocketConnection } from '@/contexts/SocketContext';
import { useBotStatus, useConnectionHealth, useSubbotsStatus, useSystemStats } from '@/hooks/useRealTime';
import { cn, formatUptime } from '@/lib/utils';

type DiagnosticState = 'live' | 'warning' | 'danger';

function DiagnosticsMetric({
  label,
  value,
  detail,
  icon,
  tone = 'default',
}: {
  label: string;
  value: React.ReactNode;
  detail: string;
  icon: React.ReactNode;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const toneClass = {
    default: 'border-white/10 bg-white/[0.03] text-white',
    success: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100',
    warning: 'border-amber-400/20 bg-amber-500/10 text-amber-100',
    danger: 'border-rose-400/20 bg-rose-500/10 text-rose-100',
    info: 'border-sky-400/20 bg-sky-500/10 text-sky-100',
  }[tone];

  return (
    <div className={cn('rounded-[24px] border p-4', toneClass)}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-gray-400">{label}</p>
          <p className="mt-2 text-2xl font-black leading-none text-white">{value}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/10 p-3 text-white shadow-glow-sm">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-sm text-gray-400">{detail}</p>
    </div>
  );
}

export function DiagnosticsPanelButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { isConnected: isSocketConnected } = useSocketConnection();
  const { status, isConnected: isBotConnected, isConnecting, refetch: refetchBot } = useBotStatus();
  const { memoryUsage, cpuUsage, diskUsage, uptime, refetch: refetchSystem } = useSystemStats();
  const { onlineCount, totalCount, refetch: refetchSubbots } = useSubbotsStatus();
  const { latency, refetch: refetchLatency } = useConnectionHealth(15000);

  const refreshAll = async () => {
    setIsRefreshing(true);
    await Promise.allSettled([refetchBot(), refetchSystem(), refetchSubbots(), refetchLatency()]);
    setIsRefreshing(false);
  };

  const health = useMemo(() => {
    const issues: string[] = [];
    const memory = Number(memoryUsage?.systemPercentage || 0);
    const cpu = Number(cpuUsage || 0);
    const disk = Number(diskUsage?.percentage || 0);

    if (!isSocketConnected) issues.push('Socket en tiempo real desconectado.');
    if (!isBotConnected && !isConnecting) issues.push('Bot principal offline.');
    if (latency < 0) issues.push('No se pudo medir la latencia del backend.');
    if (latency > 1200) issues.push(`Latencia alta (${latency}ms).`);
    if (memory >= 85) issues.push(`Memoria elevada (${memory.toFixed(0)}%).`);
    if (cpu >= 90) issues.push(`CPU elevada (${cpu.toFixed(0)}%).`);
    if (disk >= 90) issues.push(`Disco casi lleno (${disk.toFixed(0)}%).`);
    if (totalCount > 0 && onlineCount === 0) issues.push('No hay subbots online.');

    const state =
      !isSocketConnected || (!isBotConnected && !isConnecting)
        ? 'danger'
        : issues.length > 0
          ? 'warning'
          : 'live';

    const title =
      state === 'live'
        ? 'Sistema estable'
        : state === 'warning'
          ? 'Atención requerida'
          : 'Incidencia activa';

    const summary =
      state === 'live'
        ? 'El panel, el bot y la telemetría principal están respondiendo bien.'
        : state === 'warning'
          ? 'Hay señales que conviene revisar antes de que escalen.'
          : 'Hay componentes críticos degradados o desconectados.';

    return { issues, state: state as DiagnosticState, title, summary };
  }, [cpuUsage, diskUsage?.percentage, isBotConnected, isConnecting, isSocketConnected, latency, memoryUsage?.systemPercentage, onlineCount, totalCount]);

  const botLabel = isBotConnected ? 'Online' : isConnecting ? 'Sync' : 'Offline';
  const botTone = isBotConnected ? 'success' : isConnecting ? 'warning' : 'danger';
  const socketLabel = isSocketConnected ? 'Live' : 'Offline';
  const socketTone = isSocketConnected ? 'success' : 'danger';
  const memory = Number(memoryUsage?.systemPercentage || 0);
  const cpu = Number(cpuUsage || 0);
  const disk = Number(diskUsage?.percentage || 0);

  return (
    <>
      <Tooltip content="Panel de Diagnóstico" side="bottom">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(true)}
          aria-label="Abrir panel de diagnóstico"
          className={cn(
            'relative rounded-2xl border border-transparent bg-transparent text-muted hover:border-border/20 hover:bg-white/[0.06] hover:text-foreground',
            health.state === 'danger' && 'bg-rose-500/10 text-rose-300 shadow-[0_0_18px_rgba(244,63,94,0.18)]',
            health.state === 'warning' && 'bg-amber-500/10 text-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.16)]',
            health.state === 'live' && 'bg-emerald-500/10 text-emerald-300 shadow-[0_0_18px_rgba(16,185,129,0.14)]'
          )}
        >
          <Activity className="h-5 w-5" />
        </Button>
      </Tooltip>

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Panel de Diagnóstico"
        className="max-w-[min(100vw-1rem,68rem)]"
      >
        <div className="space-y-5">
          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(135deg,rgba(var(--primary),0.16),rgba(var(--secondary),0.10),rgba(var(--accent),0.14))] p-5 shadow-[0_24px_80px_-40px_rgba(0,0,0,0.45)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <LiveIndicator state={health.state} label={health.title} />
                  <span className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-gray-300">
                    {latency >= 0 ? `${latency}ms` : 'sin ping'}
                  </span>
                </div>
                <h3 className="text-2xl font-black tracking-tight text-white">Lectura táctica del sistema</h3>
                <p className="mt-2 max-w-2xl text-sm text-gray-300">{health.summary}</p>
              </div>

              <Button
                onClick={refreshAll}
                loading={isRefreshing}
                variant="secondary"
                icon={<RefreshCw className="h-4 w-4" />}
                className="self-start border-white/10 bg-black/10 text-white hover:bg-white/[0.08]"
              >
                Refrescar
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <DiagnosticsMetric
              label="Socket"
              value={socketLabel}
              detail={isSocketConnected ? 'Tiempo real activo.' : 'Fallback HTTP o reconectando.'}
              icon={isSocketConnected ? <Radio className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
              tone={socketTone}
            />
            <DiagnosticsMetric
              label="Bot Principal"
              value={botLabel}
              detail={status?.phone || 'Sin número vinculado'}
              icon={<Bot className="h-5 w-5" />}
              tone={botTone as any}
            />
            <DiagnosticsMetric
              label="Uptime"
              value={formatUptime(uptime)}
              detail="Tiempo real del proceso actual."
              icon={<Server className="h-5 w-5" />}
              tone="info"
            />
            <DiagnosticsMetric
              label="Memoria"
              value={`${memory.toFixed(0)}%`}
              detail="Uso total del sistema."
              icon={<Activity className="h-5 w-5" />}
              tone={memory >= 85 ? 'danger' : memory >= 70 ? 'warning' : 'info'}
            />
            <DiagnosticsMetric
              label="CPU"
              value={`${cpu.toFixed(0)}%`}
              detail="Carga de procesamiento actual."
              icon={<Cpu className="h-5 w-5" />}
              tone={cpu >= 90 ? 'danger' : cpu >= 70 ? 'warning' : 'default'}
            />
            <DiagnosticsMetric
              label="Subbots"
              value={`${onlineCount}/${totalCount}`}
              detail={totalCount > 0 ? 'Instancias online sobre el total.' : 'No hay subbots registrados.'}
              icon={<Wifi className="h-5 w-5" />}
              tone={totalCount > 0 && onlineCount === 0 ? 'danger' : onlineCount < totalCount ? 'warning' : 'success'}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
              <h4 className="text-sm font-black uppercase tracking-[0.16em] text-gray-400">Observaciones</h4>
              {health.issues.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {health.issues.map((issue) => (
                    <div key={issue} className="rounded-2xl border border-amber-400/15 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                      {issue}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-emerald-400/15 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  Sin alertas relevantes. El panel y el bot están dentro de parámetros normales.
                </div>
              )}
            </div>

            <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
              <h4 className="text-sm font-black uppercase tracking-[0.16em] text-gray-400">Resumen rápido</h4>
              <div className="mt-4 space-y-3 text-sm text-gray-300">
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                  <span>Latencia backend</span>
                  <span className="font-black text-white">{latency >= 0 ? `${latency}ms` : 'sin datos'}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                  <span>Disco</span>
                  <span className="font-black text-white">{disk ? `${disk.toFixed(0)}%` : 'sin datos'}</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                  <span>Socket</span>
                  <span className={cn('font-black', isSocketConnected ? 'text-emerald-300' : 'text-rose-300')}>
                    {isSocketConnected ? 'Conectado' : 'Desconectado'}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                  <span>Bot</span>
                  <span className={cn('font-black', isBotConnected ? 'text-emerald-300' : isConnecting ? 'text-amber-300' : 'text-rose-300')}>
                    {botLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
