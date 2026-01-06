import React from 'react';
import { cn } from '@/lib/utils';

type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'destructive'
  | 'outline'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info';

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'badge-primary',
  primary: 'badge-primary',
  secondary: 'badge-info',
  info: 'badge-info',
  destructive: 'badge-danger',
  danger: 'badge-danger',
  success: 'badge-success',
  warning: 'badge-warning',
  outline: 'badge bg-white/5 text-gray-300 border border-white/10',
};

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(({ className, variant = 'default', ...props }, ref) => {
  return <div ref={ref} className={cn(variantClasses[variant], className)} {...props} />;
});
Badge.displayName = 'Badge';

export { Badge };
