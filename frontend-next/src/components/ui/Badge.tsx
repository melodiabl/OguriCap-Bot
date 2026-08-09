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
  outline: 'badge border border-border/15 bg-card/60 text-[rgb(var(--text-secondary))]',
};

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(({ className, variant = 'default', children, ...props }, ref) => {
  return (
    <div ref={ref} className={cn(variantClasses[variant], className)} {...props}>
      <span aria-hidden="true" className="badge__sheen" />
      <span className="badge__content">{children}</span>
    </div>
  );
});
Badge.displayName = 'Badge';

export { Badge };
