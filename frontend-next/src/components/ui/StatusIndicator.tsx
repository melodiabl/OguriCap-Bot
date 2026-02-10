'use client';

import React from 'react';
import { motion } from 'framer-motion';
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
  online: { dot: 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]', label: 'Conectado', text: 'text-emerald-400' },
  offline: { dot: 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]', label: 'Desconectado', text: 'text-red-400' },
  connecting: { dot: 'bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]', label: 'Conectando...', text: 'text-amber-400' },
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  size = 'md',
  showLabel = true,
}) => {
  const config = statusConfigs[status];
  
  return (
    <div className="flex items-center gap-2.5">
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
        'flex items-center gap-2.5 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-[0.15em] border backdrop-blur-md transition-all duration-500',
        isActive 
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.1)]' 
          : 'bg-red-500/10 border-red-500/30 text-red-400 shadow-[0_0_15px_rgba(248,113,113,0.1)]'
      )}
    >
      <div className={cn('w-1.5 h-1.5 rounded-full', isActive ? 'bg-emerald-400 animate-pulse' : 'bg-red-500')} />
      <span>{isActive ? 'LIVE SYNC' : 'OFFLINE'}</span>
      {latency !== undefined && latency > 0 && (
        <span className="opacity-50 ml-1">{latency}ms</span>
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
    <div className="relative overflow-hidden rounded-2xl border border-white/10 p-6 group" style={{ backgroundColor: 'rgb(var(--bg-0) / 0.80)' }}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-black text-white uppercase tracking-widest">Estado del Bot</h3>
        <StatusIndicator status={status} />
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center p-3.5 rounded-xl bg-white/5 border border-white/5 group-hover:border-white/10 transition-colors">
          <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Número</span>
          <span className="text-white font-mono text-xs font-bold">
            {phone || 'No conectado'}
          </span>
        </div>
        {uptime && (
          <div className="flex justify-between items-center p-3.5 rounded-xl bg-emerald-500/5 border border-emerald-500/10 group-hover:border-emerald-500/20 transition-colors">
            <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Uptime</span>
            <span className="text-emerald-400 font-bold text-xs">{uptime}</span>
          </div>
        )}
      </div>
    </div>
  );
};
