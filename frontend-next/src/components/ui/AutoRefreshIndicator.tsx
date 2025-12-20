'use client';

import React, { useState, useEffect } from 'react';
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
  const [timeLeft, setTimeLeft] = useState(interval / 1000);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          setIsRefreshing(true);
          onRefresh?.();
          setTimeout(() => setIsRefreshing(false), 1000);
          return interval / 1000;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [interval, onRefresh, isActive]);

  if (!isActive) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}s`;
  };

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs">
      <motion.div
        animate={isRefreshing ? { rotate: 360 } : {}}
        transition={{ duration: 1, ease: "linear" }}
      >
        <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'text-primary-400' : 'text-gray-400'}`} />
      </motion.div>
      <Clock className="w-3 h-3 text-gray-400" />
      <span className="text-gray-400 font-mono">
        {isRefreshing ? 'Actualizando...' : formatTime(timeLeft)}
      </span>
    </div>
  );
};

export default AutoRefreshIndicator;