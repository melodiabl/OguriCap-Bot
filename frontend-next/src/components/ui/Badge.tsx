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
  default:     'badge bg-[#27272a] text-zinc-300 border border-[#3f3f46]',
  primary:     'badge bg-[#25d366]/15 text-[#25d366] border border-[#25d366]/25',
  secondary:   'badge bg-[#27272a] text-zinc-300 border border-[#3f3f46]',
  info:        'badge bg-sky-500/15 text-sky-400 border border-sky-500/25',
  destructive: 'badge bg-red-500/15 text-red-400 border border-red-500/25',
  danger:      'badge bg-red-500/15 text-red-400 border border-red-500/25',
  success:     'badge bg-[#25d366]/15 text-[#25d366] border border-[#25d366]/25',
  warning:     'badge bg-amber-500/15 text-amber-400 border border-amber-500/25',
  outline:     'badge bg-transparent text-zinc-400 border border-[#3f3f46]',
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
