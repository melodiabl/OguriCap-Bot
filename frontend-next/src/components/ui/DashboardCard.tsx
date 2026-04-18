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
        'p-5 sm:p-6',
        variant === 'chart' && 'chart-container',
        loading && 'is-loading',
        className
      )}
    >
      {(title || description || icon || actions) && (
        <div className="panel-card-header">
          <div className="panel-card-heading">
            {icon ? <div className="panel-card-icon">{icon}</div> : null}
            <div className="min-w-0">
              {title ? <h3 className="panel-card-title">{title}</h3> : null}
              {description ? (
                <p className="panel-card-description">{description}</p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="panel-actions-wrap shrink-0">{actions}</div> : null}
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

      {footer ? <div className="mt-5 border-t border-border/10 pt-4">{footer}</div> : null}
    </Card>
  );
}
