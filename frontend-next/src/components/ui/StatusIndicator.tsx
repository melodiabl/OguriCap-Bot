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
  sm: 'w-2 h-2',
  md: '',
  lg: 'w-4 h-4',
};

const statusClasses = {
  online: 'status-online',
  offline: 'status-offline',
  connecting: 'status-connecting',
};

const statusLabels = {
  online: 'Conectado',
  offline: 'Desconectado',
  connecting: 'Conectando...',
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  size = 'md',
  showLabel = true,
}) => {
  return (
    <div className="flex items-center gap-2">
      <motion.div
        animate={status === 'online' || status === 'connecting' ? { scale: [1, 1.2, 1] } : {}}
        transition={{ repeat: Infinity, duration: 2 }}
        className={cn(
          'status-dot',
          sizeClasses[size],
          statusClasses[status]
        )}
      />
      {showLabel && (
        <span className={cn(
          'text-sm font-medium',
          status === 'online' && 'text-emerald-400',
          status === 'offline' && 'text-red-400',
          status === 'connecting' && 'text-amber-400'
        )}>
          {statusLabels[status]}
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
        'flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border',
        isActive ? 'realtime-indicator text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'
      )}
    >
      <div className={cn('w-2 h-2 rounded-full', isActive ? 'realtime-dot' : 'bg-red-500')} />
      <span>{isActive ? 'En vivo' : 'Offline'}</span>
      {latency !== undefined && latency > 0 && (
        <span className="text-gray-500">{latency}ms</span>
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
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Estado del Bot</h3>
        <StatusIndicator status={status} />
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center p-3 rounded-xl bg-white/5">
          <span className="text-gray-400 text-sm">Número</span>
          <span className="text-white font-mono text-sm">
            {phone || 'No conectado'}
          </span>
        </div>
        {uptime && (
          <div className="flex justify-between items-center p-3 rounded-xl bg-white/5">
            <span className="text-gray-400 text-sm">Uptime</span>
            <span className="text-emerald-400 font-medium text-sm">{uptime}</span>
          </div>
        )}
      </div>
    </div>
  );
};
