'use client';

import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';

type ChartTone = 'brand' | 'success' | 'warning' | 'danger' | 'info' | 'violet';

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function toneFromColor(color?: string): ChartTone {
  if (!color) return 'brand';
  const c = color.toLowerCase();

  if (c.includes('--success') || c.includes('success')) return 'success';
  if (c.includes('--warning') || c.includes('warning')) return 'warning';
  if (c.includes('--danger') || c.includes('danger') || c.includes('error')) return 'danger';
  if (c.includes('--accent') || c.includes('info') || c.includes('cyan')) return 'info';
  if (c.includes('--secondary') || c.includes('violet') || c.includes('purple')) return 'violet';
  if (c.includes('--primary') || c.includes('brand') || c.includes('primary') || c.includes('indigo')) return 'brand';

  // Hex fallbacks
  if (c.includes('10b981') || c.includes('16b981') || c.includes('emerald') || c === '#10b981') return 'success';
  if (c.includes('f59e0b') || c.includes('amber') || c === '#f59e0b') return 'warning';
  if (c.includes('ef4444') || c.includes('f43f5e') || c.includes('red') || c.includes('rose')) return 'danger';
  if (c.includes('06b6d4') || c.includes('22d3ee') || c.includes('cyan')) return 'info';
  if (c.includes('8b5cf6') || c.includes('a78bfa') || c.includes('violet') || c.includes('purple')) return 'violet';
  if (c.includes('6366f1') || c.includes('818cf8') || c.includes('primary') || c.includes('indigo')) return 'brand';

  return 'brand';
}

/* ----------------------------- Progress Ring ----------------------------- */

interface ProgressRingProps {
  progress: number; // 0..100
  size?: number;
  strokeWidth?: number;
  color?: string; // optional semantic color
  label?: string;
  className?: string;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size = 120,
  strokeWidth = 8,
  color,
  label,
  className,
}) => {
  const reduceMotion = useReducedMotion();
  const uid = React.useId();

  const p = clamp(Number.isFinite(progress) ? progress : 0, 0, 100);
  const inferred = toneFromColor(color);
  const tone: 'brand' | 'success' | 'warning' | 'danger' =
    inferred === 'success' || inferred === 'warning' || inferred === 'danger' ? inferred : 'brand';

  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (p / 100) * circumference;

  // ✅ IDs únicos por componente (evita que el círculo “se buguee” cuando hay varios)
  const gradBrand = `ring-brand-${uid}`;
  const gradSuccess = `ring-success-${uid}`;
  const gradWarning = `ring-warning-${uid}`;
  const gradDanger = `ring-danger-${uid}`;

  const gradientId =
    tone === 'success' ? gradSuccess : tone === 'warning' ? gradWarning : tone === 'danger' ? gradDanger : gradBrand;

  return (
    <div
      className={cn('progress-ring relative grid place-items-center flex-none', `progress-ring--${tone}`, className)}
      style={{ width: size, height: size }}
    >
      <div aria-hidden="true" className="progress-ring__glow" />

      <svg width={size} height={size} className="relative block -rotate-90 overflow-visible">
        <defs>
          <linearGradient id={gradBrand} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(var(--primary))" stopOpacity="1" />
            <stop offset="55%" stopColor="rgb(var(--secondary))" stopOpacity="0.95" />
            <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity="0.95" />
          </linearGradient>

          <linearGradient id={gradSuccess} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(var(--success))" stopOpacity="1" />
            <stop offset="60%" stopColor="rgb(var(--accent))" stopOpacity="0.95" />
            <stop offset="100%" stopColor="rgb(var(--primary))" stopOpacity="0.9" />
          </linearGradient>

          <linearGradient id={gradWarning} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(var(--warning))" stopOpacity="1" />
            <stop offset="55%" stopColor="rgb(var(--danger))" stopOpacity="0.9" />
            <stop offset="100%" stopColor="rgb(var(--secondary))" stopOpacity="0.85" />
          </linearGradient>

          <linearGradient id={gradDanger} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="rgb(var(--danger))" stopOpacity="1" />
            <stop offset="55%" stopColor="rgb(var(--warning))" stopOpacity="0.95" />
            <stop offset="100%" stopColor="rgb(var(--primary))" stopOpacity="0.85" />
          </linearGradient>
        </defs>

        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(var(--border) / 0.18)"
          strokeWidth={strokeWidth}
        />

        {/* Arc */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          className="progress-ring__arc"
          initial={reduceMotion ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={reduceMotion ? { duration: 0 } : { duration: 1.25, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
        <motion.span
          initial={reduceMotion ? false : { opacity: 0, scale: 0.92 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.45, delay: 0.2, ease: 'easeOut' }}
          className="text-2xl font-extrabold text-white tracking-tight"
        >
          {p}%
        </motion.span>

        {label ? (
          <motion.span
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.45, delay: 0.35, ease: 'easeOut' }}
            className="mt-1 text-[11px] font-bold tracking-[0.22em] uppercase text-gray-400"
          >
            {label}
          </motion.span>
        ) : null}
      </div>
    </div>
  );
};

/* ------------------------------- Bar Chart ------------------------------- */

interface BarChartProps {
  data: { label: string; value: number; color?: string }[];
  height?: number; // px
  animated?: boolean;
  scale?: 'linear' | 'sqrt' | 'log';
  minBarHeight?: number; // px
  className?: string;
}

export const BarChart: React.FC<BarChartProps> = ({
  data,
  height = 200,
  animated = true,
  scale = 'linear',
  minBarHeight = 4,
  className,
}) => {
  const reduceMotion = useReducedMotion();
  const shouldAnimate = animated && !reduceMotion;
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  // ✅ evita “saltos” raros al re-render
  const firstPaintRef = React.useRef(true);
  React.useEffect(() => {
    firstPaintRef.current = false;
  }, []);

  return (
    <div className={cn('chart-frame', className)}>
      {/* ✅ overflow-visible para tooltips */}
      <div className="relative">
        <div className="relative flex items-end gap-2 overflow-visible" style={{ height }}>
          {data.map((item, index) => {
            const rawRatio = maxValue > 0 ? item.value / maxValue : 0;
            const ratio = clamp(rawRatio, 0, 1);

            const scaled =
              scale === 'sqrt'
                ? Math.sqrt(ratio)
                : scale === 'log'
                  ? Math.log(item.value + 1) / Math.log(maxValue + 1)
                  : ratio;

            const minScale = height > 0 ? clamp(minBarHeight / height, 0, 1) : 0;
            const targetScaleY = item.value > 0 ? Math.max(minScale, scaled) : 0;

            const tone = toneFromColor(item.color);
            const delay = shouldAnimate && firstPaintRef.current ? index * 0.05 : 0;

            const transition = shouldAnimate
              ? {
                type: 'spring' as const,
                stiffness: 260,
                damping: 30,
                mass: 0.9,
                delay,
              }
              : { duration: 0 };

            return (
              <div key={`${item.label}-${index}`} className="flex-1 min-w-0 h-full flex flex-col items-center">
                <div className="w-full flex-1 flex items-end overflow-visible">
                  <motion.div
                    initial={shouldAnimate ? { scaleY: 0, opacity: 0 } : false}
                    animate={{ scaleY: targetScaleY, opacity: 1 }}
                    transition={transition}
                    whileHover={!reduceMotion ? { scaleX: 1.03 } : undefined}
                    className={cn('bar relative w-full origin-bottom', `bar--${tone}`)}
                  >
                    {/* Tooltip */}
                    <div className="tooltip -top-12 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      {reduceMotion ? item.value : <AnimatedNumber value={item.value} duration={0.35} />}
                    </div>
                  </motion.div>
                </div>

                <motion.span
                  initial={shouldAnimate ? { opacity: 0, y: 10 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={
                    shouldAnimate
                      ? { duration: 0.35, delay: (firstPaintRef.current ? index * 0.05 : 0) + 0.15, ease: 'easeOut' }
                      : { duration: 0 }
                  }
                  className="mt-2 w-full truncate text-center text-xs text-gray-500"
                  title={item.label}
                >
                  {item.label}
                </motion.span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------ Donut Chart ------------------------------ */

interface DonutChartProps {
  data: { label: string; value: number; color: string }[];
  size?: number;
  centerValue?: string;
  centerLabel?: string;
  animated?: boolean;
  className?: string;
}

export const DonutChart: React.FC<DonutChartProps> = ({
  data,
  size = 140,
  centerValue,
  centerLabel,
  animated = true,
  className,
}) => {
  const reduceMotion = useReducedMotion();
  const shouldAnimate = animated && !reduceMotion;

  const total = data.reduce((sum, item) => sum + item.value, 0);
  const strokeWidth = 20;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;

  let accumulated = 0;

  return (
    <div className={cn('relative inline-grid place-items-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 overflow-visible">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgb(var(--border) / 0.14)"
          strokeWidth={strokeWidth}
        />

        {data.map((item, idx) => {
          const pct = total > 0 ? (item.value / total) * 100 : 0;
          const dash = `${(pct / 100) * circumference} ${circumference}`;
          const dashOffset = -((accumulated / 100) * circumference);

          accumulated += pct;

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

          return (
            <motion.circle
              key={`${item.label}-${idx}`}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={stroke}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDashoffset={dashOffset}
              className="chart-shadow-soft"
              initial={shouldAnimate ? { strokeDasharray: `0 ${circumference}` } : false}
              animate={shouldAnimate ? { strokeDasharray: dash } : false}
              transition={shouldAnimate ? { duration: 1.1, delay: idx * 0.12, ease: 'easeOut' } : { duration: 0 }}
            />
          );
        })}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center select-none">
        {centerValue ? (
          <motion.span
            initial={shouldAnimate ? { opacity: 0, scale: 0.92 } : false}
            animate={{ opacity: 1, scale: 1 }}
            transition={shouldAnimate ? { duration: 0.4, delay: 0.2 } : { duration: 0 }}
            className="text-xl font-bold text-white"
          >
            {centerValue}
          </motion.span>
        ) : null}

        {centerLabel ? (
          <motion.span
            initial={shouldAnimate ? { opacity: 0, y: 6 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={shouldAnimate ? { duration: 0.4, delay: 0.32 } : { duration: 0 }}
            className="text-xs text-gray-400"
          >
            {centerLabel}
          </motion.span>
        ) : null}
      </div>
    </div>
  );
};

/* ------------------------------- Sparkline ------------------------------- */

interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  animated?: boolean;
  className?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  color = 'rgb(var(--primary))',
  width = 80,
  height = 24,
  animated = true,
  className,
}) => {
  const reduceMotion = useReducedMotion();
  const shouldAnimate = animated && !reduceMotion;

  if (!data.length) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className={cn('overflow-visible', className)}>
      <motion.polyline
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        className="chart-shadow-soft"
        initial={shouldAnimate ? { pathLength: 0, opacity: 0 } : false}
        animate={shouldAnimate ? { pathLength: 1, opacity: 1 } : false}
        transition={shouldAnimate ? { duration: 1.1, ease: 'easeOut' } : { duration: 0 }}
      />
      {shouldAnimate &&
        data.map((v, i) => {
          const x = (i / (data.length - 1)) * width;
          const y = height - ((v - min) / range) * height;
          return (
            <motion.circle
              key={i}
              cx={x}
              cy={y}
              r={1.5}
              fill={color}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.22, delay: i * 0.05 + 0.25 }}
            />
          );
        })}
    </svg>
  );
};

/* ------------------------------- Line Chart ------------------------------ */

interface LineChartProps {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
  animated?: boolean;
  className?: string;
}

export const LineChart: React.FC<LineChartProps> = ({
  data,
  color = 'rgb(var(--primary))',
  height = 200,
  animated = true,
  className,
}) => {
  const reduceMotion = useReducedMotion();
  const shouldAnimate = animated && !reduceMotion;

  const gid = React.useId();
  if (!data.length) return null;

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const minValue = Math.min(...data.map((d) => d.value), 0);
  const range = maxValue - minValue || 1;
  const width = 300;

  const points = data.map((item, index) => {
    const x = (index / (data.length - 1)) * width;
    const y = height - ((item.value - minValue) / range) * height;
    return { x, y, value: item.value, label: item.label };
  });

  const pathData = `M ${points.map((p) => `${p.x},${p.y}`).join(' L ')}`;

  return (
    <div className={cn('relative inline-block overflow-visible', className)}>
      <svg width={width} height={height} className="overflow-visible">
        <defs>
          <pattern id={`grid-${gid}`} width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgb(var(--border) / 0.12)" strokeWidth="1" />
          </pattern>
          <linearGradient id={`area-${gid}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect width={width} height={height} fill={`url(#grid-${gid})`} />

        <motion.path
          d={`${pathData} L ${width},${height} L 0,${height} Z`}
          fill={`url(#area-${gid})`}
          initial={shouldAnimate ? { opacity: 0 } : false}
          animate={{ opacity: 0.22 }}
          transition={shouldAnimate ? { duration: 0.8, delay: 0.25 } : { duration: 0 }}
        />

        <motion.path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="chart-shadow"
          initial={shouldAnimate ? { pathLength: 0 } : false}
          animate={{ pathLength: 1 }}
          transition={shouldAnimate ? { duration: 1.6, ease: 'easeOut' } : { duration: 0 }}
        />

        {points.map((pt, idx) => (
          <motion.g key={idx}>
            <motion.circle
              cx={pt.x}
              cy={pt.y}
              r={4}
              fill={color}
              stroke="rgb(var(--bg) / 1)"
              strokeWidth={2}
              initial={shouldAnimate ? { scale: 0, opacity: 0 } : false}
              animate={{ scale: 1, opacity: 1 }}
              transition={shouldAnimate ? { duration: 0.22, delay: idx * 0.06 + 0.55 } : { duration: 0 }}
              whileHover={!reduceMotion ? { scale: 1.4 } : undefined}
              className="cursor-pointer"
            />
          </motion.g>
        ))}
      </svg>
    </div>
  );
};

/* ---------------------------- Animated Counter --------------------------- */

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
}

export const AnimatedCounter: React.FC<AnimatedCounterProps> = ({ value, duration = 0.55, className }) => {
  return <AnimatedNumber value={value} duration={duration} className={className} />;
};
