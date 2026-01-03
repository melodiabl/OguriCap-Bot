'use client';

import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';
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
   PROGRESS RING (FIXED)
========================= */

interface ProgressRingProps {
  value: number;
  total: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  value,
  total,
  size = 120,
  strokeWidth = 8,
  label,
}) => {
  const reduceMotion = useReducedMotion();

  const safeTotal = total > 0 ? total : 1;
  const ratio = clamp01(value / safeTotal);
  const percent = Math.round(ratio * 100);

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const dashOffset = circumference * (1 - ratio);

  return (
    <div className="relative grid place-items-center">
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
          stroke="rgb(var(--primary))"
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
   BAR CHART (FIXED)
========================= */

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  height?: number;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  height = 200,
}) => {
  const reduceMotion = useReducedMotion();
  const maxValue = Math.max(...data.map(d => d.value), 1);

  return (
    <div className="chart-frame">
      <div
        className="relative flex items-end gap-1"
        style={{ height }}
      >
        {data.map((item, i) => {
          const ratio = clamp01(item.value / maxValue);

          return (
            <div key={i} className="flex-1 flex flex-col items-center">
              <motion.div
                className="bar w-full rounded-md"
                style={{
                  background: item.color ?? 'rgb(var(--primary))',
                }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: ratio }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { duration: 0.8, delay: i * 0.05, ease: 'easeOut' }
                }
              />
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

