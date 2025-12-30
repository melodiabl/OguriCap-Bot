'use client';

import React, { useState } from 'react';
import { RefreshCw, Clock } from 'lucide-react';
import { motion } from 'framer-motion';

interface AutoRefreshIndicatorProps {
  interval: number; // in milliseconds
  onRefresh?: () => void;
  isActive?: boolean;
}

export const AutoRefreshIndicator: React.FC<AutoRefreshIndicatorProps> = ({
  interval,
  onRefresh,
  isActive = true
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    if (!onRefresh || isRefreshing) return;
    setIsRefreshing(true);
    try {
      await Promise.resolve(onRefresh());
    } finally {
      setTimeout(() => setIsRefreshing(false), 600);
    }
  };

  if (!isActive) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  return (
    <button
      type="button"
      onClick={handleRefresh}
      disabled={!onRefresh || isRefreshing}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs disabled:opacity-60"
      title={onRefresh ? 'Actualizar' : 'Tiempo real por Socket.IO'}
    >
      <motion.div
        animate={isRefreshing ? { rotate: 360 } : {}}
        transition={{ duration: 1, ease: "linear" }}
      >
        <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'text-primary-400' : 'text-gray-400'}`} />
      </motion.div>
      <Clock className="w-3 h-3 text-gray-400" />
      <span className="text-gray-400 font-mono">
        {isRefreshing ? 'Actualizando...' : onRefresh ? 'Actualizar' : formatTime(Math.round(interval / 1000))}
      </span>
    </button>
  );
};

export default AutoRefreshIndicator;
