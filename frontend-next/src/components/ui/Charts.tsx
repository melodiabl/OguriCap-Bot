'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

/* =========================
   HELPERS
========================= */

type ChartTone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'violet';

function toneFromColor(color?: string): ChartTone {
  if (!color) return 'brand';
  const c = color.toLowerCase();
  if (c.includes('success') || c.includes('emerald')) return 'success';
  if (c.includes('warning') || c.includes('amber')) return 'warning';
  if (c.includes('danger') || c.includes('error') || c.includes('red')) return 'danger';
  if (c.includes('info') || c.includes('cyan')) return 'info';
  if (c.includes('violet') || c.includes('purple')) return 'violet';
  return 'brand';
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/* =========================
   PROGRESS RING (COMPAT)
========================= */

type ProgressRingBaseProps = {
  size?: number;
  strokeWidth?: number;
  label?: string;
  color?: string;
  className?: string;
};

type ProgressRingProps =
  | (ProgressRingBaseProps & { progress: number })
  | (ProgressRingBaseProps & { value: number; total: number });

export const ProgressRing: React.FC<ProgressRingProps> = (props) => {
  const reduceMotion = useReducedMotion();

  const ratio =
    'progress' in props
      ? clamp01(props.progress / 100)
      : clamp01(props.value / (props.total > 0 ? props.total : 1));
  const percent = Math.round(ratio * 100);

  const size = props.size ?? 120;
  const strokeWidth = props.strokeWidth ?? 8;
  const label = props.label;
  const stroke = props.color ?? 'rgb(var(--primary))';

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const dashOffset = circumference * (1 - ratio);

  return (
    <div className={cn("relative grid place-items-center", props.className)}>
      <svg width={size} height={size} className="-rotate-90">
        {/* background */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(var(--border) / 0.18)"
          strokeWidth={strokeWidth}
        />
        {/* progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: dashOffset }}
          transition={reduceMotion ? { duration: 0 } : { duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          style={{ transformOrigin: '50% 50%' }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold text-white">{percent}%</span>
        {label && <span className="text-xs text-gray-400 mt-1">{label}</span>}
      </div>
    </div>
  );
};

/* =========================
   DONUT CHART (SAFE)
========================= */

interface DonutChartProps {
  data: { label: string; value: number; color?: string }[];
  size?: number;
  strokeWidth?: number;
  centerValue?: React.ReactNode;
  centerLabel?: React.ReactNode;
  className?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  size = 140,
  strokeWidth = 14,
  centerValue,
  centerLabel,
  className,
}) => {
  const reduceMotion = useReducedMotion();

  const total = data.reduce((sum, item) => sum + Math.max(0, item.value || 0), 0) || 1;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  let offset = 0;

  return (
    <div className={cn("relative grid place-items-center", className)}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(var(--border) / 0.18)"
          strokeWidth={strokeWidth}
        />

        {data.map((item, i) => {
          const value = Math.max(0, item.value || 0);
          const segmentLength = (value / total) * circumference;
          const dashArray = `${segmentLength} ${circumference - segmentLength}`;
          const dashOffset = -offset;

          offset += segmentLength;

          return (
            <motion.circle
              key={`${item.label}-${i}`}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={item.color ?? 'rgb(var(--primary))'}
              strokeWidth={strokeWidth}
              strokeLinecap="butt"
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.4, delay: i * 0.05 }}
            />
          );
        })}
      </svg>

      {(centerValue || centerLabel) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
          {centerValue && <div className="text-2xl font-bold text-white leading-none">{centerValue}</div>}
          {centerLabel && <div className="text-xs text-gray-400 mt-1">{centerLabel}</div>}
        </div>
      )}
    </div>
  );
};

/* =========================
   BAR CHART (FIXED)
========================= */

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  height?: number;
  animated?: boolean;
  scale?: 'linear' | 'sqrt' | 'log';
  minBarHeight?: number;
  className?: string;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  height = 200,
  animated = true,
  scale = 'linear',
  minBarHeight = 0,
  className,
}) => {
  const reduceMotion = useReducedMotion();

  const maxValue = Math.max(...data.map(d => d.value), 1);

  const scaleFn = (v: number) => {
    const safe = Math.max(0, v);
    switch (scale) {
      case 'sqrt':
        return Math.sqrt(safe);
      case 'log':
        return Math.log1p(safe);
      case 'linear':
      default:
        return safe;
    }
  };

  const scaledMax = Math.max(scaleFn(maxValue), 1);
  const minScale = minBarHeight > 0 ? minBarHeight / height : 0;
  const shouldAnimate = animated && !reduceMotion;

  return (
    <div className={cn("chart-frame", className)}>
      <div
        className="relative flex items-end gap-1"
        style={{ height }}
      >
        {data.map((item, i) => {
          const ratio = clamp01(scaleFn(item.value) / scaledMax);
          const visibleRatio = item.value > 0 ? Math.max(ratio, minScale) : 0;
          const tone = toneFromColor(item.color);

          return (
            <div key={i} className="flex-1 flex flex-col items-center self-stretch">
              <div className="w-full flex-1 flex items-end">
                {shouldAnimate ? (
                  <motion.div
                    className={cn("bar h-full", `bar--${tone}`)}
                    style={item.color ? { background: item.color } : undefined}
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: visibleRatio }}
                    transition={{ duration: 0.8, delay: i * 0.05, ease: 'easeOut' }}
                  />
                ) : (
                  <div
                    className={cn("bar h-full", `bar--${tone}`)}
                    style={{
                      ...(item.color ? { background: item.color } : null),
                      transform: `scaleY(${visibleRatio})`,
                    }}
                  />
                )}
              </div>
              <span className="mt-2 text-xs text-gray-500 truncate">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* =========================
   SPARKLINE (SAFE)
========================= */

interface SparklineProps {
  data: number[];
  color?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  color = 'rgb(var(--primary))',
}) => {
  if (!data.length) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * 80;
      const y = 24 - ((v - min) / range) * 24;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={80} height={24}>
      <motion.polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />
    </svg>
  );
};
