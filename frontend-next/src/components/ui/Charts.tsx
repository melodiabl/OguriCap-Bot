'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
import { cn } from '@/lib/utils';

type ChartTone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'violet';

function toneFromColor(color?: string): ChartTone {
  if (!color) return 'brand';
  const c = color.toLowerCase();
  if (c.includes('--success') || c.includes('success')) return 'success';
  if (c.includes('--warning') || c.includes('warning')) return 'warning';
  if (c.includes('--danger') || c.includes('danger') || c.includes('error')) return 'danger';
  if (c.includes('--accent') || c.includes('info') || c.includes('cyan')) return 'info';
  if (c.includes('--secondary') || c.includes('violet') || c.includes('purple')) return 'violet';
  if (c.includes('--primary') || c.includes('brand') || c.includes('primary') || c.includes('indigo')) return 'brand';
  if (c.includes('10b981') || c.includes('16b981') || c.includes('emerald') || c === '#10b981') return 'success';
  if (c.includes('f59e0b') || c.includes('amber') || c === '#f59e0b') return 'warning';
  if (c.includes('ef4444') || c.includes('f43f5e') || c.includes('red') || c.includes('rose')) return 'danger';
  if (c.includes('06b6d4') || c.includes('22d3ee') || c.includes('cyan')) return 'info';
  if (c.includes('8b5cf6') || c.includes('a78bfa') || c.includes('violet') || c.includes('purple')) return 'violet';
  if (c.includes('6366f1') || c.includes('818cf8') || c.includes('primary') || c.includes('indigo')) return 'brand';
  return 'brand';
}

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
  color = 'rgb(var(--primary))',
  label,
}) => {
  const reduceMotion = useReducedMotion();
  const inferred = toneFromColor(color);
  const tone: 'brand' | 'success' | 'warning' | 'danger' =
    inferred === 'success' || inferred === 'warning' || inferred === 'danger' ? inferred : 'brand';
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;
  const gradientId = `ring-${tone}`;

  return (
    <div className={cn('relative progress-ring grid place-items-center flex-none', `progress-ring--${tone}`)}>
      <div aria-hidden="true" className="progress-ring__glow" />

      <svg
        width={size}
        height={size}
        className="relative block transform -rotate-90"
      >
        <defs>
          <linearGradient id="ring-brand" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(var(--primary))" stopOpacity="1" />
            <stop offset="55%" stopColor="rgb(var(--secondary))" stopOpacity="0.95" />
            <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity="0.95" />
          </linearGradient>
          <linearGradient id="ring-success" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(var(--success))" stopOpacity="1" />
            <stop offset="60%" stopColor="rgb(var(--accent))" stopOpacity="0.95" />
            <stop offset="100%" stopColor="rgb(var(--primary))" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="ring-warning" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(var(--warning))" stopOpacity="1" />
            <stop offset="55%" stopColor="rgb(var(--danger))" stopOpacity="0.9" />
            <stop offset="100%" stopColor="rgb(var(--secondary))" stopOpacity="0.85" />
          </linearGradient>
          <linearGradient id="ring-danger" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(var(--danger))" stopOpacity="1" />
            <stop offset="55%" stopColor="rgb(var(--warning))" stopOpacity="0.95" />
            <stop offset="100%" stopColor="rgb(var(--primary))" stopOpacity="0.85" />
          </linearGradient>
        </defs>

        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(var(--border) / 0.18)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={reduceMotion ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={reduceMotion ? { duration: 0 } : { duration: 1.65, ease: [0.16, 1, 0.3, 1] }}
          className="progress-ring__arc"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.6, delay: 0.35, ease: 'easeOut' }}
          className="text-2xl font-extrabold text-white tracking-tight"
        >
          {progress}%
        </motion.span>
        {label && (
          <motion.span
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.5, delay: 0.55, ease: 'easeOut' }}
            className="mt-1 text-[11px] font-bold tracking-[0.22em] uppercase text-gray-400"
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
  scale?: 'linear' | 'sqrt' | 'log';
  minBarHeight?: number;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  height = 200,
  animated = true,
  scale = 'linear',
  minBarHeight = 4,
}) => {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  const didMountRef = React.useRef(false);
  const reduceMotion = useReducedMotion();
  const shouldAnimate = animated && !reduceMotion;
  const heightClass = height === 160 ? 'h-40' : height === 200 ? 'h-[200px]' : 'h-[200px]';

  React.useEffect(() => {
    didMountRef.current = true;
  }, []);

  return (
    <div className="chart-frame">
      <div className={cn('relative flex items-end gap-1', heightClass)}>
        {data.map((item, index) => {
        const rawRatio = maxValue > 0 ? item.value / maxValue : 0;
        const ratio = Math.max(0, Math.min(1, rawRatio));
        const scaled =
          scale === 'sqrt'
            ? Math.sqrt(ratio)
            : scale === 'log'
              ? Math.log(item.value + 1) / Math.log(maxValue + 1)
              : ratio;
        const minScale = height > 0 ? Math.min(1, Math.max(0, minBarHeight / height)) : 0;
        const targetScaleY = item.value > 0 ? Math.max(minScale, scaled) : 0;
        const delay = shouldAnimate && !didMountRef.current ? index * 0.05 : 0;
        const transition = shouldAnimate
          ? didMountRef.current
            ? { type: 'spring' as const, stiffness: 260, damping: 30, mass: 0.9 }
            : { type: 'spring' as const, stiffness: 220, damping: 26, mass: 0.9, delay }
          : { duration: 0 };
        const tone = toneFromColor(item.color);

        return (
          <div key={index} className="flex-1 h-full flex flex-col items-center">
            <div className="w-full flex-1 flex items-end group">
              <motion.div
                initial={shouldAnimate ? { scaleY: 0, opacity: 0 } : false}
                animate={{ scaleY: targetScaleY, opacity: 1 }}
                transition={transition}
                whileHover={!reduceMotion ? { scaleX: 1.04 } : undefined}
                className={cn('bar', `bar--${tone}`, 'group-hover:brightness-110 group-hover:shadow-glow-lg')}
              >
                {/* Tooltip on hover */}
                <div className="tooltip -top-11 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  {reduceMotion ? item.value : <AnimatedNumber value={item.value} duration={0.4} />}
                </div>
              </motion.div>
            </div>
            <motion.span 
              initial={shouldAnimate ? { opacity: 0, y: 10 } : false}
              animate={shouldAnimate ? { opacity: 1, y: 0 } : { opacity: 1, y: 0 }}
              transition={shouldAnimate ? { duration: 0.35, delay: index * 0.05 + 0.25, ease: 'easeOut' } : { duration: 0 }}
              className="text-xs text-gray-500 mt-2 truncate w-full text-center"
            >
              {item.label}
            </motion.span>
          </div>
        );
        })}
      </div>
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
    <div className="relative inline-grid place-items-center">
      <svg width={size} height={size} className="transform -rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(var(--border) / 0.14)"
          strokeWidth={strokeWidth}
        />
        
        {/* Data segments */}
        {data.map((item, index) => {
          const percentage = total > 0 ? (item.value / total) * 100 : 0;
          const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
          const strokeDashoffset = -((accumulatedPercentage / 100) * circumference);
          const tone = toneFromColor(item.color);
          const stroke =
            tone === 'success'
              ? 'rgb(var(--success))'
              : tone === 'warning'
                ? 'rgb(var(--warning))'
                : tone === 'danger'
                  ? 'rgb(var(--danger))'
                  : tone === 'info'
                    ? 'rgb(var(--accent))'
                    : tone === 'violet'
                      ? 'rgb(var(--secondary))'
                      : 'rgb(var(--primary))';
          
          accumulatedPercentage += percentage;

          return (
            <motion.circle
              key={index}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDashoffset={strokeDashoffset}
              initial={animated ? { strokeDasharray: `0 ${circumference}` } : undefined}
              animate={animated ? { strokeDasharray } : undefined}
              transition={animated ? { duration: 1.5, delay: index * 0.2, ease: 'easeOut' } : undefined}
              className="chart-shadow-soft"
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
  color = 'rgb(var(--primary))',
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
        className="chart-shadow-soft"
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
  color = 'rgb(var(--primary))',
  height = 200,
  animated = true,
}) => {
  const gradientId = React.useId();
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
    <div className="relative inline-block">
      <svg width={width} height={height} className="overflow-visible">
        {/* Grid lines */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgb(var(--border) / 0.12)" strokeWidth="1"/>
          </pattern>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width={width} height={height} fill="url(#grid)" />
        
        {/* Area under curve */}
        <motion.path
          d={`${pathData} L ${width},${height} L 0,${height} Z`}
          fill={`url(#${gradientId})`}
          initial={animated ? { opacity: 0 } : undefined}
          animate={animated ? { opacity: 0.2 } : undefined}
          transition={animated ? { duration: 1, delay: 0.5 } : undefined}
        />
        
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
          className="chart-shadow"
        />
        
        {/* Data points */}
        {points.map((point, index) => (
          <motion.g key={index}>
            <motion.circle
              cx={point.x}
              cy={point.y}
              r={4}
              fill={color}
              stroke="rgb(var(--bg) / 1)"
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
                fill="rgb(var(--shadow-rgb) / 0.82)"
              />
              <text
                x={point.x}
                y={point.y - 20}
                textAnchor="middle"
                fill="rgb(var(--text-on-accent) / 1)"
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

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({ value, duration = 0.55, className = "" }) => {
  return <AnimatedNumber value={value} duration={duration} className={className} />;
};
