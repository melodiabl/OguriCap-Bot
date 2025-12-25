'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface ProgressRingProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size = 120,
  strokeWidth = 8,
  color = '#6366f1',
  label,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
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
          transition={{ duration: 1.5, ease: 'easeOut' }}
          style={{ 
            strokeDasharray: circumference,
            filter: 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.5))'
          }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span 
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="text-2xl font-bold text-white"
        >
          {progress}%
        </motion.span>
        {label && (
          <motion.span 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="text-xs text-gray-400"
          >
            {label}
          </motion.span>
        )}
      </div>
    </div>
  );
};

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  animated?: boolean;
}

export const BarChart: React.FC<BarChartProps> = ({ data, height = 200, animated = true }) => {
  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((item, index) => (
        <div key={index} className="flex-1 flex flex-col items-center group">
          <motion.div
            initial={animated ? { height: 0, opacity: 0 } : undefined}
            animate={animated ? { height: `${(item.value / maxValue) * 100}%`, opacity: 1 } : undefined}
            transition={animated ? { duration: 0.8, delay: index * 0.1, ease: "easeOut" } : undefined}
            whileHover={{ scale: 1.05, filter: "brightness(1.2)" }}
            className="w-full rounded-t-lg transition-all duration-200 cursor-pointer relative"
            style={{ backgroundColor: item.color || '#6366f1', minHeight: 4 }}
          >
            {/* Tooltip on hover */}
            <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
              {item.value}
            </div>
          </motion.div>
          <motion.span 
            initial={animated ? { opacity: 0, y: 10 } : undefined}
            animate={animated ? { opacity: 1, y: 0 } : undefined}
            transition={animated ? { duration: 0.4, delay: index * 0.1 + 0.5 } : undefined}
            className="text-xs text-gray-500 mt-2 truncate w-full text-center"
          >
            {item.label}
          </motion.span>
        </div>
      ))}
    </div>
  );
};

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
  centerValue?: string;
  centerLabel?: string;
  animated?: boolean;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  size = 140,
  centerValue,
  centerLabel,
  animated = true,
}) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  let accumulatedPercentage = 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={strokeWidth}
        />
        
        {/* Data segments */}
        {data.map((item, index) => {
          const percentage = total > 0 ? (item.value / total) * 100 : 0;
          const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
          const strokeDashoffset = -((accumulatedPercentage / 100) * circumference);
          
          accumulatedPercentage += percentage;

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
              initial={animated ? { strokeDasharray: `0 ${circumference}` } : undefined}
              animate={animated ? { strokeDasharray } : undefined}
              transition={animated ? { duration: 1.5, delay: index * 0.2, ease: 'easeOut' } : undefined}
              style={{
                strokeDashoffset,
                filter: `drop-shadow(0 0 6px ${item.color}40)`
              }}
            />
          );
        })}
      </svg>
      
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {centerValue && (
          <motion.span 
            initial={animated ? { opacity: 0, scale: 0.5 } : undefined}
            animate={animated ? { opacity: 1, scale: 1 } : undefined}
            transition={animated ? { duration: 0.5, delay: 0.5 } : undefined}
            className="text-xl font-bold text-white"
          >
            {centerValue}
          </motion.span>
        )}
        {centerLabel && (
          <motion.span 
            initial={animated ? { opacity: 0 } : undefined}
            animate={animated ? { opacity: 1 } : undefined}
            transition={animated ? { duration: 0.5, delay: 0.7 } : undefined}
            className="text-xs text-gray-400"
          >
            {centerLabel}
          </motion.span>
        )}
      </div>
    </div>
  );
};

interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  animated?: boolean;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  color = '#6366f1',
  width = 80,
  height = 24,
  animated = true,
}) => {
  if (!data.length) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      <motion.polyline
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        initial={animated ? { pathLength: 0, opacity: 0 } : undefined}
        animate={animated ? { pathLength: 1, opacity: 1 } : undefined}
        transition={animated ? { duration: 1.5, ease: "easeOut" } : undefined}
        style={{ filter: `drop-shadow(0 0 4px ${color}60)` }}
      />
      {/* Data points */}
      {animated && data.map((value, index) => {
        const x = (index / (data.length - 1)) * width;
        const y = height - ((value - min) / range) * height;
        return (
          <motion.circle
            key={index}
            cx={x}
            cy={y}
            r={1.5}
            fill={color}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.3, delay: index * 0.1 + 0.5 }}
          />
        );
      })}
    </svg>
  );
};

interface LineChartProps {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  animated?: boolean;
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  color = '#6366f1',
  height = 200,
  animated = true,
}) => {
  if (!data.length) return null;

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const minValue = Math.min(...data.map(d => d.value), 0);
  const range = maxValue - minValue || 1;
  const width = 300;

  const points = data.map((item, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((item.value - minValue) / range) * height;
    return { x, y, value: item.value, label: item.label };
  });

  const pathData = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;

  return (
    <div className="relative" style={{ width, height }}>
      <svg width={width} height={height} className="overflow-visible">
        {/* Grid lines */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width={width} height={height} fill="url(#grid)" />
        
        {/* Area under curve */}
        <motion.path
          d={`${pathData} L ${width},${height} L 0,${height} Z`}
          fill={`url(#gradient-${color.replace('#', '')})`}
          initial={animated ? { opacity: 0 } : undefined}
          animate={animated ? { opacity: 0.2 } : undefined}
          transition={animated ? { duration: 1, delay: 0.5 } : undefined}
        />
        
        {/* Gradient definition */}
        <defs>
          <linearGradient id={`gradient-${color.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Line */}
        <motion.path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={animated ? { pathLength: 0 } : undefined}
          animate={animated ? { pathLength: 1 } : undefined}
          transition={animated ? { duration: 2, ease: "easeOut" } : undefined}
          style={{ filter: `drop-shadow(0 0 8px ${color}60)` }}
        />
        
        {/* Data points */}
        {points.map((point, index) => (
          <motion.g key={index}>
            <motion.circle
              cx={point.x}
              cy={point.y}
              r={4}
              fill={color}
              stroke="white"
              strokeWidth={2}
              initial={animated ? { scale: 0, opacity: 0 } : undefined}
              animate={animated ? { scale: 1, opacity: 1 } : undefined}
              transition={animated ? { duration: 0.3, delay: index * 0.1 + 1 } : undefined}
              whileHover={{ scale: 1.5 }}
              className="cursor-pointer"
            />
            {/* Tooltip */}
            <motion.g
              initial={{ opacity: 0 }}
              whileHover={{ opacity: 1 }}
              className="pointer-events-none"
            >
              <rect
                x={point.x - 25}
                y={point.y - 35}
                width={50}
                height={25}
                rx={4}
                fill="rgba(0,0,0,0.8)"
              />
              <text
                x={point.x}
                y={point.y - 20}
                textAnchor="middle"
                fill="white"
                fontSize={12}
              >
                {point.value}
              </text>
            </motion.g>
          </motion.g>
        ))}
      </svg>
    </div>
  );
};

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
  value,
  duration = 1,
  className = "",
}) => {
  const [displayValue, setDisplayValue] = React.useState(0);

  React.useEffect(() => {
    let startTime: number;
    let animationFrame: number;

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / (duration * 1000), 1);
      
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      setDisplayValue(Math.floor(easeOutQuart * value));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(animate);
      }
    };

    animationFrame = requestAnimationFrame(animate);

    return () => {
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
      }
    };
  }, [value, duration]);

  return <span className={className}>{displayValue.toLocaleString()}</span>;
};