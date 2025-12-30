'use client';

import * as React from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  animated?: boolean;
  delay?: number;
  hover?: boolean;
  glow?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, animated = false, delay = 0, hover = true, glow = false, children, ...props }, ref) => {
    const reduceMotion = useReducedMotion();
    if (animated) {
      return (
        <motion.div
          ref={ref}
          initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.95 }}
          whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.25 }}
          whileHover={!reduceMotion && hover ? { 
            y: -5, 
            scale: 1.02,
            boxShadow: glow 
              ? "0 20px 40px rgba(99, 102, 241, 0.3)" 
              : "0 20px 40px rgba(0,0,0,0.2)"
          } : undefined}
          transition={{ duration: 0.3, delay, ease: "easeOut" }}
          className={cn('glass-card', glow && 'shadow-glow', className)}
          {...props}
        >
          {children}
        </motion.div>
      );
    }

    return (
      <motion.div
        ref={ref}
        whileHover={!reduceMotion && hover ? { y: -2, scale: 1.01 } : undefined}
        transition={{ duration: 0.25, ease: 'easeOut' }}
        className={cn('glass-card', glow && 'shadow-glow', className)}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6 pb-4', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-xl font-semibold text-white [html.light_&]:text-gray-900', className)} {...props} />
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-gray-400 [html.light_&]:text-gray-600', className)} {...props} />
  )
);
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
  )
);
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex items-center p-6 pt-0', className)} {...props} />
  )
);
CardFooter.displayName = 'CardFooter';

// Stat Card
interface StatCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'violet' | 'cyan';
  delay?: number;
  loading?: boolean;
  trend?: number; // Percentage change
  animated?: boolean;
}

const colorClasses = {
  primary: 'text-primary-400 bg-primary-500/20 border-primary-500/30',
  success: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
  warning: 'text-amber-400 bg-amber-500/20 border-amber-500/30',
  danger: 'text-red-400 bg-red-500/20 border-red-500/30',
  info: 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30',
  violet: 'text-violet-400 bg-violet-500/20 border-violet-500/30',
  cyan: 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30',
};

const gradientClasses = {
  primary: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30',
  success: 'from-emerald-500/20 to-green-500/20 border-emerald-500/30',
  warning: 'from-amber-500/20 to-orange-500/20 border-amber-500/30',
  danger: 'from-red-500/20 to-pink-500/20 border-red-500/30',
  info: 'from-cyan-500/20 to-blue-500/20 border-cyan-500/30',
  violet: 'from-violet-500/20 to-purple-500/20 border-violet-500/30',
  cyan: 'from-cyan-500/20 to-teal-500/20 border-cyan-500/30'
};

export const StatCard: React.FC<StatCardProps> = ({
  title, 
  value, 
  subtitle, 
  icon, 
  color = 'primary', 
  delay = 0, 
  loading = false,
  trend,
  animated = true
}) => {
  const reduceMotion = useReducedMotion();
  if (loading) {
    return (
      <motion.div
        className={`p-6 rounded-xl bg-gradient-to-br ${gradientClasses[color]} border backdrop-blur-sm`}
        initial={!reduceMotion && animated ? { opacity: 0, y: 20 } : undefined}
        whileInView={!reduceMotion && animated ? { opacity: 1, y: 0 } : undefined}
        viewport={!reduceMotion && animated ? { once: true, amount: 0.35 } : undefined}
        transition={!reduceMotion && animated ? { duration: 0.4, delay } : undefined}
      >
        <div>
          <div className="flex items-center justify-between mb-4">
            <Skeleton className="h-4 w-24 rounded" />
            <Skeleton className="h-10 w-10 rounded-xl" />
          </div>
          <Skeleton className="h-8 w-20 rounded mb-2" />
          <Skeleton className="h-3 w-32 rounded" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={`p-6 rounded-xl bg-gradient-to-br ${gradientClasses[color]} border backdrop-blur-sm relative overflow-hidden group`}
      initial={!reduceMotion && animated ? { opacity: 0, y: 30, scale: 0.9 } : undefined}
      whileInView={!reduceMotion && animated ? { opacity: 1, y: 0, scale: 1 } : undefined}
      viewport={!reduceMotion && animated ? { once: true, amount: 0.35 } : undefined}
      whileHover={!reduceMotion && animated ? { 
        y: -8, 
        scale: 1.02,
        boxShadow: "0 20px 40px rgba(0,0,0,0.15)"
      } : undefined}
      transition={!reduceMotion && animated ? { duration: 0.4, delay, ease: "easeOut" } : undefined}
    >
      {/* Background glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <motion.h3 
            className="text-sm font-medium text-gray-300"
            initial={animated ? { opacity: 0, x: -10 } : undefined}
            animate={animated ? { opacity: 1, x: 0 } : undefined}
            transition={animated ? { duration: 0.3, delay: delay + 0.1 } : undefined}
          >
            {title}
          </motion.h3>
          <motion.div 
            className={cn('p-3 rounded-xl', colorClasses[color])}
            initial={animated ? { opacity: 0, scale: 0, rotate: -180 } : undefined}
            animate={animated ? { opacity: 1, scale: 1, rotate: 0 } : undefined}
            transition={animated ? { duration: 0.5, delay: delay + 0.2 } : undefined}
          >
            {icon}
          </motion.div>
        </div>
        
        <motion.div 
          className="text-2xl font-bold text-white mb-1"
          initial={animated ? { opacity: 0, scale: 0.5 } : undefined}
          animate={animated ? { opacity: 1, scale: 1 } : undefined}
          transition={animated ? { duration: 0.5, delay: delay + 0.3, type: "spring" } : undefined}
        >
          {typeof value === 'number' ? (
            <AnimatedCounter value={value} duration={1} />
          ) : (
            value
          )}
        </motion.div>
        
        <div className="flex items-center justify-between">
          {subtitle && (
            <motion.p 
              className="text-xs text-gray-400"
              initial={animated ? { opacity: 0, y: 10 } : undefined}
              animate={animated ? { opacity: 1, y: 0 } : undefined}
              transition={animated ? { duration: 0.3, delay: delay + 0.4 } : undefined}
            >
              {subtitle}
            </motion.p>
          )}
          
          {trend !== undefined && (
            <motion.div 
              className={`flex items-center text-xs ${
                trend > 0 ? 'text-emerald-400' : trend < 0 ? 'text-red-400' : 'text-gray-400'
              }`}
              initial={animated ? { opacity: 0, x: 10 } : undefined}
              animate={animated ? { opacity: 1, x: 0 } : undefined}
              transition={animated ? { duration: 0.3, delay: delay + 0.5 } : undefined}
            >
              <span className="mr-1">
                {trend > 0 ? '↗' : trend < 0 ? '↘' : '→'}
              </span>
              {Math.abs(trend)}%
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// Glow Card
interface GlowCardProps {
  children: React.ReactNode;
  className?: string;
  color?: string;
  animated?: boolean;
  delay?: number;
}

export const GlowCard: React.FC<GlowCardProps> = ({ 
  children, 
  className = '', 
  color = '#6366f1',
  animated = true,
  delay = 0
}) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(
        'p-6 rounded-xl bg-gray-800/50 backdrop-blur-sm border border-gray-700/50',
        'relative overflow-hidden group cursor-pointer',
        className
      )}
      initial={!reduceMotion && animated ? { opacity: 0, y: 20, scale: 0.95 } : undefined}
      whileInView={!reduceMotion && animated ? { opacity: 1, y: 0, scale: 1 } : undefined}
      viewport={!reduceMotion && animated ? { once: true, amount: 0.3 } : undefined}
      whileHover={!reduceMotion && animated ? { 
        scale: 1.02,
        boxShadow: `0 20px 40px ${color}30`
      } : undefined}
      transition={!reduceMotion && animated ? { duration: 0.3, delay, ease: "easeOut" } : undefined}
    >
      {/* Animated background gradient */}
      <motion.div
        className="absolute inset-0 opacity-0 group-hover:opacity-100"
        style={{
          background: `linear-gradient(135deg, ${color}10, transparent)`
        }}
        transition={{ duration: 0.3 }}
      />
      
      {/* Glow effect */}
      <motion.div
        className="absolute -inset-1 rounded-xl opacity-0 group-hover:opacity-100 blur-sm"
        style={{
          background: `linear-gradient(135deg, ${color}20, transparent)`
        }}
        transition={{ duration: 0.3 }}
      />
      
      <div className="relative z-10">
        {children}
      </div>
    </motion.div>
  );
};

// Animated Counter Component
interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
}

const AnimatedCounter: React.FC<AnimatedCounterProps> = ({
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

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
