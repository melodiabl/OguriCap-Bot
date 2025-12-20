import React from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, Loader2, Signal, SignalHigh, SignalLow, SignalMedium } from 'lucide-react';

interface StatusIndicatorProps {
  status: 'online' | 'offline' | 'connecting' | 'error';
  label?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

const statusConfig = {
  online: {
    color: 'bg-emerald-500',
    glow: 'shadow-glow-emerald',
    text: 'text-emerald-400',
    label: 'Conectado',
    icon: Wifi,
  },
  offline: {
    color: 'bg-red-500',
    glow: '',
    text: 'text-red-400',
    label: 'Desconectado',
    icon: WifiOff,
  },
  connecting: {
    color: 'bg-amber-500',
    glow: 'shadow-[0_0_15px_rgba(245,158,11,0.5)]',
    text: 'text-amber-400',
    label: 'Conectando...',
    icon: Loader2,
  },
  error: {
    color: 'bg-red-500',
    glow: '',
    text: 'text-red-400',
    label: 'Error',
    icon: WifiOff,
  },
};

const sizeConfig = {
  sm: { dot: 'w-2 h-2', text: 'text-xs', icon: 14 },
  md: { dot: 'w-3 h-3', text: 'text-sm', icon: 18 },
  lg: { dot: 'w-4 h-4', text: 'text-base', icon: 22 },
};

export const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  label,
  showLabel = true,
  size = 'md',
  pulse = true,
}) => {
  const config = statusConfig[status];
  const sizes = sizeConfig[size];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        className={`
          ${sizes.dot} rounded-full ${config.color} ${config.glow}
          ${pulse && status !== 'offline' ? 'animate-pulse' : ''}
        `}
      />
      {showLabel && (
        <span className={`${sizes.text} font-medium ${config.text}`}>
          {label || config.label}
        </span>
      )}
    </div>
  );
};

// ===== Real-Time Badge =====
interface RealTimeBadgeProps {
  isActive?: boolean;
  latency?: number | null;
}

export const RealTimeBadge: React.FC<RealTimeBadgeProps> = ({ isActive = true, latency }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className={`
        flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium
        ${isActive 
          ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
          : 'bg-gray-500/10 border border-gray-500/30 text-gray-400'
        }
      `}
    >
      <motion.div
        animate={isActive ? { scale: [1, 1.2, 1] } : {}}
        transition={{ repeat: Infinity, duration: 2 }}
        className={`w-2 h-2 rounded-full ${isActive ? 'bg-emerald-500' : 'bg-gray-500'}`}
      />
      <span>Tiempo Real</span>
      {latency !== null && latency !== undefined && (
        <span className="text-gray-500">({latency}ms)</span>
      )}
    </motion.div>
  );
};

// ===== Connection Quality Indicator =====
interface ConnectionQualityProps {
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'unknown';
  showLabel?: boolean;
}

const qualityConfig = {
  excellent: { icon: SignalHigh, color: 'text-emerald-400', label: 'Excelente', bars: 4 },
  good: { icon: SignalMedium, color: 'text-green-400', label: 'Buena', bars: 3 },
  fair: { icon: SignalLow, color: 'text-amber-400', label: 'Regular', bars: 2 },
  poor: { icon: Signal, color: 'text-red-400', label: 'Mala', bars: 1 },
  unknown: { icon: Signal, color: 'text-gray-400', label: 'Desconocida', bars: 0 },
};

export const ConnectionQuality: React.FC<ConnectionQualityProps> = ({ quality, showLabel = true }) => {
  const config = qualityConfig[quality];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-2">
      <Icon className={`w-5 h-5 ${config.color}`} />
      {showLabel && (
        <span className={`text-sm font-medium ${config.color}`}>{config.label}</span>
      )}
    </div>
  );
};

// ===== Bot Status Card =====
interface BotStatusCardProps {
  isConnected: boolean;
  isConnecting: boolean;
  phone?: string | null;
  uptime?: string;
  lastSeen?: string | null;
}

export const BotStatusCard: React.FC<BotStatusCardProps> = ({
  isConnected,
  isConnecting,
  phone,
  uptime,
  lastSeen,
}) => {
  const status = isConnecting ? 'connecting' : isConnected ? 'online' : 'offline';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card p-6"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Estado del Bot</h3>
        <StatusIndicator status={status} size="lg" />
      </div>

      <div className="space-y-3">
        {phone && (
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Número</span>
            <span className="text-white font-mono text-sm">{phone}</span>
          </div>
        )}
        {uptime && (
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Uptime</span>
            <span className="text-emerald-400 font-medium text-sm">{uptime}</span>
          </div>
        )}
        {lastSeen && (
          <div className="flex justify-between items-center">
            <span className="text-gray-400 text-sm">Última actividad</span>
            <span className="text-gray-300 text-sm">{new Date(lastSeen).toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      {/* Animated connection line */}
      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-white/10 rounded-full overflow-hidden">
            {isConnected && (
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ duration: 1, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500"
              />
            )}
            {isConnecting && (
              <motion.div
                animate={{ x: ['-100%', '100%'] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                className="h-full w-1/3 bg-gradient-to-r from-transparent via-amber-500 to-transparent"
              />
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default StatusIndicator;
