import React from 'react';
import { motion } from 'framer-motion';

// ===== Progress Ring =====
interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  bgColor?: string;
  label?: string;
  showPercentage?: boolean;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size = 120,
  strokeWidth = 8,
  color = '#6366f1',
  bgColor = 'rgba(255, 255, 255, 0.1)',
  label,
  showPercentage = true,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={bgColor}
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{
            strokeDasharray: circumference,
            filter: `drop-shadow(0 0 6px ${color})`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {showPercentage && (
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }}
            className="text-2xl font-bold text-white"
          >
            {Math.round(progress)}%
          </motion.span>
        )}
        {label && (
          <span className="text-xs text-gray-400 mt-1">{label}</span>
        )}
      </div>
    </div>
  );
};

// ===== Bar Chart =====
interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  maxValue?: number;
  height?: number;
  showValues?: boolean;
  animated?: boolean;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  maxValue,
  height = 200,
  showValues = true,
  animated = true,
}) => {
  const max = maxValue || Math.max(...data.map((d) => d.value));

  const defaultColors = [
    '#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444',
  ];

  return (
    <div className="w-full" style={{ height }}>
      <div className="flex items-end justify-around h-full gap-2">
        {data.map((item, index) => {
          const percentage = (item.value / max) * 100;
          const color = item.color || defaultColors[index % defaultColors.length];

          return (
            <div key={index} className="flex flex-col items-center flex-1 h-full">
              <div className="flex-1 w-full flex items-end justify-center">
                <motion.div
                  initial={animated ? { height: 0 } : { height: `${percentage}%` }}
                  animate={{ height: `${percentage}%` }}
                  transition={{ duration: 0.8, delay: index * 0.1, ease: 'easeOut' }}
                  className="w-full max-w-[40px] rounded-t-lg relative group"
                  style={{
                    background: `linear-gradient(180deg, ${color} 0%, ${color}80 100%)`,
                    boxShadow: `0 0 20px ${color}40`,
                  }}
                >
                  {showValues && (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 + index * 0.1 }}
                      className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs font-semibold text-white"
                    >
                      {item.value}
                    </motion.span>
                  )}
                  {/* Tooltip */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-dark-800 rounded text-xs text-white opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {item.label}: {item.value}
                  </div>
                </motion.div>
              </div>
              <span className="text-xs text-gray-400 mt-2 truncate max-w-full px-1">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ===== Line Sparkline =====
interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fillOpacity?: number;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 100,
  height = 30,
  color = '#6366f1',
  fillOpacity = 0.2,
}) => {
  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  });

  const linePath = `M ${points.join(' L ')}`;
  const areaPath = `${linePath} L ${width},${height} L 0,${height} Z`;

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Gradient fill */}
      <defs>
        <linearGradient id={`sparkline-gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      
      {/* Area */}
      <motion.path
        d={areaPath}
        fill={`url(#sparkline-gradient-${color})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      />
      
      {/* Line */}
      <motion.path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1, ease: 'easeOut' }}
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
      
      {/* End dot */}
      <motion.circle
        cx={width}
        cy={height - ((data[data.length - 1] - min) / range) * height}
        r={3}
        fill={color}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1, duration: 0.3 }}
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
    </svg>
  );
};

// ===== Donut Chart =====
interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
  strokeWidth?: number;
  centerLabel?: string;
  centerValue?: string | number;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  size = 160,
  strokeWidth = 20,
  centerLabel,
  centerValue,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const total = data.reduce((sum, item) => sum + item.value, 0);

  let currentOffset = 0;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {data.map((item, index) => {
          const percentage = (item.value / total) * 100;
          const strokeDasharray = (percentage / 100) * circumference;
          const strokeDashoffset = -currentOffset;
          currentOffset += strokeDasharray;

          return (
            <motion.circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              initial={{ strokeDasharray: `0 ${circumference}` }}
              animate={{ strokeDasharray: `${strokeDasharray} ${circumference - strokeDasharray}` }}
              transition={{ duration: 1, delay: index * 0.2, ease: 'easeOut' }}
              style={{
                strokeDashoffset,
                filter: `drop-shadow(0 0 4px ${item.color})`,
              }}
            />
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {centerValue !== undefined && (
          <motion.span
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8 }}
            className="text-2xl font-bold text-white"
          >
            {centerValue}
          </motion.span>
        )}
        {centerLabel && (
          <span className="text-xs text-gray-400">{centerLabel}</span>
        )}
      </div>
    </div>
  );
};

// ===== Stats Mini Chart =====
interface MiniChartProps {
  value: number;
  previousValue?: number;
  label: string;
  sparklineData?: number[];
  color?: string;
}

export const MiniChart: React.FC<MiniChartProps> = ({
  value,
  previousValue,
  label,
  sparklineData,
  color = '#6366f1',
}) => {
  const change = previousValue ? ((value - previousValue) / previousValue) * 100 : 0;
  const isPositive = change >= 0;

  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
      <div>
        <p className="text-sm text-gray-400">{label}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
        {previousValue !== undefined && (
          <p className={`text-xs mt-1 ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
            {isPositive ? '↑' : '↓'} {Math.abs(change).toFixed(1)}%
          </p>
        )}
      </div>
      {sparklineData && (
        <Sparkline data={sparklineData} color={color} width={80} height={40} />
      )}
    </div>
  );
};

export default ProgressRing;
