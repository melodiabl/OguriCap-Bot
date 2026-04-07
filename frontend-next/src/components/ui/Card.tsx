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
      'group relative overflow-hidden rounded-[28px] border border-border/15 bg-card/58 shadow-[0_24px_70px_-36px_rgba(0,0,0,0.28)] backdrop-blur-xl',
      hover && 'transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-[0_28px_80px_-34px_rgba(0,0,0,0.82),0_0_42px_rgba(127,180,255,0.10)]',
      glow && 'ring-1 ring-oguri-lavender/20 shadow-glow-oguri-mixed',
      className
    );
    const cardContent = (
      <>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/[0.07] via-transparent to-primary/12 opacity-90"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] [background-size:28px_28px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
        />
        {!reduceMotion && (
          <motion.div
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute left-[-24%] top-0 h-px w-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent blur-[1px]',
              glow && 'via-oguri-cyan/45'
            )}
            animate={{ x: ['0%', '260%'] }}
            transition={{ repeat: Infinity, duration: glow ? 5.6 : 8.2, ease: 'easeInOut', delay }}
          />
        )}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 top-4 h-32 w-32 rounded-full bg-primary/10 blur-3xl opacity-60 transition-opacity duration-500 group-hover:opacity-100"
        />
        <div
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute -left-14 bottom-0 h-28 w-28 rounded-full bg-secondary/12 blur-3xl opacity-45 transition-opacity duration-500 group-hover:opacity-80',
            glow && 'bg-accent/16 opacity-60'
          )}
        />
        <div className="relative z-10">{children as React.ReactNode}</div>
      </>
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
    <div ref={ref} className={cn('flex flex-col space-y-1.5 border-b border-border/10 p-6 pb-4', className)} {...props} />
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
    <div ref={ref} className={cn('flex items-center border-t border-border/10 p-6 pt-0', className)} {...props} />
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

const colorGlowClasses = {
  primary: 'bg-oguri-purple/18',
  success: 'bg-oguri-cyan/18',
  warning: 'bg-oguri-gold/18',
  danger: 'bg-red-500/18',
  info: 'bg-oguri-blue/18',
  violet: 'bg-oguri-lavender/18',
  cyan: 'bg-oguri-cyan/18',
};

const colorStreakClasses = {
  primary: 'from-transparent via-oguri-purple/35 to-transparent',
  success: 'from-transparent via-oguri-cyan/35 to-transparent',
  warning: 'from-transparent via-oguri-gold/35 to-transparent',
  danger: 'from-transparent via-red-400/35 to-transparent',
  info: 'from-transparent via-oguri-blue/35 to-transparent',
  violet: 'from-transparent via-oguri-lavender/35 to-transparent',
  cyan: 'from-transparent via-oguri-cyan/35 to-transparent',
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
      <div className="relative overflow-hidden rounded-[28px] border border-border/15 bg-card/70 p-5 shadow-[0_24px_70px_-36px_rgba(0,0,0,0.28)] backdrop-blur-xl">
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
        'relative overflow-hidden rounded-[28px] border border-border/15 bg-card/70 p-5 group shadow-[0_24px_70px_-36px_rgba(0,0,0,0.28)] backdrop-blur-xl transition-all duration-300',
        'hover:border-primary/25 hover:shadow-[0_28px_80px_-34px_rgba(0,0,0,0.34)] hover:-translate-y-1',
        active && 'animate-pulse-glow-oguri border-oguri-lavender/50 shadow-glow-oguri-mixed'
      )}
      initial={shouldAnimate ? { opacity: 0, y: 20, scale: 0.98 } : undefined}
      whileInView={shouldAnimate ? { opacity: 1, y: 0, scale: 1 } : undefined}
      viewport={shouldAnimate ? { once: true, amount: 0.35 } : undefined}
      transition={shouldAnimate ? { duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] } : undefined}
    >
      {/* Background Accent */}
      <div className={cn('absolute -right-10 -top-10 h-28 w-28 blur-3xl transition-opacity duration-500 group-hover:opacity-100', colorGlowClasses[color])} />
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent" />
      <motion.div
        aria-hidden="true"
        className={cn('absolute left-[-25%] top-0 h-px w-1/2 bg-gradient-to-r blur-[1px]', colorStreakClasses[color])}
        animate={shouldAnimate ? { x: ['0%', '260%'] } : { x: '0%' }}
        transition={shouldAnimate ? { repeat: Infinity, duration: 6.5, ease: 'easeInOut', delay } : { duration: 0 }}
      />
      
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
        'relative overflow-hidden rounded-[28px] border border-border/15 bg-card/70 shadow-[0_24px_70px_-36px_rgba(0,0,0,0.28)] backdrop-blur-xl',
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
      {/* Subtle glow animation */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent animate-pulse-slow" />
    </motion.div>
  );
};

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };
