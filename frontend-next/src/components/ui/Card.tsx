'use client';

import * as React from 'react';
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';
import { AnimatedNumber } from '@/components/ui/AnimatedNumber';

interface CardProps extends Omit<HTMLMotionProps<'div'>, 'ref'> {
  animated?: boolean;
  delay?: number;
  hover?: boolean;
  glow?: boolean;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, animated = false, delay = 0, hover = true, glow = false, children, ...props }, ref) => {
    const reduceMotion = useReducedMotion();
    const cardClassName = cn(
      'relative overflow-hidden rounded-2xl border border-white/10 backdrop-blur-xl',
      hover && 'hover:border-primary/40 transition-all duration-300 hover:shadow-2xl',
      glow && 'shadow-[0_0_30px_-10px_rgba(var(--primary-rgb),0.3)]',
      className
    );
    const cardStyle = { backgroundColor: 'rgb(var(--bg-0) / 0.80)' };
    if (animated) {
      return (
        <motion.div
          ref={ref}
          initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.98 }}
          whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
          className={cardClassName}
          style={cardStyle}
          {...props}
        >
          {children}
        </motion.div>
      );
    }

    return (
      <div ref={ref} className={cardClassName} style={cardStyle} {...(props as any)}>
        {children}
      </div>
    );
  }
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6 pb-4 border-b border-white/5', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-xl font-black text-white tracking-tight', className)} {...props} />
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-gray-500', className)} {...props} />
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
    <div ref={ref} className={cn('flex items-center p-6 pt-0 border-t border-white/5', className)} {...props} />
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
  active?: boolean;
}

const colorClasses = {
  primary: 'text-[rgb(var(--primary))] bg-[rgb(var(--primary)/0.15)] border border-[rgb(var(--primary)/0.25)] shadow-[0_0_15px_rgba(var(--primary),0.2)]',
  success: 'text-[rgb(var(--success))] bg-[rgb(var(--success)/0.15)] border border-[rgb(var(--success)/0.25)] shadow-[0_0_15px_rgba(var(--success),0.2)]',
  warning: 'text-[rgb(var(--warning))] bg-[rgb(var(--warning)/0.15)] border border-[rgb(var(--warning)/0.25)] shadow-[0_0_15px_rgba(var(--warning),0.2)]',
  danger: 'text-[rgb(var(--danger))] bg-[rgb(var(--danger)/0.15)] border border-[rgb(var(--danger)/0.25)] shadow-[0_0_15px_rgba(var(--danger),0.2)]',
  info: 'text-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.15)] border border-[rgb(var(--accent)/0.25)] shadow-[0_0_15px_rgba(var(--accent),0.2)]',
  violet: 'text-[rgb(var(--primary))] bg-[rgb(var(--primary)/0.15)] border border-[rgb(var(--primary)/0.25)] shadow-[0_0_15px_rgba(var(--primary),0.2)]',
  cyan: 'text-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.15)] border border-[rgb(var(--accent)/0.25)] shadow-[0_0_15px_rgba(var(--accent),0.2)]',
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
  animated = true,
  active = false,
}) => {
  const reduceMotion = useReducedMotion();
  const shouldAnimate = animated && !reduceMotion;

  if (loading) {
    return (
      <div className="relative overflow-hidden rounded-2xl border border-white/10 p-5" style={{ backgroundColor: 'rgb(var(--bg-0) / 0.80)' }}>
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-24 rounded bg-white/5" />
          <Skeleton className="h-10 w-10 rounded-xl bg-white/5" />
        </div>
        <Skeleton className="h-8 w-20 rounded mb-2 bg-white/5" />
        <Skeleton className="h-3 w-32 rounded bg-white/5" />
      </div>
    );
  }

  return (
    <motion.div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-white/10 p-5 group transition-all duration-300',
        'hover:border-primary/40 hover:shadow-2xl hover:-translate-y-1',
        active && 'animate-pulse-glow border-primary/50 shadow-glow-sm'
      )}
      style={{ backgroundColor: 'rgb(var(--bg-0) / 0.80)' }}
      initial={shouldAnimate ? { opacity: 0, y: 20, scale: 0.98 } : undefined}
      whileInView={shouldAnimate ? { opacity: 1, y: 0, scale: 1 } : undefined}
      viewport={shouldAnimate ? { once: true, amount: 0.35 } : undefined}
      transition={shouldAnimate ? { duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] } : undefined}
    >
      {/* Background Accent */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 group-hover:bg-primary/10 transition-colors" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black text-[rgb(var(--text-muted))] uppercase tracking-widest group-hover:text-[rgb(var(--text-secondary))] transition-colors">
            {title}
          </h3>
          <div className={cn('p-2.5 rounded-xl transition-all duration-500 group-hover:scale-110 group-hover:shadow-glow-sm', colorClasses[color])}>
            {icon}
          </div>
        </div>
        
        <div className="text-2xl font-black text-white mb-1 tracking-tight">
          {typeof value === 'number' ? (
            <AnimatedNumber value={value} duration={0.8} />
          ) : (
            value
          )}
        </div>
        
        <div className="flex items-center justify-between mt-2">
          {subtitle && (
            <p className="text-[11px] font-bold text-[rgb(var(--text-muted))] group-hover:text-[rgb(var(--text-secondary))] transition-colors">
              {subtitle}
            </p>
          )}
          
          {trend !== undefined && (
            <div className={cn(
              'flex items-center text-[10px] font-black px-1.5 py-0.5 rounded-md',
              trend > 0 ? 'text-[rgb(var(--success))] bg-[rgb(var(--success)/0.1)]' : trend < 0 ? 'text-[rgb(var(--danger))] bg-[rgb(var(--danger)/0.1)]' : 'text-[rgb(var(--text-muted))] bg-white/5'
            )}>
              {trend > 0 ? '+' : ''}{trend}%
            </div>
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
  animated = true,
  delay = 0
}) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(
        'relative rounded-2xl border border-white/10 shadow-[0_0_30px_-10px_rgba(var(--primary-rgb),0.2)] overflow-hidden',
        className
      )}
      style={{ backgroundColor: 'rgb(var(--bg-0) / 0.80)' }}
      initial={!reduceMotion && animated ? { opacity: 0, y: 20 } : undefined}
      whileInView={!reduceMotion && animated ? { opacity: 1, y: 0 } : undefined}
      viewport={!reduceMotion && animated ? { once: true, amount: 0.3 } : undefined}
      transition={!reduceMotion && animated ? { duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] } : undefined}
    >
      <div className="relative z-10 p-6">
        {children}
      </div>
      {/* Subtle glow animation */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent animate-pulse-slow" />
    </motion.div>
  );
};

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
