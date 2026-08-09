'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

type SectionProps = {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
};

export function Section({
  title,
  description,
  icon,
  actions,
  footer,
  children,
  className,
  headerClassName,
  bodyClassName,
  footerClassName,
}: SectionProps) {
  const hasHeader = Boolean(title || description || icon || actions);
  return (
    <section className={cn('section-container', className)}>
      {hasHeader && (
        <header className={cn('section-header', headerClassName)}>
          <div className="flex min-w-0 flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:text-left">
            {icon ? <div className="shrink-0">{icon}</div> : null}
            <div className="min-w-0">
              {title ? (
                <h3 className="truncate text-lg font-semibold text-foreground">
                  {title}
                </h3>
              ) : null}
              {description ? (
                <p className="truncate text-sm text-muted">
                  {description}
                </p>
              ) : null}
            </div>
          </div>
          {actions ? <div className="panel-actions-wrap shrink-0">{actions}</div> : null}
        </header>
      )}

      <div className={cn('section-body', bodyClassName)}>{children}</div>

      {footer ? <footer className={cn('section-footer', footerClassName)}>{footer}</footer> : null}
    </section>
  );
}
