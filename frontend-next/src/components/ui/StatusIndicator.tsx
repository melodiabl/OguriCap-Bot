'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'connecting';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const sizeClasses = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2.5 h-2.5',
  lg: 'w-4 h-4',
};

const statusConfigs = {
  online: { dot: 'bg-oguri-cyan shadow-glow-oguri-cyan', label: 'Aura Estable', text: 'text-oguri-cyan' },
  offline: { dot: 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]', label: 'Sin Aura', text: 'text-red-400' },
  connecting: { dot: 'bg-oguri-gold shadow-glow-oguri-mixed', label: 'Sincronizando', text: 'text-oguri-gold' },
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  size = 'md',
  showLabel = true,
}) => {
  const config = statusConfigs[status];
  
  return (
    <div className="inline-flex items-center gap-2.5 rounded-full border border-border/15 bg-card/65 px-3 py-1.5 backdrop-blur-xl">
      <div className={cn("relative flex", sizeClasses[size])}>
        {(status === 'online' || status === 'connecting') && (
          <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', config.dot)}></span>
        )}
        <span className={cn('relative inline-flex rounded-full h-full w-full', config.dot)}></span>
      </div>
      {showLabel && (
        <span className={cn('text-[10px] font-black uppercase tracking-widest', config.text)}>
          {config.label}
        </span>
      )}
    </div>
  );
};

interface RealTimeBadgeProps {
  isActive: boolean;
  latency?: number;
}

export const RealTimeBadge: React.FC<RealTimeBadgeProps> = ({ isActive, latency }) => {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2.5 rounded-full border px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.16em] backdrop-blur-xl transition-all duration-300',
        isActive 
          ? 'bg-oguri-cyan/10 border-oguri-cyan/30 text-oguri-cyan shadow-glow-oguri-cyan' 
          : 'bg-red-500/10 border-red-500/30 text-red-400 shadow-[0_0_15px_rgba(248,113,113,0.1)]'
      )}
    >
      <div className={cn('w-1.5 h-1.5 rounded-full', isActive ? 'bg-oguri-cyan animate-pulse' : 'bg-red-500')} />
      <span>{isActive ? 'Aura Sync' : 'Sin Vínculo'}</span>
      {latency !== undefined && latency > 0 && (
        <span className="opacity-50 ml-1 font-mono">{latency}ms</span>
      )}
    </div>
  );
};

interface BotStatusCardProps {
  isConnected: boolean;
  isConnecting: boolean;
  phone?: string;
  uptime?: string;
}

export const BotStatusCard: React.FC<BotStatusCardProps> = ({
  isConnected,
  isConnecting,
  phone,
  uptime,
}) => {
  const status = isConnecting ? 'connecting' : isConnected ? 'online' : 'offline';

  return (
    <div className="panel-surface relative overflow-hidden rounded-[28px] p-5 sm:p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Aura del Bot</h3>
        <StatusIndicator status={status} />
      </div>

      <div className="space-y-3">
        <div className="panel-data-row">
          <span className="panel-data-row__label">Número</span>
          <span className="panel-data-row__value font-mono text-xs font-bold">
            {phone || 'No vinculado'}
          </span>
        </div>
        {uptime && (
          <div className="panel-data-row">
            <span className="panel-data-row__label">Tiempo Activo</span>
            <span className="text-oguri-cyan font-bold text-xs">{uptime}</span>
          </div>
        )}
      </div>
    </div>
  );
};
