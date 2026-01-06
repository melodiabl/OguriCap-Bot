'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';

type DashboardCardVariant = 'default' | 'chart';

type DashboardCardProps = {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  loading?: boolean;
  animated?: boolean;
  delay?: number;
  glow?: boolean;
  hover?: boolean;
  variant?: DashboardCardVariant;
  className?: string;
  children?: React.ReactNode;
};

export function DashboardCard({
  title,
  description,
  icon,
  actions,
  footer,
  loading = false,
  animated = true,
  delay = 0,
  glow = false,
  hover = true,
  variant = 'default',
  className,
  children,
}: DashboardCardProps) {
  return (
    <Card
      animated={animated}
      delay={delay}
      hover={hover}
      glow={glow}
      className={cn(
        'p-6',
        variant === 'chart' && 'chart-container',
        loading && 'is-loading',
        className
      )}
    >
      {(title || description || icon || actions) && (
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3 min-w-0">
            {icon ? <div className="shrink-0">{icon}</div> : null}
            <div className="min-w-0">
              {title ? <h3 className="text-sm font-semibold text-foreground">{title}</h3> : null}
              {description ? (
                <p className="text-xs text-muted truncate">{description}</p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="shrink-0 flex items-center gap-2">{actions}</div> : null}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-4 w-2/3 rounded" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </div>
      ) : (
        children
      )}

      {footer ? <div className="mt-4 pt-4 border-t border-border/10">{footer}</div> : null}
    </Card>
  );
}
