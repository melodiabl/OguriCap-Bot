import React from 'react';
import { motion } from 'framer-motion';

interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  hover?: boolean;
  glow?: boolean;
  gradient?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'cyan';
  onClick?: () => void;
}

const gradientColors = {
  primary: 'from-primary-500/20 to-primary-600/10',
  success: 'from-emerald-500/20 to-emerald-600/10',
  warning: 'from-amber-500/20 to-amber-600/10',
  danger: 'from-red-500/20 to-red-600/10',
  info: 'from-cyan-500/20 to-cyan-600/10',
  violet: 'from-violet-500/20 to-violet-600/10',
  cyan: 'from-cyan-500/20 to-teal-600/10',
};

const glowColors = {
  primary: 'hover:shadow-glow',
  success: 'hover:shadow-glow-emerald',
  warning: 'hover:shadow-[0_0_20px_rgba(245,158,11,0.5)]',
  danger: 'hover:shadow-[0_0_20px_rgba(239,68,68,0.5)]',
  info: 'hover:shadow-glow-cyan',
  violet: 'hover:shadow-glow-violet',
  cyan: 'hover:shadow-glow-cyan',
};

export const AnimatedCard: React.FC<AnimatedCardProps> = ({
  children,
  className = '',
  delay = 0,
  hover = true,
  glow = false,
  gradient,
  onClick,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.25, 0.46, 0.45, 0.94],
      }}
      whileHover={hover ? { scale: 1.02, y: -5 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
      onClick={onClick}
      className={`
        relative overflow-hidden rounded-2xl
        bg-gradient-to-br from-white/10 to-white/5
        backdrop-blur-xl border border-white/10
        shadow-xl transition-all duration-300
        ${gradient ? `bg-gradient-to-br ${gradientColors[gradient]}` : ''}
        ${glow ? glowColors[gradient || 'primary'] : ''}
        ${hover ? 'hover:border-white/20' : ''}
        ${onClick ? 'cursor-pointer' : ''}
        ${className}
      `}
    >
      {/* Gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      
      {/* Content */}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
};

// ===== Stat Card Component =====
interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'cyan';
  delay?: number;
  loading?: boolean;
}

const iconBgColors = {
  primary: 'bg-primary-500/20 text-primary-400',
  success: 'bg-emerald-500/20 text-emerald-400',
  warning: 'bg-amber-500/20 text-amber-400',
  danger: 'bg-red-500/20 text-red-400',
  info: 'bg-cyan-500/20 text-cyan-400',
  violet: 'bg-violet-500/20 text-violet-400',
  cyan: 'bg-cyan-500/20 text-cyan-400',
};

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'primary',
  delay = 0,
  loading = false,
}) => {
  return (
    <AnimatedCard delay={delay} glow gradient={color} className="p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-400 mb-1">{title}</p>
          {loading ? (
            <div className="h-9 w-24 skeleton rounded" />
          ) : (
            <motion.p
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: delay + 0.2, duration: 0.3 }}
              className="text-3xl font-bold text-white"
            >
              {value}
            </motion.p>
          )}
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
          {trend && (
            <div className={`flex items-center gap-1 mt-2 text-sm ${trend.isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
              <span>{trend.isPositive ? '↑' : '↓'}</span>
              <span>{Math.abs(trend.value)}%</span>
              <span className="text-gray-500">vs ayer</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-xl ${iconBgColors[color]}`}>
          {icon}
        </div>
      </div>
    </AnimatedCard>
  );
};

// ===== Glow Card Component =====
interface GlowCardProps {
  children: React.ReactNode;
  className?: string;
}

export const GlowCard: React.FC<GlowCardProps> = ({ children, className = '' }) => {
  return (
    <div className={`card-glow ${className}`}>
      <div className="card-glow-inner">{children}</div>
    </div>
  );
};

export default AnimatedCard;
