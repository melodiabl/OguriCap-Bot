'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Zap, Clock, TrendingUp } from 'lucide-react';

interface PerformanceIndicatorProps {
  metrics?: {
    tiempoRespuesta: number;
    disponibilidad: number;
    errorRate: number;
    throughput: number;
  };
  className?: string;
}

export const PerformanceIndicator: React.FC<PerformanceIndicatorProps> = ({
  metrics = {
    tiempoRespuesta: 120,
    disponibilidad: 99.5,
    errorRate: 0.1,
    throughput: 25
  },
  className = ""
}) => {
  const getStatusColor = (value: number, thresholds: { good: number; warning: number }) => {
    if (value <= thresholds.good) return 'text-emerald-400';
    if (value <= thresholds.warning) return 'text-amber-400';
    return 'text-red-400';
  };

  const getAvailabilityColor = (value: number) => {
    if (value >= 99) return 'text-emerald-400';
    if (value >= 95) return 'text-amber-400';
    return 'text-red-400';
  };

  return (
    <motion.div
      className={`grid grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Response Time */}
      <motion.div
        className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 hover:bg-gray-800/70 transition-colors"
        whileHover={{ scale: 1.02, y: -2 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-center justify-between mb-2">
          <Clock className="w-5 h-5 text-gray-400" />
          <motion.span
            className={`text-sm font-medium ${getStatusColor(metrics.tiempoRespuesta, { good: 100, warning: 300 })}`}
            animate={{ 
              textShadow: metrics.tiempoRespuesta <= 100 ? [
                "0 0 5px rgba(16, 185, 129, 0.5)",
                "0 0 10px rgba(16, 185, 129, 0.8)",
                "0 0 5px rgba(16, 185, 129, 0.5)"
              ] : undefined
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {metrics.tiempoRespuesta}ms
          </motion.span>
        </div>
        <p className="text-xs text-gray-400">Tiempo Respuesta</p>
        <div className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className={`h-full ${
              metrics.tiempoRespuesta <= 100 ? 'bg-emerald-500' :
              metrics.tiempoRespuesta <= 300 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min((300 - metrics.tiempoRespuesta) / 300 * 100, 100)}%` }}
            transition={{ duration: 1, delay: 0.2 }}
          />
        </div>
      </motion.div>

      {/* Availability */}
      <motion.div
        className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 hover:bg-gray-800/70 transition-colors"
        whileHover={{ scale: 1.02, y: -2 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-center justify-between mb-2">
          <Activity className="w-5 h-5 text-gray-400" />
          <motion.span
            className={`text-sm font-medium ${getAvailabilityColor(metrics.disponibilidad)}`}
            animate={{ 
              textShadow: metrics.disponibilidad >= 99 ? [
                "0 0 5px rgba(16, 185, 129, 0.5)",
                "0 0 10px rgba(16, 185, 129, 0.8)",
                "0 0 5px rgba(16, 185, 129, 0.5)"
              ] : undefined
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {metrics.disponibilidad.toFixed(1)}%
          </motion.span>
        </div>
        <p className="text-xs text-gray-400">Disponibilidad</p>
        <div className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className={`h-full ${
              metrics.disponibilidad >= 99 ? 'bg-emerald-500' :
              metrics.disponibilidad >= 95 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${metrics.disponibilidad}%` }}
            transition={{ duration: 1, delay: 0.4 }}
          />
        </div>
      </motion.div>

      {/* Error Rate */}
      <motion.div
        className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 hover:bg-gray-800/70 transition-colors"
        whileHover={{ scale: 1.02, y: -2 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-center justify-between mb-2">
          <Zap className="w-5 h-5 text-gray-400" />
          <motion.span
            className={`text-sm font-medium ${getStatusColor(metrics.errorRate, { good: 1, warning: 5 })}`}
            animate={{ 
              textShadow: metrics.errorRate <= 1 ? [
                "0 0 5px rgba(16, 185, 129, 0.5)",
                "0 0 10px rgba(16, 185, 129, 0.8)",
                "0 0 5px rgba(16, 185, 129, 0.5)"
              ] : undefined
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {metrics.errorRate.toFixed(1)}%
          </motion.span>
        </div>
        <p className="text-xs text-gray-400">Tasa de Error</p>
        <div className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className={`h-full ${
              metrics.errorRate <= 1 ? 'bg-emerald-500' :
              metrics.errorRate <= 5 ? 'bg-amber-500' : 'bg-red-500'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(metrics.errorRate * 10, 100)}%` }}
            transition={{ duration: 1, delay: 0.6 }}
          />
        </div>
      </motion.div>

      {/* Throughput */}
      <motion.div
        className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-4 hover:bg-gray-800/70 transition-colors"
        whileHover={{ scale: 1.02, y: -2 }}
        transition={{ duration: 0.2 }}
      >
        <div className="flex items-center justify-between mb-2">
          <TrendingUp className="w-5 h-5 text-gray-400" />
          <motion.span
            className="text-sm font-medium text-cyan-400"
            animate={{ 
              textShadow: [
                "0 0 5px rgba(34, 211, 238, 0.5)",
                "0 0 10px rgba(34, 211, 238, 0.8)",
                "0 0 5px rgba(34, 211, 238, 0.5)"
              ]
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {metrics.throughput}/min
          </motion.span>
        </div>
        <p className="text-xs text-gray-400">Throughput</p>
        <div className="mt-2 h-1 bg-gray-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-cyan-500"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(metrics.throughput * 2, 100)}%` }}
            transition={{ duration: 1, delay: 0.8 }}
          />
        </div>
      </motion.div>
    </motion.div>
  );
};

export default PerformanceIndicator;