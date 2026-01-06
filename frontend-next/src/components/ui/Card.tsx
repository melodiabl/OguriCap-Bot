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
      'ultra-card ultra-card--glow',
      hover && 'ultra-card--interactive glass-hover hover-lift-soft',
      glow && 'shadow-glow-lg',
      className
    );
    if (animated) {
      return (
        <motion.div
          ref={ref}
          initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.95 }}
          whileInView={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.3, delay, ease: "easeOut" }}
          className={cardClassName}
          {...props}
        >
          {children}
        </motion.div>
      );
    }

    return (
      <div ref={ref} className={cardClassName} {...(props as any)}>
        {children}
      </div>
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
    <h3 ref={ref} className={cn('text-xl font-semibold text-foreground', className)} {...props} />
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
  active?: boolean;
}

const colorClasses = {
  primary: 'text-primary bg-primary/15 ring-1 ring-primary/25',
  success: 'text-success bg-success/15 ring-1 ring-success/25',
  warning: 'text-warning bg-warning/15 ring-1 ring-warning/25',
  danger: 'text-danger bg-danger/15 ring-1 ring-danger/25',
  info: 'text-accent bg-accent/15 ring-1 ring-accent/25',
  violet: 'text-secondary bg-secondary/15 ring-1 ring-secondary/25',
  cyan: 'text-accent bg-accent/15 ring-1 ring-accent/25',
};

const borderClasses: Record<NonNullable<StatCardProps['color']>, string> = {
  primary: 'border-primary/25',
  success: 'border-success/25',
  warning: 'border-warning/25',
  danger: 'border-danger/25',
  info: 'border-accent/25',
  violet: 'border-secondary/25',
  cyan: 'border-accent/25',
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
  const prevValueRef = React.useRef<number | string | null>(null);
  const [flash, setFlash] = React.useState(false);

  React.useEffect(() => {
    if (!shouldAnimate) return;
    if (prevValueRef.current === null) {
      prevValueRef.current = value as any;
      return;
    }
    if (prevValueRef.current !== (value as any)) {
      prevValueRef.current = value as any;
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 900);
      return () => window.clearTimeout(t);
    }
  }, [shouldAnimate, value]);
  if (loading) {
    return (
      <motion.div
        className={cn('card-stat hover-lift-soft hover-glass-bright', borderClasses[color], active && 'animate-pulse-glow')}
        initial={shouldAnimate ? { opacity: 0, y: 20 } : undefined}
        whileInView={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
        viewport={shouldAnimate ? { once: true, amount: 0.35 } : undefined}
        transition={shouldAnimate ? { duration: 0.4, delay } : undefined}
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
      className={cn(
        'card-stat group hover-lift-soft hover-glass-bright',
        active && 'animate-pulse-glow',
        borderClasses[color]
      )}
      initial={shouldAnimate ? { opacity: 0, y: 26, scale: 0.98 } : undefined}
      whileInView={shouldAnimate ? { opacity: 1, y: 0, scale: 1 } : undefined}
      viewport={shouldAnimate ? { once: true, amount: 0.35 } : undefined}
      transition={shouldAnimate ? { duration: 0.4, delay, ease: "easeOut" } : undefined}
    >
      {/* Background glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-4">
          <motion.h3
            className="text-sm font-semibold text-foreground/70"
            initial={shouldAnimate ? { opacity: 0, x: -10 } : undefined}
            animate={shouldAnimate ? { opacity: 1, x: 0 } : undefined}
            transition={shouldAnimate ? { duration: 0.3, delay: delay + 0.1 } : undefined}
          >
            {title}
          </motion.h3>
          <motion.div 
            className={cn('p-3 rounded-xl', colorClasses[color])}
            initial={shouldAnimate ? { opacity: 0, scale: 0.9, rotate: -10 } : undefined}
            animate={shouldAnimate ? { opacity: 1, scale: 1, rotate: 0 } : undefined}
            transition={shouldAnimate ? { duration: 0.35, delay: delay + 0.2, ease: 'easeOut' } : undefined}
          >
            {icon}
          </motion.div>
        </div>
        
        <motion.div
          className={cn(
            'text-2xl font-bold text-foreground mb-1 rounded-lg -mx-2 px-2',
            flash && 'flash-update glow-on-update'
          )}
          initial={shouldAnimate ? { opacity: 0, y: 6 } : undefined}
          animate={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
          transition={shouldAnimate ? { duration: 0.35, delay: delay + 0.25, ease: 'easeOut' } : undefined}
        >
          {typeof value === 'number' ? (
            <AnimatedNumber value={value} duration={0.6} />
          ) : (
            value
          )}
        </motion.div>
        
        <div className="flex items-center justify-between">
          {subtitle && (
            <motion.p
              className="text-xs text-muted"
              initial={shouldAnimate ? { opacity: 0, y: 8 } : undefined}
              animate={shouldAnimate ? { opacity: 1, y: 0 } : undefined}
              transition={shouldAnimate ? { duration: 0.3, delay: delay + 0.35 } : undefined}
            >
              {subtitle}
            </motion.p>
          )}
          
          {trend !== undefined && (
            <motion.div
              className={cn(
                'flex items-center text-xs tabular-nums',
                trend > 0 ? 'text-success' : trend < 0 ? 'text-danger' : 'text-muted'
              )}
              initial={shouldAnimate ? { opacity: 0, x: 8 } : undefined}
              animate={shouldAnimate ? { opacity: 1, x: 0 } : undefined}
              transition={shouldAnimate ? { duration: 0.3, delay: delay + 0.45 } : undefined}
            >
              <span className="mr-1 hidden">
                {trend > 0 ? '▲' : trend < 0 ? '▼' : '•'}
              </span>
              <span className="mr-0.5">{trend > 0 ? '+' : trend < 0 ? '-' : ''}</span>
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
  animated = true,
  delay = 0
}) => {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      className={cn(
        'card-glow',
        className
      )}
      initial={!reduceMotion && animated ? { opacity: 0, y: 20, scale: 0.95 } : undefined}
      whileInView={!reduceMotion && animated ? { opacity: 1, y: 0, scale: 1 } : undefined}
      viewport={!reduceMotion && animated ? { once: true, amount: 0.3 } : undefined}
      whileHover={!reduceMotion && animated ? { scale: 1.02 } : undefined}
      transition={!reduceMotion && animated ? { duration: 0.3, delay, ease: "easeOut" } : undefined}
    >
      <div className="card-glow-inner">
        {children}
      </div>
    </motion.div>
  );
};

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
