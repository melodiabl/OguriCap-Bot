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
      'group relative overflow-hidden rounded-xl border border-[#27272a] bg-[#0c0c0e]',
      hover && 'transition-all duration-300 hover:-translate-y-0.5 hover:border-[#3f3f46] hover:bg-[#18181b]',
      glow && 'ring-1 ring-[#25d366]/20 shadow-glow-pro-accent',
      className
    );
    const cardContent = (
      <div className="relative z-10 h-full">{children as React.ReactNode}</div>
    );


    if (animated) {
      return (
        <motion.div
          ref={ref}
          initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.98 }}
          whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
          className={cardClassName}
          {...props}
        >
          {cardContent}
        </motion.div>
      );
    }

    return (
      <div ref={ref} className={cardClassName} {...(props as any)}>
        {cardContent}
      </div>
    );
  }
);
Card.displayName = 'Card';

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col space-y-1.5 border-b border-[#27272a] p-6 pb-4', className)} {...props} />
  )
);
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-xl font-black text-foreground tracking-tight', className)} {...props} />
  )
);
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-muted', className)} {...props} />
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
    <div ref={ref} className={cn('flex items-center border-t border-[#27272a] p-6 pt-0', className)} {...props} />
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
  primary: 'text-oguri-purple bg-oguri-purple/15 border border-oguri-purple/25 shadow-glow-oguri-purple',
  success: 'text-oguri-cyan bg-oguri-cyan/15 border border-oguri-cyan/25 shadow-glow-oguri-cyan',
  warning: 'text-oguri-gold bg-oguri-gold/15 border border-oguri-gold/25 shadow-glow-oguri-mixed',
  danger: 'text-red-400 bg-red-500/15 border border-red-500/25',
  info: 'text-oguri-blue bg-oguri-blue/15 border border-oguri-blue/25 shadow-glow-oguri-blue',
  violet: 'text-oguri-lavender bg-oguri-lavender/15 border border-oguri-lavender/25 shadow-glow-oguri-lavender',
  cyan: 'text-oguri-cyan bg-oguri-cyan/15 border border-oguri-cyan/25 shadow-glow-oguri-cyan',
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
      <div className="relative overflow-hidden rounded-xl border border-[#27272a] bg-[#0c0c0e] p-5">
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
        'relative overflow-hidden rounded-xl border border-[#27272a] bg-[#0c0c0e] p-5 group transition-all duration-300',
        'hover:border-[#3f3f46] hover:bg-[#18181b] hover:-translate-y-1',
        active && 'animate-pulse-glow-oguri border-oguri-lavender/50 shadow-glow-oguri-mixed'
      )}
      initial={shouldAnimate ? { opacity: 0, y: 20, scale: 0.98 } : undefined}
      whileInView={shouldAnimate ? { opacity: 1, y: 0, scale: 1 } : undefined}
      viewport={shouldAnimate ? { once: true, amount: 0.35 } : undefined}
      transition={shouldAnimate ? { duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] } : undefined}
    >
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-black text-[rgb(var(--text-muted))] uppercase tracking-widest group-hover:text-[rgb(var(--text-secondary))] transition-colors">
            {title}
          </h3>
          <motion.div
            className={cn('p-2.5 rounded-xl transition-all duration-500 group-hover:scale-110 group-hover:shadow-glow-sm', colorClasses[color])}
            animate={shouldAnimate && active ? { y: [0, -2, 0], rotate: [0, 2, 0] } : { y: 0, rotate: 0 }}
            transition={shouldAnimate && active ? { repeat: Infinity, duration: 2.6, ease: 'easeInOut' } : { duration: 0 }}
          >
            {icon}
          </motion.div>
        </div>
        
        <div className="mb-1 text-2xl font-black tracking-tight text-foreground">
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
        'relative overflow-hidden rounded-xl border border-[#27272a] bg-[#0c0c0e]',
        className
      )}
      initial={!reduceMotion && animated ? { opacity: 0, y: 20 } : undefined}
      whileInView={!reduceMotion && animated ? { opacity: 1, y: 0 } : undefined}
      viewport={!reduceMotion && animated ? { once: true, amount: 0.3 } : undefined}
      transition={!reduceMotion && animated ? { duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] } : undefined}
    >
      <div className="relative z-10 p-6">
        {children}
      </div>
    </motion.div>
  );
};

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
