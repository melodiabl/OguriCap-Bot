'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  animated?: boolean;
  delay?: number;
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, animated = false, delay = 0, children, ...props }, ref) => {
    if (animated) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay }}
          className={cn('glass-card', className)}
        >
          {children}
        </motion.div>
      );
    }

    return (
      <div ref={ref} className={cn('glass-card', className)} {...props}>
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
}

const colorClasses = {
  primary: 'text-primary-400 bg-primary-500/20',
  success: 'text-emerald-400 bg-emerald-500/20',
  warning: 'text-amber-400 bg-amber-500/20',
  danger: 'text-red-400 bg-red-500/20',
  info: 'text-cyan-400 bg-cyan-500/20',
  violet: 'text-violet-400 bg-violet-500/20',
  cyan: 'text-cyan-400 bg-cyan-500/20',
};

export const StatCard: React.FC<StatCardProps> = ({
  title, value, subtitle, icon, color = 'primary', delay = 0, loading
}) => (
  <Card animated delay={delay} className="p-6">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm text-gray-400 [html.light_&]:text-gray-600 mb-1">{title}</p>
        {loading ? (
          <div className="skeleton h-8 w-20 rounded" />
        ) : (
          <motion.p
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: delay + 0.2 }}
            className="text-3xl font-bold text-white [html.light_&]:text-gray-900"
          >
            {value}
          </motion.p>
        )}
        {subtitle && <p className="text-xs text-gray-500 [html.light_&]:text-gray-600 mt-1">{subtitle}</p>}
      </div>
      <div className={cn('p-3 rounded-xl', colorClasses[color])}>
        {icon}
      </div>
    </div>
  </Card>
);

// Glow Card
export const GlowCard: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <motion.div
    whileHover={{ scale: 1.02 }}
    className={cn('glass-card p-4 hover:shadow-glow transition-all duration-300', className)}
  >
    {children}
  </motion.div>
);

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent };